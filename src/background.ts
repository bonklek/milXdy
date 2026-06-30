import "./features/wiki/background";
import "./features/post-reading/background";
import "./features/miladymaxxer/background";
import "./features/beetol/background.js";
import "./features/reminetChat/background";
import { initializeBackgroundNetworkBudget, runNetworkTask, setupBackgroundMessageRouter } from "./shared/backgroundRouter";
import { browserAction } from "./shared/browserAction";
import { PERFORMANCE_MODE_KEY, normalizePerformanceMode, type PerformanceMode } from "./shared/performanceMode";
import {
  ETHEREUM_RPC_URL,
  ENS_REGISTRY_ADDRESS,
  GWEI_NAME_SERVICE_ADDRESS,
  REMINET_IDENTITY_CACHE_KEY,
  REMINET_IDENTITY_CACHE_MAX_ENTRIES,
  REMINET_IDENTITY_CACHE_TTL_MS,
  addressFromEthCallResult,
  concatHex,
  contractForPfpProject,
  decodeAbiStringResult,
  emptyIdentityProfile,
  ensNameCallData,
  ensResolverCallData,
  extractGweiNameCandidates,
  gweiGatewayUrl,
  gweiResolveCallData,
  gweiReverseResolveCallData,
  hexFromUtf8,
  identityCacheKeyForRemiliaUsername,
  identityCacheKeyForXHandle,
  isEthereumAddress,
  mergeIdentityProfile,
  normalizeRemiliaUsername,
  normalizeGweiName,
  normalizeXHandle,
  ownerOfCallData,
  reverseEnsNameForAddress,
  type ReminetIdentityCache,
  type ReminetIdentityCacheEntry,
  type ReminetIdentityProfile,
} from "./shared/reminetIdentity";
import {
  UPDATE_ALARM_NAME,
  UPDATE_CHECK_INTERVAL_MINUTES,
  UPDATE_STATUS_KEY,
  checkForUpdate,
  type UpdateStatus,
} from "./shared/updateCheck";
import { parseAllowedUrl, type UrlAllowRule } from "./shared/urlAllowlist";

type RemiStatsMessage = {
  type: "remistats:getUser";
  handle: string;
  force?: boolean;
};

type ReminetIdentityMessage = {
  type: "reminetIdentity:getProfile";
  xHandle?: string;
  remiliaUsername?: string;
  force?: boolean;
};

type UpdateMessage = {
  type: "milxdy:checkUpdate";
};

type FetchImageDataUrlMessage = {
  type: "milxdy:fetchImageDataUrl";
  url: string;
};

type MiladychanFetchJsonMessage = {
  type: "miladychan:fetchJson";
  url: string;
};

type MusicFetchJsonMessage = {
  type: "music:fetchJson";
  url: string;
};

type MusicPostFormMessage = {
  type: "music:postForm";
  url: string;
  form: Record<string, string>;
};

type MusicFetchImageDataUrlMessage = {
  type: "music:fetchImageDataUrl";
  url: string;
};

type WikiFetchImageDataUrlMessage = {
  type: "wiki:fetchImageDataUrl";
  url: string;
};

type WikiSidebarOpenTabMessage = {
  type: "wikiSidebar:openTab";
  url: string;
};

type WikiSidebarNavigationMessage = {
  type: "wikiSidebar:navigation";
  url: string;
};

type WikiSidebarNavigateInFrameMessage = {
  type: "wikiSidebar:navigateInFrame";
  url: string;
};

type WikiSidebarHistoryMessage = {
  type: "wikiSidebar:history";
  direction: "back" | "forward";
};

type WikiSidebarReadAloudRequestMessage = {
  type: "wikiSidebar:readAloudRequest";
  articleId: string;
  title: string;
  text: string;
};

