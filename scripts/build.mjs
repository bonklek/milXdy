import { cp, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createRequire } from "node:module";
import esbuild from "esbuild";
import { commonAssetDirs, webAccessibleMatches } from "./release-builds.mjs";
import { appIncludedInBuildProfile, hostPermissionsForProfile } from "./release-registry.mjs";

const watch = process.argv.includes("--watch");
const target = readTarget();
const buildProfile = readProfile();
const outDir = buildProfile === "full" ? `dist/${target}` : `dist/${target}-${buildProfile}`;
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const registryApps = JSON.parse(await readFile("src/shared/firstPartyApps.json", "utf8"));
const firstPartyApps = registryApps.filter((app) => appIncludedInBuildProfile(app, buildProfile));
const require = createRequire(import.meta.url);
const tesseractCoreDir = resolvePackageDir("tesseract.js-core");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await mkdir(`${outDir}/features`, { recursive: true });

await writeManifest();
await copyFile("public/popup.html", `${outDir}/popup.html`);
await copyFile("public/popup.css", `${outDir}/popup.css`);
if (appEnabled("post-reading")) {
  await copyFile("public/ocr.html", `${outDir}/ocr.html`);
}
if (appEnabled("miladymaxxer") && existsSync("public/miladymaxxer/milady-logo.png")) {
  await copyFile("public/miladymaxxer/milady-logo.png", `${outDir}/milady-logo.png`);
}

for (const dir of unique([
  ...commonAssetDirs,
  ...firstPartyApps.flatMap((app) => app.assets || []),
])) {
  if (existsSync(`public/${dir}`)) {
    await cp(`public/${dir}`, `${outDir}/${dir}`, { recursive: true });
  }
}
for (const sheet of firstPartyApps.flatMap((app) => app.css || [])) {
  if (existsSync(sheet.source)) {
    await mkdir(`${outDir}/${sheet.targetDir}`, { recursive: true });
    await copyFile(sheet.source, `${outDir}/${sheet.targetDir}/${sheet.target}`);
  }
}
if (appEnabled("music") && existsSync("node_modules/@unimusic/chromaprint/dist/chromaprint.wasm")) {
  await copyFile("node_modules/@unimusic/chromaprint/dist/chromaprint.wasm", `${outDir}/features/chromaprint.wasm`);
}

if (appEnabled("post-reading")) {
  await mkdir(`${outDir}/ocr/core`, { recursive: true });
  await mkdir(`${outDir}/ocr/lang`, { recursive: true });
  if (existsSync("node_modules/tesseract.js/dist/worker.min.js")) {
    await copyFile("node_modules/tesseract.js/dist/worker.min.js", `${outDir}/ocr/worker.min.js`);
  }
  if (tesseractCoreDir) {
    await cp(tesseractCoreDir, `${outDir}/ocr/core`, { recursive: true });
  }
  if (existsSync("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz")) {
    await copyFile("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz", `${outDir}/ocr/lang/eng.traineddata.gz`);
  }
}
if (appEnabled("miladymaxxer") && existsSync("node_modules/onnxruntime-web/dist")) {
  await mkdir(`${outDir}/ort`, { recursive: true });
  for (const file of [
    "ort-wasm-simd-threaded.jsep.mjs",
    "ort-wasm-simd-threaded.jsep.wasm",
  ]) {
    await copyFile(`node_modules/onnxruntime-web/dist/${file}`, `${outDir}/ort/${file}`);
  }
}
await pruneSourceMaps(outDir);

const common = {
  bundle: true,
  platform: "browser",
  target: "es2022",
  sourcemap: false,
  logLevel: "info",
  define: {
    MILXDY_BUILD_PROFILE: JSON.stringify(buildProfile),
    MILXDY_BUILD_TARGET: JSON.stringify(target),
    MILXDY_VERSION: JSON.stringify(packageJson.version),
  },
  plugins: [profileRegistryPlugin()],
};

const contexts = [];

const source = (path) => resolve(path);

function readTarget() {
  const value = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] ?? "chromium";
  if (value !== "chromium" && value !== "firefox") {
    throw new Error(`Unknown build target "${value}". Use "chromium" or "firefox".`);
  }
  return value;
}

function readProfile() {
  const value = process.argv.find((arg) => arg.startsWith("--profile="))?.split("=")[1] ?? "full";
  if (value !== "lite" && value !== "balanced" && value !== "full") {
    throw new Error(`Unknown build profile "${value}". Use "lite", "balanced", or "full".`);
  }
  return value;
}

function appEnabled(id) {
  return firstPartyApps.some((app) => app.id === id);
}

function profileRegistryPlugin() {
  return {
    name: "milxdy-profile-registry",
    setup(build) {
      build.onLoad({ filter: /firstPartyApps\.json$/ }, () => ({
        contents: JSON.stringify(registryApps),
        loader: "json",
      }));
    },
  };
}

