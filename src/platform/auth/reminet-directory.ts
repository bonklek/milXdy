export type ReminetDirectoryIdentifierType = "handle" | "x_handle" | "github" | "discord";

export type ReminetDirectoryIdentifier = {
  type: ReminetDirectoryIdentifierType;
  value: string;
};

export type ReminetDirectoryIdentity = {
  handle: string;
  display_name: string;
  avatar_url: string;
  avatar_url_small?: string;
};

export type ReminetDirectoryApiResult = {
  query: ReminetDirectoryIdentifier;
  identity: ReminetDirectoryIdentity | null;
};

export type ReminetDirectoryApiFailure = {
  ok: false;
  error: {
    code: string;
    category?: string;
    status: number;
    retryAfterMs?: number;
  };
};

export type ReminetDirectoryApiResponse = {
  ok: true;
  data: readonly ReminetDirectoryApiResult[];
  status: number;
} | ReminetDirectoryApiFailure;

export type ReminetDirectoryPositiveCacheEntry = {
  query: ReminetDirectoryIdentifier;
  identity: ReminetDirectoryIdentity;
  cachedAt: number;
  source: "remilia-api-v1:directory";
};

export type ReminetDirectoryNegativeCacheEntry = {
  query: ReminetDirectoryIdentifier;
  cachedAt: number;
  source: "remilia-api-v1:directory";
};

export type ReminetDirectoryCache = {
  positive: Record<string, ReminetDirectoryPositiveCacheEntry>;
  negative: Record<string, ReminetDirectoryNegativeCacheEntry>;
};

export type ReminetDirectoryResolution = {
  query: ReminetDirectoryIdentifier;
  identity: ReminetDirectoryIdentity | null;
  status: "resolved" | "not_found" | "error";
  cached: boolean;
  provenance: "remilia-api-v1:directory";
  error?: {
    code: string;
    category?: string;
    status: number;
    retryAfterMs?: number;
  };
};

export type ResolveReminetDirectoryOptions = {
  now?: () => number;
  force?: boolean;
  positiveTtlMs?: number;
  negativeTtlMs?: number;
  positiveMaxEntries?: number;
  negativeMaxEntries?: number;
};

export const REMINET_DIRECTORY_BATCH_MAX = 50;
export const REMINET_DIRECTORY_POSITIVE_TTL_MS = 6 * 60 * 60 * 1000;
export const REMINET_DIRECTORY_NEGATIVE_TTL_MS = 15 * 60 * 1000;
export const REMINET_DIRECTORY_POSITIVE_MAX_ENTRIES = 600;
export const REMINET_DIRECTORY_NEGATIVE_MAX_ENTRIES = 600;

export function emptyReminetDirectoryCache(): ReminetDirectoryCache {
  return { positive: {}, negative: {} };
}

export function normalizeReminetDirectoryCache(value: unknown): ReminetDirectoryCache {
  if (!isRecord(value)) return emptyReminetDirectoryCache();
  const positive = isRecord(value.positive) ? Object.fromEntries(
    Object.entries(value.positive).filter((entry): entry is [string, ReminetDirectoryPositiveCacheEntry] => {
      const candidate = entry[1];
      return isRecord(candidate)
        && isDirectoryIdentifier(candidate.query)
        && isDirectoryIdentity(candidate.identity)
        && finiteTimestamp(candidate.cachedAt);
    }),
  ) : {};
  const negative = isRecord(value.negative) ? Object.fromEntries(
    Object.entries(value.negative).filter((entry): entry is [string, ReminetDirectoryNegativeCacheEntry] => {
      const candidate = entry[1];
      return isRecord(candidate)
        && isDirectoryIdentifier(candidate.query)
        && finiteTimestamp(candidate.cachedAt);
    }),
  ) : {};
  return { positive, negative };
}

export function normalizeReminetDirectoryIdentifier(identifier: ReminetDirectoryIdentifier): ReminetDirectoryIdentifier | null {
  const value = normalizeIdentifierValue(identifier.type, identifier.value);
  return value ? { type: identifier.type, value } : null;
}

export function remiNetDirectoryCacheKey(identifier: ReminetDirectoryIdentifier): string {
  const normalized = normalizeReminetDirectoryIdentifier(identifier);
  return normalized ? `${normalized.type}:${normalized.value}` : "";
}

export function remiNetDirectoryAliasKey(identifier: ReminetDirectoryIdentifier): string {
  const normalized = normalizeReminetDirectoryIdentifier(identifier);
  if (!normalized) return "";
  if (normalized.type === "handle") return `rn:${normalized.value}`;
  if (normalized.type === "x_handle") return `x:${normalized.value}`;
  return `${normalized.type}:${normalized.value}`;
}

export function mergeReminetDirectoryCache(target: ReminetDirectoryCache, source: ReminetDirectoryCache): void {
  for (const [key, entry] of Object.entries(source.positive)) {
    if (!target.positive[key] || target.positive[key].cachedAt <= entry.cachedAt) target.positive[key] = entry;
    if (target.negative[key]?.cachedAt <= entry.cachedAt) delete target.negative[key];
  }
  for (const [key, entry] of Object.entries(source.negative)) {
    if (!target.negative[key] || target.negative[key].cachedAt <= entry.cachedAt) target.negative[key] = entry;
    if (target.positive[key]?.cachedAt <= entry.cachedAt) delete target.positive[key];
  }
}

