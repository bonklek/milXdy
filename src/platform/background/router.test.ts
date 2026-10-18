import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers();
  vi.stubGlobal("chrome", {
    runtime: { onMessage: { addListener: vi.fn() } },
    storage: {
      local: { get: vi.fn(async () => ({})), set: vi.fn(async () => undefined) },
      onChanged: { addListener: vi.fn() },
    },
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("background router failure recovery", () => {
  it("responds to synchronous handler failures and keeps the channel open", async () => {
    const { setupBackgroundMessageRouter, objectMessage } = await import("./router");
    setupBackgroundMessageRouter([{
      type: "test:throw",
      matches: objectMessage("test:throw"),
      handle: () => { throw new Error("handler failed"); },
    }]);
    const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0];
    const sendResponse = vi.fn();
    expect(listener({ type: "test:throw" }, {}, sendResponse)).toBe(true);
    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalledWith({ ok: false, status: 0, error: "handler failed" }));
    expect(listener({ type: "unknown" }, {}, sendResponse)).toBe(false);
  });

  it("rejects immediate synchronous throws without leaking queue slots", async () => {
    const { runNetworkTask } = await import("./router");
    for (let i = 0; i < 12; i += 1) {
      await expect(runNetworkTask(() => { throw new Error("task failed"); })).rejects.toThrow("task failed");
    }
    await expect(runNetworkTask(async () => "recovered")).resolves.toBe("recovered");
  });

  it("settles queued synchronous throws and drains work behind them", async () => {
    const { runNetworkTask, initializeBackgroundNetworkBudget } = await import("./router");
    await initializeBackgroundNetworkBudget();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    const blockers = Array.from({ length: 12 }, () => runNetworkTask(async () => { await gate; }));
    const failure = runNetworkTask(() => { throw new Error("queued task failed"); });
    const rejected = expect(failure).rejects.toThrow("queued task failed");
    const following = runNetworkTask(async () => "next");
    release();
    await Promise.all(blockers);
    await rejected;
    await expect(following).resolves.toBe("next");
  });
});
