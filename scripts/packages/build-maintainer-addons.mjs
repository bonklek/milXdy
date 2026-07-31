import { createHash } from "node:crypto";
import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import esbuild from "esbuild";

const packages = [
  {
    id: "composerTools",
    root: "packages/maintainer/composerTools",
    entry: "packages/maintainer/composerTools/src/content.ts",
    outfile: "packages/maintainer/composerTools/dist/content.js",
    files: ["dist/content.js"],
  },
];
const catalog = JSON.parse(await readFile("catalog/data/catalog.json", "utf8"));
const catalogById = new Map(catalog.sections.flatMap((section) => section.packages).map((entry) => [entry.id, entry]));

for (const pkg of packages) {
  await mkdir(path.dirname(pkg.outfile), { recursive: true });
  await esbuild.build({
    entryPoints: [pkg.entry],
    outfile: pkg.outfile,
    absWorkingDir: process.cwd(),
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "chrome120",
    sourcemap: false,
    legalComments: "none",
  });
  const actual = await packageHash(pkg.root, pkg.files);
  const expected = catalogById.get(pkg.id)?.artifact?.packageSha256;
  if (actual !== expected) {
    throw new Error(`${pkg.id} deterministic package hash changed: expected ${expected || "<missing>"}, got ${actual}. Review the payload before updating catalog and replacement-policy provenance.`);
  }
  console.log(`${pkg.id}: ${actual}`);
}

async function packageHash(root, files) {
  const hash = createHash("sha256");
  for (const file of files.slice().sort()) {
    hash.update(file);
    hash.update("\0");
    hash.update(await readFile(path.join(root, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}