export function pruneReminetDirectoryCache(
  cache: ReminetDirectoryCache,
  options: Pick<ResolveReminetDirectoryOptions, "now" | "positiveTtlMs" | "negativeTtlMs" | "positiveMaxEntries" | "negativeMaxEntries"> = {},
): ReminetDirectoryCache {
  const now = (options.now ?? Date.now)();
  const positiveTtlMs = boundedTtl(options.positiveTtlMs, REMINET_DIRECTORY_POSITIVE_TTL_MS);
  const negativeTtlMs = boundedTtl(options.negativeTtlMs, REMINET_DIRECTORY_NEGATIVE_TTL_MS);
  const positiveMaxEntries = boundedMax(options.positiveMaxEntries, REMINET_DIRECTORY_POSITIVE_MAX_ENTRIES);
  const negativeMaxEntries = boundedMax(options.negativeMaxEntries, REMINET_DIRECTORY_NEGATIVE_MAX_ENTRIES);
  return {
    positive: newestEntries(cache.positive, positiveMaxEntries, (entry) => now - entry.cachedAt < positiveTtlMs),
    negative: newestEntries(cache.negative, negativeMaxEntries, (entry) => now - entry.cachedAt < negativeTtlMs),
  };
}

export async function resolveReminetDirectoryIdentifiers(
  identifiers: readonly ReminetDirectoryIdentifier[],
  cache: ReminetDirectoryCache,
  fetchBatch: (identifiers: readonly ReminetDirectoryIdentifier[]) => Promise<ReminetDirectoryApiResponse>,
  options: ResolveReminetDirectoryOptions = {},
): Promise<{ results: ReminetDirectoryResolution[]; cache: ReminetDirectoryCache; batchSizes: number[] }> {
  const now = options.now ?? Date.now;
  const observedAt = now();
  const positiveTtlMs = boundedTtl(options.positiveTtlMs, REMINET_DIRECTORY_POSITIVE_TTL_MS);
  const negativeTtlMs = boundedTtl(options.negativeTtlMs, REMINET_DIRECTORY_NEGATIVE_TTL_MS);
  const working = normalizeReminetDirectoryCache(cache);
  const resolvedByKey = new Map<string, ReminetDirectoryResolution>();
  const normalized = identifiers.map((identifier) => normalizeReminetDirectoryIdentifier(identifier));
  const pendingByKey = new Map<string, ReminetDirectoryIdentifier>();

  for (const query of normalized) {
    if (!query) continue;
    const key = remiNetDirectoryCacheKey(query);
    if (resolvedByKey.has(key) || pendingByKey.has(key)) continue;
    const positive = working.positive[key];
    if (options.force !== true && positive && observedAt - positive.cachedAt < positiveTtlMs) {
      resolvedByKey.set(key, resolution(query, positive.identity, "resolved", true));
      continue;
    }
    const negative = working.negative[key];
    if (options.force !== true && negative && observedAt - negative.cachedAt < negativeTtlMs) {
      resolvedByKey.set(key, resolution(query, null, "not_found", true));
      continue;
    }
    pendingByKey.set(key, query);
  }

  const pending = Array.from(pendingByKey.values());
  const batchSizes: number[] = [];
  for (let offset = 0; offset < pending.length; offset += REMINET_DIRECTORY_BATCH_MAX) {
    const batch = pending.slice(offset, offset + REMINET_DIRECTORY_BATCH_MAX);
    batchSizes.push(batch.length);
    const response = await fetchBatch(batch);
    if (!response.ok) {
      for (const query of batch) {
        resolvedByKey.set(remiNetDirectoryCacheKey(query), {
          ...resolution(query, null, "error", false),
          error: { ...response.error },
        });
      }
      continue;
    }

    const responseByKey = new Map<string, ReminetDirectoryApiResult[]>();
    for (const candidate of response.data) {
      if (!isDirectoryResult(candidate)) continue;
      const query = normalizeReminetDirectoryIdentifier(candidate.query);
      const key = query ? remiNetDirectoryCacheKey(query) : "";
      if (!key || !pendingByKey.has(key)) continue;
      const group = responseByKey.get(key) ?? [];
      group.push(candidate);
      responseByKey.set(key, group);
    }

    for (const query of batch) {
      const key = remiNetDirectoryCacheKey(query);
      const candidates = responseByKey.get(key) ?? [];
      const normalizedIdentities = candidates
        .map((candidate) => candidate.identity ? normalizeDirectoryIdentity(candidate.identity) : null);
      const handles = new Set(normalizedIdentities.flatMap((identity) => identity ? [identity.handle] : []));
      const hasMiss = normalizedIdentities.some((identity) => identity === null);
      if (candidates.length === 0) {
        resolvedByKey.set(key, invalidResponseResolution(query));
        continue;
      }
      if (handles.size > 1 || (handles.size === 1 && hasMiss)) {
        resolvedByKey.set(key, {
          ...resolution(query, null, "error", false),
          error: { code: "duplicate_mapping", category: "invalid_response", status: 0 },
        });
        continue;
      }
      if (handles.size === 0) {
        working.negative[key] = { query, cachedAt: observedAt, source: "remilia-api-v1:directory" };
        delete working.positive[key];
        resolvedByKey.set(key, resolution(query, null, "not_found", false));
        continue;
      }
      const identity = normalizedIdentities.find((candidate): candidate is ReminetDirectoryIdentity => Boolean(candidate));
      if (!identity) {
        resolvedByKey.set(key, invalidResponseResolution(query));
        continue;
      }
      working.positive[key] = { query, identity, cachedAt: observedAt, source: "remilia-api-v1:directory" };
      delete working.negative[key];
      resolvedByKey.set(key, resolution(query, identity, "resolved", false));
    }
  }

  const pruned = pruneReminetDirectoryCache(working, { ...options, now: () => observedAt });
  const results = identifiers.map((identifier, index): ReminetDirectoryResolution => {
    const query = normalized[index];
    if (!query) {
      return {
        query: identifier,
        identity: null,
        status: "error",
        cached: false,
        provenance: "remilia-api-v1:directory",
        error: { code: "invalid_identifier", category: "request", status: 400 },
      };
    }
    return resolvedByKey.get(remiNetDirectoryCacheKey(query)) ?? invalidResponseResolution(query);
  });
  return { results, cache: pruned, batchSizes };
}

