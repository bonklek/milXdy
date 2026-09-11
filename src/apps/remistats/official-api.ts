import {
  REMILIA_SCOPE_NOTIFICATIONS_READ,
  REMILIA_SCOPE_POKES_WRITE,
  REMILIA_SCOPE_STATS_READ,
  type RemiliaApiClient,
  type RemiliaApiError,
  type RemiliaApiNotification,
  type RemiliaApiPoke,
  type RemiliaApiStats,
} from "../../platform/auth/remilia-api";
import { normalizeRemiliaUsername, normalizeXHandle } from "../../platform/auth/reminet-identity";
import { PokeCooldownStore } from "./poke-cooldown-store";
import { isNotificationKey, notificationKey, readNotificationReadState } from "./notification-state";
import { authRequiredFailure, invalidPaginationFailure, officialFailure, unavailablePokeTargetFailure, unmatchedSelfProfile } from "./official-api-results";
export { officialFailure } from "./official-api-results";

export const REMISTATS_NOTIFICATION_READ_STATE_KEY = "milxdy.remistats.notificationReadState";
export const REMISTATS_POKE_COOLDOWN_STORAGE_KEY = "milxdy.remistats.pokeCooldowns";
export const REMISTATS_LAST_POKE_DIAGNOSTIC_KEY = "milxdy.remistats.lastPokeDiagnostic";
export const LEGACY_INCOMING_POKE_CACHE_KEY = "milxdy.remistats.incomingPokeCache";

const NOTIFICATION_PAGE_SIZE = 50;
const MAX_NOTIFICATION_PAGES = 100;
const MAX_NOTIFICATION_READ_ENTRIES = 500;
const NOTIFICATION_READ_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

import type {
  RemiStatsAuthStatus, RemiStatsIncomingPoke, RemiStatsIncomingPokesResult, RemiStatsNotificationItem,
  RemiStatsNotificationsResult, RemiStatsOfficialFailure, RemiStatsOfficialScope, RemiStatsPokeResult,
  RemiStatsPokeSuccess, RemiStatsPokeTarget, RemiStatsPokeTargetsResult, RemiStatsSelfProfileResult,
  RemiStatsStatsResult, RemiStatsStorage, StoredNotificationReadState, StoredPokeCooldown, StoredPokeCooldownState,
} from "./official-api-contract";
import { REMISTATS_OFFICIAL_SCOPES } from "./official-api-contract";
export { REMISTATS_OFFICIAL_SCOPES } from "./official-api-contract";
export type {
  RemiStatsAuthStatus, RemiStatsIncomingPoke, RemiStatsIncomingPokesResult, RemiStatsNotificationItem,
  RemiStatsNotificationsResult, RemiStatsOfficialFailure, RemiStatsOfficialScope, RemiStatsPokeResult,
  RemiStatsPokeSuccess, RemiStatsPokeTarget, RemiStatsPokeTargetsResult, RemiStatsSelfProfileData,
  RemiStatsSelfProfileResult, RemiStatsStatsResult, RemiStatsStorage, StoredNotificationReadState,
  StoredPokeCooldown, StoredPokeCooldownState,
} from "./official-api-contract";
export class RemiStatsOfficialService {
  private accountProfile: { id: string; username: Promise<string> } | null = null;
  private notificationReadWriteQueue: Promise<void> = Promise.resolve();
  private readonly pokeCooldowns: PokeCooldownStore;

  constructor(
    private readonly client: RemiliaApiClient,
    private readonly storage: RemiStatsStorage,
    private readonly now: () => number = Date.now,
    private readonly getAuthStatus: () => Promise<RemiStatsAuthStatus> = async () => ({ phase: "disconnected" }),
  ) {
    this.pokeCooldowns = new PokeCooldownStore(
      this.storage,
      this.now,
      () => this.activeAuthUsername(),
      REMISTATS_POKE_COOLDOWN_STORAGE_KEY,
    );
  }

