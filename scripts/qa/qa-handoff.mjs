import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, open, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const STATE_DIRECTORY_NAME = "milxdy-qa-handoff";
const PENDING_MANIFEST = "pending.json";
const PENDING_PATCH = "pending.patch";
const LAST_RESULT = "last-result.json";
const LOCK_FILE = "handoff.lock";
const QA_COORDINATOR_URL = "http://127.0.0.1:7319/milxdy-qa/status";
const DENIED_PATH_PREFIXES = ["scripts/qa/"];

export async function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (command === "submit") {
    const result = await submitHandoff({ replace: argv.includes("--replace") });
    console.log(`[milXdy QA handoff] submitted ${result.handoffId}`);
    console.log(`[milXdy QA handoff] base ${result.baseCommit}; ${result.changes.length} tracked path(s)`);
    return;
  }
  if (command === "apply-next") {
    const result = await applyNextHandoff();
    console.log(`[milXdy QA handoff] built ${result.handoffId}${result.buildId ? ` as ${result.buildId}` : ""}`);
    console.log("[milXdy QA handoff] QA host source restored; the generated QA output remains ready for Chrome.");
    return;
  }
  if (command === "status") {
    console.log(JSON.stringify(await readHandoffStatus(), null, 2));
    return;
  }
  throw new Error("Usage: qa-handoff.mjs <submit [--replace] | apply-next | status>");
}

export async function submitHandoff({ cwd = resolve("."), stateRoot, replace = false } = {}) {
  const root = stateRoot ? resolve(stateRoot) : await resolveSharedStateRoot(cwd);
  const lock = await acquireLock(root, cwd);
  try {
    const pendingPath = resolve(root, PENDING_MANIFEST);
    if (existsSync(pendingPath) && !replace) {
      const pending = await readJson(pendingPath).catch(() => null);
      throw new Error(`A QA handoff is already pending${pending?.handoffId ? ` (${pending.handoffId})` : ""}. Apply it first or rerun qa:submit with --replace.`);
    }

    const untracked = splitNull(await runGit(["ls-files", "--others", "--exclude-standard", "-z"], cwd));
    if (untracked.length) {
      throw new Error(`Untracked files are not included in the MVP handoff: ${untracked.join(", ")}. Stage intended new files with git add; no commit is required.`);
    }

    const baseCommit = (await runGit(["rev-parse", "HEAD"], cwd)).trim();
    const patch = await runGitBuffer(["diff", "--binary", "--full-index", "--no-ext-diff", "--no-renames", "HEAD", "--"], cwd);
    if (!patch.length) throw new Error("No uncommitted tracked changes were found relative to HEAD.");

    const changes = await collectChanges(cwd, baseCommit);
    const denied = changes.map((change) => change.path).filter(isDeniedPath);
    if (denied.length) throw new Error(`QA handoffs cannot modify their own control tooling: ${denied.join(", ")}`);

    const createdAt = new Date().toISOString();
    const patchSha256 = createHash("sha256").update(patch).digest("hex");
    const handoff = {
      schemaVersion: 1,
      handoffId: `qah-${createdAt.replaceAll(/[-:.]/g, "")}-${patchSha256.slice(0, 12)}`,
      createdAt,
      baseCommit,
      sourceWorktree: resolve(cwd),
      sourceBranch: (await runGit(["branch", "--show-current"], cwd)).trim() || null,
      patchSha256,
      patchBytes: patch.length,
      changes,
    };

    await mkdir(root, { recursive: true });
    await writeFileAtomically(resolve(root, PENDING_PATCH), patch);
    await writeFileAtomically(pendingPath, `${JSON.stringify(handoff, null, 2)}\n`);
    return handoff;
  } finally {
    await lock.release();
  }
}

