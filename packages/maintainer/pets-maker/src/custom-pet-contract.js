export const PET_REQUEST_SCHEMA_VERSION = 1;
export const PET_REQUEST_ADAPTER_SKILL = "remilia-maker-pet-import";
export const PET_REQUEST_EXPORT_RESOLUTION = Object.freeze({ width: 1024, height: 1024 });
export const PET_REQUEST_FAMILIES = Object.freeze(["milady", "remilio", "bonkler", "kagami"]);
export const PET_REQUEST_NFT_RANGES = Object.freeze({
  milady: Object.freeze({ min: 0, max: 9999 }),
  remilio: Object.freeze({ min: 1, max: 10000 }),
  bonkler: Object.freeze({ min: 1, max: 150 }),
  kagami: Object.freeze({ min: 1, max: 3000 }),
});
export const PET_REQUEST_TRAITS = Object.freeze(["race", "hair", "eyes", "glasses", "shirt", "earrings"]);
export const PET_REQUEST_INSTRUCTION = "Use $remilia-maker-pet-import with the attached Maker export bundle.";
export const PET_REQUEST_TRAIT_POLICY = Object.freeze({
  background: "omit",
  friend: "omit",
  overlay: "omit",
  shirtText: "convert-to-unreadable-motif",
});

export const RACE_LEG_COLOR_CATALOG = Object.freeze({
  version: 1,
  families: Object.freeze({
    milady: Object.freeze([
      Object.freeze({ color: "fantasy-green", aliases: Object.freeze(["alien", "green"]) }),
      Object.freeze({ color: "fantasy-blue", aliases: Object.freeze(["blue"]) }),
      Object.freeze({ color: "deep", aliases: Object.freeze(["black", "dark", "deep"]) }),
      Object.freeze({ color: "brown", aliases: Object.freeze(["brown"]) }),
      Object.freeze({ color: "warm-medium", aliases: Object.freeze(["tan", "medium"]) }),
      Object.freeze({ color: "warm-light", aliases: Object.freeze(["white", "light", "standard"]) }),
      Object.freeze({ color: "cool-pale", aliases: Object.freeze(["pale", "porcelain", "ghost"]) }),
    ]),
    remilio: Object.freeze([
      Object.freeze({ color: "fantasy-green", aliases: Object.freeze(["alien", "reptilian", "green"]) }),
      Object.freeze({ color: "fantasy-blue", aliases: Object.freeze(["blue"]) }),
      Object.freeze({ color: "deep", aliases: Object.freeze(["black", "dark", "deep"]) }),
      Object.freeze({ color: "warm-medium", aliases: Object.freeze(["tan", "brown", "medium"]) }),
      Object.freeze({ color: "warm-light", aliases: Object.freeze(["white", "pink", "light"]) }),
      Object.freeze({ color: "cool-pale", aliases: Object.freeze(["zombie", "ghost", "pale"]) }),
    ]),
    bonkler: Object.freeze([
      Object.freeze({ color: "fantasy-green", aliases: Object.freeze(["green", "olive", "reptilian"]) }),
      Object.freeze({ color: "fantasy-blue", aliases: Object.freeze(["blue", "cyan"]) }),
      Object.freeze({ color: "deep", aliases: Object.freeze(["black", "dark", "deep"]) }),
      Object.freeze({ color: "brown", aliases: Object.freeze(["brown", "bronze", "rust"]) }),
      Object.freeze({ color: "cool-pale", aliases: Object.freeze(["white", "silver", "pale"]) }),
    ]),
    kagami: Object.freeze([
      Object.freeze({ color: "fantasy-blue", aliases: Object.freeze(["blue", "cyan"]) }),
      Object.freeze({ color: "fantasy-green", aliases: Object.freeze(["green"]) }),
      Object.freeze({ color: "deep", aliases: Object.freeze(["black", "dark", "deep"]) }),
      Object.freeze({ color: "warm-medium", aliases: Object.freeze(["tan", "brown", "medium"]) }),
      Object.freeze({ color: "warm-light", aliases: Object.freeze(["pink", "light"]) }),
      Object.freeze({ color: "cool-pale", aliases: Object.freeze(["white", "pale", "porcelain", "ghost"]) }),
    ]),
  }),
});

