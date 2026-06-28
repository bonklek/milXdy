import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { releaseBuilds } from "./release-builds.mjs";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const version = String(packageJson.version || "").trim();
const releaseDir = "release";
const checksumFile = `${releaseDir}/milXdy-${version}-checksums.sha256`;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await verifyReleaseChecksums();
  console.log("Release checksum verification passed.");
}

export async function verifyReleaseChecksums() {
  const manifestText = await readFile(checksumFile, "utf8");
  const actual = parseChecksumManifest(manifestText);
  const expectedArchives = releaseBuilds
    .map((build) => `milXdy-${version}-${build.target}-${build.profile}.zip`)
    .sort();
  assertEqualList(Array.from(actual.keys()).sort(), expectedArchives, `${checksumFile}: archive list mismatch`);

  for (const fileName of expectedArchives) {
    const archive = `${releaseDir}/${fileName}`;
    const info = await stat(archive);
    if (!info.isFile() || info.size <= 0) throw new Error(`${archive}: archive missing or empty`);
    const hash = await sha256File(archive);
    if (hash !== actual.get(fileName)) {
      throw new Error(`${checksumFile}: checksum mismatch for ${fileName}`);
    }
  }
}

function parseChecksumManifest(text) {
  const entries = new Map();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const match = line.match(/^([a-f0-9]{64}) {2}(.+\.zip)$/);
    if (!match) throw new Error(`${checksumFile}: invalid checksum line ${index + 1}`);
    const [, hash, fileName] = match;
    if (fileName !== basename(fileName)) throw new Error(`${checksumFile}: checksum file names must be basenames: ${fileName}`);
    if (entries.has(fileName)) throw new Error(`${checksumFile}: duplicate checksum entry ${fileName}`);
    entries.set(fileName, hash);
  }
  return entries;
}

async function sha256File(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

function assertEqualList(actual, expected, message) {
  const actualText = actual.join(", ");
  const expectedText = expected.join(", ");
  if (actualText !== expectedText) {
    throw new Error(`${message}\n  expected: ${expectedText}\n  actual:   ${actualText}`);
  }
}
