import { cp, mkdir, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createDeterministicZip } from "./deterministic-zip.mjs";

const sourceDir = "assets/user-downloads/remilia-pet/remilia-maker-pet-import";
const archiveDir = "assets/user-downloads/remilia-pet";
const archive = `${archiveDir}/remilia-maker-pet-import.zip`;

await mkdir(archiveDir, { recursive: true });
const stageParent = await mkdtemp(path.join(os.tmpdir(), "milxdy-remilia-pet-skill-"));
const stageDir = path.join(stageParent, "remilia-maker-pet-import");
try {
  await cp(sourceDir, stageDir, {
    recursive: true,
    filter(source) {
      const base = path.basename(source);
      return base !== "__pycache__" && !base.endsWith(".pyc") && !base.endsWith(".pyo");
    },
  });
  await createDeterministicZip(stageDir, archive);
  console.log(`Built ${archive}`);
} finally {
  await rm(stageParent, { recursive: true, force: true });
}
