import { afterEach, expect, it, vi } from "vitest";
import { recordMaxxerPoke } from "./poke-statistics-background";
import { ACTIVE_ACCOUNT_SCOPE_KEY, storageKeyForScope } from "./shared/storage";
import { readPokeStatistics } from "./shared/poke-statistics";
import type { RemiStatsPokeResult } from "../remistats/official-api-contract";
afterEach(() => vi.unstubAllGlobals());
function fixture() {
  const values: Record<string, unknown> = { [ACTIVE_ACCOUNT_SCOPE_KEY]: "alice", [storageKeyForScope("matchedAccounts", "alice")]: { bob_x: { caught: true } } };
  const get = async (key: string) => ({ [key]: structuredClone(values[key]) });
  vi.stubGlobal("chrome", { storage: { local: { get, set: async (patch: Record<string, unknown>) => { Object.assign(values, structuredClone(patch)); } } } });
  const storage = { get: async (key: string) => (await get(key))[key] };
  const success = (): RemiStatsPokeResult => ({ ok: true, source: "official", scope: "remilia:pokes.write", status: 200, data: { target_handle: "bob.remilia", poked_at: Math.floor(Date.now()/1000) }, cooldownMs: 0 });
  return { values, storage, success };
}
it.each(["poke_cooldown", "unauthorized", "network_error"])("does not count %s results", async code => {
  const { storage } = fixture(); const result = { ok: false, code } as RemiStatsPokeResult;
  expect(await recordMaxxerPoke(async () => result)).toBe(result);
  expect((await readPokeStatistics(storage, "alice")).totalSuccessfulPokes).toBe(0);
});
it("records only official success, once, under the initiating account despite account switch", async () => {
  const { values, storage, success } = fixture(); let complete!: (value: RemiStatsPokeResult) => void;
  const pending = recordMaxxerPoke(() => new Promise(resolve => complete = resolve), "bob_x", "bob.remilia");
  while (!complete) await Promise.resolve(); values[ACTIVE_ACCOUNT_SCOPE_KEY] = "charlie"; const result = success(); complete(result); await pending;
  expect(await readPokeStatistics(storage, "alice")).toMatchObject({ totalSuccessfulPokes: 1, trackedSuccessfulPokes: 1 });
  expect((await readPokeStatistics(storage, "charlie")).totalSuccessfulPokes).toBe(0);
  values[ACTIVE_ACCOUNT_SCOPE_KEY] = "alice";
  await recordMaxxerPoke(async () => result, "bob_x", "bob.remilia");
  expect((await readPokeStatistics(storage, "alice")).totalSuccessfulPokes).toBe(1);
  expect(JSON.stringify(values[storageKeyForScope("pokeStats", "alice")])).not.toContain("bob");
});
it("does not count spoofed success data or mutate XP and reports local write failure without retrying the poke", async () => {
  const { values, storage, success } = fixture(); values[storageKeyForScope("playerStats", "alice")] = { totalLikesGiven: 9 };
  await recordMaxxerPoke(async () => ({ ...success(), source: "page" } as never), "bob_x");
  expect((await readPokeStatistics(storage, "alice")).totalSuccessfulPokes).toBe(0);
  (chrome.storage.local.set as unknown) = async () => { throw new Error("storage rejected"); };
  const action = vi.fn(async () => success());
  expect(await recordMaxxerPoke(action, "bob_x")).toMatchObject({ ok: true, localPokeStatsRecorded: false });
  expect(action).toHaveBeenCalledOnce(); expect(values[storageKeyForScope("playerStats", "alice")]).toEqual({ totalLikesGiven: 9 });
});

it.each(["scope", "capture"])("reports %s read failure after successful poke without retrying", async stage => {
  const { success } = fixture(); const originalGet = chrome.storage.local.get;
  chrome.storage.local.get = (async (key: string) => {
    if (stage === "scope" && key === ACTIVE_ACCOUNT_SCOPE_KEY || stage === "capture" && key.endsWith(".pokeStats")) throw new Error("read rejected");
    return originalGet(key);
  }) as unknown as typeof chrome.storage.local.get;
  const action = vi.fn(async () => success());
  expect(await recordMaxxerPoke(action)).toMatchObject({ ok: true, localPokeStatsRecorded: false });
  expect(action).toHaveBeenCalledOnce();
});
