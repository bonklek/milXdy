import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { verifyAppMessageAuthorizationWiring } from "./app-message-authorization-wiring.mjs";

const registryPath = "src/platform/app-sdk/first-party-apps.json";
const registry = JSON.parse(await readFile(registryPath, "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const appPlatform = await readFile("src/platform/app-sdk/app-platform.ts", "utf8");
const contentRuntime = await readFile("src/platform/runtime/content-runtime.ts", "utf8");
const backgroundMessagePolicy = await readFile("src/platform/runtime/background-message-policy.ts", "utf8");
const contentRoot = await readFile("src/extension/content/index.ts", "utf8");
const background = await readFile("src/extension/background/index.ts", "utf8");
const composerSource = await readFile("scripts/packages/compose-local-app-packages.mjs", "utf8");
const postReadingDefaults = await readFile("src/apps/post-reading/shared/defaults.ts", "utf8");
const postReadingContent = await readFile("src/apps/post-reading/content.ts", "utf8");
const postReadingBackground = await readFile("src/apps/post-reading/background.ts", "utf8");
const postReadingFullQuote = await readFile("src/apps/post-reading/fullQuote.ts", "utf8");
const postReadingTtsEngines = await readFile("src/apps/post-reading/ttsEngines.ts", "utf8");
const reminetChatBackground = await readFile("src/apps/reminet-chat/background.ts", "utf8");
const beetolBackground = await readFile("src/apps/beetol/background.js", "utf8");
const appSdkDocs = await readFile("docs/sdk/APP_SDK.md", "utf8");
const privacyDocs = await readFile("docs/getting-started/PRIVACY_AND_PERMISSIONS.md", "utf8");
const routedBackgroundTypes = await collectRoutedBackgroundTypes();

const failures = [];
const warnings = [];

const validPackageKinds = new Set(["app", "feature", "theme"]);
const validSurfaces = new Set(["tweet", "xArticle", "userCell", "notification", "directMessage", "profile", "route", "overlayApp", "composerAction", "replyAction"]);
const validLifecycleModes = new Set(["runtime", "invoked"]);
const validInvocationTriggers = new Set(["userAction"]);
const validSites = new Set(["x", "remiliaNet", "remiliaWiki", "miladychan"]);
const validSiteIntegrations = new Set(["contentScript", "backgroundService", "embeddedFrame", "overlayApp"]);
const validRouteMatchTypes = new Set(["exact", "prefix"]);
const validSitePresentations = new Set(["sideRailOverlay", "hostRouteOverlay", "userAction"]);
const validSettingLocations = new Set(["appearance", "appsAndFeatures", "appSurface", "advanced"]);
const validSettingScopes = new Set(["global", "app", "feature"]);
const validSettingRoles = new Set(["preference", "enablement", "open", "reset"]);
const appsAndFeaturesAppRoles = new Set(["enablement", "open", "reset"]);
const validSettingAreas = new Set(["local", "sync"]);
const validResetBehaviors = new Set(["removeKey", "restoreDefault", "restoreAppDefault", "custom"]);
const validControlTypes = new Set(["toggle", "select", "segmented", "slider", "number", "text", "textarea", "action", "status"]);
const validDynamicOptionProviders = new Set(["webSpeechVoices"]);
const validDynamicOptionPortability = new Set(["browserProfile", "machineLocal"]);
const requiredManifestFields = ["id", "name", "version", "description", "contentEntry", "defaultEnabled", "storageKeys", "surfaces", "cost", "loadTriggers", "hub"];

verifyPlatformContract();
verifySdkVersionSource();
verifyLocalPackageShapeContract();
verifyRootAndRuntimeOwnership();
verifyAppMessageAuthorizationWiring();
verifyRegistry();
await verifyContentModules();
await verifyBackgroundMetadata();
verifyInternalBridgeValidation();
await verifyFeatureOwnership();

printResults();
if (failures.length > 0) process.exit(1);

function verifyPlatformContract() {
  requireIncludes(appPlatform, "boot?:", "App SDK module type must expose boot lifecycle hook");
  requireIncludes(appPlatform, "enable?:", "App SDK module type must expose enable lifecycle hook");
  requireIncludes(appPlatform, "disable?:", "App SDK module type must expose disable lifecycle hook");
  requireIncludes(appPlatform, "onRouteChange?:", "App SDK module type must expose onRouteChange lifecycle hook");
  requireIncludes(appPlatform, "onSurface?:", "App SDK module type must expose onSurface lifecycle hook");
  requireIncludes(appPlatform, "dispose?:", "App SDK module type must expose dispose lifecycle hook");
  requireIncludes(appPlatform, "scheduler: AppRuntimeScheduler", "App SDK context must expose the shared scheduler");
  requireIncludes(appPlatform, "sendMessage:", "App SDK context must expose routed background messaging");
  requireIncludes(appPlatform, "AppLifecycleMode", "App manifest type must expose lifecycle metadata");
  requireIncludes(appPlatform, "composerAction?: AppComposerAction", "App SDK must expose the composer-action manifest contract");
  requireIncludes(appPlatform, "onComposerAction?:", "App SDK module type must expose the composer-action callback");
  requireIncludes(appPlatform, "openNativeDrafts: () => void", "Composer actions must expose only the host-mediated native Drafts handoff");
  requireIncludes(appPlatform, "externalHandoffs?: AppExternalHandoff[]", "App SDK must expose declared external handoffs");
  requireIncludes(appPlatform, "launchExternalHandoff:", "Composer actions must expose the host-mediated external handoff callback");
  requireIncludes(appPlatform, "remoteQueries?: AppRemoteQuery[]", "App SDK must expose declared reviewed remote queries");
  requireIncludes(appPlatform, "queryRemoteService:", "Composer actions must expose only the host-mediated remote query callback");
  requireIncludes(appPlatform, 'captionSource?: "composerDraft" | "packageFields"', "External handoffs must declare the reviewed caption source");
  requireIncludes(appPlatform, "captions?: { topText: string; bottomText: string }", "Composer actions must support bounded explicit caption fields");
  requireIncludes(appPlatform, "replyAction?: AppReplyAction", "App SDK must expose the reply-action manifest contract");
  requireIncludes(appPlatform, "sendAfterInsert?: boolean", "App SDK must make reply auto-submit an explicit per-template opt-in");
  requireIncludes(appPlatform, "onReplyAction?:", "App SDK module type must expose the package-rendered reply-action callback");
  requireIncludes(appPlatform, "contextualPostActions?: AppContextualPostAction[]", "App SDK manifest must expose contextual post actions");
  requireIncludes(appPlatform, "onContextualPostAction?:", "App SDK module type must expose the contextual post-action callback");
  requireIncludes(appPlatform, "contextMediaActions?: AppContextMediaAction[]", "App SDK manifest must expose reviewed contextual media actions");
  requireIncludes(appPlatform, "mediaContributions?: AppMediaContribution[]", "App SDK manifest must expose reviewed native media contributions");
  requireIncludes(appPlatform, "onContextMediaAction?:", "App SDK module type must expose the contextual media callback");
  requireIncludes(appPlatform, "AppSiteScope", "App manifest type must expose site scope metadata");
  requireIncludes(contentRuntime, "const nonRailApps = apps.filter((app) => !isHubRailApp(app));", "Apps & Features must keep non-rail app packages visible for generated enablement controls");
  requireIncludes(contentRuntime, "return [...ordered, ...nonRailApps];", "Apps & Features must append non-rail app packages after rail-ordered apps");
  requireIncludes(contentRuntime, "createComposerActionRefreshScheduler", "Composer action DOM mutations must be coalesced before rescanning X");
  requireIncludes(contentRuntime, "const shadow = panel.attachShadow({ mode: \"open\" });", "Composer actions must render package content in an isolated host-owned panel root");
  requireIncludes(contentRuntime, "composerActionBindingToken", "Composer actions must rebind host controls after an extension reload leaves prior DOM in place");
  requireIncludes(contentRuntime, ".milxdy-composer-action-panel[data-app-id]", "Composer action startup must clear orphaned panels from an earlier content-runtime instance");
  requireIncludes(contentRuntime, "pendingComposerAction", "Composer action activation must serialize rapid toggle clicks across async module loads");
  requireIncludes(contentRuntime, "await installComposerActionPackageStyles(app, shadow);", "Composer actions must load declared package CSS before their callback renders");
  requireIncludes(contentRuntime, "for (const sheet of app.css || [])", "Composer action styling must be limited to declared package stylesheets");
  requireIncludes(contentRuntime, "function composerActionRowFor", "Composer actions must resolve X's toolbar row before inserting controls");
  requireIncludes(contentRuntime, "[data-testid=\"ScrollSnap-List\"]", "Composer actions must join X's toolbar action row instead of the editor body");
  requireIncludes(contentRuntime, "A zero-row pass is an X reconciliation transient", "Composer actions must not disappear while X replaces a drafted editor");
  requireIncludes(contentRuntime, "const openBelow = spaceBelow >= naturalHeight || spaceBelow >= spaceAbove;", "Composer panels must choose the viewport side with enough reachable space");
  requireIncludes(contentRuntime, "panel.dataset.placement = openBelow ? \"bottom\" : \"top\";", "Composer panels must record their responsive above/below placement");
  requireIncludes(contentRuntime, "panelSizeObserver = new ResizeObserver(scheduleComposerActionPosition);", "Composer panels must adapt when package content changes size");
  requireIncludes(contentRuntime, "const openNativeDrafts = () => openNativeDraftsFor(button, close);", "Composer packages must use the host-owned X Drafts handoff");
  requireIncludes(contentRuntime, 'a[href*="/compose/tweet/unsent/drafts"]', "Native Drafts handoff must target X's own Drafts control");
  requireIncludes(contentRuntime, 'window.location.assign(new URL("/compose/tweet/unsent/drafts", window.location.origin).toString())', "Inline composers without a visible Drafts control must open X's native Drafts route");
  requireIncludes(contentRuntime, "splitExternalHandoffText", "External handoffs must split active composer text only in the host runtime");
  requireIncludes(contentRuntime, "handoff.captionSource === \"packageFields\"", "Explicit package captions must not read the X composer");
  requireIncludes(contentRuntime, 'type: "milxdy:externalHandoff"', "External handoffs must use a host-routed background request");
  requireIncludes(contentRuntime, 'type: "milxdy:remoteQuery"', "Remote galleries must use a host-routed background request");
  requireIncludes(contentRuntime, "playInterfaceLaunchSound();", "External handoffs must use the host-owned, user-preference-respecting loading cue");
  requireIncludes(contentRuntime, "function installReplyActionHost", "Reply actions must be hosted by the platform, not package page-DOM code");
  requireIncludes(contentRuntime, "activeReplyActionButton === button", "Reply-action invokers must toggle their active package panel closed on a second click");
  requireIncludes(contentRuntime, "rect.bottom + 8", "Reply-action menus must open below the X reply control");
  requireIncludes(contentRuntime, "document.addEventListener(\"scroll\", positionReplyActionPanel, true)", "Reply-action panels must track their X reply control while its post scrolls");
  requireIncludes(contentRuntime, "panel.style.top = `${anchoredTop + window.scrollY}px`", "Reply-action panels must leave the viewport with their scrolling Reply control instead of pinning to an edge");
  requireIncludes(contentRuntime, "panel.style.visibility = hiddenBehindHeader ? \"hidden\" : \"visible\"", "Reply-action panels must not draw through X's sticky column header");
  requireIncludes(contentRuntime, "window.addEventListener(\"keydown\", dismissOnEscape, true)", "Package panels must receive Escape before page-level keyboard handlers");
  requireIncludes(contentRuntime, "module.onReplyAction", "Reply-action UI must be rendered by the declaring package");
  requireIncludes(contentRuntime, "[contenteditable=\"true\"][data-testid^=\"tweetTextarea_\"]", "Reply insertion must target X's actual editable element, not an inherited editable wrapper");
  requireIncludes(contentRuntime, "if (normalizedText(editor.innerText || editor.textContent || \"\")) return false;", "Reply insertion must fail closed rather than append to an existing native draft");
  requireIncludes(contentRuntime, "new ClipboardEvent(\"paste\"", "Reply insertion must update X's controlled editor through its text-transfer contract");
  requireIncludes(contentRuntime, "clipboardData.setData(\"text/plain\", text)", "Reply insertion must transfer only the explicit declared template text");
  requireIncludes(contentRuntime, "if (++verificationFrames < 30) window.requestAnimationFrame(verifyControlledInsertion);", "Reply insertion must wait for X's controlled state without a second DOM insertion");
  requireIncludes(contentRuntime, "normalizedText(editor.innerText || editor.textContent || \"\") !== normalizedText(text)", "Auto-submit must fail closed unless X contains exactly the selected template");
  requireIncludes(contentRuntime, "[data-tier=\"app\"][data-rail-app=\"true\"]", "Apps & Features must reserve rail ordering affordances for rail-capable apps only");
  requireIncludes(contentRuntime, "root.dataset.theme = currentHubTheme()", "Apps & Features must bind its host palette to the active X light, dim, or dark theme");
  requireIncludes(contentRuntime, "function currentHubTheme", "Apps & Features must resolve distinct light, dim, and dark host palettes");
  requireIncludes(contentRuntime, "function appHubLifecycle", "Apps & Features must present package lifecycle state without package-owned UI code");
  requireIncludes(contentRuntime, "Ready in composer + reply", "Composer/reply packages must receive a generic ready lifecycle state");
  requireIncludes(composerSource, "record.css.map((sheet) => sheet.target)", "declared package stylesheets must be exposed to the host-owned composer panel");
  requireIncludes(composerSource, "supportedExternalHandoffAdapters", "Local package composition must reject undeclared external handoff adapters");
  requireIncludes(background, "renderRemiliaMakerImage", "External maker handoffs must be host-owned adapter code");
  requireIncludes(background, "active: false", "Reviewed maker handoffs must open inactive tabs");
  requireIncludes(background, "finally {", "Reviewed maker handoffs must clean up generated inactive tabs after success or failure");
  requireIncludes(background, "chrome.tabs.remove(generatedMakerTabId)", "Reviewed maker handoffs must remove only their generated maker tab");
  requireIncludes(background, "world: \"MAIN\"", "The reviewed maker image must be rendered only by its own page runtime");
  requireIncludes(background, "imageDataUrl", "The host adapter must return only a validated generated image");
  requireIncludes(background, "#randomMemeButton", "Random-meme handoffs must use the maker's dedicated meme control, not its token selector");
  requireIncludes(background, "randomMeme.click();", "Random-meme handoffs must explicitly invoke the reviewed meme preset action");
  requireIncludes(background, "sanitizeRemibooruPosts", "Remote galleries must return sanitized reviewed post pages");
  requireIncludes(background, "remibooruQueryUrl", "Remote galleries must use a fixed reviewed query schema");
  requireIncludes(contentRuntime, "new File([blob], \"remilia-maker.png\"", "The host must attach the generated maker PNG through X's existing media control");
  requireIncludes(contentRuntime, "input.files = transfer.files", "The host must use the native file-input handoff rather than visual text insertion");
  requireIncludes(contentRuntime, "A repeated activation of the same action is a toggle", "Composer actions must close on a second activation of the same action");
  requireIncludes(contentRuntime, "activeComposerAction.panel.isConnected", "Composer actions must discard stale panels reconciled away by X before reopening");
}

function verifySdkVersionSource() {
  if (typeof packageJson.appSdkVersion !== "string") fail("package.json must declare appSdkVersion for local app SDK compatibility");
  requireIncludes(composerSource, "packageJson.appSdkVersion", "local app composer must derive its SDK version from package.json appSdkVersion");
}

function verifyLocalPackageShapeContract() {
  requireIncludes(appPlatform, "MilxdyLocalAppPackageManifestV1", "App SDK types must expose the local apps-folder package manifest");
  requireIncludes(appPlatform, "manifestVersion: MilxdyLocalPackageManifestVersion", "local package manifest must declare a versioned manifest field");
  requireIncludes(appPlatform, "sdk: MilxdyLocalPackageSdkCompatibility", "local package manifest must declare SDK compatibility metadata");
  requireIncludes(appPlatform, "privacy: MilxdyLocalPackagePrivacy", "local package manifest must declare privacy metadata");
  requireIncludes(appPlatform, "MilxdyLocalPackageAsset", "local package manifest must expose structured asset metadata");
  requireIncludes(appPlatform, "MilxdyLocalPackageReviewStatus", "local package manifest must distinguish local/reviewed/blocked package status");
  requireIncludes(appPlatform, "\"isEnabled\" | \"setEnabled\"", "local package manifest must not include runtime enablement adapter functions");

  requireIncludes(appSdkDocs, "## Local Apps-Folder Package Shape", "App SDK docs must define the local apps-folder package shape");
  requireIncludes(appSdkDocs, "reviewed custom-build composition", "package docs must define the supported custom-build distribution path");
  requireIncludes(appSdkDocs, "apps/", "package docs must show the package folder root");
  requireIncludes(appSdkDocs, "milxdy.app.json", "package docs must require the package manifest file");
  requireIncludes(appSdkDocs, "manifestVersion: 1", "package docs must document the manifest version");
  requireIncludes(appSdkDocs, "sdk.minVersion", "package docs must document SDK compatibility");
  requireIncludes(appSdkDocs, "entryName", "package docs must distinguish first-party build-only fields");
  requireIncludes(appSdkDocs, "requiredOutputs", "package docs must distinguish requiredOutputs as build-only metadata");
  requireIncludes(appSdkDocs, "Package paths are package-root-relative", "package docs must forbid absolute/traversal paths");
  requireIncludes(appSdkDocs, "## Distribution Boundary", "package docs must define the custom-build distribution boundary");
  requireIncludes(appSdkDocs, "deterministic manifest, archive, path, asset, lifecycle, settings, background-message, permission, privacy, and URL metadata validation", "package docs must record implemented validation safeguards");
  requireIncludes(appSdkDocs, "does not inject new JavaScript into an already-installed extension", "package docs must distinguish composition from runtime injection");
  requireIncludes(appSdkDocs, "## Composer actions", "package docs must define composer-adjacent actions");

  requireIncludes(privacyDocs, "## Future Local App Packages", "privacy docs must describe future local package permissions");
  requireIncludes(privacyDocs, "stay disabled until validation", "privacy docs must keep copied packages disabled before validation/consent");
}

function verifyRootAndRuntimeOwnership() {
  requireIncludes(contentRoot, "createContentRuntime(FIRST_PARTY_APPS)", "content root must bootstrap the shared content runtime");
  if (/from\s+["']\.\/features\//.test(contentRoot) || /import\s*\([^)]*features\//.test(contentRoot)) {
    fail("src/extension/content/index.ts must not import feature bundles directly");
  }
  requireIncludes(contentRuntime, "observeHubGeneratedSettings()", "runtime must own generated settings observation");
  requireIncludes(contentRuntime, "hubGeneratedFeatureSettings", "runtime must own generated feature settings selection");
  requireIncludes(contentRuntime, "subscribeTwitterSurfaces(handleSurface)", "runtime must own shared Twitter/X scanner subscription");
  requireIncludes(contentRuntime, "currentAppSiteId()", "runtime route scope loading must resolve the current site");
  requireIncludes(contentRuntime, "siteScopeMatchesCurrentHost", "runtime route scope loading must check host-aware site metadata");
  requireIncludes(contentRuntime, "scheduler,", "runtime must provide shared scheduling through context.scheduler");
  requireIncludes(backgroundMessagePolicy, "extractBackgroundMessageType", "runtime policy must extract App SDK background message types before sending");
  requireIncludes(contentRuntime, "dispatchAuthorizedBackgroundMessage", "runtime must enforce App SDK background message capability metadata before queueing");
  requireIncludes(contentRuntime, "backgroundMessage.denied", "runtime must record denied App SDK background message diagnostics");
  if (/from\s+["'][^"']*features\//.test(contentRuntime) || /import\s*\([^)]*features\//.test(contentRuntime)) {
    fail("content runtime must not import feature bundles directly");
  }
  if (!contentRuntime.includes("recordRuntimeDiagnostic")) {
    fail("content runtime must keep runtime diagnostics hooks");
  }
}

function verifyRegistry() {
  if (!Array.isArray(registry) || registry.length === 0) fail("first-party registry must be a non-empty array");
  const seenIds = new Set();
  for (const app of registry) {
    const label = app?.id || "<unknown>";
    for (const field of requiredManifestFields) {
      if (!hasOwn(app, field)) fail(`${label}: missing required manifest field ${field}`);
    }
    if (seenIds.has(app.id)) fail(`${app.id}: duplicate registry id`);
    seenIds.add(app.id);
    if (!validPackageKinds.has(app.packageKind)) fail(`${app.id}: invalid or missing packageKind`);
    if (app.entryPoint) {
      if (!existsSync(app.entryPoint)) fail(`${app.id}: entryPoint does not exist: ${app.entryPoint}`);
      if (app.contentEntry !== `${app.entryName}.js`) fail(`${app.id}: contentEntry must match entryName`);
    } else if (app.available !== false) {
      fail(`${app.id}: available first-party app must declare an entryPoint`);
    }
    if (typeof app.defaultEnabled !== "boolean") fail(`${app.id}: defaultEnabled must be boolean`);
    if (app.id === "reminetChat") verifyReminetChatDefaults(app);
    verifyHubMetadata(app);
    verifyStorageAndSettings(app);
    verifyLifecycleAndSiteMetadata(app);
    verifyChromeAndDock(app);
    verifyCostPrivacyPermissionDisclosure(app);
  }
}

function verifyReminetChatDefaults(app) {
  if (app.defaultEnabled !== false) fail("reminetChat: defaultEnabled must stay false; RemiNet Chat is opt-in");
  const enablement = (app.settings || []).find((setting) => setting.id === "reminetChat.enabled");
  if (!enablement) {
    fail("reminetChat: missing enablement setting");
    return;
  }
  if (enablement.defaultValue !== false) fail("reminetChat.enabled: defaultValue must stay false; RemiNet Chat is opt-in");
}

function verifyLifecycleAndSiteMetadata(app) {
  if (!Array.isArray(app.surfaces)) {
    fail(`${app.id}: surfaces must be an array`);
  } else {
    for (const surface of app.surfaces) {
      if (!validSurfaces.has(surface)) fail(`${app.id}: unsupported surface ${surface}`);
    }
  }
  if (!Array.isArray(app.loadTriggers)) {
    fail(`${app.id}: loadTriggers must be an array`);
  }

  const lifecycle = app.lifecycle;
  if (lifecycle !== undefined) {
    if (!lifecycle || typeof lifecycle !== "object" || !validLifecycleModes.has(lifecycle.mode)) {
      fail(`${app.id}: unsupported lifecycle mode ${lifecycle?.mode}`);
    } else if (lifecycle.mode === "invoked") {
      if (lifecycle.invokedBy !== undefined && !validInvocationTriggers.has(lifecycle.invokedBy)) {
        fail(`${app.id}: unsupported invocation trigger ${lifecycle.invokedBy}`);
      }
      if (lifecycle.invokedBy !== "userAction") fail(`${app.id}: invoked lifecycle must declare invokedBy userAction`);
      if (!lifecycle.reason) fail(`${app.id}: invoked lifecycle must declare the platform load reason`);
      if (!app.loadTriggers?.every((trigger) => trigger === "userAction")) {
        fail(`${app.id}: invoked lifecycle packages must use only userAction load triggers`);
      }
      if ((app.surfaces || []).length > 0) {
        fail(`${app.id}: invoked lifecycle packages must not declare runtime delivery surfaces`);
      }
    }
  }

  const siteScopes = app.siteScopes || [];
  if (!Array.isArray(siteScopes)) fail(`${app.id}: siteScopes must be an array when declared`);
  for (const scope of Array.isArray(siteScopes) ? siteScopes : []) {
    if (!validSites.has(scope.site)) fail(`${app.id}: unsupported site scope ${scope.site}`);
    if (!validSiteIntegrations.has(scope.integration)) {
      fail(`${app.id}: site scope must declare a supported integration mode`);
    }
    if (!Array.isArray(scope.hosts) || scope.hosts.length === 0) {
      fail(`${app.id}: site scope must declare host patterns`);
    } else {
      for (const host of scope.hosts) {
        if (!validSiteHostPattern(host)) fail(`${app.id}: invalid site scope host pattern ${host}`);
      }
    }
    if (!Array.isArray(scope.surfaces) || scope.surfaces.length === 0) {
      fail(`${app.id}: site scope must declare at least one surface`);
    } else {
      for (const surface of scope.surfaces) {
        if (!validSurfaces.has(surface)) fail(`${app.id}: site scope declares unsupported surface ${surface}`);
      }
    }
    if (scope.presentation !== undefined && !validSitePresentations.has(scope.presentation)) {
      fail(`${app.id}: unsupported site presentation ${scope.presentation}`);
    }
    if (scope.routes !== undefined && !Array.isArray(scope.routes)) fail(`${app.id}: site scope routes must be an array`);
    for (const route of Array.isArray(scope.routes) ? scope.routes : []) {
      if (!validRouteMatchTypes.has(route.type)) fail(`${app.id}: unsupported route match type ${route.type}`);
      if (typeof route.path !== "string" || !route.path.startsWith("/")) {
        fail(`${app.id}: route pattern must declare an absolute path`);
      }
      if (route.surface !== undefined && !validSurfaces.has(route.surface)) {
        fail(`${app.id}: route pattern declares unsupported surface ${route.surface}`);
      }
      if (route.surface !== undefined && !scope.surfaces.includes(route.surface)) {
        fail(`${app.id}: route pattern surface ${route.surface} must be included in its site scope surfaces`);
      }
    }
  }

  for (const surface of app.surfaces || []) {
    if (surface === "route" || surface === "overlayApp") continue;
    if (surfaceSupportedBySiteScope(app, surface)) continue;
    warn(`${app.id}: surface ${surface} is declared without matching site scope metadata`);
  }

  if ((app.surfaces || []).includes("directMessage")) {
    const directMessageScope = directMessageSiteScope(app);
    if (lifecycle?.mode !== "runtime") {
      fail(`${app.id}: directMessage packages must declare runtime lifecycle metadata`);
    }
    if (!directMessageScope) {
      fail(`${app.id}: directMessage packages must declare explicit X direct-message site metadata`);
    }
    if ((app.surfaces || []).includes("route") && !hasRequiredMessagesRoutes(directMessageScope)) {
      fail(`${app.id}: directMessage route packages must declare /messages and /i/chat route patterns`);
    }
  }
}

function validSiteHostPattern(value) {
  if (typeof value !== "string" || !/^(https?|wss):\/\/[^/*\s/?#@:]+(?::[0-9]+)?\/\*$/.test(value)) return false;
  const originText = value.slice(0, -2);
  let parsed;
  try {
    parsed = new URL(originText);
  } catch {
    return false;
  }
  if (!["http:", "https:", "wss:"].includes(parsed.protocol)) return false;
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return false;
  if (!parsed.hostname || parsed.hostname.includes("*")) return false;
  return parsed.origin === originText;
}

function surfaceSupportedBySiteScope(app, surface) {
  return (app.siteScopes || []).some((scope) => {
    return Array.isArray(scope.surfaces) && scope.surfaces.includes(surface);
  });
}

function verifyHubMetadata(app) {
  const hub = app.hub || {};
  if (!hub.category || !hub.shortDescription) fail(`${app.id}: missing Hub category or shortDescription`);
  if (!hub.rail || typeof hub.rail.supported !== "boolean" || typeof hub.rail.defaultPinned !== "boolean") {
    fail(`${app.id}: missing Hub rail metadata`);
  }
  if (!Array.isArray(hub.presets) || hub.presets.length === 0) fail(`${app.id}: missing Hub preset metadata`);
  if (!Array.isArray(hub.privacyLabels) || hub.privacyLabels.length === 0) fail(`${app.id}: missing privacy label disclosure`);
  if (!Array.isArray(hub.dataNotes) || hub.dataNotes.length === 0) fail(`${app.id}: missing data note disclosure`);
  if (!Array.isArray(hub.localStorageNotes) || hub.localStorageNotes.length === 0) fail(`${app.id}: missing local storage disclosure`);
}

function verifyStorageAndSettings(app) {
  const storageKeys = app.storageKeys || {};
  for (const area of Object.keys(storageKeys)) {
    if (!validSettingAreas.has(area)) fail(`${app.id}: invalid storageKeys area ${area}`);
    if (!Array.isArray(storageKeys[area])) fail(`${app.id}: storageKeys.${area} must be an array`);
  }
  for (const setting of app.settings || []) {
    if (!setting.id || !setting.label || !setting.scope || !setting.location) fail(`${app.id}: setting missing id/label/scope/location`);
    if (!validSettingScopes.has(setting.scope)) fail(`${app.id}:${setting.id}: invalid setting scope ${setting.scope}`);
    if (!validSettingLocations.has(setting.location)) fail(`${app.id}:${setting.id}: invalid setting location ${setting.location}`);
    if (setting.role !== undefined && !validSettingRoles.has(setting.role)) fail(`${app.id}:${setting.id}: invalid setting role ${setting.role}`);
    if (!setting.storage || !validSettingAreas.has(setting.storage.area) || !setting.storage.key) {
      fail(`${app.id}:${setting.id}: invalid setting storage metadata`);
      continue;
    }
    if (!storageKeys[setting.storage.area]?.includes(setting.storage.key)) {
      warn(`${app.id}:${setting.id}: setting storage key is not declared in storageKeys.${setting.storage.area}`);
    }
    if (!setting.control || !validControlTypes.has(setting.control.type)) fail(`${app.id}:${setting.id}: invalid control metadata`);
    const selectLikeControl = setting.control?.type === "select" || setting.control?.type === "segmented";
    const hasStaticOptions = Array.isArray(setting.control?.options);
    const hasDynamicOptions = hasValidDynamicOptions(setting.control?.dynamicOptions);
    if (setting.control?.dynamicOptions && !hasDynamicOptions) {
      fail(`${app.id}:${setting.id}: invalid dynamic option metadata`);
    }
    if (setting.control?.dynamicOptions && !selectLikeControl) {
      fail(`${app.id}:${setting.id}: dynamic option metadata is only valid for select-like controls`);
    }
    if (selectLikeControl && !hasStaticOptions && !hasDynamicOptions) {
      warn(`${app.id}:${setting.id}: select-like controls should declare options when values are enumerable`);
    }
    if (!setting.reset || !validResetBehaviors.has(setting.reset.behavior)) fail(`${app.id}:${setting.id}: invalid reset metadata`);
    if (setting.location === "appSurface" && app.packageKind !== "app") {
      warn(`${app.id}:${setting.id}: appSurface settings on non-app packages are transitional and should be revisited`);
    }
    if (setting.location === "appsAndFeatures" && setting.scope === "app" && app.packageKind === "app") {
      const role = setting.role || "preference";
      if (!appsAndFeaturesAppRoles.has(role)) {
        warn(`${app.id}:${setting.id}: app-owned settings in Apps & Features must declare enablement/open/reset role instead of detailed preference role`);
      }
    }
  }
}

function hasValidDynamicOptions(dynamicOptions) {
  if (!dynamicOptions || typeof dynamicOptions !== "object") return false;
  if (!validDynamicOptionProviders.has(dynamicOptions.provider)) return false;
  if (dynamicOptions.provider === "webSpeechVoices") {
    if (dynamicOptions.valueField !== "voiceURI") return false;
    if (dynamicOptions.labelField !== "name") return false;
    if (dynamicOptions.descriptionField !== undefined && dynamicOptions.descriptionField !== "lang") return false;
    if (dynamicOptions.refreshEvent !== undefined && dynamicOptions.refreshEvent !== "voiceschanged") return false;
  }
  if (dynamicOptions.portability !== undefined && !validDynamicOptionPortability.has(dynamicOptions.portability)) return false;
  return true;
}

function verifyChromeAndDock(app) {
  if (!app.chrome?.nativeStyle || !Array.isArray(app.chrome.supportedStyles) || app.chrome.supportedStyles.length === 0) {
    fail(`${app.id}: missing app chrome compatibility metadata`);
  }
  if (app.packageKind === "app" && app.hub?.rail?.supported && !app.dock?.label) {
    fail(`${app.id}: rail-supported app must declare dock metadata`);
  }
  if (app.packageKind !== "app" && app.dock) {
    fail(`${app.id}: non-app package must not declare dock metadata`);
  }
}

function verifyCostPrivacyPermissionDisclosure(app) {
  if (!app.cost?.startup || !app.cost?.perSurface || !app.cost?.network || !app.cost?.worker || !app.cost?.domWrite) {
    fail(`${app.id}: incomplete cost metadata`);
  }
  const remoteServices = app.hub?.remoteServices || [];
  const hosts = app.permissions?.hosts || [];
  if (remoteServices.length > 0 || hosts.length > 0 || app.cost?.network !== "none") {
    if (!Array.isArray(app.hub?.permissionNotes) || app.hub.permissionNotes.length === 0) {
      fail(`${app.id}: remote/network package must disclose permission notes`);
    }
    if (!app.hub?.privacyLabels?.some((label) => label === "remote-api" || label === "browser-session" || label === "local-files")) {
      fail(`${app.id}: remote/network package must disclose a matching privacy label`);
    }
  }
  if (app.packageKind === "feature" && app.hub?.rail?.supported) fail(`${app.id}: feature packages must not be rail-supported`);
}

async function verifyContentModules() {
  for (const app of registry) {
    if (!app.entryPoint && app.available === false) continue;
    const sourcePath = await resolveEntrySource(app.entryPoint);
    if (!sourcePath || !existsSync(sourcePath)) {
      fail(`${app.id}: unable to resolve content module from ${app.entryPoint}`);
      continue;
    }
    const source = await readFile(sourcePath, "utf8");
    const exports = lifecycleExports(source);
    const explicitInvokedLifecycle = app.lifecycle?.mode === "invoked";
    if (!exports.has("boot") && !app.loadTriggers?.every((trigger) => trigger === "userAction")) {
      fail(`${app.id}: content module must export boot()`);
    }
    if (!exports.has("boot") && app.loadTriggers?.every((trigger) => trigger === "userAction") && !explicitInvokedLifecycle) {
      warn(`${app.id}: invoked-only package has no boot() export; keep it userAction-only until lifecycle metadata is explicit`);
    }
    if (exports.has("boot") && explicitInvokedLifecycle) {
      fail(`${app.id}: invoked-only package must not add a fake boot() export`);
    }
    if (app.loadTriggers?.includes("dockOpen") || app.surfaces?.includes("overlayApp")) {
      if (!exports.has("open") || !exports.has("close")) fail(`${app.id}: dock/overlay app must export open() and close()`);
    }
    if (app.surfaces?.includes("route") && !exports.has("onRouteChange")) {
      warn(`${app.id}: route surface is inferred from runtime behavior but onRouteChange() is not exported`);
    }
    const twitterSurfaces = (app.surfaces || []).filter((surface) => !["overlayApp", "route", "directMessage", "composerAction", "replyAction"].includes(surface));
    if (twitterSurfaces.length > 0 && !exports.has("onSurface")) {
      fail(`${app.id}: declares Twitter/X delivery surfaces but does not export onSurface()`);
    }
    if (app.surfaces?.includes("directMessage") && !exports.has("onSurface") && !hasExplicitDirectMessageRouteMetadata(app)) {
      warn(`${app.id}: directMessage lifecycle is inferred today; explicit site/surface manifest support belongs with follow-up work`);
    }
    if (/\bvoid\s+boot\s*\(/.test(source)) fail(`${app.id}: content module must not self-boot`);
    if (source.includes("subscribeTwitterSurfaces")) fail(`${app.id}: content module must not subscribe directly to the shared scanner`);
    const directMessageWarning = directRuntimeBridgeWarning(app.id, sourcePath, source, "message");
    if (directMessageWarning) warn(directMessageWarning);
    if (/safeRuntimeMessage(?:<[^>]+>)?\s*\(/.test(source)) {
      warn(`${app.id}: transitional/internal safeRuntimeMessage fallback bypasses App SDK sender metadata; keep documented or migrate to context.sendMessage`);
    }
    const portWarning = directRuntimeBridgeWarning(app.id, sourcePath, source, "port");
    if (portWarning) warn(portWarning);
    verifyAppBackgroundMessageUsage(app, source, sourcePath);
    if (/(setInterval|requestIdleCallback)\s*\(/.test(source) && !source.includes("context.scheduler")) {
      warn(`${app.id}: app-owned timers or idle callbacks should migrate to context.scheduler where feasible`);
    }
    if (/new\s+MutationObserver/.test(source) && twitterSurfaces.length > 0) {
      const observerReview = reviewAppOwnedObservers(app, source);
      if (observerReview.broad.length > 0) {
        const boundedNote = observerReview.bounded.length > 0
          ? `; bounded exceptions recognized: ${observerReview.bounded.join(", ")}`
          : "";
        warn(`${app.id}: ${observerReview.broad.join("; ")}${boundedNote}`);
      } else if (observerReview.unclassified > 0) {
        warn(`${app.id}: app-owned observers need explicit bounds or should move behind shared scanner/scheduler services`);
      }
    }
  }
}

function reviewAppOwnedObservers(app, source) {
  const observerCount = Array.from(source.matchAll(/new\s+MutationObserver/g)).length;
  const bounded = [];
  const broad = [];

  if (
    app.id === "rootVisuals"
    && /themeObserver\s*=\s*new\s+MutationObserver/.test(source)
    && /themeObserver\.observe\(document\.documentElement,\s*\{\s*attributes:\s*true,\s*attributeFilter:/s.test(source)
    && /themeObserver\.observe\(document\.body,\s*\{\s*attributes:\s*true,\s*attributeFilter:/s.test(source)
  ) {
    bounded.push("theme observer is attribute-only on document theme roots");
  }

  if (
    app.id === "rootVisuals"
    && /pageChromeObserver\s*=\s*new\s+MutationObserver/.test(source)
    && /homeLogoPageChromeRoot\(\)/.test(source)
    && /pageChromeObserver\.observe\(target,\s*\{\s*attributes:\s*true,\s*attributeFilter:[^}]*childList:\s*true,\s*subtree:\s*true/s.test(source)
    && !/pageChromeObserver\.observe\([^;]*document\.(?:body|documentElement)/s.test(source)
  ) {
    bounded.push("home-logo page-chrome observer attaches only to discovered header/h1 roots");
  }

  if (
    app.id === "rootVisuals"
    && /navigationObserver\s*=\s*new\s+MutationObserver/.test(source)
    && /navigationObserver\.observe\([^;]*document\.(?:body|documentElement)[^;]*subtree:\s*true/s.test(source)
  ) {
    broad.push("broad body-subtree navigation observer remains deferred to #39/#90/#64 and should move behind shared scanner/page-chrome services");
  }

  return {
    bounded,
    broad,
    unclassified: Math.max(0, observerCount - bounded.length - broad.length),
  };
}

function directMessageSiteScope(app) {
  return (app.siteScopes || []).find((scope) => {
    return scope.site === "x" && Array.isArray(scope.surfaces) && scope.surfaces.includes("directMessage");
  }) || null;
}

function hasExplicitDirectMessageRouteMetadata(app) {
  const scope = directMessageSiteScope(app);
  return Boolean(scope && hasRequiredMessagesRoutes(scope));
}

function hasRequiredMessagesRoutes(scope) {
  const routes = Array.isArray(scope?.routes) ? scope.routes : [];
  return routes.some((route) => route.type === "exact" && route.path === "/messages")
    && routes.some((route) => route.type === "prefix" && route.path === "/messages/")
    && routes.some((route) => route.type === "exact" && route.path === "/i/chat")
    && routes.some((route) => route.type === "prefix" && route.path === "/i/chat/");
}

async function verifyBackgroundMetadata() {
  const actualTypes = Array.from(routedBackgroundTypes).sort();
  const declaredPatterns = new Map();
  for (const app of registry) {
    for (const type of app.background?.messageTypes || []) {
      declaredPatterns.set(type, app.id);
      if (!messageTypeCovered(type, actualTypes)) fail(`${app.id}: declared background message type has no router handler: ${type}`);
    }
  }
  for (const type of actualTypes) {
    if (isCoreBackgroundMessage(type)) continue;
    const owner = registry.find((app) => (app.background?.messageTypes || []).some((pattern) => messageTypeMatches(pattern, type)));
    if (!owner) warn(`background message ${type} is routed but not declared in first-party app metadata`);
  }

  for (const file of featureBackgroundFiles("src/apps")) {
    const source = await readFile(file, "utf8");
    if (source.includes("chrome.runtime.onMessage.addListener")) {
      fail(`${file}: feature background must use shared backgroundRouter, not a direct onMessage listener`);
    }
    if (source.includes("registerBackgroundMessageHandlers") && !/type:\s*["'][^"']+/.test(source)) {
      fail(`${file}: background router registration must declare stable message type metadata`);
    }
  }
}

async function collectRoutedBackgroundTypes() {
  const types = new Set(backgroundMessageTypes(background));
  for (const file of featureBackgroundFiles("src/apps")) {
    const source = await readFile(file, "utf8");
    for (const type of backgroundMessageTypes(source)) types.add(type);
  }
  return types;
}

function verifyAppBackgroundMessageUsage(app, source, sourcePath) {
  const declared = app.background?.messageTypes || [];
  const usedTypes = backgroundMessageTypesUsedByContent(source);
  for (const type of usedTypes) {
    if (!isPotentialBackgroundMessageType(type)) continue;
    if (declared.some((pattern) => messageTypeMatches(pattern, type))) continue;
    fail(`${app.id}: content uses background message ${type} without declaring it in background.messageTypes (${sourcePath})`);
  }
}

function backgroundMessageTypesUsedByContent(source) {
  const types = new Set();
  const callRegex = /(?:context\.sendMessage|runtimeSendMessage|appSdkSendMessage|safeRuntimeMessage|chrome\.runtime\.sendMessage|send)\s*(?:<[^>]+>)?\(\s*\{[\s\S]*?type:\s*["']([^"']+)["']/g;
  for (const match of source.matchAll(callRegex)) types.add(match[1]);
  return Array.from(types).sort();
}

function isPotentialBackgroundMessageType(type) {
  return type.includes(":");
}

function verifyInternalBridgeValidation() {
  for (const wrapper of [
    "fetchImageDataUrlForSender",
    "fetchMiladychanJsonForSender",
    "fetchMusicJsonForSender",
    "fetchMusicImageDataUrlForSender",
    "fetchRemiStatsUserForSender",
    "resolveReminetIdentityForSender",
  ]) {
    requireIncludes(background, wrapper, `central routed bridge must use sender-aware wrapper ${wrapper}`);
  }
  requireIncludes(background, "if (!isXContentScriptSender(sender)) return unsupportedSender();", "central X app routes must validate same-extension top-frame X/Twitter senders");
  requireIncludes(background, "isSameExtensionTopFrameHttpsSender(sender, [\"x.com\", \"twitter.com\"])", "central X app sender policy must restrict to X/Twitter hosts");
  requireIncludes(background, "if (!isWikiImageSender(sender)) return unsupportedSender();", "wiki image bridge must validate wiki-specific sender policy");
  requireIncludes(background, "isXContentScriptSender(sender) || isWikiFrameSender(sender)", "wiki image bridge must allow only X content scripts or packaged wiki frames");
  requireIncludes(background, "UNSUPPORTED_SENDER", "central routed bridges must fail closed for unsupported senders");
  requireIncludes(postReadingBackground, "isPostReadingOcrFrameSender", "post-reading OCR background bridge must validate ocr.html frame senders");
  requireIncludes(postReadingBackground, "isXContentScriptSender", "post-reading background fetch bridge must validate X/Twitter content-script senders");
  requireIncludes(postReadingBackground, "UNSUPPORTED_SENDER", "post-reading background bridge must fail closed for unsupported senders");
  requireIncludes(postReadingBackground, "sender.id !== chrome.runtime.id", "post-reading OCR background bridge must validate same-extension sender id");
  requireIncludes(postReadingBackground, "sender.frameId !== undefined && sender.frameId !== 0", "post-reading X content sender bridge must reject non-top frames");
  requireIncludes(postReadingBackground, "isAllowedResponseContentType", "post-reading fetch bridge must validate response content types");
  requireIncludes(postReadingBackground, "RESPONSE_TOO_LARGE", "post-reading fetch bridge must reject oversized responses");
  requireIncludes(postReadingDefaults, "fetchFullQuotes: false", "post-reading full-quote fetching must default off");
  requireIncludes(postReadingDefaults, "fullQuoteDisplay: \"hidden\"", "post-reading full-quote display must default hidden");
  requireIncludes(postReadingContent, "if (!settings.fetchFullQuotes) return;", "post-reading full-quote fetch path must require explicit fetchFullQuotes opt-in");
  if (postReadingContent.includes("settings.fetchFullQuotes || settings.fullQuoteDisplay !== \"hidden\"")) {
    fail("post-reading full-quote fetch path must not treat display mode as fetch consent");
  }
  requireIncludes(postReadingFullQuote, "credentials: \"omit\"", "post-reading full-quote public fetches must omit browser credentials");
  if (/document\.cookie|\bct0\b|\bBearer\b|\bx-csrf-token\b|\bauthorization\b|\bTweetResultByRestId\b|\/i\/api\/graphql\/|\bqueryId\b|\bfetchGraphQl|\bdiscoverGraphQl|\bextractGraphQl|\bgraphQlFeatures\b|\bgraphQlFieldToggles\b|credentials:\s*["']include["']|createElement\(["']iframe["']\)|frame\.src\s*=/i.test(postReadingFullQuote)) {
    fail("post-reading full-quote fetch path must not read or reuse X/Twitter session material, bearer tokens, CSRF cookies, GraphQL query IDs, hidden session-bearing frames, or credentialed fetches");
  }
  requireIncludes(postReadingBackground, 'credentials: "omit"', "post-reading background bridge must omit credentials for public full-quote fetches");
  requireIncludes(postReadingBackground, "AbortSignal.any([signal, createBackgroundNetworkDeadlineSignal()])", "post-reading background bridge must honor queue cancellation and response-read deadlines for public full-quote fetches");
  if (/url\.pathname\s*===\s*["']\/home["']|abs\.twimg\.com|endsWith\(["']\.twimg\.com["']\)|responsive-web\/client-web/.test(postReadingBackground)) {
    fail("post-reading background bridge must not fetch active X shell or script bundles for full-quote discovery");
  }
  requireIncludes(background, "sender.id !== chrome.runtime.id", "Wiki Sidebar frame bridge must validate same-extension sender id");
  requireIncludes(background, "typeof sender.frameId !== \"number\" || sender.frameId <= 0", "Wiki Sidebar frame bridge must require a non-top-frame sender");
  requireIncludes(reminetChatBackground, "isReminetChatSocketSender", "RemiNet Chat socket port bridge must validate sender");
  requireIncludes(reminetChatBackground, "isReminetChatMessageSender", "RemiNet Chat runtime bridge must validate sender");
  requireIncludes(reminetChatBackground, "UNSUPPORTED_SENDER", "RemiNet Chat runtime bridge must fail closed for unsupported senders");
  requireIncludes(reminetChatBackground, "sender.id !== chrome.runtime.id", "RemiNet Chat socket port bridge must validate same-extension sender id");
  requireIncludes(beetolBackground, "isBeetolMessageSender", "Beetol runtime bridge must validate sender");
  requireIncludes(beetolBackground, "UNSUPPORTED_SENDER", "Beetol runtime bridge must fail closed for unsupported senders");
  requireIncludes(beetolBackground, "sender.id !== chrome.runtime.id", "Beetol runtime bridge must validate same-extension sender id");
  const postReading = registry.find((app) => app.id === "post-reading");
  const ttsEngine = (postReading?.settings || []).find((setting) => setting.id === "post-reading.ttsEngine");
  if (!ttsEngine?.control?.options?.some((option) => option.value === "custom-http")) {
    fail("post-reading.ttsEngine must declare the runtime custom-http TTS engine option");
  }
  const customEndpoint = (postReading?.settings || []).find((setting) => setting.id === "post-reading.customTtsEndpoint");
  if (!customEndpoint?.requires?.includes("post-reading.ttsEngine:custom-http")) {
    fail("post-reading.customTtsEndpoint must require post-reading.ttsEngine:custom-http");
  }
  requireIncludes(postReadingTtsEngines, "normalizeLocalTtsEndpoint", "custom HTTP TTS must normalize and validate endpoints before fetch");
  requireIncludes(postReadingTtsEngines, "normalizeLocalTtsAudioUrl", "custom HTTP TTS must validate returned audio URLs before playback");
  requireIncludes(postReadingTtsEngines, "http://localhost, http://127.0.0.1, or http://[::1]", "custom HTTP TTS must be restricted to local loopback endpoints");
  requireIncludes(postReadingTtsEngines, "url.username || url.password", "custom HTTP TTS loopback URLs must reject embedded credentials");
  requireIncludes(postReadingTtsEngines, "MAX_CUSTOM_TTS_AUDIO_BYTES", "custom HTTP TTS audioBase64 responses must have a byte cap");
  requireIncludes(postReadingTtsEngines, "CUSTOM_TTS_AUDIO_TYPES", "custom HTTP TTS audioBase64 responses must restrict audio content types");
}

async function verifyFeatureOwnership() {
  const forbiddenGeneratedSettingsImports = /from\s+["'][^"']*features\//;
  if (forbiddenGeneratedSettingsImports.test(contentRuntime)) {
    fail("generated Apps & Features settings renderer must not import app/feature bundles");
  }
  const featureFiles = featureContentFiles("src/apps");
  for (const file of featureFiles) {
    const source = await readFile(file, "utf8");
    if (source.includes("subscribeTwitterSurfaces")) fail(`${file}: feature bundle must not own scanner subscription`);
    if (/\bvoid\s+boot\s*\(/.test(source) && /src[\\/]features[\\/]wiki[\\/](options|popup)\.ts$/.test(file) === false) {
      fail(`${file}: feature content bundle must not self-boot`);
    }
  }
  for (const file of featureSourceFiles("src/apps")) {
    const source = await readFile(file, "utf8");
    const directMessageWarning = directRuntimeBridgeWarning(null, file, source, "message");
    if (directMessageWarning) warn(directMessageWarning);
    if (/safeRuntimeMessage(?:<[^>]+>)?\s*\(/.test(source)) {
      warn(`${file}: transitional/internal safeRuntimeMessage bypasses App SDK sender metadata; keep fallback scope documented or migrate`);
    }
    const portWarning = directRuntimeBridgeWarning(null, file, source, "port");
    if (portWarning) warn(portWarning);
  }
}

function directRuntimeBridgeWarning(appId, file, source, kind) {
  const normalized = normalizePosix(file);
  if (kind === "message") {
    if (!/chrome\.runtime\.sendMessage\s*\(/.test(source)) return null;
    if (normalized.endsWith("src/extension/frames/ocr-host.ts")) {
      return `${file}: intentionally internal OCR frame bridge; background restricts post-reading:fetchBlob to the packaged ocr.html sender`;
    }
    if (normalized.endsWith("src/apps/wiki-sidebar/frameContent.ts")) {
      return `${file}: intentionally internal Wiki iframe bridge; background restricts wikiSidebar:* messages to same-extension non-top wiki frame senders`;
    }
    const label = appId || file;
    return `${label}: transitional/internal direct chrome.runtime.sendMessage usage bypasses App SDK sender metadata; keep documented or migrate to context.sendMessage`;
  }
  if (!/chrome\.runtime\.connect\s*\(/.test(source)) return null;
  if (normalized.endsWith("src/apps/reminet-chat/content.ts")) {
    return `${file}: intentionally internal RemiNet Chat socket bridge; background restricts runtime.connect to same-extension top-frame X/Twitter senders`;
  }
  const label = appId || file;
  return `${label}: transitional/internal chrome.runtime.connect port bypasses App SDK message metadata; keep scoped to documented streaming bridges`;
}

async function resolveEntrySource(entryPoint) {
  const entry = await readFile(entryPoint, "utf8");
  const exportMatches = Array.from(entry.matchAll(/export\s+\*\s+from\s+["']([^"']+)["']/g));
  const exportAll = exportMatches.find((match) => /\/content(?:\.[jt]s)?$/.test(match[1]));
  if (!exportAll) return entryPoint;
  const target = exportAll[1];
  if (/\.[cm]?[jt]s$/.test(target)) {
    const withExtension = path.normalize(path.join(path.dirname(entryPoint), target));
    return existsSync(withExtension) ? withExtension : withExtension.replace(/\.js$/, ".ts");
  }
  const resolved = path.normalize(path.join(path.dirname(entryPoint), `${target}.ts`));
  if (existsSync(resolved)) return resolved;
  const jsResolved = path.normalize(path.join(path.dirname(entryPoint), `${target}.js`));
  return existsSync(jsResolved) ? jsResolved : resolved;
}

function lifecycleExports(source) {
  const names = new Set();
  const regex = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
  for (const match of source.matchAll(regex)) names.add(match[1]);
  return names;
}

function backgroundMessageTypes(source) {
  return Array.from(source.matchAll(/type:\s*["']([^"']+)["']\s*,\s*[\r\n]+\s*matches:/g), (match) => match[1])
    .filter((type) => !type.includes("${"))
    .sort();
}

function messageTypeCovered(pattern, actualTypes) {
  return actualTypes.some((type) => messageTypeMatches(pattern, type) || messageTypeMatches(type, pattern));
}

function messageTypeMatches(pattern, type) {
  if (pattern.endsWith(":*")) return type.startsWith(pattern.slice(0, -1));
  return pattern === type;
}

function isCoreBackgroundMessage(type) {
  return type.startsWith("milxdy:") || type === "reminetIdentity:getProfile";
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

function featureSourceFiles(root) {
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...featureSourceFiles(file));
    else if (/\.[cm]?[jt]s$/.test(entry.name)) files.push(file);
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

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function normalizePosix(value) {
  return value.replaceAll("\\", "/");
}

function requireIncludes(source, needle, message) {
  if (!source.includes(needle)) fail(message);
}

function fail(message) {
  failures.push(message);
}

function warn(message) {
  if (!warnings.includes(message)) warnings.push(message);
}

function printResults() {
  console.log("App SDK compliance verification");
  console.log(`  apps checked: ${Array.isArray(registry) ? registry.length : 0}`);
  if (warnings.length > 0) {
    console.log(`  warnings: ${warnings.length}`);
    for (const message of warnings) console.log(`  - ${message}`);
  } else {
    console.log("  warnings: none");
  }
  if (failures.length > 0) {
    console.error(`  failures: ${failures.length}`);
    for (const message of failures) console.error(`  - ${message}`);
  } else {
    console.log("  failures: none");
    console.log("App SDK compliance verification passed.");
  }
}
