import { readFile } from "node:fs/promises";

const registry = JSON.parse(await readFile("src/shared/firstPartyApps.json", "utf8"));
const files = {
  roadmap: await readFile("docs/ROADMAP.md", "utf8"),
  releaseNotes: await readFile("docs/RELEASE_NOTES_0.2.0.md", "utf8"),
  qa: await readFile("docs/QA_0.2.0.md", "utf8"),
  qaLog: await readFile("docs/QA_LOG_0.2.0.md", "utf8"),
  chromeLiveQa: await readFile("docs/CHROME_LIVE_QA_0.2.0.md", "utf8"),
  releases: await readFile("docs/RELEASES.md", "utf8"),
  readme: await readFile("README.md", "utf8"),
  packageJson: await readFile("package.json", "utf8"),
  manifest: await readFile("public/manifest.json", "utf8"),
  firstPartyApps: await readFile("src/shared/firstPartyApps.ts", "utf8"),
  userGuide: await readFile("docs/USER_GUIDE.md", "utf8"),
  installAndUpdate: await readFile("docs/INSTALL_AND_UPDATE.md", "utf8"),
  appSdk: await readFile("docs/APP_SDK.md", "utf8"),
  privacy: await readFile("docs/PRIVACY_AND_PERMISSIONS.md", "utf8"),
  troubleshooting: await readFile("docs/TROUBLESHOOTING.md", "utf8"),
  changelog: await readFile("CHANGELOG.md", "utf8"),
  background: await readFile("src/background.ts", "utf8"),
  contentRuntime: await readFile("src/shared/contentRuntime.ts", "utf8"),
  extensionRuntime: await readFile("src/shared/extensionRuntime.ts", "utf8"),
  updateCheck: await readFile("src/shared/updateCheck.ts", "utf8"),
  popup: await readFile("src/popup.ts", "utf8"),
  overlayDock: await readFile("src/shared/overlayDock.ts", "utf8"),
  remistatsBackground: await readFile("src/features/remistats/background.js", "utf8"),
  reminetBackground: await readFile("src/features/reminetChat/background.ts", "utf8"),
  wikiContent: await readFile("src/features/wiki/content.ts", "utf8"),
  wikiPreview: await readFile("src/features/wiki/preview.ts", "utf8"),
  wikiSidebar: await readFile("src/features/wikiSidebar/content.ts", "utf8"),
  packageRelease: await readFile("scripts/package-release.mjs", "utf8"),
  appSmokeVerifier: await readFile("scripts/verify-app-smoke-020.mjs", "utf8"),
  liveSmokeProbe: await readFile("scripts/live-smoke-probe-020.js", "utf8"),
  liveSmokeProbePrinter: await readFile("scripts/print-live-smoke-probe-020.mjs", "utf8"),
  liveSmokeProbeLogVerifier: await readFile("scripts/verify-live-probe-log-020.mjs", "utf8"),
  releaseGateVerifier: await readFile("scripts/verify-release-gates-020.mjs", "utf8"),
  build: await readFile("scripts/build.mjs", "utf8"),
  buildProfiles: await readFile("scripts/build-profiles.mjs", "utf8"),
  releaseBuilds: await readFile("scripts/release-builds.mjs", "utf8"),
  releaseRegistry: await readFile("scripts/release-registry.mjs", "utf8"),
  releaseChecksumVerifier: await readFile("scripts/verify-release-checksums.mjs", "utf8"),
  urlAllowlistVerifier: await readFile("scripts/verify-url-allowlist.mjs", "utf8"),
};

verifyRoadmapAndReleaseNotes();
verifyDocsCoverage();
verifyDocumentedNpmScripts();
verifyRegistryCoverage();
verifyBackgroundSecurityContract();
verifyWikiSidebarContract();

console.log("0.2.0 release verification passed.");

function verifyRoadmapAndReleaseNotes() {
  assert(files.roadmap.includes("## Released: 0.2.0 - The Platform Update"), "roadmap must mark 0.2.0 as released");
  assert(files.changelog.includes("docs/RELEASE_NOTES_0.2.0.md"), "changelog must link 0.2.0 release notes");
  assert(files.changelog.includes("verify:release:gates:020") && files.changelog.includes("Non-live release gates"), "changelog must summarize the current 0.2.0 non-live gate status");
  assert(files.changelog.includes("Live Chrome/X runtime proof is optional manual QA") && files.changelog.includes("not part of the release readiness gate"), "changelog must keep live browser QA optional for 0.2.0 readiness");
  assert(files.changelog.includes("Remilia Wiki sidebar") && files.changelog.includes("Miladychan Portal") && files.changelog.includes("Music MVP"), "changelog must summarize 0.2.0 app-surface highlights");
  assert(JSON.parse(files.packageJson).version === "0.2.0", "package.json version must be 0.2.0");
  assert(JSON.parse(files.manifest).version === "0.2.0", "public manifest version must be 0.2.0");
  for (const section of [
    "Implemented Platform Work",
    "Remilia Wiki Sidebar",
    "Miladychan Portal",
    "Music",
    "Documentation",
    "Verification",
  ]) {
    assert(files.releaseNotes.includes(`## ${section}`) || files.releaseNotes.includes(`### ${section}`), `0.2.0 release notes missing ${section}`);
  }
}

