import { describe, expect, it, vi } from "vitest";
import { DockPointerInteraction, type DockPointerHandlers } from "./dock-pointer-interaction";

describe("DockPointerInteraction", () => {
  it("owns long-press, movement, commit, pointer capture, and listener cleanup", () => {
    const fixture = createFixture();
    fixture.pointer.start(pointer(7, 10), "a", fixture.target);
    expect(fixture.target.setPointerCapture).toHaveBeenCalledWith(7);
    fixture.fireTimer();
    expect(fixture.actions.setReorderMode).toHaveBeenCalledWith(true);
    fixture.handlers.move(pointer(7, 20), "b");
    expect(fixture.actions.moveBefore).toHaveBeenCalledWith("a", "b");
    fixture.handlers.end(pointer(7, 20));
    expect(fixture.target.releasePointerCapture).toHaveBeenCalledWith(7);
    expect(fixture.actions.commitOrder).toHaveBeenCalledOnce();
    expect(fixture.actions.suppressNextClick).toHaveBeenCalledOnce();
    expect(fixture.actions.setReorderMode).toHaveBeenLastCalledWith(false);
    expect(fixture.unlisten).toHaveBeenCalledOnce();
  });

  it("cancels timers and listeners idempotently without committing", () => {
    const fixture = createFixture();
    fixture.pointer.start(pointer(4, 0), "a", fixture.target);
    fixture.pointer.dispose();
    fixture.pointer.dispose();
    expect(fixture.clearTimer).toHaveBeenCalledOnce();
    expect(fixture.target.releasePointerCapture).toHaveBeenCalledOnce();
    expect(fixture.unlisten).toHaveBeenCalledOnce();
    expect(fixture.actions.commitOrder).not.toHaveBeenCalled();
  });

  it("ignores other pointers and movement below the drag threshold", () => {
    const fixture = createFixture();
    fixture.pointer.start(pointer(1, 10), "a", fixture.target);
    fixture.handlers.move(pointer(2, 100), "b");
    fixture.handlers.move(pointer(1, 17), "b");
    expect(fixture.actions.moveBefore).not.toHaveBeenCalled();
  });

  it("does not suppress an ordinary rail click after a small scroll-like drag", () => {
    const fixture = createFixture();
    fixture.pointer.start(pointer(1, 10), "a", fixture.target);
    fixture.handlers.move(pointer(1, 24), null);
    fixture.handlers.end(pointer(1, 24));
    expect(fixture.actions.suppressNextClick).not.toHaveBeenCalled();
    expect(fixture.actions.commitOrder).not.toHaveBeenCalled();
  });
});

function createFixture() {
  let timer: (() => void) | null = null;
  let handlers!: DockPointerHandlers;
  const unlisten = vi.fn();
  const clearTimer = vi.fn();
  let reorderMode = false;
  const actions = {
    getReorderMode: vi.fn(() => reorderMode),
    setReorderMode: vi.fn((active: boolean) => { reorderMode = active; }),
    moveBefore: vi.fn(),
    commitOrder: vi.fn(),
    suppressNextClick: vi.fn(),
  };
  const pointer = new DockPointerInteraction({
    scheduleLongPress: (callback) => { timer = callback; return clearTimer; },
    listen: (next) => { handlers = next; return unlisten; },
  }, actions);
  const target = { setPointerCapture: vi.fn(), releasePointerCapture: vi.fn() };
  return { pointer, actions, target, handlers: new Proxy({}, { get: (_, key) => handlers[key as keyof typeof handlers] }) as typeof handlers, unlisten, clearTimer, fireTimer: () => timer?.() };
}

function pointer(pointerId: number, clientY: number) {
  return { pointerId, clientX: 20, clientY };
}
