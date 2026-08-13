import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { extname, isAbsolute, join, relative, resolve } from "node:path";

const firefoxDist = resolve("dist/firefox");
const manifest = JSON.parse(readFileSync(join(firefoxDist, "manifest.json"), "utf8"));
const manifestIconPaths = new Set([
  ...iconPaths(manifest.icons),
  ...iconPaths(manifest.action?.default_icon),
  ...iconPaths(manifest.browser_action?.default_icon),
  ...iconPaths(manifest.page_action?.default_icon),
]);

for (const iconPath of manifestIconPaths) assertSafeManifestIcon(iconPath);

const result = spawnSync(process.execPath, [
  "node_modules/web-ext/bin/web-ext.js",
  "lint",
  "--source-dir",
  "dist/firefox",
], {
  encoding: "utf8",
  timeout: 120_000,
});

const output = `${result.stdout || ""}${result.stderr || ""}`;
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.error?.code === "ETIMEDOUT") {
  throw new Error("Firefox lint exceeded the 120 second safety timeout.");
}
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

function iconPaths(value) {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.values(value).flatMap(iconPaths);
}

function assertSafeManifestIcon(iconPath) {
  if (extname(iconPath).toLowerCase() !== ".png") {
    throw new Error(`Firefox manifest icons must use reviewed PNG files: ${iconPath}`);
  }
  const absolutePath = resolve(firefoxDist, iconPath);
  const relativePath = relative(firefoxDist, absolutePath);
  if (!relativePath || relativePath.startsWith("..") || isAbsolute(relativePath)) {
    throw new Error(`Firefox manifest icon escapes the build directory: ${iconPath}`);
  }
  const bytes = readFileSync(absolutePath);
  const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const hasPngSignature = bytes.length >= 24 && pngSignature.every((byte, index) => bytes[index] === byte);
  const hasIhdr = hasPngSignature && bytes.toString("ascii", 12, 16) === "IHDR";
  const width = hasIhdr ? bytes.readUInt32BE(16) : 0;
  const height = hasIhdr ? bytes.readUInt32BE(20) : 0;
  if (!hasIhdr || width === 0 || height === 0 || width > 8192 || height > 8192) {
    throw new Error(`Firefox manifest icon is not a bounded PNG: ${iconPath}`);
  }
}
