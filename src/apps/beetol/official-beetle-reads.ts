export const OFFICIAL_BEETLE_STATE_ENDPOINT = "/api/v1/me/beetle";
export const OFFICIAL_BEETLE_CARDS_ENDPOINT = "/api/v1/me/beetle/cards";

export type OfficialBeetleReadClient = {
  getMyBeetle: (options?: { signal?: AbortSignal }) => Promise<OfficialBeetleReadResult<unknown>>;
  getMyBeetleCards: (options?: { signal?: AbortSignal }) => Promise<OfficialBeetleReadResult<unknown>>;
};

export type OfficialBeetleReadResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: unknown };

export type NormalizedBeetleCard = {
  codename: string;
  discovered: boolean;
  count: number | null;
  displayName?: string;
  rarity?: string;
};

export type NormalizedBeetleHammer = {
  durability: number | null;
  maxDurability: number | null;
  count: number | null;
};

export type NormalizedOfficialBeetleUser = {
  username?: string;
  xp?: number;
  level?: number;
  inventory: Record<string, number>;
  hammers: Record<string, NormalizedBeetleHammer>;
  hammerDurabilities: Record<string, number>;
  cards: Record<string, NormalizedBeetleCard>;
  cooldowns: Record<string, number>;
  cooldownExpiresAt: Record<string, number>;
  charges?: { beetleHunt: number };
  beetleHuntCharges?: number;
  beetleHunt?: {
    charges?: number;
    cooldownMs?: number;
    cooldownUntil?: number;
    available?: boolean;
    ready?: boolean;
  };
  officialRead: {
    stateEndpoint: typeof OFFICIAL_BEETLE_STATE_ENDPOINT;
    cardsEndpoint: typeof OFFICIAL_BEETLE_CARDS_ENDPOINT;
    partial: boolean;
    missingFields: string[];
    cardsReadError?: OfficialBeetleReadErrorCode;
  };
};

export type OfficialBeetleSnapshot = {
  user: NormalizedOfficialBeetleUser;
  fetchedAt: number;
  partial: boolean;
};

export type OfficialBeetleReadErrorCode =
  | "auth_required"
  | "invalid_token"
  | "insufficient_scope"
  | "requires_user"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "timeout"
  | "network"
  | "invalid_response";

const KNOWN_READ_ERRORS = new Set<OfficialBeetleReadErrorCode>([
  "auth_required",
  "invalid_token",
  "insufficient_scope",
  "requires_user",
  "forbidden",
  "not_found",
  "rate_limited",
  "timeout",
  "network",
  "invalid_response",
]);

const AUTH_PROVIDER_ERROR_MAP: Record<string, OfficialBeetleReadErrorCode> = {
  AUTH_REQUIRED: "auth_required",
  MIGRATION_REQUIRED: "auth_required",
  TOKEN_EXPIRED: "invalid_token",
  REFRESH_REJECTED: "invalid_token",
  MISSING_SCOPE: "insufficient_scope",
  OFFLINE: "network",
  REVOKED: "invalid_token",
  CANCELLED: "auth_required",
  AUTH_TIMEOUT: "timeout",
  unauthorized: "auth_required",
  auth_unavailable: "auth_required",
  user_not_found: "not_found",
  network_error: "network",
  request_timeout: "timeout",
  request_aborted: "network",
};

const COOLDOWN_KEY_ALIASES: Record<string, string> = {
  beetle_hunt: "beetleHunt",
  beetlehunt: "beetleHunt",
  hunt: "beetleHunt",
  catch_beetle: "catchBeetle",
  catchbeetle: "catchBeetle",
  catch: "catchBeetle",
};

export async function readOfficialBeetleSnapshot(
  client: OfficialBeetleReadClient,
  now = Date.now(),
): Promise<OfficialBeetleSnapshot> {
  const [stateResult, cardsResult] = await Promise.allSettled([
    client.getMyBeetle(),
    client.getMyBeetleCards(),
  ]);
  if (stateResult.status === "rejected") throw stateResult.reason;
  if (!stateResult.value.ok) throw stateResult.value.error;

  const cardsSuccess = cardsResult.status === "fulfilled" && cardsResult.value.ok
    ? cardsResult.value
    : null;
  const cardsAvailable = cardsSuccess !== null;
  const cardsPayload = cardsSuccess?.data ?? {};
  const cardsFailure = cardsResult.status === "rejected"
    ? cardsResult.reason
    : cardsResult.value.ok
      ? undefined
      : cardsResult.value.error;
  const cardsReadError = cardsAvailable ? undefined : officialBeetleReadErrorCode(cardsFailure);
  return normalizeOfficialBeetleSnapshot(stateResult.value.data, cardsPayload, {
    now,
    cardsAvailable,
    cardsReadError,
  });
}