function verifyDocsCoverage() {
  for (const phrase of [
    "Apps Hub And Side Rail",
    "Platform Performance Modes",
    "Remilia Wiki Sidebar",
    "Miladychan Portal",
    "Music",
  ]) {
    assert(files.userGuide.includes(phrase), `user guide missing ${phrase}`);
  }
  for (const phrase of [
    "Background Services",
    "urlAllowlist.ts",
    "Future GitHub App Store Path",
    "Apps Hub And Rail Pinning",
  ]) {
    assert(files.appSdk.includes(phrase), `App SDK missing ${phrase}`);
  }
  for (const phrase of [
    "Miladychan Portal",
    "Music",
    "MusicBrainz",
    "AcoustID",
    "boards.miladychan.org",
  ]) {
    assert(files.privacy.includes(phrase), `privacy docs missing ${phrase}`);
  }
  for (const phrase of [
    "Apps rail is missing",
    "Pinned app is missing from the rail",
    "Miladychan Portal does not load boards",
    "Music cannot add a folder",
    "Playlist or radio QR import fails",
  ]) {
    assert(files.troubleshooting.includes(phrase), `troubleshooting missing ${phrase}`);
  }
  for (const phrase of [
    "Automated Gates",
    "Apps Hub And Rail",
    "Performance Modes",
    "Miladychan Portal",
    "Music",
    "Background Security",
    "Release Metadata",
  ]) {
    assert(files.qa.includes(`## ${phrase}`), `0.2.0 QA checklist missing ${phrase}`);
  }
  assert(files.qa.includes("npm run verify:release:gates:020"), "0.2.0 QA checklist must include the canonical non-live release gate runner");
  assert(files.qa.includes("canonical release readiness gate") && files.qa.includes("live Chrome proof is optional manual QA evidence"), "0.2.0 QA checklist must keep live Chrome proof optional outside release readiness");
  assert(files.releases.includes("npm run verify:release:gates:020") && files.releases.includes("npm.cmd run verify:release:gates:020"), "release process must use the canonical non-live release gate runner");
  assert(files.releases.includes("Keep live Chrome proof separate and optional"), "release process must keep the live Chrome gate optional outside release readiness");
  assert(files.releases.includes("dist/chromium-lite") && files.releases.includes("dist/firefox-balanced"), "release process must document profile build output directories");
  assert(files.qa.includes("extension smoke") && files.qa.includes("app smoke"), "0.2.0 QA checklist must describe smoke checks covered by the non-live gate runner");
  assert(files.qa.includes("URL allowlist checks"), "0.2.0 QA checklist must describe URL allowlist coverage in the non-live gate runner");
  assert(files.qa.includes("release packaging") && files.qa.includes("checksum verification"), "0.2.0 QA checklist must describe release archive packaging and checksum coverage in the non-live gate runner");
  assert(files.qa.includes("reproducible archive verification"), "0.2.0 QA checklist must describe reproducible archive verification in the non-live gate runner");
  assert(files.qa.includes("Apps Hub runtime summary"), "0.2.0 QA checklist must include Apps Hub runtime summary smoke coverage");
  assert(files.qa.includes("rail support, privacy labels, remote services"), "0.2.0 QA checklist must include Apps Hub disclosure metadata smoke coverage");
  assert(files.qa.includes("Open an app card's Details view"), "0.2.0 QA checklist must include Apps Hub detail disclosure smoke coverage");
  assert(files.qa.includes("Click **Skip**") && files.qa.includes("conservative defaults") && files.qa.includes("Milady Maxxer remain disabled"), "0.2.0 QA checklist must cover first-run Skip conservative defaults");
  assert(files.packageJson.includes('"build:profiles"'), "package scripts must include build:profiles");
  assert(files.packageJson.includes('"verify:release:checksums"'), "package scripts must include verify:release:checksums");
  assert(files.packageJson.includes('"verify:release:reproducible"'), "package scripts must include verify:release:reproducible");
  assert(files.packageJson.includes('"verify:release:gates:020"'), "package scripts must include the 0.2.0 non-live release gate runner");
  assert(files.packageJson.includes('"print:live-probe:020"'), "package scripts must include live probe printer");
  assert(files.packageJson.includes('"verify:live-probe:020"'), "package scripts must include live probe log verifier");
  assert(files.packageJson.includes('"verify:app-smoke:020"'), "package scripts must include 0.2.0 app smoke verifier");
  assert(files.packageJson.includes('"verify:music"'), "package scripts must include music build verifier");
  assert(files.packageJson.includes('"verify:smoke:020"'), "package scripts must include verify:smoke:020");
  assert(files.packageJson.includes('"verify:url-allowlist"'), "package scripts must include verify:url-allowlist");
  assert(files.packageJson.includes('"package:release"'), "package scripts must include package:release");
  assert(files.releaseNotes.includes("build:profiles"), "0.2.0 release notes must mention profile matrix build script");
  assert(files.releaseNotes.includes("verify:release:gates:020"), "0.2.0 release notes must mention the canonical non-live release gate runner");
  assert(files.releaseNotes.includes("verify:smoke:020"), "0.2.0 release notes must mention smoke verifier");
  assert(files.releaseNotes.includes("verify:url-allowlist"), "0.2.0 release notes must mention URL allowlist verifier");
  assert(files.releaseNotes.includes("package:release"), "0.2.0 release notes must mention release packaging");
  assert(files.releaseNotes.includes("verify:release:checksums"), "0.2.0 release notes must mention checksum verifier");
  assert(files.releaseNotes.includes("verify:release:reproducible"), "0.2.0 release notes must mention reproducible release verifier");
  assert(files.releaseNotes.includes("verify:app-smoke:020"), "0.2.0 release notes must mention app smoke verifier");
  assert(files.releaseNotes.includes("print:live-probe:020"), "0.2.0 release notes must mention live probe printer");
  assert(files.releaseNotes.includes("verify:live-probe:020"), "0.2.0 release notes must mention live probe log verifier");
  assert(files.releaseNotes.includes("checksums.sha256"), "0.2.0 release notes must mention checksum manifest");
  assert(files.releaseNotes.includes("QA_LOG_0.2.0.md"), "0.2.0 release notes must link QA evidence log");
  assert(files.releaseNotes.includes("CHROME_LIVE_QA_0.2.0.md"), "0.2.0 release notes must link Chrome live QA guide");
  const privateMediaPlanningDoc = "RELEASE_" + "SCREENSHOTS_0.2.0.md";
  assert(!files.releaseNotes.includes(privateMediaPlanningDoc), "0.2.0 release notes must not link nonpublic planning docs");
  assert(files.readme.includes("npm run build:profiles") && files.readme.includes("dist/chromium-balanced") && !files.readme.includes("npm run build:all"), "README source-build instructions must use the 0.2.0 profile matrix");
  assert(files.readme.includes("milXdy-<version>-chromium-full.zip") && files.readme.includes("milXdy-<version>-chromium-balanced.zip") && files.readme.includes("milXdy-<version>-chromium-lite.zip"), "README release install instructions must name profile-specific Chromium archives");
  assert(files.readme.includes("firefox-full") && files.readme.includes("firefox-balanced") && files.readme.includes("firefox-lite"), "README release install instructions must name profile-specific Firefox archives");
  assert(files.userGuide.includes("Apps Hub And Side Rail"), "user guide must cover the 0.2.0 Apps Hub surface");
  assert(files.userGuide.includes("Skipping keeps the conservative fresh-install defaults") && files.userGuide.includes("Music, Miladychan Portal, Beetol, RemiNet Chat, and Milady Maxxer"), "user guide must document conservative first-run Skip defaults");
  assert(files.userGuide.includes("matching GitHub prerelease zip") && files.userGuide.includes("target/profile"), "user guide update workflow must describe target/profile-aware downloads");
  assert(files.releases.includes("npm run verify:release:gates:020"), "release process must document the canonical non-live gate runner");
  assert(files.releases.includes("SOURCE_DATE_EPOCH") && files.releases.includes("npm run verify:release:reproducible"), "release process must document deterministic release archive reproduction");
  assert(files.troubleshooting.includes("dist/chromium") && files.troubleshooting.includes("dist/firefox"), "troubleshooting must point users at generated browser output directories");
  assert(files.installAndUpdate.includes("npm run build:profiles") && files.installAndUpdate.includes("dist/chromium-balanced") && !files.installAndUpdate.includes("npm run build:all"), "install/update source instructions must use the 0.2.0 profile matrix");
  assert(files.installAndUpdate.includes("milXdy-<version>-chromium-full.zip") && files.installAndUpdate.includes("milXdy-<version>-firefox-balanced.zip"), "install/update release instructions must name profile-specific archives");
  assert(files.installAndUpdate.includes("popup prefers the archive matching the installed browser target and build profile"), "install/update docs must describe target/profile-aware popup downloads");
  assert(files.qa.includes("checksums.sha256"), "0.2.0 QA checklist must include checksum manifest");
  assert(files.qa.includes("checksum verification"), "0.2.0 QA checklist must include checksum verifier coverage");
  assert(files.qa.includes("app smoke"), "0.2.0 QA checklist must include app smoke verifier coverage");
  assert(files.qa.includes("CHROME_LIVE_QA_0.2.0.md"), "0.2.0 QA checklist must link Chrome live QA guide");
  assert(files.qa.includes("npm run verify:live-probe:020"), "0.2.0 QA checklist must include live probe log verifier");
  assert(files.qa.includes("npm run print:live-probe:020") && files.qa.includes("window.__milxdy020LiveProbe"), "0.2.0 QA checklist must include live probe workflow");
  assert(!files.qa.includes(privateMediaPlanningDoc), "0.2.0 QA checklist must not link nonpublic planning docs");
  assert(files.qaLog.includes("Live Chrome Probe"), "0.2.0 QA evidence log must record live Chrome probe status");
  assert(files.qaLog.includes("#milxdy-overlay-dock-root"), "0.2.0 QA evidence log must record overlay dock probe marker");
  assert(files.qaLog.includes("missing loaded 0.2.0 runtime"), "0.2.0 QA evidence log must record current live smoke blocker");
  assert(files.qaLog.includes("live Chrome runtime smoke is optional manual QA") && files.qaLog.includes("not part of the 0.2.0 release readiness gate"), "0.2.0 QA evidence log must mark live Chrome proof optional");
  assert(files.qaLog.includes("release/milXdy-0.2.0-checksums.sha256"), "0.2.0 QA evidence log must record checksum manifest artifact");
  assert(files.qaLog.includes("CHROME_LIVE_QA_0.2.0.md"), "0.2.0 QA evidence log must link Chrome live QA guide");
  assert(files.qaLog.includes("npm run verify:live-probe:020"), "0.2.0 QA evidence log must mention live probe log verifier");
  assert(files.qaLog.includes("npm run verify:music"), "0.2.0 QA evidence log must use the package music verifier command");
  assert(!files.qaLog.includes("npm run verify:music-build"), "0.2.0 QA evidence log must not reference a non-existent music npm script");
  assert(files.qaLog.includes("npm run print:live-probe:020") && files.qaLog.includes("scripts/live-smoke-probe-020.js"), "0.2.0 QA evidence log must document live probe tooling");
  assert(!files.qaLog.includes("## Release " + "Screenshot Evidence"), "0.2.0 QA evidence log must not include nonpublic planning status");
  for (const marker of [
    "#milxdy-overlay-dock-root",
    "#milxdy-app-hub-panel",
    ".milxdy-app-hub-runtime",
    ".milxdy-app-hub-runtime-state",
    "#milxdy-wiki-sidebar-root",
    "milxdyPerformanceMode",
    "milxdyVersion",
    "milxdyBuildProfile",
    "milxdyBuildTarget",
    "__milxdy020LiveProbe",
  ]) {
    assert(files.liveSmokeProbe.includes(marker), `live smoke probe missing ${marker}`);
  }
  assert(files.liveSmokeProbe.includes("missingRequired") && files.liveSmokeProbe.includes("Reload the unpacked 0.2.0 build"), "live smoke probe must report missing runtime markers and remediation");
  assert(files.liveSmokeProbePrinter.includes("scripts/live-smoke-probe-020.js"), "live smoke probe printer must emit the shared probe file");
  assert(files.liveSmokeProbeLogVerifier.includes("extractLatestProbe") && files.liveSmokeProbeLogVerifier.includes('status === "passed"') && files.liveSmokeProbeLogVerifier.includes('version === "0.2.0"'), "live probe log verifier must parse QA log and require a passed 0.2.0 probe");
  assert(!files.liveSmokeProbeLogVerifier.includes("appHubRuntime === true") && !files.liveSmokeProbeLogVerifier.includes("counts?.appHubRuntime"), "live probe log verifier must not require Apps Hub panel-only markers for baseline runtime proof");
  assert(files.releaseGateVerifier.includes("node_modules/typescript/bin/tsc") && files.releaseGateVerifier.includes("scripts/build-profiles.mjs"), "0.2.0 gate runner must typecheck and rebuild profile outputs");
  assert(files.releaseGateVerifier.includes("node_modules/web-ext/bin/web-ext.js") && files.releaseGateVerifier.includes('"dist/firefox"'), "0.2.0 gate runner must run Firefox lint through the local web-ext dependency");
  assert(files.updateCheck.includes("expectedReleaseAssetName") && files.updateCheck.includes("MILXDY_BUILD_TARGET") && files.updateCheck.includes("MILXDY_BUILD_PROFILE"), "update checker must derive profile-specific release archive names from build metadata");
  assert(files.updateCheck.includes("matchedExpectedAsset") && files.updateCheck.includes("expectedAssetName"), "update checker must report whether it found the exact target/profile archive");
  assert(files.popup.includes("matchedExpectedAsset") && files.popup.includes("Expected archive"), "popup update UI must disclose target/profile archive matching");
  for (const gate of [
    "scripts/verify-release-020.mjs",
    "scripts/verify-platform.mjs",
    "scripts/verify-url-allowlist.mjs",
    "scripts/verify-music-build.mjs",
    "scripts/verify-extension-smoke-020.mjs",
    "scripts/verify-app-smoke-020.mjs",
    "scripts/package-release.mjs",
    "scripts/verify-release-checksums.mjs",
    "scripts/verify-reproducible-release.mjs",
  ]) {
    assert(files.releaseGateVerifier.includes(gate), `0.2.0 gate runner missing ${gate}`);
  }
  assert(!files.releaseGateVerifier.includes("scripts/verify-live-probe-log-020.mjs"), "0.2.0 gate runner must keep live Chrome proof as a separate manual/browser gate");
  assert(files.wikiSidebar.includes('const WIKI_ICON_PATH = "wikiSidebar/remilia-wiki-favicon.png"') && files.wikiSidebar.includes("milxdy-wiki-sidebar-logo") && files.wikiSidebar.includes("wikiIconUrl()"), "wiki sidebar must use the packaged wiki icon in its frame and header");
  assert(files.wikiSidebar.includes('label: APP_LABEL') && files.wikiSidebar.includes('icon: wikiIconUrl()'), "wiki sidebar app frame must use the shared wiki label and packaged icon");
  assert(files.wikiSidebar.includes('iconButton("Home", "home"') && files.wikiSidebar.includes('iconButton("Refresh", "refresh"'), "wiki sidebar must use familiar icon controls for home and refresh");
  assert(files.wikiSidebar.includes('iconButton("Open in new tab", "external"'), "wiki sidebar open-in-new-tab control must use an up-right arrow affordance");
  assert(files.wikiSidebar.includes('const APP_LABEL = "Remilia Wiki"'), "wiki sidebar must keep the rail tooltip label aligned with the 0.2.0 spec");
  assert(files.wikiSidebar.includes('document.createElement("iframe")') && files.wikiSidebar.includes("iframe.src = embeddedWikiUrl(state.currentUrl)"), "wiki sidebar must render the live wiki iframe rather than the API fallback renderer");
  assert(files.wikiSidebar.includes('url.searchParams.set("useskin", "minerva")') && files.wikiSidebar.includes('url.searchParams.set("mobileaction", "toggle_view_mobile")'), "wiki sidebar iframe must request the mobile-friendly wiki skin");
  assert(files.wikiSidebar.includes("milxdy-wiki-sidebar-fallback") && files.wikiSidebar.includes("Open page"), "wiki sidebar must include compact fallback actions when embedding is slow or blocked");
  assert(files.wikiSidebar.includes("chrome.runtime.getURL(WIKI_ICON_PATH)"), "wiki sidebar icon URL must resolve through extension runtime assets");
  assert(files.wikiSidebar.includes("milxdy-wiki-sidebar-title-text"), "wiki sidebar header must keep icon and text layout stable");
  assert(files.wikiSidebar.includes("object-fit: cover"), "wiki sidebar icon style must crop safely in the fixed header slot");
  assert(files.wikiSidebar.includes("wikiSidebar/remilia-wiki-favicon.png"), "wiki sidebar source must reference the packaged wiki icon path");
  assert(files.wikiSidebar.includes("alt = \"\""), "wiki sidebar decorative icon must not duplicate the header label for screen readers");
  assert(files.wikiSidebar.includes("decoding = \"async\""), "wiki sidebar icon should decode asynchronously");
  assert(files.wikiSidebar.includes("state.frame?.updateDock({ active: true"), "wiki sidebar must focus the shared dock item when opened");
  assert(files.wikiSidebar.includes("state.frame?.updateDock({ active: false"), "wiki sidebar must clear active dock state when closed");
  assert(files.wikiSidebar.includes("state.frame?.setSide(state.side)"), "wiki sidebar must restore the shared frame side from stored state");
  assert(files.wikiSidebar.includes("restoreOverlayPanelBox") && files.wikiSidebar.includes('appId: "wikiSidebar"'), "wiki sidebar must restore and persist through the shared freeform overlay layout manager");
  assert(files.wikiSidebar.includes("clampOverlayPanelBox"), "wiki sidebar must use shared overlay panel layout bounds");
  assert(files.wikiSidebar.includes("startOverlayPanelDrag") && files.wikiSidebar.includes("startOverlayPanelResize"), "wiki sidebar must reuse shared overlay drag and resize behavior");
  assert(files.wikiSidebar.includes("observeOverlayPanelTheme") && files.wikiSidebar.includes("resolveOverlayPanelTheme"), "wiki sidebar must reuse shared overlay theme behavior");
  assert(files.wikiSidebar.includes("await chrome.storage.local.set({ [LAST_URL_KEY]: url })"), "wiki sidebar must persist the latest valid wiki URL");
  assert(files.wikiSidebar.includes("normalizeWikiUrl(stored[LAST_URL_KEY]) || HOME_URL"), "wiki sidebar must restore the latest valid wiki URL or fallback to the homepage");
  assert(files.wikiSidebar.includes("iframe.sandbox.add") && files.wikiSidebar.includes("allow-top-navigation-by-user-activation"), "wiki sidebar iframe sandbox must allow normal user-initiated wiki navigation escapes");
  assert(files.wikiSidebar.includes("window.open(state.currentUrl, \"_blank\", \"noopener,noreferrer\")"), "wiki sidebar open-in-tab control must use noopener and noreferrer");
  assert(files.wikiSidebar.includes("void openWikiUrl(detail?.url)") && files.wikiSidebar.includes("milxdy:wiki-sidebar-open"), "wiki sidebar event fallback must route requested URLs through validation");
  assert(files.contentRuntime.includes("milxdy-app-hub-icon-img") && files.contentRuntime.includes("runtimeAssetUrl(app.dock.icon)") && files.contentRuntime.includes("image.decoding = \"async\""), "Apps Hub cards must render registry-provided app icons");
  assert(files.contentRuntime.includes("appHubMetadataNotes") && files.contentRuntime.includes("milxdy-app-hub-note") && files.contentRuntime.includes("privacyLabels") && files.contentRuntime.includes("remoteServices"), "Apps Hub cards must render registry-driven cost, rail, privacy, and remote-service metadata");
  assert(files.contentRuntime.includes("appHubDetails") && files.contentRuntime.includes("milxdy-app-hub-details") && files.contentRuntime.includes("appHubDetailRow") && files.contentRuntime.includes("storageKeySummary"), "Apps Hub cards must provide registry-driven detail disclosure");
  for (const detailLabel of ["Does", "Performance", "Loads", "Data", "Permissions", "Storage", "Build"]) {
    assert(files.contentRuntime.includes(`appHubDetailRow("${detailLabel}"`), `Apps Hub detail disclosure missing ${detailLabel}`);
  }
  assert(files.extensionRuntime.includes("safeLocalRemove") && files.extensionRuntime.includes("safeSyncRemove"), "extension runtime must expose safe storage removal helpers");
  assert(files.contentRuntime.includes("resetAppSettings") && files.contentRuntime.includes("hasResettableStorage") && files.contentRuntime.includes("appStorageKeys"), "Apps Hub must expose registry-driven reset settings controls");
  assert(files.contentRuntime.includes("safeLocalRemove(keys.local)") && files.contentRuntime.includes("safeSyncRemove(keys.sync)") && files.contentRuntime.includes("hub.reset.${app.id}"), "Apps Hub reset must remove declared local/sync keys and record reset diagnostics");
  assert(files.contentRuntime.includes("reset.title = \"Reset app settings\"") && files.contentRuntime.includes("resetAppSettings(app)"), "Apps Hub cards must provide a user-facing reset settings action");
  assert(files.contentRuntime.includes("loadedHeavyApps") && files.contentRuntime.includes("loadedWorkerHeavyApps") && files.contentRuntime.includes("loadedNetworkApps") && files.contentRuntime.includes("loadedAppsByCost"), "runtime diagnostics must expose registry-derived heavy, worker-heavy, and network app lists");
  assert(files.popup.includes("milxdy.diagnostics.runtime") && files.popup.includes("loadedHeavyApps") && files.popup.includes("loadedWorkerHeavyApps") && files.popup.includes("loadedNetworkApps"), "popup Health diagnostics must consume shared runtime app diagnostics");
  assert(files.popup.includes("MILXDY_BUILD_TARGET") && files.popup.includes("Build: ${BUILD_TARGET}/${BUILD_PROFILE}") && files.popup.includes("v${version} ${BUILD_TARGET}/${BUILD_PROFILE}"), "bug report templates must include build target/profile metadata");
  assert(files.overlayDock.includes("OverlayDockSettingsAction") && files.overlayDock.includes("setSettingsAction") && files.overlayDock.includes("settingsActionButton"), "overlay dock must expose reusable settings actions");
  assert(files.contentRuntime.includes('setSettingsAction("milxdy.addApps"') && files.contentRuntime.includes('label: "Add Apps"') && files.contentRuntime.includes("onActivate: openHubPanel"), "dock settings must include an Add Apps route into the Apps Hub");
  assert(files.contentRuntime.includes('setSettingsAction("milxdy.addApps", null)'), "runtime dispose must unregister the Add Apps dock settings action");
  assert(files.build.includes("contents: JSON.stringify(registryApps)"), "profile builds must keep full app metadata for unavailable-app Hub cards");
  assert(files.contentRuntime.includes("app.available === false") && files.contentRuntime.includes("milxdy-app-hub-unavailable") && files.contentRuntime.includes("Unavailable in this build"), "Apps Hub must show unavailable apps with a clear build-profile explanation");
  assert(files.contentRuntime.includes("build:unavailable") && files.contentRuntime.includes("available: app.available !== false"), "runtime diagnostics must distinguish unavailable build-profile apps");
  assert(files.firstPartyApps.includes("setEnabled: available ? setEnabled : undefined") && files.firstPartyApps.includes("isEnabled: available ? isEnabled : async () => false"), "unavailable apps must not expose enablement controls or report enabled state");
  assert(files.firstPartyApps.includes("defaultEnabledById") && files.firstPartyApps.includes("defaultAppEnabled") && files.firstPartyApps.includes("enabledFromStoredValue"), "first-party enablement adapters must use registry defaultEnabled metadata for fallback state");
  assert(files.background.includes("chrome.runtime.onInstalled.addListener") && files.background.includes('"milxdy.apps.firstRun.status": "pending"'), "central background must own fresh-install Apps Hub defaults");
  for (const freshInstallDefault of [
    '"milxdy.miladychan.enabled": false',
    '"milxdy.music.enabled": false',
    '"milxdy.reminetChat.enabled": false',
    '"milxdy.remistats.beetol.enabled": false',
    'mode: "off"',
  ]) {
    assert(files.background.includes(freshInstallDefault), `central background missing conservative first-run default: ${freshInstallDefault}`);
  }
  assert(!files.remistatsBackground.includes("chrome.runtime.onInstalled.addListener"), "RemiStats must not duplicate central install default seeding");
  assert(files.appSmokeVerifier.includes("Miladychan Portal") && files.appSmokeVerifier.includes("createRadioSession") && files.appSmokeVerifier.includes("features/chromaprint.wasm"), "app smoke verifier must cover Miladychan Portal and Music MVP contracts");
  for (const phrase of [
    "chrome://extensions",
    "dist/chromium",
    "window.__milxdy020LiveProbe",
    'status: "passed"',
    'version: "0.2.0"',
    'buildTarget: "chromium"',
    "missingRequired",
    "Keep promotional planning outside this public QA guide",
  ]) {
    assert(files.chromeLiveQa.includes(phrase), `Chrome live QA guide missing ${phrase}`);
  }
  assert(files.packageRelease.includes("milXdy-${version}-${build.target}-${build.profile}.zip"), "release packaging must use deterministic profile archive names");
  assert(files.packageRelease.includes("createDeterministicZip"), "release packaging must use the deterministic Node zip writer");
  assert(files.packageRelease.includes("writeChecksumManifest") && files.packageRelease.includes("verifyReleaseChecksums"), "release packaging must generate and verify checksum manifest");
  assert(files.releaseChecksumVerifier.includes("createHash") && files.releaseChecksumVerifier.includes("sha256") && files.releaseChecksumVerifier.includes("releaseBuilds"), "checksum verifier must hash release archives from the shared build matrix");
  assert(files.packageRelease.includes("manifest.json"), "release packaging must verify manifest presence in archives");
  assert(files.packageRelease.includes("findEndOfCentralDirectory") && files.packageRelease.includes("inflateRawSync"), "release packaging must verify zip manifest contents in Node");
  assert(files.packageRelease.includes("assertArchiveFeatureSet") && files.packageRelease.includes("src/shared/firstPartyApps.json"), "release packaging must verify archived feature bundles against the app registry");
  assert(files.packageRelease.includes("assertArchiveFiles") && files.packageRelease.includes("requiredOutputs") && files.packageRelease.includes("targetDir"), "release packaging must verify archived app assets and CSS outputs");
  assert(files.packageRelease.includes("assertManifestResources") && files.packageRelease.includes("assertNoSourceMaps"), "release packaging must verify web-accessible resource patterns and source-map pruning");
  assert(files.packageRelease.includes("assertArchiveRuntimeMarkers") && files.packageRelease.includes("milxdyBuildProfile") && files.packageRelease.includes("milxdyBuildTarget"), "release packaging must verify archived runtime build markers");
  assert(files.packageRelease.includes("assertArchiveManifestShape") && files.packageRelease.includes("excluded app host permission leaked"), "release packaging must verify archived manifest shape and profile host permissions");
  assert(files.packageRelease.includes("releaseBuilds") && files.buildProfiles.includes("releaseBuilds"), "build and packaging scripts must share the release profile matrix");
  assert(files.releaseRegistry.includes("coreHostPermissions") && files.releaseBuilds.includes("coreHostPermissions"), "release registry helpers must share the core host permission contract");
  assert(files.packageRelease.includes("contentScriptMatches") && files.packageRelease.includes("webAccessibleMatches"), "release packaging must share manifest match-origin contracts");
  assert(files.releaseBuilds.includes("contentScriptMatches") && files.releaseBuilds.includes("webAccessibleMatches"), "release build contract must define manifest match origins");
  assert(files.packageRelease.includes("commonAssetDirs") && files.releaseBuilds.includes("commonAssetDirs"), "release packaging must share common asset roots");
  assert(files.releaseBuilds.includes("generatedAssetRoots"), "release build contract must define generated asset roots");
  assert(files.releaseRegistry.includes("appsForProfile") && files.releaseRegistry.includes("featureBundlesForProfile") && files.releaseRegistry.includes("hostPermissionsForProfile"), "release tooling must share registry profile helpers");
  assert(files.packageRelease.includes("releaseBuilds") && files.buildProfiles.includes("releaseBuilds") && files.releaseNotes.includes("build:profiles"), "release profile matrix must be reusable and documented");
  for (const needle of ["chromium-lite", "chromium-balanced", "dist/chromium", "firefox-lite", "firefox-balanced", "dist/firefox"]) {
    assert(files.releaseBuilds.includes(needle), `release build matrix missing ${needle}`);
  }
  assert(files.urlAllowlistVerifier.includes("parseAllowedUrl") && files.urlAllowlistVerifier.includes("isAllowedUrl"), "URL allowlist verifier must exercise shared helper exports");
  assert(files.urlAllowlistVerifier.includes("MUSICBRAINZ_JSON_RULES") && files.urlAllowlistVerifier.includes("REMILIA_MEDIA_RULES"), "URL allowlist verifier must cover central and RemiNet media contracts");
}

