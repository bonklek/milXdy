import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { contentScriptMatches, coreHostPermissions, releaseBuilds, webAccessibleMatches } from "./release-builds.mjs";
import { featureBundlesForProfile } from "./release-registry.mjs";

const registry = JSON.parse(await readFile("src/shared/firstPartyApps.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const expectedVersion = packageJson.version;

for (const build of releaseBuilds) {
  await verifyBuild(build);
}

console.log(`${expectedVersion} extension smoke verification passed.`);

async function verifyBuild(build) {
  assert(existsSync(build.dir), `${build.dir}: build directory missing`);
  const manifest = JSON.parse(await readFile(path.join(build.dir, "manifest.json"), "utf8"));
  const content = await readFile(path.join(build.dir, "content.js"), "utf8");
  const background = await readFile(path.join(build.dir, "background.js"), "utf8");
  const popupHtml = await readFile(path.join(build.dir, "popup.html"), "utf8");
  const popupJs = await readFile(path.join(build.dir, "popup.js"), "utf8");

  verifyManifest(build, manifest);
  verifyPopup(build, popupHtml, popupJs);
  verifyRuntimeBundle(build, content, background);
  verifyFeatureBundles(build);
  verifyAppAssets(build);
}

function verifyManifest(build, manifest) {
  assert(manifest.manifest_version === 3, `${build.dir}: manifest must be MV3`);
  assert(manifest.version === expectedVersion, `${build.dir}: manifest version must be ${expectedVersion}`);
  assert(manifest.action?.default_popup === "popup.html", `${build.dir}: action popup missing`);
  const contentScript = (manifest.content_scripts || []).find((script) => (script.js || []).includes("content.js"));
  assert(contentScript, `${build.dir}: content script missing`);
  assertEqualList([...(contentScript.matches || [])].sort(), [...contentScriptMatches].sort(), `${build.dir}: content script matches mismatch`);
  for (const block of manifest.web_accessible_resources || []) {
    assertEqualList([...(block.matches || [])].sort(), [...webAccessibleMatches].sort(), `${build.dir}: web accessible resource matches mismatch`);
  }
  const hosts = new Set(manifest.host_permissions || []);
  for (const host of coreHostPermissions) {
    assert(hosts.has(host), `${build.dir}: missing core host ${host}`);
  }
  if (build.profile === "full") {
    for (const host of [
      "https://boards.miladychan.org/*",
      "https://musicbrainz.org/*",
      "https://api.acoustid.org/*",
      "https://www.remilia.net/*",
    ]) {
      assert(hosts.has(host), `${build.dir}: missing full-profile host ${host}`);
    }
  }
  if (build.target === "firefox") {
    assert(Array.isArray(manifest.background?.scripts), `${build.dir}: Firefox background scripts missing`);
    assert(!manifest.background?.service_worker, `${build.dir}: Firefox manifest must not use service_worker`);
    assert(manifest.browser_specific_settings?.gecko?.id, `${build.dir}: Firefox Gecko id missing`);
  } else {
    assert(manifest.background?.service_worker === "background.js", `${build.dir}: Chromium service worker missing`);
  }
}

function verifyPopup(build, popupHtml, popupJs) {
  for (const value of ['value="fast"', 'value="balanced"', 'value="full"', 'value="developer"']) {
    assert(popupHtml.includes(value), `${build.dir}: popup missing Performance mode ${value}`);
  }
  assert(popupHtml.includes('data-control="performanceMode"'), `${build.dir}: popup performance control missing`);
  assert(popupJs.includes(`normalizeBuildProfile("${build.profile}")`), `${build.dir}: popup build profile constant mismatch`);
  assert(popupJs.includes("performanceModeSummary"), `${build.dir}: popup performance summary missing`);
}

function verifyRuntimeBundle(build, content, background) {
  assert(content.includes("milxdy-app-hub-panel"), `${build.dir}: Apps Hub panel missing from content bundle`);
  assert(content.includes("milxdy-app-hub-runtime"), `${build.dir}: Apps Hub runtime summary missing from content bundle`);
  assert(content.includes("milxdy-app-hub-runtime-state"), `${build.dir}: Apps Hub app runtime state missing from content bundle`);
  assert(content.includes("milxdy-overlay-dock-root"), `${build.dir}: overlay dock missing from content bundle`);
  assert(content.includes("milxdy.apps.firstRun.status"), `${build.dir}: first-run Apps Hub state missing`);
  assert(content.includes("milxdy.performance.mode"), `${build.dir}: Performance mode state missing`);
  assert(content.includes("milxdyVersion") && content.includes("milxdyBuildProfile") && content.includes("milxdyBuildTarget"), `${build.dir}: runtime build markers missing from content bundle`);
  assert(content.includes(JSON.stringify(expectedVersion)), `${build.dir}: runtime version marker value missing from content bundle`);
  assert(content.includes(`"${build.profile}"`), `${build.dir}: runtime build profile marker value missing from content bundle`);
  assert(content.includes(`"${build.target}"`), `${build.dir}: runtime build target marker value missing from content bundle`);
  assert(background.includes("Unsupported music lookup URL"), `${build.dir}: music allowlist rejection missing`);
  assert(background.includes("Unsupported Miladychan URL"), `${build.dir}: Miladychan allowlist rejection missing`);
  assert(background.includes("UNSUPPORTED_IMAGE_URL"), `${build.dir}: image proxy allowlist rejection missing`);
}

function verifyFeatureBundles(build) {
  const featuresDir = path.join(build.dir, "features");
  assert(existsSync(featuresDir), `${build.dir}: features directory missing`);
  const actual = readdirSync(featuresDir).filter((file) => file.endsWith(".js")).sort();
  const expected = featureBundlesForProfile(registry, build.profile);
  assertEqualList(actual, expected, `${build.dir}: feature bundle set mismatch`);
  if (build.profile !== "lite") {
    assert(actual.includes("wikiSidebar.js"), `${build.dir}: Wiki sidebar bundle missing from non-lite build`);
  }
}

function verifyAppAssets(build) {
  if (build.profile !== "full") return;
  for (const file of [
    "music/content.css",
    "miladychanSpotlight/content.css",
    "beetol/content.css",
    "reminetChat/content.css",
    "features/chromaprint.wasm",
    "worker.js",
    "ocrHost.js",
  ]) {
    assert(existsSync(path.join(build.dir, file)), `${build.dir}: missing app asset ${file}`);
  }
}

function assertEqualList(actual, expected, message) {
  const actualText = actual.join(", ");
  const expectedText = expected.join(", ");
  assert(actualText === expectedText, `${message}\n  expected: ${expectedText}\n  actual:   ${actualText}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
