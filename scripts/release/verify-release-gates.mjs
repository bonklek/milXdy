import { spawnSync } from "node:child_process";
import { withReleaseArtifactLock } from "./release-artifact-lock.mjs";

const gates = [
  ["TypeScript", ["node_modules/typescript/bin/tsc", "--noEmit"]],
  ["Current release docs/contracts", ["scripts/release/verify-release-current.mjs"]],
  ["Build Chromium/Firefox profiles", ["scripts/build/build-profiles.mjs"]],
  ["Filesystem layout", ["scripts/verify/filesystem-layout.mjs"]],
  ["Platform contracts", ["scripts/verify/platform.mjs"]],
  ["URL allowlist contracts", ["scripts/verify/url-allowlist.mjs"]],
  ["App SDK compliance", ["scripts/verify/app-sdk-compliance.mjs"]],
  ["Internal messaging bridges", ["scripts/verify/internal-messaging-bridges.mjs"]],
  ["RemiStats tooltip escaping", ["scripts/verify/remistats-tooltip-escaping.mjs"]],
  ["Local app package metadata", ["scripts/packages/verify-local-app-packages.mjs"]],
  ["Local app trust gates", ["scripts/packages/verify-local-app-trust-gates.mjs"]],
  ["App settings mirrors", ["scripts/verify/app-settings-mirrors.mjs"]],
  ["Music build contract", ["scripts/verify/music-build.mjs"]],
  ["Build Post-reading distribution", ["scripts/build/build-post-reading-distribution.mjs", "--target=chromium"]],
  ["Post-reading distribution contract", ["scripts/verify/post-reading-distribution.mjs"]],
  ["Firefox lint", ["scripts/verify/firefox-lint.mjs"]],
  ["Extension smoke", ["scripts/smoke/extension-smoke-020.mjs"]],
  ["App smoke", ["scripts/smoke/app-smoke.mjs"]],
  ["Package release archives", ["scripts/release/package-release.mjs"]],
  ["Release archive checksums", ["scripts/release/verify-release-checksums.mjs"]],
  ["Release archive reproducibility", ["scripts/release/verify-reproducible-release.mjs"]],
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
