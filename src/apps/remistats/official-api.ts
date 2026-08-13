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

export const REMISTATS_OFFICIAL_SCOPES = [
  REMILIA_SCOPE_STATS_READ,
  REMILIA_SCOPE_NOTIFICATIONS_READ,
  REMILIA_SCOPE_POKES_WRITE,
] as const;

export const REMISTATS_NOTIFICATION_READ_STATE_KEY = "milxdy.remistats.notificationReadState";
export const REMISTATS_POKE_COOLDOWN_STORAGE_KEY = "milxdy.remistats.pokeCooldowns";
export const REMISTATS_LAST_POKE_DIAGNOSTIC_KEY = "milxdy.remistats.lastPokeDiagnostic";
export const LEGACY_INCOMING_POKE_CACHE_KEY = "milxdy.remistats.incomingPokeCache";

const NOTIFICATION_PAGE_SIZE = 50;
const MAX_NOTIFICATION_PAGES = 100;
const MAX_NOTIFICATION_READ_ENTRIES = 500;
const NOTIFICATION_READ_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type RemiStatsOfficialScope = typeof REMISTATS_OFFICIAL_SCOPES[number];

export type RemiStatsStorage = {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
  remove?(key: string): Promise<void>;
};

export type RemiStatsOfficialFailure = {
  ok: false;
  source: "official";
  error: string;
  message: string;
  status: number;
  category: RemiliaApiError["category"];
  code: RemiliaApiError["code"];
  retryAfterMs?: number;
  nextAllowedAt?: number;
  authRequired?: boolean;
  scopeRequired?: boolean;
  cooldownMs?: number;
  cooldownUntil?: number;
  cooldownSource?: "official" | "offline-fallback";
};

export type RemiStatsStatsResult = {
  ok: true;
  source: "official";
  scope: typeof REMILIA_SCOPE_STATS_READ;
  status: number;
  data: RemiliaApiStats;
} | RemiStatsOfficialFailure;

export type RemiStatsNotificationItem = RemiliaApiNotification & {
  key: string;
  read: boolean;
  readSource: "official" | "local" | "unread";
};

export type RemiStatsNotificationsResult = {
  ok: true;
  source: "official";
  scope: typeof REMILIA_SCOPE_NOTIFICATIONS_READ;
  status: number;
  notifications: RemiStatsNotificationItem[];
  pageCount: number;
  duplicateCount: number;
} | RemiStatsOfficialFailure;

export type RemiStatsIncomingPoke = {
  key: string;
  handle: string;
  createdAt: number;
};

export type RemiStatsIncomingPokesResult = {
  ok: true;
  source: "official";
  scope: typeof REMILIA_SCOPE_NOTIFICATIONS_READ;
  pokes: RemiStatsIncomingPoke[];
  pokers: string[];
  notificationCount: number;
  pageCount: number;
  duplicateCount: number;
  fetchedAt: number;
} | RemiStatsOfficialFailure;

export type RemiStatsPokeSuccess = {
  ok: true;
  source: "official";
  scope: typeof REMILIA_SCOPE_POKES_WRITE;
  status: number;
  data: RemiliaApiPoke;
  cooldownMs: 0;
};

export type RemiStatsPokeResult = RemiStatsPokeSuccess | RemiStatsOfficialFailure;

type StoredNotificationReadState = {
  schemaVersion: 1;
  entries: Array<{ key: string; readAt: number }>;
};

type StoredPokeCooldown = {
  until: number;
  observedAt: number;
  source: "official";
};

type StoredPokeCooldownState = {
  schemaVersion: 2;
  targets: Record<string, StoredPokeCooldown>;
};

export class RemiStatsOfficialService {
  constructor(
    private readonly client: RemiliaApiClient,
    private readonly storage: RemiStatsStorage,
    private readonly now: () => number = Date.now,
  ) {}

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