const MUSICBRAINZ_JSON_RULES: readonly UrlAllowRule[] = [
  { origin: "https://musicbrainz.org", pathPrefix: "/ws/2/" },
];
const ACOUSTID_FORM_RULES: readonly UrlAllowRule[] = [
  { origin: "https://api.acoustid.org", pathPattern: /^\/v2\/lookup$/ },
];
const MILADYCHAN_JSON_RULES: readonly UrlAllowRule[] = [
  { origin: "https://boards.miladychan.org", pathPrefix: "/json/" },
];
const MUSIC_IMAGE_RULES: readonly UrlAllowRule[] = [
  { origin: "https://pbs.twimg.com" },
  { origin: "https://boards.miladychan.org" },
];
const MILADY_MAKER_BANNER_RULES: readonly UrlAllowRule[] = [
  { origin: "https://miladymaker.net", pathPattern: /^\/banners\/nft\/\d+\.png$/ },
];
const WIKI_IMAGE_RULES: readonly UrlAllowRule[] = [
  { origin: "https://wiki.remilia.org", pathPrefix: "/images/" },
  { origin: "https://remilia.wiki", pathPrefix: "/images/" },
];
const WIKI_SIDEBAR_OPEN_TAB_RULES: readonly UrlAllowRule[] = [
  { origin: "https://wiki.remilia.org" },
  { origin: "https://remilia.wiki" },
  { origin: "https://sso.remilia.org" },
];
const WIKI_SIDEBAR_NAVIGATION_RULES: readonly UrlAllowRule[] = [
  { origin: "https://wiki.remilia.org" },
  { origin: "https://remilia.wiki" },
];

setupBackgroundMessageRouter([
  {
    type: "milxdy:checkUpdate",
    matches: isUpdateMessage,
    handle: runUpdateCheck,
  },
  {
    type: "milxdy:fetchImageDataUrl",
    matches: isFetchImageDataUrlMessage,
    handle: (message) => fetchImageDataUrl(message.url),
  },
  {
    type: "miladychan:fetchJson",
    matches: isMiladychanFetchJsonMessage,
    handle: (message) => fetchMiladychanJson(message.url),
  },
  {
    type: "music:fetchJson",
    matches: isMusicFetchJsonMessage,
    handle: (message) => fetchMusicJson(message.url),
  },
  {
    type: "music:postForm",
    matches: isMusicPostFormMessage,
    handle: (message) => postMusicForm(message.url, message.form),
  },
  {
    type: "music:fetchImageDataUrl",
    matches: isMusicFetchImageDataUrlMessage,
    handle: (message) => fetchMusicImageDataUrl(message.url),
  },
  {
    type: "wiki:fetchImageDataUrl",
    matches: isWikiFetchImageDataUrlMessage,
    handle: (message) => fetchWikiImageDataUrl(message.url),
  },
  {
    type: "wikiSidebar:openTab",
    matches: isWikiSidebarOpenTabMessage,
    handle: (message, sender) => openWikiSidebarTab(message.url, sender),
  },
  {
    type: "wikiSidebar:navigation",
    matches: isWikiSidebarNavigationMessage,
    handle: (message, sender) => forwardWikiSidebarNavigation(message.url, sender),
  },
  {
    type: "wikiSidebar:navigateInFrame",
    matches: isWikiSidebarNavigateInFrameMessage,
    handle: (message, sender) => forwardWikiSidebarNavigateInFrame(message.url, sender),
  },
  {
    type: "wikiSidebar:history",
    matches: isWikiSidebarHistoryMessage,
    handle: (message, sender) => forwardWikiSidebarHistory(message.direction, sender),
  },
  {
    type: "wikiSidebar:readAloudRequest",
    matches: isWikiSidebarReadAloudRequestMessage,
    handle: (message, sender) => forwardWikiSidebarReadAloudRequest(message, sender),
  },
  {
    type: "remistats:getUser",
    matches: isRemiStatsMessage,
    handle: (message) => fetchRemiStatsUser(message.handle, message.force === true),
  },
  {
    type: "reminetIdentity:getProfile",
    matches: isReminetIdentityMessage,
    handle: (message) => resolveReminetIdentity(message),
  },
]);
void initializeBackgroundNetworkBudget();

