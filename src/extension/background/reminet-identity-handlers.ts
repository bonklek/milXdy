import { remiliaApiClient } from '../../platform/background/remilia-api-registration';
import { PERFORMANCE_MODE_KEY, normalizePerformanceMode, type PerformanceMode } from '../../platform/settings/performance-mode';
import { ETHEREUM_RPC_URL, ENS_REGISTRY_ADDRESS, GWEI_NAME_SERVICE_ADDRESS, REMINET_IDENTITY_CACHE_KEY, REMINET_IDENTITY_CACHE_TTL_MS, REMINET_PUBLIC_PROFILE_NEGATIVE_TTL_MS, addressFromEthCallResult, concatHex, contractForPfpProject, clearPublicProfileMiss, decodeAbiStringResult, emptyIdentityProfile, emptyReminetIdentityCache, ensNameCallData, ensResolverCallData, extractGweiNameCandidates, freshPublicProfileMiss, gweiGatewayUrl, gweiResolveCallData, gweiReverseResolveCallData, hexFromUtf8, identityCacheKeyForRemiliaUsername, identityCacheKeyForXHandle, identityCacheEntry, isEthereumAddress, mergeIdentityProfile, normalizeRemiliaUsername, normalizeGweiName, normalizeReminetIdentityCache, normalizeXHandle, ownerOfCallData, pruneSharedIdentityCache, rememberPublicProfileMiss, rememberSharedIdentity, reverseEnsNameForAddress, type ReminetIdentityCache, type ReminetIdentityCacheEntry, type ReminetIdentityProfile } from '../../platform/auth/reminet-identity';
import { resolveReminetIdentities, identityProfileFromApiV1 } from '../../platform/auth/reminet-identity-service';
import { mergeReminetDirectoryCache, type ReminetDirectoryIdentifier } from '../../platform/auth/reminet-directory';

type NetworkFetch = (input: RequestInfo | URL, init?: RequestInit, label?: string) => Promise<Response>;
type ReminetIdentityMessage = {
  xHandle?: string;
  remiliaUsername?: string;
  force?: boolean;
  maxAgeMs?: number;
};
type ReminetIdentityResolveMessage = {
  identifiers: ReminetDirectoryIdentifier[];
  force?: boolean;
  maxAgeMs?: number;
};
let networkFetch: NetworkFetch;
let sharedIdentityCacheWriteQueue: Promise<void> = Promise.resolve();
const LEGACY_REMINET_CHAT_PROFILE_CACHE_KEY = 'milxdy.reminetChat.profileCache.v3';