    const readState = await this.readNotificationReadState();
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
    const state = await this.readNotificationReadState();
    const byKey = new Map(state.entries.map((entry) => [entry.key, entry]));
    const readAt = this.now();
    for (const key of accepted) byKey.set(key, { key, readAt });
    const entries = [...byKey.values()]
      .filter((entry) => readAt - entry.readAt <= NOTIFICATION_READ_RETENTION_MS)
      .sort((left, right) => right.readAt - left.readAt || left.key.localeCompare(right.key))
      .slice(0, MAX_NOTIFICATION_READ_ENTRIES);
    await this.storage.set(REMISTATS_NOTIFICATION_READ_STATE_KEY, { schemaVersion: 1, entries } satisfies StoredNotificationReadState);
    return { ok: true, marked: accepted.length };
  }

  async pokeUser(handle: string): Promise<RemiStatsPokeResult> {
    const clean = normalizeHandle(handle);
    const result = await this.client.pokeUser(clean);
    if (result.ok) {
      await this.removePokeCooldown(clean);
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
        await this.storePokeCooldown(clean, cooldownUntil);
        failure.cooldownMs = cooldownUntil - this.now();
        failure.cooldownUntil = cooldownUntil;
        failure.cooldownSource = "official";
      }
    } else if (result.error.category === "network" || result.error.category === "timeout") {
      const fallback = await this.getStoredPokeCooldown(clean);
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

  async getPokeEligibility(handle: string): Promise<{
    ok: true;
    username: string;
    canPoke: boolean;
    cooldownMs: number;
    cooldownUntil?: number;
    cooldownSource?: "offline-fallback";
  }> {
    const clean = normalizeHandle(handle);
    const stored = await this.getStoredPokeCooldown(clean);
    if (!stored || stored.until <= this.now()) {
      await this.removePokeCooldown(clean);
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

  private async readNotificationReadState(): Promise<StoredNotificationReadState> {
    const value = await this.storage.get(REMISTATS_NOTIFICATION_READ_STATE_KEY);
    if (!isRecord(value) || value.schemaVersion !== 1 || !Array.isArray(value.entries)) {
      return { schemaVersion: 1, entries: [] };
    }
    const entries = value.entries
      .filter((entry): entry is { key: string; readAt: number } => (
        isRecord(entry) && isNotificationKey(entry.key) && isFiniteNumber(entry.readAt)
      ))
      .sort((left, right) => right.readAt - left.readAt || left.key.localeCompare(right.key))
      .slice(0, MAX_NOTIFICATION_READ_ENTRIES);
    return { schemaVersion: 1, entries };
  }

  private async readPokeCooldownState(): Promise<StoredPokeCooldownState> {
    const value = await this.storage.get(REMISTATS_POKE_COOLDOWN_STORAGE_KEY);
    if (!isRecord(value)) return { schemaVersion: 2, targets: {} };
    if (value.schemaVersion === 2 && isRecord(value.targets)) {
      const targets: Record<string, StoredPokeCooldown> = {};
      for (const [target, entry] of Object.entries(value.targets)) {
        if (!isRecord(entry) || !isFiniteNumber(entry.until) || !isFiniteNumber(entry.observedAt) || entry.source !== "official") continue;
        targets[target] = { until: entry.until, observedAt: entry.observedAt, source: "official" };
      }
      return { schemaVersion: 2, targets };
    }

    const targets: Record<string, StoredPokeCooldown> = {};
    for (const [target, until] of Object.entries(value)) {
      if (!isFiniteNumber(until)) continue;
      targets[target.toLowerCase()] = { until, observedAt: 0, source: "official" };
    }
    return { schemaVersion: 2, targets };
  }

  private async storePokeCooldown(handle: string, until: number): Promise<void> {
    const state = await this.readPokeCooldownState();
    state.targets[handle.toLowerCase()] = { until, observedAt: this.now(), source: "official" };
    await this.storage.set(REMISTATS_POKE_COOLDOWN_STORAGE_KEY, state);
  }

  private async removePokeCooldown(handle: string): Promise<void> {
    const key = handle.toLowerCase();
    if (!key) return;
    const state = await this.readPokeCooldownState();
    if (!Object.hasOwn(state.targets, key)) return;
    delete state.targets[key];
    await this.storage.set(REMISTATS_POKE_COOLDOWN_STORAGE_KEY, state);
  }

  private async getStoredPokeCooldown(handle: string): Promise<StoredPokeCooldown | null> {
    const state = await this.readPokeCooldownState();
    return state.targets[handle.toLowerCase()] ?? null;
  }

  private storePokeDiagnostic(diagnostic: Record<string, unknown>): Promise<void> {
    return this.storage.set(REMISTATS_LAST_POKE_DIAGNOSTIC_KEY, {
      schemaVersion: 1,
      operation: "pokeUser",
      ...diagnostic,
      updatedAt: this.now(),
    });
  }
}

export function officialFailure(error: RemiliaApiError): RemiStatsOfficialFailure {
  return {
    ok: false,
    source: "official",
    error: error.code,
    message: error.message,
    status: error.status,
    category: error.category,
    code: error.code,
    ...(error.retryAfterMs === undefined ? {} : { retryAfterMs: error.retryAfterMs }),
    ...(error.nextAllowedAt === undefined ? {} : { nextAllowedAt: error.nextAllowedAt }),
    ...(["unauthorized", "invalid_token", "auth_unavailable"].includes(error.code) ? { authRequired: true } : {}),
    ...(["insufficient_scope", "requires_user"].includes(error.code) ? { scopeRequired: true } : {}),
  };
}

function invalidPaginationFailure(): RemiStatsOfficialFailure {
  return officialFailure({
    category: "invalid_response",
    code: "invalid_response",
    message: "The Remilia API returned an invalid response.",
    status: 0,
  });
}

function authoritativeCooldownUntil(error: RemiliaApiError, now: number): number {
  if (isFiniteNumber(error.nextAllowedAt)) return Math.max(now, error.nextAllowedAt * 1000);
  if (isFiniteNumber(error.retryAfterMs)) return now + Math.max(0, error.retryAfterMs);
  return 0;
}

async function notificationKey(notification: RemiliaApiNotification): Promise<string> {
  const canonical = JSON.stringify([
    notification.type,
    notification.created_at,
    notification.from?.handle ?? "",
    notification.from?.display_name ?? "",
    notification.count ?? null,
    notification.guild_name ?? "",
    notification.message ?? "",
  ]);
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical));
  const hex = [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
  return `notification:v1:${hex}`;
}

function isNotificationKey(value: unknown): value is string {
  return typeof value === "string" && /^notification:v1:[a-f0-9]{64}$/.test(value);
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
