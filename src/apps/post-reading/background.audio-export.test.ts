import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const chromeMock = {
  runtime: { id: "milxdy-test" },
  storage: {
    local: {
      get: vi.fn(async () => ({ "milxdy.performance.mode": "balanced" })),
      set: vi.fn(async () => undefined),
    },
    onChanged: { addListener: vi.fn() },
  },
};

vi.stubGlobal("chrome", chromeMock);

let handlePostReadingBackgroundMessage: typeof import("./background")["handlePostReadingBackgroundMessage"];

beforeAll(async () => {
  ({ handlePostReadingBackgroundMessage } = await import("./background"));
});

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("Post-reading audio export broker", () => {
  it("actively aborts an in-flight loopback POST when the declared cancel route is called", async () => {
    let transportSignal: AbortSignal | undefined;
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      transportSignal = init?.signal || undefined;
      return new Promise<Response>((_resolve, reject) => {
        transportSignal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const sender = {
      id: "milxdy-test",
      tab: { id: 42, url: "https://example.com/article" },
      frameId: 0,
      url: "https://example.com/article",
    } as chrome.runtime.MessageSender;
    const requestId = "request-12345678";
    const pending = handlePostReadingBackgroundMessage({
      type: "post-reading:generateAudioExport",
      requestId,
      endpoint: "http://127.0.0.1:8787/tts",
      text: "Reviewed text",
      rate: 1.25,
      volume: 0.75,
      voiceURI: "local-voice",
    }, sender);

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8787/tts", expect.objectContaining({
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    }));
    expect(transportSignal?.aborted).toBe(false);
    await expect(handlePostReadingBackgroundMessage({ type: "post-reading:cancelAudioExport", requestId }, sender))
      .resolves.toMatchObject({ ok: true, canceled: true });
    expect(transportSignal?.aborted).toBe(true);
    await expect(pending).resolves.toMatchObject({ ok: false, error: "Audio generation canceled." });
  });

  it("fails a redirect response without attempting a redirected request", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 302, headers: { location: "http://localhost:9999/tts" } }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await handlePostReadingBackgroundMessage({
      type: "post-reading:generateAudioExport",
      requestId: "request-redirect-1",
      endpoint: "http://localhost:8787/tts",
      text: "Reviewed text",
      rate: 1,
      volume: 1,
      voiceURI: null,
    }, {
      id: "milxdy-test",
      tab: { id: 23, url: "https://example.com/article" },
      frameId: 0,
      url: "https://example.com/article",
    } as chrome.runtime.MessageSender);
    expect(response).toMatchObject({ ok: false, error: "Custom TTS endpoint returned HTTP 302." });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8787/tts", expect.objectContaining({
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
    }));
  });

  it("rejects remote endpoints before network access", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const response = await handlePostReadingBackgroundMessage({
      type: "post-reading:generateAudioExport",
      requestId: "request-remote-1",
      endpoint: "https://tts.example.com/generate",
      text: "Reviewed text",
      rate: 1,
      volume: 1,
      voiceURI: null,
    }, {
      id: "milxdy-test",
      tab: { id: 7, url: "https://example.com/article" },
      frameId: 0,
      url: "https://example.com/article",
    } as chrome.runtime.MessageSender);
    expect(response).toMatchObject({ ok: false });
    expect(String(response.error)).toContain("must use http://localhost");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("tombstones cancellation that arrives before a queued generation route", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const sender = {
      id: "milxdy-test",
      tab: { id: 11, url: "https://example.com/article" },
      frameId: 0,
      url: "https://example.com/article",
    } as chrome.runtime.MessageSender;
    const requestId = "request-queued-1";
    await expect(handlePostReadingBackgroundMessage({ type: "post-reading:cancelAudioExport", requestId }, sender))
      .resolves.toMatchObject({ ok: true, canceled: true });
    await expect(handlePostReadingBackgroundMessage({
      type: "post-reading:generateAudioExport",
      requestId,
      endpoint: "http://localhost:8787/tts",
      text: "Reviewed text",
      rate: 1,
      volume: 1,
      voiceURI: null,
    }, sender)).resolves.toMatchObject({ ok: false, error: "Audio generation canceled." });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
