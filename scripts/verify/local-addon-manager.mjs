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
const popup = await readFile("assets/extension/popup/popup.html", "utf8");
const popupRuntime = await readFile("src/extension/popup/index.ts", "utf8");

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
assert.match(runtime, /MILXDY_LOCAL_ADDON_BUILD_ID/u);
assert.match(runtime, /preflightLocalAddonZip/u);
assert.match(runtime, /milxdy\.app\.json must be at the ZIP root/u);
assert.doesNotMatch(runtime, /root\.append\(appHubRuntimeSummary\(\), localAddonManagerPanel\(\)\)/u);
assert.match(manager, /The stable build was not replaced/u);
assert.match(manager, /chrome:\/\/extensions/u);
assert.match(manager, /build-promotion\.json/u);
assert.match(manager, /Stage 1\/4/u);
assert.doesNotMatch(popup, /class="tab"[^>]+data-panel="wiki"/u);
assert.doesNotMatch(popup, /class="tab"[^>]+data-panel="addons"/u);
assert.match(popup, /data-installed-addon="wiki"/u);
assert.match(popup, /data-installed-addon="post-reading"/u);
assert.match(popup, /data-addon-settings-source="post-reading"/u);
assert.match(popup, /id="rebuildLocalAddons"[^>]+disabled/u);
assert.match(popupRuntime, /moveInstalledAddonSettings/u);
assert.match(popupRuntime, /installedAddonsPanel/u);
assert.match(popupRuntime, /renderLocalAddonSettings/u);
assert.match(popupRuntime, /PENDING_LOCAL_ADDON_REMOVALS_KEY/u);
assert.match(popupRuntime, /Removal queued for the next rebuild/u);
assert.doesNotMatch(popupRuntime, /milxdy:open-apps-features/u);

console.log("Local Add-on Manager verification passed.");
