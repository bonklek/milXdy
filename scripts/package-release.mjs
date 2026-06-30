import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { inflateRawSync } from "node:zlib";
import { basename } from "node:path";
import { commonAssetDirs, contentScriptMatches, releaseBuilds, webAccessibleMatches } from "./release-builds.mjs";
import { appsForProfile, featureBundlesForProfile, hostPermissionsForProfile } from "./release-registry.mjs";
import { verifyReleaseChecksums } from "./verify-release-checksums.mjs";
import { createDeterministicZip } from "./deterministic-zip.mjs";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const registry = JSON.parse(await readFile("src/shared/firstPartyApps.json", "utf8"));
const version = String(packageJson.version || "").trim();
if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
  throw new Error(`package.json version must be a semver release version, got "${version}"`);
}

const releaseDir = "release";
const checksumFile = `${releaseDir}/milXdy-${version}-checksums.sha256`;
const checksums = [];
await mkdir(releaseDir, { recursive: true });
await rm(checksumFile, { force: true });

for (const build of releaseBuilds) {
  await verifyBuildDir(build);
  const archive = `${releaseDir}/milXdy-${version}-${build.target}.zip`;
  await rm(archive, { force: true });
  await createZip(build.dir, archive);
  await verifyArchive(archive, build);
  checksums.push(await checksumArchive(archive));
  console.log(`Created ${archive}`);
}

await writeChecksumManifest(checksums);
await verifyReleaseChecksums();
console.log(`Created ${checksumFile}`);

async function verifyBuildDir(build) {
  const manifestPath = `${build.dir}/manifest.json`;
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.version !== version) {
    throw new Error(`${manifestPath} version ${manifest.version} does not match package version ${version}`);
  }
  if (build.target === "firefox" && !manifest.browser_specific_settings?.gecko?.id) {
    throw new Error(`${manifestPath} is missing Firefox gecko settings`);
  }
  if (build.target === "chromium" && manifest.background?.service_worker !== "background.js") {
    throw new Error(`${manifestPath} is missing Chromium service worker background`);
  }
}

async function createZip(sourceDir, archive) {
  await createDeterministicZip(sourceDir, archive);
}

async function verifyArchive(archive, build) {
  const info = await stat(archive);
  if (!info.isFile() || info.size <= 0) throw new Error(`${archive} was not created`);
  const zip = await readFile(archive);
  const manifest = JSON.parse(readZipText(zip, "manifest.json"));
  if (manifest.version !== version) {
    throw new Error(`${archive} manifest version ${manifest.version} does not match package version ${version}`);
  }
  assertArchiveManifestShape(archive, build, manifest);
  assertArchiveFeatureSet(zip, archive, build);
  assertArchiveFiles(zip, archive, build);
  assertArchiveRuntimeMarkers(zip, archive, build);
  assertManifestResources(zip, archive, manifest);
  assertNoSourceMaps(zip, archive);
}

function assertArchiveManifestShape(archive, build, manifest) {
  if (manifest.manifest_version !== 3) throw new Error(`${archive}: manifest_version must be 3`);
  if (manifest.action?.default_popup !== "popup.html") throw new Error(`${archive}: action.default_popup must be popup.html`);
  const contentScripts = Array.isArray(manifest.content_scripts) ? manifest.content_scripts : [];
  const contentScript = contentScripts.find((script) => Array.isArray(script.js) && script.js.includes("content.js"));
  if (!contentScript) {
    throw new Error(`${archive}: content.js must be declared as a content script`);
  }
  assertEqualList([...(contentScript.matches || [])].sort(), [...contentScriptMatches].sort(), `${archive}: content script matches mismatch`);
  for (const block of manifest.web_accessible_resources || []) {
    assertEqualList([...(block.matches || [])].sort(), [...webAccessibleMatches].sort(), `${archive}: web accessible resource matches mismatch`);
  }
  if (build.target === "firefox") {
    if (!Array.isArray(manifest.background?.scripts) || manifest.background.scripts[0] !== "background.js") {
      throw new Error(`${archive}: Firefox archive must use background.scripts`);
    }
    if (manifest.background?.service_worker) throw new Error(`${archive}: Firefox archive must not use service_worker`);
    if (!manifest.browser_specific_settings?.gecko?.id) throw new Error(`${archive}: Firefox archive missing gecko id`);
  } else {
    if (manifest.background?.service_worker !== "background.js") throw new Error(`${archive}: Chromium archive must use background.service_worker`);
  }

  const apps = appsForProfile(registry, build.profile);
  const hosts = new Set(manifest.host_permissions || []);
  const expectedHosts = new Set(hostPermissionsForProfile(registry, build.profile));
  for (const host of expectedHosts) {
    if (!hosts.has(host)) throw new Error(`${archive}: missing host permission ${host}`);
  }
  if (build.profile !== "full") {
    for (const app of registry) {
      if (apps.includes(app)) continue;
      for (const host of app.permissions?.hosts || []) {
        if (hosts.has(host) && !expectedHosts.has(host)) {
          throw new Error(`${archive}: excluded app host permission leaked: ${app.id} ${host}`);
        }
      }
    }
  }
}

function readZipText(zip, entryName) {
  const entry = findZipEntry(zip, entryName);
  if (!entry) throw new Error(`${entryName} missing from archive`);
  const compressed = zip.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.compressionMethod === 0) return compressed.toString("utf8");
  if (entry.compressionMethod === 8) return inflateRawSync(compressed).toString("utf8");
  throw new Error(`${entryName} uses unsupported zip compression method ${entry.compressionMethod}`);
}

function findZipEntry(zip, entryName) {
  return listZipEntries(zip).find((entry) => entry.fileName === entryName) || null;
}

