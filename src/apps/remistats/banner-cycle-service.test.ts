import { describe, expect, it, vi } from "vitest";
import { createBannerCycleService } from "./banner-cycle-service";
import { readBannerSettings } from "./profile-banner-sources";
function harness() {
  let settings = readBannerSettings({});
  let path = "/alice";
  const root = { dataset: { milxdyTrophyBannerUser: "alice", milxdyBannerRemiliaUser: "alice", milxdyBannerMode: "original" }, isConnected: true, querySelector: () => null } as unknown as HTMLElement;
  const deps = {
    send: vi.fn().mockResolvedValue({ ok: true, dataUrl: "data:image/png;base64,fixture" }),
    preload: vi.fn().mockResolvedValue(undefined), renderTrophy: vi.fn().mockResolvedValue("shelf.png"),
    transition: vi.fn().mockResolvedValue(undefined), toOriginal: vi.fn().mockResolvedValue(undefined),
    clearLabel: vi.fn(), setLabel: vi.fn(), cleanUsername: (value: unknown) => String(value || ""),
    runtimeUrl: (path: string) => path, playSpin: vi.fn(), settings: () => settings, pathname: () => path,
  };
  return { root, deps, service: createBannerCycleService(deps), setSettings: (value: typeof settings) => { settings = value; }, setPath: (value: string) => { path = value; } };
}
describe("merged banner source lifecycle", () => {
  it("never prefetches disabled NFT media and uses the enabled shelf", async () => {
    const h = harness(); h.setSettings({ original: false, shelf: true, nft: false });
    h.service.prefetch();
    await h.service.renderInitial(h.root, "alice", () => true);
    expect(h.deps.send).not.toHaveBeenCalled();
    expect(h.deps.transition).toHaveBeenCalledWith(h.root, "shelf", "shelf.png");
    expect(h.service.cycleAvailable()).toBe(false);
  });
  it("discards initial source work after settings invalidation", async () => {
    const h = harness(); let release!: (value: string) => void;
    h.deps.renderTrophy.mockImplementation(() => new Promise(resolve => { release = resolve; }));
    const task = h.service.renderInitial(h.root, "alice", () => true);
    h.service.invalidate(); release("stale-shelf.png"); await task;
    expect(h.deps.transition).not.toHaveBeenCalled();
    expect(h.deps.toOriginal).not.toHaveBeenCalled();
  });
  it("does not apply a delayed cycle result to another route or account", async () => {
    for (const kind of ["route", "account", "disconnected"]) {
      const h = harness(); let release!: (value: string) => void;
      h.deps.renderTrophy.mockImplementation(() => new Promise(resolve => { release = resolve; }));
      const task = h.service.cycle(h.root);
      if (kind === "route") h.setPath("/bob");
      if (kind === "account") h.root.dataset.milxdyTrophyBannerUser = "bob";
      if (kind === "disconnected") Object.defineProperty(h.root, "isConnected", { value: false });
      release("stale-shelf.png"); await task;
      expect(h.deps.transition).not.toHaveBeenCalled();
    }
  });
  it("keeps disabled original images hidden when every enabled media source fails", async () => {
    const h = harness(); h.setSettings({ original: false, shelf: true, nft: false });
    h.deps.renderTrophy.mockResolvedValue(null);
    await h.service.renderInitial(h.root, "alice", () => true);
    expect(h.deps.transition).toHaveBeenCalledWith(h.root, "blank", "");
    expect(h.deps.toOriginal).not.toHaveBeenCalled();
  });
});
