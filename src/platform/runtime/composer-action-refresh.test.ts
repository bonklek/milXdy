import { describe, expect, it } from "vitest";
import { createComposerActionRefreshScheduler } from "./composer-action-refresh";

describe("createComposerActionRefreshScheduler", () => {
  it("coalesces a mutation burst into one refresh", () => {
    let nextHandle = 0;
    const pending = new Map<number, () => void>();
    let refreshes = 0;
    const scheduler = createComposerActionRefreshScheduler(
      () => { refreshes += 1; },
      {
        setTimeout: (callback) => {
          nextHandle += 1;
          pending.set(nextHandle, callback);
          return nextHandle;
        },
        clearTimeout: (handle) => { pending.delete(handle); },
      },
    );

    for (let index = 0; index < 500; index += 1) scheduler.request();
    expect(pending.size).toBe(1);
    pending.values().next().value?.();
    expect(refreshes).toBe(1);
  });

  it("cancels a queued refresh when the runtime is disposed", () => {
    let nextHandle = 0;
    const pending = new Map<number, () => void>();
    let refreshes = 0;
    const scheduler = createComposerActionRefreshScheduler(
      () => { refreshes += 1; },
      {
        setTimeout: (callback) => {
          nextHandle += 1;
          pending.set(nextHandle, callback);
          return nextHandle;
        },
        clearTimeout: (handle) => { pending.delete(handle); },
      },
    );

    scheduler.request();
    scheduler.dispose();
    expect(pending.size).toBe(0);
    expect(refreshes).toBe(0);
  });
});
