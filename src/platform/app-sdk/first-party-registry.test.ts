import { afterEach, describe, expect, it, vi } from "vitest";

describe("first-party shared Wiki settings", () => {
  afterEach(() => {
    vi.resetModules();
    Reflect.deleteProperty(globalThis, "chrome");
  });

  it("serializes concurrent Wiki and Wiki sidebar setters", async () => {
    let value: Record<string, unknown> = { enabled: true, sidebarEnabled: true, retained: "value" };
    const storage = {
      get: vi.fn(async () => {
        await Promise.resolve();
        return { "remiliaWikiHyperlink.settings": { ...value } };
      }),
      set: vi.fn(async (next: Record<string, Record<string, unknown>>) => {
        await Promise.resolve();
        value = next["remiliaWikiHyperlink.settings"]!;
      }),
    };
    Object.assign(globalThis, { chrome: { storage: { local: storage, sync: storage } } });
    const { firstPartyAppById } = await import("./first-party-registry");
    const wiki = firstPartyAppById("wiki")!;
    const sidebar = firstPartyAppById("wikiSidebar")!;

    await Promise.all([wiki.setEnabled!(false), sidebar.setEnabled!(false)]);
    expect(value).toEqual({ enabled: false, sidebarEnabled: false, retained: "value" });
  });
});