function resolution(
  query: ReminetDirectoryIdentifier,
  identity: ReminetDirectoryIdentity | null,
  status: ReminetDirectoryResolution["status"],
  cached: boolean,
): ReminetDirectoryResolution {
  return { query, identity, status, cached, provenance: "remilia-api-v1:directory" };
}

function invalidResponseResolution(query: ReminetDirectoryIdentifier): ReminetDirectoryResolution {
  return {
    ...resolution(query, null, "error", false),
    error: { code: "invalid_response", category: "invalid_response", status: 0 },
  };
}

function normalizeIdentifierValue(type: ReminetDirectoryIdentifierType, raw: string): string {
  if (typeof raw !== "string") return "";
  const value = raw.trim();
  if (!value || value.length > 256 || /[\u0000-\u001f\u007f]/.test(value)) return "";
  if (type === "handle") {
    const normalized = value.replace(/^[@~]+/, "").toLowerCase();
    return /^[a-z0-9_.-]{1,64}$/.test(normalized) ? normalized : "";
  }
  if (type === "x_handle") {
    const normalized = value.replace(/^@+/, "")
      .replace(/^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\//i, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
    return /^[a-z0-9_]{1,15}$/.test(normalized) ? normalized : "";
  }
  if (type === "github") {
    const normalized = value.replace(/^@+/, "")
      .replace(/^https?:\/\/(?:www\.)?github\.com\//i, "")
      .split(/[/?#]/)[0]
      .toLowerCase();
    return /^[a-z0-9](?:[a-z0-9-]{0,38})$/.test(normalized) ? normalized : "";
  }
  const normalized = value.replace(/^@+/, "").toLowerCase();
  return normalized.length <= 256 ? normalized : "";
}

function normalizeDirectoryIdentity(identity: ReminetDirectoryIdentity): ReminetDirectoryIdentity | null {
  const handle = normalizeIdentifierValue("handle", identity.handle);
  if (!handle || typeof identity.display_name !== "string" || typeof identity.avatar_url !== "string") return null;
  return {
    handle,
    display_name: identity.display_name,
    avatar_url: identity.avatar_url,
    ...(typeof identity.avatar_url_small === "string" ? { avatar_url_small: identity.avatar_url_small } : {}),
  };
}

function newestEntries<T extends { cachedAt: number }>(
  entries: Record<string, T>,
  maxEntries: number,
  include: (entry: T) => boolean,
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(entries)
      .filter(([, entry]) => finiteTimestamp(entry.cachedAt) && include(entry))
      .sort((left, right) => right[1].cachedAt - left[1].cachedAt)
      .slice(0, maxEntries),
  );
}

function boundedTtl(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(1, Math.min(7 * 24 * 60 * 60 * 1000, Number(value))) : fallback;
}

function boundedMax(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(5_000, Math.floor(Number(value)))) : fallback;
}

function finiteTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isDirectoryIdentifier(value: unknown): value is ReminetDirectoryIdentifier {
  return isRecord(value)
    && ["handle", "x_handle", "github", "discord"].includes(value.type)
    && typeof value.value === "string";
}

function isDirectoryIdentity(value: unknown): value is ReminetDirectoryIdentity {
  return isRecord(value)
    && typeof value.handle === "string"
    && typeof value.display_name === "string"
    && typeof value.avatar_url === "string";
}

function isDirectoryResult(value: unknown): value is ReminetDirectoryApiResult {
  return isRecord(value)
    && isDirectoryIdentifier(value.query)
    && (value.identity === null || isDirectoryIdentity(value.identity));
}