  async getMyStats(): Promise<RemiStatsStatsResult> {
    const result = await this.client.getMyStats();
    if (!result.ok) return officialFailure(result.error);
    return {
      ok: true,
      source: "official",
      scope: REMILIA_SCOPE_STATS_READ,
      status: result.status,
      data: result.data,
    };
  }

  async getMyStatsForXProfile(xHandleInput: string): Promise<RemiStatsSelfProfileResult> {
    const xHandle = normalizeExactXHandle(xHandleInput);
    if (!xHandle) return unmatchedSelfProfile();

    const authUsername = await this.activeAuthUsername();
    if (!authUsername) return unmatchedSelfProfile();

    const directory = await this.client.resolveDirectory([{ type: "x_handle", value: xHandle }]);
    if (!directory.ok) return officialFailure(directory.error);
    if (directory.data.results.length !== 1) return unmatchedSelfProfile();

    const resolved = directory.data.results[0];
    const directoryXHandle = resolved.query.type === "x_handle"
      ? normalizeExactXHandle(resolved.query.value)
      : "";
    const directoryUsername = normalizeRemiliaUsername(resolved.identity?.handle);
    if (directoryXHandle !== xHandle || directoryUsername !== authUsername) {
      return unmatchedSelfProfile();
    }

    const stats = await this.client.getMyStats();
    if (!stats.ok) return officialFailure(stats.error);
    if (normalizeRemiliaUsername(stats.data.handle) !== authUsername) {
      return unmatchedSelfProfile();
    }

    return {
      ok: true,
      source: "official",
      matched: true,
      scope: REMILIA_SCOPE_STATS_READ,
      status: stats.status,
      data: {
        xHandle,
        remiliaUsername: authUsername,
        displayName: stats.data.display_name,
        score: finiteNumberOrNull(stats.data.aggregate_scores.total),
        beetleCount: nestedFiniteNumberOrNull(stats.data.stats, "beetle_game", "beetles"),
        followers: nestedFiniteNumberOrNull(stats.data.stats, "twitter", "followers_count"),
      },
    };
  }

  async getNotifications(): Promise<RemiStatsNotificationsResult> {
    const pages: RemiliaApiNotification[] = [];
    let page = 1;
    let pageCount = 0;
    let status = 200;
    let completed = false;

    while (pageCount < MAX_NOTIFICATION_PAGES) {
      const result = await this.client.listMyNotifications({ limit: NOTIFICATION_PAGE_SIZE, page });
      if (!result.ok) return officialFailure(result.error);
      pages.push(...result.data.notifications);
      pageCount += 1;
      status = result.status;
      if (!result.data.has_more) {
        completed = true;
        break;
      }
      const nextPage = result.data.page + 1;
      if (nextPage <= page) return invalidPaginationFailure();
      page = nextPage;
    }

    if (!completed) return invalidPaginationFailure();

    const readState = await readNotificationReadState(this.storage, REMISTATS_NOTIFICATION_READ_STATE_KEY, MAX_NOTIFICATION_READ_ENTRIES);
    const readKeys = new Set(readState.entries.map((entry) => entry.key));
    const keyed = await Promise.all(pages.map(async (notification, index) => ({
      index,
      notification,
      key: await notificationKey(notification),
    })));
    const seen = new Set<string>();
    const notificationIndexByKey = new Map<string, number>();
    let duplicateCount = 0;
    const notifications: Array<RemiStatsNotificationItem & { pageIndex: number }> = [];

    for (const item of keyed) {
      if (seen.has(item.key)) {
        duplicateCount += 1;
        const existingIndex = notificationIndexByKey.get(item.key);
        if (existingIndex !== undefined && item.notification.read) {
          notifications[existingIndex].read = true;
          notifications[existingIndex].readSource = "official";
        }
        continue;
      }
      seen.add(item.key);
      const locallyRead = readKeys.has(item.key);
      notifications.push({
        ...item.notification,
        key: item.key,
        read: item.notification.read || locallyRead,
        readSource: item.notification.read ? "official" : locallyRead ? "local" : "unread",
        pageIndex: item.index,
      });
      notificationIndexByKey.set(item.key, notifications.length - 1);
    }

    notifications.sort((left, right) => (
      right.created_at - left.created_at
      || left.key.localeCompare(right.key)
      || left.pageIndex - right.pageIndex
    ));

    return {
      ok: true,
      source: "official",
      scope: REMILIA_SCOPE_NOTIFICATIONS_READ,
      status,
      notifications: notifications.map(({ pageIndex: _pageIndex, ...notification }) => notification),
      pageCount,
      duplicateCount,
    };
  }

