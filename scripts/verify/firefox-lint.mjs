import { spawnSync } from "node:child_process";

const result = spawnSync(process.execPath, [
  "node_modules/web-ext/bin/web-ext.js",
  "lint",
  "--source-dir",
  "dist/firefox",
], {
  encoding: "utf8",
});

const output = `${result.stdout || ""}${result.stderr || ""}`;
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error) throw result.error;

const forbiddenWarnings = [
  "MISSING_DATA_COLLECTION_PERMISSIONS",
  "KEY_FIREFOX_UNSUPPORTED_BY_MIN_VERSION",
  "KEY_FIREFOX_ANDROID_UNSUPPORTED_BY_MIN_VERSION",
];

for (const warning of forbiddenWarnings) {
  if (output.includes(warning)) {
    console.error(`Firefox lint emitted forbidden data-collection warning: ${warning}`);
    process.exit(1);
  }
}

process.exit(result.status ?? 1);