function verifyDocumentedNpmScripts() {
  const scripts = JSON.parse(files.packageJson).scripts || {};
  const docs = {
    "docs/CHROME_LIVE_QA_0.2.0.md": files.chromeLiveQa,
    "docs/QA_0.2.0.md": files.qa,
    "docs/QA_LOG_0.2.0.md": files.qaLog,
    "docs/RELEASE_NOTES_0.2.0.md": files.releaseNotes,
    "docs/RELEASES.md": files.releases,
  };
  for (const [name, text] of Object.entries(docs)) {
    for (const command of documentedNpmRunScripts(text)) {
      assert(scripts[command], `${name} references missing package script: ${command}`);
    }
  }
}

function documentedNpmRunScripts(text) {
  const matches = text.matchAll(/npm(?:\.cmd)?\s+run\s+([A-Za-z0-9:_-]+)/g);
  return Array.from(new Set(Array.from(matches, (match) => match[1])));
}

function verifyRegistryCoverage() {
  const byId = new Map(registry.map((app) => [app.id, app]));
  for (const id of ["post-reading", "wikiSidebar", "reminetChat", "beetol", "miladychanSpotlight", "music", "miladymaxxer"]) {
    const app = byId.get(id);
    assert(app, `registry missing ${id}`);
    assert(app.dock?.label, `${id}: dock metadata missing`);
    assert(app.hub?.rail?.supported === true, `${id}: rail support metadata missing`);
    assert(app.loadTriggers?.includes("dockOpen"), `${id}: dock app must lazy-load on dock open`);
    assert(!app.loadTriggers?.includes("startup"), `${id}: dock app must not load at startup`);
  }
  const music = byId.get("music");
  assert(music.version === "0.2.0", "Music registry version must be 0.2.0");
  assert(music.permissions?.hosts?.includes("https://musicbrainz.org/*"), "music missing MusicBrainz host permission");
  assert(music.permissions?.hosts?.includes("https://api.acoustid.org/*"), "music missing AcoustID host permission");
  assert(music.hub?.privacyLabels?.includes("local-files"), "music must disclose local file access");

  const miladychan = byId.get("miladychanSpotlight");
  assert(miladychan.name === "Miladychan Portal", "Miladychan registry name must match 0.2.0 Portal framing");
  assert(miladychan.version === "0.2.0", "Miladychan Portal registry version must be 0.2.0");
  assert(miladychan.permissions?.hosts?.includes("https://boards.miladychan.org/*"), "Miladychan missing board host permission");
  assert(miladychan.hub?.remoteServices?.includes("boards.miladychan.org"), "Miladychan must disclose remote board service");

  const wikiSidebar = byId.get("wikiSidebar");
  assert(wikiSidebar.name === "Remilia Wiki", "Wiki sidebar registry name must retain canonical Remilia Wiki naming");
  assert(wikiSidebar.dock?.label === "Remilia Wiki", "Wiki sidebar dock label must match the 0.2.0 Remilia rail spec");
  assert(wikiSidebar.dock?.icon === "wikiSidebar/remilia-wiki-favicon.png", "Wiki sidebar must use the packaged Remilia Wiki rail icon");
  assert(wikiSidebar.assets?.includes("wikiSidebar"), "Wiki sidebar icon asset directory must be packaged");
  assert(wikiSidebar.permissions?.hosts?.includes("https://wiki.remilia.org/*"), "Wiki sidebar missing primary wiki host permission");
  assert(wikiSidebar.permissions?.hosts?.includes("https://remilia.wiki/*"), "Wiki sidebar missing alias wiki host permission");
  assert(wikiSidebar.hub?.remoteServices?.includes("wiki.remilia.org"), "Wiki sidebar must disclose primary wiki remote service");
  assert(wikiSidebar.hub?.remoteServices?.includes("remilia.wiki"), "Wiki sidebar must disclose alias wiki remote service");
}

