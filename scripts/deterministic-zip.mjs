import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { deflateRawSync } from "node:zlib";

const DEFAULT_SOURCE_DATE_EPOCH = 1704067200;
const ZIP_VERSION_NEEDED = 20;
const ZIP_PLATFORM_UNIX = 3;
const ZIP_COMPRESSION_DEFLATE = 8;
const ZIP_GENERAL_PURPOSE_UTF8 = 0x0800;
const FILE_MODE = 0o100644;

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

export async function createDeterministicZip(sourceDir, archive, options = {}) {
  const entries = await collectFileEntries(sourceDir);
  const timestamp = zipTimestamp(options.sourceDateEpoch ?? readSourceDateEpoch());
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const input = await readFile(entry.path);
    const compressed = deflateRawSync(input, { level: 9 });
    const crc = crc32(input);

    const localHeader = Buffer.alloc(30 + name.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(ZIP_VERSION_NEEDED, 4);
    localHeader.writeUInt16LE(ZIP_GENERAL_PURPOSE_UTF8, 6);
    localHeader.writeUInt16LE(ZIP_COMPRESSION_DEFLATE, 8);
    localHeader.writeUInt16LE(timestamp.time, 10);
    localHeader.writeUInt16LE(timestamp.date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(input.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);
    name.copy(localHeader, 30);

    const centralHeader = Buffer.alloc(46 + name.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE((ZIP_PLATFORM_UNIX << 8) | ZIP_VERSION_NEEDED, 4);
    centralHeader.writeUInt16LE(ZIP_VERSION_NEEDED, 6);
    centralHeader.writeUInt16LE(ZIP_GENERAL_PURPOSE_UTF8, 8);
    centralHeader.writeUInt16LE(ZIP_COMPRESSION_DEFLATE, 10);
    centralHeader.writeUInt16LE(timestamp.time, 12);
    centralHeader.writeUInt16LE(timestamp.date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(input.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE((FILE_MODE << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    name.copy(centralHeader, 46);

    localParts.push(localHeader, compressed);
    centralParts.push(centralHeader);
    offset += localHeader.length + compressed.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(0, 4);
  endOfCentralDirectory.writeUInt16LE(0, 6);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  endOfCentralDirectory.writeUInt16LE(0, 20);

  await writeFile(archive, Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]));
}

export async function collectFileEntries(sourceDir) {
  const root = normalizePath(sourceDir);
  const entries = [];
  await walk(root, "");
  return entries.sort((a, b) => a.name.localeCompare(b.name));

  async function walk(dir, prefix) {
    const children = await readdir(dir, { withFileTypes: true });
    children.sort((a, b) => a.name.localeCompare(b.name));
    for (const child of children) {
      const childPath = `${dir}/${child.name}`;
      const childName = prefix ? `${prefix}/${child.name}` : child.name;
      if (child.isDirectory()) {
        await walk(childPath, childName);
        continue;
      }
      if (!child.isFile()) continue;
      const info = await stat(childPath);
      if (!info.isFile()) continue;
      entries.push({
        name: childName.replace(/\\/g, "/"),
        path: childPath,
      });
    }
  }
}

export function readSourceDateEpoch() {
  const raw = process.env.SOURCE_DATE_EPOCH;
  if (raw == null || raw === "") return DEFAULT_SOURCE_DATE_EPOCH;
  if (!/^\d+$/.test(raw)) throw new Error(`SOURCE_DATE_EPOCH must be a Unix timestamp in seconds, got "${raw}"`);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`SOURCE_DATE_EPOCH is outside the supported integer range: "${raw}"`);
  return value;
}

function zipTimestamp(sourceDateEpoch) {
  const date = new Date(sourceDateEpoch * 1000);
  const beforeZipEpoch = date.getUTCFullYear() < 1980;
  const year = beforeZipEpoch ? 1980 : date.getUTCFullYear();
  const month = beforeZipEpoch ? 1 : date.getUTCMonth() + 1;
  const day = beforeZipEpoch ? 1 : date.getUTCDate();
  const hours = beforeZipEpoch ? 0 : date.getUTCHours();
  const minutes = beforeZipEpoch ? 0 : date.getUTCMinutes();
  const seconds = beforeZipEpoch ? 0 : Math.floor(date.getUTCSeconds() / 2);
  return {
    date: ((year - 1980) << 9) | (month << 5) | day,
    time: (hours << 11) | (minutes << 5) | seconds,
  };
}

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function normalizePath(value) {
  return value.replace(/\\/g, "/").replace(/\/+$/, "");
}