function isRemiStatsMessage(message: unknown): message is RemiStatsMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "remistats:getUser" && typeof record.handle === "string";
}

function isReminetIdentityMessage(message: unknown): message is ReminetIdentityMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "reminetIdentity:getProfile"
    && (typeof record.xHandle === "string" || typeof record.remiliaUsername === "string");
}

function isUpdateMessage(message: unknown): message is UpdateMessage {
  return Boolean(message && typeof message === "object" && (message as Record<string, unknown>).type === "milxdy:checkUpdate");
}

function isFetchImageDataUrlMessage(message: unknown): message is FetchImageDataUrlMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "milxdy:fetchImageDataUrl" && typeof record.url === "string";
}

function isMiladychanFetchJsonMessage(message: unknown): message is MiladychanFetchJsonMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "miladychan:fetchJson" && typeof record.url === "string";
}

function isMusicFetchJsonMessage(message: unknown): message is MusicFetchJsonMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "music:fetchJson" && typeof record.url === "string";
}

function isMusicPostFormMessage(message: unknown): message is MusicPostFormMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  if (record.type !== "music:postForm" || typeof record.url !== "string") return false;
  if (!record.form || typeof record.form !== "object" || Array.isArray(record.form)) return false;
  return Object.values(record.form).every((value) => typeof value === "string");
}

function isMusicFetchImageDataUrlMessage(message: unknown): message is MusicFetchImageDataUrlMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "music:fetchImageDataUrl" && typeof record.url === "string";
}

function isWikiFetchImageDataUrlMessage(message: unknown): message is WikiFetchImageDataUrlMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wiki:fetchImageDataUrl" && typeof record.url === "string";
}

function isWikiSidebarOpenTabMessage(message: unknown): message is WikiSidebarOpenTabMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:openTab" && typeof record.url === "string";
}

function isWikiSidebarNavigationMessage(message: unknown): message is WikiSidebarNavigationMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:navigation" && typeof record.url === "string";
}

function isWikiSidebarNavigateInFrameMessage(message: unknown): message is WikiSidebarNavigateInFrameMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:navigateInFrame" && typeof record.url === "string";
}

function isWikiSidebarHistoryMessage(message: unknown): message is WikiSidebarHistoryMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:history" && (record.direction === "back" || record.direction === "forward");
}

function isWikiSidebarReadAloudRequestMessage(message: unknown): message is WikiSidebarReadAloudRequestMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return record.type === "wikiSidebar:readAloudRequest"
    && typeof record.articleId === "string"
    && typeof record.title === "string"
    && typeof record.text === "string";
}

