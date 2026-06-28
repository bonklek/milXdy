import { cp, copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import esbuild from "esbuild";

const watch = process.argv.includes("--watch");
const target = readTarget();
const outDir = target === "chromium" ? "dist/post-reading-chromium" : `dist/post-reading-${target}`;
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const contexts = [];
const require = createRequire(import.meta.url);
const tesseractCoreDir = resolvePackageDir("tesseract.js-core");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await mkdir(`${outDir}/post-reading`, { recursive: true });
await mkdir(`${outDir}/ocr/core`, { recursive: true });
await mkdir(`${outDir}/ocr/lang`, { recursive: true });

await writeManifest();
await copyFile("public/ocr.html", `${outDir}/ocr.html`);
await copyFile("public/post-reading-standalone/popup.html", `${outDir}/popup.html`);
await copyFile("public/post-reading-standalone/popup.css", `${outDir}/popup.css`);
if (existsSync("public/post-reading")) await cp("public/post-reading", `${outDir}/post-reading`, { recursive: true });
if (existsSync("node_modules/tesseract.js/dist/worker.min.js")) {
  await copyFile("node_modules/tesseract.js/dist/worker.min.js", `${outDir}/ocr/worker.min.js`);
}
if (tesseractCoreDir) {
  await cp(tesseractCoreDir, `${outDir}/ocr/core`, { recursive: true });
}
if (existsSync("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz")) {
  await copyFile("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz", `${outDir}/ocr/lang/eng.traineddata.gz`);
}

const common = {
  bundle: true,
  platform: "browser",
  target: "es2022",
  sourcemap: false,
  logLevel: "info",
  define: {
    MILXDY_BUILD_PROFILE: JSON.stringify("post-reading"),
    MILXDY_BUILD_TARGET: JSON.stringify(target),
    MILXDY_VERSION: JSON.stringify(packageJson.version),
  },
};

await buildOrWatch({
  ...common,
  entryPoints: {
    content: resolve("src/standalone/post-reading/content.ts"),
    background: resolve("src/standalone/post-reading/background.ts"),
    popup: resolve("src/features/post-reading/popup.ts"),
    ocrHost: resolve("src/features/post-reading/ocrHost.ts"),
  },
  outdir: outDir,
  format: "iife",
});

if (watch) {
  console.log(`Watching standalone Post-reading ${target} extension files...`);
} else {
  const missing = [
    "manifest.json",
    "content.js",
    "background.js",
    "popup.js",
    "ocr.html",
    "ocrHost.js",
    "post-reading/post-reading-logo.png",
    "ocr/worker.min.js",
    ...(tesseractCoreDir ? ["ocr/core/tesseract-core.wasm.js"] : []),
    "ocr/lang/eng.traineddata.gz",
  ].filter((file) => !existsSync(`${outDir}/${file}`));
  if (missing.length > 0) {
    throw new Error(`Missing standalone Post-reading output: ${missing.join(", ")}`);
  }
}

function readTarget() {
  const value = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] ?? "chromium";
  if (value !== "chromium") {
    throw new Error(`Unknown Post-reading target "${value}". Currently supported: chromium.`);
  }
  return value;
}

async function writeManifest() {
  const manifest = {
    manifest_version: 3,
    name: "Post-reading",
    version: packageJson.version,
    description: "Read-aloud controls for X/Twitter posts with optional quote, link, image alt text, OCR, and custom local TTS support.",
    permissions: ["storage", "unlimitedStorage"],
    host_permissions: [
      "https://x.com/*",
      "https://twitter.com/*",
      "https://pbs.twimg.com/*",
      "http://localhost/*",
      "http://127.0.0.1/*",
    ],
    background: {
      service_worker: "background.js",
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    content_scripts: [{
      matches: ["https://x.com/*", "https://twitter.com/*"],
      js: ["content.js"],
      run_at: "document_idle",
    }],
    web_accessible_resources: [{
      resources: [
        "ocr.html",
        "ocrHost.js",
        "ocr/*",
        ...(tesseractCoreDir ? ["ocr/core/*"] : []),
        "ocr/lang/*",
        "post-reading/*",
      ],
      matches: ["https://x.com/*", "https://twitter.com/*"],
    }],
    options_page: "popup.html",
    action: {
      default_title: "Post-reading",
      default_popup: "popup.html",
      default_icon: {
        128: "post-reading/post-reading-logo.png",
      },
    },
    icons: {
      128: "post-reading/post-reading-logo.png",
    },
  };
  await writeFile(`${outDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
}

function resolvePackageDir(packageName) {
  try {
    return resolve(require.resolve(`${packageName}/package.json`), "..");
  } catch {
    try {
      return dirname(require.resolve(packageName));
    } catch {
      return resolvePnpmPackageDir(packageName);
    }
  }
}

function resolvePnpmPackageDir(packageName) {
  const pnpmDir = resolve("node_modules/.pnpm");
  if (!existsSync(pnpmDir)) return null;
  const packageFolderName = packageName.replace("/", "+");
  const entry = readdirSync(pnpmDir).find((name) => name === packageFolderName || name.startsWith(`${packageFolderName}@`));
  if (!entry) return null;
  const packageDir = resolve(pnpmDir, entry, "node_modules", packageName);
  return existsSync(packageDir) ? packageDir : null;
}

async function buildOrWatch(options) {
  if (!watch) {
    await esbuild.build(options);
    return;
  }
  const context = await esbuild.context(options);
  await context.watch();
  contexts.push(context);
}