export function normalizeOfficialBeetleSnapshot(
  statePayload: unknown,
  cardsPayload: unknown,
  options: { now?: number; cardsAvailable?: boolean; cardsReadError?: OfficialBeetleReadErrorCode } = {},
): OfficialBeetleSnapshot {
  const now = options.now ?? Date.now();
  const sources = normalizeSnapshotSources(statePayload, cardsPayload, now, options.cardsAvailable ?? true);
  const hunt = normalizeHuntStatus(sources.state, sources.cooldowns);
  const missingFields = missingSnapshotFields(sources, options.cardsAvailable ?? true);
  return {
    user: normalizedSnapshotUser(sources, hunt, now, missingFields, options.cardsReadError),
    fetchedAt: now,
    partial: missingFields.length > 0,
  };
}

type SnapshotSources = {
  state: Record<string, unknown>;
  inventorySource: unknown;
  hammerSource: unknown;
  cooldownSource: unknown;
  inventory: Record<string, number>;
  hammers: Record<string, NormalizedBeetleHammer>;
  cooldowns: Record<string, number>;
  cooldownExpiresAt: Record<string, number>;
  cards: Record<string, NormalizedBeetleCard>;
  xp?: number;
  level?: number;
  username?: string;
};

type HuntStatus = { charges?: number; available?: boolean; cooldownMs?: number; hasSignal: boolean };

function normalizeSnapshotSources(statePayload: unknown, cardsPayload: unknown, now: number, cardsAvailable: boolean): SnapshotSources {
  const state = unwrapStatePayload(statePayload);
  const inventorySource = firstDefined(state.inventory, state.items);
  const hammerSource = firstDefined(state.hammers, state.hammer_durabilities, state.hammerDurabilities);
  const cooldownSource = firstDefined(state.cooldowns, state.action_cooldowns, state.actionCooldowns);
  const cooldowns = normalizeCooldowns(cooldownSource, now);
  return {
    state, inventorySource, hammerSource, cooldownSource, cooldowns,
    inventory: normalizeCountMap(inventorySource), hammers: normalizeHammers(hammerSource),
    cooldownExpiresAt: Object.fromEntries(Object.entries(cooldowns).filter(([, value]) => value > 0).map(([key, value]) => [key, now + value])),
    cards: cardsAvailable ? normalizeCards(cardsPayload) : {},
    xp: firstFiniteNumber(state.xp, state.experience, state.beetle_xp, state.beetleXp),
    level: firstFiniteNumber(state.level, state.beetle_level, state.beetleLevel),
    username: firstNonEmptyString(state.username, state.handle, recordValue(state.user).username, recordValue(state.user).handle),
  };
}

function normalizeHuntStatus(state: Record<string, unknown>, cooldowns: Record<string, number>): HuntStatus {
  const directCharges = firstFiniteNumber(state.hunt_charges, state.huntCharges, state.beetle_hunt_charges, state.beetleHuntCharges, state.hunts_remaining, state.huntsRemaining, recordValue(state.charges).beetle_hunt, recordValue(state.charges).beetleHunt);
  const available = firstBoolean(state.can_hunt, state.canHunt, state.beetle_hunt_available, state.beetleHuntAvailable, state.ready, recordValue(state.beetle_hunt).available, recordValue(state.beetleHunt).available);
  const cooldownMs = cooldowns.beetleHunt;
  const charges = directCharges === undefined ? (cooldownMs !== undefined && cooldownMs > 0 ? 0 : available === true ? 3 : available === false ? 0 : undefined) : clampInteger(directCharges, 0, 3);
  return { ...(charges === undefined ? {} : { charges }), ...(available === undefined ? {} : { available }), ...(cooldownMs === undefined ? {} : { cooldownMs }), hasSignal: charges !== undefined || cooldownMs !== undefined || available !== undefined };
}

function missingSnapshotFields(sources: SnapshotSources, cardsAvailable: boolean): string[] {
  return [
    ...(sources.xp === undefined ? ["xp"] : []), ...(sources.level === undefined ? ["level"] : []),
    ...(sources.inventorySource === undefined ? ["inventory"] : []), ...(sources.hammerSource === undefined ? ["hammers"] : []),
    ...(sources.cooldownSource === undefined ? ["cooldowns"] : []), ...(cardsAvailable ? [] : ["cards"]),
  ];
}

