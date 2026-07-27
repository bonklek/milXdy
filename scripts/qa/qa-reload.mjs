import { createHash, randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { cp, mkdir, open, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { watch as watchFiles } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertSafeGeneratedOutputDir } from "../build/generated-output-dir-safety.mjs";

const DEFAULT_OUTPUT = resolve(homedir(), "Documents", "dev", "milXdy-QA", "chromium");
const DEFAULT_STAGING_ROOT = "tmp/qa-reload";
const DEFAULT_PORT = 7319;
const DEBOUNCE_MS = 450;
const POLL_TIMEOUT_MS = 20_000;
const ignoredWatchRoots = new Set([".git", "dist", "node_modules", "release", "tmp"]);
const QA_MANIFEST_KEY = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0K0sWrJ0FvFhcoctS5V2OohpDKZSw9mj8cPrKrUjAgz/s2iKSXqElg6mrHcx7GqBxJJXtwWu11rIlIhPpgDZsrN63FC4ezf39V4WxElAX/zmJ4+le/PQw7KQv2Us/K28EDGDpMFcQf4QrVXKaW0i7vw/z3UWX8goKm9s1SUIMT0s/JDcHY4f2p8oqeWJXbVhk0pM5wSgxhX+hX5s9XqjB0/py9PsWLPMp9TS2QoiVueSaPbz8vzwzErw+wMNCDes/gDDQreo0U0GHLeGU4KQELLPArIs/ef3OG6/hg5m3kLFWhVzY2E1cqQ2tcfgylNoql/5m/JK5ThO0NIdkNd+kwIDAQAB";

export async function main(argv = process.argv.slice(2)) {
  const once = argv.includes("--once");
  const watch = argv.includes("--watch") || !once;
  const returnToBaseline = argv.includes("--return-to-baseline");
  const localAppPackages = readRepeatedArg(argv, "--local-app-package");
  const trustFlags = ["--allow-local-review", "--acknowledge-package-consent", "--acknowledge-first-party-replacement", "--allow-sensitive-package-apis"]
    .filter((flag) => argv.includes(flag));
  if (returnToBaseline && localAppPackages.length > 0) throw new Error("--return-to-baseline cannot be combined with --local-app-package.");
  if (localAppPackages.length > 1) throw new Error("QA external composition accepts exactly one explicitly selected package.");
  if (localAppPackages.length > 0 && !once) throw new Error("QA external composition is one-shot only; use --once.");
  const replaceForeignOutput = argv.includes("--replace-foreign-output") || returnToBaseline;
  const outputDir = resolvePersistentQaOutput(readArg(argv, "--publish-dir") || process.env.MILXDY_QA_OUTPUT_DIR || DEFAULT_OUTPUT);
  const builder = readArg(argv, "--builder") || "scripts/build/build-extension.mjs";
  const port = readIntegerArg(argv, "--port", DEFAULT_PORT);
  const state = { build: null, waiters: new Set() };
  const publisherLock = await acquirePublisherLock(outputDir);
  let server = null;
  let watcher = null;

  let building = false;
  let queued = false;
  const runBuild = async () => {
    if (building) {
      queued = true;
      return;
    }
    building = true;
    do {
      queued = false;
      try {
        const composition = localAppPackages.length === 1
          ? await prepareExternalLocalPackageComposition(localAppPackages[0], trustFlags)
          : baselineComposition();
        const build = await buildQaOnce({ outputDir, builder, builderArgs: composition.builderArgs, composition: composition.provenance, port, replaceForeignOutput });
        state.build = build;
        process.exitCode = 0;
        releaseWaiters(state);
        console.log(`[milXdy QA] ready ${build.buildId}`);
        console.log(`[milXdy QA] load unpacked: ${resolve(outputDir)}`);
      } catch (error) {
        process.exitCode = 1;
        console.error(`[milXdy QA] build failed; last known-good output preserved: ${error instanceof Error ? error.message : error}`);
        if (once) throw error;
      }
    } while (queued);
    building = false;
  };

  try {
    server = watch ? await startCoordinator(state, port) : null;
    await runBuild();
    if (!watch) return;

    const trigger = createDebouncer(() => void runBuild(), DEBOUNCE_MS);
    watcher = watchFiles(resolve("."), { recursive: true }, (_event, filename) => {
      if (!filename || shouldIgnoreWatchPath(String(filename))) return;
      trigger();
    });
    console.log(`[milXdy QA] watching source changes (debounce ${DEBOUNCE_MS}ms; coordinator http://127.0.0.1:${port})`);
    await new Promise((resolvePromise) => {
      process.once("SIGINT", resolvePromise);
      process.once("SIGTERM", resolvePromise);
    });
    trigger.cancel();
  } finally {
    watcher?.close();
    for (const waiter of state.waiters) waiter.end();
    server?.close();
    await publisherLock.release();
  }
}

export async function buildQaOnce({ outputDir = DEFAULT_OUTPUT, builder = "scripts/build/build-extension.mjs", builderArgs = [], composition = baselineComposition(), port = DEFAULT_PORT, quiet = false, replaceForeignOutput = false } = {}) {
  const outputRoot = resolveQaBuildOutput(outputDir);
  const stagingRelative = `${DEFAULT_STAGING_ROOT}/staging-${process.pid}-${Date.now()}`;
  const staging = resolve(assertSafeGeneratedOutputDir(stagingRelative, "QA staging directory"));
  const before = await collectSourceIdentity();
  await rm(staging, { recursive: true, force: true });

  try {
    await runBuilder(builder, stagingRelative, builderArgs, quiet);
    const after = await collectSourceIdentity();
    if (before.sourceSha256 !== after.sourceSha256) {
      throw new Error("source changed during the build; discarded mixed-source output and queued a clean rebuild");
    }
    const provenance = createProvenance(after, outputRoot, port, composition);
    await injectQaRuntime(staging, provenance);
    await verifyStagedOutput(staging, provenance);
    await assertOutputCanBeReplaced(outputRoot, provenance, replaceForeignOutput);
    await promoteLastKnownGood(staging, outputRoot);
    return provenance;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export function createDebouncer(callback, delayMs) {
  let timer = null;
  const trigger = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      callback();
    }, delayMs);
  };
  trigger.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return trigger;
}