export const BODY_COMPLETION_CATALOG = Object.freeze({
  version: 1,
  legCoverage: Object.freeze([
    Object.freeze({ id: "exposed", label: "Exposed legs" }),
    Object.freeze({ id: "partial", label: "Partially covered legs" }),
    Object.freeze({ id: "covered", label: "Covered legs" }),
  ]),
  legColors: Object.freeze([
    Object.freeze({ id: "cool-pale", label: "Cool pale", hex: "#eadbd7" }),
    Object.freeze({ id: "warm-light", label: "Warm light", hex: "#ddb29a" }),
    Object.freeze({ id: "warm-medium", label: "Warm medium", hex: "#bd8067" }),
    Object.freeze({ id: "brown", label: "Brown", hex: "#8d5b45" }),
    Object.freeze({ id: "deep", label: "Deep", hex: "#563a32" }),
    Object.freeze({ id: "fantasy-green", label: "Fantasy green", hex: "#80a978" }),
    Object.freeze({ id: "fantasy-blue", label: "Fantasy blue", hex: "#799ebf" }),
  ]),
  bottoms: Object.freeze([
    Object.freeze({
      category: "shorts",
      assetId: "maker-bottom-shorts-v1",
      assetVersion: 1,
      label: "Shorts",
      compatibleLegCoverage: Object.freeze(["exposed", "partial"]),
    }),
    Object.freeze({
      category: "cargo-shorts",
      assetId: "maker-bottom-cargo-shorts-v1",
      assetVersion: 1,
      label: "Cargo shorts",
      compatibleLegCoverage: Object.freeze(["exposed", "partial"]),
    }),
    Object.freeze({
      category: "jeans",
      assetId: "maker-bottom-jeans-v1",
      assetVersion: 1,
      label: "Jeans",
      compatibleLegCoverage: Object.freeze(["covered"]),
    }),
    Object.freeze({
      category: "dress-pants",
      assetId: "maker-bottom-dress-pants-v1",
      assetVersion: 1,
      label: "Dress pants",
      compatibleLegCoverage: Object.freeze(["covered"]),
    }),
    Object.freeze({
      category: "chinos",
      assetId: "maker-bottom-chinos-v1",
      assetVersion: 1,
      label: "Chinos",
      compatibleLegCoverage: Object.freeze(["partial", "covered"]),
    }),
  ]),
  footwear: Object.freeze([
    Object.freeze({ category: "sneakers", assetId: "maker-footwear-sneakers-v1", assetVersion: 1, label: "Sneakers" }),
    Object.freeze({ category: "loafers", assetId: "maker-footwear-loafers-v1", assetVersion: 1, label: "Loafers" }),
    Object.freeze({ category: "boots", assetId: "maker-footwear-boots-v1", assetVersion: 1, label: "Boots" }),
    Object.freeze({ category: "sandals", assetId: "maker-footwear-sandals-v1", assetVersion: 1, label: "Sandals" }),
  ]),
  colors: Object.freeze([
    Object.freeze({ id: "black", label: "Black", hex: "#27242b" }),
    Object.freeze({ id: "white", label: "White", hex: "#f4f0ec" }),
    Object.freeze({ id: "navy", label: "Navy", hex: "#283957" }),
    Object.freeze({ id: "denim-blue", label: "Denim blue", hex: "#506f9a" }),
    Object.freeze({ id: "khaki", label: "Khaki", hex: "#a08b62" }),
    Object.freeze({ id: "olive", label: "Olive", hex: "#69724a" }),
    Object.freeze({ id: "pink", label: "Pink", hex: "#d47da2" }),
    Object.freeze({ id: "brown", label: "Brown", hex: "#684937" }),
  ]),
});

const ASSET_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/u;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const LEG_COVERAGE = new Set(BODY_COMPLETION_CATALOG.legCoverage.map((item) => item.id));

export function bottomForAssetId(assetId) {
  return BODY_COMPLETION_CATALOG.bottoms.find((item) => item.assetId === assetId) ?? null;
}

export function footwearForAssetId(assetId) {
  return BODY_COMPLETION_CATALOG.footwear.find((item) => item.assetId === assetId) ?? null;
}

export function colorForId(colorId) {
  return BODY_COMPLETION_CATALOG.colors.find((item) => item.id === colorId) ?? null;
}

export function compatibleBottoms(legCoverage) {
  if (!LEG_COVERAGE.has(legCoverage)) return [];
  return BODY_COMPLETION_CATALOG.bottoms.filter((item) => item.compatibleLegCoverage.includes(legCoverage));
}

