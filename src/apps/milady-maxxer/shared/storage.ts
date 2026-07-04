import {
  DEFAULT_COLLECTED_AVATARS,
  DEFAULT_MATCHED_ACCOUNTS,
  DEFAULT_PLAYER_STATS,
  DEFAULT_SETTINGS,
  DEFAULT_STATS,
} from "./constants";
import type {
  CollectedAvatarMap,
  DetectionStats,
  ExtensionSettings,
  MatchedAccountMap,
  PlayerStats,
} from "./types";

export type MaxxerAccountScope = string | null | undefined;

export const ACTIVE_ACCOUNT_SCOPE_KEY = "miladymaxxer.activeXAccount";
export const LEGACY_STATS_KEY = "stats";
export const LEGACY_MATCHED_ACCOUNTS_KEY = "matchedAccounts";
export const LEGACY_COLLECTED_AVATARS_KEY = "collectedAvatars";
export const LEGACY_PLAYER_STATS_KEY = "playerStats";

const SCOPED_KEY_PREFIX = "miladymaxxer.xAccount";
const LEGACY_MIGRATION_KEY = "miladymaxxer.legacyStorageMigratedTo";

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get({
    mode: DEFAULT_SETTINGS.mode,
    whitelistHandles: DEFAULT_SETTINGS.whitelistHandles,
    miladyListHandles: DEFAULT_SETTINGS.miladyListHandles,
    includeRemiStatsBeetles: DEFAULT_SETTINGS.includeRemiStatsBeetles,
    hideNonMiladyOrBeetlePosts: DEFAULT_SETTINGS.hideNonMiladyOrBeetlePosts,
    soundEnabled: DEFAULT_SETTINGS.soundEnabled,
    showLevelBadge: DEFAULT_SETTINGS.showLevelBadge,
    cardTheme: DEFAULT_SETTINGS.cardTheme,
  });
  return {
    mode: isMode(stored.mode) ? stored.mode : DEFAULT_SETTINGS.mode,
    whitelistHandles: normalizeWhitelistHandles(stored.whitelistHandles),
    miladyListHandles: normalizeWhitelistHandles(stored.miladyListHandles),
    includeRemiStatsBeetles: typeof stored.includeRemiStatsBeetles === "boolean" ? stored.includeRemiStatsBeetles : DEFAULT_SETTINGS.includeRemiStatsBeetles,
    hideNonMiladyOrBeetlePosts: typeof stored.hideNonMiladyOrBeetlePosts === "boolean" ? stored.hideNonMiladyOrBeetlePosts : DEFAULT_SETTINGS.hideNonMiladyOrBeetlePosts,
    soundEnabled: typeof stored.soundEnabled === "boolean" ? stored.soundEnabled : DEFAULT_SETTINGS.soundEnabled,
    showLevelBadge: typeof stored.showLevelBadge === "boolean" ? stored.showLevelBadge : DEFAULT_SETTINGS.showLevelBadge,
    cardTheme: isCardTheme(stored.cardTheme) ? stored.cardTheme : DEFAULT_SETTINGS.cardTheme,
  };
}

export async function saveSettings(settings: ExtensionSettings): Promise<void> {
  await chrome.storage.sync.set({
    mode: settings.mode,
    whitelistHandles: normalizeWhitelistHandles(settings.whitelistHandles),
    miladyListHandles: normalizeWhitelistHandles(settings.miladyListHandles),
    includeRemiStatsBeetles: settings.includeRemiStatsBeetles,
    hideNonMiladyOrBeetlePosts: settings.hideNonMiladyOrBeetlePosts,
    soundEnabled: settings.soundEnabled,
    showLevelBadge: settings.showLevelBadge,
    cardTheme: settings.cardTheme,
  });
}

export async function loadStats(scope?: MaxxerAccountScope): Promise<DetectionStats> {
  const key = storageKeyForScope(LEGACY_STATS_KEY, scope);
  const stored = await chrome.storage.local.get({ [key]: DEFAULT_STATS });
  if (stored[key] !== undefined) return normalizeStats(stored[key]);
  return DEFAULT_STATS;
}

