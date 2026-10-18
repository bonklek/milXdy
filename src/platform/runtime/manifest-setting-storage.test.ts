import { describe, expect, it, vi } from "vitest";
import { persistManifestSetting } from "./manifest-setting-storage";

describe("generated setting persistence", () => {
  it("keeps both property edits when two controls save the same storage object", async () => {
    let preferences = { first: false, second: false };
    const storage = {
      get: async () => ({ preferences: { ...preferences } }),
      set: async (_area: "local" | "sync", values: Record<string, unknown>) => {
        await Promise.resolve();
        preferences = values.preferences as typeof preferences;
        return true;
      },
    };
    await Promise.all(["first", "second"].map(property => persistManifestSetting({ storage: { area: "local", key: "preferences", property } }, true, storage)));
    expect(preferences).toEqual({ first: true, second: true });
  });
  it.each(["local", "sync"] as const)("rejects an unavailable %s write instead of reporting saved", async (area) => {
    const storage = { get: vi.fn(), set: vi.fn(async () => false) };
    await expect(persistManifestSetting({ storage: { area, key: "fixture.enabled" } }, true, storage)).rejects.toThrow("Reload this page");
  });
  it("preserves neighboring properties when saving a nested setting", async () => {
    const storage = { get: vi.fn(async () => ({ preferences: { color: "blue", enabled: false } })), set: vi.fn(async () => true) };
    await persistManifestSetting({ storage: { area: "local", key: "preferences", property: "enabled" } }, true, storage);
    expect(storage.set).toHaveBeenCalledWith("local", { preferences: { color: "blue", enabled: true } });
  });
  it("does not overwrite nested settings if the existing object cannot be read", async () => {
    const storage = { get: vi.fn(async () => null), set: vi.fn(async () => true) };
    await expect(persistManifestSetting({ storage: { area: "local", key: "preferences", property: "enabled" } }, true, storage)).rejects.toThrow("unavailable");
    expect(storage.set).not.toHaveBeenCalled();
  });
});