function normalizedSnapshotUser(sources: SnapshotSources, hunt: HuntStatus, now: number, missingFields: string[], cardsReadError?: OfficialBeetleReadErrorCode): NormalizedOfficialBeetleUser {
  const hammerDurabilities = Object.fromEntries(Object.entries(sources.hammers).filter(([, hammer]) => hammer.durability !== null).map(([key, hammer]) => [key, hammer.durability as number]));
  return {
    ...(sources.username ? { username: sources.username } : {}), ...(sources.xp === undefined ? {} : { xp: sources.xp }), ...(sources.level === undefined ? {} : { level: sources.level }),
    inventory: sources.inventory, hammers: sources.hammers, hammerDurabilities, cards: sources.cards, cooldowns: sources.cooldowns, cooldownExpiresAt: sources.cooldownExpiresAt,
    ...(hunt.charges === undefined ? {} : { charges: { beetleHunt: hunt.charges }, beetleHuntCharges: hunt.charges }),
    ...(hunt.hasSignal ? { beetleHunt: { ...(hunt.charges === undefined ? {} : { charges: hunt.charges }), ...(hunt.cooldownMs === undefined ? {} : { cooldownMs: hunt.cooldownMs }), ...(hunt.cooldownMs && hunt.cooldownMs > 0 ? { cooldownUntil: now + hunt.cooldownMs } : {}), ...(hunt.available === undefined ? {} : { available: hunt.available, ready: hunt.available }) } } : {}),
    officialRead: { stateEndpoint: OFFICIAL_BEETLE_STATE_ENDPOINT, cardsEndpoint: OFFICIAL_BEETLE_CARDS_ENDPOINT, partial: missingFields.length > 0, missingFields, ...(cardsReadError ? { cardsReadError } : {}) },
  };
}

export function officialBeetleReadErrorCode(error: unknown): OfficialBeetleReadErrorCode {
  const record = recordValue(error);
  const nested = recordValue(record.error);
  const rawCandidate = firstNonEmptyString(record.code, record.kind, record.errorCode, nested.code);
  if (rawCandidate && AUTH_PROVIDER_ERROR_MAP[rawCandidate]) return AUTH_PROVIDER_ERROR_MAP[rawCandidate];
  const candidate = rawCandidate?.toLowerCase();
  if (candidate === "unauthorized") return "auth_required";
  if (candidate && KNOWN_READ_ERRORS.has(candidate as OfficialBeetleReadErrorCode)) {
    return candidate as OfficialBeetleReadErrorCode;
  }
  if (record.name === "TimeoutError") return "timeout";
  return "invalid_response";
}

export function officialBeetleReadFailure(error: unknown): {
  ok: false;
  status: 0;
  error: OfficialBeetleReadErrorCode;
  authRequired?: true;
} {
  const code = officialBeetleReadErrorCode(error);
  const authRequired = code === "auth_required"
    || code === "invalid_token"
    || code === "insufficient_scope"
    || code === "requires_user";
  return {
    ok: false,
    status: 0,
    error: code,
    ...(authRequired ? { authRequired: true as const } : {}),
  };
}

function unwrapStatePayload(value: unknown): Record<string, unknown> {
  const root = recordValue(value);
  const state = recordValue(firstDefined(root.beetle, root.state));
  return Object.keys(state).length > 0 ? state : root;
}

function normalizeCountMap(value: unknown): Record<string, number> {
  const counts: Record<string, number> = {};
  if (Array.isArray(value)) {
    for (const entry of value) {
      const record = recordValue(entry);
      const key = firstNonEmptyString(record.codename, record.type, record.key, record.name);
      const count = firstFiniteNumber(record.count, record.quantity, record.qty, record.amount);
      if (key && count !== undefined && count >= 0) counts[key] = Math.floor(count);
    }
    return counts;
  }
  for (const [key, raw] of Object.entries(recordValue(value))) {
    const record = recordValue(raw);
    const count = firstFiniteNumber(raw, record.count, record.quantity, record.qty, record.amount);
    if (count !== undefined && count >= 0) counts[key] = Math.floor(count);
  }
  return counts;
}

