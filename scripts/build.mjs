import { cp, copyFile, mkdir, readFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import esbuild from "esbuild";

const watch = process.argv.includes("--watch");

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });
await mkdir("dist/features", { recursive: true });

await copyFile("public/manifest.json", "dist/manifest.json");
await copyFile("public/popup.html", "dist/popup.html");
await copyFile("public/popup.css", "dist/popup.css");
await copyFile("public/ocr.html", "dist/ocr.html");
if (existsSync("public/miladymaxxer/milady-logo.png")) {
  await copyFile("public/miladymaxxer/milady-logo.png", "dist/milady-logo.png");
}

for (const dir of ["icons", "remistats", "beetol", "miladymaxxer", "models", "generated", "wiki-helper"]) {
  if (existsSync(`public/${dir}`)) {
    await cp(`public/${dir}`, `dist/${dir}`, { recursive: true });
  }
}
if (existsSync("src/features/remistats/remistats.css")) {
  await copyFile("src/features/remistats/remistats.css", "dist/remistats/remistats.css");
}
if (existsSync("src/features/beetol/content.css")) {
  await copyFile("src/features/beetol/content.css", "dist/beetol/content.css");
}
if (existsSync("src/features/reminetChat/content.css")) {
  await mkdir("dist/reminetChat", { recursive: true });
  await copyFile("src/features/reminetChat/content.css", "dist/reminetChat/content.css");
}

await mkdir("dist/ocr/core", { recursive: true });
await mkdir("dist/ocr/lang", { recursive: true });
if (existsSync("node_modules/tesseract.js/dist/worker.min.js")) {
  await copyFile("node_modules/tesseract.js/dist/worker.min.js", "dist/ocr/worker.min.js");
}
if (existsSync("node_modules/tesseract.js-core")) {
  await cp("node_modules/tesseract.js-core", "dist/ocr/core", { recursive: true });
}
if (existsSync("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz")) {
  await copyFile("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz", "dist/ocr/lang/eng.traineddata.gz");
}
if (existsSync("node_modules/onnxruntime-web/dist")) {
  await cp("node_modules/onnxruntime-web/dist", "dist/ort", { recursive: true });
}
await pruneSourceMaps("dist");

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
  outdir: "dist",
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
  outdir: "dist",
  format: "esm",
});

await buildOrWatch({
  ...common,
  entryPoints: {
    worker: source("src/features/miladymaxxer/worker.ts"),
    ocrHost: source("src/features/postreader/ocrHost.ts"),
  },
  outdir: "dist",
  format: "iife",
});

if (watch) {
  console.log(`Watching milXdy Browser extension files with ${contexts.length} build contexts...`);
}

if (!watch) {
  const required = [
    "dist/content.js",
    "dist/features/wiki.js",
    "dist/features/postreader.js",
    "dist/features/remistats.js",
    "dist/features/miladymaxxer.js",
    "dist/features/beetol.js",
    "dist/features/reminetChat.js",
    "dist/ocr.html",
    "dist/ocrHost.js",
  ];
  const missing = required.filter((file) => !existsSync(file));
  if (missing.length > 0) {
    throw new Error(`Missing split bundle output: ${missing.join(", ")}`);
  }
  const bootstrap = await readFile("dist/content.js", "utf8");
  const forbiddenBootstrapNeedles = ["tesseract", "onnxruntime", "wiki-index.generated", "createScoreBadge", "mountBeetolGame"];
  const foundNeedles = forbiddenBootstrapNeedles.filter((needle) => bootstrap.toLowerCase().includes(needle.toLowerCase()));
  if (foundNeedles.length > 0) {
    throw new Error(`Content bootstrap contains feature implementation strings: ${foundNeedles.join(", ")}`);
  }
}
