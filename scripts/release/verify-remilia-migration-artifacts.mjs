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
    for (const entry of listZipEntries(archive).sort((a, b) => a.fileName.localeCompare(b.fileName))) {
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
  if (content.length > 16 * 1024 * 1024 || content.includes(0)) return false;
  return /(?:^|\/)(?:[^/]+\.(?:css|csv|html|js|json|md|mjs|svg|txt|xml)|LICENSE|NOTICE)$/i.test(fileName);
}

function readZipEntry(zip, entry) {
  const compressed = zip.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.compressionMethod === 0) return Buffer.from(compressed);
  if (entry.compressionMethod === 8) return inflateRawSync(compressed);
  throw new Error(`${entry.fileName}: unsupported ZIP compression method ${entry.compressionMethod}`);
}

export function listZipEntries(zip) {
  const eocdOffset = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  const directoryOffset = zip.readUInt32LE(eocdOffset + 16);
  let offset = directoryOffset;
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("Invalid ZIP central directory");
    const compressionMethod = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const fileName = zip.subarray(offset + 46, offset + 46 + fileNameLength).toString("utf8").replace(/\\/g, "/");
    if (!fileName.endsWith("/")) {
      if (zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error(`${fileName}: invalid ZIP local header`);
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

function findEndOfCentralDirectory(zip) {
  for (let offset = zip.length - 22; offset >= Math.max(0, zip.length - 65_557); offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("ZIP end-of-central-directory record not found");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}
