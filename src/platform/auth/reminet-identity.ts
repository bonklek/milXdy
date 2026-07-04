export type ReminetIdentityProfile = {
  xHandle: string | null;
  remiliaUsername: string | null;
  displayName: string | null;
  pfpProject: string | null;
  pfpId: string | null;
  pfpUrl: string | null;
  nftContractAddress: string | null;
  nftOwnerAddress: string | null;
  ensName: string | null;
  gweiName: string | null;
  gweiGatewayUrl: string | null;
  gweiNameCandidates: string[];
  beetleCount: number | null;
  remiStatsScore: number | null;
  friendCount: number | null;
  trophyShelves: unknown[] | null;
  allTrophies: unknown[] | null;
  connections: unknown[] | null;
  sources: string[];
  updatedAt: number;
};

export type ReminetIdentityCacheEntry = {
  profile: ReminetIdentityProfile;
  cachedAt: number;
};

export type ReminetIdentityCache = Record<string, ReminetIdentityCacheEntry>;

export const REMINET_IDENTITY_CACHE_KEY = "milxdy.reminetIdentity.profileCache";
export const REMINET_IDENTITY_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
export const REMINET_IDENTITY_CACHE_MAX_ENTRIES = 600;

export const ETHEREUM_RPC_URL = "https://ethereum.publicnode.com";
export const ENS_REGISTRY_ADDRESS = "0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e";
export const GWEI_NAME_SERVICE_ADDRESS = "0x9D51D507BC7264d4fE8Ad1cf7Fe191933A0a81d6";
export const GWEI_RESOLVE_SELECTOR = "0x4f896d4f";
export const GWEI_REVERSE_RESOLVE_SELECTOR = "0x9af8b7aa";

export const PFP_PROJECT_CONTRACTS: Record<string, string> = {
  milady: "0x5af0d9827e0c53e4799bb226655a1de152a425a5",
  remilio: "0xd3d9ddd0cf0a5f0bfb8f7fceae075df687eaebab",
  "redacted remilio babies": "0xd3d9ddd0cf0a5f0bfb8f7fceae075df687eaebab",
  redactedremiliobabies: "0xd3d9ddd0cf0a5f0bfb8f7fceae075df687eaebab",
};

export function normalizeXHandle(value: unknown): string {
  return typeof value === "string"
    ? value.trim().replace(/^@+/, "").replace(/^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\//i, "").split(/[/?#]/)[0].toLowerCase()
    : "";
}

export function normalizeRemiliaUsername(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/^[@~]+/, "").replace(/[^a-zA-Z0-9_-]/g, "").toLowerCase() : "";
}

export function normalizePfpProject(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function identityCacheKeyForXHandle(handle: string): string {
  return `x:${normalizeXHandle(handle)}`;
}

export function identityCacheKeyForRemiliaUsername(username: string): string {
  return `rn:${normalizeRemiliaUsername(username)}`;
}

export function emptyIdentityProfile(): ReminetIdentityProfile {
  return {
    xHandle: null,
    remiliaUsername: null,
    displayName: null,
    pfpProject: null,
    pfpId: null,
    pfpUrl: null,
    nftContractAddress: null,
    nftOwnerAddress: null,
    ensName: null,
    gweiName: null,
    gweiGatewayUrl: null,
    gweiNameCandidates: [],
    beetleCount: null,
    remiStatsScore: null,
    friendCount: null,
    trophyShelves: null,
    allTrophies: null,
    connections: null,
    sources: [],
    updatedAt: Date.now(),
  };
}

export function mergeIdentityProfile(
  base: ReminetIdentityProfile,
  patch: Partial<ReminetIdentityProfile>,
  source?: string,
): ReminetIdentityProfile {
  const sources = new Set([...(base.sources || []), ...(patch.sources || [])]);
  if (source) sources.add(source);
  const gweiNameCandidates = uniqueStrings([
    ...(base.gweiNameCandidates || []),
    ...(patch.gweiNameCandidates || []),
  ], normalizeGweiName);
  return {
    ...base,
    ...Object.fromEntries(
      Object.entries(patch).filter(([key, value]) => key !== "gweiNameCandidates" && value !== undefined && value !== null && value !== ""),
    ),
    gweiNameCandidates,
    sources: Array.from(sources).sort(),
    updatedAt: Date.now(),
  };
}

export function contractForPfpProject(project: unknown): string | null {
  return PFP_PROJECT_CONTRACTS[normalizePfpProject(project)] || null;
}

export function ownerOfCallData(tokenId: string | number): string | null {
  try {
    const numeric = BigInt(String(tokenId));
    if (numeric < 0n) return null;
    return `0x6352211e${numeric.toString(16).padStart(64, "0")}`;
  } catch {
    return null;
  }
}

export function addressFromEthCallResult(value: unknown): string | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  const address = `0x${value.slice(-40)}`;
  return /^0x0{40}$/i.test(address) ? null : address;
}