  async getIncomingPokes(): Promise<RemiStatsIncomingPokesResult> {
    await this.storage.remove?.(LEGACY_INCOMING_POKE_CACHE_KEY);
    const result = await this.getNotifications();
    if (!result.ok) return result;

    const pokes = result.notifications
      .filter((notification) => !notification.read && notification.type.toLowerCase() === "poke")
      .map((notification) => ({
        key: notification.key,
        handle: normalizeHandle(notification.from?.handle),
        createdAt: normalizeEpochMs(notification.created_at),
      }))
      .filter((notification): notification is RemiStatsIncomingPoke => Boolean(notification.handle));
    const pokers: string[] = [];
    const seenHandles = new Set<string>();
    for (const poke of pokes) {
      const key = poke.handle.toLowerCase();
      if (seenHandles.has(key)) continue;
      seenHandles.add(key);
      pokers.push(poke.handle);
    }

    return {
      ok: true,
      source: "official",
      scope: REMILIA_SCOPE_NOTIFICATIONS_READ,
      pokes,
      pokers,
      notificationCount: result.notifications.length,
      pageCount: result.pageCount,
      duplicateCount: result.duplicateCount,
      fetchedAt: this.now(),
    };
  }

  async markNotificationsRead(keys: readonly string[]): Promise<{ ok: true; marked: number }> {
    const accepted = [...new Set(keys.filter(isNotificationKey))];
    if (accepted.length === 0) return { ok: true, marked: 0 };
    const write = this.notificationReadWriteQueue.then(async () => {
      const state = await readNotificationReadState(this.storage, REMISTATS_NOTIFICATION_READ_STATE_KEY, MAX_NOTIFICATION_READ_ENTRIES);
      const byKey = new Map(state.entries.map((entry) => [entry.key, entry]));
      const readAt = this.now();
      for (const key of accepted) byKey.set(key, { key, readAt });
      const entries = [...byKey.values()]
        .filter((entry) => readAt - entry.readAt <= NOTIFICATION_READ_RETENTION_MS)
        .sort((left, right) => right.readAt - left.readAt || left.key.localeCompare(right.key))
        .slice(0, MAX_NOTIFICATION_READ_ENTRIES);
      await this.storage.set(REMISTATS_NOTIFICATION_READ_STATE_KEY, { schemaVersion: 1, entries } satisfies StoredNotificationReadState);
    });
    this.notificationReadWriteQueue = write.catch(() => undefined);
    await write;
    return { ok: true, marked: accepted.length };
  }

  async pokeUser(handle: string): Promise<RemiStatsPokeResult> {
    const clean = normalizeHandle(handle);
    const cooldownAccount = await this.pokeCooldowns.currentAccount();
    const result = await this.client.pokeUser(clean);
    if (result.ok) {
      await this.pokeCooldowns.remove(clean, cooldownAccount);
      await this.storePokeDiagnostic({ ok: true, status: result.status });
      return {
        ok: true,
        source: "official",
        scope: REMILIA_SCOPE_POKES_WRITE,
        status: result.status,
        data: result.data,
        cooldownMs: 0,
      };
    }

    const failure = officialFailure(result.error);
    if (result.error.code === "poke_cooldown") {
      const cooldownUntil = authoritativeCooldownUntil(result.error, this.now());
      if (cooldownUntil > this.now()) {
        await this.pokeCooldowns.store(clean, cooldownUntil, cooldownAccount);
        failure.cooldownMs = cooldownUntil - this.now();
        failure.cooldownUntil = cooldownUntil;
        failure.cooldownSource = "official";
      }
    } else if (result.error.category === "network" || result.error.category === "timeout") {
      const fallback = await this.pokeCooldowns.get(clean, cooldownAccount);
      if (fallback && fallback.until > this.now()) {
        failure.cooldownMs = fallback.until - this.now();
        failure.cooldownUntil = fallback.until;
        failure.cooldownSource = "offline-fallback";
      }
    }
    await this.storePokeDiagnostic({
      ok: false,
      status: failure.status,
      category: failure.category,
      code: failure.code,
      cooldownSource: failure.cooldownSource,
    });
    return failure;
  }

