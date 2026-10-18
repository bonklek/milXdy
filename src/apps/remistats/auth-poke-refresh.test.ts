import { describe, expect, it, vi, afterEach } from "vitest";
import { refreshPokeAuthentication } from "./auth-poke-refresh";
afterEach(() => vi.unstubAllGlobals());

function harness() {
  const status = { enabled: true };
  const existingBadgePost = { badge: true };
  const quoteChild = { quoteChild: true };
  const button = { remove: vi.fn() };
  const group = {};
  const processSurfaceElement = vi.fn();
  const fillActionPokeSlot = vi.fn();
  const confirmedPokeTargets = new Map([["member", "old-account"]]);
  const pokeTargetLatestRequests = new Map([["member", 1]]);
  const globals = {
    lifecycleActive: () => true,
    isEnabled: () => status.enabled,
    confirmedPokeTargets, pokeTargetLatestRequests,
    document: { querySelectorAll: (selector: string) => selector === '[data-reminet-poke]' ? [button]
      : selector === '[data-reminet-action-poke-group]' ? [group] : [existingBadgePost, quoteChild] },
    fillActionPokeSlot,
    runtimeScheduler: { timeout: (callback: () => void) => callback() },
    surfaceIsInsideQuoteTweet: (node: unknown) => (node as { quoteChild?: boolean }).quoteChild === true,
    remistatsReconciliationPolicy: () => ({ limit: 96 }),
    processSurfaceElement,
    insertProfileBadge: vi.fn(),
  };
  vi.stubGlobal("document", globals.document);
  const listener = (changes: Record<string, unknown>, area: string) => {
    if (area === "local" && changes["milxdy.remiliaAuth.control.v1"]) refreshPokeAuthentication(globals);
  };
  return { listener, globals, button, group, existingBadgePost, processSurfaceElement, status };
}

describe("poke controls after account changes", () => {
  it("invalidates old confirmations and revisits posts that already have badges", () => {
    const h = harness();
    h.listener({ 'milxdy.remiliaAuth.control.v1': { newValue: { disconnected: false } } }, 'local');
    expect(h.globals.confirmedPokeTargets.size).toBe(0);
    expect(h.globals.pokeTargetLatestRequests.size).toBe(0);
    expect(h.button.remove).toHaveBeenCalledOnce();
    expect(h.globals.fillActionPokeSlot).toHaveBeenCalledWith(h.group, '');
    expect(h.processSurfaceElement).toHaveBeenCalledExactlyOnceWith(h.existingBadgePost);
    expect(h.globals.insertProfileBadge).toHaveBeenCalledOnce();
  });
  it("removes old action controls immediately on logout too", () => {
    const h = harness();
    h.listener({ 'milxdy.remiliaAuth.control.v1': { newValue: { disconnected: true } } }, 'local');
    expect(h.button.remove).toHaveBeenCalledOnce();
    expect(h.globals.confirmedPokeTargets.size).toBe(0);
  });
  it("does not revisit surfaces after disable while the delayed refresh is pending", () => {
    const h = harness(); let callback!: () => void;
    h.globals.runtimeScheduler.timeout = (work: () => void) => { callback = work; };
    h.listener({ 'milxdy.remiliaAuth.control.v1': { newValue: {} } }, 'local');
    h.status.enabled = false;
    // The injected getter reflects current state, rather than the earlier snapshot.
    callback();
    expect(h.processSurfaceElement).not.toHaveBeenCalled();
  });
  it("does not inspect credential storage or react to unrelated preference changes", () => {
    const h = harness();
    h.listener({ 'unrelated.preference': { newValue: true } }, 'local');
    expect(h.button.remove).not.toHaveBeenCalled();
    expect(h.processSurfaceElement).not.toHaveBeenCalled();
  });
});
