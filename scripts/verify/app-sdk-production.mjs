import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const publicTypes = await readFile("sdk/types/index.d.ts", "utf8");
const starterManifest = JSON.parse(await readFile("sdk/templates/basic-feature/milxdy.app.json", "utf8"));
const novelPackageManifest = JSON.parse(await readFile("examples/packages/local-dev/dev-note/milxdy.app.json", "utf8"));
const dockedStarterManifest = JSON.parse(await readFile("sdk/templates/docked-app/milxdy.app.json", "utf8"));
const dockedStarterJavaScript = await readFile("sdk/templates/docked-app/content.js", "utf8");
const themePrimitives = await readFile("sdk/ui/theme.css", "utf8");
const overlayPrimitives = await readFile("sdk/ui/overlay.css", "utf8");
const starterThemePrimitives = await readFile("sdk/templates/docked-app/styles/theme.css", "utf8");
const starterOverlayPrimitives = await readFile("sdk/templates/docked-app/styles/overlay.css", "utf8");
const accessibilityGuide = await readFile("sdk/ACCESSIBILITY.md", "utf8");
const assetGuide = await readFile("sdk/ASSETS_AND_LICENSING.md", "utf8");
const readiness = await readFile("docs/sdk/APP_PLATFORM_PRODUCTION_READINESS.md", "utf8");
const compatibility = await readFile("docs/sdk/APP_SDK_COMPATIBILITY.md", "utf8");
const docsIndex = await readFile("docs/INDEX.md", "utf8");
const referenceDocs = await readFile("docs/sdk/POST_READING_SDK_REFERENCE.md", "utf8");
const referenceCompatibility = JSON.parse(await readFile("sdk/references/post-reading.compatibility.json", "utf8"));
const referenceAcceptance = JSON.parse(await readFile("sdk/references/post-reading.acceptance.json", "utf8"));
const replacementPolicy = JSON.parse(await readFile("scripts/packages/local-app-first-party-replacements.json", "utf8"));
const postReadingPolicy = replacementPolicy.replacements?.find((candidate) => candidate.id === "post-reading");