  async resolvePokeTargets(xHandleInputs: readonly string[]): Promise<RemiStatsPokeTargetsResult> {
    const xHandles = uniqueExactXHandles(xHandleInputs);
    if (xHandles.length === 0) return { ok: true, source: "official", targets: [] };
    const authUsername = await this.activeAuthUsername();
    if (!authUsername) return { ok: true, source: "official", targets: [] };

    const resolved = await this.resolveExactDirectoryTargets(xHandles);
    if (!resolved.ok) return { ok: true, source: "official", targets: [] };
    return {
      ok: true,
      source: "official",
      targets: resolved.targets.filter((target) => target.remiliaUsername !== authUsername),
    };
  }

  async pokeXAuthor(xHandleInput: string, expectedRemiliaUsernameInput: string): Promise<RemiStatsPokeResult> {
    const xHandle = normalizeExactXHandle(xHandleInput);
    const expectedRemiliaUsername = normalizeRemiliaUsername(expectedRemiliaUsernameInput);
    if (!xHandle || !expectedRemiliaUsername) return unavailablePokeTargetFailure();

    const authUsername = await this.activeAuthUsername();
    if (!authUsername) return authRequiredFailure();

    const resolved = await this.resolveExactDirectoryTargets([xHandle]);
    if (!resolved.ok) return resolved;
    const target = resolved.targets.length === 1 ? resolved.targets[0] : null;
    if (
      !target
      || target.xHandle !== xHandle
      || target.remiliaUsername !== expectedRemiliaUsername
      || target.remiliaUsername === authUsername
    ) {
      return unavailablePokeTargetFailure();
    }
    return this.pokeUser(target.remiliaUsername);
  }

  async getPokeEligibility(handle: string): Promise<{
    ok: true;
    username: string;
    canPoke: boolean;
    cooldownMs: number;
    cooldownUntil?: number;
    cooldownSource?: "offline-fallback";
  }> {
    const clean = normalizeHandle(handle);
    const cooldownAccount = await this.pokeCooldowns.currentAccount();
    const stored = await this.pokeCooldowns.get(clean, cooldownAccount);
    if (!stored || stored.until <= this.now()) {
      await this.pokeCooldowns.remove(clean, cooldownAccount);
      return { ok: true, username: clean, canPoke: true, cooldownMs: 0 };
    }
    return {
      ok: true,
      username: clean,
      canPoke: false,
      cooldownMs: stored.until - this.now(),
      cooldownUntil: stored.until,
      cooldownSource: "offline-fallback",
    };
  }



  private async activeAuthUsername(): Promise<string> {
    const authStatus = await this.getAuthStatus();
    // `missing-scope` still represents an authenticated credential with a
    // verified OIDC identity. Let each shared API client method enforce its
    // own exact operation scope instead of suppressing directory-backed UI
    // because an unrelated release-wide scope was not granted.
    if (authStatus.phase !== "connected" && authStatus.phase !== "missing-scope") {
      this.accountProfile = null;
      return "";
    }
    const username = normalizeRemiliaUsername(authStatus.identity?.username);
    if (username) return username;
    // A valid OIDC subject does not guarantee a preferred_username claim.
    // Resolve the account through /me, never through the visible X profile.
    const id = authStatus.identity?.id;
    if (!id) return "";
    if (this.accountProfile?.id !== id) {
      const username = this.client.getMe().then((result) => result.ok
        ? normalizeRemiliaUsername(result.data.user.username)
        : "").catch(() => "");
      this.accountProfile = { id, username };
    }
    const request = this.accountProfile;
    const resolved = await request.username;
    const current = await this.getAuthStatus();
    if (!resolved && this.accountProfile === request) this.accountProfile = null;
    if ((current.phase !== "connected" && current.phase !== "missing-scope") || current.identity?.id !== id) return "";
    return resolved;
  }