export function legColorForRace(templateFamily, race) {
  const rules = RACE_LEG_COLOR_CATALOG.families[templateFamily];
  if (!rules || !race || typeof race !== "object") return null;
  const tokens = new Set(`${race.assetId ?? ""} ${race.label ?? ""}`
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(Boolean));
  return rules.find((rule) => rule.aliases.some((alias) => tokens.has(alias)))?.color ?? null;
}

export function nftNumberRangeForFamily(templateFamily) {
  return PET_REQUEST_NFT_RANGES[templateFamily] ?? null;
}

export function makePetRequest({
  templateFamily,
  sourceNftNumber = /** @type {number | null} */ (null),
  imageSha256,
  traits,
  bodyCompletion,
  petName = "",
  personality = "",
}) {
  const request = {
    schemaVersion: PET_REQUEST_SCHEMA_VERSION,
    adapterSkill: PET_REQUEST_ADAPTER_SKILL,
    templateFamily,
    templateFamilyOptions: [...PET_REQUEST_FAMILIES],
    templateVersion: 1,
    imageSha256,
    image: {
      file: "avatar.png",
      mediaType: "image/png",
      width: PET_REQUEST_EXPORT_RESOLUTION.width,
      height: PET_REQUEST_EXPORT_RESOLUTION.height,
    },
    traits,
    traitPolicy: { ...PET_REQUEST_TRAIT_POLICY },
    bodyCompletion: {
      catalogVersion: BODY_COMPLETION_CATALOG.version,
      legCoverage: bodyCompletion.legCoverage,
      legColorVariant: bodyCompletion.legColorVariant,
      bottom: { ...bodyCompletion.bottom },
      footwear: { ...bodyCompletion.footwear },
    },
    generator: {
      id: "pets-maker",
      version: "0.1.0-pilot",
      deterministicCompositeVersion: 1,
    },
  };
  if (sourceNftNumber != null) request.sourceNftNumber = sourceNftNumber;
  if (petName.trim() || personality.trim()) {
    request.pet = {};
    if (petName.trim()) request.pet.name = petName.trim().slice(0, 80);
    if (personality.trim()) request.pet.personality = personality.trim().slice(0, 280);
  }
  return request;
}

