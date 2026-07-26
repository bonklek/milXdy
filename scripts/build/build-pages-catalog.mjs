import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const sourceDir = path.join(root, "catalog");
const outputDir = path.join(root, "tmp", "pages-catalog-site");
const brandOutputDir = path.join(outputDir, "assets", "brand");

await rm(outputDir, { recursive: true, force: true });
await mkdir(outputDir, { recursive: true });
await cp(sourceDir, outputDir, { recursive: true });
await mkdir(brandOutputDir, { recursive: true });

for (const filename of ["milxdy-logo-square-bevel.png", "milxdy-logo-square.png"]) {
  await cp(
    path.join(root, "assets", "brand", filename),
    path.join(brandOutputDir, filename),
  );
}

console.log(`Built static Pages catalog at ${path.relative(root, outputDir).replaceAll(path.sep, "/")}/`);
