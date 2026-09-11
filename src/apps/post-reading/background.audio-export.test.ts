import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const chromeMock = {
  runtime: { id: "milxdy-test", getURL: vi.fn((path: string) => `chrome-extension://milxdy-test/${path}`) },
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
  it("binds a one-time OCR session to an extension content script and its packaged frame", async () => {
    const contentSender = {
      id: "milxdy-test", tab: { id: 42, url: "https://x.com/home" }, frameId: 0, url: "https://x.com/home",
    } as chrome.runtime.MessageSender;
    const session = await handlePostReadingBackgroundMessage({ type: "post-reading:ocrSession" }, contentSender);
    expect(session).toMatchObject({ ok: true, authToken: expect.any(String) });
    const authToken = String(session.authToken);
    const frameSender = {
      id: "milxdy-test", tab: { id: 42 }, frameId: 3, url: "chrome-extension://milxdy-test/ocr.html",
    } as chrome.runtime.MessageSender;
    await expect(handlePostReadingBackgroundMessage({ type: "post-reading:authorizeOcrSession", authToken }, frameSender))
      .resolves.toEqual({ ok: true });
    await expect(handlePostReadingBackgroundMessage({ type: "post-reading:authorizeOcrSession", authToken }, frameSender))
      .resolves.toEqual({ ok: false, error: "INVALID_OCR_SESSION" });
    await expect(handlePostReadingBackgroundMessage({ type: "post-reading:ocrSession" }, { ...contentSender, url: "https://attacker.example/" }))
      .resolves.toEqual({ ok: false, error: "UNSUPPORTED_SENDER" });
  });

  it("mints OCR sessions only for trusted top-level X/Twitter and Wiki content scripts", async () => {
    const sender = (url: string, overrides: Partial<chrome.runtime.MessageSender> = {}) => ({
      id: "milxdy-test", tab: { id: 42, url }, frameId: 0, url, ...overrides,
    }) as chrome.runtime.MessageSender;
    for (const url of ["https://x.com/home", "https://twitter.com/home", "https://remilia.wiki/Page", "https://wiki.remilia.org/Page"]) {
      await expect(handlePostReadingBackgroundMessage({ type: "post-reading:ocrSession" }, sender(url)))
        .resolves.toMatchObject({ ok: true, authToken: expect.any(String) });
    }
    for (const rejected of [
      sender("https://wiki.remilia.org.evil.example/Page"),
      sender("https://wiki.remilia.org/Page", { frameId: 1 }),
      sender("https://wiki.remilia.org/Page", { id: undefined }),
      sender("https://wiki.remilia.org/Page", { tab: undefined }),
    ]) {
      await expect(handlePostReadingBackgroundMessage({ type: "post-reading:ocrSession" }, rejected))
        .resolves.toEqual({ ok: false, error: "UNSUPPORTED_SENDER" });
    }
  });

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

  it("applies no-follow and no-referrer controls to the returned loopback audio read", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        audioUrl: "http://127.0.0.1:8787/result.mp3",
        audioContentType: "audio/mpeg",
      }), { status: 200, headers: { "content-type": "application/json" } }))
      .mockResolvedValueOnce(new Response(new Uint8Array([0x49, 0x44, 0x33]), {
        status: 200,
        headers: { "content-type": "audio/mpeg" },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const response = await handlePostReadingBackgroundMessage({
      type: "post-reading:generateAudioExport",
      requestId: "request-audio-read-1",
      endpoint: "http://localhost:8787/tts",
      text: "Reviewed text",
      rate: 1,
      volume: 1,
      voiceURI: null,
    }, {
      id: "milxdy-test",
      tab: { id: 29, url: "https://example.com/article" },
      frameId: 0,
      url: "https://example.com/article",
    } as chrome.runtime.MessageSender);
    expect(response).toMatchObject({ ok: true, audioBase64: "SUQz", audioContentType: "audio/mpeg" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(2, "http://127.0.0.1:8787/result.mp3", expect.objectContaining({
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
