import { mkdir, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { releaseBuilds } from "./release-builds.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const version = String(packageJson.version || "").trim();
const tempRoot = join(tmpdir(), `milxdy-reproducible-${process.pid}`);

await rm(tempRoot, { recursive: true, force: true });
await mkdir(tempRoot, { recursive: true });

try {
  for (const build of releaseBuilds) {
    const fileName = `milXdy-${version}-${build.target}-${build.profile}.zip`;
    const releaseArchive = `release/${fileName}`;
    const firstArchive = join(tempRoot, `first-${fileName}`);
    const secondArchive = join(tempRoot, `second-${fileName}`);

    await createDeterministicZip(build.dir, firstArchive);
    await createDeterministicZip(build.dir, secondArchive);

    const releaseHash = await sha256File(releaseArchive);
    const firstHash = await sha256File(firstArchive);
    const secondHash = await sha256File(secondArchive);
    if (firstHash !== secondHash) {
      throw new Error(`${fileName}: deterministic packaging produced two different hashes\n  first:  ${firstHash}\n  second: ${secondHash}`);
    }
    if (releaseHash !== firstHash) {
      throw new Error(`${fileName}: release archive does not match a fresh deterministic rebuild\n  release: ${releaseHash}\n  rebuilt: ${firstHash}`);
    }
    console.log(`${fileName} reproducible: ${releaseHash}`);
  }
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}

console.log("Release archive reproducibility verification passed.");

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}
