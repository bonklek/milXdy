import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateRawSync } from "node:zlib";
import { releaseBuilds } from "./release-builds.mjs";
import { withReleaseArtifactLock } from "./release-artifact-lock.mjs";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const version = String(packageJson.extensionVersion || packageJson.version || "").trim();
const reportPath = `tmp/release-evidence/remilia-migration-artifact-scan-${version}.json`;
const MAX_ARCHIVE_ENTRY_BYTES = 256 * 1024 * 1024;
const MAX_TEXT_SCAN_BYTES = 16 * 1024 * 1024;
const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  crcTable[index] = value >>> 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await withReleaseArtifactLock("verify Remilia migration release artifacts", async () => {
    const first = await scanArchives();
    const second = await scanArchives();
    const firstText = `${JSON.stringify(first, null, 2)}\n`;
    const secondText = `${JSON.stringify(second, null, 2)}\n`;
    if (firstText !== secondText) throw new Error("Remilia migration artifact scan report is not reproducible");
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, firstText, "utf8");
    console.log(`Remilia migration artifact scan passed: ${first.reportSha256}`);
    console.log(`Report: ${reportPath}`);
  });
}

async function scanArchives() {
  const archives = [];
  for (const build of [...releaseBuilds].sort((a, b) => a.target.localeCompare(b.target))) {
    const path = `release/milXdy-${version}-${build.target}.zip`;
    const archive = await readFile(path);
    const files = [];
    const entries = listZipEntries(archive).sort((a, b) => a.fileName.localeCompare(b.fileName));
    for (const entry of entries) {
      const content = readZipEntry(archive, entry);
      scanContent(path, entry.fileName, content);
      files.push({
        path: entry.fileName,
        bytes: content.length,
        sha256: sha256(content),
      });
    }
    archives.push({
      target: build.target,
      path,
      bytes: archive.length,
      sha256: sha256(archive),
      files,
    });
  }
  const report = { schemaVersion: 1, release: version, archives };
  return { ...report, reportSha256: sha256(Buffer.from(JSON.stringify(report))) };
}

