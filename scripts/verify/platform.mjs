import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { contentScriptMatches, generatedAssetRoots, releaseBuilds, webAccessibleMatches } from "../release/release-builds.mjs";
import { appsForProfile, featureBundlesForProfile, hostPermissionsForProfile } from "../release/release-registry.mjs";

const registry = JSON.parse(await readFile("src/platform/app-sdk/first-party-apps.json", "utf8"));
const firstPartyAdapter = await readFile("src/platform/app-sdk/first-party-registry.ts", "utf8");
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
  const appPlatform = await readFile("src/platform/app-sdk/app-platform.ts", "utf8");
  assert(appPlatform.includes("export type MilxdyAppId = string;"), "MilxdyAppId must remain open for third-party apps");
  assert(appPlatform.includes("cost: AppCostProfile;"), "app manifests must declare cost metadata");
  assert(appPlatform.includes("loadTriggers: AppLoadTrigger[];"), "app manifests must declare load triggers");
}

async function verifyRuntimeOwnership() {
  const runtime = await readFile("src/platform/runtime/content-runtime.ts", "utf8");
  const contentLifecycle = await readFile("src/platform/runtime/content-app-lifecycle.ts", "utf8");
  const scanner = await readFile("src/platform/scanner/twitter-scanner.ts", "utf8");
  const buildScript = await readFile("scripts/build/build-extension.mjs", "utf8");
  const performanceMode = await readFile("src/platform/settings/performance-mode.ts", "utf8");
  const background = await readFile("src/extension/background/index.ts", "utf8");
  const backgroundRouter = await readFile("src/platform/background/router.ts", "utf8");
  const postReadingBackground = await readFile("src/apps/post-reading/background.ts", "utf8");
  const catalogBridge = await readFile("src/extension/catalog-bridge.ts", "utf8");
  const popup = await readFile("src/extension/popup/index.ts", "utf8");
  const popupHtml = await readFile("assets/extension/popup/popup.html", "utf8");
  const overlayDock = await readOverlayDockSources();
  const overlayAppLayout = await readFile("src/platform/overlay/app-layout.ts", "utf8");
  const overlayPanelBase = await readFile("src/platform/overlay/panel-base.ts", "utf8");
  const maxxerStyles = await readFile("src/apps/milady-maxxer/styles.ts", "utf8");
  const reskinStyles = await readFile("src/platform/visuals/reskin-styles.ts", "utf8");
  const wikiFrame = await readFile("src/apps/wiki-sidebar/frameContent.ts", "utf8");

  assert(runtime.includes("subscribeTwitterSurfaces(handleSurface)"), "runtime must own scanner subscription");
  assert(runtime.includes("patchHistory(notifyRoute)"), "runtime route service must patch history events");
  assert(!/setInterval\s*\(/.test(runtime), "content runtime must not use permanent polling intervals");
  assert(runtime.includes("lifecycle.deactivate()") && contentLifecycle.includes("collectHookError(errors, () => this.#module.disable?.())"), "disable path must delegate to the lifecycle owner and independently attempt app disable()");
  assert(runtime.includes("lifecycle.dispose()") && contentLifecycle.includes("collectHookError(errors, () => this.#module.dispose?.())"), "runtime shutdown must delegate to the lifecycle owner and independently attempt app dispose()");
  assert(runtime.includes("cancelNetworkQueueForApp(app.id)"), "disable path must cancel app network work");
  assert(runtime.includes("clearSurfaceDeliveryQueueForApp(app.id)"), "disable path must clear app surface delivery work");
  assert(runtime.includes("abortAppWork(app.id)"), "disable path must abort app work signal");
  assert(scanner.includes("configureTwitterScanner"), "scanner must remain configurable by the runtime budget");
  assert(buildScript.includes('readFile("src/platform/app-sdk/first-party-apps.json"'), "build must consume the shared app registry JSON");
  assert(buildScript.includes("const firstPartyApps = registryApps"), "profile builds must include every first-party app bundle");
  assert(buildScript.includes("contents: JSON.stringify(registryApps)"), "profile builds must keep full app metadata in the runtime registry");
  assert(!existsSync("scripts/app-registry.mjs"), "legacy duplicated app-registry.mjs must not return");
  assert(performanceMode.includes("idlePreloadDelayMs: null"), "Fast/Balanced budgets must be able to disable idle preloads");
  assert(/fast:\s*{[\s\S]*?safetyScanIntervalMs:\s*null/.test(performanceMode), "Fast mode must disable safety scans");
  assert(/balanced:\s*{[\s\S]*?safetyScanIntervalMs:\s*null/.test(performanceMode), "Balanced mode must disable safety scans");
  assert(background.includes("parseAllowedUrl"), "central background fetch services must use shared URL allowlist parsing");
  assert(backgroundRouter.includes("task: (signal: AbortSignal)") && backgroundRouter.includes("new AbortController()"), "background network queue must own an abort signal for active work");
  assert(backgroundRouter.includes("abort.abort(new DOMException") && backgroundRouter.includes('"TimeoutError"'), "background network deadlines must abort underlying fetch work");
  assert(background.includes("combineAbortSignals(init?.signal, signal)"), "central budgeted fetches must compose caller and queue cancellation");
  assert(background.includes("createBackgroundNetworkDeadlineSignal()"), "central budgeted fetches must retain a deadline while response bodies are read");
  assert(postReadingBackground.includes("AbortSignal.any([signal, createBackgroundNetworkDeadlineSignal()])"), "Post-reading response bodies must retain queue cancellation and a read deadline");
  assert(catalogBridge.includes('CATALOG_ORIGIN = "https://bonklek.github.io"') && catalogBridge.includes('CATALOG_PATH_PREFIX = "/milXdy/"'), "catalog bridge must stay pinned to the public milXdy Pages path");
  assert(catalogBridge.includes('message.target === "folder" || message.target === "rebuild"'), "catalog bridge must accept only folder and rebuild settings targets");
  assert(background.includes('parsed.origin !== "https://bonklek.github.io"') && background.includes('parsed.pathname.startsWith("/milXdy/")'), "background must independently validate catalog bridge senders");
  assert(popupHtml.includes('data-panel="addons"') && popupHtml.includes('id="addonsChooseFolder"') && popupHtml.includes('id="addonsRebuild"'), "popup must include the Add-ons tab, folder picker, and rebuild boundary");
  assert(popup.includes("scanAddonsFolder") && popup.includes('endsWith(".zip")') && popup.includes("showDirectoryPicker"), "Add-ons settings must scan only user-selected local ZIP files");
  assert(!reskinStyles.includes('html[data-milxdy-reskin-profile="max"] [role="button"],'), "Root Visuals must not override transition properties on every native X button");
  assert(reskinStyles.includes('data-milxdy-visual-hide-message-request-dot="true"') && reskinStyles.includes('a[href="/messages"] span[aria-hidden="true"]:empty'), "Messages request-dot suppression must stay opt-in and limited to empty dot-style badges");
  assert(!maxxerStyles.includes("transition: transform 0.3s ease, box-shadow 0.3s ease"), "Maxxer cards must not animate large multi-layer shadows during Like state changes");
  assert(wikiFrame.includes("revealWikiReadingRange(range.element)") && wikiFrame.includes("EXPANDABLE_WIKI_CONTAINER_SELECTOR"), "Wiki read-aloud must reveal supported collapsed/tabbed containers before highlighting");
  assert(wikiFrame.includes("container && wikiContainerIsHidden(container) && wikiContainerController(container)"), "Wiki read-aloud must skip hidden content that has no hidden expandable container and recoverable controller");
  assert(wikiFrame.includes("if (isWikiDisclosureControl(link)) return"), "Wiki frame navigation interception must leave tab and collapse controls to the Wiki runtime");
  assert(wikiFrame.includes("safeWikiControllerCandidate(candidate, id, hash)"), "Wiki read-aloud must reject external or non-control DOM nodes before synthetic activation");
  assert(wikiFrame.includes("safeWikiControllerElement(toggle)") && wikiFrame.includes("safeWikiControllerElement(label)") && wikiFrame.includes("safeWikiControllerElement(candidate)"), "Every Wiki synthetic-click controller path must enforce the same safe element boundary");
  assert(maxxerStyles.includes("animation: milady-catch-pulse 0.28s ease-out"), "Maxxer catch feedback must remain short and bounded");
  assert(background.includes("chrome.runtime.onInstalled.addListener") && background.includes('"milxdy.apps.firstRun.status": "pending"'), "central background must own fresh-install Apps Hub defaults");
  assert(firstPartyAdapter.includes("defaultEnabledById") && firstPartyAdapter.includes("defaultAppEnabled") && firstPartyAdapter.includes("enabledFromStoredValue"), "first-party enablement adapters must derive fallback defaults from registry defaultEnabled metadata");
  assert(runtime.includes("const desiredEnabledAppIds = new Set<MilxdyAppId>"), "App presets must compute an exact desired enabled set");
  assert(runtime.includes("const convergenceTasks = toggleableApps") && runtime.includes("await app.setEnabled?.(enabled)"), "App presets must explicitly enable and disable every toggleable app toward the selected preset");
  assert(runtime.includes('preset === "lite" ? "fast"') && runtime.includes('preset === "full" ? "full" : "balanced"'), "Lite/Balanced/Full presets must apply matching Performance modes");
  assert(runtime.includes("disabledTargetApps") && runtime.includes("disabledTargetCount"), "App preset diagnostics must report explicitly disabled preset targets");
  for (const freshInstallDefault of [
    '"milxdy.miladychan.enabled": true',
    '"milxdy.music.enabled": true',
    '"milxdy.reminetChat.enabled": false',
    '"milxdy.remistats.beetol.enabled": true',
    'mode: "milady"',
  ]) {
    assert(background.includes(freshInstallDefault), `central background must seed enabled first-run default: ${freshInstallDefault}`);
  }
  assert(existsSync("src/platform/browser/url-allowlist.ts"), "shared URL allowlist helper must exist");
  assert(overlayDock.includes("OverlayDockSettingsAction") && overlayDock.includes("setSettingsAction"), "overlay dock must expose reusable settings actions");
  assert(overlayDock.includes("settingsActionButton") && overlayDock.includes("snapshot.settingsActions"), "overlay dock settings panel must render registered settings actions");
  assert(overlayDock.includes("grid-template-columns: 22px minmax(0, 1fr) 28px 28px"), "overlay dock settings rows must keep icons, labels, and both move controls on one line");
  assert(runtime.includes('excludeActionIds: ["milxdy.addApps"]'), "Apps & Features rail settings must not render a redundant self-link");
  assert(runtime.includes('document.createElement("details")') && runtime.includes('title.textContent = "Change app preset"'), "Apps & Features presets must stay collapsed behind an explicit disclosure");
  assert(overlayAppLayout.includes('OVERLAY_APP_LAYOUTS_KEY = "milxdy.overlayApps.layouts.v1"'), "overlay app layouts must persist through the shared local layout store");
  assert(overlayAppLayout.includes("chrome.storage.local") && !overlayAppLayout.includes("chrome.storage.sync"), "overlay app pixel layouts must use chrome.storage.local only");
  assert(overlayAppLayout.includes("snapshotOverlayProtectedZones") && overlayAppLayout.includes("detectHostRailZones"), "overlay app layout manager must snapshot milXdy and host rail guide zones");
  assert(overlayAppLayout.includes("renderOverlayGuideLines") && overlayAppLayout.includes("snapRectToGuides"), "overlay app layout manager must own guide rendering and snap math");
  assert(overlayAppLayout.includes("snapshotOpenAppGuideZones") && overlayAppLayout.includes('kind: "app"'), "overlay app layout manager must snapshot other open app edges as soft snap guides");
  assert(overlayPanelBase.includes("snapshotOverlayProtectedZones(side, options.appId)"), "freeform drag/resize must exclude the active app from app-to-app guide snapshots");
  assert(overlayPanelBase.includes("appId?: string") && overlayPanelBase.includes("startFreeformDrag") && overlayPanelBase.includes("saveOverlayAppLayout"), "overlay panel helper must route dock apps through shared freeform drag persistence");
  assert(overlayPanelBase.includes("isInteractiveOverlayDragTarget") && overlayPanelBase.includes("allowInteractiveDragTarget"), "overlay drag helper must guard interactive header controls by default");
  assert(/const finalRect = clampOverlayRectToSafeArea\(snapped\.rect,[\s\S]*?applyFreeformRect\(finalRect, options\)/.test(overlayPanelBase), "freeform resize must re-clamp snapped geometry before applying it");
  const beetolContent = await readFile("src/apps/beetol/content.js", "utf8");
  assert(beetolContent.includes("allowInteractiveDragTarget: true"), "Beetol must explicitly declare its tab drag-handle exception");
  assert(beetolContent.includes("FINAL_HUNT_COOLDOWN_MS = BEETLE_HUNT_COOLDOWN_MS") && beetolContent.includes("scheduleFinalHuntDone()"), "Beetol final hunts must preserve the result before the authoritative 90-minute cooldown state");
  assert(beetolContent.includes("messageRevision !== expectedMessageRevision"), "Beetol final-hunt Done transition must not overwrite a newer operation status");
  assert(runtime.includes('setSettingsAction("milxdy.addApps"') && runtime.includes("onActivate: openHubPanel"), "content runtime must link dock settings to the Apps Hub through the dock settings action API");
  assert(runtime.includes('setSettingsAction("milxdy.addApps", null)'), "content runtime must unregister the Apps Hub dock settings action on dispose");
  assert(runtime.includes('setSettingsAction("milxdy.resetAppPositions"') && runtime.includes("resetOverlayAppLayouts"), "content runtime must expose a dock settings action to reset overlay app positions");
  assert(runtime.includes('setSettingsAction("milxdy.resetAppPositions", null)'), "content runtime must unregister the reset app positions action on dispose");
  assert(firstPartyAdapter.includes("available: app.available !== false") && firstPartyAdapter.includes("isEnabled,") && firstPartyAdapter.includes("setEnabled,"), "first-party enablement adapters must expose every app while preserving package availability");
  assert(runtime.includes("loadedHeavyApps") && runtime.includes("loadedWorkerHeavyApps") && runtime.includes("loadedNetworkApps") && runtime.includes("loadedAppsByCost"), "runtime diagnostics must identify loaded heavy, worker-heavy, and network apps from registry cost metadata");
  assert(scanner.includes("activeObserverCount"), "scanner diagnostics must expose active shared observer count");
  assert(runtime.includes("maxQueueDepth") && runtime.includes("maxDrainMs") && runtime.includes("performanceObserverCount"), "runtime diagnostics must expose surface delivery depth/timing and performance observer count");
  const rootVisuals = await readFile("src/apps/root-visuals/content.ts", "utf8");
  const benchmark = await readFile("src/platform/diagnostics/max-profile-benchmark.ts", "utf8");
  assert(!rootVisuals.includes("characterData: true"), "Root Visuals must not install a full-page character-data mutation observer");
  const showNewPostsSetup = rootVisuals.slice(rootVisuals.indexOf("function setupShowNewPostsMarkers"), rootVisuals.indexOf("function markShowNewPostsButton"));
  const showNewPostsInterval = Number(rootVisuals.match(/SHOW_NEW_POST_SCAN_INTERVAL_MS\s*=\s*(\d+)/)?.[1] || 0);
  const showNewPostsLimit = Number(rootVisuals.match(/SHOW_NEW_POST_SCAN_LIMIT\s*=\s*(\d+)/)?.[1] || 0);
  assert(showNewPostsSetup.length > 0 && !/MutationObserver|requestAnimationFrame/.test(showNewPostsSetup), "Show-new-post decoration must not subscribe work to X's hot timeline mutations or animation frames");
  assert(showNewPostsInterval >= 3000 && /visibilityState\s*!==\s*["']visible["']/.test(showNewPostsSetup), "Show-new-post decoration must use a low-frequency, visible-page-only scan");
  assert(showNewPostsLimit > 0 && showNewPostsLimit <= 150 && /!visualTheme\.newPostsPill/.test(showNewPostsSetup) && /scanned\s*>=\s*SHOW_NEW_POST_SCAN_LIMIT/.test(showNewPostsSetup), "Show-new-post decoration must skip disabled styling and cap each scan");
  assert(!rootVisuals.includes('recordFeatureTiming("rootVisuals", "orphanReply"') && !benchmark.includes('"rootVisuals.orphanReply"'), "Root Visual orphan-reply work must not keep diagnostics timers hot during ordinary browsing");
  assert(rootVisuals.includes("NATIVE_REPLY_CONNECTOR_SELECTOR") && rootVisuals.includes("setOrphanReplyState(tweet, false)"), "Root Visual orphan-reply marker must skip connector scans for non-reply tweets");
  assert(!overlayDock.includes("new ResizeObserver(() => updateRailScrollIndicators"), "rail ResizeObserver work must use the coalesced scheduler");
  assert(overlayDock.includes("#scheduleRailIndicators") && overlayDock.includes("if (this.#railIndicatorFrame) return"), "rail indicator geometry reads must be coalesced to one animation frame");
  assert(!/html\s*:\s*has\s*\(/.test(overlayDock), "dock layout must not attach a relational :has selector to the document root");
  assert(/#milxdy-overlay-dock-root\[data-side=["']left["']\][^{]*\{[^}]*--milxdy-dock-top:\s*72px;[^}]*--milxdy-dock-bottom-clearance:\s*80px;/s.test(overlayDock), "left dock must statically clear X's top-left dialog controls without DOM-dependent selector invalidation");
  assert(overlayDock.includes("placeTerminalItemLast") && overlayDock.includes("milxdyAddOnsCatalog"), "Add-ons catalog must remain the terminal dock item");
  assert(overlayDock.includes("isHostMediaViewerOpen") && overlayDock.includes('data-host-media-viewer-open="true"'), "dock must hide while the host media viewer is open");
  const remistats = await readFile("src/apps/remistats/content.js", "utf8");
  const remistatsStyles = await readFile("src/apps/remistats/remistats.css", "utf8");
  assert(!remistats.includes("for (const [cachedKey, cached] of scoreCache)"), "RemiStats score insertion must not sweep the entire cache for every result");
  assert(remistats.includes("if (!clean || !isConfirmedPokeIdentity(clean)) return null"), "RemiStats must not render poke controls before confirming a RemiliaNET identity");
  assert(remistats.includes("confirmedPokeIdentities.size > SCORE_CACHE_LIMIT"), "RemiStats confirmed poke identity caching must remain bounded");
  assert(remistats.includes("fillProfilePokeSlot(slot, '')"), "RemiStats profile poke slots must remain empty while an X handle is only provisional");
  assert(remistats.includes("remiliaUsername: explicitRemiliaUsername || null"), "RemiStats must preserve explicit missing RemiliaNET identity instead of replacing it with an X handle");
  assert(remistatsStyles.includes(".reminet-profile-action-poke-slot:empty"), "RemiStats must not reserve visible profile action-row space for an unconfirmed poke target");
  assert(remistats.includes("const confirmedUsername = cleanUsername(existingSlot.querySelector('[data-reminet-badge]')?.dataset.reminetUsername)"), "RemiStats reused profile slots must derive poke eligibility from the confirmed badge, not the X handle");

  const contentRoot = await readFile("src/extension/content/index.ts", "utf8");
  assert(contentRoot.includes("createContentRuntime(FIRST_PARTY_APPS)"), "root content script must bootstrap the shared runtime");
  assert(!contentRoot.includes("import("), "root content script must not directly import feature bundles");

  for (const file of featureContentFiles("src/apps")) {
    const source = await readFile(file, "utf8");
    assert(!source.includes("subscribeTwitterSurfaces"), `${file}: feature bundle must not subscribe directly to scanner`);
    assert(!/\bvoid\s+boot\s*\(/.test(source), `${file}: feature content bundle must not self-boot`);
  }

  for (const file of featureBackgroundFiles("src/apps")) {
    const source = await readFile(file, "utf8");
    assert(!source.includes("chrome.runtime.onMessage.addListener"), `${file}: feature background must not install a separate onMessage listener`);
  }
  const remistatsBackground = await readFile("src/apps/remistats/background.js", "utf8");
  assert(!remistatsBackground.includes("chrome.runtime.onInstalled.addListener"), "RemiStats install defaults must stay centralized in src/extension/background/index.ts");
}

async function readOverlayDockSources() {
  const files = ["dock.ts", "dock-controller.ts", "dock-order-policy.ts", "dock-settings-view.ts", "dock.css", "dock-types.ts", "dock-view.ts"];
  return (await Promise.all(files.map((file) => readFile(`src/platform/overlay/${file}`, "utf8")))).join("\n");
}

function verifyRegistryShape() {
  assert(Array.isArray(registry) && registry.length > 0, "first-party registry must contain apps");
  const ids = new Set();
  for (const app of registry) {
    assert(typeof app.id === "string" && app.id.length > 0, "registry app id must be a non-empty string");
    assert(/^[a-z][A-Za-z0-9-]*$/.test(app.id), `${app.id}: app id must be extension-safe`);
    assert(!ids.has(app.id), `duplicate registry app id ${app.id}`);
    ids.add(app.id);
    assert(app.contentEntry, `${app.id}: missing package content entry metadata`);
    if (app.entryPoint) {
      assert(app.entryName, `${app.id}: source-backed package must declare entryName`);
      assert(app.contentEntry === `${app.entryName}.js`, `${app.id}: contentEntry must match entryName`);
      assert(existsSync(app.entryPoint), `${app.id}: entryPoint does not exist: ${app.entryPoint}`);
    } else {
      assert(app.available === false, `${app.id}: available first-party package must declare an entryPoint`);
    }
    const hasGenericEnablement = (app.settings || []).some((setting) => setting.role === "enablement" && setting.storage?.key);
    assert(hasGenericEnablement || firstPartyAdapter.includes(`${app.id}: async`) || firstPartyAdapter.includes(`"${app.id}": async`), `${app.id}: missing isEnabled adapter`);
    if (app.id !== "rootVisuals") {
      assert(hasGenericEnablement || firstPartyAdapter.includes(`${app.id}: async (enabled)`) || firstPartyAdapter.includes(`"${app.id}": async (enabled)`), `${app.id}: missing setEnabled adapter`);
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
      if (app.dock.icon) {
        for (const iconPath of dockIconPaths(app.dock.icon)) {
          assert(/^data:image\//.test(iconPath) || existsSync(sourceAssetPath(iconPath)), `${app.id}: dock icon does not exist: ${iconPath}`);
        }
      }
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

function dockIconPaths(icon) {
  if (typeof icon === "string") return [icon];
  if (!icon || typeof icon !== "object") return [];
  return [icon.light, icon.dark].filter((value) => typeof value === "string" && value.trim());
}

function assetRootIsAccountedFor(app, assetDir) {
  if (existsSync(assetSourceDir(assetDir))) return true;
  if (GENERATED_ASSET_ROOTS.has(assetDir)) return true;
  return (app.css || []).some((sheet) => sheet.targetDir === assetDir);
}

function assetSourceDir(outputDir) {
  const sourceByOutputDir = {
    brand: "assets/brand",
    icons: "assets/extension/icons",
    "remilia-fonts": "assets/shared/fonts",
    beetol: "assets/apps/beetol",
    miladymaxxer: "assets/apps/milady-maxxer",
    miladychanSpotlight: "assets/apps/miladychan-portal",
    music: "assets/apps/music",
    "post-reading": "assets/apps/post-reading",
    remistats: "assets/apps/remistats",
    wikiSidebar: "assets/apps/wiki-sidebar",
    models: "assets/models",
  };
  return sourceByOutputDir[outputDir] || outputDir;
}

function sourceAssetPath(outputPath) {
  const normalized = outputPath.replaceAll("\\", "/");
  const [root, ...rest] = normalized.split("/");
  return path.join(assetSourceDir(root), ...rest);
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
      for (const resource of block.resources || []) {
        assert(!String(resource).startsWith("wiki-helper/"), `${build.dir}: wiki helper artifacts must not be web-accessible`);
        assert(!String(resource).startsWith("remilia-pet/"), `${build.dir}: Remilia pet skill artifacts must not be web-accessible`);
      }
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
