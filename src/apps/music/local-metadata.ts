// Local audio tags and duration probing; no remote enrichment or library state.
type ParsedAudioMetadata = {
  title?: string;
  artist?: string;
  album?: string;
  isrc?: string;
  artworkDataUrl?: string;
};

export async function readMetadata(file: File): Promise<{ title: string; artist: string; album: string; isrc: string | null; durationMs: number | null; artworkDataUrl?: string }> {
  const lower = file.name.toLowerCase();
  const tags = lower.endsWith(".mp3")
    ? await readId3v2(file)
    : lower.endsWith(".flac")
      ? await readFlacMetadata(file)
      : lower.endsWith(".m4a") || lower.endsWith(".mp4") || lower.endsWith(".alac")
        ? await readMp4Metadata(file)
        : {};
  const durationMs = await readDuration(file).catch(() => null);
  return {
    title: tags.title || "",
    artist: tags.artist || "",
    album: tags.album || "",
    isrc: tags.isrc || null,
    durationMs,
    artworkDataUrl: tags.artworkDataUrl,
  };
}

async function readId3v2(file: File): Promise<ParsedAudioMetadata> {
  const header = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (header[0] !== 0x49 || header[1] !== 0x44 || header[2] !== 0x33) return {};
  const major = header[3];
  const tagSize = syncSafe(header.subarray(6, 10));
  const bytes = new Uint8Array(await file.slice(10, 10 + tagSize).arrayBuffer());
  const out: ParsedAudioMetadata = {};
  let offset = 0;
  while (offset + 10 <= bytes.length) {
    const id = ascii(bytes.subarray(offset, offset + 4));
    if (!/^[A-Z0-9]{4}$/.test(id)) break;
    const size = major === 4 ? syncSafe(bytes.subarray(offset + 4, offset + 8)) : uint32(bytes.subarray(offset + 4, offset + 8));
    if (size <= 0 || offset + 10 + size > bytes.length) break;
    const frame = bytes.subarray(offset + 10, offset + 10 + size);
    const value = id === "APIC" ? "" : decodeTextFrame(frame);
    if (id === "TIT2") out.title = value;
    if (id === "TPE1") out.artist = value;
    if (id === "TALB") out.album = value;
    if (id === "TSRC") out.isrc = value;
    if (id === "APIC" && !out.artworkDataUrl) out.artworkDataUrl = parseApicFrame(frame);
    offset += 10 + size;
  }
  return out;
}

async function readFlacMetadata(file: File): Promise<ParsedAudioMetadata> {
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (ascii(header) !== "fLaC") return {};
  let offset = 4;
  while (offset + 4 <= file.size && offset < 2_000_000) {
    const blockHeader = new Uint8Array(await file.slice(offset, offset + 4).arrayBuffer());
    const isLast = Boolean(blockHeader[0] & 0x80);
    const type = blockHeader[0] & 0x7f;
    const size = (blockHeader[1] << 16) | (blockHeader[2] << 8) | blockHeader[3];
    offset += 4;
    if (size <= 0 || offset + size > file.size) break;
    if (type === 6) {
      const block = new Uint8Array(await file.slice(offset, offset + size).arrayBuffer());
      const artworkDataUrl = parseFlacPictureBlock(block);
      if (artworkDataUrl) return { artworkDataUrl };
    }
    offset += size;
    if (isLast) break;
  }
  return {};
}

function parseFlacPictureBlock(bytes: Uint8Array): string | undefined {
  if (bytes.length < 32) return undefined;
  let offset = 4;
  const mimeLength = uint32(bytes.subarray(offset, offset + 4));
  offset += 4;
  if (mimeLength <= 0 || offset + mimeLength > bytes.length) return undefined;
  const mime = ascii(bytes.subarray(offset, offset + mimeLength)).toLowerCase();
  offset += mimeLength;
  if (offset + 4 > bytes.length) return undefined;
  const descriptionLength = uint32(bytes.subarray(offset, offset + 4));
  offset += 4 + descriptionLength;
  offset += 16;
  if (offset + 4 > bytes.length) return undefined;
  const imageLength = uint32(bytes.subarray(offset, offset + 4));
  offset += 4;
  if (imageLength <= 0 || offset + imageLength > bytes.length || imageLength > 1_500_000) return undefined;
  const normalizedMime = mime === "image/jpg" ? "image/jpeg" : mime;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(normalizedMime)) return undefined;
  return `data:${normalizedMime};base64,${base64Bytes(bytes.subarray(offset, offset + imageLength))}`;
}