function unique(values) {
  return Array.from(new Set(values));
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

async function writeManifest() {
  const manifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
  manifest.host_permissions = buildHostPermissions(manifest.host_permissions || []);
  manifest.web_accessible_resources = buildWebAccessibleResources(manifest.web_accessible_resources || []);
  if (target === "firefox") {
    manifest.background = {
      scripts: ["background.js"],
      type: "module",
    };
    manifest.browser_specific_settings = {
      gecko: {
        id: "milxdy@remilia",
        strict_min_version: "128.0",
      },
    };
  }
  await writeFile(`${outDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
}

function buildHostPermissions(existing) {
  if (buildProfile === "full") return existing;
  return hostPermissionsForProfile(registryApps, buildProfile);
}

function buildWebAccessibleResources(existing) {
  const resources = unique([
    "brand/*",
    "icons/*",
    "remilia-fonts/*",
    "features/*.js",
    ...firstPartyApps.flatMap((app) => app.assets || []).map((dir) => `${dir}/*`),
    ...firstPartyApps.flatMap((app) => app.requiredOutputs || []),
  ]);
  if (appEnabled("post-reading")) {
    resources.push("ocr/*");
    if (tesseractCoreDir) resources.push("ocr/core/*");
    if (existsSync("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz")) resources.push("ocr/lang/*");
  }
  if (appEnabled("music")) resources.push("features/*.wasm");
  if (appEnabled("miladymaxxer")) resources.push("features/*.wasm", "worker.js", "ort/*", "generated/*", "models/*", "milady-logo.png");
  return [{
    resources: unique(resources),
    matches: webAccessibleMatches,
  }];
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

async function pruneSourceMaps(dir) {
  if (!existsSync(dir)) return;
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      await pruneSourceMaps(path);
      return;
    }
    if (entry.isFile() && entry.name.endsWith(".map")) {
      await rm(path, { force: true });
    }
  }));
}

async function mirrorChromiumRootOutput() {
  if (target !== "chromium" || watch) return;
  const rootOutDir = "dist";
  const entries = [
    "background.js",
    "content.js",
    "manifest.json",
    "milady-logo.png",
    "ocr.html",
    "ocrHost.js",
    "popup.css",
    "popup.html",
    "popup.js",
    "wikiFrame.js",
    "worker.js",
    "features",
    ...unique([
      ...commonAssetDirs,
      ...firstPartyApps.flatMap((app) => app.assets || []),
      ...firstPartyApps.flatMap((app) => (app.css || []).map((sheet) => sheet.targetDir)),
    ]),
  ];
  for (const entry of entries) {
    await rm(`${rootOutDir}/${entry}`, { recursive: true, force: true });
    if (existsSync(`${outDir}/${entry}`)) {
      await cp(`${outDir}/${entry}`, `${rootOutDir}/${entry}`, { recursive: true });
    }
  }
}

await buildOrWatch({
  ...common,
  entryPoints: {
    content: source("src/content.ts"),
    background: source("src/background.ts"),
    popup: source("src/popup.ts"),
    wikiFrame: source("src/entries/wikiFrameContent.ts"),
  },
  outdir: outDir,
  format: "iife",
});

await buildOrWatch({
  ...common,
  entryPoints: Object.fromEntries(firstPartyApps.map((app) => [app.entryName, source(app.entryPoint)])),
  outdir: outDir,
  format: "esm",
});

await buildOrWatch({
  ...common,
  entryPoints: Object.fromEntries([
    appEnabled("miladymaxxer") ? ["worker", source("src/features/miladymaxxer/worker.ts")] : null,
    appEnabled("post-reading") ? ["ocrHost", source("src/features/post-reading/ocrHost.ts")] : null,
  ].filter(Boolean)),
  outdir: outDir,
  format: "iife",
});

if (watch) {
  console.log(`Watching milXdy ${target}/${buildProfile} extension files with ${contexts.length} build contexts...`);
}

if (!watch) {
  const required = [
    `${outDir}/content.js`,
    `${outDir}/wikiFrame.js`,
    ...firstPartyApps.map((app) => `${outDir}/${app.entryName}.js`),
    ...firstPartyApps.flatMap((app) => (app.requiredOutputs || []).map((file) => `${outDir}/${file}`)),
  ];
  const missing = required.filter((file) => !existsSync(file));
  if (missing.length > 0) {
    throw new Error(`Missing split bundle output: ${missing.join(", ")}`);
  }
  const bootstrap = await readFile(`${outDir}/content.js`, "utf8");
  const forbiddenBootstrapNeedles = ["tesseract", "onnxruntime", "wiki-index.generated", "createScoreBadge", "mountBeetolGame"];
  const foundNeedles = forbiddenBootstrapNeedles.filter((needle) => bootstrap.toLowerCase().includes(needle.toLowerCase()));
  if (foundNeedles.length > 0) {
    throw new Error(`Content bootstrap contains feature implementation strings: ${foundNeedles.join(", ")}`);
  }
  await mirrorChromiumRootOutput();
}
