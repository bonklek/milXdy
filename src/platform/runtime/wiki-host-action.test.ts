import { describe, expect, it } from "vitest";
import { invokeWikiHostAction } from "./wiki-host-action";

const caller = { id: "wiki", hostActions: ["wiki.openPage"] } as any;
const target = { id: "wikiSidebar", available: true, siteScopes: [{ site: "x", integration: "contentScript", hosts: ["https://x.com/*"] }] } as any;
const base = (overrides: Record<string, unknown> = {}) => ({
  caller, signal: new AbortController().signal, apps: [caller, target], site: { id: "x", origin: "https://x.com", mode: "fullRail" } as const,
  isDisposed: () => false, isEnabled: (id: string) => id === "wiki" || id === "wikiSidebar", isUnloading: () => false,
  load: async () => ({ id: "wikiSidebar", openWikiUrl: async () => undefined }), url: "https://remilia.wiki/wiki/Milady", ...overrides,
});

describe("Wiki host action", () => {
  it("requires declaration, enabled target, and an approved Wiki URL", async () => {
    expect(await invokeWikiHostAction(base({ caller: { id: "wiki" } as any }))).toEqual({ ok: false, reason: "unavailable" });
    expect(await invokeWikiHostAction(base({ url: "https://example.com/" }))).toEqual({ ok: false, reason: "invalid-url" });
    expect(await invokeWikiHostAction(base({ isEnabled: (id: string) => id === "wiki" }))).toEqual({ ok: false, reason: "disabled" });
  });

  it("returns cancellation or disabled when lifecycle changes during loading", async () => {
    const controller = new AbortController();
    expect(await invokeWikiHostAction(base({ signal: controller.signal, load: async () => { controller.abort(); return null; } }))).toEqual({ ok: false, reason: "cancelled" });
    let enabled = true;
    expect(await invokeWikiHostAction(base({ isEnabled: (id: string) => id === "wiki" || enabled, load: async () => { enabled = false; return { id: "wikiSidebar", openWikiUrl: async () => undefined }; } }))).toEqual({ ok: false, reason: "disabled" });
  });
});
