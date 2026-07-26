import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const pagesDir = path.join(root, "pages");
const catalogDir = path.join(root, "catalog");
const outputDir = path.join(root, "tmp", "pages-catalog-site");
const catalogOutputDir = path.join(outputDir, "addons");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(pagesDir, outputDir, { recursive: true });
await cp(catalogDir, catalogOutputDir, { recursive: true });
await cp(path.join(catalogDir, "assets", "styles.css"), path.join(outputDir, "assets", "catalog.css"));

// Keep the former root-catalog paths valid for one migration window. Cached
// root HTML either redirects through pages/assets/catalog.js or, if its old
// module is also cached, can still load the metadata and dependencies it needs.
await cp(path.join(catalogDir, "assets", "styles.css"), path.join(outputDir, "assets", "styles.css"));
await cp(path.join(catalogDir, "assets", "selection.js"), path.join(outputDir, "assets", "selection.js"));
await cp(path.join(catalogDir, "data"), path.join(outputDir, "data"), { recursive: true });

for (const destination of [outputDir, catalogOutputDir]) {
  const brandOutputDir = path.join(destination, "assets", "brand");
  const fontOutputDir = path.join(destination, "assets", "fonts");
  await mkdir(brandOutputDir, { recursive: true });
  await mkdir(fontOutputDir, { recursive: true });
  for (const filename of ["milxdy-logo-square-bevel.png", "milxdy-logo-square.png"]) {
    await cp(path.join(root, "assets", "brand", filename), path.join(brandOutputDir, filename));
  }
  await cp(path.join(root, "assets", "shared", "fonts", "Hei.ttf"), path.join(fontOutputDir, "Hei.ttf"));
}

const assetVersion = (process.env.PAGES_ASSET_VERSION || process.env.GITHUB_SHA || "local").slice(0, 16);
for (const htmlFile of [
  path.join(outputDir, "index.html"),
  path.join(catalogOutputDir, "index.html"),
  path.join(catalogOutputDir, "add-ons", "index.html"),
]) {
  const html = await readFile(htmlFile, "utf8");
  await writeFile(htmlFile, html.replaceAll("__PAGES_ASSET_VERSION__", assetVersion));
}

console.log(`Built onboarding site and /addons catalog at ${path.relative(root, outputDir).replaceAll(path.sep, "/")}/`);
