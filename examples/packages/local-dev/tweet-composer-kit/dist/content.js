// examples/packages/local-dev/tweet-composer-kit/src/custom-pet-contract.js
var PET_REQUEST_SCHEMA_VERSION = 1;
var PET_REQUEST_ADAPTER_SKILL = "remilia-maker-pet-import";
var PET_REQUEST_EXPORT_RESOLUTION = Object.freeze({ width: 1024, height: 1024 });
var PET_REQUEST_FAMILIES = Object.freeze(["milady", "remilio", "bonkler", "kagami"]);
var PET_REQUEST_NFT_RANGES = Object.freeze({
  milady: Object.freeze({ min: 0, max: 9999 }),
  remilio: Object.freeze({ min: 1, max: 1e4 }),
  bonkler: Object.freeze({ min: 1, max: 150 }),
  kagami: Object.freeze({ min: 1, max: 3e3 })
});
var PET_REQUEST_TRAITS = Object.freeze(["race", "hair", "eyes", "glasses", "shirt", "earrings"]);
var PET_REQUEST_INSTRUCTION = "Use $remilia-maker-pet-import with the attached Maker export bundle.";
var PET_REQUEST_TRAIT_POLICY = Object.freeze({
  background: "omit",
  friend: "omit",
  overlay: "omit",
  shirtText: "convert-to-unreadable-motif"
});
var RACE_LEG_COLOR_CATALOG = Object.freeze({
  version: 1,
  families: Object.freeze({
    milady: Object.freeze([
      Object.freeze({ color: "fantasy-green", aliases: Object.freeze(["alien", "green"]) }),
      Object.freeze({ color: "fantasy-blue", aliases: Object.freeze(["blue"]) }),
      Object.freeze({ color: "deep", aliases: Object.freeze(["black", "dark", "deep"]) }),
      Object.freeze({ color: "brown", aliases: Object.freeze(["brown"]) }),
      Object.freeze({ color: "warm-medium", aliases: Object.freeze(["tan", "medium"]) }),
      Object.freeze({ color: "warm-light", aliases: Object.freeze(["white", "light", "standard"]) }),
      Object.freeze({ color: "cool-pale", aliases: Object.freeze(["pale", "porcelain", "ghost"]) })
    ]),
    remilio: Object.freeze([
      Object.freeze({ color: "fantasy-green", aliases: Object.freeze(["alien", "reptilian", "green"]) }),
      Object.freeze({ color: "fantasy-blue", aliases: Object.freeze(["blue"]) }),
      Object.freeze({ color: "deep", aliases: Object.freeze(["black", "dark", "deep"]) }),
      Object.freeze({ color: "warm-medium", aliases: Object.freeze(["tan", "brown", "medium"]) }),
      Object.freeze({ color: "warm-light", aliases: Object.freeze(["white", "pink", "light"]) }),
      Object.freeze({ color: "cool-pale", aliases: Object.freeze(["zombie", "ghost", "pale"]) })
    ]),
    bonkler: Object.freeze([
      Object.freeze({ color: "fantasy-green", aliases: Object.freeze(["green", "olive", "reptilian"]) }),
      Object.freeze({ color: "fantasy-blue", aliases: Object.freeze(["blue", "cyan"]) }),
      Object.freeze({ color: "deep", aliases: Object.freeze(["black", "dark", "deep"]) }),
      Object.freeze({ color: "brown", aliases: Object.freeze(["brown", "bronze", "rust"]) }),
      Object.freeze({ color: "cool-pale", aliases: Object.freeze(["white", "silver", "pale"]) })
    ]),
    kagami: Object.freeze([
      Object.freeze({ color: "fantasy-blue", aliases: Object.freeze(["blue", "cyan"]) }),
      Object.freeze({ color: "fantasy-green", aliases: Object.freeze(["green"]) }),
      Object.freeze({ color: "deep", aliases: Object.freeze(["black", "dark", "deep"]) }),
      Object.freeze({ color: "warm-medium", aliases: Object.freeze(["tan", "brown", "medium"]) }),
      Object.freeze({ color: "warm-light", aliases: Object.freeze(["pink", "light"]) }),
      Object.freeze({ color: "cool-pale", aliases: Object.freeze(["white", "pale", "porcelain", "ghost"]) })
    ])
  })
});
var BODY_COMPLETION_CATALOG = Object.freeze({
  version: 1,
  legCoverage: Object.freeze([
    Object.freeze({ id: "exposed", label: "Exposed legs" }),
    Object.freeze({ id: "partial", label: "Partially covered legs" }),
    Object.freeze({ id: "covered", label: "Covered legs" })
  ]),
  legColors: Object.freeze([
    Object.freeze({ id: "cool-pale", label: "Cool pale", hex: "#eadbd7" }),
    Object.freeze({ id: "warm-light", label: "Warm light", hex: "#ddb29a" }),
    Object.freeze({ id: "warm-medium", label: "Warm medium", hex: "#bd8067" }),
    Object.freeze({ id: "brown", label: "Brown", hex: "#8d5b45" }),
    Object.freeze({ id: "deep", label: "Deep", hex: "#563a32" }),
    Object.freeze({ id: "fantasy-green", label: "Fantasy green", hex: "#80a978" }),
    Object.freeze({ id: "fantasy-blue", label: "Fantasy blue", hex: "#799ebf" })
  ]),
  bottoms: Object.freeze([
    Object.freeze({
      category: "shorts",
      assetId: "maker-bottom-shorts-v1",
      assetVersion: 1,
      label: "Shorts",
      compatibleLegCoverage: Object.freeze(["exposed", "partial"])
    }),
    Object.freeze({
      category: "cargo-shorts",
      assetId: "maker-bottom-cargo-shorts-v1",
      assetVersion: 1,
      label: "Cargo shorts",
      compatibleLegCoverage: Object.freeze(["exposed", "partial"])
    }),
    Object.freeze({
      category: "jeans",
      assetId: "maker-bottom-jeans-v1",
      assetVersion: 1,
      label: "Jeans",
      compatibleLegCoverage: Object.freeze(["covered"])
    }),
    Object.freeze({
      category: "dress-pants",
      assetId: "maker-bottom-dress-pants-v1",
      assetVersion: 1,
      label: "Dress pants",
      compatibleLegCoverage: Object.freeze(["covered"])
    }),
    Object.freeze({
      category: "chinos",
      assetId: "maker-bottom-chinos-v1",
      assetVersion: 1,
      label: "Chinos",
      compatibleLegCoverage: Object.freeze(["partial", "covered"])
    })
  ]),
  footwear: Object.freeze([
    Object.freeze({ category: "sneakers", assetId: "maker-footwear-sneakers-v1", assetVersion: 1, label: "Sneakers" }),
    Object.freeze({ category: "loafers", assetId: "maker-footwear-loafers-v1", assetVersion: 1, label: "Loafers" }),
    Object.freeze({ category: "boots", assetId: "maker-footwear-boots-v1", assetVersion: 1, label: "Boots" }),
    Object.freeze({ category: "sandals", assetId: "maker-footwear-sandals-v1", assetVersion: 1, label: "Sandals" })
  ]),
  colors: Object.freeze([
    Object.freeze({ id: "black", label: "Black", hex: "#27242b" }),
    Object.freeze({ id: "white", label: "White", hex: "#f4f0ec" }),
    Object.freeze({ id: "navy", label: "Navy", hex: "#283957" }),
    Object.freeze({ id: "denim-blue", label: "Denim blue", hex: "#506f9a" }),
    Object.freeze({ id: "khaki", label: "Khaki", hex: "#a08b62" }),
    Object.freeze({ id: "olive", label: "Olive", hex: "#69724a" }),
    Object.freeze({ id: "pink", label: "Pink", hex: "#d47da2" }),
    Object.freeze({ id: "brown", label: "Brown", hex: "#684937" })
  ])
});
var ASSET_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{0,79}$/u;
var SHA256_PATTERN = /^[a-f0-9]{64}$/u;
var RIGHTS_SCOPES = /* @__PURE__ */ new Set(["private-review", "publication-cleared"]);
var LEG_COVERAGE = new Set(BODY_COMPLETION_CATALOG.legCoverage.map((item) => item.id));
function bottomForAssetId(assetId) {
  return BODY_COMPLETION_CATALOG.bottoms.find((item) => item.assetId === assetId) ?? null;
}
function footwearForAssetId(assetId) {
  return BODY_COMPLETION_CATALOG.footwear.find((item) => item.assetId === assetId) ?? null;
}
function colorForId(colorId) {
  return BODY_COMPLETION_CATALOG.colors.find((item) => item.id === colorId) ?? null;
}
function compatibleBottoms(legCoverage) {
  if (!LEG_COVERAGE.has(legCoverage)) return [];
  return BODY_COMPLETION_CATALOG.bottoms.filter((item) => item.compatibleLegCoverage.includes(legCoverage));
}
function legColorForRace(templateFamily, race) {
  const rules = RACE_LEG_COLOR_CATALOG.families[templateFamily];
  if (!rules || !race || typeof race !== "object") return null;
  const tokens = new Set(`${race.assetId ?? ""} ${race.label ?? ""}`.toLowerCase().split(/[^a-z0-9]+/u).filter(Boolean));
  return rules.find((rule) => rule.aliases.some((alias) => tokens.has(alias)))?.color ?? null;
}
function nftNumberRangeForFamily(templateFamily) {
  return PET_REQUEST_NFT_RANGES[templateFamily] ?? null;
}
function makePetRequest({
  templateFamily,
  sourceNftNumber = null,
  imageSha256,
  traits,
  bodyCompletion,
  rightsScope,
  petName = "",
  personality = ""
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
      height: PET_REQUEST_EXPORT_RESOLUTION.height
    },
    traits,
    traitPolicy: { ...PET_REQUEST_TRAIT_POLICY },
    bodyCompletion: {
      catalogVersion: BODY_COMPLETION_CATALOG.version,
      legCoverage: bodyCompletion.legCoverage,
      legColorVariant: bodyCompletion.legColorVariant,
      bottom: { ...bodyCompletion.bottom },
      footwear: { ...bodyCompletion.footwear }
    },
    rightsScope,
    generator: {
      id: "tweet-composer-kit",
      version: "0.2.0-pilot",
      deterministicCompositeVersion: 1
    }
  };
  if (sourceNftNumber != null) request.sourceNftNumber = sourceNftNumber;
  if (petName.trim() || personality.trim()) {
    request.pet = {};
    if (petName.trim()) request.pet.name = petName.trim().slice(0, 80);
    if (personality.trim()) request.pet.personality = personality.trim().slice(0, 280);
  }
  return request;
}
async function validatePetRequest(request, avatarBytes) {
  const errors = validatePetRequestShape(request);
  const bytes = asUint8Array(avatarBytes);
  if (bytes.length === 0) errors.push("avatar.png is empty.");
  if (!hasPngSignature(bytes)) errors.push("avatar.png is not a PNG.");
  const dimensions = pngDimensions(bytes);
  if (dimensions && (dimensions.width !== PET_REQUEST_EXPORT_RESOLUTION.width || dimensions.height !== PET_REQUEST_EXPORT_RESOLUTION.height)) {
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
function validatePetRequestShape(request) {
  const errors = [];
  if (!request || typeof request !== "object" || Array.isArray(request)) return ["request.json must contain an object."];
  if (request.schemaVersion !== PET_REQUEST_SCHEMA_VERSION) errors.push(`schemaVersion must be ${PET_REQUEST_SCHEMA_VERSION}.`);
  if (request.adapterSkill !== PET_REQUEST_ADAPTER_SKILL) errors.push(`adapterSkill must be ${PET_REQUEST_ADAPTER_SKILL}.`);
  if (!PET_REQUEST_FAMILIES.includes(request.templateFamily)) errors.push("templateFamily is unsupported.");
  if (request.sourceNftNumber != null) {
    const range = nftNumberRangeForFamily(request.templateFamily);
    if (!Number.isInteger(request.sourceNftNumber) || !range || request.sourceNftNumber < range.min || request.sourceNftNumber > range.max) {
      errors.push(range ? `sourceNftNumber must be an integer from ${range.min} to ${range.max} for ${request.templateFamily}.` : "sourceNftNumber requires a supported templateFamily.");
    }
  }
  if (request.templateVersion !== 1) errors.push("templateVersion must be 1.");
  if (JSON.stringify(request.templateFamilyOptions) !== JSON.stringify(PET_REQUEST_FAMILIES)) {
    errors.push("templateFamilyOptions must declare Milady, Remilio, Bonkler, and Kagami in contract order.");
  }
  if (!SHA256_PATTERN.test(request.imageSha256 ?? "")) errors.push("imageSha256 must be a lowercase SHA-256 digest.");
  if (request.image?.file !== "avatar.png" || request.image?.mediaType !== "image/png" || request.image?.width !== PET_REQUEST_EXPORT_RESOLUTION.width || request.image?.height !== PET_REQUEST_EXPORT_RESOLUTION.height) {
    errors.push("image must declare the canonical 1024x1024 avatar.png contract.");
  }
  validateTraits(request.traits, errors);
  if (JSON.stringify(request.traitPolicy) !== JSON.stringify(PET_REQUEST_TRAIT_POLICY)) {
    errors.push("traitPolicy must explicitly omit background, friend, and overlay, and adapt shirt text.");
  }
  validateBodyCompletion(request.bodyCompletion, errors);
  if (!RIGHTS_SCOPES.has(request.rightsScope)) errors.push("rightsScope must be private-review or publication-cleared.");
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
  if (!bottom || bottom.category !== bodyCompletion.bottom?.category || bottom.assetVersion !== bodyCompletion.bottom?.assetVersion) {
    errors.push("bodyCompletion.bottom must identify a catalog category, assetId, and assetVersion.");
  } else if (!bottom.compatibleLegCoverage.includes(bodyCompletion.legCoverage)) {
    errors.push(`${bottom.label} is incompatible with ${bodyCompletion.legCoverage} leg coverage.`);
  }
  if (!colorForId(bodyCompletion.bottom?.colorVariant)) errors.push("bodyCompletion.bottom.colorVariant is unsupported.");
  const footwear = footwearForAssetId(bodyCompletion.footwear?.assetId);
  if (!footwear || footwear.category !== bodyCompletion.footwear?.category || footwear.assetVersion !== bodyCompletion.footwear?.assetVersion) {
    errors.push("bodyCompletion.footwear must identify a catalog category, assetId, and assetVersion.");
  }
  if (!colorForId(bodyCompletion.footwear?.colorVariant)) errors.push("bodyCompletion.footwear.colorVariant is unsupported.");
}
async function sha256Hex(bytes) {
  const input = asUint8Array(bytes);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", input);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}
function stableJson(value) {
  return `${JSON.stringify(sortJson(value), null, 2)}
`;
}
function sortJson(value) {
  if (Array.isArray(value)) return value.map(sortJson);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortJson(value[key])]));
}
function createStoredZip(entries) {
  const files = entries.map((entry) => ({
    name: String(entry.name),
    nameBytes: new TextEncoder().encode(String(entry.name)),
    bytes: asUint8Array(entry.bytes)
  }));
  const seen = /* @__PURE__ */ new Set();
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
    localView.setUint32(0, 67324752, true);
    localView.setUint16(4, 20, true);
    localView.setUint16(6, 2048, true);
    localView.setUint16(8, 0, true);
    localView.setUint16(10, 0, true);
    localView.setUint16(12, 33, true);
    localView.setUint32(14, file.crc32, true);
    localView.setUint32(18, file.bytes.length, true);
    localView.setUint32(22, file.bytes.length, true);
    localView.setUint16(26, file.nameBytes.length, true);
    local.set(file.nameBytes, 30);
    localParts.push(local, file.bytes);
    const central = new Uint8Array(46 + file.nameBytes.length);
    const centralView = new DataView(central.buffer);
    centralView.setUint32(0, 33639248, true);
    centralView.setUint16(4, 20, true);
    centralView.setUint16(6, 20, true);
    centralView.setUint16(8, 2048, true);
    centralView.setUint16(10, 0, true);
    centralView.setUint16(12, 0, true);
    centralView.setUint16(14, 33, true);
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
  endView.setUint32(0, 101010256, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);
  return concatBytes([...localParts, ...centralParts, end]);
}
function listStoredZip(bytes) {
  const input = asUint8Array(bytes);
  const entries = [];
  let offset = 0;
  while (offset + 4 <= input.length && readUint32(input, offset) === 67324752) {
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
  const signature = [137, 80, 78, 71, 13, 10, 26, 10];
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
  let crc = 4294967295;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = crc >>> 1 ^ 3988292384 & -(crc & 1);
  }
  return (crc ^ 4294967295) >>> 0;
}

