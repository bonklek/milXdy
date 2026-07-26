import { cp, mkdir, rm } from "node:fs/promises";
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

for (const destination of [outputDir, catalogOutputDir]) {
  const brandOutputDir = path.join(destination, "assets", "brand");
  await mkdir(brandOutputDir, { recursive: true });
  for (const filename of ["milxdy-logo-square-bevel.png", "milxdy-logo-square.png"]) {
    await cp(path.join(root, "assets", "brand", filename), path.join(brandOutputDir, filename));
  }
}

console.log(`Built onboarding site and /addons catalog at ${path.relative(root, outputDir).replaceAll(path.sep, "/")}/`);
