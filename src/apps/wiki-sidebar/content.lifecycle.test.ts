import { afterEach, describe, expect, it, vi } from "vitest";
import { __testing, close, dispose, openWikiUrl } from "./content";

vi.mock("../../platform/overlay/app-chrome", () => ({ animateOverlayAppClose: (_root: unknown, done: () => void) => done() }));
let resolveWrite: (() => void) | undefined;
function deferredWrite(): Promise<void> { return new Promise((resolve) => { resolveWrite = resolve; }); }

afterEach(() => { dispose(); resolveWrite = undefined; vi.unstubAllGlobals(); });

describe("Wiki Sidebar navigation lifecycle", () => {
  for (const [label, stop] of [["close", close], ["dispose", dispose]] as const) {
    it(`does not mount after ${label} while its URL write is pending`, async () => {
      const createElement = vi.fn(() => { throw new Error("stale navigation rendered"); });
      vi.stubGlobal("chrome", { storage: { local: { set: deferredWrite } } });
      vi.stubGlobal("document", { createElement });
      __testing.activate(new AbortController().signal);
      const navigation = openWikiUrl("https://wiki.remilia.org/Remilia");
      stop(); resolveWrite?.(); await navigation;
      expect(createElement).not.toHaveBeenCalled();
    });
  }
  it("does not let a disposed activation mount into its replacement", async () => {
    const createElement = vi.fn(() => { throw new Error("stale activation rendered"); });
    vi.stubGlobal("chrome", { storage: { local: { set: deferredWrite } } });
    vi.stubGlobal("document", { createElement });
    __testing.activate(new AbortController().signal);
    const stale = openWikiUrl("https://wiki.remilia.org/Old");
    dispose(); __testing.activate(new AbortController().signal);
    resolveWrite?.(); await stale;
    expect(createElement).not.toHaveBeenCalled();
  });
});
