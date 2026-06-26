import { cp, copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

// --target=chromium (default) | firefox
const target = (() => {
  const t = process.argv.find((a) => a.startsWith("--target="))?.split("=")[1];
  if (t && t !== "chromium" && t !== "firefox") {
    console.error(`Unknown --target="${t}". Use chromium or firefox.`);
    process.exit(1);
  }
  return t ?? "chromium";
})();

const outDir = `dist/${target}`;
console.log(`Building milXdy for ${target} -> ${outDir}`);

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await mkdir(`${outDir}/features`, { recursive: true });

// Generate the manifest for this target from the single source of truth
// (public/manifest.json), so permissions/resources never drift between
// Chromium and Firefox.
const baseManifest = JSON.parse(await readFile("public/manifest.json", "utf8"));
const manifest = JSON.parse(JSON.stringify(baseManifest));
if (target === "firefox") {
  // Firefox MV3 uses background scripts, not Chromium's service_worker shape.
  manifest.background = { scripts: ["background.js"], type: "module" };
  // Firefox requires an add-on id via browser_specific_settings.
  manifest.browser_specific_settings = {
    gecko: { id: "milxdy@remilia", strict_min_version: "128.0" },
  };
}
await writeFile(`${outDir}/manifest.json`, JSON.stringify(manifest, null, 2));

await copyFile("public/popup.html", `${outDir}/popup.html`);
await copyFile("public/popup.css", `${outDir}/popup.css`);
await copyFile("public/ocr.html", `${outDir}/ocr.html`);
if (existsSync("public/miladymaxxer/milady-logo.png")) {
  await copyFile("public/miladymaxxer/milady-logo.png", `${outDir}/milady-logo.png`);
}

for (const dir of ["icons", "remistats", "beetol", "miladymaxxer", "models", "generated", "wiki-helper"]) {
  if (existsSync(`public/${dir}`)) {
    await cp(`public/${dir}`, `${outDir}/${dir}`, { recursive: true });
  }
}
if (existsSync("src/features/remistats/remistats.css")) {
  await copyFile("src/features/remistats/remistats.css", `${outDir}/remistats/remistats.css`);
}
if (existsSync("src/features/beetol/content.css")) {
  await copyFile("src/features/beetol/content.css", `${outDir}/beetol/content.css`);
}
if (existsSync("src/features/reminetChat/content.css")) {
  await mkdir(`${outDir}/reminetChat`, { recursive: true });
  await copyFile("src/features/reminetChat/content.css", `${outDir}/reminetChat/content.css`);
}

await mkdir(`${outDir}/ocr/core`, { recursive: true });
await mkdir(`${outDir}/ocr/lang`, { recursive: true });
if (existsSync("node_modules/tesseract.js/dist/worker.min.js")) {
  await copyFile("node_modules/tesseract.js/dist/worker.min.js", `${outDir}/ocr/worker.min.js`);
}
if (existsSync("node_modules/tesseract.js-core")) {
  await cp("node_modules/tesseract.js-core", `${outDir}/ocr/core`, { recursive: true });
}
if (existsSync("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz")) {
  await copyFile("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz", `${outDir}/ocr/lang/eng.traineddata.gz`);
}
if (existsSync("node_modules/onnxruntime-web/dist")) {
  // Only ship the ONNX Runtime files actually loaded at runtime.
  // The bundled worker uses the JSEP SIMD-threaded WASM pair.
  await mkdir(`${outDir}/ort`, { recursive: true });

  const ortFiles = [
    "ort-wasm-simd-threaded.jsep.wasm",
    "ort-wasm-simd-threaded.jsep.mjs",
  ];

  for (const file of ortFiles) {
    const from = `node_modules/onnxruntime-web/dist/${file}`;
    if (!existsSync(from)) throw new Error(`Missing ONNX Runtime asset: ${from}`);
    await copyFile(from, `${outDir}/ort/${file}`);
  }
}
await pruneSourceMaps(outDir);

const common = {
  bundle: true,
  platform: "browser",
  target: "es2022",
  sourcemap: false,
  logLevel: "info",
};

const contexts = [];

const source = (path) => resolve(path);

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

await buildOrWatch({
  ...common,
  entryPoints: {
    content: source("src/content.ts"),
    background: source("src/background.ts"),
    popup: source("src/popup.ts"),
  },
  outdir: outDir,
  format: "iife",
});

await buildOrWatch({
  ...common,
  entryPoints: {
    "features/wiki": source("src/entries/wikiContent.ts"),
    "features/postreader": source("src/entries/postreaderContent.ts"),
    "features/remistats": source("src/entries/remistatsContent.ts"),
    "features/miladymaxxer": source("src/entries/miladymaxxerContent.ts"),
    "features/beetol": source("src/entries/beetolContent.ts"),
    "features/reminetChat": source("src/entries/reminetChatContent.ts"),
  },
  outdir: outDir,
  format: "esm",
});

await buildOrWatch({
  ...common,
  entryPoints: {
    worker: source("src/features/miladymaxxer/worker.ts"),
    ocrHost: source("src/features/postreader/ocrHost.ts"),
  },
  outdir: outDir,
  format: "iife",
});

if (watch) {
  console.log(`Watching milXdy (${target}) with ${contexts.length} build contexts...`);
}

if (!watch) {
  const required = [
    `${outDir}/content.js`,
    `${outDir}/features/wiki.js`,
    `${outDir}/features/postreader.js`,
    `${outDir}/features/remistats.js`,
    `${outDir}/features/miladymaxxer.js`,
    `${outDir}/features/beetol.js`,
    `${outDir}/features/reminetChat.js`,
    `${outDir}/ocr.html`,
    `${outDir}/ocrHost.js`,
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
}
