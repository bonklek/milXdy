import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { deflateSync } from "node:zlib";
import {
  createStoredZip,
  makePetRequest,
  stableJson,
  validatePetRequest,
} from "../../examples/packages/local-dev/tweet-composer-kit/src/custom-pet-contract.js";

const supportedFamilies = ["milady", "remilio", "bonkler", "kagami"];
const requestedFamily = readArg("--family");
const check = process.argv.includes("--check");
const families = requestedFamily ? [requestedFamily] : supportedFamilies;
for (const family of families) {
  if (!supportedFamilies.includes(family)) throw new Error(`Unsupported fixture family: ${family}`);
}

const outputRoot = "examples/fixtures/remilia-pet-request";
for (const family of families) {
  const outputDir = path.join(outputRoot, family);
  const avatar = makeSanitizedAvatar(family);
  const request = makePetRequest({
    templateFamily: family,
    imageSha256: createHash("sha256").update(avatar).digest("hex"),
    traits: makeTraits(family),
    bodyCompletion: makeBodyCompletion(family),
    rightsScope: "private-review",
    petName: `Sanitized ${family[0].toUpperCase()}${family.slice(1)}`,
    personality: "A sanitized local contract fixture with no user or reference image.",
  });
  const validation = await validatePetRequest(request, avatar);
  if (!validation.ok) throw new Error(`${family}: ${validation.errors.join(" ")}`);
  const requestJson = Buffer.from(stableJson(request), "utf8");
  const archive = createStoredZip([
    { name: "avatar.png", bytes: avatar },
    { name: "request.json", bytes: requestJson },
  ]);
  const outputs = new Map([
    [path.join(outputDir, "avatar.png"), avatar],
    [path.join(outputDir, "request.json"), requestJson],
    [path.join(outputDir, "remilia-pet-request.zip"), archive],
  ]);
  if (check) {
    for (const [file, expected] of outputs) {
      const actual = await readFile(file);
      if (!actual.equals(Buffer.from(expected))) throw new Error(`${file} is not reproducible.`);
    }
  } else {
    await mkdir(outputDir, { recursive: true });
    for (const [file, bytes] of outputs) await writeFile(file, bytes);
  }
  console.log(`${family}: ${check ? "verified" : "generated"} ${createHash("sha256").update(archive).digest("hex")}`);
}

function makeTraits(family) {
  return {
    race: { assetId: `${family}-sample-race-v1`, label: "Sanitized sample race" },
    hair: { assetId: `${family}-sample-hair-v1`, label: "Sanitized sample hair" },
    eyes: { assetId: `${family}-sample-eyes-v1`, label: "Sanitized sample eyes" },
    glasses: { assetId: "none", label: "None" },
    shirt: { assetId: `${family}-sample-shirt-v1`, label: "Sanitized sample shirt" },
    earrings: { assetId: "none", label: "None" },
  };
}

function makeBodyCompletion(family) {
  const byFamily = {
    milady: {
      legCoverage: "covered",
      legColorVariant: "warm-light",
      bottom: { category: "jeans", assetId: "maker-bottom-jeans-v1", assetVersion: 1, colorVariant: "denim-blue" },
      footwear: { category: "sneakers", assetId: "maker-footwear-sneakers-v1", assetVersion: 1, colorVariant: "white" },
    },
    remilio: {
      legCoverage: "exposed",
      legColorVariant: "warm-medium",
      bottom: { category: "cargo-shorts", assetId: "maker-bottom-cargo-shorts-v1", assetVersion: 1, colorVariant: "olive" },
      footwear: { category: "boots", assetId: "maker-footwear-boots-v1", assetVersion: 1, colorVariant: "brown" },
    },
    bonkler: {
      legCoverage: "partial",
      legColorVariant: "fantasy-green",
      bottom: { category: "chinos", assetId: "maker-bottom-chinos-v1", assetVersion: 1, colorVariant: "khaki" },
      footwear: { category: "loafers", assetId: "maker-footwear-loafers-v1", assetVersion: 1, colorVariant: "black" },
    },
    kagami: {
      legCoverage: "covered",
      legColorVariant: "cool-pale",
      bottom: { category: "dress-pants", assetId: "maker-bottom-dress-pants-v1", assetVersion: 1, colorVariant: "navy" },
      footwear: { category: "sandals", assetId: "maker-footwear-sandals-v1", assetVersion: 1, colorVariant: "pink" },
    },
  };
  return byFamily[family];
}

function makeSanitizedAvatar(family) {
  const width = 1024;
  const height = 1024;
  const palette = {
    milady: [[225, 132, 166, 255], [246, 219, 228, 255]],
    remilio: [[112, 168, 209, 255], [224, 240, 249, 255]],
    bonkler: [[137, 153, 92, 255], [225, 232, 202, 255]],
    kagami: [[183, 97, 152, 255], [242, 216, 234, 255]],
  }[family];
  const rgba = new Uint8Array(width * height * 4);
  fillEllipse(rgba, width, 512, 280, 190, 190, palette[1]);
  fillEllipse(rgba, width, 512, 470, 250, 245, palette[0]);
  fillRect(rgba, width, 342, 540, 330, 290, palette[0]);
  fillRect(rgba, width, 380, 790, 100, 180, palette[1]);
  fillRect(rgba, width, 544, 790, 100, 180, palette[1]);
  fillEllipse(rgba, width, 448, 250, 24, 32, [35, 31, 40, 255]);
  fillEllipse(rgba, width, 576, 250, 24, 32, [35, 31, 40, 255]);
  return encodePng(width, height, rgba);
}

function fillRect(rgba, width, x, y, rectWidth, rectHeight, color) {
  for (let row = y; row < y + rectHeight; row += 1) {
    for (let column = x; column < x + rectWidth; column += 1) setPixel(rgba, width, column, row, color);
  }
}

function fillEllipse(rgba, width, centerX, centerY, radiusX, radiusY, color) {
  for (let y = Math.max(0, centerY - radiusY); y <= Math.min(1023, centerY + radiusY); y += 1) {
    for (let x = Math.max(0, centerX - radiusX); x <= Math.min(1023, centerX + radiusX); x += 1) {
      const dx = (x - centerX) / radiusX;
      const dy = (y - centerY) / radiusY;
      if (dx * dx + dy * dy <= 1) setPixel(rgba, width, x, y, color);
    }
  }
}

function setPixel(rgba, width, x, y, color) {
  const offset = (y * width + x) * 4;
  rgba.set(color, offset);
}

function encodePng(width, height, rgba) {
  const scanlines = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const target = y * (width * 4 + 1);
    scanlines[target] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(scanlines, target + 1);
  }
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    signature,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(scanlines, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function pngChunk(type, data) {
  const typeBytes = Buffer.from(type, "ascii");
  const output = Buffer.alloc(12 + data.length);
  output.writeUInt32BE(data.length, 0);
  typeBytes.copy(output, 4);
  data.copy(output, 8);
  output.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), output.length - 4);
  return output;
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function readArg(name) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? null;
}