function verifyBackgroundSecurityContract() {
  assert(files.background.includes("parseAllowedUrl"), "central background must use shared allowlist parser");
  for (const rule of [
    "MUSICBRAINZ_JSON_RULES",
    "ACOUSTID_FORM_RULES",
    "MILADYCHAN_JSON_RULES",
    "MUSIC_IMAGE_RULES",
    "MILADY_MAKER_BANNER_RULES",
  ]) {
    assert(files.background.includes(rule), `central background missing ${rule}`);
  }
  assert(files.reminetBackground.includes("REMILIA_MEDIA_RULES"), "RemiNet Chat background missing media allowlist rules");
  assert(files.reminetBackground.includes("isAllowedUrl"), "RemiNet Chat media fetch must use shared allowlist helper");
}

function verifyWikiSidebarContract() {
  assert(files.wikiContent.includes("configurePreviewSidebarOpener(openWikiSidebarUrl)"), "wiki links must configure preview read-more routing into the sidebar");
  assert(files.wikiContent.includes('loadRuntimeAppById("wikiSidebar", "wikiLink")'), "wiki links must lazy-load the sidebar app on user link activation");
  assert(files.wikiContent.includes("function shouldUseNativeLink(event: MouseEvent)") && files.wikiContent.includes("event.metaKey") && files.wikiContent.includes("event.ctrlKey"), "wiki links must preserve modifier-click native behavior");
  assert(files.wikiPreview.includes("sidebarOpener") && files.wikiPreview.includes("Read on Remilia Wiki"), "wiki preview must expose read-more sidebar routing");
  assert(files.wikiPreview.includes("shouldUseNativeLink(event)") && files.wikiPreview.includes("event.preventDefault()"), "wiki preview read-more must intercept only plain clicks");
  assert(files.wikiSidebar.includes("export async function openWikiUrl"), "wiki sidebar must expose openWikiUrl for link routing");
  assert(files.wikiSidebar.includes('const HOME_URL = "https://wiki.remilia.org/"'), "wiki sidebar must centralize the embeddable wiki homepage URL");
  assert(files.wikiSidebar.includes('"remilia.wiki", "wiki.remilia.org"') && files.wikiSidebar.includes('url.protocol !== "https:"'), "wiki sidebar must validate URLs before in-panel navigation");
  assert(files.wikiSidebar.includes("window.open(state.currentUrl") && files.wikiSidebar.includes("Open in new tab"), "wiki sidebar must keep explicit open-in-tab escape hatch");
  assert(files.wikiSidebar.includes("milxdy:wiki-sidebar-open"), "wiki sidebar must support event-based app navigation fallback");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
