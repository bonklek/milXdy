import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { acquirePublisherLock, buildQaOnce, createDebouncer, resolvePersistentQaOutput, startCoordinator } from "../qa/qa-reload.mjs";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
assert.match(packageJson.scripts?.["qa:build"] || "", /qa-reload\.mjs --once/u);
assert.match(packageJson.scripts?.["qa:watch"] || "", /qa-reload\.mjs --watch/u);

let debounceCalls = 0;
const trigger = createDebouncer(() => debounceCalls += 1, 20);
trigger();
trigger();
trigger();
await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
assert.equal(debounceCalls, 1, "watch rebuilds must be debounced");

const persistentOutput = resolve("tmp/milXdy-QA/chromium");
assert.equal(resolvePersistentQaOutput(persistentOutput), persistentOutput);
await assert.rejects(
  async () => resolvePersistentQaOutput(resolve("tmp/not-the-qa-folder/chromium")),
  /milXdy-QA/u,
);
const firstLock = await acquirePublisherLock("tmp/milXdy-QA/chromium");
try {
  await assert.rejects(acquirePublisherLock("tmp/milXdy-QA/chromium"), /already active/u);
} finally {
  await firstLock.release();
  await rm(resolve("tmp/milXdy-QA"), { recursive: true, force: true });
}

const coordinatorState = { build: { buildId: "build-new", output: "C:\\milXdy-QA\\chromium", extensionId: "abcdefghijklmnopabcdefghijklmnop" }, waiters: new Set() };
const server = await startCoordinator(coordinatorState, 0);
try {
  const address = server.address();
  assert(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/milxdy-qa/poll?buildId=build-old`);
  assert.deepEqual(await response.json(), {
    action: "reload",
    buildId: "build-new",
    output: "C:\\milXdy-QA\\chromium",
    extensionId: "abcdefghijklmnopabcdefghijklmnop",
  });
} finally {
  await new Promise((resolvePromise) => server.close(resolvePromise));
}

const preservationDir = "tmp/qa-reload-preservation";
const preservationRoot = resolve(preservationDir);
await rm(preservationRoot, { recursive: true, force: true });
await mkdir(preservationRoot, { recursive: true });
await writeFile(resolve(preservationRoot, "last-known-good.txt"), "keep me\n");
await assert.rejects(
  buildQaOnce({ outputDir: preservationDir, builder: "scripts/qa/intentionally-missing-builder.mjs", quiet: true }),
  /builder exited|Cannot find module/u,
);
assert.equal(await readFile(resolve(preservationRoot, "last-known-good.txt"), "utf8"), "keep me\n", "failed builds must preserve the existing output");
await rm(preservationRoot, { recursive: true, force: true });

const artifactDir = "tmp/qa-reload-artifact";
const qaOutput = resolve(artifactDir);
await rm(qaOutput, { recursive: true, force: true });
try {
  await buildQaOnce({ outputDir: artifactDir, quiet: true });
  const provenance = JSON.parse(await readFile(resolve(qaOutput, "qa-build.json"), "utf8"));
  const manifest = JSON.parse(await readFile(resolve(qaOutput, "manifest.json"), "utf8"));
  const background = await readFile(resolve(qaOutput, "background.js"), "utf8");
  const qaBackground = await readFile(resolve(qaOutput, "qa-background.js"), "utf8");
  const popup = await readFile(resolve(qaOutput, "popup.html"), "utf8");
  assert.equal(provenance.channel, "developer-qa");
  assert.match(provenance.buildId, /^[0-9TZ]+-[a-f0-9]{8}-[a-f0-9]{12}$/u);
  assert.equal(manifest.name, "milXdy QA");
  assert.match(manifest.key || "", /^MIIB/u);
  assert.match(provenance.extensionId || "", /^[a-p]{32}$/u);
  assert.match(background, /^importScripts\("qa-background\.js"\);/u);
  assert.match(qaBackground, /milxdy\.qa\.reloadGuard/u);
  assert.match(popup, /id="milxdyQaBuild"/u);
  assert.match(popup, /src="qa-popup\.js"/u);
} finally {
  await rm(qaOutput, { recursive: true, force: true });
}

console.log("QA reload tool verification passed.");
