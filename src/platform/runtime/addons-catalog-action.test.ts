import { afterEach, describe, expect, it, vi } from "vitest";
import { registerAddonsCatalogAction } from "./addons-catalog-action";
import type { OverlayDockApi, OverlayDockItem } from "../overlay/dock-types";
afterEach(() => vi.useRealTimers());
function fixture() {
  let item!: OverlayDockItem;
  let now = 0;
  const update = vi.fn(); const remove = vi.fn(); const cue = vi.fn(); const feedback = vi.fn();
  const send = vi.fn<() => Promise<unknown>>().mockResolvedValue({ ok: true });
  const dock: Pick<OverlayDockApi, "register"> = { register: (value: OverlayDockItem) => { item = value; return { update, remove }; } };
  const registration = registerAddonsCatalogAction({ dock, send, playCue: cue, feedback, now: () => now });
  return { activate: () => item.onActivate(), next: () => { now += 1000; }, registration, update, remove, cue, feedback, send };
}
const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
describe("catalog rail action", () => {
  it("deduplicates pending requests and rapid clicks, including sound; reports result", async () => {
    const f = fixture(); let resolve!: (value: unknown) => void;
    f.send.mockImplementation(() => new Promise(r => { resolve = r; }));
    f.activate(); f.activate(); f.next(); f.activate();
    expect(f.send).toHaveBeenCalledOnce(); expect(f.cue).toHaveBeenCalledOnce();
    expect(f.update).toHaveBeenCalledWith(expect.objectContaining({ badgeText: "…" }));
    resolve({ ok: true }); await settle();
    expect(f.feedback).toHaveBeenLastCalledWith("Add-ons catalog opened in a browser tab.", false);
    f.activate(); await settle(); f.activate();
    expect(f.send).toHaveBeenCalledTimes(2);
    expect(f.cue).toHaveBeenCalledTimes(2);
    f.registration.remove(); resolve({ ok: true }); await settle();
  });
  it("allows retry after failures, rejects malformed success and survives audio rejection", async () => {
    const f = fixture(); f.cue.mockImplementation(() => { throw new Error("audio denied"); });
    f.send.mockRejectedValueOnce(new Error("private"));
    f.activate(); await settle();
    expect(f.feedback).toHaveBeenLastCalledWith(expect.stringContaining("Select + to try again"), true);
    expect(JSON.stringify(f.feedback.mock.calls)).not.toContain("private");
    f.next(); f.send.mockResolvedValue({ ok: "true" }); f.activate(); await settle();
    expect(f.feedback).toHaveBeenLastCalledWith(expect.any(String), true);
    f.next(); f.send.mockResolvedValue({ ok: true }); f.activate(); await settle();
    expect(f.feedback).toHaveBeenLastCalledWith(expect.stringContaining("opened"), false);
  });
  it("bounds an unanswered request and suppresses late/disposed feedback", async () => {
    vi.useFakeTimers(); const f = fixture();
    let resolve!: (value: unknown) => void;
    f.send.mockImplementation(() => new Promise(r => { resolve = r; }));
    f.activate(); await vi.advanceTimersByTimeAsync(15000);
    expect(f.feedback).toHaveBeenLastCalledWith(expect.any(String), true);
    f.registration.remove(); f.feedback.mockClear();
    resolve({ ok: true }); await settle(); f.next(); f.activate();
    expect(f.feedback).not.toHaveBeenCalled();
    expect(f.remove).toHaveBeenCalledOnce();
  });
});