export async function saveStats(stats: DetectionStats, scope?: MaxxerAccountScope): Promise<void> {
  await chrome.storage.local.set({
    [storageKeyForScope(LEGACY_STATS_KEY, scope)]: stats,
  });
}

export async function loadMatchedAccounts(scope?: MaxxerAccountScope): Promise<MatchedAccountMap> {
  const key = storageKeyForScope(LEGACY_MATCHED_ACCOUNTS_KEY, scope);
  const stored = await chrome.storage.local.get({ [key]: DEFAULT_MATCHED_ACCOUNTS });
  if (stored[key] !== undefined) return normalizeMatchedAccounts(stored[key]);
  return DEFAULT_MATCHED_ACCOUNTS;
}

export async function saveMatchedAccounts(matchedAccounts: MatchedAccountMap, scope?: MaxxerAccountScope): Promise<void> {
  await chrome.storage.local.set({
    [storageKeyForScope(LEGACY_MATCHED_ACCOUNTS_KEY, scope)]: matchedAccounts,
  });
}

export async function loadCollectedAvatars(scope?: MaxxerAccountScope): Promise<CollectedAvatarMap> {
  const key = storageKeyForScope(LEGACY_COLLECTED_AVATARS_KEY, scope);
  const stored = await chrome.storage.local.get({ [key]: DEFAULT_COLLECTED_AVATARS });
  if (stored[key] !== undefined) return normalizeCollectedAvatars(stored[key]);
  return DEFAULT_COLLECTED_AVATARS;
}

export async function saveCollectedAvatars(collectedAvatars: CollectedAvatarMap, scope?: MaxxerAccountScope): Promise<void> {
  await chrome.storage.local.set({
    [storageKeyForScope(LEGACY_COLLECTED_AVATARS_KEY, scope)]: collectedAvatars,
  });
}

export async function loadPlayerStats(scope?: MaxxerAccountScope): Promise<PlayerStats> {
  const key = storageKeyForScope(LEGACY_PLAYER_STATS_KEY, scope);
  const stored = await chrome.storage.local.get({ [key]: DEFAULT_PLAYER_STATS });
  if (stored[key] !== undefined) return normalizePlayerStats(stored[key]);
  return DEFAULT_PLAYER_STATS;
}

export async function savePlayerStats(playerStats: PlayerStats, scope?: MaxxerAccountScope): Promise<void> {
  await chrome.storage.local.set({ [storageKeyForScope(LEGACY_PLAYER_STATS_KEY, scope)]: playerStats });
}

export function normalizePlayerStats(raw: unknown): PlayerStats {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PLAYER_STATS };
  const obj = raw as Record<string, unknown>;
  return {
    totalLikesGiven: readNumber(obj.totalLikesGiven),
  };
}

export async function resetStats(scope?: MaxxerAccountScope): Promise<void> {
  await saveStats(DEFAULT_STATS, scope);
}

export async function resetMatchedAccounts(scope?: MaxxerAccountScope): Promise<void> {
  await saveMatchedAccounts(DEFAULT_MATCHED_ACCOUNTS, scope);
}

export async function resetCollectedAvatars(scope?: MaxxerAccountScope): Promise<void> {
  await saveCollectedAvatars(DEFAULT_COLLECTED_AVATARS, scope);
}

export async function loadActiveAccountScope(): Promise<string | null> {
  const stored = await chrome.storage.local.get(ACTIVE_ACCOUNT_SCOPE_KEY);
  const scope = stored[ACTIVE_ACCOUNT_SCOPE_KEY];
  return typeof scope === "string" ? normalizeAccountScope(scope) : null;
}

export async function saveActiveAccountScope(scope: MaxxerAccountScope): Promise<void> {
  const normalized = normalizeAccountScope(scope);
  if (normalized) {
    await chrome.storage.local.set({ [ACTIVE_ACCOUNT_SCOPE_KEY]: normalized });
  }
}

