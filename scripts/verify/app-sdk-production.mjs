import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const publicTypes = await readFile("sdk/types/index.d.ts", "utf8");
const starterManifest = JSON.parse(await readFile("sdk/templates/basic-feature/milxdy.app.json", "utf8"));
const dockedStarterManifest = JSON.parse(await readFile("sdk/templates/docked-app/milxdy.app.json", "utf8"));
const readiness = await readFile("docs/APP_PLATFORM_PRODUCTION_READINESS.md", "utf8");
const compatibility = await readFile("docs/APP_SDK_COMPATIBILITY.md", "utf8");
const docsIndex = await readFile("docs/INDEX.md", "utf8");
const referenceDocs = await readFile("docs/POST_READING_SDK_REFERENCE.md", "utf8");
const referenceCompatibility = JSON.parse(await readFile("sdk/references/post-reading.compatibility.json", "utf8"));
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
assert(starterManifest.sdk?.minVersion === packageJson.appSdkVersion, "starter template sdk.minVersion must match package.json appSdkVersion");
assert(starterManifest.sdk?.targetVersion === packageJson.appSdkVersion, "starter template sdk.targetVersion must match package.json appSdkVersion");
assert(starterManifest.defaultEnabled === false, "starter template must start disabled");
assert(dockedStarterManifest.sdk?.targetVersion === packageJson.appSdkVersion, "docked starter target version must match the current App SDK");
assert(dockedStarterManifest.defaultEnabled === false, "docked starter must start disabled");
assert(dockedStarterManifest.packageKind === "app" && dockedStarterManifest.surfaces?.includes("overlayApp"), "docked starter must exercise the overlay app contract");
assert(dockedStarterManifest.loadTriggers?.includes("dockOpen") && dockedStarterManifest.dock?.label, "docked starter must exercise dock metadata and loading");
assert(readiness.includes("reviewed custom-build platform"), "production-readiness docs must define the supported near-term boundary");
assert(readiness.includes("External proof"), "production-readiness docs must require an external integration proof");
assert(compatibility.includes("Package-owned background module | Unsupported"), "compatibility policy must disclose unsupported package background modules");
assert(docsIndex.includes("APP_SDK_COMPATIBILITY.md") && docsIndex.includes("APP_PLATFORM_PRODUCTION_READINESS.md"), "docs index must link SDK production policies");
assert(docsIndex.includes("POST_READING_SDK_REFERENCE.md"), "docs index must link the external SDK reference");
assert(referenceCompatibility.packageId === "post-reading", "external compatibility mirror must identify Post-reading");
assert(referenceCompatibility.appSdk?.targetVersion === packageJson.appSdkVersion, "external reference must target the current App SDK");
assert(!referenceCompatibility.reviewedExceptions.some((entry) => /storage|asset URL/i.test(entry)), "external reference must use public storage and asset URL capabilities");
assert(referenceDocs.includes("verify:post-reading-sdk-reference"), "external reference docs must publish the cross-repository gate");
assert(/^[0-9a-f]{40}$/.test(postReadingPolicy?.sourceCommit || ""), "external reference trust policy must pin a full Git commit");

const checks = [
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
