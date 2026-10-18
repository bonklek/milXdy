import { afterEach, describe, expect, it, vi } from "vitest";
import { LEGACY_CHAT_ID, LEGACY_MUTATION_ACK_TIMEOUT_MS } from "./legacy-adapters";
import { LegacyMutationDispatcher } from "./legacy-mutation-dispatcher";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("LegacyMutationDispatcher", () => {
  const mutation = { type: "submit", payload: { chat_id: LEGACY_CHAT_ID, text: "caption", media_ids: [7] } } as const;

  it("resolves only the matching validated transport acknowledgement", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "2f57c4fc-6597-4ae5-9f46-c5996235dce1" });
    const postMessage = vi.fn();
    const dispatcher = new LegacyMutationDispatcher();
    const pending = dispatcher.dispatch({ postMessage } as unknown as chrome.runtime.Port, mutation);

    expect(postMessage).toHaveBeenCalledWith({
      type: "mutate",
      requestId: "2f57c4fc-6597-4ae5-9f46-c5996235dce1",
      mutation,
    });
    expect(dispatcher.accept({
      type: "socket:mutation-sent",
      requestId: "2f57c4fc-6597-4ae5-9f46-c5996235dce1",
      at: 1,
    })).toBe(true);
    await expect(pending).resolves.toEqual({ ok: true });
  });

  it("times out with a stable redacted failure and rejects pending work on disconnect", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("crypto", { randomUUID: () => "2f57c4fc-6597-4ae5-9f46-c5996235dce1" });
    const dispatcher = new LegacyMutationDispatcher();
    const timedOut = dispatcher.dispatch({ postMessage: vi.fn() } as unknown as chrome.runtime.Port, mutation);
    await vi.advanceTimersByTimeAsync(LEGACY_MUTATION_ACK_TIMEOUT_MS);
    await expect(timedOut).resolves.toEqual({ ok: false, error: "LEGACY_MEDIA_SUBMIT_REJECTED", retryable: true });

    const disconnected = dispatcher.dispatch({ postMessage: vi.fn() } as unknown as chrome.runtime.Port, mutation);
    dispatcher.rejectAll();
    await expect(disconnected).resolves.toEqual({ ok: false, error: "LEGACY_MEDIA_SUBMIT_UNAVAILABLE", retryable: true });
  });

  it("fails closed when a request identifier cannot be generated", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => { throw new Error("private runtime detail"); } });
    const dispatcher = new LegacyMutationDispatcher();
    await expect(dispatcher.dispatch({ postMessage: vi.fn() } as unknown as chrome.runtime.Port, mutation)).resolves.toEqual({
      ok: false,
      error: "LEGACY_MEDIA_SUBMIT_UNAVAILABLE",
      retryable: true,
    });
  });
});