export async function applyNextHandoff({
  cwd = resolve("."),
  stateRoot,
  buildRunner = runQaBuild,
  checkWatcher = true,
} = {}) {
  const root = stateRoot ? resolve(stateRoot) : await resolveSharedStateRoot(cwd);
  const lock = await acquireLock(root, cwd);
  let patchApplied = false;
  let handoff = null;
  try {
    const manifestPath = resolve(root, PENDING_MANIFEST);
    const patchPath = resolve(root, PENDING_PATCH);
    handoff = await readJson(manifestPath).catch(() => null);
    if (!handoff || !existsSync(patchPath)) throw new Error("No QA handoff is pending.");
    const patch = await readFile(patchPath);
    const actualPatchSha256 = createHash("sha256").update(patch).digest("hex");
    if (actualPatchSha256 !== handoff.patchSha256) {
      throw new Error(`Pending patch integrity check failed: expected ${handoff.patchSha256}, got ${actualPatchSha256}.`);
    }
    if (checkWatcher && await qaWatcherIsRunning()) {
      throw new Error("qa:watch is running on port 7319. Stop it before qa:apply-next; this command performs the one-shot QA build itself.");
    }

    const hostCommit = (await runGit(["rev-parse", "HEAD"], cwd)).trim();
    const baseExists = await gitSucceeds(["cat-file", "-e", `${handoff.baseCommit}^{commit}`], cwd);
    if (!baseExists) throw new Error(`Submitted base ${handoff.baseCommit} is unavailable in the QA host repository.`);
    const isAncestor = await gitSucceeds(["merge-base", "--is-ancestor", handoff.baseCommit, hostCommit], cwd);
    if (!isAncestor) {
      throw new Error(`Stale handoff: submitted base ${handoff.baseCommit} is not an ancestor of QA host ${hostCommit}.`);
    }
    await assertNoOverlap(handoff, cwd);
    await runGit(["apply", "--check", "--whitespace=nowarn", patchPath], cwd);
    await runGit(["apply", "--whitespace=nowarn", patchPath], cwd);
    patchApplied = true;

    let build;
    try {
      build = await buildRunner({ cwd, handoff });
    } catch (error) {
      await restoreHostPatch(patchPath, cwd);
      patchApplied = false;
      const failed = await writeResult(root, handoff, "build-failed", error instanceof Error ? error.message : String(error));
      throw new Error(`QA build failed; host source restored and the previous QA output was preserved. ${failed.reason}`);
    }

    await restoreHostPatch(patchPath, cwd);
    patchApplied = false;
    const result = await writeResult(root, handoff, "built", null, build?.buildId || null);
    await rm(manifestPath, { force: true });
    await rm(patchPath, { force: true });
    return result;
  } catch (error) {
    if (patchApplied) {
      try {
        await restoreHostPatch(resolve(root, PENDING_PATCH), cwd);
      } catch (restoreError) {
        throw new Error(`${error instanceof Error ? error.message : error} Host restoration also failed: ${restoreError instanceof Error ? restoreError.message : restoreError}`);
      }
    }
    if (handoff && !String(error).includes("QA build failed")) {
      await writeResult(root, handoff, "blocked", error instanceof Error ? error.message : String(error));
    }
    throw error;
  } finally {
    await lock.release();
  }
}

export async function readHandoffStatus({ cwd = resolve("."), stateRoot } = {}) {
  const root = stateRoot ? resolve(stateRoot) : await resolveSharedStateRoot(cwd);
  const pending = await readJson(resolve(root, PENDING_MANIFEST)).catch(() => null);
  const lastResult = await readJson(resolve(root, LAST_RESULT)).catch(() => null);
  let pendingIntegrity = null;
  if (pending) {
    try {
      const patch = await readFile(resolve(root, PENDING_PATCH));
      pendingIntegrity = createHash("sha256").update(patch).digest("hex") === pending.patchSha256 ? "ok" : "mismatch";
    } catch {
      pendingIntegrity = "missing-patch";
    }
  }
  return { stateRoot: root, pending, pendingIntegrity, lastResult };
}

async function collectChanges(cwd, baseCommit) {
  const tokens = splitNull(await runGit(["diff", "--name-status", "--no-renames", "-z", "HEAD", "--"], cwd));
  const changes = [];
  for (let index = 0; index < tokens.length; index += 2) {
    const status = tokens[index];
    const path = tokens[index + 1];
    if (!status || !path) throw new Error("Could not parse changed paths from Git.");
    const baseBlob = status === "A" ? null : await blobAtCommit(cwd, baseCommit, path);
    changes.push({ status, path: path.replaceAll("\\", "/"), baseBlob });
  }
  return changes;
}

async function assertNoOverlap(handoff, cwd) {
  for (const change of handoff.changes) {
    const path = change.path;
    if (change.baseBlob === null) {
      if (existsSync(resolve(cwd, path))) throw new Error(`Overlap at ${path}: submitted patch adds the path, but it already exists in the QA host.`);
      continue;
    }
    if (!existsSync(resolve(cwd, path))) throw new Error(`Overlap at ${path}: expected base blob ${change.baseBlob}, but the path is missing in the QA host.`);
    const currentBlob = (await runGit(["hash-object", "--", path], cwd)).trim();
    if (currentBlob !== change.baseBlob) {
      throw new Error(`Overlap at ${path}: submitted base blob ${change.baseBlob}, QA host has ${currentBlob}.`);
    }
  }
}

