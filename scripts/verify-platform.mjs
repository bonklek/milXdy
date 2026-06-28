import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { contentScriptMatches, generatedAssetRoots, releaseBuilds, webAccessibleMatches } from "./release-builds.mjs";
import { appsForProfile, featureBundlesForProfile, hostPermissionsForProfile } from "./release-registry.mjs";

const registry = JSON.parse(await readFile("src/shared/firstPartyApps.json", "utf8"));
const firstPartyAdapter = await readFile("src/shared/firstPartyApps.ts", "utf8");
const VALID_PRESETS = new Set(["lite", "balanced", "full"]);
const VALID_LOAD_TRIGGERS = new Set(["startup", "surface", "dockOpen", "idle", "userAction"]);
const VALID_STARTUP_COSTS = new Set(["cheap", "moderate", "heavy"]);
const VALID_PER_SURFACE_COSTS = new Set(["cheap", "moderate", "heavy"]);
const VALID_NETWORK_COSTS = new Set(["none", "batched", "eager"]);
const VALID_WORKER_COSTS = new Set(["none", "optional", "heavy"]);
const VALID_DOM_WRITE_COSTS = new Set(["none", "small", "moderate", "large"]);
const VALID_DOCK_SIDES = new Set(["left", "right"]);
const GENERATED_ASSET_ROOTS = new Set(generatedAssetRoots);

await verifySdkShape();
await verifyRuntimeOwnership();
await verifyRegistryShape();
await verifyBuildOutputs();

console.log("Platform verification passed.");

async function verifySdkShape() {
  const appPlatform = await readFile("src/shared/appPlatform.ts", "utf8");
  assert(appPlatform.includes("export type MilxdyAppId = string;"), "MilxdyAppId must remain open for third-party apps");
  assert(appPlatform.includes("cost: AppCostProfile;"), "app manifests must declare cost metadata");
  assert(appPlatform.includes("loadTriggers: AppLoadTrigger[];"), "app manifests must declare load triggers");
}

