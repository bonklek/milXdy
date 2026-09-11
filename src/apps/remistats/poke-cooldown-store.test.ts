import { describe, expect, it } from "vitest";
import { PokeCooldownStore } from "./poke-cooldown-store";

describe("anonymous cooldown persistence", () => {
  it("retains the anonymous namespace when callers omit the captured account", async () => {
    let value: unknown = {
      schemaVersion: 2,
      targets: { alice: { until: 1_800_000_000_000, observedAt: 1_700_000_000_000, source: "official" } },
    };
    const store = new PokeCooldownStore({
      get: async () => value,
      set: async (_key, next) => { value = next; },
      remove: async () => { value = undefined; },
    }, () => 1_700_000_000_000, async () => "", "cooldowns");

    expect((await store.get("Alice"))?.until).toBe(1_800_000_000_000);
    await store.store("Bob", 1_800_000_000_001);
    expect(value).toMatchObject({ schemaVersion: 3, accounts: {
      __anonymous__: { alice: { source: "official" }, bob: { until: 1_800_000_000_001 } },
    } });
    await store.remove("Alice");
    expect(await store.get("Alice")).toBeNull();
    expect((await store.get("Bob"))?.until).toBe(1_800_000_000_001);
  });
});