async function restoreHostPatch(patchPath, cwd) {
  await runGit(["apply", "--reverse", "--check", "--whitespace=nowarn", patchPath], cwd);
  await runGit(["apply", "--reverse", "--whitespace=nowarn", patchPath], cwd);
}

async function runQaBuild({ cwd }) {
  const output = [];
  await runProcess(process.execPath, ["scripts/qa/qa-reload.mjs", "--once"], {
    cwd,
    onStdout(chunk) {
      output.push(chunk);
      process.stdout.write(chunk);
    },
    onStderr(chunk) {
      process.stderr.write(chunk);
    },
  });
  const match = Buffer.concat(output).toString("utf8").match(/\[milXdy QA\] ready (\S+)/u);
  return { buildId: match?.[1] || null };
}

async function qaWatcherIsRunning() {
  try {
    const response = await fetch(QA_COORDINATOR_URL, { signal: AbortSignal.timeout(500) });
    return response.ok;
  } catch {
    return false;
  }
}

async function writeResult(root, handoff, status, reason = null, buildId = null) {
  const result = {
    schemaVersion: 1,
    handoffId: handoff.handoffId,
    status,
    completedAt: new Date().toISOString(),
    baseCommit: handoff.baseCommit,
    sourceWorktree: handoff.sourceWorktree,
    changedPaths: handoff.changes.map((change) => change.path),
    buildId,
    reason,
  };
  await writeFileAtomically(resolve(root, LAST_RESULT), `${JSON.stringify(result, null, 2)}\n`);
  return result;
}

async function resolveSharedStateRoot(cwd) {
  const commonDir = (await runGit(["rev-parse", "--path-format=absolute", "--git-common-dir"], cwd)).trim();
  return resolve(commonDir, STATE_DIRECTORY_NAME);
}

async function acquireLock(root, source) {
  await mkdir(root, { recursive: true });
  const lockPath = resolve(root, LOCK_FILE);
  const token = randomUUID();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${JSON.stringify({ token, pid: process.pid, source: resolve(source), acquiredAt: new Date().toISOString() })}\n`);
      await handle.close();
      return {
        async release() {
          const current = await readJson(lockPath).catch(() => null);
          if (current?.token === token) await rm(lockPath, { force: true });
        },
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const current = await readJson(lockPath).catch(() => null);
      if (current?.pid && processIsRunning(current.pid)) {
        throw new Error(`QA handoff state is busy (PID ${current.pid}, source ${current.source || "unknown"}).`);
      }
      await rm(lockPath, { force: true });
    }
  }
  throw new Error("Could not acquire the QA handoff lock.");
}

async function blobAtCommit(cwd, commit, path) {
  const output = await runGitBuffer(["ls-tree", "-z", commit, "--", path], cwd);
  const header = output.toString("utf8").split("\0", 1)[0];
  const match = header.match(/^\d+\s+blob\s+([a-f0-9]+)\t/u);
  if (!match) throw new Error(`Could not resolve base blob for ${path} at ${commit}.`);
  return match[1];
}

async function writeFileAtomically(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temporary = `${path}.tmp-${process.pid}-${randomUUID()}`;
  try {
    await writeFile(temporary, value);
    await rename(temporary, path);
  } finally {
    await rm(temporary, { force: true });
  }
}

function isDeniedPath(path) {
  const normalized = path.replaceAll("\\", "/");
  return DENIED_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

function splitNull(value) {
  return String(value).split("\0").filter(Boolean);
}

function processIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

async function gitSucceeds(args, cwd) {
  try {
    await runGit(args, cwd);
    return true;
  } catch {
    return false;
  }
}

function runGit(args, cwd) {
  return runGitBuffer(args, cwd).then((buffer) => buffer.toString("utf8"));
}

function runGitBuffer(args, cwd) {
  return runProcess("git", args, { cwd });
}

function runProcess(command, args, { cwd, onStdout, onStderr } = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => {
      stdout.push(chunk);
      onStdout?.(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr.push(chunk);
      onStderr?.(chunk);
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise(Buffer.concat(stdout));
      else reject(new Error(`${command} ${args[0] || ""} exited ${signal ? `for signal ${signal}` : `with code ${code}`}: ${Buffer.concat(stderr).toString("utf8").trim()}`));
    });
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.exitCode = 1;
    console.error(error instanceof Error ? error.stack || error.message : error);
  });
}
