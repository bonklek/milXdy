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

  it("returns self-profile stats only after exact auth, directory, and stats identity agreement", async () => {
    const resolveDirectory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        results: [{
          query: { type: "x_handle", value: "Alice_X" },
          identity: { handle: "Alice.Remilia", display_name: "Alice", avatar_url: "https://example.invalid/a.png" },
        }],
      },
    });
    const getMyStats = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        handle: "alice.remilia",
        display_name: "Alice",
        stats: {
          beetle_game: { beetles: 42, cheese: 7 },
          twitter: { followers_count: 123 },
        },
        aggregate_scores: { total: 9001 },
      },
    });
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory, getMyStats } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "connected", identity: { username: "@Alice.Remilia" } }),
    );

    await expect(service.getMyStatsForXProfile("@Alice_X")).resolves.toEqual({
      ok: true,
      source: "official",
      matched: true,
      scope: "remilia:stats.read",
      status: 200,
      data: {
        xHandle: "alice_x",
        remiliaUsername: "alice.remilia",
        displayName: "Alice",
        score: 9001,
        beetleCount: 42,
        followers: 123,
      },
    });
    expect(resolveDirectory).toHaveBeenCalledWith([{ type: "x_handle", value: "alice_x" }]);
    expect(getMyStats).toHaveBeenCalledOnce();
  });

  it("lets exact stats and directory clients authorize a credential missing only unrelated release scopes", async () => {
    const resolveDirectory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { results: [{
        query: { type: "x_handle", value: "alice_x" },
        identity: { handle: "alice.remilia", display_name: "Alice", avatar_url: "https://example.invalid/a.png" },
      }] },
    });
    const getMyStats = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: {
        handle: "alice.remilia",
        display_name: "Alice",
        stats: {},
        aggregate_scores: { total: 12 },
      },
    });
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory, getMyStats } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "missing-scope", identity: { username: "alice.remilia" } }),
    );

    await expect(service.getMyStatsForXProfile("alice_x")).resolves.toMatchObject({
      ok: true,
      matched: true,
      data: { remiliaUsername: "alice.remilia", score: 12 },
    });
    expect(resolveDirectory).toHaveBeenCalledOnce();
    expect(getMyStats).toHaveBeenCalledOnce();
  });

  it("does not resolve a profile or fetch self stats without a connected authoritative identity", async () => {
    const resolveDirectory = vi.fn();
    const getMyStats = vi.fn();
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory, getMyStats } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "disconnected" }),
    );

    await expect(service.getMyStatsForXProfile("alice_x")).resolves.toEqual({
      ok: true,
      source: "official",
      matched: false,
      data: null,
    });
    expect(resolveDirectory).not.toHaveBeenCalled();
    expect(getMyStats).not.toHaveBeenCalled();
  });

  it("rejects partial or non-X profile handles before any identity or stats lookup", async () => {
    const getAuthStatus = vi.fn();
    const resolveDirectory = vi.fn();
    const getMyStats = vi.fn();
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory, getMyStats } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      getAuthStatus,
    );

    await expect(service.getMyStatsForXProfile("alice/with-extra-path")).resolves.toMatchObject({
      ok: true,
      matched: false,
      data: null,
    });
    expect(getAuthStatus).not.toHaveBeenCalled();
    expect(resolveDirectory).not.toHaveBeenCalled();
    expect(getMyStats).not.toHaveBeenCalled();
  });

  it.each([
    {
      label: "an arbitrary X profile mapped to another Remilia account",
      directoryResults: [{
        query: { type: "x_handle", value: "bob_x" },
        identity: { handle: "bob.remilia", display_name: "Bob", avatar_url: "https://example.invalid/b.png" },
      }],
    },
    { label: "an unresolved X profile", directoryResults: [{ query: { type: "x_handle", value: "bob_x" }, identity: null }] },
    { label: "an ambiguous directory response", directoryResults: [] },
  ])("does not fetch or leak self stats for $label", async ({ directoryResults }) => {
    const resolveDirectory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { results: directoryResults },
    });
    const getMyStats = vi.fn();
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory, getMyStats } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "connected", identity: { username: "alice.remilia" } }),
    );

    await expect(service.getMyStatsForXProfile("bob_x")).resolves.toMatchObject({
      ok: true,
      matched: false,
      data: null,
    });
    expect(getMyStats).not.toHaveBeenCalled();
  });

  it("fails closed when /me/stats disagrees with the matched authenticated account", async () => {
    const resolveDirectory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { results: [{
        query: { type: "x_handle", value: "alice_x" },
        identity: { handle: "alice.remilia", display_name: "Alice", avatar_url: "https://example.invalid/a.png" },
      }] },
    });
    const getMyStats = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { handle: "mallory", display_name: "Mallory", stats: {}, aggregate_scores: { total: 999 } },
    });
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory, getMyStats } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "connected", identity: { username: "alice.remilia" } }),
    );

    const result = await service.getMyStatsForXProfile("alice_x");
    expect(result).toMatchObject({
      ok: true,
      matched: false,
      data: null,
    });
    expect(JSON.stringify(result)).not.toContain("999");
  });

  it("resolves Poke targets from the official directory without requiring public profile data", async () => {
    const resolveDirectory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { results: [
        {
          query: { type: "x_handle", value: "bob_x" },
          identity: { handle: "bob.remilia", display_name: "Bob", avatar_url: "https://example.invalid/b.png" },
        },
        {
          query: { type: "x_handle", value: "alice_x" },
          identity: { handle: "alice.remilia", display_name: "Alice", avatar_url: "https://example.invalid/a.png" },
        },
      ] },
    });
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "connected", identity: { username: "alice.remilia" } }),
    );

    await expect(service.resolvePokeTargets(["Bob_X", "alice_x"])).resolves.toEqual({
      ok: true,
      source: "official",
      targets: [{ xHandle: "bob_x", remiliaUsername: "bob.remilia" }],
    });
    expect(resolveDirectory).toHaveBeenCalledWith([
      { type: "x_handle", value: "bob_x" },
      { type: "x_handle", value: "alice_x" },
    ]);
  });

  it("resolves a non-self Poke target when directory presentation fields are absent", async () => {
    const resolveDirectory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { results: [{
        query: { type: "x_handle", value: "bob_x" },
        identity: { handle: "Bob.Remilia" },
      }] },
    });
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "connected", identity: { username: "alice.remilia" } }),
    );

    await expect(service.resolvePokeTargets(["Bob_X"])).resolves.toEqual({
      ok: true,
      source: "official",
      targets: [{ xHandle: "bob_x", remiliaUsername: "bob.remilia" }],
    });
  });

  it("does not suppress an exact non-self Poke target for an unrelated missing release scope", async () => {
    const resolveDirectory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { results: [{
        query: { type: "x_handle", value: "bob_x" },
        identity: { handle: "bob.remilia", display_name: "Bob", avatar_url: "https://example.invalid/b.png" },
      }] },
    });
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "missing-scope", identity: { username: "alice.remilia" } }),
    );

    await expect(service.resolvePokeTargets(["bob_x"])).resolves.toEqual({
      ok: true,
      source: "official",
      targets: [{ xHandle: "bob_x", remiliaUsername: "bob.remilia" }],
    });
    expect(resolveDirectory).toHaveBeenCalledOnce();
  });

  it("keeps self exclusion while resolving under an unrelated missing release scope", async () => {
    const resolveDirectory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { results: [{
        query: { type: "x_handle", value: "alice_x" },
        identity: { handle: "alice.remilia", display_name: "Alice", avatar_url: "https://example.invalid/a.png" },
      }] },
    });
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "missing-scope", identity: { username: "alice.remilia" } }),
    );

    await expect(service.resolvePokeTargets(["alice_x"])).resolves.toMatchObject({ targets: [] });
  });

  it("returns no Poke targets while disconnected and makes no directory request", async () => {
    const resolveDirectory = vi.fn();
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "disconnected" }),
    );

    await expect(service.resolvePokeTargets(["bob_x"])).resolves.toEqual({
      ok: true,
      source: "official",
      targets: [],
    });
    expect(resolveDirectory).not.toHaveBeenCalled();
  });

  it("does not launch a Poke after disconnect even if the UI had an earlier target", async () => {
    const resolveDirectory = vi.fn();
    const pokeUser = vi.fn();
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory, pokeUser } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "disconnected" }),
    );

    await expect(service.pokeXAuthor("bob_x", "bob.remilia")).resolves.toMatchObject({
      ok: false,
      authRequired: true,
      code: "auth_unavailable",
    });
    expect(resolveDirectory).not.toHaveBeenCalled();
    expect(pokeUser).not.toHaveBeenCalled();
  });

  it("fails closed on ambiguous Poke directory mappings", async () => {
    const identity = { handle: "bob.remilia", display_name: "Bob", avatar_url: "https://example.invalid/b.png" };
    const resolveDirectory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { results: [
        { query: { type: "x_handle", value: "bob_x" }, identity },
        { query: { type: "x_handle", value: "bob_x" }, identity },
      ] },
    });
    const pokeUser = vi.fn();
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory, pokeUser } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "connected", identity: { username: "alice.remilia" } }),
    );

    await expect(service.resolvePokeTargets(["bob_x"])).resolves.toMatchObject({ targets: [] });
    await expect(service.pokeXAuthor("bob_x", "bob.remilia")).resolves.toMatchObject({
      ok: false,
      code: "forbidden",
    });
    expect(pokeUser).not.toHaveBeenCalled();
  });

  it("revalidates the exact X mapping and expected Remilia target before Poke", async () => {
    const resolveDirectory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { results: [{
        query: { type: "x_handle", value: "bob_x" },
        identity: { handle: "bob.remilia", display_name: "Bob", avatar_url: "https://example.invalid/b.png" },
      }] },
    });
    const pokeUser = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { target_handle: "bob.remilia", poked_at: 10 },
    });
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory, pokeUser } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "connected", identity: { username: "alice.remilia" } }),
    );

    await expect(service.pokeXAuthor("Bob_X", "bob.remilia")).resolves.toMatchObject({
      ok: true,
      data: { target_handle: "bob.remilia" },
    });
    expect(pokeUser).toHaveBeenCalledWith("bob.remilia");

    pokeUser.mockClear();
    await expect(service.pokeXAuthor("bob_x", "mallory")).resolves.toMatchObject({
      ok: false,
      code: "forbidden",
    });
    expect(pokeUser).not.toHaveBeenCalled();
  });

  it("revalidates and launches through exact clients when only an unrelated release scope is missing", async () => {
    const resolveDirectory = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { results: [{
        query: { type: "x_handle", value: "bob_x" },
        identity: { handle: "bob.remilia", display_name: "Bob", avatar_url: "https://example.invalid/b.png" },
      }] },
    });
    const pokeUser = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { target_handle: "bob.remilia", poked_at: 10 },
    });
    const service = new RemiStatsOfficialService(
      apiClient({ resolveDirectory, pokeUser } as Partial<RemiliaApiClient>),
      new MemoryStorage(),
      Date.now,
      async () => ({ phase: "missing-scope", identity: { username: "alice.remilia" } }),
    );

    await expect(service.pokeXAuthor("bob_x", "bob.remilia")).resolves.toMatchObject({ ok: true });
    expect(resolveDirectory).toHaveBeenCalledOnce();
    expect(pokeUser).toHaveBeenCalledWith("bob.remilia");
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

  it("serializes concurrent local read updates from multiple tabs", async () => {
    const listMyNotifications = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      data: { notifications: [notification("alice", 20), notification("bob", 10)], page: 1, limit: 50, has_more: false },
    });
    const storage = new MemoryStorage();
    const service = new RemiStatsOfficialService(apiClient({ listMyNotifications } as Partial<RemiliaApiClient>), storage, () => 1_800_000_000_000);
    const incoming = await service.getIncomingPokes();
    if (!incoming.ok) throw new Error("expected notifications");

    await Promise.all(incoming.pokes.map((poke) => service.markNotificationsRead([poke.key])));
    const state = storage.values.get(REMISTATS_NOTIFICATION_READ_STATE_KEY) as { entries: Array<{ key: string }> };
    expect(state.entries.map((entry) => entry.key).sort()).toEqual(incoming.pokes.map((poke) => poke.key).sort());
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
