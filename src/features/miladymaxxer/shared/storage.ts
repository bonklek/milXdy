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

export async function loadSettings(): Promise<ExtensionSettings> {
  const stored = await chrome.storage.sync.get({
    mode: DEFAULT_SETTINGS.mode,
    whitelistHandles: DEFAULT_SETTINGS.whitelistHandles,
    miladyListHandles: DEFAULT_SETTINGS.miladyListHandles,
    includeRemiStatsBeetles: DEFAULT_SETTINGS.includeRemiStatsBeetles,
    soundEnabled: DEFAULT_SETTINGS.soundEnabled,
    showLevelBadge: DEFAULT_SETTINGS.showLevelBadge,
    cardTheme: DEFAULT_SETTINGS.cardTheme,
  });
  return {
    mode: isMode(stored.mode) ? stored.mode : DEFAULT_SETTINGS.mode,
    whitelistHandles: normalizeWhitelistHandles(stored.whitelistHandles),
    miladyListHandles: normalizeWhitelistHandles(stored.miladyListHandles),
    includeRemiStatsBeetles: typeof stored.includeRemiStatsBeetles === "boolean" ? stored.includeRemiStatsBeetles : DEFAULT_SETTINGS.includeRemiStatsBeetles,
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
    soundEnabled: settings.soundEnabled,
    showLevelBadge: settings.showLevelBadge,
    cardTheme: settings.cardTheme,
  });
}

export async function loadStats(): Promise<DetectionStats> {
  const stored = await chrome.storage.local.get({
    stats: DEFAULT_STATS,
  });
  return normalizeStats(stored.stats);
}

export async function saveStats(stats: DetectionStats): Promise<void> {
  await chrome.storage.local.set({
    stats,
  });
}

export async function loadMatchedAccounts(): Promise<MatchedAccountMap> {
  const stored = await chrome.storage.local.get({
    matchedAccounts: DEFAULT_MATCHED_ACCOUNTS,
  });
  return normalizeMatchedAccounts(stored.matchedAccounts);
}

export async function saveMatchedAccounts(matchedAccounts: MatchedAccountMap): Promise<void> {
  await chrome.storage.local.set({
    matchedAccounts,
  });
}

export async function loadCollectedAvatars(): Promise<CollectedAvatarMap> {
  const stored = await chrome.storage.local.get({
    collectedAvatars: DEFAULT_COLLECTED_AVATARS,
  });
  return normalizeCollectedAvatars(stored.collectedAvatars);
}

export async function saveCollectedAvatars(collectedAvatars: CollectedAvatarMap): Promise<void> {
  await chrome.storage.local.set({
    collectedAvatars,
  });
}

export async function loadPlayerStats(): Promise<PlayerStats> {
  const stored = await chrome.storage.local.get({ playerStats: DEFAULT_PLAYER_STATS });
  return normalizePlayerStats(stored.playerStats);
}

export async function savePlayerStats(playerStats: PlayerStats): Promise<void> {
  await chrome.storage.local.set({ playerStats });
}

export function normalizePlayerStats(raw: unknown): PlayerStats {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PLAYER_STATS };
  const obj = raw as Record<string, unknown>;
  return {
    totalLikesGiven: readNumber(obj.totalLikesGiven),
  };
}

export async function resetStats(): Promise<void> {
  await saveStats(DEFAULT_STATS);
}

export async function resetMatchedAccounts(): Promise<void> {
  await saveMatchedAccounts(DEFAULT_MATCHED_ACCOUNTS);
}

export async function resetCollectedAvatars(): Promise<void> {
  await saveCollectedAvatars(DEFAULT_COLLECTED_AVATARS);
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