export function scanContent(archivePath, entryName, content) {
  if (!isTextCandidate(entryName, content)) return;
  const text = content.toString("utf8");
  const prohibited = [
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/i, "private key"],
    [/(?:^|[^A-Za-z0-9_-])eyJ[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}(?:$|[^A-Za-z0-9_-])/i, "JWT-like credential"],
    [/Authorization:\s*Bearer\s+(?!<|\$|\{|YOUR_|ACCESS_TOKEN)[A-Za-z0-9._~-]{12,}/i, "bearer credential"],
    [/(?:REMILIA_CLIENT_SECRET|CLIENT_SECRET)\s*=\s*["']?[A-Za-z0-9._~-]{8,}/i, "client secret assignment"],
    [/[A-Za-z]:[\\/](?:Users|Documents)[\\/]/i, "Windows machine path"],
    [/\/(?:Users|home)\/[^/\s]+\//i, "POSIX machine path"],
    [/(?:^|[\\/])\.codex[\\/]worktrees[\\/]/i, "Codex worktree path"],
    [/\bRetry session\b/i, "retired browser-session UI"],
    [/\bOpen RemiliaNET\b/i, "retired browser-session UI"],
  ];
  for (const [pattern, label] of prohibited) {
    if (pattern.test(text)) throw new Error(`${archivePath}:${entryName}: ${label} detected`);
  }
}

function isTextCandidate(fileName, content) {
  if (content.length > MAX_TEXT_SCAN_BYTES || content.includes(0)) return false;
  return /(?:^|\/)(?:[^/]+\.(?:css|csv|html|js|json|md|mjs|svg|txt|xml)|LICENSE|NOTICE)$/i.test(fileName);
}

export function readZipEntry(zip, entry) {
  const compressed = zip.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  let content;
  if (entry.compressionMethod === 0) content = Buffer.from(compressed);
  else if (entry.compressionMethod === 8) content = inflateRawSync(compressed, { maxOutputLength: MAX_ARCHIVE_ENTRY_BYTES });
  else throw new Error(`${entry.fileName}: unsupported ZIP compression method ${entry.compressionMethod}`);
  if (content.length !== entry.uncompressedSize) throw new Error(`${entry.fileName}: ZIP uncompressed size mismatch`);
  if (crc32(content) !== entry.crc32) throw new Error(`${entry.fileName}: ZIP CRC mismatch`);
  return content;
}

export function listZipEntries(zip) {
  const eocdOffset = findEndOfCentralDirectory(zip);
  if (zip.readUInt16LE(eocdOffset + 4) !== 0 || zip.readUInt16LE(eocdOffset + 6) !== 0) {
    throw new Error("Multi-disk ZIP archives are unsupported");
  }
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  if (entryCount !== zip.readUInt16LE(eocdOffset + 8)) throw new Error("ZIP entry count mismatch");
  const directorySize = zip.readUInt32LE(eocdOffset + 12);
  const directoryOffset = zip.readUInt32LE(eocdOffset + 16);
  if (directoryOffset + directorySize !== eocdOffset) throw new Error("Invalid ZIP central directory bounds");
  let offset = directoryOffset;
  const entries = [];
  const names = new Set();
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > eocdOffset) throw new Error("Truncated ZIP central directory");
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid ZIP central directory");
    const flags = zip.readUInt16LE(offset + 8);
    if (flags & 0x0001) throw new Error("Encrypted ZIP entries are unsupported");
    const compressionMethod = zip.readUInt16LE(offset + 10);
    const crc32Value = zip.readUInt32LE(offset + 16);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    if (uncompressedSize > MAX_ARCHIVE_ENTRY_BYTES) throw new Error("ZIP entry exceeds scan size limit");
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const nextOffset = offset + 46 + fileNameLength + extraLength + commentLength;
    if (nextOffset > eocdOffset) throw new Error("Truncated ZIP central directory entry");
    const fileName = zip.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8").replace(/\\/g, "/");
    validateEntryName(fileName);
    if (names.has(fileName)) throw new Error(`${fileName}: duplicate ZIP entry`);
    names.add(fileName);
    if (!fileName.endsWith("/")) {
      if (localHeaderOffset + 30 > directoryOffset) throw new Error(`${fileName}: invalid ZIP local header bounds`);
      if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error(`${fileName}: invalid ZIP local header`);
      if (zip.readUInt16LE(localHeaderOffset + 6) !== flags) throw new Error(`${fileName}: ZIP flag mismatch`);
      if (zip.readUInt16LE(localHeaderOffset + 8) !== compressionMethod) throw new Error(`${fileName}: ZIP compression mismatch`);
      const localNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
      const localName = zip.subarray(localHeaderOffset + 30, localHeaderOffset + 30 + localNameLength).toString("utf8").replace(/\\/g, "/");
      if (localName !== fileName) throw new Error(`${fileName}: ZIP local/central name mismatch`);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      if (dataOffset + compressedSize > directoryOffset) throw new Error(`${fileName}: ZIP data exceeds local-file bounds`);
      entries.push({
        fileName,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        crc32: crc32Value,
        dataOffset,
      });
    }
    offset = nextOffset;
  }
  if (offset !== eocdOffset) throw new Error("ZIP central directory size mismatch");
  return entries;
}

function validateEntryName(fileName) {
  if (!fileName || fileName.startsWith("/") || /^[A-Za-z]:\//.test(fileName)) {
    throw new Error(`${fileName || "<empty>"}: unsafe ZIP entry path`);
  }
  const segments = fileName.endsWith("/") ? fileName.slice(0, -1).split("/") : fileName.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error(`${fileName}: unsafe ZIP entry path`);
  }
}

function findEndOfCentralDirectory(zip) {
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65_557); offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP end-of-central-directory record not found");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}