assert(publicTypes.includes(`App SDK ${packageJson.appSdkVersion}`), "public declarations must name the current App SDK version");
for (const name of [
  "MilxdyContentAppContext",
  "MilxdyContentAppModule",
  "TwitterSurface",
  "MilxdyRouteChange",
  "AppRuntimeScheduler",
  "AppStorageFacade",
]) {
  assert(publicTypes.includes(name), `public declarations are missing ${name}`);
}
assert(!publicTypes.includes("loadAppById"), "public declarations must not expose internal cross-app loading");
assert(!publicTypes.includes("scheduleScan"), "public declarations must not expose internal scanner scheduling");
assert(publicTypes.includes("requestSurfaceRescan(): void"), "public declarations must expose the bounded surface-rescan request used by external packages");
assert(publicTypes.includes("readonly storage: AppStorageFacade"), "public declarations must expose declared-key app storage");
assert(publicTypes.includes("resolveAssetUrl(path: string): string"), "public declarations must expose guarded asset URL resolution");
assert(publicTypes.includes("MilxdyPageContextActionHost"), "public declarations must expose the manifest-declared page context action host");
assert(publicTypes.includes('Array<"http://*/*" | "https://*/*">'), "page context actions must remain restricted to HTTP/HTTPS active-tab pages");
assert(novelPackageManifest.pageContextActions?.[0]?.entry === "dist/page-action.js", "novel package fixture must exercise a packaged page context action entry");
assert(starterManifest.sdk?.minVersion === packageJson.appSdkVersion, "starter template sdk.minVersion must match package.json appSdkVersion");
assert(starterManifest.sdk?.targetVersion === packageJson.appSdkVersion, "starter template sdk.targetVersion must match package.json appSdkVersion");
assert(starterManifest.defaultEnabled === false, "starter template must start disabled");
assert(dockedStarterManifest.sdk?.targetVersion === packageJson.appSdkVersion, "docked starter target version must match the current App SDK");
assert(dockedStarterManifest.defaultEnabled === false, "docked starter must start disabled");
assert(dockedStarterManifest.packageKind === "app" && dockedStarterManifest.surfaces?.includes("overlayApp"), "docked starter must exercise the overlay app contract");
assert(dockedStarterManifest.loadTriggers?.includes("dockOpen") && dockedStarterManifest.dock?.label, "docked starter must exercise dock metadata and loading");
assert(themePrimitives === starterThemePrimitives, "docked starter theme tokens must match the public UI kit");
assert(overlayPrimitives === starterOverlayPrimitives, "docked starter overlay primitives must match the public UI kit");
assert(themePrimitives.includes("--milxdy-sdk-color-surface") && themePrimitives.includes("prefers-reduced-motion"), "public UI tokens must include semantic color and motion contracts");
assert(overlayPrimitives.includes(":focus-visible") && overlayPrimitives.includes("forced-colors") && overlayPrimitives.includes("min-inline-size: 44px"), "public overlay primitives must preserve focus, forced colors, and target sizing");
for (const requirement of ["aria-labelledby", "Escape", "previousFocus", "panel.focus()", "milxdy-sdk-overlay__button"]) {
  assert(dockedStarterJavaScript.includes(requirement), `docked starter must demonstrate accessible overlay behavior: ${requirement}`);
}
assert(accessibilityGuide.includes("screen-reader") && accessibilityGuide.includes("200% zoom") && accessibilityGuide.includes("reduced motion"), "accessibility guide must define assistive technology, zoom, and motion expectations");
assert(assetGuide.includes("package.webAccessibleAssets") && assetGuide.includes("license") && assetGuide.includes("not legal approval"), "asset guide must define declaration, licensing, and review boundaries");
assert(readiness.includes("Supported Distribution Model"), "platform contract must define the supported distribution model");
assert(readiness.includes("Post-reading is the production reference app"), "platform contract must identify the external integration proof");
assert(compatibility.includes("APP_PLATFORM_PRODUCTION_READINESS.md#versioning-and-support"), "compatibility redirect must link the canonical support contract");
assert(readiness.includes("| Package-owned background modules | Use host-provided declared services |"), "canonical platform contract must define the package background-service model");
assert(docsIndex.includes("APP_SDK_COMPATIBILITY.md") && docsIndex.includes("APP_PLATFORM_PRODUCTION_READINESS.md"), "docs index must link SDK production policies");
assert(docsIndex.includes("POST_READING_SDK_REFERENCE.md"), "docs index must link the external SDK reference");
assert(referenceCompatibility.packageId === "post-reading", "external compatibility mirror must identify Post-reading");
assert(referenceCompatibility.appSdk?.targetVersion === packageJson.appSdkVersion, "external reference must target the current App SDK");
assert(referenceAcceptance.packageId === referenceCompatibility.packageId, "external acceptance mirror must identify the compatibility package");
assert(referenceAcceptance.packageVersion === referenceCompatibility.packageVersion, "external acceptance mirror must match the compatibility package version");
assert(referenceAcceptance.appSdkVersion === packageJson.appSdkVersion, "external acceptance mirror must target the current App SDK");
for (const id of ["install-connect", "update-version-mismatch", "enable-disable", "launch-navigation", "settings-migration", "messaging-boundaries", "audio-export", "tts-fallback", "error-offline-timeout-cancellation", "privacy-consent", "theme-layout-accessibility", "uninstall-cleanup"]) {
  const scenario = referenceAcceptance.scenarios?.find((candidate) => candidate.id === id);
  assert(scenario?.automated && scenario?.manual, `external acceptance mirror must define ${id}`);
}
assert(!referenceCompatibility.reviewedExceptions.some((entry) => /storage|asset URL/i.test(entry)), "external reference must use public storage and asset URL capabilities");
assert(referenceDocs.includes("verify:post-reading-sdk-reference"), "external reference docs must publish the cross-repository gate");
assert(referenceDocs.includes("milxdy.acceptance.json") && referenceDocs.includes("Browser-only fallback"), "external reference docs must publish the acceptance matrix and browser-only recovery path");
assert(/^[0-9a-f]{40}$/.test(postReadingPolicy?.sourceCommit || ""), "external reference trust policy must pin a full Git commit");

const checks = [
  ["SDK adherence graph and regression fixtures", ["scripts/verify/app-sdk-adherence-fixtures.mjs"]],
  ["SDK migration exception ratchet", ["scripts/verify/app-sdk-adherence.mjs"]],
  ["Docked starter asynchronous lifecycle", ["scripts/verify/app-sdk-starter-lifecycle.mjs"]],
  ["Public SDK declarations and starter JavaScript", ["node_modules/typescript/bin/tsc", "-p", "sdk/tsconfig.json"]],
  ["App SDK author harness", ["scripts/verify/app-sdk-harness.mjs"]],
  ["App SDK compliance", ["scripts/verify/app-sdk-compliance.mjs"]],
  ["App settings mirrors", ["scripts/verify/app-settings-mirrors.mjs"]],
  ["Internal messaging bridges", ["scripts/verify/internal-messaging-bridges.mjs"]],
  ["First-party package fixtures", ["scripts/packages/verify-local-app-packages.mjs"]],
  ["Novel package integration", [
    "scripts/packages/verify-local-app-package.mjs",
    "--package=examples/packages/local-dev/dev-note",
    "--allow-local-review",
    "--acknowledge-package-consent",
  ]],
  ["Starter template integration", [
    "scripts/packages/verify-local-app-package.mjs",
    "--package=sdk/templates/basic-feature",
    "--allow-local-review",
    "--acknowledge-package-consent",
  ]],
  ["Docked starter integration", [
    "scripts/packages/verify-local-app-package.mjs",
    "--package=sdk/templates/docked-app",
    "--allow-local-review",
    "--acknowledge-package-consent",
  ]],
  ["Local package trust gates", ["scripts/packages/verify-local-app-trust-gates.mjs"]],
];

console.log(`App SDK production verification for ${packageJson.appSdkVersion}`);
for (const [label, args] of checks) {
  console.log(`\n== ${label} ==`);
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\nApp SDK production verification passed.");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