function baselineComposition() {
  return {
    builderArgs: [],
    provenance: {
      state: "release-baseline",
      fingerprint: "release-baseline",
      packages: [],
    },
  };
}

async function prepareExternalLocalPackageComposition(packagePath, trustFlags) {
  const compositionDir = "tmp/qa-local-app-composition";
  const planPath = `${compositionDir}/build-plan.json`;
  await rm(resolve(compositionDir), { recursive: true, force: true });
  await runNode([
    "scripts/packages/compose-local-app-packages.mjs",
    `--package=${packagePath}`,
    `--out-dir=${compositionDir}`,
    `--plan-out=${planPath}`,
    "--stage-external-packages",
    ...trustFlags,
  ]);
  const plan = JSON.parse(await readFile(resolve(planPath), "utf8"));
  if (!Array.isArray(plan.selectedPackageIds) || plan.selectedPackageIds.length !== 1) {
    throw new Error("QA external composition requires exactly one accepted package.");
  }
  const diagnostic = (plan.diagnostics || []).find((entry) => entry.packageId === plan.selectedPackageIds[0]);
  if (!diagnostic?.manifestSha256 || !diagnostic?.contentSha256 || !diagnostic?.packageSha256) {
    throw new Error("QA external composition plan is missing package hash provenance.");
  }
  const serializedPlan = JSON.stringify(plan);
  if (pathContainsAbsoluteLocalPath(serializedPlan)) {
    throw new Error("QA external composition plan must not retain an absolute package path.");
  }
  return {
    builderArgs: [`--local-app-plan=${planPath}`],
    provenance: {
      state: "external-local-package",
      fingerprint: plan.compositionFingerprint,
      packages: [{
        id: diagnostic.packageId,
        version: diagnostic.version,
        manifestSha256: diagnostic.manifestSha256,
        contentSha256: diagnostic.contentSha256,
        packageSha256: diagnostic.packageSha256,
      }],
    },
  };
}

function pathContainsAbsoluteLocalPath(value) {
  return /(?<![A-Za-z])[A-Za-z]:[\\/]/u.test(value);
}

function runNode(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, args, { cwd: resolve("."), stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`local package composer exited ${signal ? `for signal ${signal}` : `with code ${code}`}`));
    });
  });
}

