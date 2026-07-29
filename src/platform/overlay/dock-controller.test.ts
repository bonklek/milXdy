import { describe, expect, it, vi } from "vitest";
import { OverlayDockController } from "./dock-controller";
import type { DockPersistencePort, DockSnapshot, DockViewActions, DockViewPort, OverlayDockItem } from "./dock-types";

describe("OverlayDockController", () => {
  it("shares one deferred load and mounts registered items only after storage resolves", async () => {
    const fixture = createFixture();
    const first = item("a");
    const second = item("b");
    fixture.controller.register(first);
    fixture.controller.register(second);
    expect(fixture.persistence.load).toHaveBeenCalledOnce();
    expect(fixture.view.mount).not.toHaveBeenCalled();
    fixture.resolveLoad({ side: "left", order: ["b", "a"] });
    await tick();
    expect(fixture.view.mount).toHaveBeenCalledTimes(2);
    expect(fixture.controller.getSide()).toBe("left");
    expect(fixture.controller.getAppOrder()).toEqual(["b", "a"]);
    expect(fixture.stackOrders.at(-1)).toEqual(["b", "a"]);
  });

  it("does not mount a registration removed while storage is in flight", async () => {
    const fixture = createFixture();
    const registration = fixture.controller.register(item("a"));
    registration.remove();
    fixture.resolveLoad({ side: "right", order: [] });
    await tick();
    expect(fixture.view.mount).not.toHaveBeenCalled();
  });

  it("continues only the current registration when an id is removed and re-registered during load", async () => {
    const fixture = createFixture();
    const oldSideChange = vi.fn();
    const newSideChange = vi.fn();
    const oldRegistration = fixture.controller.register(item("a", { onSideChange: oldSideChange }));
    oldRegistration.remove();
    fixture.controller.register(item("a", { onSideChange: newSideChange }));
    fixture.resolveLoad({ side: "left", order: [] });
    await tick();
    expect(fixture.view.mount).toHaveBeenCalledOnce();
    expect(oldSideChange).not.toHaveBeenCalled();
    expect(newSideChange).toHaveBeenCalledTimes(2);
    oldRegistration.update({ label: "stale" });
    oldRegistration.remove();
    expect(fixture.controller.getAppOrder()).toEqual(["a"]);
  });

  it("uses the latest live registration update when storage resolves", async () => {
    const fixture = createFixture();
    const oldSideChange = vi.fn();
    const updatedSideChange = vi.fn();
    const registration = fixture.controller.register(item("a", { onSideChange: oldSideChange }));
    registration.update({ onSideChange: updatedSideChange });
    fixture.resolveLoad({ side: "left", order: [] });
    await tick();
    expect(oldSideChange).not.toHaveBeenCalled();
    expect(updatedSideChange).toHaveBeenCalledTimes(2);
  });

  it("ignores a replaced registration when the shared storage load rejects", async () => {
    const fixture = createFixture();
    const oldSideChange = vi.fn();
    const newSideChange = vi.fn();
    const oldRegistration = fixture.controller.register(item("a", { onSideChange: oldSideChange }));
    oldRegistration.remove();
    fixture.controller.register(item("a", { onSideChange: newSideChange }));
    fixture.rejectLoad(new Error("unavailable"));
    await tick();
    expect(fixture.view.mount).toHaveBeenCalledOnce();
    expect(oldSideChange).not.toHaveBeenCalled();
    expect(newSideChange).toHaveBeenCalledOnce();
  });

  it("mounts with defaults after a storage failure", async () => {
    const fixture = createFixture();
    fixture.controller.register(item("a"));
    fixture.rejectLoad(new Error("unavailable"));
    await tick();
    expect(fixture.controller.getSide()).toBe("right");
    expect(fixture.view.mount).toHaveBeenCalledOnce();
  });

  it("reconciles an empty stored order before settings-button reorder and persistence", async () => {
    const fixture = createFixture();
    fixture.controller.register(item("a"));
    fixture.controller.register(item("b"));
    fixture.resolveLoad({ side: "right", order: [] });
    await tick();
    fixture.latestActions().moveBy("b", -1);
    expect(fixture.controller.getAppOrder()).toEqual(["b", "a"]);
    expect(fixture.persistence.saveOrder).toHaveBeenLastCalledWith(["b", "a"]);
  });

  it("reconciles missing registrations in a partial stored order before drag commit", async () => {
    const fixture = createFixture();
    fixture.controller.register(item("a"));
    fixture.controller.register(item("b"));
    fixture.controller.register(item("c"));
    fixture.resolveLoad({ side: "right", order: ["b"] });
    await tick();
    const actions = fixture.latestActions();
    actions.moveBefore("c", "b");
    actions.commitOrder();
    expect(fixture.controller.getAppOrder()).toEqual(["c", "b", "a"]);
    expect(fixture.persistence.saveOrder).toHaveBeenLastCalledWith(["c", "b", "a"]);
  });

  it("keeps public registration, side, hidden, action, and order behavior behind the view port", async () => {
    const fixture = createFixture({ immediate: true });
    const activate = vi.fn();
    const deactivate = vi.fn();
    const registration = fixture.controller.register(item("a", { active: true, onActivate: activate, onDeactivate: deactivate }));
    fixture.controller.register(item("utility", { stackable: false }));
    await tick();
    const actions = fixture.latestActions();
    actions.activate("a");
    expect(deactivate).toHaveBeenCalledOnce();
    fixture.controller.setSide("left");
    expect(fixture.persistence.saveSide).toHaveBeenCalledWith("left");
    fixture.controller.setHiddenItems(["a"]);
    fixture.controller.setAppOrder(["a"]);
    expect(fixture.controller.getAppOrder()).toEqual(["a"]);
    expect(fixture.persistence.saveOrder).toHaveBeenCalled();
    registration.update({ label: "renamed" });
    registration.remove();
    expect(fixture.controller.getAppOrder()).toEqual([]);
  });

  it("disposes owned state and view exactly once, including during an in-flight load", async () => {
    const fixture = createFixture();
    fixture.controller.register(item("a"));
    fixture.controller.dispose();
    fixture.controller.dispose();
    fixture.resolveLoad({ side: "left", order: ["a"] });
    await tick();
    expect(fixture.view.dispose).toHaveBeenCalledOnce();
    expect(fixture.view.mount).not.toHaveBeenCalled();
    fixture.controller.register(item("b"));
    expect(fixture.controller.getAppOrder()).toEqual([]);
  });

  it("makes every captured view action inert after disposal", async () => {
    const fixture = createFixture({ immediate: true });
    fixture.controller.register(item("a"));
    fixture.controller.setSettingsAction("utility", { label: "Utility", onActivate: vi.fn() });
    await tick();
    const actions = fixture.latestActions();
    fixture.controller.dispose();
    vi.mocked(fixture.persistence.saveOrder).mockClear();
    vi.mocked(fixture.persistence.saveSide).mockClear();
    vi.mocked(fixture.view.render).mockClear();
    actions.activate("a");
    actions.moveBefore("a", "b");
    actions.moveBy("a", 1);
    actions.setReorderMode(true);
    actions.setReorderMode(false);
    actions.resetOrder();
    actions.commitOrder();
    actions.setSide("left");
    actions.invokeSettingsAction("utility");
    expect(fixture.persistence.saveOrder).not.toHaveBeenCalled();
    expect(fixture.persistence.saveSide).not.toHaveBeenCalled();
    expect(fixture.view.render).not.toHaveBeenCalled();
    expect(fixture.controller.getAppOrder()).toEqual([]);
  });
});

