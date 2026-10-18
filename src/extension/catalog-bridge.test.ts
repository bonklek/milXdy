import { readFileSync } from "node:fs";
import vm from "node:vm";
import { transformSync } from "esbuild";
import { describe, expect, it, vi } from "vitest";

const source = transformSync(readFileSync(new URL("./catalog-bridge.ts", import.meta.url), "utf8"), { loader: "ts" }).code;
function fixture(origin = "https://bonklek.github.io", pathname = "/milXdy/addons/") {
  let listener: (message: unknown, sender: unknown, reply: (value: unknown) => void) => void;
  const location = { origin, pathname };
  const context = { location, chrome: { runtime: { id: "fixture-extension", onMessage: { addListener: (value: typeof listener) => { listener = value; } } } }, window: { addEventListener: vi.fn(), postMessage: vi.fn() } };
  vm.runInNewContext(source, context);
  return { location, get listener() { return listener; } };
}
describe("catalog-only tab confirmation", () => {
  it("confirms only its extension caller while the catalog page remains current", () => {
    const f = fixture(); const reply = vi.fn();
    f.listener({ type: "milxdy:confirmCatalogTab" }, { id: "fixture-extension" }, reply);
    expect(reply).toHaveBeenCalledWith({ catalog: true });
    reply.mockClear();
    f.listener({ type: "milxdy:confirmCatalogTab" }, { id: "different-extension" }, reply);
    f.listener({ type: "other" }, { id: "fixture-extension" }, reply);
    expect(reply).not.toHaveBeenCalled();
    f.location.pathname = "/milXdy/unrelated/";
    f.listener({ type: "milxdy:confirmCatalogTab" }, { id: "fixture-extension" }, reply);
    expect(reply).toHaveBeenCalledWith({ catalog: false });
  });
  it("does not register a confirmation listener on unrelated origins or paths", () => {
    expect(fixture("https://example.com").listener).toBeUndefined();
    expect(fixture("https://bonklek.github.io", "/other/").listener).toBeUndefined();
  });
});