export async function migrateLegacyStorageToScope(scope: MaxxerAccountScope): Promise<void> {
  const normalized = normalizeAccountScope(scope);
  if (!normalized) return;
  const keys = [
    LEGACY_MIGRATION_KEY,
    LEGACY_STATS_KEY,
    LEGACY_MATCHED_ACCOUNTS_KEY,
    LEGACY_COLLECTED_AVATARS_KEY,
    LEGACY_PLAYER_STATS_KEY,
    storageKeyForScope(LEGACY_STATS_KEY, normalized),
    storageKeyForScope(LEGACY_MATCHED_ACCOUNTS_KEY, normalized),
    storageKeyForScope(LEGACY_COLLECTED_AVATARS_KEY, normalized),
    storageKeyForScope(LEGACY_PLAYER_STATS_KEY, normalized),
  ];
  const stored = await chrome.storage.local.get(keys);
  if (stored[LEGACY_MIGRATION_KEY]) return;
  const updates: Record<string, unknown> = { [LEGACY_MIGRATION_KEY]: normalized };
  copyLegacyValue(stored, updates, LEGACY_STATS_KEY, normalized);
  copyLegacyValue(stored, updates, LEGACY_MATCHED_ACCOUNTS_KEY, normalized);
  copyLegacyValue(stored, updates, LEGACY_COLLECTED_AVATARS_KEY, normalized);
  copyLegacyValue(stored, updates, LEGACY_PLAYER_STATS_KEY, normalized);
  await chrome.storage.local.set(updates);
}

export function storageKeyForScope(baseKey: string, scope?: MaxxerAccountScope): string {
  const normalized = normalizeAccountScope(scope);
  return normalized ? `${SCOPED_KEY_PREFIX}.${normalized}.${baseKey}` : baseKey;
}

export function normalizeAccountScope(scope: MaxxerAccountScope): string | null {
  const normalized = typeof scope === "string" ? normalizeHandle(scope) : "";
  return normalized || null;
}

function copyLegacyValue(
  stored: Record<string, unknown>,
  updates: Record<string, unknown>,
  legacyKey: string,
  scope: string,
): void {
  const scopedKey = storageKeyForScope(legacyKey, scope);
  if (stored[scopedKey] === undefined && stored[legacyKey] !== undefined) {
    updates[scopedKey] = stored[legacyKey];
  }
}

function isMode(value: unknown): value is ExtensionSettings["mode"] {
  return value === "off" || value === "milady" || value === "debug";
}

function isCardTheme(value: unknown): value is ExtensionSettings["cardTheme"] {
  return value === "full" || value === "no-premium" || value === "silver-only" || value === "off";
}

