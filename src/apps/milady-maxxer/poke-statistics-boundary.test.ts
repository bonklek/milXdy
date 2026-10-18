import { afterEach, expect, it, vi } from "vitest";
import { ACTIVE_ACCOUNT_SCOPE_KEY, storageKeyForScope } from "./shared/storage";
const registered = vi.hoisted(() => [] as Array<{ type: string; handle: (message: any, sender: any) => Promise<any> }>);
vi.mock("../../platform/background/router", () => ({ registerBackgroundMessageHandlers: (entries: typeof registered) => registered.push(...entries) }));
import "./background";
afterEach(() => vi.unstubAllGlobals());
it("exposes aggregate-only poke summaries through the trusted active-account boundary", async () => {
  const values: Record<string, unknown> = { [ACTIVE_ACCOUNT_SCOPE_KEY]: "alice", [storageKeyForScope("pokeStats", "alice")]: { schemaVersion: 1, totalSuccessfulPokes: 7, trackedSuccessfulPokes: 2, lastSuccessfulPokeAt: 1000, resetAt: null, resetVersion: "internal", receipts: [{ id: "f".repeat(64), at: Date.now() }], privateDetail: "never exposed" } };
  const set = vi.fn();
  vi.stubGlobal("chrome", { runtime: { id: "synthetic-extension" }, storage: { local: { get: async (key: string) => ({ [key]: values[key] }), set } } });
  const handler = registered.find(entry => entry.type === "milady:readPokeStats")!;
  const sender = { id: "synthetic-extension", tab: { id: 1 }, frameId: 0, url: "https://x.com/home" };
  const result = await handler.handle({ type: "milady:readPokeStats", scope: "alice" }, sender);
  expect(result).toEqual({ ok: true, summary: { schemaVersion: 1, totalSuccessfulPokes: 7, trackedSuccessfulPokes: 2, lastSuccessfulPokeAt: 1000, resetAt: null } });
  expect(JSON.stringify(result)).not.toMatch(/receipts|internal|never exposed/); expect(set).not.toHaveBeenCalled();
  expect(await handler.handle({ scope: "bob" }, sender)).toEqual({ ok: false });
  expect(await handler.handle({ scope: "alice" }, { ...sender, id: "other" })).toEqual({ ok: false });
  expect(await handler.handle({ scope: "alice" }, { ...sender, frameId: 1 })).toEqual({ ok: false });
});
