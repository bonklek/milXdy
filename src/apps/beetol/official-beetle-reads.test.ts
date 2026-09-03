import { describe, expect, it, vi } from "vitest";
import readyFixture from "./fixtures/official-beetle-ready.json";
import cooldownFixture from "./fixtures/official-beetle-cooldown.json";
import exhaustedFixture from "./fixtures/official-beetle-exhausted.json";
import partialFixture from "./fixtures/official-beetle-partial.json";
import cardsFixture from "./fixtures/official-beetle-cards.json";
import {
  normalizeOfficialBeetleSnapshot,
  officialBeetleReadFailure,
  readOfficialBeetleSnapshot,
} from "./official-beetle-reads";

const NOW = 1_800_000_000_000;

describe("official Beetle read normalization", () => {
  it("maps a ready official state and discovered cards into the existing panel user shape", () => {
    const result = normalizeOfficialBeetleSnapshot(readyFixture, cardsFixture, { now: NOW });

    expect(result.partial).toBe(false);
    expect(result.user.inventory).toEqual({ green: 3, pollen_common: 2 });
    expect(result.user.hammerDurabilities).toEqual({ hammer_t1: 7 });
    expect(result.user.cards.goliath).toMatchObject({
      codename: "goliath",
      discovered: true,
      count: 1,
      displayName: "Goliath Beetle",
      rarity: "rare",
    });
    expect(result.user.cooldowns).toMatchObject({ beetleHunt: 0, catchBeetle: 0 });
    expect(result.user.beetleHunt).toMatchObject({ charges: 3, cooldownMs: 0, available: true, ready: true });
    expect(result.user.officialRead).toMatchObject({
      stateEndpoint: "/api/v1/me/beetle",
      cardsEndpoint: "/api/v1/me/beetle/cards",
      partial: false,
    });
  });

  it("maps an authoritative cooldown without relying on legacy hunt timestamps", () => {
    const result = normalizeOfficialBeetleSnapshot(cooldownFixture, cardsFixture, { now: NOW });

    expect(result.user.beetleHuntCharges).toBe(0);
    expect(result.user.cooldowns.beetleHunt).toBe(15 * 60 * 1000);
    expect(result.user.cooldownExpiresAt.beetleHunt).toBe(NOW + 15 * 60 * 1000);
    expect(result.user.beetleHunt).toMatchObject({
      charges: 0,
      cooldownMs: 15 * 60 * 1000,
      cooldownUntil: NOW + 15 * 60 * 1000,
      available: false,
    });
  });

  it("keeps exhausted distinct from cooldown and ready", () => {
    const result = normalizeOfficialBeetleSnapshot(exhaustedFixture, {}, { now: NOW });

    expect(result.user.beetleHuntCharges).toBe(0);
    expect(result.user.cooldowns.beetleHunt).toBe(0);
    expect(result.user.cooldownExpiresAt).toEqual({});
    expect(result.user.beetleHunt).toMatchObject({ charges: 0, cooldownMs: 0, available: false, ready: false });
  });

  it("marks missing official fields without inventing readiness or charges", () => {
    const result = normalizeOfficialBeetleSnapshot(partialFixture, {}, { now: NOW });

    expect(result.partial).toBe(true);
    expect(result.user.inventory).toEqual({ green: 1 });
    expect(result.user.beetleHunt).toBeUndefined();
    expect(result.user.beetleHuntCharges).toBeUndefined();
    expect(result.user.officialRead.missingFields).toEqual([
      "xp",
      "level",
      "hammers",
      "cooldowns",
    ]);
  });

  it("keeps usable state when the cards read fails and records only a normalized warning", async () => {
    const client = {
      getMyBeetle: vi.fn().mockResolvedValue({ ok: true, data: readyFixture, status: 200 }),
      getMyBeetleCards: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "rate_limited", privateBody: "do not retain" },
      }),
    };

    const result = await readOfficialBeetleSnapshot(client, NOW);

    expect(result.user.inventory.green).toBe(3);
    expect(result.user.cards).toEqual({});
    expect(result.user.officialRead).toMatchObject({
      partial: true,
      cardsReadError: "rate_limited",
      missingFields: ["cards"],
    });
    expect(JSON.stringify(result)).not.toContain("do not retain");
  });

  it("fails the combined read when the authoritative state call fails", async () => {
    const client = {
      getMyBeetle: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "insufficient_scope", privateBody: "do not retain" },
      }),
      getMyBeetleCards: vi.fn().mockResolvedValue({ ok: true, data: cardsFixture, status: 200 }),
    };

    await expect(readOfficialBeetleSnapshot(client, NOW)).rejects.toMatchObject({
      code: "insufficient_scope",
    });
  });
});

describe("official Beetle read failure mapping", () => {
  it.each([
    ["AUTH_REQUIRED", "auth_required", true],
    ["MIGRATION_REQUIRED", "auth_required", true],
    ["TOKEN_EXPIRED", "invalid_token", true],
    ["MISSING_SCOPE", "insufficient_scope", true],
    ["OFFLINE", "network", false],
    ["AUTH_TIMEOUT", "timeout", false],
    ["unauthorized", "auth_required", true],
    ["auth_unavailable", "auth_required", true],
    ["network_error", "network", false],
    ["request_timeout", "timeout", false],
    ["auth_required", "auth_required", true],
    ["invalid_token", "invalid_token", true],
    ["insufficient_scope", "insufficient_scope", true],
    ["requires_user", "requires_user", true],
    ["rate_limited", "rate_limited", false],
  ] as const)("maps %s to a safe panel response", (input, expected, authRequired) => {
    const response = officialBeetleReadFailure({ code: input, responseBody: "secret" });
    expect(response.error).toBe(expected);
    expect(response.authRequired === true).toBe(authRequired);
    expect(JSON.stringify(response)).not.toContain("secret");
  });
});