  private async resolveExactDirectoryTargets(xHandles: readonly string[]): Promise<{
    ok: true;
    targets: RemiStatsPokeTarget[];
  } | RemiStatsOfficialFailure> {
    const result = await this.client.resolveDirectory(xHandles.map((value) => ({ type: "x_handle", value })));
    if (!result.ok) return officialFailure(result.error);

    const requested = new Set(xHandles);
    const matches = new Map<string, string[]>();
    for (const item of result.data.results) {
      const xHandle = item.query.type === "x_handle" ? normalizeExactXHandle(item.query.value) : "";
      const remiliaUsername = normalizeRemiliaUsername(item.identity?.handle);
      if (!xHandle || !requested.has(xHandle) || !remiliaUsername) continue;
      const values = matches.get(xHandle) || [];
      values.push(remiliaUsername);
      matches.set(xHandle, values);
    }

    const targets: RemiStatsPokeTarget[] = [];
    for (const xHandle of xHandles) {
      const values = matches.get(xHandle) || [];
      if (values.length !== 1) continue;
      targets.push({ xHandle, remiliaUsername: values[0] });
    }
    return { ok: true, targets };
  }

  private storePokeDiagnostic(diagnostic: Record<string, unknown>): Promise<void> {
    return this.storage.set(REMISTATS_LAST_POKE_DIAGNOSTIC_KEY, {
      schemaVersion: 1, operation: "pokeUser", ...diagnostic, updatedAt: this.now(),
    });
  }

}



function uniqueExactXHandles(values: readonly string[]): string[] {
  return [...new Set(values.map(normalizeExactXHandle).filter(Boolean))].slice(0, 50);
}

function normalizeExactXHandle(value: unknown): string {
  if (typeof value !== "string") return "";
  const candidate = value.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{1,15}$/.test(candidate)) return "";
  return normalizeXHandle(candidate);
}

function nestedFiniteNumberOrNull(
  value: Record<string, unknown>,
  group: string,
  field: string,
): number | null {
  const nested = value[group];
  return isRecord(nested) ? finiteNumberOrNull(nested[field]) : null;
}

function finiteNumberOrNull(value: unknown): number | null {
  return isFiniteNumber(value) ? value : null;
}

function authoritativeCooldownUntil(error: RemiliaApiError, now: number): number {
  if (isFiniteNumber(error.nextAllowedAt)) {
    const timestamp = error.nextAllowedAt >= 100_000_000_000
      ? error.nextAllowedAt
      : error.nextAllowedAt * 1000;
    return Math.max(now, timestamp);
  }
  if (isFiniteNumber(error.retryAfterMs)) return now + Math.max(0, error.retryAfterMs);
  return 0;
}

function normalizeStoredCooldownUntil(value: number): number | null {
  if (!Number.isFinite(value) || value <= 0) return null;
  // Repair deadlines saved by 0.2.5 after a Unix-millisecond API value was
  // multiplied by 1,000 as though it were Unix seconds.
  return value >= 100_000_000_000_000 ? value / 1000 : value;
}





function normalizeHandle(value: unknown): string {
  if (typeof value !== "string") return "";
  const match = value.replace(/^@/, "").trim().match(/^[A-Za-z0-9_.-]{1,64}$/);
  return match?.[0] ?? "";
}

function normalizeEpochMs(value: number): number {
  return value < 10_000_000_000 ? value * 1000 : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
