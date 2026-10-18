import { describe, expect, it, vi } from "vitest";
import { RemiliaApiClient, REMILIA_SCOPE_POKES_WRITE } from "../../platform/auth/remilia-api";
import { RemiStatsOfficialService, REMISTATS_POKE_COOLDOWN_STORAGE_KEY } from "./official-api";
import { readPokeCooldownMs, formatPokeCooldown } from "./poke-cooldown-time";
const initialNow = 1_800_000_000_000;
function fixture(rawDeadline: number) {
  let now = initialNow;
  const values = new Map<string, unknown>();
  const grant = { ok: true as const, accessToken: "synthetic", tokenType: "Bearer" as const, expiresAt: now + 600_000, grantedScopes: [REMILIA_SCOPE_POKES_WRITE] };
  const request = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { code: "poke_cooldown", message: "cooldown", next_allowed_at: rawDeadline } }), { status: 429, headers: { "Content-Type": "application/json" } }));
  const client = new RemiliaApiClient({ auth: { prepare: async () => grant, refresh: async () => grant }, fetch: request, now: () => now });
  const service = new RemiStatsOfficialService(client, { get: async key => values.get(key), set: async (key, value) => { values.set(key, value); }, remove: async key => { values.delete(key); } }, () => now);
  return { service, values, request, advance: (ms: number) => now += ms, now: () => now };
}
describe("poke time units through API, account cache and UI", () => {
  it.each([initialNow / 1000 + 90, initialNow + 90_000])("renders documented seconds and compatible milliseconds deadline %s as90seconds, not epoch duration", async deadline => {
    const f = fixture(deadline);
    const response = await f.service.pokeUser("synthetic-target");
    expect(response).toMatchObject({ ok: false, cooldownUntil: initialNow + 90_000, cooldownMs: 90_000 });
    const eligibility = await f.service.getPokeEligibility("synthetic-target");
    expect(readPokeCooldownMs(response, f.now())).toBe(90_000);
    expect(formatPokeCooldown(readPokeCooldownMs(eligibility, f.now()))).toBe("1m");
    f.advance(90_001);
    expect(await f.service.getPokeEligibility("synthetic-target")).toMatchObject({ canPoke: true, cooldownMs: 0 });
    expect(f.request).toHaveBeenCalledOnce();
  });
  it("repairs a legacy inflated cached deadline and its old wire response without clearing unrelated data", async () => {
    const f = fixture(0), until = initialNow + 90_000;
    f.values.set("unrelated", { kept: true });
    f.values.set(REMISTATS_POKE_COOLDOWN_STORAGE_KEY, { schemaVersion: 3, accounts: { __anonymous__: { target: { until: until * 1000, observedAt: initialNow, source: "official" } } } });
    const eligibility = await f.service.getPokeEligibility("target");
    expect(readPokeCooldownMs(eligibility, f.now())).toBe(90_000);
    const oldWire = { cooldownUntil: until * 1000, cooldownMs: until * 1000 - initialNow };
    expect(formatPokeCooldown(readPokeCooldownMs(oldWire, f.now()))).toBe("1m");
    expect(f.values.get("unrelated")).toEqual({ kept: true }); expect(f.request).not.toHaveBeenCalled();
  });
  it("keeps explicit millisecond durations exact, including subsecond values", () => {
    for (const ms of [1, 500, 999, 1000, 90_000]) expect(readPokeCooldownMs({ cooldownMs: ms }, initialNow)).toBe(ms);
    expect(formatPokeCooldown(readPokeCooldownMs({ cooldownMs: 500 }, initialNow))).toBe("1s");
  });
  it("honors deadline expiry/latency over a stale duration and ignores ambiguous legacy epoch fields", () => {
    expect(readPokeCooldownMs({ cooldownUntil: initialNow + 500, cooldownMs: 90_000 }, initialNow)).toBe(500);
    expect(readPokeCooldownMs({ cooldownUntil: initialNow - 1, cooldownMs: 90_000 }, initialNow)).toBe(0);
    expect(readPokeCooldownMs({ data: { cooldown: initialNow + 90_000 }, cooldown: initialNow + 90_000 }, initialNow)).toBe(0);
    expect(readPokeCooldownMs({ authRequired: true, cooldownMs: 90_000 }, initialNow)).toBe(0);
  });
});