export function isEthereumAddress(value: unknown): value is string {
  return typeof value === "string" && /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function ensResolverCallData(node: string): string | null {
  return isBytes32(node) ? `0x0178b8bf${node.slice(2)}` : null;
}

export function ensNameCallData(node: string): string | null {
  return isBytes32(node) ? `0x691f3431${node.slice(2)}` : null;
}

export function decodeAbiStringResult(value: unknown): string | null {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]*$/.test(value)) return null;
  const hex = value.slice(2);
  if (hex.length < 128) return null;
  const offset = Number.parseInt(hex.slice(0, 64), 16);
  if (!Number.isFinite(offset)) return null;
  const lengthStart = offset * 2;
  const length = Number.parseInt(hex.slice(lengthStart, lengthStart + 64), 16);
  if (!Number.isFinite(length) || length <= 0) return null;
  const stringHex = hex.slice(lengthStart + 64, lengthStart + 64 + length * 2);
  if (stringHex.length !== length * 2) return null;
  try {
    const bytes = stringHex.match(/.{1,2}/g)?.map((byte) => Number.parseInt(byte, 16)) || [];
    const decoded = new TextDecoder().decode(new Uint8Array(bytes)).trim();
    return decoded || null;
  } catch {
    return null;
  }
}

export function hexFromUtf8(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function concatHex(...values: string[]): string | null {
  if (!values.every((value) => /^0x[0-9a-fA-F]*$/.test(value))) return null;
  return `0x${values.map((value) => value.slice(2)).join("")}`;
}

export function reverseEnsNameForAddress(address: string): string | null {
  return isEthereumAddress(address) ? `${address.slice(2).toLowerCase()}.addr.reverse` : null;
}

export function normalizeGweiName(value: unknown): string {
  if (typeof value !== "string") return "";
  const cleaned = value.trim().toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .split(/[/?#]/)[0] || "";
  const match = cleaned.match(/^([a-z0-9_-](?:[a-z0-9_.-]*[a-z0-9_-])?)\.gwei(?:\.domains)?$/i);
  return match?.[1] ? `${match[1]}.gwei` : "";
}

export function gweiGatewayUrl(name: string): string | null {
  const normalized = normalizeGweiName(name);
  return normalized ? `https://${normalized}.domains` : null;
}

export function gweiResolveCallData(node: string): string | null {
  return isBytes32(node) ? `${GWEI_RESOLVE_SELECTOR}${node.slice(2)}` : null;
}

export function gweiReverseResolveCallData(address: string): string | null {
  return isEthereumAddress(address) ? `${GWEI_REVERSE_RESOLVE_SELECTOR}${address.slice(2).padStart(64, "0")}` : null;
}

export function extractGweiNameCandidates(value: unknown): string[] {
  const found = new Set<string>();
  visitStrings(value, (entry) => {
    for (const match of entry.matchAll(/\b(?:https?:\/\/)?(?:www\.)?([a-z0-9_-](?:[a-z0-9_.-]*[a-z0-9_-])?\.gwei(?:\.domains)?)\b/gi)) {
      const normalized = normalizeGweiName(match[1] || "");
      if (normalized) found.add(normalized);
    }
  });
  return Array.from(found).sort();
}

function uniqueStrings(value: unknown[], map: (entry: unknown) => string): string[] {
  return Array.from(new Set(value.map((entry) => map(entry)).filter(Boolean))).sort();
}

function visitStrings(value: unknown, visit: (entry: string) => void, depth = 0): void {
  if (depth > 4 || value == null) return;
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) visitStrings(item, visit, depth + 1);
    return;
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) visitStrings(item, visit, depth + 1);
  }
}

function isBytes32(value: string): boolean {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}
