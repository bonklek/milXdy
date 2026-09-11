import { describe, expect, it, vi } from "vitest";
import { selectFullScanWindow } from "./twitter-scanner";

describe("Twitter scanner full-pass fairness", () => {
  it("delivers a stationary DOM suffix on the next bounded pass", () => {
    const first = selectFullScanWindow([1, 2, 3], 2, 0);
    const second = selectFullScanWindow([1, 2, 3], 2, first.nextCursor);
    expect(first.items).toEqual([1, 2]);
    expect(second.items).toEqual([3, 1]);
  });

  it("emits the suffix through actual scheduled scans and flushes", async () => {
    vi.resetModules();
    class SurfaceElement {
      isConnected = true;
      constructor(readonly id: string) {}
      matches(selector: string) { return selector === 'article[data-testid="tweet"]'; }
    }
    const frames: Array<FrameRequestCallback> = [];
    const nodes = [new SurfaceElement("first"), new SurfaceElement("second"), new SurfaceElement("suffix")];
    vi.stubGlobal("HTMLElement", SurfaceElement);
    vi.stubGlobal("Element", SurfaceElement);
    vi.stubGlobal("window", {
      setTimeout: () => 1, clearTimeout: vi.fn(), setInterval: () => 1, clearInterval: vi.fn(),
      requestAnimationFrame: (callback: FrameRequestCallback) => { frames.push(callback); return frames.length; },
      cancelAnimationFrame: vi.fn(), addEventListener: vi.fn(), removeEventListener: vi.fn(),
    });
    vi.stubGlobal("document", { body: {}, hidden: false, querySelectorAll: () => nodes, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal("location", { pathname: "/home" });
    vi.stubGlobal("MutationObserver", class { observe() {} disconnect() {} });
    let unsubscribe = () => {};
    try {
      const scanner = await import("./twitter-scanner");
      scanner.configureTwitterScanner({ surfaceKinds: ["tweet"], maxSurfacesPerFullScan: 2, safetyScanIntervalMs: null });
      const seen: string[] = [];
      unsubscribe = scanner.subscribeTwitterSurfaces((surface) => { seen.push(surface.element.id); });
      while (frames.length) frames.shift()!(0);
      expect(seen).toEqual(["first", "second"]);
      scanner.scheduleTwitterScan();
      while (frames.length) frames.shift()!(0);
      expect(seen).toEqual(["first", "second", "suffix", "first"]);
      expect(scanner.getTwitterScannerCounters().lastFullScanDropped).toBe(1);
    } finally {
      unsubscribe();
      vi.unstubAllGlobals();
    }
  });
});
