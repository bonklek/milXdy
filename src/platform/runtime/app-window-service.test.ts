import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAppWindowService } from "./app-window-service";

const mocks = vi.hoisted(() => ({ cancel: vi.fn(), restore: vi.fn(), drag: vi.fn(), resize: vi.fn(), raise: vi.fn() }));
vi.mock("../overlay/app-chrome", () => ({ markOverlayAppLayoutReady: vi.fn() }));
vi.mock("../overlay/app-layout", () => ({ registerOverlayAppRoot: vi.fn(), bringOverlayAppToFront: mocks.raise }));
vi.mock("../overlay/panel-base", () => ({
  cancelOverlayPanelPointerSession: mocks.cancel,
  clampOverlayPanelBox: (box: unknown) => box,
  restoreOverlayPanelBox: mocks.restore,
  startOverlayPanelDrag: mocks.drag,
  startOverlayPanelResize: mocks.resize,
}));
vi.mock("./app-window-view", () => ({
  createAppWindowView: (options: { content: HTMLElement }) => {
    const root = document.createElement("section");
    root.hidden = true;
    const header = document.createElement("header");
    const closeButton = document.createElement("button");
    header.append(closeButton);
    root.append(header, options.content);
    return { root, header, closeButton };
  },
}));

// A small event/focus model exercises the service, with only layout/DOM construction mocked.
class ElementModel extends EventTarget {
  children: ElementModel[] = [];
  parent: ElementModel | null = null;
  dataset: Record<string, string> = {};
  style: Record<string, string> = {};
  hidden = false;
  constructor(readonly tag: string) { super(); }
  get isConnected(): boolean { return this === page.body || this.parent?.isConnected === true; }
  append(...children: ElementModel[]) { children.forEach((child) => { child.parent = this; this.children.push(child); }); }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter((child) => child !== this); this.parent = null; }
  setAttribute() {}
  contains(element: ElementModel | null): boolean { return this === element || this.children.some((child) => child.contains(element)); }
  closest(tag: string): ElementModel | null { return this.tag === tag ? this : this.parent?.closest(tag) ?? null; }
  querySelector(): ElementModel | null { return this.children.flatMap((child) => [child, ...child.children]).find((child) => child.tag === "button") ?? null; }
  focus() { page.activeElement = this; }
}
let page: { body: ElementModel; activeElement: ElementModel | null; createElement: (tag: string) => ElementModel };
let host: EventTarget;
let controller: AbortController;
let cleanup: Array<() => void>;
function create(id: string, persistKey?: string) {
  return createAppWindowService("pilot", controller.signal, (disposable) => cleanup.push(typeof disposable === "function" ? disposable : () => disposable.dispose()))
    .create({ id, title: id, content: page.createElement("input") as unknown as HTMLElement, persistKey });
}
function escape() { const event = new Event("keydown", { cancelable: true }); Object.assign(event, { key: "Escape" }); host.dispatchEvent(event); }

beforeEach(() => {
  vi.clearAllMocks();
  page = { body: new ElementModel("body"), activeElement: null, createElement: (tag) => new ElementModel(tag) };
  host = new EventTarget(); controller = new AbortController(); cleanup = [];
  vi.stubGlobal("document", page); vi.stubGlobal("window", host); vi.stubGlobal("HTMLElement", ElementModel);
});
afterEach(() => { cleanup.forEach((dispose) => dispose()); vi.unstubAllGlobals(); });

describe("managed app window lifecycle", () => {
  it("stays hidden until opened, restores focus and removes resources on abort", () => {
    const launch = page.createElement("button"); page.body.append(launch); launch.focus();
    const handle = create("one");
    expect(handle.element.hidden).toBe(true);
    handle.open(); expect(handle.isOpen).toBe(true); expect(handle.element.hidden).toBe(false);
    controller.abort();
    expect(handle.isOpen).toBe(false); expect(handle.element.isConnected).toBe(false);
    expect(page.activeElement).toBe(launch); expect(mocks.cancel).toHaveBeenCalledWith(handle.element);
    expect(() => create("late")).toThrow(/activation has ended/);
  });

  it("closes only the focused window when Escape restores focus to another window", () => {
    const first = create("first"); const second = create("second");
    second.open(); first.open();
    escape();
    expect(first.isOpen).toBe(false); expect(second.isOpen).toBe(true);
  });

  it("raises on pointer interaction without stealing input focus", () => {
    const handle = create("form"); handle.open();
    const root = handle.element as unknown as ElementModel;
    const input = root.children[1]; input.focus();
    root.dispatchEvent(new Event("pointerdown"));
    expect(page.activeElement).toBe(input); expect(mocks.raise).toHaveBeenCalled();
  });

  it("does not restore persisted bounds after a drag or disposal", async () => {
    let resolve!: (box: unknown) => void;
    mocks.restore.mockImplementation(() => new Promise((done) => { resolve = done; }));
    const handle = create("position", "main"); handle.open();
    const root = handle.element as unknown as ElementModel;
    root.children[0].dispatchEvent(new Event("pointerdown"));
    const drag = mocks.drag.mock.calls[0][1]; drag.setBox({ width: 777 }); drag.apply();
    resolve({ width: 222, height: 333, topOffset: 4 }); await Promise.resolve();
    expect(root.style.width).toBe("777px");
    handle.close(); expect(mocks.cancel).toHaveBeenCalledWith(root);
    const other = create("disposed", "second"); other.dispose();
    resolve({ width: 222, height: 333, topOffset: 4 }); await Promise.resolve();
    expect(other.element.isConnected).toBe(false);
  });
});
