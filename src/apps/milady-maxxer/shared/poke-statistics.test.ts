import { describe, expect, it } from "vitest";
import { createPokeStatisticsStore, readPokeStatistics, readPokeStatisticsFromHost, POKE_RECEIPT_RETENTION_MS } from "./poke-statistics";
import { storageKeyForScope } from "./storage";
const now = 1_800_000_000_000;
function fixture() {
  const values: Record<string, unknown> = {};
  const storage = { get: async (key: string) => structuredClone(values[key]), set: async (key: string, value: unknown) => { values[key] = structuredClone(value); } };
  return { values, storage, store: createPokeStatisticsStore(storage, () => now) };
}
const receipt = (index: number) => ({ target_handle: `synthetic${index}`, poked_at: now / 1000 + index });
describe("account-scoped authoritative poke counters", () => {
  it("serializes concurrent successes, deduplicates repeated receipts and exposes only summaries", async () => {
    const { store, storage, values } = fixture(), snapshot = await store.capture("alice");
    await Promise.all([store.record(snapshot, receipt(0), true), store.record(snapshot, receipt(0), true), store.record(snapshot, receipt(1), false)]);
    expect(await readPokeStatistics(storage, "alice")).toMatchObject({ totalSuccessfulPokes: 2, trackedSuccessfulPokes: 1, lastSuccessfulPokeAt: now + 1000 });
    expect(JSON.stringify(values)).not.toContain("synthetic"); expect(await readPokeStatistics(storage, "bob")).toMatchObject({ totalSuccessfulPokes: 0 });
    expect(await store.capture(null)).toBeNull();
  });
  it("attributes delayed success to the captured initiating account, never the newly active account", async () => {
    const { store, storage } = fixture(), initial = await store.capture("alice");
    await store.capture("bob"); await store.record(initial, receipt(0), true);
    expect((await readPokeStatistics(storage, "alice")).totalSuccessfulPokes).toBe(1);
    expect((await readPokeStatistics(storage, "bob")).totalSuccessfulPokes).toBe(0);
  });
  it("reset fences in-flight success across store recreation and preserves XP and receipt deduplication", async () => {
    const { store, storage, values } = fixture(); values[storageKeyForScope("playerStats", "alice")] = { totalLikesGiven: 12 };
    const before = await store.capture("alice"); await store.record(before, receipt(0), true); await store.reset("alice");
    const restarted = createPokeStatisticsStore(storage, () => now);
    expect(await restarted.record(before, receipt(1), true)).toBe(false);
    const after = await restarted.capture("alice"); expect(await restarted.record(after, receipt(0), true)).toBe(false);
    expect(await restarted.record(after, receipt(2), false)).toBe(true);
    expect((await readPokeStatistics(storage, "alice")).totalSuccessfulPokes).toBe(1);
    expect(values[storageKeyForScope("playerStats", "alice")]).toEqual({ totalLikesGiven: 12 });
  });
  it("bounds hashed receipts and prevents pruned receipts from replaying", async () => {
    const { store, values } = fixture(), snapshot = await store.capture("alice");
    for (let i=0;i<260;i++) await store.record(snapshot, { target_handle: `synthetic${i}`, poked_at: now / 1000 }, false);
    const raw = values[storageKeyForScope("pokeStats", "alice")] as { receipts: unknown[] };
    expect(raw.receipts.length).toBeLessThanOrEqual(256);
    expect(await store.record(snapshot, receipt(0), false)).toBe(false);
    expect(await store.record(snapshot, { target_handle: "old", poked_at: (now - POKE_RECEIPT_RETENTION_MS - 1000) / 1000 }, false)).toBe(false);
  });
  it("does not lose the previous counters when a storage write fails", async () => {
    const { store, storage } = fixture(), snapshot = await store.capture("alice"); await store.record(snapshot, receipt(0), true);
    const failureStore = createPokeStatisticsStore({ get: storage.get, set: async () => { throw new Error("write rejected"); } }, () => now);
    await expect(failureStore.record(snapshot, receipt(1), true)).rejects.toThrow();
    expect((await readPokeStatistics(storage, "alice")).totalSuccessfulPokes).toBe(1);
  });
});

it("uses the injected SDK summary port and refuses unavailable reads instead of showing false zero counts", async () => {
  const messages: unknown[] = [];
  const send = async (message: unknown) => { messages.push(message); return { ok: true, summary: { totalSuccessfulPokes: 3, trackedSuccessfulPokes: 1 } }; };
  expect((await readPokeStatisticsFromHost(send, "alice")).totalSuccessfulPokes).toBe(3);
  expect(messages).toEqual([{ type: "milady:readPokeStats", scope: "alice" }]);
  await expect(readPokeStatisticsFromHost(async () => ({ ok: false }), "alice")).rejects.toThrow("unavailable");
  expect((await readPokeStatisticsFromHost(send, null)).totalSuccessfulPokes).toBe(0); expect(messages).toHaveLength(1);
});