// examples/packages/local-dev/tweet-composer-kit/src/custom-pet-ui.js
var FAMILY_LABELS = Object.freeze({
  milady: "Milady",
  remilio: "Remilio",
  bonkler: "Bonkler",
  kagami: "Kagami"
});
function buildCustomPetExport({ signal }) {
  const section = element("section", {
    className: "tweet-composer-kit__pet-export",
    ariaLabel: "Custom Pet export"
  });
  const summary = element(
    "div",
    { className: "tweet-composer-kit__pet-heading" },
    element("strong", { textContent: "Custom Pet export" }),
    element("span", {
      className: "tweet-composer-kit__pet-local-note",
      textContent: "Local download only. Nothing is uploaded."
    })
  );
  const disclosure = element("button", {
    className: "tweet-composer-kit__pet-disclosure",
    type: "button",
    ariaExpanded: "false",
    textContent: "Prepare Maker pet bundle"
  });
  const form = element("form", {
    className: "tweet-composer-kit__pet-form",
    hidden: true,
    noValidate: true
  });
  const family = blankSelect("Maker template family", PET_REQUEST_FAMILIES.map((id) => ({ id, label: FAMILY_LABELS[id] })));
  family.select.name = "templateFamily";
  const nftNumberInput = element("input", {
    className: "tweet-composer-kit__pet-input",
    type: "number",
    step: "1",
    inputMode: "numeric",
    autocomplete: "off",
    ariaDescribedBy: "tweet-composer-kit-pet-nft-number-help"
  });
  const nftNumber = labeledControl("NFT number (optional)", nftNumberInput);
  nftNumber.hidden = true;
  const nftNumberHelp = element("p", {
    id: "tweet-composer-kit-pet-nft-number-help",
    className: "tweet-composer-kit__pet-help",
    hidden: true
  });
  const avatar = element("input", {
    className: "tweet-composer-kit__pet-file",
    type: "file",
    accept: "image/png,.png",
    required: true,
    ariaDescribedBy: "tweet-composer-kit-pet-avatar-help"
  });
  const avatarHelp = element("p", {
    id: "tweet-composer-kit-pet-avatar-help",
    className: "tweet-composer-kit__pet-help",
    textContent: "Choose the transparent PNG downloaded from the selected Maker. Opaque backgrounds are rejected."
  });
  const traitInputs = Object.fromEntries(PET_REQUEST_TRAITS.map((trait) => {
    const assetId = element("input", {
      className: "tweet-composer-kit__pet-input",
      type: "text",
      maxLength: 80,
      required: true,
      autocomplete: "off",
      placeholder: `${trait} asset ID or none`,
      ariaLabel: `${friendlyTrait(trait)} stable asset ID`
    });
    const label = element("input", {
      className: "tweet-composer-kit__pet-input",
      type: "text",
      maxLength: 120,
      autocomplete: "off",
      placeholder: "Readable label (optional)",
      ariaLabel: `${friendlyTrait(trait)} readable label`
    });
    return [trait, { assetId, label }];
  }));
  const coverage = blankSelect("Leg coverage", BODY_COMPLETION_CATALOG.legCoverage);
  const bottom = blankSelect("Bottom garment", BODY_COMPLETION_CATALOG.bottoms.map((item) => ({
    id: item.assetId,
    label: item.label
  })));
  const bottomColor = blankSelect("Bottom color", BODY_COMPLETION_CATALOG.colors);
  const footwear = blankSelect("Footwear", BODY_COMPLETION_CATALOG.footwear.map((item) => ({
    id: item.assetId,
    label: item.label
  })));
  const footwearColor = blankSelect("Footwear color", BODY_COMPLETION_CATALOG.colors);
  const petName = labeledInput("Pet name (optional)", 80);
  const personality = labeledInput("Personality (optional)", 280);
  const preview = element("canvas", {
    className: "tweet-composer-kit__pet-preview",
    width: 1024,
    height: 1024,
    hidden: true,
    ariaLabel: "Completed Maker avatar preview",
    role: "img"
  });
  const previewButton = element("button", {
    className: "tweet-composer-kit__pet-secondary",
    type: "button",
    textContent: "Preview completed avatar"
  });
  const exportButton = element("button", {
    className: "tweet-composer-kit__pet-primary",
    type: "submit",
    textContent: "Download remilia-pet-request.zip"
  });
  const status = element("p", {
    className: "tweet-composer-kit__pet-status",
    role: "status",
    ariaLive: "polite"
  });
  const instruction = element("textarea", {
    className: "tweet-composer-kit__pet-instruction",
    readOnly: true,
    rows: 2,
    value: PET_REQUEST_INSTRUCTION,
    hidden: true,
    ariaLabel: "Codex handoff instruction"
  });
  const copyInstruction = element("button", {
    className: "tweet-composer-kit__pet-secondary",
    type: "button",
    textContent: "Copy Codex instruction",
    hidden: true
  });
  form.append(
    fieldset("Maker source", [
      family.root,
      nftNumber,
      nftNumberHelp,
      labeledControl("Transparent Maker PNG", avatar),
      avatarHelp
    ]),
    fieldset("Exact Maker traits", [
      element("p", {
        className: "tweet-composer-kit__pet-help",
        textContent: 'Enter the Maker asset ID for every trait. Use the explicit ID "none" for a trait that is absent.'
      }),
      ...Object.entries(traitInputs).map(([trait, controls]) => element(
        "div",
        {
          className: "tweet-composer-kit__pet-trait"
        },
        element("span", { className: "tweet-composer-kit__pet-trait-name", textContent: friendlyTrait(trait) }),
        controls.assetId,
        controls.label
      ))
    ]),
    fieldset("Avatar completion", [
      coverage.root,
      bottom.root,
      bottomColor.root,
      footwear.root,
      footwearColor.root,
      element("p", {
        className: "tweet-composer-kit__pet-help",
        textContent: "Leg color follows the selected Maker family's race trait. Only compatible bottoms can be selected; garments and footwear are never inferred."
      })
    ]),
    fieldset("Pet handoff", [
      petName,
      personality
    ]),
    element("div", { className: "tweet-composer-kit__pet-actions" }, previewButton, exportButton),
    preview,
    status,
    instruction,
    copyInstruction
  );
  section.append(summary, disclosure, form);
  const state = { avatarBytes: null, image: null, previewBytes: null };
  disclosure.addEventListener("click", () => {
    const open = form.hidden;
    form.hidden = !open;
    disclosure.setAttribute("aria-expanded", String(open));
    disclosure.textContent = open ? "Close Custom Pet export" : "Prepare Maker pet bundle";
    if (open) family.select.focus();
  }, { signal });
  avatar.addEventListener("change", async () => {
    state.avatarBytes = null;
    state.image?.close?.();
    state.image = null;
    state.previewBytes = null;
    preview.hidden = true;
    const file = avatar.files?.[0];
    if (!file) return;
    try {
      if (file.type && file.type !== "image/png") throw new Error("Choose a PNG file.");
      if (file.size > 12 * 1024 * 1024) throw new Error("The Maker PNG must be 12 MB or smaller.");
      state.avatarBytes = new Uint8Array(await file.arrayBuffer());
      state.image = await decodePng(file);
      await requireTransparentImage(state.image);
      status.textContent = "Maker PNG loaded locally. Complete every explicit selection.";
    } catch (error) {
      avatar.value = "";
      state.avatarBytes = null;
      state.image?.close?.();
      state.image = null;
      status.textContent = error instanceof Error ? error.message : "The Maker PNG could not be read.";
    }
  }, { signal });
  coverage.select.addEventListener("change", () => {
    updateBottomCompatibility(bottom.select, coverage.select.value, status);
    state.previewBytes = null;
  }, { signal });
  family.select.addEventListener("change", () => {
    const range = nftNumberRangeForFamily(family.select.value);
    nftNumber.hidden = !range;
    nftNumberHelp.hidden = !range;
    if (!range) {
      nftNumberInput.value = "";
      return;
    }
    nftNumberInput.min = String(range.min);
    nftNumberInput.max = String(range.max);
    nftNumberInput.placeholder = `${range.min}\u2013${range.max}`;
    nftNumberHelp.textContent = `${FAMILY_LABELS[family.select.value]} NFT numbers run from ${range.min} to ${range.max}.`;
  }, { signal });
  for (const control of form.querySelectorAll("select, input, textarea")) {
    if (control === avatar || control === coverage.select || control === instruction) continue;
    control.addEventListener("change", () => {
      state.previewBytes = null;
    }, { signal });
  }
  previewButton.addEventListener("click", async () => {
    status.textContent = "";
    try {
      const selection = collectSelection({
        family,
        nftNumberInput,
        traitInputs,
        coverage,
        bottom,
        bottomColor,
        footwear,
        footwearColor,
        petName,
        personality,
        state
      });
      state.previewBytes = await renderCompletedAvatar(state.image, selection, preview);
      preview.hidden = false;
      status.textContent = "Preview ready. Review the completed lower half before downloading.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "The completed avatar could not be previewed.";
    }
  }, { signal });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    exportButton.disabled = true;
    previewButton.disabled = true;
    status.textContent = "Validating the local bundle\u2026";
    try {
      const selection = collectSelection({
        family,
        nftNumberInput,
        traitInputs,
        coverage,
        bottom,
        bottomColor,
        footwear,
        footwearColor,
        petName,
        personality,
        state
      });
      const avatarPng = await renderCompletedAvatar(state.image, selection, preview);
      state.previewBytes = avatarPng;
      preview.hidden = false;
      const imageSha256 = await sha256Hex(avatarPng);
      const request = makePetRequest({ ...selection, imageSha256 });
      const validation = await validatePetRequest(request, avatarPng);
      if (!validation.ok) throw new Error(validation.errors.join(" "));
      const requestBytes = new TextEncoder().encode(stableJson(request));
      const zipBytes = createStoredZip([
        { name: "avatar.png", bytes: avatarPng },
        { name: "request.json", bytes: requestBytes }
      ]);
      await validateFinishedArchive(zipBytes);
      downloadBytes(zipBytes, "remilia-pet-request.zip", "application/zip");
      instruction.hidden = false;
      copyInstruction.hidden = false;
      status.textContent = "Bundle validated and downloaded. Attach it to Codex with the instruction below.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "The bundle could not be exported.";
    } finally {
      if (!signal.aborted) {
        exportButton.disabled = false;
        previewButton.disabled = false;
      }
    }
  }, { signal });
  copyInstruction.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(PET_REQUEST_INSTRUCTION);
      status.textContent = "Codex instruction copied.";
    } catch {
      instruction.hidden = false;
      instruction.focus();
      instruction.select();
      status.textContent = "Clipboard access is unavailable. The instruction is selected for manual copy.";
    }
  }, { signal });
  signal.addEventListener("abort", () => state.image?.close?.(), { once: true });
  return section;
}
function collectSelection(controls) {
  if (!controls.state.image || !controls.state.avatarBytes) throw new Error("Choose a transparent Maker PNG.");
  const templateFamily = requiredValue(controls.family.select, "Choose a Maker template family.");
  const sourceNftNumber = optionalNftNumber(controls.nftNumberInput, templateFamily);
  const traits = Object.fromEntries(Object.entries(controls.traitInputs).map(([trait, input]) => {
    const assetId = requiredValue(input.assetId, `Enter the ${friendlyTrait(trait)} asset ID, or "none".`);
    return [trait, { assetId, ...input.label.value.trim() ? { label: input.label.value.trim() } : {} }];
  }));
  const legCoverage = requiredValue(controls.coverage.select, "Choose leg coverage.");
  const legColorVariant = legColorForRace(templateFamily, traits.race);
  if (!legColorVariant) {
    controls.traitInputs.race.assetId.focus();
    throw new Error(`The ${FAMILY_LABELS[templateFamily]} race is not mapped to a leg color yet. Enter its exact race asset ID or label.`);
  }
  const bottomAssetId = requiredValue(controls.bottom.select, "Choose a compatible bottom garment.");
  const bottomItem = bottomForAssetId(bottomAssetId);
  if (!bottomItem || !bottomItem.compatibleLegCoverage.includes(legCoverage)) {
    throw new Error("The selected bottom garment is not compatible with the chosen leg coverage.");
  }
  const bottomColorVariant = requiredValue(controls.bottomColor.select, "Choose a bottom color.");
  const footwearAssetId = requiredValue(controls.footwear.select, "Choose footwear.");
  const footwearItem = footwearForAssetId(footwearAssetId);
  if (!footwearItem) throw new Error("Choose footwear from the maintained catalog.");
  const footwearColorVariant = requiredValue(controls.footwearColor.select, "Choose a footwear color.");
  return {
    templateFamily,
    ...sourceNftNumber == null ? {} : { sourceNftNumber },
    traits,
    bodyCompletion: {
      legCoverage,
      legColorVariant,
      bottom: {
        category: bottomItem.category,
        assetId: bottomItem.assetId,
        assetVersion: bottomItem.assetVersion,
        colorVariant: bottomColorVariant
      },
      footwear: {
        category: footwearItem.category,
        assetId: footwearItem.assetId,
        assetVersion: footwearItem.assetVersion,
        colorVariant: footwearColorVariant
      }
    },
    rightsScope: "private-review",
    petName: controls.petName.querySelector("input").value,
    personality: controls.personality.querySelector("input").value
  };
}
function optionalNftNumber(control, templateFamily) {
  const raw = control.value.trim();
  if (!raw) return null;
  const value = Number(raw);
  const range = nftNumberRangeForFamily(templateFamily);
  if (!Number.isInteger(value) || !range || value < range.min || value > range.max) {
    control.focus();
    throw new Error(`Enter a whole ${FAMILY_LABELS[templateFamily]} NFT number from ${range?.min ?? "?"} to ${range?.max ?? "?"}.`);
  }
  return value;
}
async function renderCompletedAvatar(image, selection, canvas) {
  const context2 = canvas.getContext("2d", { alpha: true });
  if (!context2) throw new Error("Canvas rendering is unavailable.");
  context2.clearRect(0, 0, canvas.width, canvas.height);
  context2.imageSmoothingEnabled = true;
  context2.imageSmoothingQuality = "high";
  drawLowerBody(context2, selection);
  drawMakerUpperBody(context2, image, selection.templateFamily);
  const blob = await canvasBlob(canvas);
  return new Uint8Array(await blob.arrayBuffer());
}
function drawMakerUpperBody(context2, image, family) {
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  const sourceHeight = Math.max(1, Math.floor(height * 0.76));
  const familyScale = family === "bonkler" ? 0.94 : family === "remilio" ? 0.88 : 1;
  const destinationWidth = Math.round(820 * familyScale);
  const destinationHeight = Math.round(700 * familyScale);
  const x = Math.round((1024 - destinationWidth) / 2);
  const y = family === "remilio" ? 54 : 16;
  context2.drawImage(image, 0, 0, width, sourceHeight, x, y, destinationWidth, destinationHeight);
}
function drawLowerBody(context2, selection) {
  const family = {
    milady: { center: 512, hipWidth: 230, legWidth: 80, spread: 62, top: 600 },
    remilio: { center: 512, hipWidth: 250, legWidth: 92, spread: 66, top: 616 },
    bonkler: { center: 512, hipWidth: 310, legWidth: 110, spread: 82, top: 590 },
    kagami: { center: 512, hipWidth: 220, legWidth: 76, spread: 58, top: 590 }
  }[selection.templateFamily];
  const legColor = BODY_COMPLETION_CATALOG.legColors.find((item) => item.id === selection.bodyCompletion.legColorVariant);
  const bottomColor = colorForId(selection.bodyCompletion.bottom.colorVariant);
  const shoeColor = colorForId(selection.bodyCompletion.footwear.colorVariant);
  if (!legColor || !bottomColor || !shoeColor) throw new Error("Choose supported leg, bottom, and footwear colors.");
  const leftX = family.center - family.spread - family.legWidth / 2;
  const rightX = family.center + family.spread - family.legWidth / 2;
  context2.fillStyle = legColor.hex;
  roundedRect(context2, leftX, family.top + 90, family.legWidth, 300, 36);
  roundedRect(context2, rightX, family.top + 90, family.legWidth, 300, 36);
  drawBottom(context2, family, selection.bodyCompletion.bottom.category, selection.bodyCompletion.legCoverage, bottomColor.hex, leftX, rightX);
  drawFootwear(context2, selection.bodyCompletion.footwear.category, shoeColor.hex, leftX, rightX, family.legWidth);
}
function drawBottom(context2, family, category, coverage, color, leftX, rightX) {
  context2.fillStyle = color;
  const shortsBottom = coverage === "exposed" ? family.top + 188 : family.top + 236;
  if (coverage === "covered") {
    roundedRect(context2, leftX - 12, family.top + 72, family.legWidth + 24, 302, 30);
    roundedRect(context2, rightX - 12, family.top + 72, family.legWidth + 24, 302, 30);
  } else {
    roundedRect(context2, family.center - family.hipWidth / 2, family.top + 52, family.hipWidth, shortsBottom - family.top - 52, 34);
  }
  if (category === "cargo-shorts") {
    context2.fillStyle = shade(color, -24);
    roundedRect(context2, family.center - family.hipWidth / 2 - 18, family.top + 105, 54, 58, 8);
    roundedRect(context2, family.center + family.hipWidth / 2 - 36, family.top + 105, 54, 58, 8);
  } else if (category === "jeans") {
    context2.strokeStyle = shade(color, 38);
    context2.lineWidth = 7;
    context2.beginPath();
    context2.moveTo(family.center, family.top + 82);
    context2.lineTo(family.center, family.top + 345);
    context2.stroke();
  } else if (category === "dress-pants") {
    context2.strokeStyle = shade(color, 24);
    context2.lineWidth = 4;
    context2.beginPath();
    context2.moveTo(leftX + family.legWidth / 2, family.top + 115);
    context2.lineTo(leftX + family.legWidth / 2, family.top + 360);
    context2.moveTo(rightX + family.legWidth / 2, family.top + 115);
    context2.lineTo(rightX + family.legWidth / 2, family.top + 360);
    context2.stroke();
  } else if (category === "chinos") {
    context2.fillStyle = shade(color, -18);
    context2.fillRect(leftX - 12, family.top + 340, family.legWidth + 24, 22);
    context2.fillRect(rightX - 12, family.top + 340, family.legWidth + 24, 22);
  }
}
function drawFootwear(context2, category, color, leftX, rightX, legWidth) {
  const y = 918;
  context2.fillStyle = color;
  if (category === "boots") {
    roundedRect(context2, leftX - 22, y - 94, legWidth + 50, 116, 22);
    roundedRect(context2, rightX - 22, y - 94, legWidth + 50, 116, 22);
  } else if (category === "sandals") {
    roundedRect(context2, leftX - 26, y, legWidth + 58, 32, 16);
    roundedRect(context2, rightX - 26, y, legWidth + 58, 32, 16);
    context2.fillRect(leftX + 4, y - 40, 20, 48);
    context2.fillRect(rightX + 4, y - 40, 20, 48);
  } else {
    const height = category === "loafers" ? 56 : 70;
    roundedRect(context2, leftX - 30, y - height + 20, legWidth + 64, height, 25);
    roundedRect(context2, rightX - 30, y - height + 20, legWidth + 64, height, 25);
    if (category === "sneakers") {
      context2.fillStyle = shade(color, 42);
      context2.fillRect(leftX - 24, y + 4, legWidth + 52, 12);
      context2.fillRect(rightX - 24, y + 4, legWidth + 52, 12);
    }
  }
}
async function validateFinishedArchive(zipBytes) {
  const entries = listStoredZip(zipBytes);
  if (entries.length !== 2 || entries[0]?.name !== "avatar.png" || entries[1]?.name !== "request.json") {
    throw new Error("The bundle must contain exactly avatar.png and request.json.");
  }
  const request = JSON.parse(new TextDecoder().decode(entries[1].bytes));
  const validation = await validatePetRequest(request, entries[0].bytes);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
}
function updateBottomCompatibility(select, legCoverage, status) {
  const compatible = new Set(compatibleBottoms(legCoverage).map((item) => item.assetId));
  let invalidated = false;
  for (const option of select.options) {
    if (!option.value) continue;
    option.disabled = !compatible.has(option.value);
    option.textContent = `${bottomForAssetId(option.value)?.label ?? option.value}${option.disabled ? " \u2014 unavailable" : ""}`;
    if (option.selected && option.disabled) invalidated = true;
  }
  if (invalidated) {
    select.value = "";
    status.textContent = "That bottom garment conflicts with the new leg coverage. Choose one of the available options.";
  } else if (legCoverage) {
    status.textContent = "Compatible bottom garments are available.";
  }
}
function blankSelect(label, options) {
  const select = element("select", { className: "tweet-composer-kit__pet-select", required: true, ariaLabel: label });
  select.append(element("option", { value: "", textContent: `Choose ${label.toLowerCase()}`, selected: true }));
  for (const option of options) select.append(element("option", { value: option.id, textContent: option.label }));
  return { select, root: labeledControl(label, select) };
}
function labeledInput(label, maxLength) {
  return labeledControl(label, element("input", {
    className: "tweet-composer-kit__pet-input",
    type: "text",
    maxLength,
    autocomplete: "off"
  }));
}
function labeledControl(label, control) {
  return element(
    "label",
    { className: "tweet-composer-kit__pet-field" },
    element("span", { className: "tweet-composer-kit__pet-label", textContent: label }),
    control
  );
}
function fieldset(legend, children) {
  return element(
    "fieldset",
    { className: "tweet-composer-kit__pet-fieldset" },
    element("legend", { textContent: legend }),
    ...children
  );
}
function requiredValue(control, message) {
  const value = control.value.trim();
  if (!value) {
    control.focus();
    throw new Error(message);
  }
  return value;
}
function friendlyTrait(value) {
  return value.replace(/([A-Z])/gu, " $1").replace(/^./u, (letter) => letter.toUpperCase());
}
async function decodePng(file) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}
async function requireTransparentImage(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context2 = canvas.getContext("2d", { willReadFrequently: true });
  if (!context2) throw new Error("Canvas inspection is unavailable.");
  context2.clearRect(0, 0, 96, 96);
  context2.drawImage(image, 0, 0, 96, 96);
  const pixels = context2.getImageData(0, 0, 96, 96).data;
  let transparent = 0;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 250) transparent += 1;
  if (transparent / (pixels.length / 4) < 0.02) {
    throw new Error("This PNG appears opaque. Export a transparent Maker avatar so background material is not included.");
  }
}
function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed.")), "image/png");
  });
}
function downloadBytes(bytes, fileName, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
function roundedRect(context2, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  context2.beginPath();
  context2.moveTo(x + r, y);
  context2.lineTo(x + width - r, y);
  context2.quadraticCurveTo(x + width, y, x + width, y + r);
  context2.lineTo(x + width, y + height - r);
  context2.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context2.lineTo(x + r, y + height);
  context2.quadraticCurveTo(x, y + height, x, y + height - r);
  context2.lineTo(x, y + r);
  context2.quadraticCurveTo(x, y, x + r, y);
  context2.closePath();
  context2.fill();
}
function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = clamp((value >> 16) + amount);
  const green = clamp((value >> 8 & 255) + amount);
  const blue = clamp((value & 255) + amount);
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
function clamp(value) {
  return Math.max(0, Math.min(255, value));
}
function element(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}

// examples/packages/local-dev/tweet-composer-kit/src/content.js
var context = null;
var makers = [
  { label: "#CHEESEWORLD Meme Maker", asset: "assets/makers/cheeseworld.png", theme: "cheeseworld", href: "https://cult.inc/cheeseworld" },
  { label: "Milady Maker", asset: "assets/makers/milady.png", theme: "milady", handoffId: "milady-maker" },
  { label: "Redacted Remilio Babies Maker", asset: "assets/makers/remilio.png", theme: "remilio", handoffId: "remilio-maker" },
  { label: "Bonkler Factory", asset: "assets/makers/bonkler.png", theme: "bonkler", handoffId: "bonkler-maker" },
  { label: "Kagami Academy Maker", asset: "assets/makers/kagami.png", theme: "kagami", handoffId: "kagami-maker" }
];
function boot(nextContext) {
  context = nextContext;
  context.recordDiagnostic("tweet-composer-kit.ready", { capability: "composer-adjacent-panel" });
}
async function onComposerAction({ panel, externalHandoffs, launchExternalHandoff, queryRemoteService, signal }) {
  if (!context || signal.aborted) return;
  panel.replaceChildren(buildControls({ externalHandoffs, launchExternalHandoff, queryRemoteService, signal }));
  signal.addEventListener("abort", () => panel.replaceChildren(), { once: true });
}
function onReplyAction({ panel, templates, selectTemplate, openNativeReply, close, signal }) {
  if (!context || signal.aborted) return;
  const menuTemplates = Array.isArray(templates) ? templates.filter((template) => template && typeof template.id === "string" && template.id.length > 0) : [];
  const root = el("section", { className: "tweet-composer-kit tweet-composer-kit__reply-menu", ariaLabel: "Composer Kit quick reply" });
  const status = el("p", { className: "tweet-composer-kit__status", ariaLive: "polite", role: "status" });
  const rows = el("div", { className: "tweet-composer-kit__reply-rows", role: "menu", ariaLabel: "Quick reply choices" });
  const buttons = [];
  const makeRow = ({ label, iconPath, action, primary = false }) => {
    const button = el(
      "button",
      { className: `tweet-composer-kit__reply-row${primary ? " tweet-composer-kit__reply-row--primary" : ""}`, type: "button", role: "menuitem" },
      replyIcon(iconPath),
      el("span", { className: "tweet-composer-kit__reply-copy" }, el("strong", { textContent: label }))
    );
    button.addEventListener("click", async () => {
      if (signal.aborted) return;
      buttons.forEach((entry) => {
        entry.disabled = true;
      });
      try {
        await action();
      } catch {
        if (!signal.aborted) {
          buttons.forEach((entry) => {
            entry.disabled = false;
          });
          status.textContent = "Quick reply could not open. Try again.";
        }
      }
    }, { signal });
    buttons.push(button);
    rows.append(button);
  };
  root.append(rows, status);
  makeRow({ label: "Send a reply", iconPath: "assets/reply-arrow.svg", action: () => openNativeReply() });
  for (const template of menuTemplates) {
    makeRow({
      label: template.label || template.id,
      iconPath: "assets/reply-lightning.svg",
      primary: template.id !== "custom",
      action: async () => {
        status.textContent = `Opening ${template.label || template.id} quick reply...`;
        await selectTemplate(template.id);
      }
    });
  }
  if (!menuTemplates.length) rows.append(el("p", { className: "tweet-composer-kit__empty", textContent: "No local quick replies are available." }));
  panel.replaceChildren(root);
  signal.addEventListener("abort", () => panel.replaceChildren(), { once: true });
}
function buildControls({ externalHandoffs, launchExternalHandoff, queryRemoteService, signal }) {
  const root = el("section", { className: "tweet-composer-kit tweet-composer-kit__composer-panel", ariaLabel: "Tweet Composer Kit" });
  const topInput = el("input", { className: "tweet-composer-kit__caption-input", type: "text", maxLength: 280, placeholder: "Top text", ariaLabel: "Top text", autocomplete: "off" });
  const bottomInput = el("input", { className: "tweet-composer-kit__caption-input", type: "text", maxLength: 280, placeholder: "Bottom text", ariaLabel: "Bottom text", autocomplete: "off" });
  const random = el("input", { id: "tweet-composer-kit-random-meme", className: "tweet-composer-kit__random-toggle", type: "checkbox" });
  root.append(
    el("div", { className: "tweet-composer-kit__caption-fields" }, topInput, bottomInput),
    buildMemeControls(random),
    buildMakerRow({ externalHandoffs, launchExternalHandoff, random, topInput, bottomInput, signal }),
    buildCustomPetExport({ signal }),
    buildMediaPicker({ queryRemoteService, signal }),
    buildContributionHandoff({ signal })
  );
  return root;
}
function buildContributionHandoff({ signal }) {
  const root = el("section", { className: "tweet-composer-kit__contribution", ariaLabel: "Contribute to Remibooru" });
  const rights = el("input", { id: "tweet-composer-kit-remibooru-rights", className: "tweet-composer-kit__contribution-check", type: "checkbox" });
  const status = el("p", { className: "tweet-composer-kit__contribution-status", role: "status", ariaLive: "polite" });
  const open = el("a", {
    className: "tweet-composer-kit__contribution-open",
    href: "https://remibooru.com/upload",
    target: "_blank",
    rel: "noopener noreferrer",
    textContent: "Open native upload"
  });
  open.addEventListener("click", (event) => {
    if (rights.checked) return;
    event.preventDefault();
    status.textContent = "Confirm that you have the right to contribute before opening the public uploader.";
  }, { signal });
  rights.addEventListener("change", () => {
    status.textContent = "";
  }, { signal });
  root.append(
    el("strong", { className: "tweet-composer-kit__contribution-title", textContent: "Contribute to Remibooru" }),
    el("p", { className: "tweet-composer-kit__contribution-copy", textContent: "Public upload. Composer Kit transfers no image, tag, account, or draft data; select media, tags, and final publish in Remibooru." }),
    el("label", { className: "tweet-composer-kit__contribution-rights", htmlFor: rights.id }, rights, el("span", { textContent: "I have the right to contribute this media publicly." })),
    open,
    status
  );
  return root;
}
function buildMediaPicker({ queryRemoteService, signal }) {
  const root = el("section", { className: "tweet-composer-kit__media-picker", ariaLabel: "Remibooru reaction media" });
  const facets = el("input", { className: "tweet-composer-kit__media-query", type: "search", maxLength: 160, placeholder: "Search Remibooru tags", ariaLabel: "Search Remibooru tags", autocomplete: "off" });
  const recent = el("button", { className: "tweet-composer-kit__media-button", type: "button", textContent: "Recent" });
  const search = el("button", { className: "tweet-composer-kit__media-button", type: "button", textContent: "Search" });
  const tags = el("button", { className: "tweet-composer-kit__media-button", type: "button", textContent: "Tags" });
  const results = el("div", { className: "tweet-composer-kit__media-results", role: "list", ariaLabel: "Remibooru results" });
  const facetList = el("div", { className: "tweet-composer-kit__media-facets", ariaLabel: "Remibooru tags" });
  const more = el("button", { className: "tweet-composer-kit__media-more", type: "button", textContent: "More", hidden: true });
  const status = el("p", { className: "tweet-composer-kit__media-status", role: "status", ariaLive: "polite" });
  const available = typeof queryRemoteService === "function";
  let nextCursor = null;
  const setBusy = (busy) => {
    root.toggleAttribute("data-busy", busy);
    root.setAttribute("aria-busy", String(busy));
    recent.disabled = busy || !available;
    search.disabled = busy || !available;
    tags.disabled = busy || !available;
    more.disabled = busy || !available;
  };
  const render = (items, replace) => {
    if (replace) results.replaceChildren();
    const safeItems = Array.isArray(items) ? items.filter(isRemibooruResult) : [];
    for (const item of safeItems) {
      const thumbnail = el("img", { className: "tweet-composer-kit__media-thumb", src: item.thumbnailUrl, alt: "", ariaHidden: "true" });
      const attribution = el("span", { className: "tweet-composer-kit__media-attribution", textContent: "Remibooru" });
      results.append(el("a", {
        className: "tweet-composer-kit__media-item",
        href: item.postUrl,
        target: "_blank",
        rel: "noopener noreferrer",
        role: "listitem",
        ariaLabel: "Open this Remibooru post",
        title: "Open on Remibooru"
      }, thumbnail, attribution));
    }
    if (!results.childElementCount) status.textContent = "No matching Remibooru media was found.";
  };
  const load = async ({ cursor = null, recentOnly = false } = {}) => {
    if (!available || signal.aborted) return;
    const parsedFacets = recentOnly ? [] : parseRemibooruFacets(facets.value);
    setBusy(true);
    status.textContent = recentOnly ? "Loading recent Remibooru media..." : "Searching Remibooru...";
    try {
      const result = await queryRemoteService("remibooru-reactions", {
        resource: "posts",
        limit: 12,
        facets: parsedFacets,
        ...cursor ? { cursor } : {}
      });
      if (!result?.ok || !result.page) throw new Error(result?.error || "Remibooru is unavailable.");
      if (signal.aborted) return;
      render(result.page.items, !cursor);
      nextCursor = typeof result.page.nextCursor === "string" && result.page.nextCursor ? result.page.nextCursor : null;
      more.hidden = !nextCursor;
      if (results.childElementCount) status.textContent = "Remibooru results. Select one to open its canonical post.";
    } catch {
      if (!signal.aborted) {
        more.hidden = true;
        status.textContent = "Remibooru is unavailable. Try again.";
      }
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  };
  recent.addEventListener("click", () => void load({ recentOnly: true }), { signal });
  search.addEventListener("click", () => void load(), { signal });
  tags.addEventListener("click", async () => {
    if (!available || signal.aborted) return;
    setBusy(true);
    status.textContent = "Loading Remibooru tags...";
    try {
      const result = await queryRemoteService("remibooru-reactions", { resource: "facets" });
      if (!result?.ok || !Array.isArray(result.facets)) throw new Error(result?.error || "Remibooru is unavailable.");
      if (signal.aborted) return;
      facetList.replaceChildren(...result.facets.slice(0, 12).filter((facet) => facet && typeof facet.value === "string").map((facet) => {
        const choice = el("button", { className: "tweet-composer-kit__media-facet", type: "button", textContent: facet.value, title: `${facet.postCount || 0} posts` });
        choice.addEventListener("click", () => {
          facets.value = facet.value;
          void load();
        }, { signal });
        return choice;
      }));
      status.textContent = facetList.childElementCount ? "Choose a Remibooru tag to search." : "No Remibooru tags are available.";
    } catch {
      if (!signal.aborted) status.textContent = "Remibooru tags are unavailable. Try again.";
    } finally {
      if (!signal.aborted) setBusy(false);
    }
  }, { signal });
  facets.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void load();
  }, { signal });
  more.addEventListener("click", () => void load({ cursor: nextCursor }), { signal });
  root.append(el("div", { className: "tweet-composer-kit__media-controls" }, facets, recent, search, tags), facetList, results, more, status);
  if (!available) {
    status.textContent = "Remibooru search is not available in this build.";
    setBusy(false);
  }
  return root;
}
function parseRemibooruFacets(value) {
  return String(value || "").split(/[\s,]+/).map((facet) => facet.trim()).filter(Boolean).slice(0, 5).map((facet) => facet.slice(0, 60));
}
function isRemibooruResult(item) {
  return Boolean(item && typeof item.postUrl === "string" && item.postUrl.startsWith("https://remibooru.com/posts/") && typeof item.thumbnailUrl === "string" && item.thumbnailUrl.startsWith("https://remibooru.com/media/thumbs/"));
}
function buildMemeControls(random) {
  const tooltipId = "tweet-composer-kit-meme-help";
  const info = el(
    "button",
    { className: "tweet-composer-kit__info", type: "button", ariaLabel: "How meme this post works", ariaDescribedBy: tooltipId, textContent: "i" },
    el("span", { id: tooltipId, className: "tweet-composer-kit__tooltip", role: "tooltip", textContent: "Choose a maker. Captioned sends the Top text and Bottom text you enter; random meme permits both fields to be empty and asks for an uncaptioned random output. CHEESEWORLD stays a normal link." })
  );
  return el(
    "div",
    { className: "tweet-composer-kit__meme-controls" },
    el("label", { className: "tweet-composer-kit__random-label", htmlFor: random.id }, random, el("span", { textContent: "random meme?" })),
    info
  );
}
function buildMakerRow({ externalHandoffs, launchExternalHandoff, random, topInput, bottomInput, signal }) {
  const root = el("div", { className: "tweet-composer-kit__maker-group" });
  const list = el("div", { className: "tweet-composer-kit__maker-row", ariaLabel: "Maker destinations" });
  const status = el("p", { className: "tweet-composer-kit__maker-status", role: "status", ariaLive: "polite" });
  const available = new Set(Array.isArray(externalHandoffs) ? externalHandoffs.map((action) => action && action.id) : []);
  for (const maker of makers) {
    const className = `tweet-composer-kit__maker tweet-composer-kit__maker--${maker.theme}`;
    const image = el("img", { className: "tweet-composer-kit__maker-thumb", src: context.resolveAssetUrl(maker.asset), alt: "", ariaHidden: "true" });
    if (maker.href) {
      list.append(el("a", { className, href: maker.href, target: "_blank", rel: "noopener noreferrer", ariaLabel: maker.label, title: maker.label }, image));
      continue;
    }
    const action = el("button", { className, type: "button", ariaLabel: maker.label, title: maker.label, disabled: typeof launchExternalHandoff !== "function" || !available.has(maker.handoffId) }, image);
    action.addEventListener("click", async () => {
      if (signal.aborted || action.disabled) return;
      setMakerBusy(list, action, true);
      status.textContent = `${maker.label} is preparing an image\u2026`;
      try {
        await launchExternalHandoff(maker.handoffId, {
          mode: random.checked ? "randomMeme" : "captioned",
          captions: { topText: topInput.value, bottomText: bottomInput.value }
        });
        if (!signal.aborted) status.textContent = `${maker.label} handoff complete. Check the active composer.`;
      } catch {
        if (!signal.aborted) status.textContent = `${maker.label} could not open. Try again.`;
      } finally {
        if (!signal.aborted) setMakerBusy(list, action, false);
      }
    }, { signal });
    list.append(action);
  }
  root.append(list, status);
  return root;
}
function setMakerBusy(list, activeAction, busy) {
  list.classList.toggle("is-busy", busy);
  list.setAttribute("aria-busy", String(busy));
  for (const control of list.children) {
    const active = control === activeAction;
    control.classList.toggle("is-loading", busy && active);
    if (control.tagName === "BUTTON") {
      if (busy) {
        control.dataset.tckWasDisabled = String(control.disabled);
        control.disabled = true;
      } else {
        control.disabled = control.dataset.tckWasDisabled === "true";
        delete control.dataset.tckWasDisabled;
      }
      continue;
    }
    if (busy) {
      control.dataset.tckTabindex = control.getAttribute("tabindex") || "";
      control.setAttribute("tabindex", "-1");
      control.setAttribute("aria-disabled", "true");
    } else {
      const previousTabindex = control.dataset.tckTabindex;
      if (previousTabindex) control.setAttribute("tabindex", previousTabindex);
      else control.removeAttribute("tabindex");
      control.removeAttribute("aria-disabled");
      delete control.dataset.tckTabindex;
    }
  }
}
function replyIcon(path) {
  const image = el("img", { className: "tweet-composer-kit__reply-icon", alt: "", ariaHidden: "true" });
  image.src = context.resolveAssetUrl(path);
  return image;
}
function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}
export {
  boot,
  onComposerAction,
  onReplyAction
};