async function verifyRuntimeOwnership() {
  const runtime = await readFile("src/shared/contentRuntime.ts", "utf8");
  const scanner = await readFile("src/shared/twitterScanner.ts", "utf8");
  const buildScript = await readFile("scripts/build.mjs", "utf8");
  const performanceMode = await readFile("src/shared/performanceMode.ts", "utf8");
  const background = await readFile("src/background.ts", "utf8");
  const overlayDock = await readFile("src/shared/overlayDock.ts", "utf8");
  const overlayAppLayout = await readFile("src/shared/overlayAppLayout.ts", "utf8");
  const overlayPanelBase = await readFile("src/shared/overlayPanelBase.ts", "utf8");

  assert(runtime.includes("subscribeTwitterSurfaces(handleSurface)"), "runtime must own scanner subscription");
  assert(runtime.includes("patchHistory(notifyRoute)"), "runtime route service must patch history events");
  assert(!/setInterval\s*\(/.test(runtime), "content runtime must not use permanent polling intervals");
  assert(runtime.includes("module.disable?.()"), "disable path must call app disable()");
  assert(runtime.includes("module.dispose?.()"), "disable path must call app dispose()");
  assert(runtime.includes("cancelNetworkQueueForApp(app.id)"), "disable path must cancel app network work");
  assert(runtime.includes("clearSurfaceDeliveryQueueForApp(app.id)"), "disable path must clear app surface delivery work");
  assert(runtime.includes("abortAppWork(app.id)"), "disable path must abort app work signal");
  assert(scanner.includes("configureTwitterScanner"), "scanner must remain configurable by the runtime budget");
  assert(buildScript.includes('readFile("src/shared/firstPartyApps.json"'), "build must consume the shared app registry JSON");
  assert(buildScript.includes("contents: JSON.stringify(registryApps)"), "profile builds must keep full app metadata in the runtime registry for unavailable app cards");
  assert(!existsSync("scripts/app-registry.mjs"), "legacy duplicated app-registry.mjs must not return");
  assert(performanceMode.includes("idlePreloadDelayMs: null"), "Fast/Balanced budgets must be able to disable idle preloads");
  assert(/fast:\s*{[\s\S]*?safetyScanIntervalMs:\s*null/.test(performanceMode), "Fast mode must disable safety scans");
  assert(/balanced:\s*{[\s\S]*?safetyScanIntervalMs:\s*null/.test(performanceMode), "Balanced mode must disable safety scans");
  assert(background.includes("parseAllowedUrl"), "central background fetch services must use shared URL allowlist parsing");
  assert(background.includes("chrome.runtime.onInstalled.addListener") && background.includes('"milxdy.apps.firstRun.status": "pending"'), "central background must own fresh-install Apps Hub defaults");
  assert(firstPartyAdapter.includes("defaultEnabledById") && firstPartyAdapter.includes("defaultAppEnabled") && firstPartyAdapter.includes("enabledFromStoredValue"), "first-party enablement adapters must derive fallback defaults from registry defaultEnabled metadata");
  for (const freshInstallDefault of [
    '"milxdy.miladychan.enabled": false',
    '"milxdy.music.enabled": false',
    '"milxdy.reminetChat.enabled": false',
    '"milxdy.remistats.beetol.enabled": false',
    'mode: "off"',
  ]) {
    assert(background.includes(freshInstallDefault), `central background must seed conservative first-run default: ${freshInstallDefault}`);
  }
  assert(existsSync("src/shared/urlAllowlist.ts"), "shared URL allowlist helper must exist");
  assert(overlayDock.includes("OverlayDockSettingsAction") && overlayDock.includes("setSettingsAction"), "overlay dock must expose reusable settings actions");
  assert(overlayDock.includes("settingsActionButton") && overlayDock.includes("state.settingsActions"), "overlay dock settings panel must render registered settings actions");
  assert(overlayAppLayout.includes('OVERLAY_APP_LAYOUTS_KEY = "milxdy.overlayApps.layouts.v1"'), "overlay app layouts must persist through the shared local layout store");
  assert(overlayAppLayout.includes("chrome.storage.local") && !overlayAppLayout.includes("chrome.storage.sync"), "overlay app pixel layouts must use chrome.storage.local only");
  assert(overlayAppLayout.includes("snapshotOverlayProtectedZones") && overlayAppLayout.includes("detectHostRailZones"), "overlay app layout manager must snapshot milXdy and host rail guide zones");
  assert(overlayAppLayout.includes("renderOverlayGuideLines") && overlayAppLayout.includes("snapRectToGuides"), "overlay app layout manager must own guide rendering and snap math");
  assert(overlayAppLayout.includes("snapshotOpenAppGuideZones") && overlayAppLayout.includes('kind: "app"'), "overlay app layout manager must snapshot other open app edges as soft snap guides");
  assert(overlayPanelBase.includes("snapshotOverlayProtectedZones(side, options.appId)"), "freeform drag/resize must exclude the active app from app-to-app guide snapshots");
  assert(overlayPanelBase.includes("appId?: string") && overlayPanelBase.includes("startFreeformDrag") && overlayPanelBase.includes("saveOverlayAppLayout"), "overlay panel helper must route dock apps through shared freeform drag persistence");
  assert(runtime.includes('setSettingsAction("milxdy.addApps"') && runtime.includes("onActivate: openHubPanel"), "content runtime must link dock settings to the Apps Hub through the dock settings action API");
  assert(runtime.includes('setSettingsAction("milxdy.addApps", null)'), "content runtime must unregister the Apps Hub dock settings action on dispose");
  assert(runtime.includes('setSettingsAction("milxdy.resetAppPositions"') && runtime.includes("resetOverlayAppLayouts"), "content runtime must expose a dock settings action to reset overlay app positions");
  assert(runtime.includes('setSettingsAction("milxdy.resetAppPositions", null)'), "content runtime must unregister the reset app positions action on dispose");
  assert(runtime.includes("app.available === false") && runtime.includes("unavailableReason") && runtime.includes("milxdy-app-hub-unavailable"), "content runtime must expose unavailable app state in the Apps Hub without importing excluded bundles");
  assert(runtime.includes("loadedHeavyApps") && runtime.includes("loadedWorkerHeavyApps") && runtime.includes("loadedNetworkApps") && runtime.includes("loadedAppsByCost"), "runtime diagnostics must identify loaded heavy, worker-heavy, and network apps from registry cost metadata");

  const contentRoot = await readFile("src/content.ts", "utf8");
  assert(contentRoot.includes("createContentRuntime(FIRST_PARTY_APPS)"), "root content script must bootstrap the shared runtime");
  assert(!contentRoot.includes("import("), "root content script must not directly import feature bundles");

  for (const file of featureContentFiles("src/features")) {
    const source = await readFile(file, "utf8");
    assert(!source.includes("subscribeTwitterSurfaces"), `${file}: feature bundle must not subscribe directly to scanner`);
    assert(!/\bvoid\s+boot\s*\(/.test(source), `${file}: feature content bundle must not self-boot`);
  }

  for (const file of featureBackgroundFiles("src/features")) {
    const source = await readFile(file, "utf8");
    assert(!source.includes("chrome.runtime.onMessage.addListener"), `${file}: feature background must not install a separate onMessage listener`);
  }
  const remistatsBackground = await readFile("src/features/remistats/background.js", "utf8");
  assert(!remistatsBackground.includes("chrome.runtime.onInstalled.addListener"), "RemiStats install defaults must stay centralized in src/background.ts");
}

function verifyRegistryShape() {
  assert(Array.isArray(registry) && registry.length > 0, "first-party registry must contain apps");
  const ids = new Set();
  for (const app of registry) {
    assert(typeof app.id === "string" && app.id.length > 0, "registry app id must be a non-empty string");
    assert(/^[a-z][A-Za-z0-9-]*$/.test(app.id), `${app.id}: app id must be extension-safe`);
    assert(!ids.has(app.id), `duplicate registry app id ${app.id}`);
    ids.add(app.id);
    assert(app.entryName && app.entryPoint && app.contentEntry, `${app.id}: missing package entry metadata`);
    assert(app.contentEntry === `${app.entryName}.js`, `${app.id}: contentEntry must match entryName`);
    assert(existsSync(app.entryPoint), `${app.id}: entryPoint does not exist: ${app.entryPoint}`);
    assert(firstPartyAdapter.includes(`${app.id}: async`) || firstPartyAdapter.includes(`"${app.id}": async`), `${app.id}: missing isEnabled adapter`);
    if (app.id !== "rootVisuals" && app.id !== "tweetPng") {
      assert(firstPartyAdapter.includes(`${app.id}: async (enabled)`) || firstPartyAdapter.includes(`"${app.id}": async (enabled)`), `${app.id}: missing setEnabled adapter`);
    }
    assert(typeof app.name === "string" && app.name.trim(), `${app.id}: missing app name`);
    assert(typeof app.version === "string" && app.version.trim(), `${app.id}: missing app version`);
    assert(typeof app.description === "string" && app.description.trim(), `${app.id}: missing app description`);
    assert(app.cost?.startup && app.cost?.perSurface && app.cost?.network && app.cost?.worker && app.cost?.domWrite, `${app.id}: missing cost metadata`);
    assert(VALID_STARTUP_COSTS.has(app.cost.startup), `${app.id}: invalid startup cost ${app.cost.startup}`);
    assert(VALID_PER_SURFACE_COSTS.has(app.cost.perSurface), `${app.id}: invalid perSurface cost ${app.cost.perSurface}`);
    assert(VALID_NETWORK_COSTS.has(app.cost.network), `${app.id}: invalid network cost ${app.cost.network}`);
    assert(VALID_WORKER_COSTS.has(app.cost.worker), `${app.id}: invalid worker cost ${app.cost.worker}`);
    assert(VALID_DOM_WRITE_COSTS.has(app.cost.domWrite), `${app.id}: invalid domWrite cost ${app.cost.domWrite}`);
    assert(Array.isArray(app.loadTriggers) && app.loadTriggers.length > 0, `${app.id}: missing load triggers`);
    for (const trigger of app.loadTriggers) {
      assert(VALID_LOAD_TRIGGERS.has(trigger), `${app.id}: invalid load trigger ${trigger}`);
    }
    assert(Array.isArray(app.surfaces), `${app.id}: surfaces must be an array`);
    assert(app.hub?.presets?.length > 0, `${app.id}: missing Hub preset metadata`);
    assert(typeof app.hub.category === "string" && app.hub.category.trim(), `${app.id}: missing Hub category`);
    assert(typeof app.hub.shortDescription === "string" && app.hub.shortDescription.trim(), `${app.id}: missing Hub short description`);
    assert(typeof app.hub.rail?.supported === "boolean", `${app.id}: missing Hub rail support flag`);
    assert(typeof app.hub.rail?.defaultPinned === "boolean", `${app.id}: missing Hub rail defaultPinned flag`);
    for (const preset of app.hub.presets) {
      assert(VALID_PRESETS.has(preset), `${app.id}: invalid Hub preset ${preset}`);
    }
    if (app.cost.startup === "heavy" || app.cost.worker === "heavy") {
      assert(!app.loadTriggers.includes("startup"), `${app.id}: heavy app must not load at startup`);
    }
    if (app.dock?.label) {
      assert(app.loadTriggers.includes("dockOpen"), `${app.id}: dock app must lazy-load on dock open`);
      assert(app.hub.rail.supported === true, `${app.id}: dock app must be rail-supported unless it has no dock metadata`);
      if (app.dock.defaultSide) assert(VALID_DOCK_SIDES.has(app.dock.defaultSide), `${app.id}: invalid dock defaultSide ${app.dock.defaultSide}`);
      if (app.dock.icon) assert(/^data:image\//.test(app.dock.icon) || existsSync(path.join("public", app.dock.icon)), `${app.id}: dock icon does not exist: ${app.dock.icon}`);
    } else {
      assert(app.hub.rail.defaultPinned === false, `${app.id}: non-dock app cannot be pinned by default`);
    }
    for (const assetDir of app.assets || []) {
      assert(assetRootIsAccountedFor(app, assetDir), `${app.id}: asset directory is not backed by public assets, CSS output, or generated build output: ${assetDir}`);
    }
    for (const sheet of app.css || []) {
      assert(sheet.id && sheet.path && sheet.source && sheet.targetDir && sheet.target, `${app.id}: CSS metadata must include id/path/source/targetDir/target`);
      assert(existsSync(sheet.source), `${app.id}: CSS source does not exist: ${sheet.source}`);
      assert(sheet.path === `${sheet.targetDir}/${sheet.target}`, `${app.id}: CSS path must match targetDir/target`);
    }
    for (const output of app.requiredOutputs || []) {
      assert(typeof output === "string" && output.trim(), `${app.id}: required output must be a non-empty path`);
    }
    for (const host of app.permissions?.hosts || []) {
      assert(/^https?:\/\/[^*]+\/\*$/.test(host), `${app.id}: host permission must be an origin wildcard: ${host}`);
    }
    if ((app.hub.remoteServices || []).length > 0 || (app.permissions?.hosts || []).length > 0) {
      assert(app.hub.privacyLabels?.includes("remote-api") || app.hub.privacyLabels?.includes("browser-session"), `${app.id}: remote apps must disclose a remote privacy label`);
    }
  }
}

function assetRootIsAccountedFor(app, assetDir) {
  if (existsSync(path.join("public", assetDir))) return true;
  if (GENERATED_ASSET_ROOTS.has(assetDir)) return true;
  return (app.css || []).some((sheet) => sheet.targetDir === assetDir);
}

async function verifyBuildOutputs() {
  for (const build of releaseBuilds) {
    assert(existsSync(build.dir), `${build.dir}: build output missing`);
    const manifest = JSON.parse(await readFile(path.join(build.dir, "manifest.json"), "utf8"));
    const popup = await readFile(path.join(build.dir, "popup.js"), "utf8");
    const expectedApps = appsForProfile(registry, build.profile);
    const expectedFeatures = featureBundlesForProfile(registry, build.profile);
    const actualFeatures = readdirSync(path.join(build.dir, "features"))
      .filter((name) => name.endsWith(".js"))
      .sort();
    assertEqualList(actualFeatures, expectedFeatures, `${build.dir}: feature bundle set must match registry profile`);
    assert(popup.includes(`normalizeBuildProfile("${build.profile}")`), `${build.dir}: popup build profile constant mismatch`);

    const hosts = new Set(manifest.host_permissions || []);
    const contentScript = (manifest.content_scripts || []).find((script) => script.js?.includes("content.js"));
    assert(contentScript, `${build.dir}: content script missing`);
    assertEqualList([...(contentScript.matches || [])].sort(), [...contentScriptMatches].sort(), `${build.dir}: content script matches mismatch`);
    for (const block of manifest.web_accessible_resources || []) {
      assertEqualList([...(block.matches || [])].sort(), [...webAccessibleMatches].sort(), `${build.dir}: web accessible resource matches mismatch`);
    }
    const expectedHosts = new Set(hostPermissionsForProfile(registry, build.profile));
    for (const app of expectedApps) {
      for (const host of app.permissions?.hosts || []) {
        assert(hosts.has(host), `${build.dir}: missing host permission ${host} for ${app.id}`);
      }
    }
    for (const app of registry) {
      if (expectedApps.includes(app)) continue;
      for (const host of app.permissions?.hosts || []) {
        assert(!hosts.has(host) || expectedHosts.has(host), `${build.dir}: excluded app host permission leaked: ${app.id} ${host}`);
      }
    }
  }
}

function featureContentFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const candidate of ["content.ts", "content.js"]) {
      const file = path.join(root, entry.name, candidate);
      if (existsSync(file)) files.push(file);
    }
  }
  return files;
}

function featureBackgroundFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    for (const candidate of ["background.ts", "background.js"]) {
      const file = path.join(root, entry.name, candidate);
      if (existsSync(file)) files.push(file);
    }
  }
  return files;
}

function assertEqualList(actual, expected, message) {
  const actualText = actual.join(", ");
  const expectedText = expected.join(", ");
  assert(actualText === expectedText, `${message}\n  expected: ${expectedText}\n  actual:   ${actualText}`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