async function readMp4Metadata(file: File): Promise<ParsedAudioMetadata> {
  const bytes = new Uint8Array(await file.slice(0, Math.min(file.size, 4_000_000)).arrayBuffer());
  const covr = findMp4Atom(bytes, "covr");
  if (!covr) return {};
  const data = findMp4Atom(covr, "data");
  if (!data || data.length <= 16) return {};
  const typeCode = uint32(data.subarray(8, 12));
  const mime = typeCode === 13 ? "image/jpeg" : typeCode === 14 ? "image/png" : "image/jpeg";
  const image = data.subarray(16);
  if (!image.length || image.length > 1_500_000) return {};
  return { artworkDataUrl: `data:${mime};base64,${base64Bytes(image)}` };
}

function findMp4Atom(bytes: Uint8Array, target: string): Uint8Array | null {
  let offset = 0;
  while (offset + 8 <= bytes.length) {
    let size = uint32(bytes.subarray(offset, offset + 4));
    const type = ascii(bytes.subarray(offset + 4, offset + 8));
    let headerSize = 8;
    if (size === 1 && offset + 16 <= bytes.length) {
      const large = Number(uint64(bytes.subarray(offset + 8, offset + 16)));
      if (!Number.isSafeInteger(large)) return null;
      size = large;
      headerSize = 16;
    }
    if (size < headerSize || offset + size > bytes.length) break;
    const body = bytes.subarray(offset + headerSize, offset + size);
    if (type === target) return body;
    const nested = ["moov", "udta", "meta", "ilst", "covr"].includes(type)
      ? findMp4Atom(type === "meta" ? body.subarray(4) : body, target)
      : null;
    if (nested) return nested;
    offset += size;
  }
  return null;
}

function uint64(bytes: Uint8Array): bigint {
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  return value;
}

function syncSafe(bytes: Uint8Array): number {
  return ((bytes[0] & 0x7f) << 21) | ((bytes[1] & 0x7f) << 14) | ((bytes[2] & 0x7f) << 7) | (bytes[3] & 0x7f);
}

function uint32(bytes: Uint8Array): number {
  return (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
}

function decodeTextFrame(bytes: Uint8Array): string {
  if (!bytes.length) return "";
  const encoding = bytes[0];
  const data = bytes.subarray(1);
  const label = encoding === 1 || encoding === 2 ? "utf-16" : "utf-8";
  return new TextDecoder(label).decode(data).replace(/\0+$/g, "").trim();
}

function parseApicFrame(bytes: Uint8Array): string | undefined {
  if (bytes.length < 8) return undefined;
  let offset = 1;
  const mimeEnd = bytes.indexOf(0, offset);
  if (mimeEnd <= offset) return undefined;
  const mime = ascii(bytes.subarray(offset, mimeEnd)).toLowerCase();
  offset = mimeEnd + 1;
  offset += 1;
  const descriptionEnd = findTextTerminator(bytes, offset, bytes[0]);
  if (descriptionEnd < 0) return undefined;
  const imageStart = descriptionEnd + (bytes[0] === 1 || bytes[0] === 2 ? 2 : 1);
  if (imageStart >= bytes.length) return undefined;
  const image = bytes.subarray(imageStart);
  if (!image.length || image.length > 1_500_000) return undefined;
  const normalizedMime = mime === "image/jpg" ? "image/jpeg" : mime;
  if (!/^image\/(jpeg|png|webp|gif)$/.test(normalizedMime)) return undefined;
  return `data:${normalizedMime};base64,${base64Bytes(image)}`;
}

function findTextTerminator(bytes: Uint8Array, offset: number, encoding: number): number {
  if (encoding === 1 || encoding === 2) {
    for (let index = offset; index + 1 < bytes.length; index += 2) {
      if (bytes[index] === 0 && bytes[index + 1] === 0) return index;
    }
    return -1;
  }
  return bytes.indexOf(0, offset);
}

function base64Bytes(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}

function ascii(bytes: Uint8Array): string {
  return Array.from(bytes).map((byte) => String.fromCharCode(byte)).join("");
}

function readDuration(file: File): Promise<number | null> {
  return new Promise((resolve) => {
    const probe = document.createElement("audio");
    const url = URL.createObjectURL(file);
    const done = (value: number | null) => {
      URL.revokeObjectURL(url);
      probe.removeAttribute("src");
      probe.load();
      resolve(value);
    };
    probe.preload = "metadata";
    probe.addEventListener("loadedmetadata", () => done(Number.isFinite(probe.duration) ? Math.round(probe.duration * 1000) : null), { once: true });
    probe.addEventListener("error", () => done(null), { once: true });
    probe.src = url;
  });
}