export function normalizeWhitelistHandles(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return DEFAULT_SETTINGS.whitelistHandles;
  }

  return Array.from(
    new Set(
      value
        .filter((handle): handle is string => typeof handle === "string")
        .map((handle) => normalizeHandle(handle))
        .filter((handle) => handle.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function normalizeStats(value: unknown): DetectionStats {
  if (!value || typeof value !== "object") {
    return DEFAULT_STATS;
  }

  const candidate = value as Partial<DetectionStats>;
  return {
    tweetsScanned: readNumber(candidate.tweetsScanned),
    avatarsChecked: readNumber(candidate.avatarsChecked),
    cacheHits: readNumber(candidate.cacheHits),
    postsMatched: readNumber(candidate.postsMatched),
    modelMatches: readNumber((candidate as Record<string, unknown>).modelMatches)
      || readNumber((candidate as Record<string, unknown>).onnxMatches),
    errors: readNumber(candidate.errors),
    lastMatchAt: typeof candidate.lastMatchAt === "string" ? candidate.lastMatchAt : null,
  };
}

export function readNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function normalizeMatchedAccounts(value: unknown): MatchedAccountMap {
  if (!value || typeof value !== "object") {
    return DEFAULT_MATCHED_ACCOUNTS;
  }

  const normalized: MatchedAccountMap = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as Record<string, unknown>;
    const handle = normalizeHandle(
      typeof candidate.handle === "string" && candidate.handle.length > 0 ? candidate.handle : key,
    );
    if (!handle) {
      continue;
    }

    const verificationStatus = candidate.verificationStatus;

    normalized[handle] = {
      handle,
      displayName: typeof candidate.displayName === "string" ? candidate.displayName : null,
      postsMatched: readNumber(candidate.postsMatched),
      postsLiked: readNumber(candidate.postsLiked),
      lastMatchedAt: typeof candidate.lastMatchedAt === "string" ? candidate.lastMatchedAt : null,
      lastDetectionScore:
        typeof candidate.lastDetectionScore === "number" && Number.isFinite(candidate.lastDetectionScore)
          ? candidate.lastDetectionScore
          : null,
      caught: candidate.caught === true,
      caughtAt: typeof candidate.caughtAt === "string" ? candidate.caughtAt : null,
      verificationStatus:
        verificationStatus === "verified" || verificationStatus === "unknown"
          ? verificationStatus
          : "unverified",
    };
  }

  return normalized;
}

export function normalizeCollectedAvatars(value: unknown): CollectedAvatarMap {
  if (!value || typeof value !== "object") {
    return DEFAULT_COLLECTED_AVATARS;
  }

  const normalized: CollectedAvatarMap = {};

  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== "object") {
      continue;
    }

    const candidate = entry as Record<string, unknown>;
    const normalizedUrl = typeof candidate.normalizedUrl === "string" && candidate.normalizedUrl.length > 0
      ? candidate.normalizedUrl
      : key;
    if (!normalizedUrl) {
      continue;
    }

    normalized[normalizedUrl] = {
      normalizedUrl,
      originalUrl:
        typeof candidate.originalUrl === "string" && candidate.originalUrl.length > 0
          ? candidate.originalUrl
          : normalizedUrl,
      handles: uniqueStrings(candidate.handles, normalizeHandle),
      displayNames: uniqueStrings(candidate.displayNames),
      sourceSurfaces: uniqueStrings(candidate.sourceSurfaces),
      seenCount: readNumber(candidate.seenCount),
      firstSeenAt:
        typeof candidate.firstSeenAt === "string" ? candidate.firstSeenAt : new Date(0).toISOString(),
      lastSeenAt:
        typeof candidate.lastSeenAt === "string" ? candidate.lastSeenAt : new Date(0).toISOString(),
      exampleProfileUrl:
        typeof candidate.exampleProfileUrl === "string" ? candidate.exampleProfileUrl : null,
      exampleNotificationUrl:
        typeof candidate.exampleNotificationUrl === "string" ? candidate.exampleNotificationUrl : null,
      exampleTweetUrl: typeof candidate.exampleTweetUrl === "string" ? candidate.exampleTweetUrl : null,
      heuristicMatch:
        typeof candidate.heuristicMatch === "boolean" ? candidate.heuristicMatch : null,
      heuristicSource:
        candidate.heuristicSource === "onnx" || candidate.heuristicSource === "remistats"
          ? candidate.heuristicSource
          : null,
      heuristicScore:
        typeof candidate.heuristicScore === "number" && Number.isFinite(candidate.heuristicScore)
          ? candidate.heuristicScore
          : null,
      heuristicTokenId:
        typeof candidate.heuristicTokenId === "number" && Number.isFinite(candidate.heuristicTokenId)
          ? candidate.heuristicTokenId
          : null,
      whitelisted: candidate.whitelisted === true,
    };
  }

  return normalized;
}

export function uniqueStrings(
  value: unknown,
  map: (entry: string) => string = (entry) => entry.trim(),
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .filter((entry): entry is string => typeof entry === "string")
        .map((entry) => map(entry))
        .filter((entry) => entry.length > 0),
    ),
  ).sort((left, right) => left.localeCompare(right));
}

export function normalizeHandle(value: string | null | undefined): string {
  return (value ?? "").trim().replace(/^\/+/, "").replace(/^@+/, "").toLowerCase();
}