function normalizeHammers(value: unknown): Record<string, NormalizedBeetleHammer> {
  const entries: Array<[string, unknown]> = Array.isArray(value)
    ? value.map((entry, index) => {
        const record = recordValue(entry);
        return [firstNonEmptyString(record.codename, record.type, record.key, record.name) || `hammer_${index + 1}`, entry];
      })
    : Object.entries(recordValue(value));
  return Object.fromEntries(entries.map(([key, raw]) => {
    const record = recordValue(raw);
    return [key, {
      durability: nullableFiniteNumber(raw, record.durability, record.remaining, record.current),
      maxDurability: nullableFiniteNumber(record.max_durability, record.maxDurability, record.max),
      count: nullableFiniteNumber(record.count, record.quantity, record.qty),
    } satisfies NormalizedBeetleHammer];
  }));
}

function normalizeCards(value: unknown): Record<string, NormalizedBeetleCard> {
  const root = recordValue(value);
  const source = Object.keys(recordValue(root.cards)).length > 0 ? recordValue(root.cards) : root;
  const cards: Record<string, NormalizedBeetleCard> = {};
  for (const [codename, raw] of Object.entries(source)) {
    if (["next_cursor", "nextCursor", "total"].includes(codename)) continue;
    const record = recordValue(raw);
    const discovered = typeof raw === "boolean"
      ? raw
      : firstBoolean(record.discovered, record.unlocked, record.owned) ?? true;
    if (!discovered) continue;
    const displayName = firstNonEmptyString(record.display_name, record.displayName, record.name, record.title);
    const rarity = firstNonEmptyString(record.rarity, record.tier);
    cards[codename] = {
      codename,
      discovered: true,
      count: nullableFiniteNumber(raw, record.count, record.quantity, record.qty),
      ...(displayName ? { displayName } : {}),
      ...(rarity ? { rarity } : {}),
    };
  }
  return cards;
}

function normalizeCooldowns(value: unknown, now: number): Record<string, number> {
  const normalized: Record<string, number> = {};
  for (const [rawKey, rawValue] of Object.entries(recordValue(value))) {
    const keyToken = rawKey.replace(/[-\s]/g, "_").toLowerCase();
    const key = COOLDOWN_KEY_ALIASES[keyToken] || rawKey;
    const milliseconds = normalizeCooldownValue(rawValue, now);
    if (milliseconds !== undefined) normalized[key] = milliseconds;
  }
  return normalized;
}

function normalizeCooldownValue(value: unknown, now: number): number | undefined {
  const record = recordValue(value);
  const remainingMs = firstFiniteNumber(
    record.remaining_ms,
    record.remainingMs,
    record.cooldown_ms,
    record.cooldownMs,
    record.retry_after_ms,
    record.retryAfterMs,
  );
  if (remainingMs !== undefined) return Math.max(0, remainingMs);
  const remainingSeconds = firstFiniteNumber(
    record.remaining_seconds,
    record.remainingSeconds,
    record.retry_after,
    record.retryAfter,
  );
  if (remainingSeconds !== undefined) return Math.max(0, remainingSeconds * 1000);
  const until = firstDefined(record.until, record.available_at, record.availableAt, record.next_at, record.nextAt);
  const untilTimestamp = normalizeTimestamp(until);
  if (untilTimestamp !== undefined) return Math.max(0, untilTimestamp - now);

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value <= 0) return 0;
    if (value >= 1_000_000_000_000) return Math.max(0, value - now);
    if (value >= 1_000_000_000) return Math.max(0, value * 1000 - now);
    return value < 1000 ? value * 1000 : value;
  }
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const numeric = Number(trimmed);
  if (Number.isFinite(numeric)) return normalizeCooldownValue(numeric, now);
  const timestamp = normalizeTimestamp(trimmed);
  if (timestamp !== undefined) return Math.max(0, timestamp - now);
  const match = trimmed.match(/^(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?$/i);
  if (!match) return undefined;
  const [, days = "0", hours = "0", minutes = "0", seconds = "0"] = match;
  return (((Number(days) * 24 + Number(hours)) * 60 + Number(minutes)) * 60 + Number(seconds)) * 1000;
}

function normalizeTimestamp(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return value < 1_000_000_000_000 ? value * 1000 : value;
  }
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function firstDefined(...values: unknown[]): unknown {
  return values.find((value) => value !== undefined && value !== null);
}

function firstFiniteNumber(...values: unknown[]): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const numeric = Number(value);
      if (Number.isFinite(numeric)) return numeric;
    }
  }
  return undefined;
}

function nullableFiniteNumber(...values: unknown[]): number | null {
  return firstFiniteNumber(...values) ?? null;
}

function firstNonEmptyString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function firstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === "boolean") return value;
    if (value === 0 || value === "0" || value === "false") return false;
    if (value === 1 || value === "1" || value === "true") return true;
  }
  return undefined;
}

function clampInteger(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.floor(value)));
}