export function resolvePersistentQaOutput(value = DEFAULT_OUTPUT) {
  const output = resolve(value);
  if (basename(output).toLowerCase() !== "chromium" || basename(dirname(output)).toLowerCase() !== "milxdy-qa") {
    throw new Error("Persistent QA output must be the chromium/ folder directly inside a milXdy-QA/ directory.");
  }
  return output;
}

export async function acquirePublisherLock(outputDir) {
  const output = resolveQaBuildOutput(outputDir);
  const lockPath = resolve(dirname(output), ".milxdy-qa-publisher.lock");
  const token = randomUUID();
  await mkdir(dirname(lockPath), { recursive: true });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const handle = await open(lockPath, "wx");
      await handle.writeFile(`${JSON.stringify({ token, pid: process.pid, source: resolve("."), acquiredAt: new Date().toISOString() }, null, 2)}\n`);
      await handle.close();
      return {
        path: lockPath,
        async release() {
          const current = await readJson(lockPath).catch(() => null);
          if (current?.token === token) await rm(lockPath, { force: true });
        },
      };
    } catch (error) {
      if (error?.code !== "EEXIST") throw error;
      const current = await readJson(lockPath).catch(() => null);
      if (current?.pid && processIsRunning(current.pid)) {
        throw new Error(`QA publisher is already active (PID ${current.pid}, source ${current.source || "unknown"}). Stop it before starting another publisher.`);
      }
      await rm(lockPath, { force: true });
    }
  }
  throw new Error("Could not acquire the QA publisher lock.");
}

export async function collectSourceIdentity() {
  const [commit, status, listed] = await Promise.all([
    runGit(["rev-parse", "HEAD"]),
    runGit(["status", "--porcelain=v1", "--untracked-files=all"]),
    runGit(["ls-files", "-co", "--exclude-standard", "-z"]),
  ]);
  const files = listed.split("\0").filter(Boolean).sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file.replaceAll("\\", "/"));
    hash.update("\0");
    try {
      const info = await stat(file);
      if (info.isFile()) hash.update(await readFile(file));
      else hash.update("<not-a-file>");
    } catch {
      hash.update("<deleted>");
    }
    hash.update("\0");
  }
  return {
    commit: commit.trim(),
    dirty: status.trim().length > 0,
    sourceSha256: hash.digest("hex"),
    fileCount: files.length,
  };
}

export async function startCoordinator(state, port = DEFAULT_PORT) {
  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", `http://127.0.0.1:${port}`);
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Access-Control-Allow-Origin", "*");
    if (url.pathname === "/milxdy-qa/status") {
      response.end(`${JSON.stringify({ ok: true, build: state.build })}\n`);
      return;
    }
    if (url.pathname !== "/milxdy-qa/poll") {
      response.statusCode = 404;
      response.end('{"error":"not found"}\n');
      return;
    }
    const runningBuildId = url.searchParams.get("buildId");
    if (state.build?.buildId && state.build.buildId !== runningBuildId) {
      response.end(`${JSON.stringify(coordinatorMessage("reload", state.build))}\n`);
      return;
    }
    const timer = setTimeout(() => {
      state.waiters.delete(response);
      response.end(`${JSON.stringify(coordinatorMessage("noop", state.build))}\n`);
    }, POLL_TIMEOUT_MS);
    response.on("close", () => {
      clearTimeout(timer);
      state.waiters.delete(response);
    });
    response.qaTimer = timer;
    response.qaRunningBuildId = runningBuildId;
    state.waiters.add(response);
  });
  await new Promise((resolvePromise, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", resolvePromise);
  });
  return server;
}

function createProvenance(source, outputDir, coordinatorPort, composition) {
  const builtAt = new Date().toISOString();
  const stamp = builtAt.replaceAll(/[-:.]/g, "").replace("Z", "Z");
  const shortCommit = source.commit.slice(0, 8);
  return {
    schemaVersion: 2,
    channel: "developer-qa",
    buildId: `${stamp}-${shortCommit}-${source.sourceSha256.slice(0, 12)}`,
    builtAt,
    source: {
      commit: source.commit,
      shortCommit,
      dirty: source.dirty,
      sha256: source.sourceSha256,
      fileCount: source.fileCount,
    },
    build: { target: "chromium", profile: "full", node: process.version },
    composition,
    extensionId: extensionIdFromManifestKey(QA_MANIFEST_KEY),
    output: resolve(outputDir),
    worktree: resolve("."),
    coordinatorPort,
  };
}