async function fetchRemiStatsUser(handleValue: string, force = false): Promise<Record<string, unknown>> {
  const handle = normalizeXHandle(handleValue);
  if (!/^[a-z0-9_]{1,15}$/i.test(handle)) {
    return { ok: false, status: 0, notFound: true };
  }

  const [mode, cache] = await Promise.all([loadCurrentPerformanceMode(), loadIdentityCache()]);
  const cached = force ? null : cachedRemiStatsResponse(cache, handle, remiStatsCacheTtlForMode(mode));
  if (cached) return cached;

  try {
    const response = await budgetedFetch(`https://api.remistats.net/user/${encodeURIComponent(handle)}`, { credentials: "omit" }, "remistats:user");
    if (response.status === 404) return { ok: false, status: 404, notFound: true };
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const data = await response.json();
    const profile = mergeIdentityProfile(
      emptyIdentityProfile(),
      profileFromRemiStatsResponse(data, handle),
      "remistats",
    );
    await rememberIdentityProfile(cache, profile, { xHandles: [handle] });
    return { ok: true, cached: false, data };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
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
  const entry = cache[identityCacheKeyForXHandle(handle)];
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
  const cached = lookupKeys.map((key) => cache[key]).find((entry) => freshIdentityEntry(entry));
  if (cached && message.force !== true && hasCurrentIdentitySchema(cached.profile)) {
    return { ok: true, cached: true, profile: cached.profile };
  }

  let profile = cached?.profile || emptyIdentityProfile();
  if (xHandle) profile = mergeIdentityProfile(profile, { xHandle }, "input");
  if (remiliaUsername) profile = mergeIdentityProfile(profile, { remiliaUsername }, "input");

  if (xHandle) {
    const remiStatsResponse = await fetchRemiStatsUser(xHandle, message.force === true);
    if (remiStatsResponse.ok) {
      profile = mergeIdentityProfile(profile, profileFromRemiStatsResponse(remiStatsResponse.data, xHandle), "remistats");
    } else if (remiStatsResponse.notFound || remiStatsResponse.status === 404) {
      profile = mergeIdentityProfile(profile, { xHandle }, "remistats:notFound");
    }
  }

  const resolvedUsername = normalizeRemiliaUsername(profile.remiliaUsername || remiliaUsername);
  if (resolvedUsername) {
    const remiliaProfile = await fetchRemiliaPublicProfile(resolvedUsername);
    if (remiliaProfile) profile = mergeIdentityProfile(profile, profileFromRemiliaResponse(remiliaProfile, resolvedUsername), "remilia.net");
  }

  profile = await attachNftOwner(profile);
  profile = await attachEnsName(profile);
  profile = await attachGweiName(profile);
  await rememberIdentityProfile(cache, profile);
  return { ok: true, cached: false, profile };
}

async function fetchRemiliaPublicProfile(username: string): Promise<unknown | null> {
  const clean = normalizeRemiliaUsername(username);
  if (!clean) return null;
  try {
    const response = await budgetedFetch(`https://www.remilia.net/api/profile/~${encodeURIComponent(clean)}`, {
      credentials: "omit",
      headers: { Accept: "application/json" },
    }, "reminetIdentity:profile");
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
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
  const response = await budgetedFetch(ETHEREUM_RPC_URL, {
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
  const stored = await chrome.storage.local.get({ [REMINET_IDENTITY_CACHE_KEY]: {} }).catch(() => ({})) as Record<string, unknown>;
  const raw = stored[REMINET_IDENTITY_CACHE_KEY];
  return raw && typeof raw === "object" && !Array.isArray(raw) ? raw as ReminetIdentityCache : {};
}

async function rememberIdentityProfile(
  cache: ReminetIdentityCache,
  profile: ReminetIdentityProfile,
  aliases: { xHandles?: string[]; remiliaUsernames?: string[] } = {},
): Promise<void> {
  const entry = { profile, cachedAt: Date.now() };
  const xHandles = new Set([normalizeXHandle(profile.xHandle), ...(aliases.xHandles || []).map(normalizeXHandle)].filter(Boolean));
  const remiliaUsernames = new Set([normalizeRemiliaUsername(profile.remiliaUsername), ...(aliases.remiliaUsernames || []).map(normalizeRemiliaUsername)].filter(Boolean));
  for (const xHandle of xHandles) cache[identityCacheKeyForXHandle(xHandle)] = entry;
  for (const remiliaUsername of remiliaUsernames) cache[identityCacheKeyForRemiliaUsername(remiliaUsername)] = entry;
  await chrome.storage.local.set({ [REMINET_IDENTITY_CACHE_KEY]: pruneIdentityCache(cache) }).catch(() => undefined);
}

function pruneIdentityCache(cache: ReminetIdentityCache): ReminetIdentityCache {
  const entries = Object.entries(cache)
    .filter(([, entry]) => entry && typeof entry.cachedAt === "number" && Boolean(entry.profile))
    .sort((left, right) => right[1].cachedAt - left[1].cachedAt)
    .slice(0, REMINET_IDENTITY_CACHE_MAX_ENTRIES);
  return Object.fromEntries(entries);
}

function freshIdentityEntry(entry: ReminetIdentityCacheEntry | undefined): entry is ReminetIdentityCacheEntry {
  return Boolean(entry?.profile && typeof entry.cachedAt === "number" && Date.now() - entry.cachedAt < REMINET_IDENTITY_CACHE_TTL_MS);
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

async function fetchMusicJson(url: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, MUSICBRAINZ_JSON_RULES);
  if (!parsed) {
    return { ok: false, status: 0, error: "Unsupported music lookup URL." };
  }

  try {
    const response = await budgetedFetch(parsed.href, {
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "User-Agent": "milXdy/0.1.5 (https://github.com/bonklek/milXdy)",
      },
    }, "music:json");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    return { ok: true, status: response.status, data: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchMusicImageDataUrl(url: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, MUSIC_IMAGE_RULES);
  if (!parsed) return { ok: false, status: 0, error: "Unsupported image URL." };
  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "music:image");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "image/png";
    if (!/^image\//i.test(contentType)) return { ok: false, status: response.status, error: "Unsupported image type." };
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { ok: true, status: response.status, dataUrl: `data:${contentType};base64,${base64Encode(bytes)}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function postMusicForm(url: string, form: Record<string, string>): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, ACOUSTID_FORM_RULES);
  if (!parsed) {
    return { ok: false, status: 0, error: "Unsupported music lookup URL." };
  }

  try {
    const response = await budgetedFetch(parsed.href, {
      method: "POST",
      credentials: "omit",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        "User-Agent": "milXdy/0.1.5 (https://github.com/bonklek/milXdy)",
      },
      body: new URLSearchParams(form),
    }, "music:postForm");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    return { ok: true, status: response.status, data: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchMiladychanJson(url: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, MILADYCHAN_JSON_RULES);
  if (!parsed) {
    return { ok: false, status: 0, error: "Unsupported Miladychan URL." };
  }

  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "miladychan:json");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    return { ok: true, status: response.status, data: await response.json() };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchImageDataUrl(url: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, MILADY_MAKER_BANNER_RULES);
  if (!parsed) {
    return { ok: false, error: "UNSUPPORTED_IMAGE_URL" };
  }

  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "milxdy:imageDataUrl");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "image/png";
    if (!/^image\/png\b/i.test(contentType)) return { ok: false, error: "UNSUPPORTED_IMAGE_TYPE" };
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { ok: true, dataUrl: `data:${contentType};base64,${base64Encode(bytes)}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function fetchWikiImageDataUrl(url: string): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, WIKI_IMAGE_RULES);
  if (!parsed) return { ok: false, status: 0, error: "Unsupported wiki image URL." };
  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "wiki:image");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "image/png";
    if (!/^image\//i.test(contentType)) return { ok: false, status: response.status, error: "Unsupported image type." };
    const bytes = new Uint8Array(await response.arrayBuffer());
    return { ok: true, status: response.status, dataUrl: `data:${contentType};base64,${base64Encode(bytes)}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

async function openWikiSidebarTab(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiFrameSender(sender)) return { ok: false, status: 0, error: "Unsupported wiki frame sender." };
  const parsed = parseAllowedUrl(url, WIKI_SIDEBAR_OPEN_TAB_RULES);
  if (!parsed) return { ok: false, status: 0, error: "Unsupported wiki sidebar URL." };
  await chrome.tabs.create({ url: parsed.href });
  return { ok: true };
}

async function forwardWikiSidebarNavigation(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiFrameSender(sender) || typeof sender.tab?.id !== "number") return { ok: false, status: 0 };
  const parsed = parseAllowedUrl(url, WIKI_SIDEBAR_NAVIGATION_RULES);
  if (!parsed) return { ok: false, status: 0 };
  await chrome.tabs.sendMessage(sender.tab.id, {
    type: "wikiSidebar:navigated",
    url: parsed.href,
  }, { frameId: 0 }).catch(() => undefined);
  return { ok: true };
}

async function forwardWikiSidebarNavigateInFrame(url: string, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiFrameSender(sender) || typeof sender.tab?.id !== "number") return { ok: false, status: 0 };
  const parsed = parseAllowedUrl(url, WIKI_SIDEBAR_NAVIGATION_RULES);
  if (!parsed) return { ok: false, status: 0 };
  await chrome.tabs.sendMessage(sender.tab.id, {
    type: "wikiSidebar:navigate",
    url: parsed.href,
  }, { frameId: 0 }).catch(() => undefined);
  return { ok: true };
}

async function forwardWikiSidebarHistory(direction: "back" | "forward", sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiFrameSender(sender) || typeof sender.tab?.id !== "number") return { ok: false, status: 0 };
  await chrome.tabs.sendMessage(sender.tab.id, {
    type: "wikiSidebar:history",
    direction,
  }, { frameId: 0 }).catch(() => undefined);
  return { ok: true };
}

async function forwardWikiSidebarReadAloudRequest(message: WikiSidebarReadAloudRequestMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isWikiFrameSender(sender) || typeof sender.tab?.id !== "number") return { ok: false, status: 0 };
  await chrome.tabs.sendMessage(sender.tab.id, message, { frameId: 0 }).catch(() => undefined);
  return { ok: true };
}

function isWikiFrameSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.frameId === 0) return false;
  const source = sender.url || sender.origin || "";
  try {
    const url = new URL(source);
    return WIKI_SIDEBAR_OPEN_TAB_RULES.some((rule) => parseAllowedUrl(url.href, [rule]) !== null);
  } catch {
    return false;
  }
}

function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function budgetedFetch(input: RequestInfo | URL, init?: RequestInit, label?: string): Promise<Response> {
  return runNetworkTask(() => fetch(input, init), label);
}

chrome.runtime.onInstalled.addListener((details) => {
  scheduleUpdateChecks();
  void runUpdateCheck();
  if (details.reason !== "install") return;
  void chrome.storage.local.set({
    "milxdy.diagnostics.enabled": false,
    "milxdy.apps.firstRun.status": "pending",
    "milxdy.miladychan.enabled": true,
    "milxdy.music.enabled": true,
    "milxdy.reminetChat.enabled": true,
    "milxdy.remistats.beetol.enabled": true,
  });
  void chrome.storage.sync.set({
    mode: "milady",
    showTooltips: true,
    soundsEnabled: true,
  });
});

chrome.runtime.onStartup.addListener(() => {
  scheduleUpdateChecks();
  void runUpdateCheck();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== UPDATE_ALARM_NAME) return;
  void runUpdateCheck();
});

void scheduleUpdateChecks();

function scheduleUpdateChecks(): void {
  void chrome.alarms.create(UPDATE_ALARM_NAME, {
    delayInMinutes: 1,
    periodInMinutes: UPDATE_CHECK_INTERVAL_MINUTES,
  });
}

async function runUpdateCheck(): Promise<UpdateStatus> {
  const status = await checkForUpdate();
  await chrome.storage.local.set({ [UPDATE_STATUS_KEY]: status });
  await renderUpdateBadge(status);
  return status;
}

async function renderUpdateBadge(status: UpdateStatus): Promise<void> {
  if (status.updateAvailable) {
    await browserAction.setBadgeText({ text: "UP" });
    await browserAction.setBadgeBackgroundColor({ color: "#a45100" });
    await browserAction.setBadgeTextColor?.({ color: "#ffffff" });
    return;
  }
  await browserAction.setBadgeText({ text: "" });
}