export async function validatePetRequest(request, avatarBytes) {
  const errors = validatePetRequestShape(request);
  const bytes = asUint8Array(avatarBytes);
  if (bytes.length === 0) errors.push("avatar.png is empty.");
  if (!hasPngSignature(bytes)) errors.push("avatar.png is not a PNG.");
  const dimensions = pngDimensions(bytes);
  if (dimensions
    && (dimensions.width !== PET_REQUEST_EXPORT_RESOLUTION.width
      || dimensions.height !== PET_REQUEST_EXPORT_RESOLUTION.height)) {
    errors.push(`avatar.png must be ${PET_REQUEST_EXPORT_RESOLUTION.width}x${PET_REQUEST_EXPORT_RESOLUTION.height}; received ${dimensions.width}x${dimensions.height}.`);
  } else if (!dimensions && hasPngSignature(bytes)) {
    errors.push("avatar.png is missing a valid IHDR dimensions header.");
  }
  if (errors.length === 0) {
    const actualHash = await sha256Hex(bytes);
    if (actualHash !== request.imageSha256) {
      errors.push(`avatar.png SHA-256 mismatch: expected ${request.imageSha256}, received ${actualHash}.`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validatePetRequestShape(request) {
  const errors = [];
  if (!request || typeof request !== "object" || Array.isArray(request)) return ["request.json must contain an object."];
  if (request.schemaVersion !== PET_REQUEST_SCHEMA_VERSION) errors.push(`schemaVersion must be ${PET_REQUEST_SCHEMA_VERSION}.`);
  if (request.adapterSkill !== PET_REQUEST_ADAPTER_SKILL) errors.push(`adapterSkill must be ${PET_REQUEST_ADAPTER_SKILL}.`);
  if (!PET_REQUEST_FAMILIES.includes(request.templateFamily)) errors.push("templateFamily is unsupported.");
  if (request.sourceNftNumber != null) {
    const range = nftNumberRangeForFamily(request.templateFamily);
    if (!Number.isInteger(request.sourceNftNumber) || !range
      || request.sourceNftNumber < range.min || request.sourceNftNumber > range.max) {
      errors.push(range
        ? `sourceNftNumber must be an integer from ${range.min} to ${range.max} for ${request.templateFamily}.`
        : "sourceNftNumber requires a supported templateFamily.");
    }
  }
  if (request.templateVersion !== 1) errors.push("templateVersion must be 1.");
  if (JSON.stringify(request.templateFamilyOptions) !== JSON.stringify(PET_REQUEST_FAMILIES)) {
    errors.push("templateFamilyOptions must declare Milady, Remilio, Bonkler, and Kagami in contract order.");
  }
  if (!SHA256_PATTERN.test(request.imageSha256 ?? "")) errors.push("imageSha256 must be a lowercase SHA-256 digest.");
  if (request.image?.file !== "avatar.png"
    || request.image?.mediaType !== "image/png"
    || request.image?.width !== PET_REQUEST_EXPORT_RESOLUTION.width
    || request.image?.height !== PET_REQUEST_EXPORT_RESOLUTION.height) {
    errors.push("image must declare the canonical 1024x1024 avatar.png contract.");
  }
  validateTraits(request.traits, errors);
  if (JSON.stringify(request.traitPolicy) !== JSON.stringify(PET_REQUEST_TRAIT_POLICY)) {
    errors.push("traitPolicy must explicitly omit background, friend, and overlay, and adapt shirt text.");
  }
  validateBodyCompletion(request.bodyCompletion, errors);
  if (request.rightsScope != null) errors.push("rightsScope is not accepted; Pets Maker does not collect or infer rights declarations.");
  if (request.generator?.id !== "pets-maker"
    || request.generator?.version !== "0.1.0-pilot"
    || request.generator?.deterministicCompositeVersion !== 1) {
    errors.push("generator must identify Pets Maker 0.1.0-pilot composite version 1.");
  }
  if (request.pet?.name && String(request.pet.name).length > 80) errors.push("pet.name exceeds 80 characters.");
  if (request.pet?.personality && String(request.pet.personality).length > 280) errors.push("pet.personality exceeds 280 characters.");
  return errors;
}

function validateTraits(traits, errors) {
  if (!traits || typeof traits !== "object" || Array.isArray(traits)) {
    errors.push("traits must contain the exact Maker trait selections.");
    return;
  }
  for (const traitName of PET_REQUEST_TRAITS) {
    const trait = traits[traitName];
    if (!trait || typeof trait !== "object") {
      errors.push(`traits.${traitName} is required; use the explicit asset ID "none" when absent.`);
      continue;
    }
    if (!ASSET_ID_PATTERN.test(trait.assetId ?? "")) {
      errors.push(`traits.${traitName}.assetId must be a stable lowercase asset ID.`);
    }
    if (trait.label != null && (typeof trait.label !== "string" || trait.label.length > 120)) {
      errors.push(`traits.${traitName}.label must be at most 120 characters.`);
    }
  }
}

function validateBodyCompletion(bodyCompletion, errors) {
  if (!bodyCompletion || typeof bodyCompletion !== "object") {
    errors.push("bodyCompletion is required; the lower half cannot be inferred.");
    return;
  }
  if (bodyCompletion.catalogVersion !== BODY_COMPLETION_CATALOG.version) {
    errors.push(`bodyCompletion.catalogVersion must be ${BODY_COMPLETION_CATALOG.version}.`);
  }
  if (!LEG_COVERAGE.has(bodyCompletion.legCoverage)) errors.push("bodyCompletion.legCoverage is unsupported.");
  if (!BODY_COMPLETION_CATALOG.legColors.some((item) => item.id === bodyCompletion.legColorVariant)) {
    errors.push("bodyCompletion.legColorVariant is unsupported.");
  }
  const bottom = bottomForAssetId(bodyCompletion.bottom?.assetId);
  if (!bottom
    || bottom.category !== bodyCompletion.bottom?.category
    || bottom.assetVersion !== bodyCompletion.bottom?.assetVersion) {
    errors.push("bodyCompletion.bottom must identify a catalog category, assetId, and assetVersion.");
  } else if (!bottom.compatibleLegCoverage.includes(bodyCompletion.legCoverage)) {
    errors.push(`${bottom.label} is incompatible with ${bodyCompletion.legCoverage} leg coverage.`);
  }
  if (!colorForId(bodyCompletion.bottom?.colorVariant)) errors.push("bodyCompletion.bottom.colorVariant is unsupported.");
  const footwear = footwearForAssetId(bodyCompletion.footwear?.assetId);
  if (!footwear
    || footwear.category !== bodyCompletion.footwear?.category
    || footwear.assetVersion !== bodyCompletion.footwear?.assetVersion) {
    errors.push("bodyCompletion.footwear must identify a catalog category, assetId, and assetVersion.");
  }
  if (!colorForId(bodyCompletion.footwear?.colorVariant)) errors.push("bodyCompletion.footwear.colorVariant is unsupported.");
}

export async function sha256Hex(bytes) {
  const input = asUint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

export function stableJson(value) {
  return `${JSON.stringify(sortJson(value), null, 2)}\n`;
}

function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}

export function createStoredZip(entries) {
  const files = entries.map((entry) => ({
    name: String(entry.name),
    nameBytes: new TextEncoder().encode(String(entry.name)),
    bytes: asUint8Array(entry.bytes),
  }));
  const seen = new Set();
  for (const file of files) {
    if (!/^[a-z0-9][a-z0-9._-]*$/u.test(file.name) || file.name.includes("/") || file.name.includes("\\")) {
      throw new Error(`Unsafe ZIP entry name: ${file.name}`);
    }
    if (seen.has(file.name)) throw new Error(`Duplicate ZIP entry: ${file.name}`);
    seen.add(file.name);
    file.crc32 = crc32(file.bytes);
  }
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  for (const file of files) {
    const local = new Uint8Array(30 + file.nameBytes.length);
    const localView = new DataView(local.buffer);
    localView.setUint32(0, 0x04034b50, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 0x0800, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 0x0021, true);
    localView.setUint32(14, file.crc32, true);
    localView.setUint32(18, file.bytes.length, true);
    localView.setUint32(22, file.bytes.length, true);
    localView.setUint16(26, file.nameBytes.length, true);
    local.set(file.nameBytes, 30);
    localParts.push(local, file.bytes);

    const central = new Uint8Array(46 + file.nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 0x02014b50, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 0x0800, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 0x0021, true);
    centralView.setUint32(16, file.crc32, true);
    centralView.setUint32(20, file.bytes.length, true);
    centralView.setUint32(24, file.bytes.length, true);
    centralView.setUint16(28, file.nameBytes.length, true);
    centralView.setUint32(38, 0, true);
    centralView.setUint32(42, offset, true);
    central.set(file.nameBytes, 46);
    centralParts.push(central);
    offset += local.length + file.bytes.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return concatBytes([...localParts, ...centralParts, end]);
}

export function listStoredZip(bytes) {
  const input = asUint8Array(bytes);
  const entries = [];
  let offset = 0;
  while (offset + 4 <= input.length && readUint32(input, offset) === 0x04034b50) {
    if (offset + 30 > input.length) throw new Error("Truncated ZIP local header.");
    const method = readUint16(input, offset + 8);
    if (method !== 0) throw new Error("Only stored ZIP entries are supported.");
    const crc = readUint32(input, offset + 14);
    const size = readUint32(input, offset + 18);
    const nameLength = readUint16(input, offset + 26);
    const extraLength = readUint16(input, offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const dataEnd = dataStart + size;
    if (dataEnd > input.length) throw new Error("Truncated ZIP entry.");
    const name = new TextDecoder().decode(input.slice(nameStart, nameStart + nameLength));
    const data = input.slice(dataStart, dataEnd);
    if (crc32(data) !== crc) throw new Error(`${name}: CRC-32 mismatch.`);
    entries.push({ name, bytes: data });
    offset = dataEnd;
  }
  return entries;
}

function hasPngSignature(bytes) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return signature.every((value, index) => bytes[index] === value);
}

function pngDimensions(bytes) {
  if (bytes.length < 24 || !hasPngSignature(bytes)) return null;
  if (String.fromCharCode(...bytes.slice(12, 16)) !== "IHDR") return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16, false), height: view.getUint32(20, false) };
}

function asUint8Array(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  throw new TypeError("Expected bytes.");
}

function concatBytes(parts) {
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function readUint16(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 2).getUint16(0, true);
}

function readUint32(bytes, offset) {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
