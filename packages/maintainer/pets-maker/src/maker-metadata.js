const MAKER_METADATA_ORIGIN = "https://maker.remilia.org";
const MAX_METADATA_BYTES = 256 * 1024;

const FAMILY_METADATA_NAMES = Object.freeze({
  milady: "Milady",
  remilio: "Remilio",
  bonkler: "Bonkler",
  kagami: "Kagami",
});

const FAMILY_TRAIT_TYPES = Object.freeze({
  milady: Object.freeze({ race: "Race", hair: "Hair", eyes: "Eyes", glasses: "Glasses", shirt: "Shirt", earrings: "Earrings" }),
  remilio: Object.freeze({ race: "Race", hair: "Hair", eyes: "Eyes", glasses: "Glasses", shirt: "Shirt", earrings: "Earrings" }),
  bonkler: Object.freeze({ race: "Body", hair: "Head", eyes: "Face", glasses: "Glasses", shirt: "Armor", earrings: "Earrings" }),
  kagami: Object.freeze({ race: "Girl", hair: "Hair", eyes: "Eyes", glasses: "Glasses", shirt: "Outfit", earrings: "Earrings" }),
});

export function makerMetadataUrl(family, tokenId) {
  const familyName = FAMILY_METADATA_NAMES[family];
  if (!familyName || !Number.isInteger(tokenId) || tokenId < 0) throw new Error("Unsupported Maker metadata request.");
  return `${MAKER_METADATA_ORIGIN}/metadata/${encodeURIComponent(familyName)}/${tokenId}`;
}

export async function fetchMakerTraits(family, tokenId, { signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl(makerMetadataUrl(family, tokenId), {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "omit",
    referrerPolicy: "no-referrer",
    signal,
  });
  if (!response.ok) throw new Error(`Maker metadata request failed (${response.status}).`);
  const declaredLength = Number(response.headers.get("content-length") || 0);
  if (declaredLength > MAX_METADATA_BYTES) throw new Error("Maker metadata response is too large.");
  const text = await response.text();
  if (text.length > MAX_METADATA_BYTES) throw new Error("Maker metadata response is too large.");
  let metadata;
  try {
    metadata = JSON.parse(text);
  } catch {
    throw new Error("Maker metadata response was not valid JSON.");
  }
  return traitsFromMakerMetadata(family, metadata);
}

export function traitsFromMakerMetadata(family, metadata) {
  const traitTypes = FAMILY_TRAIT_TYPES[family];
  if (!traitTypes || !metadata || !Array.isArray(metadata.attributes) || metadata.attributes.length > 64) {
    throw new Error("Maker metadata did not contain a supported trait list.");
  }
  const attributes = new Map();
  for (const item of metadata.attributes) {
    if (!item || typeof item.trait_type !== "string" || typeof item.value !== "string") continue;
    const type = item.trait_type.trim();
    const value = item.value.trim();
    if (!type || !value || type.length > 80 || value.length > 120) continue;
    attributes.set(type.toLowerCase(), { type, value });
  }
  return Object.fromEntries(Object.entries(traitTypes).map(([trait, sourceType]) => {
    const source = attributes.get(sourceType.toLowerCase());
    if (!source) return [trait, { assetId: "none", label: "None" }];
    return [trait, {
      assetId: makerAssetId(family, source.type, source.value),
      label: source.value,
    }];
  }));
}

function makerAssetId(family, traitType, value) {
  const slug = `${traitType}-${value}`
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 58)
    .replace(/-+$/u, "") || "unknown";
  return `${family}-${slug}-v1`;
}
