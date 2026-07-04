import { spawnSync } from "node:child_process";
import { withReleaseArtifactLock } from "./release-artifact-lock.mjs";

const gates = [
  ["TypeScript", ["node_modules/typescript/bin/tsc", "--noEmit"]],
  ["0.2.0 release docs/contracts", ["scripts/release/verify-release-020.mjs"]],
  ["Build Chromium/Firefox profiles", ["scripts/build/build-profiles.mjs"]],
  ["Filesystem layout", ["scripts/verify/filesystem-layout.mjs"]],
  ["Platform contracts", ["scripts/verify/platform.mjs"]],
  ["URL allowlist contracts", ["scripts/verify/url-allowlist.mjs"]],
  ["Music build contract", ["scripts/verify/music-build.mjs"]],
  ["Firefox lint", ["node_modules/web-ext/bin/web-ext.js", "lint", "--source-dir", "dist/firefox"]],
  ["0.2.0 extension smoke", ["scripts/smoke/extension-smoke-020.mjs"]],
  ["0.2.0 app smoke", ["scripts/smoke/app-smoke-020.mjs"]],
  ["Package release archives", ["scripts/release/package-release.mjs"]],
  ["Release archive checksums", ["scripts/release/verify-release-checksums.mjs"]],
  ["Release archive reproducibility", ["scripts/release/verify-reproducible-release.mjs"]],
];

await withReleaseArtifactLock("verify 0.2.0 release gates", async () => {
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

console.log("\n0.2.0 non-live release gates passed.");