export function configureReminetIdentityNetworkFetch(fetcher: NetworkFetch): void { networkFetch = fetcher; }
async function fetchRemiStatsUser(handleValue: string, force = false): Promise<Record<string, unknown>> {
  const handle = normalizeXHandle(handleValue);
  if (!/^[a-z0-9_]{1,15}$/i.test(handle)) {
    return { ok: false, status: 0, notFound: true };
  }
  const [mode, cache] = await Promise.all([loadCurrentPerformanceMode(), loadIdentityCache()]);
  const cached = force ? null : cachedRemiStatsResponse(cache, handle, remiStatsCacheTtlForMode(mode));
  if (cached) return cached;
  try {
    const response = await networkFetch(`https://api.remistats.net/user/${encodeURIComponent(handle)}`, { credentials: "omit" }, "remistats:user");
    if (response.status === 404) return { ok: false, status: 404, notFound: true };
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const data = await response.json();
    const profile = mergeIdentityProfile(
      emptyIdentityProfile(),
      profileFromRemiStatsResponse(data, handle),
      "remistats",
    );
    await rememberIdentityProfile(profile, { xHandles: [handle] });
    return { ok: true, cached: false, data };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}
async function resolveReminetIdentityBatch(message: ReminetIdentityResolveMessage): Promise<Record<string, unknown>> {
  const cache = await loadIdentityCache();
  const resolved = await resolveReminetIdentities(message.identifiers, cache, {
    resolveDirectory: async (identifiers) => {
      const response = await remiliaApiClient.resolveDirectory(identifiers);
      return response.ok ? { ...response, data: response.data.results } : response;
    },
    getUserProfile: (username) => remiliaApiClient.getUserProfile(username),
  }, {
    force: message.force === true,
    positiveTtlMs: normalizeIdentityMaxAge(message.maxAgeMs),
    profileMaxAgeMs: normalizeIdentityMaxAge(message.maxAgeMs),
  });
  await mutateSharedIdentityCache((latest) => {
    mergeReminetIdentityCaches(latest, resolved.cache);
  });
  return { ok: true, results: resolved.results, batchSizes: resolved.batchSizes };
}



async function loadCurrentPerformanceMode(): Promise<PerformanceMode> {
  const stored = await chrome.storage.local.get({ [PERFORMANCE_MODE_KEY]: "balanced" }).catch(() => ({})) as Record<string, unknown>;
  return normalizePerformanceMode(stored[PERFORMANCE_MODE_KEY]);
}
function remiStatsCacheTtlForMode(mode: PerformanceMode): number {
  if (mode === "fast") return REMINET_IDENTITY_CACHE_TTL_MS;
  if (mode === "balanced") return 30 * 60 * 1000;
  if (mode === "full") return 5 * 60 * 1000;
  return 0;
}
function cachedRemiStatsResponse(cache: ReminetIdentityCache, handle: string, ttlMs: number): Record<string, unknown> | null {
  if (ttlMs <= 0) return null;
  const entry = identityCacheEntry(cache, identityCacheKeyForXHandle(handle));
  if (!entry?.profile || typeof entry.cachedAt !== "number" || Date.now() - entry.cachedAt >= ttlMs) return null;
  if (entry.profile.remiStatsScore === null && entry.profile.beetleCount === null) return null;
  return {
    ok: true,
    cached: true,
    data: {
      user: remiStatsUserFromIdentityProfile(entry.profile, handle),
    },
  };
}
async function resolveReminetIdentity(message: ReminetIdentityMessage): Promise<Record<string, unknown>> {
  const xHandle = normalizeXHandle(message.xHandle);
  const remiliaUsername = normalizeRemiliaUsername(message.remiliaUsername);
  if (!xHandle && !remiliaUsername) return { ok: false, error: "INVALID_PROFILE_LOOKUP" };
  const cache = await loadIdentityCache();
  const lookupKeys = [
    xHandle ? identityCacheKeyForXHandle(xHandle) : "",
    remiliaUsername ? identityCacheKeyForRemiliaUsername(remiliaUsername) : "",
  ].filter(Boolean);
  const maxAgeMs = normalizeIdentityMaxAge(message.maxAgeMs);
  const cached = lookupKeys
    .map((key) => identityCacheEntry(cache, key))
    .find((entry) => freshIdentityEntry(entry, maxAgeMs, Boolean(remiliaUsername)));
  if (cached && message.force !== true && hasCurrentIdentitySchema(cached.profile)) {
    return { ok: true, cached: true, profile: cached.profile };
  }
  let profile = cached?.profile || emptyIdentityProfile();
  const warnings: string[] = [];
  let publicProfileCachedAt: number | undefined;
  if (xHandle) profile = mergeIdentityProfile(profile, { xHandle }, "input");
  if (remiliaUsername) profile = mergeIdentityProfile(profile, { remiliaUsername }, "input");
  if (xHandle) {
    const directory = await resolveReminetIdentities([{ type: "x_handle", value: xHandle }], cache, {
      resolveDirectory: async (identifiers) => {
        const response = await remiliaApiClient.resolveDirectory(identifiers);
        return response.ok ? { ...response, data: response.data.results } : response;
      },
      getUserProfile: (username) => remiliaApiClient.getUserProfile(username),
    }, { force: message.force === true, positiveTtlMs: maxAgeMs, profileMaxAgeMs: maxAgeMs });
    const resolved = directory.results[0];
    if (resolved?.profile) {
      profile = mergeIdentityProfile(profile, resolved.profile);
      publicProfileCachedAt = resolved.profile.provenance.some((entry) => entry.endpoint.startsWith("GET /api/v1/users/"))
        ? Date.now()
        : undefined;
    } else if (resolved?.status === "not_found") {
      profile = mergeIdentityProfile(profile, { xHandle }, "remilia-api-v1:directory:notFound");
    } else if (resolved?.error) {
      warnings.push(`REMILIA_DIRECTORY_${resolved.error.code.toUpperCase()}`);
    }
    mergeReminetIdentityCaches(cache, directory.cache);
  }
  const resolvedUsername = normalizeRemiliaUsername(profile.remiliaUsername || remiliaUsername);
  if (resolvedUsername && publicProfileCachedAt === undefined) {
    const remiliaProfile = await fetchRemiliaPublicProfile(resolvedUsername, cache, message.force === true);
    if (remiliaProfile.ok && remiliaProfile.data) {
      profile = mergeIdentityProfile(
        profile,
        identityProfileFromApiV1(remiliaProfile.data, resolvedUsername),
        "remilia-api-v1:profile",
      );
      publicProfileCachedAt = Date.now();
    } else if (!remiliaProfile.notFound) {
      warnings.push("REMILIA_PROFILE_UNAVAILABLE");
    }
  }
  profile = await attachNftOwner(profile);
  profile = await attachEnsName(profile);
  profile = await attachGweiName(profile);
  await mutateSharedIdentityCache((latest) => mergeReminetIdentityCaches(latest, cache));
  await rememberIdentityProfile(profile, { publicProfileCachedAt });
  return { ok: true, cached: false, partial: warnings.length > 0, warnings, profile };
}
function mergeReminetIdentityCaches(target: ReminetIdentityCache, source: ReminetIdentityCache): void {
  mergeReminetDirectoryCache(target.directory, source.directory);
  for (const [key, entry] of Object.entries(source.records)) {
    if (!target.records[key] || target.records[key].cachedAt <= entry.cachedAt) target.records[key] = entry;
  }
  Object.assign(target.aliases, source.aliases);
  for (const [key, entry] of Object.entries(source.publicProfileMisses)) {
    if (!target.publicProfileMisses[key] || target.publicProfileMisses[key].cachedAt <= entry.cachedAt) {
      target.publicProfileMisses[key] = entry;
    }
  }
}
function normalizeIdentityMaxAge(value: unknown): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return REMINET_IDENTITY_CACHE_TTL_MS;
  return Math.max(0, Math.min(7 * 24 * 60 * 60 * 1000, numeric));
}
async function fetchRemiliaPublicProfile(
  username: string,
  cache?: ReminetIdentityCache,
  force = false,
): Promise<{ ok: boolean; data: unknown | null; notFound: boolean }> {
  const clean = normalizeRemiliaUsername(username);
  if (!clean) return { ok: false, data: null, notFound: true };
  if (!force && cache && freshPublicProfileMiss(cache, clean, REMINET_PUBLIC_PROFILE_NEGATIVE_TTL_MS)) {
    return { ok: false, data: null, notFound: true };
  }
  const response = await remiliaApiClient.getUserProfile(clean);
  if (response.ok) {
    if (cache) clearPublicProfileMiss(cache, clean);
    return { ok: true, data: response.data, notFound: false };
  }
  const notFound = response.error.status === 404 || ["not_found", "user_not_found"].includes(response.error.code);
  if (notFound && cache) rememberPublicProfileMiss(cache, clean);
  return { ok: false, data: null, notFound };
}
async function attachNftOwner(profile: ReminetIdentityProfile): Promise<ReminetIdentityProfile> {
  if (profile.nftOwnerAddress || !profile.pfpProject || !profile.pfpId) return profile;
  const contract = contractForPfpProject(profile.pfpProject);
  if (!contract) return profile;
  const owner = await fetchNftOwner(contract, profile.pfpId);
  return mergeIdentityProfile(profile, {
    nftContractAddress: contract,
    nftOwnerAddress: owner,
  }, owner ? "ethereum:ownerOf" : "ethereum:unsupported");
}
async function fetchNftOwner(contract: string, tokenId: string): Promise<string | null> {
  const data = safeOwnerOfCallData(tokenId);
  if (!data) return null;
  try {
    const result = await ethereumRpc("eth_call", [{ to: contract, data }, "latest"], "reminetIdentity:ownerOf");
    const owner = addressFromEthCallResult(result);
    return owner && isEthereumAddress(owner) ? owner : null;
  } catch {
    return null;
  }
}
async function attachEnsName(profile: ReminetIdentityProfile): Promise<ReminetIdentityProfile> {
  if (profile.ensName || !profile.nftOwnerAddress) return profile;
  const ensName = await fetchReverseEnsName(profile.nftOwnerAddress);
  return mergeIdentityProfile(profile, { ensName }, ensName ? "ens:reverse" : "ens:none");
}
async function attachGweiName(profile: ReminetIdentityProfile): Promise<ReminetIdentityProfile> {
  if (profile.gweiName || !profile.nftOwnerAddress) return profile;
  const reverseName = await fetchReverseGweiName(profile.nftOwnerAddress);
  if (reverseName) {
    return mergeIdentityProfile(profile, {
      gweiName: reverseName,
      gweiGatewayUrl: gweiGatewayUrl(reverseName),
    }, "gwei:reverse");
  }
  for (const candidate of profile.gweiNameCandidates || []) {
    const resolved = await resolveGweiName(candidate);
    if (resolved?.toLowerCase() !== profile.nftOwnerAddress.toLowerCase()) continue;
    return mergeIdentityProfile(profile, {
      gweiName: candidate,
      gweiGatewayUrl: gweiGatewayUrl(candidate),
    }, "gwei:verified-forward");
  }
  return mergeIdentityProfile(profile, {}, "gwei:none");
}
async function fetchReverseGweiName(address: string): Promise<string | null> {
  const data = gweiReverseResolveCallData(address);
  if (!data) return null;
  const result = await ethereumRpc("eth_call", [{ to: GWEI_NAME_SERVICE_ADDRESS, data }, "latest"], "reminetIdentity:gweiReverse");
  return normalizeGweiName(decodeAbiStringResult(result));
}
async function resolveGweiName(name: string): Promise<string | null> {
  const normalized = normalizeGweiName(name);
  if (!normalized) return null;
  const node = await ensNamehash(normalized);
  if (!node) return null;
  const data = gweiResolveCallData(node);
  if (!data) return null;
  const result = await ethereumRpc("eth_call", [{ to: GWEI_NAME_SERVICE_ADDRESS, data }, "latest"], "reminetIdentity:gweiResolve");
  const address = addressFromEthCallResult(result);
  return address && isEthereumAddress(address) ? address : null;
}
async function fetchReverseEnsName(address: string): Promise<string | null> {
  if (!isEthereumAddress(address)) return null;
  const reverseName = reverseEnsNameForAddress(address);
  if (!reverseName) return null;
  const node = await ensNamehash(reverseName);
  if (!node) return null;
  const resolverData = ensResolverCallData(node);
  if (!resolverData) return null;
  const resolverResult = await ethereumRpc("eth_call", [{ to: ENS_REGISTRY_ADDRESS, data: resolverData }, "latest"], "reminetIdentity:ensResolver");
  const resolver = addressFromEthCallResult(resolverResult);
  if (!resolver || !isEthereumAddress(resolver)) return null;
  const nameData = ensNameCallData(node);
  if (!nameData) return null;
  const nameResult = await ethereumRpc("eth_call", [{ to: resolver, data: nameData }, "latest"], "reminetIdentity:ensName");
  return decodeAbiStringResult(nameResult);
}
async function ensNamehash(name: string): Promise<string | null> {
  let node = `0x${"0".repeat(64)}`;
  const labels = name.split(".").filter(Boolean);
  for (let index = labels.length - 1; index >= 0; index -= 1) {
    const labelHash = await ethereumSha3(hexFromUtf8(labels[index] || ""));
    if (!labelHash) return null;
    const packed = concatHex(node, labelHash);
    if (!packed) return null;
    const nextNode = await ethereumSha3(packed);
    if (!nextNode) return null;
    node = nextNode;
  }
  return node;
}
async function ethereumSha3(data: string): Promise<string | null> {
  const result = await ethereumRpc("web3_sha3", [data], "reminetIdentity:sha3");
  return typeof result === "string" && /^0x[0-9a-fA-F]{64}$/.test(result) ? result : null;
}
async function ethereumRpc(method: string, params: unknown[], label: string): Promise<unknown> {
  const response = await networkFetch(ETHEREUM_RPC_URL, {
    method: "POST",
    credentials: "omit",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }, label);
  const json = await response.json().catch(() => null) as Record<string, unknown> | null;
  return json?.result;
}
function safeOwnerOfCallData(tokenId: string): string | null {
  try {
    return ownerOfCallData(tokenId);
  } catch {
    return null;
  }
}
function profileFromRemiStatsResponse(value: unknown, fallbackHandle: string): Partial<ReminetIdentityProfile> {
  const data = objectValue(value);
  const user = objectValue(data.user);
  if (!Object.keys(user).length) return { xHandle: fallbackHandle };
  const remiliaUsername = normalizeRemiliaUsername(
    stringValue(user.username)
    || stringValue(user.userHandle)
    || stringValue(user.user_handle)
    || stringValue(user.handle)
    || stringValue(user.remiliaUsername)
    || stringValue(objectValue(user.profile).username),
  );
  return {
    xHandle: normalizeXHandle(stringValue(user.twitterHandle) || stringValue(user.twitter_handle) || fallbackHandle) || fallbackHandle,
    remiliaUsername: remiliaUsername || null,
    displayName: stringValue(user.displayName) || stringValue(user.display_name) || null,
    pfpProject: stringValue(user.pfpProject) || stringValue(user.pfp_project) || null,
    pfpId: stringValue(user.pfpId) || stringValue(user.pfp_id) || null,
    pfpUrl: stringValue(user.pfpUrl) || stringValue(user.pfp_url) || null,
    beetleCount: numberValue(user.beetles),
    remiStatsScore: numberValue(user.socialCreditScore) ?? numberValue(user.social_credit_score) ?? numberValue(user.socialCredit),
    friendCount: numberValue(user.friendCount) ?? numberValue(user.friend_count),
  };
}
function remiStatsUserFromIdentityProfile(profile: ReminetIdentityProfile, fallbackHandle: string): Record<string, unknown> {
  return {
    username: profile.remiliaUsername || fallbackHandle,
    userHandle: profile.remiliaUsername || fallbackHandle,
    handle: profile.remiliaUsername || fallbackHandle,
    remiliaUsername: profile.remiliaUsername || null,
    twitterHandle: normalizeXHandle(profile.xHandle) || fallbackHandle,
    displayName: profile.displayName,
    pfpProject: profile.pfpProject,
    pfpId: profile.pfpId,
    pfpUrl: profile.pfpUrl,
    beetles: profile.beetleCount,
    socialCreditScore: profile.remiStatsScore,
    friendCount: profile.friendCount,
  };
}
function profileFromRemiliaResponse(value: unknown, fallbackUsername: string): Partial<ReminetIdentityProfile> {
  const data = objectValue(value);
  const user = objectValue(data.user);
  if (!Object.keys(user).length) return { remiliaUsername: fallbackUsername };
  const pfp = objectValue(user.pfp);
  const xHandle = connectedXHandle(user);
  return {
    xHandle: xHandle || null,
    remiliaUsername: normalizeRemiliaUsername(stringValue(user.username) || stringValue(user.userHandle) || fallbackUsername) || fallbackUsername,
    displayName: stringValue(user.displayName) || stringValue(user.display_name) || stringValue(user.name) || null,
    pfpProject: stringValue(pfp.project) || stringValue(user.pfpProject) || null,
    pfpId: stringValue(pfp.id) || stringValue(user.pfpId) || null,
    pfpUrl: stringValue(user.pfpUrl) || stringValue(user.pfp_url) || null,
    beetleCount: numberValue(user.beetles),
    remiStatsScore: numberValue(user.socialCredit) ?? numberValue(user.socialCreditScore),
    friendCount: numberValue(user.friendCount),
    trophyShelves: Array.isArray(user.trophyShelves) ? user.trophyShelves : null,
    allTrophies: Array.isArray(user.allTrophies) ? user.allTrophies : null,
    connections: Array.isArray(user.connections) ? user.connections : null,
    gweiNameCandidates: extractGweiNameCandidates(user),
  };
}
function connectedXHandle(user: Record<string, unknown>): string | null {
  const direct = normalizeXHandle(
    stringValue(user.twitterHandle)
    || stringValue(user.twitter_handle)
    || stringValue(user.twitterUsername)
    || stringValue(user.twitter_username)
    || stringValue(user.xHandle)
    || stringValue(user.x_handle)
    || stringValue(user.xUsername)
    || stringValue(user.x_username)
    || handleFromUrl(stringValue(user.twitterUrl) || stringValue(user.twitter_url) || stringValue(user.xUrl) || stringValue(user.x_url)),
  );
  if (direct) return direct;
  if (!Array.isArray(user.connections)) return null;
  for (const item of user.connections) {
    const record = objectValue(item);
    const provider = String(record.provider || record.type || record.platform || record.service || record.kind || "").toLowerCase();
    if (!/twitter|^x$/.test(provider)) continue;
    const handle = normalizeXHandle(
      stringValue(record.handle)
      || stringValue(record.username)
      || stringValue(record.userName)
      || stringValue(record.user_name)
      || stringValue(record.screenName)
      || stringValue(record.screen_name)
      || stringValue(record.nickname)
      || stringValue(record.name)
      || handleFromUrl(stringValue(record.url) || stringValue(record.href) || stringValue(record.profileUrl) || stringValue(record.profile_url)),
    );
    if (handle) return handle;
  }
  return null;
}
function handleFromUrl(value: string): string {
  const match = value.match(/(?:twitter\.com|x\.com)\/@?([^/?#]+)/i);
  return match ? match[1] || "" : "";
}
async function loadIdentityCache(): Promise<ReminetIdentityCache> {
  const stored = await chrome.storage.local.get({
    [REMINET_IDENTITY_CACHE_KEY]: emptyReminetIdentityCache(),
    [LEGACY_REMINET_CHAT_PROFILE_CACHE_KEY]: null,
  }).catch(() => ({})) as Record<string, unknown>;
  const cache = normalizeReminetIdentityCache(stored[REMINET_IDENTITY_CACHE_KEY]);
  const legacyChatCache = objectValue(stored[LEGACY_REMINET_CHAT_PROFILE_CACHE_KEY]);
  if (!Object.keys(legacyChatCache).length) return cache;
  const migrated = await mutateSharedIdentityCache((latest) => {
    for (const [handle, candidate] of Object.entries(legacyChatCache)) {
      const entry = objectValue(candidate);
      const user = objectValue(entry.user);
      const cachedAt = numberValue(entry.cachedAt);
      if (!Object.keys(user).length || cachedAt === null) continue;
      const profile = mergeIdentityProfile(
        emptyIdentityProfile(),
        profileFromRemiliaResponse({ user }, handle),
        "reminet-chat:migrated",
      );
      rememberSharedIdentity(latest, profile, {
        cachedAt,
        publicProfileCachedAt: cachedAt,
        aliases: [
          identityCacheKeyForRemiliaUsername(handle),
          profile.xHandle ? identityCacheKeyForXHandle(profile.xHandle) : "",
        ],
      });
    }
  });
  await chrome.storage.local.remove(LEGACY_REMINET_CHAT_PROFILE_CACHE_KEY);
  return migrated;
}
async function rememberIdentityProfile(
  profile: ReminetIdentityProfile,
  aliases: { xHandles?: string[]; remiliaUsernames?: string[]; publicProfileCachedAt?: number } = {},
): Promise<void> {
  const xHandles = new Set([normalizeXHandle(profile.xHandle), ...(aliases.xHandles || []).map(normalizeXHandle)].filter(Boolean));
  const remiliaUsernames = new Set([normalizeRemiliaUsername(profile.remiliaUsername), ...(aliases.remiliaUsernames || []).map(normalizeRemiliaUsername)].filter(Boolean));
  await mutateSharedIdentityCache((latest) => {
    rememberSharedIdentity(latest, profile, {
      publicProfileCachedAt: aliases.publicProfileCachedAt,
      aliases: [
        ...Array.from(xHandles, identityCacheKeyForXHandle),
        ...Array.from(remiliaUsernames, identityCacheKeyForRemiliaUsername),
      ],
    });
  });
}
async function mutateSharedIdentityCache(mutator: (cache: ReminetIdentityCache) => void): Promise<ReminetIdentityCache> {
  let result = emptyReminetIdentityCache();
  const write = sharedIdentityCacheWriteQueue.then(async () => {
    const stored = await chrome.storage.local.get({ [REMINET_IDENTITY_CACHE_KEY]: emptyReminetIdentityCache() });
    const latest = normalizeReminetIdentityCache(stored[REMINET_IDENTITY_CACHE_KEY]);
    mutator(latest);
    result = pruneSharedIdentityCache(latest);
    await chrome.storage.local.set({ [REMINET_IDENTITY_CACHE_KEY]: result });
  });
  sharedIdentityCacheWriteQueue = write.catch((error) => {
    console.warn("Shared RemiNET identity cache write failed:", error);
  });
  await write;
  return result;
}
function freshIdentityEntry(
  entry: ReminetIdentityCacheEntry | undefined,
  maxAgeMs = REMINET_IDENTITY_CACHE_TTL_MS,
  requirePublicProfile = false,
): entry is ReminetIdentityCacheEntry {
  if (!entry?.profile) return false;
  const timestamp = requirePublicProfile ? entry.publicProfileCachedAt : entry.cachedAt;
  return typeof timestamp === "number" && Date.now() - timestamp < maxAgeMs;
}
function hasCurrentIdentitySchema(profile: ReminetIdentityProfile): boolean {
  return Object.prototype.hasOwnProperty.call(profile, "ensName")
    && Object.prototype.hasOwnProperty.call(profile, "gweiName");
}
function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}
function numberValue(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}
export { fetchRemiStatsUser, resolveReminetIdentity, resolveReminetIdentityBatch };
