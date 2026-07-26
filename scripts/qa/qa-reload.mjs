import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { watch as watchFiles } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { assertSafeGeneratedOutputDir } from "../build/generated-output-dir-safety.mjs";

const DEFAULT_OUTPUT = "dist/qa-chromium";
const DEFAULT_PORT = 7319;
const DEBOUNCE_MS = 450;
const POLL_TIMEOUT_MS = 20_000;
const ignoredWatchRoots = new Set([".git", "dist", "node_modules", "release", "tmp"]);

export async function main(argv = process.argv.slice(2)) {
  const once = argv.includes("--once");
  const watch = argv.includes("--watch") || !once;
  const outputDir = assertSafeGeneratedOutputDir(readArg(argv, "--output-dir") || DEFAULT_OUTPUT, "QA output directory");
  const builder = readArg(argv, "--builder") || "scripts/build/build-extension.mjs";
  const port = readIntegerArg(argv, "--port", DEFAULT_PORT);
  const state = { build: null, waiters: new Set() };
  const server = watch ? await startCoordinator(state, port) : null;

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
        const build = await buildQaOnce({ outputDir, builder, port });
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

  await runBuild();
  if (!watch) return;

  const trigger = createDebouncer(() => void runBuild(), DEBOUNCE_MS);
  const watcher = watchFiles(resolve("."), { recursive: true }, (_event, filename) => {
    if (!filename || shouldIgnoreWatchPath(String(filename))) return;
    trigger();
  });
  const close = () => {
    trigger.cancel();
    watcher.close();
    for (const waiter of state.waiters) waiter.end();
    server?.close();
  };
  process.once("SIGINT", close);
  process.once("SIGTERM", close);
  console.log(`[milXdy QA] watching source changes (debounce ${DEBOUNCE_MS}ms; coordinator http://127.0.0.1:${port})`);
}

export async function buildQaOnce({ outputDir = DEFAULT_OUTPUT, builder = "scripts/build/build-extension.mjs", port = DEFAULT_PORT, quiet = false } = {}) {
  const safeOutput = assertSafeGeneratedOutputDir(outputDir, "QA output directory");
  const outputRoot = resolve(safeOutput);
  const stagingRelative = `${dirname(safeOutput).replaceAll("\\", "/")}/.${basename(safeOutput)}-staging-${process.pid}-${Date.now()}`;
  const staging = resolve(assertSafeGeneratedOutputDir(stagingRelative, "QA staging directory"));
  const before = await collectSourceIdentity();
  await rm(staging, { recursive: true, force: true });

  try {
    await runBuilder(builder, stagingRelative, quiet);
    const after = await collectSourceIdentity();
    if (before.sourceSha256 !== after.sourceSha256) {
      throw new Error("source changed during the build; discarded mixed-source output and queued a clean rebuild");
    }
    const provenance = createProvenance(after, safeOutput, port);
    await injectQaRuntime(staging, provenance);
    await verifyStagedOutput(staging, provenance);
    await promoteLastKnownGood(staging, outputRoot);
    return provenance;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
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
      response.end(`${JSON.stringify({ action: "reload", buildId: state.build.buildId })}\n`);
      return;
    }
    const timer = setTimeout(() => {
      state.waiters.delete(response);
      response.end(`${JSON.stringify({ action: "noop", buildId: state.build?.buildId || null })}\n`);
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

function createProvenance(source, outputDir, coordinatorPort) {
  const builtAt = new Date().toISOString();
  const stamp = builtAt.replaceAll(/[-:.]/g, "").replace("Z", "Z");
  const shortCommit = source.commit.slice(0, 8);
  return {
    schemaVersion: 1,
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
}

async function promoteLastKnownGood(staging, output) {
  await mkdir(dirname(output), { recursive: true });
  const backup = `${output}.previous-${process.pid}`;
  await rm(backup, { recursive: true, force: true });
  const hadOutput = existsSync(output);
  try {
    if (hadOutput) await rename(output, backup);
    await rename(staging, output);
    await rm(backup, { recursive: true, force: true });
  } catch (error) {
    if (!existsSync(output) && existsSync(backup)) await rename(backup, output);
    throw new Error(`could not promote QA output atomically: ${error instanceof Error ? error.message : error}`);
  }
}

function releaseWaiters(state) {
  for (const response of state.waiters) {
    clearTimeout(response.qaTimer);
    if (!response.writableEnded) {
      const action = response.qaRunningBuildId === state.build?.buildId ? "noop" : "reload";
      response.end(`${JSON.stringify({ action, buildId: state.build?.buildId || null })}\n`);
    }
  }
  state.waiters.clear();
}

function runBuilder(builder, stagingRelative, quiet = false) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [builder, "--target=chromium", "--profile=full", `--output-dir=${stagingRelative}`], {
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
