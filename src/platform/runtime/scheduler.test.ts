import { describe, expect, it } from "vitest";
import { createActivationScheduler } from "./scheduler";

describe("activation scheduler", () => {
  it("cancels pending work on the owning app abort and rejects later scheduling", () => {
    const callbacks: Array<() => void> = [];
    const cancelled: number[] = [];
    const shared = {
      idle(callback: () => void) {
        const index = callbacks.push(callback) - 1;
        return () => cancelled.push(index);
      },
      timeout(callback: () => void) {
        const index = callbacks.push(callback) - 1;
        return () => cancelled.push(index);
      },
    };
    const controller = new AbortController();
    const disposables: Array<() => void> = [];
    const scheduler = createActivationScheduler(shared, controller.signal, (disposable) => {
      disposables.push(typeof disposable === "function" ? disposable : () => disposable.dispose());
    });
    const events: string[] = [];

    scheduler.idle(() => events.push("idle"));
    scheduler.timeout(() => events.push("timeout"), 1);
    controller.abort();
    callbacks.forEach((callback) => callback());

    expect(events).toEqual([]);
    expect(cancelled).toEqual([0, 1]);
    expect(() => scheduler.idle(() => undefined)).toThrow(/App activation has ended/);
    disposables.forEach((dispose) => dispose());
  });
});
