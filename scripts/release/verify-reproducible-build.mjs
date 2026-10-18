import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { releaseBuilds } from "./release-builds.mjs";
import { createDeterministicZip } from "../build/deterministic-zip.mjs";

// Run after npm ci with source held fixed. This checks compilation/copying as
// well as packaging; it deliberately does not replace normal dist or release.
await mkdir("tmp", { recursive: true });
const root = await mkdtemp("tmp/verify-source-build-");
try {
  for (const build of releaseBuilds) {
    const hashes = [];
    for (const attempt of [1, 2]) {
      const directory = `${root}/${build.target}-${attempt}`;
      const result = spawnSync(process.execPath, [
        "scripts/build/build-extension.mjs",
        `--target=${build.target}`, `--channel=${build.channel}`,
        `--profile=${build.profile}`, `--output-dir=${directory}`,
      ], { stdio: "inherit", windowsHide: true });
      if (result.error) throw result.error;
      if (result.status !== 0) throw new Error(`${build.target} build ${attempt} failed: ${result.status}`);
      const archive = `${root}/${build.target}-${attempt}.zip`;
      await createDeterministicZip(directory, archive);
      hashes.push(createHash("sha256").update(await readFile(archive)).digest("hex"));
    }
    if (hashes[0] !== hashes[1]) {
      throw new Error(`${build.target}: fresh builds differ\nfirst: ${hashes[0]}\nsecond: ${hashes[1]}`);
    }
    console.log(`${build.target}: two fresh builds match ${hashes[0]}`);
  }
} finally {
  await rm(root, { recursive: true, force: true });
}
console.log("Fresh build reproducibility passed for the current source and installed dependency tree.");