function createFixture(options: { immediate?: boolean } = {}) {
  let resolveLoad!: (value: { side: "left" | "right"; order: string[] }) => void;
  let rejectLoad!: (reason: unknown) => void;
  const loadPromise = options.immediate
    ? Promise.resolve({ side: "right" as const, order: [] })
    : new Promise<{ side: "left" | "right"; order: string[] }>((resolve, reject) => { resolveLoad = resolve; rejectLoad = reject; });
  const persistence: DockPersistencePort = { load: vi.fn(() => loadPromise), saveSide: vi.fn(), saveOrder: vi.fn() };
  let actions: DockViewActions | null = null;
  const view: DockViewPort = {
    mount: vi.fn(),
    render: vi.fn((_snapshot: DockSnapshot, nextActions: DockViewActions) => { actions = nextActions; }),
    createSettingsPanel: vi.fn(() => ({}) as HTMLElement),
    dispose: vi.fn(),
  };
  const stackOrders: string[][] = [];
  const controller = new OverlayDockController({ persistence, view, setStackOrder: (ids) => stackOrders.push([...ids]) });
  return { controller, persistence, view, stackOrders, resolveLoad, rejectLoad, latestActions: () => actions! };
}

function item(id: string, overrides: Partial<OverlayDockItem> = {}): OverlayDockItem {
  return { id, label: id, icon: id, onActivate: vi.fn(), ...overrides };
}

async function tick(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
