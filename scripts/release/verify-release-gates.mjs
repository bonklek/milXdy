import { spawnSync } from "node:child_process";
import { withReleaseArtifactLock } from "./release-artifact-lock.mjs";

const gates = [
  ["TypeScript", ["node_modules/typescript/bin/tsc", "--noEmit"]],
  ["Current release docs/contracts", ["scripts/release/verify-release-current.mjs"]],
  ["Reviewed creation defaults", ["--test", "scripts/verify/creation-defaults.test.mjs"]],
  ["Chromium release identity", ["scripts/verify/chromium-identity.mjs"]],
  ["Remilia migration docs/evidence contracts", ["scripts/verify/remilia-api-migration.mjs"]],
  ["Remilia migration artifact scan fixtures", ["scripts/verify/remilia-migration-artifact-scan.mjs"]],
  ["Stylesheet build validation fixtures", ["--test", "scripts/build/validated-css-text.test.mjs"]],
  ["Reader speaker and Share export controls", ["scripts/verify/reader-controls-browser.mjs"]],
  ["X Article playback and word tracking", ["scripts/verify/x-article-reader-browser.mjs"]],
  ["Legacy and modern DM reader discovery", ["scripts/verify/direct-messages-browser.mjs"]],
  ["Quick replies and bounded maker panel", ["scripts/verify/quick-replies-browser.mjs"]],
  ["Author identity and badge layout", ["scripts/verify/author-header-browser.mjs"]],
  ["Native page reskin layout", ["scripts/verify/reskin-layout-browser.mjs"]],
  ["Build Chromium/Firefox profiles", ["scripts/build/build-profiles.mjs"]],
  ["Filesystem layout", ["scripts/verify/filesystem-layout.mjs"]],
  ["Localization metadata", ["scripts/verify/locales.mjs"]],
  ["Platform contracts", ["scripts/verify/platform.mjs"]],
  ["URL allowlist contracts", ["scripts/verify/url-allowlist.mjs"]],
  ["App SDK compliance", ["scripts/verify/app-sdk-compliance.mjs"]],
  ["Internal messaging bridges", ["scripts/verify/internal-messaging-bridges.mjs"]],
  ["Remilia auth logout concurrency", ["node_modules/vitest/vitest.mjs", "run", "src/platform/auth/remilia-auth.test.ts"]],
  ["RemiStats tooltip escaping", ["scripts/verify/remistats-tooltip-escaping.mjs"]],
  ["Local app package metadata", ["scripts/packages/verify-local-app-packages.mjs"]],
  ["Local app trust gates", ["scripts/packages/verify-local-app-trust-gates.mjs"]],
  ["Add-ons catalog", ["scripts/verify/pages-catalog.mjs"]],
  ["Local catalog selection", ["scripts/verify/local-addon-selection.mjs"]],
  ["Local catalog Prepare/Apply", ["scripts/verify/local-addon-selection-workflow.mjs"]],
  ["App settings mirrors", ["scripts/verify/app-settings-mirrors.mjs"]],
  ["Music build contract", ["scripts/verify/music-build.mjs"]],
  ["Post-reading regression tests", ["node_modules/vitest/vitest.mjs", "run", "src/apps/post-reading"]],
  ["Build Post-reading distribution", ["scripts/build/build-post-reading-distribution.mjs", "--target=chromium"]],
  ["Post-reading distribution contract", ["scripts/verify/post-reading-distribution.mjs"]],
  ["Firefox lint", ["scripts/verify/firefox-lint.mjs"]],
  ["Extension smoke", ["scripts/smoke/extension-smoke-020.mjs"]],
  ["App smoke", ["scripts/smoke/app-smoke.mjs"]],
  ["Package release archives", ["scripts/release/package-release.mjs"]],
  ["Remilia migration artifact scan", ["scripts/release/verify-remilia-migration-artifacts.mjs"]],
  ["Release archive checksums", ["scripts/release/verify-release-checksums.mjs"]],
  ["Release archive reproducibility", ["scripts/release/verify-reproducible-release.mjs"]],
  ["Fresh build reproducibility", ["scripts/release/verify-reproducible-build.mjs"]],
];

await withReleaseArtifactLock("verify release gates", async () => {
  for (const [label, args] of gates) {
    console.log(`\n==> ${label}`);
    const result = spawnSync(process.execPath, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      throw new Error(`${label} failed with exit code ${process.exitCode}`);
    }
  }
});

console.log("\nCurrent non-live release gates passed.");
