import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, ["scripts/addons/manage-local-addons.mjs", "status"], {
  encoding: "utf8",
});
if (result.status !== 0) {
  process.stderr.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  process.exit(result.status ?? 1);
}

const status = JSON.parse(await readFile("tmp/local-addon-manager/status.json", "utf8"));
const plan = JSON.parse(await readFile("tmp/local-addon-manager/composition/build-plan.json", "utf8"));
const runtime = await readFile("src/platform/runtime/content-runtime.ts", "utf8");
const manager = await readFile("scripts/addons/manage-local-addons.mjs", "utf8");

assert.equal(status.schemaVersion, 2);
assert.equal(status.mode, "managed-local-addons");
assert.equal(status.state, "prepared");
assert.equal(status.addOnsDirectory, "local-addons");
assert.equal(status.manualPackagesDirectory, "local-addons/manual");
assert.equal(status.catalogPackagesDirectory, "local-addons/catalog");
assert.equal(status.outputDirectory, "dist/chromium-local-apps");
assert.match(plan.buildId, /^[a-f0-9]{24}$/u);
assert.match(plan.compositionFingerprint, /^[a-f0-9]{64}$/u);
assert.equal(plan.outputDir, "tmp/local-addon-manager/build-staging");
assert.match(runtime, /A validated rebuild is ready/u);
assert.match(runtime, /MILXDY_LOCAL_ADDON_BUILD_ID/u);
assert.match(manager, /The stable build was not replaced/u);
assert.match(manager, /chrome:\/\/extensions/u);
assert.match(manager, /build-promotion\.json/u);
assert.match(manager, /Stage 1\/4/u);

console.log("Local Add-on Manager verification passed.");