async function injectQaRuntime(staging, provenance) {
  const runtimeDir = resolve("scripts/qa/runtime");
  const encoded = JSON.stringify(provenance);
  const [backgroundTemplate, popupTemplate, popupCss, popupHtml, backgroundBundle, manifestText] = await Promise.all([
    readFile(resolve(runtimeDir, "qa-background.js"), "utf8"),
    readFile(resolve(runtimeDir, "qa-popup.js"), "utf8"),
    readFile(resolve(runtimeDir, "qa-popup.css"), "utf8"),
    readFile(resolve(staging, "popup.html"), "utf8"),
    readFile(resolve(staging, "background.js"), "utf8"),
    readFile(resolve(staging, "manifest.json"), "utf8"),
  ]);
  const replaceBuild = (template) => template.replace("__MILXDY_QA_BUILD_JSON__", encoded);
  const panel = [
    '      <section class="milxdy-qa-build" id="milxdyQaBuild" aria-label="Developer QA build" hidden>',
    "        <strong>DEVELOPER QA BUILD</strong>",
    '        <span id="milxdyQaRunning"></span>',
    '        <span id="milxdyQaDisk"></span>',
    '        <small id="milxdyQaStatus"></small>',
    '        <button id="milxdyQaReload" type="button"></button>',
    "      </section>",
  ].join("\n");
  const qaPopupHtml = popupHtml
    .replace('<link rel="stylesheet" href="popup.css">', '<link rel="stylesheet" href="popup.css">\n    <link rel="stylesheet" href="qa-popup.css">')
    .replace('<main class="app">', `<main class="app">\n${panel}`)
    .replace('<script src="popup.js"></script>', '<script src="qa-popup.js"></script>\n    <script src="popup.js"></script>');
  const manifest = JSON.parse(manifestText);
  manifest.name = "milXdy QA";
  manifest.key = QA_MANIFEST_KEY;
  manifest.version_name = `${manifest.version} QA ${provenance.source.shortCommit}-${provenance.source.sha256.slice(0, 8)}`;
  manifest.action.default_title = `milXdy QA ${provenance.source.shortCommit}-${provenance.source.sha256.slice(0, 8)}`;

  await Promise.all([
    writeFile(resolve(staging, "qa-build.json"), `${JSON.stringify(provenance, null, 2)}\n`),
    writeFile(resolve(staging, "qa-background.js"), replaceBuild(backgroundTemplate)),
    writeFile(resolve(staging, "qa-popup.js"), replaceBuild(popupTemplate)),
    writeFile(resolve(staging, "qa-popup.css"), popupCss),
    writeFile(resolve(staging, "popup.html"), qaPopupHtml),
    writeFile(resolve(staging, "background.js"), `importScripts("qa-background.js");\n${backgroundBundle}`),
    writeFile(resolve(staging, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`),
  ]);
}

async function verifyStagedOutput(staging, provenance) {
  const required = ["manifest.json", "background.js", "content.js", "popup.html", "popup.js", "qa-build.json", "qa-background.js", "qa-popup.js", "qa-popup.css"];
  const missing = required.filter((file) => !existsSync(resolve(staging, file)));
  if (missing.length) throw new Error(`QA staging output is incomplete: ${missing.join(", ")}`);
  const parsed = JSON.parse(await readFile(resolve(staging, "qa-build.json"), "utf8"));
  if (parsed.buildId !== provenance.buildId || parsed.channel !== "developer-qa") throw new Error("QA provenance verification failed");
  const manifest = JSON.parse(await readFile(resolve(staging, "manifest.json"), "utf8"));
  if (manifest.name !== "milXdy QA") throw new Error("QA manifest label was not injected");
  if (manifest.key !== QA_MANIFEST_KEY || provenance.extensionId !== extensionIdFromManifestKey(manifest.key)) {
    throw new Error("QA stable extension identity verification failed");
  }
  const runtimeSource = await readFile(resolve("src/platform/runtime/content-runtime.ts"), "utf8");
  const contentBundle = await readFile(resolve(staging, "content.js"), "utf8");
  if (runtimeSource.includes("milxdyAddOnsCatalog") && !contentBundle.includes("milxdyAddOnsCatalog")) {
    throw new Error("QA content bundle omitted the App Store dock control.");
  }
}

async function assertOutputCanBeReplaced(output, provenance, replaceForeignOutput) {
  const existingProvenance = await readJson(resolve(output, "qa-build.json")).catch(() => null);
  if (!existingProvenance || replaceForeignOutput) return;
  if (existingProvenance.source?.sha256 === provenance.source?.sha256
    && existingProvenance.composition?.fingerprint === provenance.composition?.fingerprint) return;
  throw new Error("QA output belongs to a different source snapshot. Use qa:apply-next for a submitted handoff, or rerun qa:build with --replace-foreign-output after intentionally switching sources.");
}

async function promoteLastKnownGood(staging, output) {
  await mkdir(dirname(output), { recursive: true });
  const publishStaging = `${output}.staging-${process.pid}-${Date.now()}`;
  const backup = `${output}.previous-${process.pid}`;
  await rm(publishStaging, { recursive: true, force: true });
  await rm(backup, { recursive: true, force: true });
  try {
    await cp(staging, publishStaging, { recursive: true });
    const hadOutput = existsSync(output);
    if (hadOutput) await rename(output, backup);
    await rename(publishStaging, output);
    await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (!existsSync(output) && existsSync(backup)) await rename(backup, output);
    throw new Error(`could not promote QA output atomically: ${error instanceof Error ? error.message : error}`);
  } finally {
    await rm(publishStaging, { recursive: true, force: true });
  }
}

function resolveQaBuildOutput(value) {
  if (isAbsolute(value)) return resolvePersistentQaOutput(value);
  return resolve(assertSafeGeneratedOutputDir(value, "QA output directory"));
}

function extensionIdFromManifestKey(key) {
  const digest = createHash("sha256").update(Buffer.from(key, "base64")).digest().subarray(0, 16);
  return Array.from(digest).flatMap((byte) => [byte >> 4, byte & 0x0f]).map((nibble) => String.fromCharCode(97 + nibble)).join("");
}

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function processIsRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code === "EPERM";
  }
}

function releaseWaiters(state) {
  for (const response of state.waiters) {
    clearTimeout(response.qaTimer);
    if (!response.writableEnded) {
      const action = response.qaRunningBuildId === state.build?.buildId ? "noop" : "reload";
      response.end(`${JSON.stringify(coordinatorMessage(action, state.build))}\n`);
    }
  }
  state.waiters.clear();
}

function coordinatorMessage(action, build) {
  return {
    action,
    buildId: build?.buildId || null,
    output: build?.output || null,
    extensionId: build?.extensionId || null,
  };
}

function runBuilder(builder, stagingRelative, builderArgs = [], quiet = false) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [builder, "--target=chromium", "--profile=full", `--output-dir=${stagingRelative}`, ...builderArgs], {
      cwd: resolve("."),
      stdio: quiet ? "ignore" : "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolvePromise();
      else reject(new Error(`extension builder exited ${signal ? `for signal ${signal}` : `with code ${code}`}`));
    });
  });
}

function runGit(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn("git", args, { cwd: resolve("."), windowsHide: true });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolvePromise(Buffer.concat(stdout).toString("utf8"))
      : reject(new Error(`git ${args[0]} failed: ${Buffer.concat(stderr).toString("utf8").trim()}`)));
  });
}

function shouldIgnoreWatchPath(filename) {
  const normalized = filename.replaceAll("\\", "/");
  const root = normalized.split("/")[0];
  return ignoredWatchRoots.has(root) || normalized.endsWith(".log") || normalized.endsWith(".tmp");
}

function readArg(argv, name) {
  const prefix = `${name}=`;
  return argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readRepeatedArg(argv, name) {
  const prefix = `${name}=`;
  return argv.filter((arg) => arg.startsWith(prefix)).map((arg) => arg.slice(prefix.length));
}

function readIntegerArg(argv, name, fallback) {
  const raw = readArg(argv, name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1024 || value > 65535) throw new Error(`${name} must be an integer from 1024 through 65535`);
  return value;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    process.exitCode = 1;
    console.error(error instanceof Error ? error.stack || error.message : error);
  });
}