function listZipEntries(zip) {
  const eocdOffset = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  const directoryOffset = zip.readUInt32LE(eocdOffset + 16);
  let offset = directoryOffset;
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid zip central directory");
    const compressionMethod = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const fileName = zip.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8").replace(/\\/g, "/");
    if (!fileName.endsWith("/")) {
      if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error(`Invalid zip local header for ${fileName}`);
      const localNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
      entries.push({
        fileName,
        compressionMethod,
        compressedSize,
        dataOffset: localHeaderOffset + 30 + localNameLength + localExtraLength,
      });
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function assertArchiveFeatureSet(zip, archive, build) {
  const actual = listZipEntries(zip)
    .map((entry) => entry.fileName)
    .filter((fileName) => /^features\/[^/]+\.js$/.test(fileName))
    .map((fileName) => fileName.slice("features/".length))
    .sort();
  const expected = featureBundlesForProfile(registry, build.profile);
  assertEqualList(actual, expected, `${archive}: archived feature bundle set mismatch`);
}

function assertArchiveFiles(zip, archive, build) {
  const entries = new Set(listZipEntries(zip).map((entry) => entry.fileName));
  const apps = appsForProfile(registry, build.profile);
  const expectedFiles = [
    "manifest.json",
    "background.js",
    "content.js",
    "popup.html",
    "popup.css",
    "popup.js",
    ...apps.flatMap((app) => (app.requiredOutputs || [])),
    ...apps.flatMap((app) => (app.css || []).map((sheet) => `${sheet.targetDir}/${sheet.target}`)),
  ];
  for (const file of unique(expectedFiles)) {
    if (!entries.has(file)) throw new Error(`${archive}: expected file missing from archive: ${file}`);
  }

  for (const dir of unique([...commonAssetDirs, ...apps.flatMap((app) => app.assets || [])])) {
    assertArchiveDirectory(entries, archive, dir);
  }

  if (apps.some((app) => app.id === "post-reading")) {
    assertArchiveDirectory(entries, archive, "ocr");
    assertArchiveDirectory(entries, archive, "ocr/lang");
    for (const file of ["ocr/worker.min.js", "ocr/lang/eng.traineddata.gz"]) {
      if (!entries.has(file)) throw new Error(`${archive}: expected OCR file missing from archive: ${file}`);
    }
  }
  if (apps.some((app) => app.id === "miladymaxxer")) {
    for (const dir of ["ort", "generated", "models"]) assertArchiveDirectory(entries, archive, dir);
    if (!entries.has("milady-logo.png")) throw new Error(`${archive}: expected milady-logo.png missing from archive`);
  }
}

function assertArchiveRuntimeMarkers(zip, archive, build) {
  const content = readZipText(zip, "content.js");
  for (const marker of ["milxdyVersion", "milxdyBuildProfile", "milxdyBuildTarget", "milxdyPerformanceMode"]) {
    if (!content.includes(marker)) throw new Error(`${archive}: content.js missing runtime marker ${marker}`);
  }
  for (const value of [version, build.profile, build.target]) {
    if (!content.includes(JSON.stringify(value))) throw new Error(`${archive}: content.js missing runtime marker value ${value}`);
  }
}

function assertManifestResources(zip, archive, manifest) {
  const entries = listZipEntries(zip).map((entry) => entry.fileName);
  for (const block of manifest.web_accessible_resources || []) {
    for (const resource of block.resources || []) {
      if (!resourcePatternMatchesArchive(resource, entries)) {
        throw new Error(`${archive}: web_accessible_resources pattern has no packaged file: ${resource}`);
      }
    }
  }
}

function resourcePatternMatchesArchive(pattern, entries) {
  const normalized = String(pattern).replace(/\\/g, "/");
  if (!normalized.includes("*")) return entries.includes(normalized);
  const prefix = normalized.slice(0, normalized.indexOf("*"));
  const suffix = normalized.slice(normalized.indexOf("*") + 1);
  return entries.some((entry) => entry.startsWith(prefix) && entry.endsWith(suffix));
}

function assertNoSourceMaps(zip, archive) {
  const maps = listZipEntries(zip).map((entry) => entry.fileName).filter((fileName) => fileName.endsWith(".map"));
  if (maps.length > 0) throw new Error(`${archive}: source maps must not be packaged: ${maps.join(", ")}`);
}

function assertArchiveDirectory(entries, archive, dir) {
  const prefix = `${dir.replace(/\\/g, "/").replace(/\/+$/, "")}/`;
  if (!Array.from(entries).some((entry) => entry.startsWith(prefix))) {
    throw new Error(`${archive}: expected archive directory missing or empty: ${dir}`);
  }
}

function findEndOfCentralDirectory(zip) {
  const minOffset = Math.max(0, zip.length - 65557);
  for (let offset = zip.length - 22; offset >= minOffset; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("Invalid zip: end of central directory not found");
}

async function checksumArchive(archive) {
  const buffer = await readFile(archive);
  return {
    archive,
    fileName: basename(archive),
    hash: createHash("sha256").update(buffer).digest("hex"),
  };
}

async function writeChecksumManifest(entries) {
  const lines = entries
    .slice()
    .sort((a, b) => a.fileName.localeCompare(b.fileName))
    .map((entry) => `${entry.hash}  ${entry.fileName}`);
  await writeFile(checksumFile, `${lines.join("\n")}\n`);
}

function assertEqualList(actual, expected, message) {
  const actualText = actual.join(", ");
  const expectedText = expected.join(", ");
  if (actualText !== expectedText) {
    throw new Error(`${message}\n  expected: ${expectedText}\n  actual:   ${actualText}`);
  }
}

function unique(values) {
  return Array.from(new Set(values));
}
