import { describe, expect, it, vi } from "vitest";
import type {
  RemiliaApiClient,
  RemiliaApiError,
  RemiliaApiNotification,
} from "../../platform/auth/remilia-api";
import {
  LEGACY_INCOMING_POKE_CACHE_KEY,
  REMISTATS_LAST_POKE_DIAGNOSTIC_KEY,
  REMISTATS_NOTIFICATION_READ_STATE_KEY,
  REMISTATS_OFFICIAL_SCOPES,
  REMISTATS_POKE_COOLDOWN_STORAGE_KEY,
  RemiStatsOfficialService,
  type RemiStatsStorage,
} from "./official-api";

class MemoryStorage implements RemiStatsStorage {
  readonly values = new Map<string, unknown>();

  async get(key: string): Promise<unknown> {
    return this.values.get(key);
  }

  async set(key: string, value: unknown): Promise<void> {
    this.values.set(key, structuredClone(value));
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

function apiClient(overrides: Partial<RemiliaApiClient> = {}): RemiliaApiClient {
  return {
    getMyStats: vi.fn(),
    listMyNotifications: vi.fn(),
    pokeUser: vi.fn(),
    ...overrides,
  } as unknown as RemiliaApiClient;
}

function notification(
  handle: string,
  createdAt: number,
  overrides: Partial<RemiliaApiNotification> = {},
): RemiliaApiNotification {
  return {
    type: "poke",
    read: false,
    created_at: createdAt,
    from: {
      handle,
      display_name: handle.toUpperCase(),
      avatar_url: `https://example.invalid/${handle}.png`,
    },
    ...overrides,
  };
}

function failure(error: Partial<RemiliaApiError> & Pick<RemiliaApiError, "category" | "code">) {
  return {
    ok: false as const,
    error: {
      message: "Stable client-owned message.",
      status: 0,
      ...error,
    },
  };
}

describe("RemiStats official API service", () => {
  it("declares the exact delegated scopes", () => {
    expect(REMISTATS_OFFICIAL_SCOPES).toEqual([
      "remilia:stats.read",
      "remilia:notifications.read",
      "remilia:pokes.write",
    ]);
  });

  it("returns official account statistics without adding auth policy", async () => {
    const getMyStats = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { handle: "alice", display_name: "Alice", stats: {}, aggregate_scores: { total: 4 } },
    });
    const service = new RemiStatsOfficialService(apiClient({ getMyStats } as Partial<RemiliaApiClient>), new MemoryStorage());

    await expect(service.getMyStats()).resolves.toMatchObject({
      ok: true,
      source: "official",
      scope: "remilia:stats.read",
      data: { handle: "alice", aggregate_scores: { total: 4 } },
    });
    expect(getMyStats).toHaveBeenCalledOnce();
  });

  it("pages notifications, deduplicates deterministically, and persists only opaque local read keys", async () => {
    const duplicate = notification("alice", 1_754_870_400);
    const older = notification("bob", 1_754_870_300);
    const listMyNotifications = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, data: { notifications: [older, duplicate], page: 1, limit: 50, has_more: true } })
      .mockResolvedValueOnce({ ok: true, status: 200, data: { notifications: [duplicate], page: 2, limit: 50, has_more: false } });
    const storage = new MemoryStorage();
    storage.values.set(LEGACY_INCOMING_POKE_CACHE_KEY, { pokers: ["private-payload"] });
    const service = new RemiStatsOfficialService(apiClient({ listMyNotifications } as Partial<RemiliaApiClient>), storage, () => 1_800_000_000_000);

    const first = await service.getIncomingPokes();
    expect(first).toMatchObject({
      ok: true,
      source: "official",
      scope: "remilia:notifications.read",
      pokers: ["alice", "bob"],
      notificationCount: 2,
      pageCount: 2,
      duplicateCount: 1,
    });
    expect(listMyNotifications).toHaveBeenNthCalledWith(1, { limit: 50, page: 1 });
    expect(listMyNotifications).toHaveBeenNthCalledWith(2, { limit: 50, page: 2 });
    expect(storage.values.has(LEGACY_INCOMING_POKE_CACHE_KEY)).toBe(false);

    if (!first.ok) throw new Error("expected notifications");
    await service.markNotificationsRead([first.pokes[0].key]);
    const persisted = JSON.stringify(storage.values.get(REMISTATS_NOTIFICATION_READ_STATE_KEY));
    expect(persisted).toContain("notification:v1:");
    expect(persisted).not.toContain("alice");
    expect(persisted).not.toContain("bob");
    expect(persisted).not.toContain("private-payload");

    listMyNotifications
      .mockResolvedValueOnce({ ok: true, status: 200, data: { notifications: [older, duplicate], page: 1, limit: 50, has_more: false } });
    const second = await service.getIncomingPokes();
    expect(second.ok && second.pokers).toEqual(["bob"]);
  });

  it("stops notification paging on a normalized error without storing payloads", async () => {
    const listMyNotifications = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, data: { notifications: [notification("alice", 10)], page: 1, limit: 50, has_more: true } })
      .mockResolvedValueOnce(failure({ category: "network", code: "network_error" }));
    const storage = new MemoryStorage();
    const service = new RemiStatsOfficialService(apiClient({ listMyNotifications } as Partial<RemiliaApiClient>), storage);

    await expect(service.getNotifications()).resolves.toMatchObject({
      ok: false,
      category: "network",
      code: "network_error",
    });
    expect(storage.values.has(REMISTATS_NOTIFICATION_READ_STATE_KEY)).toBe(false);
  });

  it("does not invent a fixed cooldown after a successful poke", async () => {
    const pokeUser = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { target_handle: "alice", poked_at: 1_754_870_400 },
    });
    const storage = new MemoryStorage();
    const service = new RemiStatsOfficialService(apiClient({ pokeUser } as Partial<RemiliaApiClient>), storage);

    await expect(service.pokeUser("alice")).resolves.toMatchObject({
      ok: true,
      source: "official",
      cooldownMs: 0,
    });
    expect(JSON.stringify(storage.values.get(REMISTATS_POKE_COOLDOWN_STORAGE_KEY) ?? {})).not.toContain("alice");
  });

  it("uses next_allowed_at as the authoritative cooldown and stores a redacted diagnostic", async () => {
    const now = 1_800_000_000_000;
    const pokeUser = vi.fn().mockResolvedValue(failure({
      category: "cooldown",
      code: "poke_cooldown",
      status: 429,
      nextAllowedAt: now / 1000 + 90,
      retryAfterMs: 1,
    }));
    const storage = new MemoryStorage();
    const service = new RemiStatsOfficialService(apiClient({ pokeUser } as Partial<RemiliaApiClient>), storage, () => now);

    await expect(service.pokeUser("sensitive-target")).resolves.toMatchObject({
      ok: false,
      code: "poke_cooldown",
      cooldownMs: 90_000,
      cooldownUntil: now + 90_000,
      cooldownSource: "official",
    });
    const diagnostic = JSON.stringify(storage.values.get(REMISTATS_LAST_POKE_DIAGNOSTIC_KEY));
    expect(diagnostic).toContain("poke_cooldown");
    expect(diagnostic).not.toContain("sensitive-target");
    expect(diagnostic).not.toContain("Stable client-owned message");
  });

  it("returns an unexpired saved deadline only as a labeled offline fallback", async () => {
    const now = 1_800_000_000_000;
    const pokeUser = vi.fn().mockResolvedValue(failure({ category: "network", code: "network_error" }));
    const storage = new MemoryStorage();
    storage.values.set(REMISTATS_POKE_COOLDOWN_STORAGE_KEY, {
      schemaVersion: 2,
      targets: { alice: { until: now + 30_000, observedAt: now - 1_000, source: "official" } },
    });
    const service = new RemiStatsOfficialService(apiClient({ pokeUser } as Partial<RemiliaApiClient>), storage, () => now);

    await expect(service.pokeUser("alice")).resolves.toMatchObject({
      ok: false,
      category: "network",
      cooldownMs: 30_000,
      cooldownSource: "offline-fallback",
    });
    await expect(service.getPokeEligibility("alice")).resolves.toMatchObject({
      ok: true,
      canPoke: false,
      cooldownMs: 30_000,
      cooldownSource: "offline-fallback",
    });
  });

  it.each([
    ["expired token", failure({ category: "authentication", code: "invalid_token", status: 401 }), { authRequired: true }],
    ["missing scope", failure({ category: "authorization", code: "insufficient_scope", status: 403 }), { scopeRequired: true }],
  ])("preserves normalized %s behavior without raw response data", async (_label, result, expected) => {
    const service = new RemiStatsOfficialService(apiClient({ pokeUser: vi.fn().mockResolvedValue(result) } as Partial<RemiliaApiClient>), new MemoryStorage());
    const response = await service.pokeUser("alice");
    expect(response).toMatchObject({ ok: false, ...expected });
    expect(response).not.toHaveProperty("data");
    expect(response).not.toHaveProperty("headers");
    expect(response).not.toHaveProperty("token");
  });
});
