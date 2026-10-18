import { afterEach, describe, expect, it, vi } from "vitest";
type AppWindowCreateOptions = { initialBounds?: { width?: number; height?: number; top?: number }; content: HTMLElement };

vi.mock("../../platform/overlay/app-frame", () => ({
  createOverlayAppFrame: () => ({ remove() {}, updateDock() {} }),
}));
vi.mock("../../platform/overlay/app-chrome", () => ({
  ensureOverlayAppChromeStyles() {},
  prepareOverlayAppRoot() {},
}));
vi.mock("../../platform/overlay/panel-base", () => ({
  resolveOverlayPanelTheme: () => "light",
  observeOverlayPanelTheme: () => () => {},
}));
import { boot, dispose } from "./content";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((next) => { resolve = next; });
  return { promise, resolve };
}

function element() {
  const attributes = new Map<string, string>();
  return { id: "", className: "", dataset: {}, style: {}, isConnected: false, setAttribute(name: string, value: string) { attributes.set(name, value); }, getAttribute(name: string) { return attributes.get(name) || null; }, addEventListener() {}, appendChild() {}, remove() {} };
}

afterEach(() => {
  dispose();
  vi.unstubAllGlobals();
});

describe("Link Browser managed-window boot", () => {
  it("migrates legacy geometry and last URL before creating its managed window", async () => {
    const stored = deferred<Record<string, unknown>>();
    let created: AppWindowCreateOptions | undefined;
    vi.stubGlobal("chrome", { runtime: { getURL: (path: string) => path } });
    vi.stubGlobal("document", {
      document: { documentElement: { appendChild() {} }, getElementById: () => null, createElement: element, addEventListener() {}, removeEventListener() {} },
    }.document);
    const context: any = {
      signal: new AbortController().signal,
      storage: { local: { get: () => stored.promise, set: async () => {}, onChanged: () => () => {} } },
      resolveAssetUrl: (path: string) => path,
      addDisposable() {},
      windows: { create: (options: AppWindowCreateOptions) => {
        created = options;
        return { open() {}, close() {}, focus() {}, dispose() {}, element: element(), isOpen: false };
      } },
    };
    const started = boot(context);
    stored.resolve({
      "milxdy.linkBrowser.width": 640,
      "milxdy.linkBrowser.height": 510,
      "milxdy.linkBrowser.top": 33,
      "milxdy.linkBrowser.lastUrl": "https://example.com/read",
    });
    await started;
    expect(created).toBeDefined();
    expect(created!.initialBounds).toMatchObject({ width: 640, height: 510, top: 33 });
    expect(created!.content.getAttribute("aria-label")).toBe("Link browser");
  });

  it("does not create a window after disposal during the storage read", async () => {
    const stored = deferred<Record<string, unknown>>();
    let creates = 0;
    const context: any = { signal: new AbortController().signal, storage: { local: { get: () => stored.promise } }, resolveAssetUrl: () => "", addDisposable() {}, windows: { create: () => { creates += 1; return {}; } } };
    const started = boot(context);
    dispose();
    stored.resolve({});
    await started;
    expect(creates).toBe(0);
  });
});
