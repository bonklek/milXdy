import { afterEach, describe, expect, it, vi } from "vitest";
import {
  LEGACY_ADAPTER_REGISTRY,
  LEGACY_CHAT_ID,
  LEGACY_MEDIA_CONFIRM_URL,
  LEGACY_MEDIA_UPLOAD_URL,
  LEGACY_SOCKET_FRAME_MAX_BYTES,
  LEGACY_SOCKET_IDLE_TIMEOUT_MS,
  LEGACY_SOCKET_URL,
  isAllowedLegacySender,
  isExactLegacyHttpEndpoint,
  isExactLegacySocketUrl,
  legacyPortReconnectDelay,
  parseLegacyConfirmedMedia,
  parseLegacyMediaUploadRequest,
  parseLegacyMediaUploadOutcome,
  parseLegacySocketBridgeEvent,
  parseLegacySocketClientCommand,
  parseLegacySocketFrame,
  parseLegacyUploadToken,
} from "./legacy-adapters";
import { decodeLegacyAttachmentDataUrl, executeLegacyMediaUpload } from "./legacy-media-upload";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("legacy adapter registry", () => {
  it("classifies only the exact undocumented transports and defines removal gates", () => {
    expect(LEGACY_ADAPTER_REGISTRY.map((entry) => entry.id)).toEqual(["reminet-realtime-v0", "reminet-media-v0"]);
    expect(LEGACY_ADAPTER_REGISTRY.every((entry) => entry.classification === "legacy-undocumented")).toBe(true);
    expect(LEGACY_ADAPTER_REGISTRY.every((entry) => entry.removalConditions.length === 3)).toBe(true);
    expect(LEGACY_ADAPTER_REGISTRY[0].transports).toEqual([LEGACY_SOCKET_URL]);
    expect(LEGACY_ADAPTER_REGISTRY[1].transports).toEqual([LEGACY_MEDIA_UPLOAD_URL, LEGACY_MEDIA_CONFIRM_URL, LEGACY_SOCKET_URL]);
  });

  it("requires exact socket and HTTP endpoints", () => {
    expect(isExactLegacySocketUrl(LEGACY_SOCKET_URL)).toBe(true);
    expect(isExactLegacySocketUrl(`${LEGACY_SOCKET_URL}/`)).toBe(false);
    expect(isExactLegacySocketUrl("wss://evil.example/api/ws")).toBe(false);
    expect(isExactLegacyHttpEndpoint(LEGACY_MEDIA_UPLOAD_URL, LEGACY_MEDIA_UPLOAD_URL)).toBe(true);
    expect(isExactLegacyHttpEndpoint(`${LEGACY_MEDIA_UPLOAD_URL}?token=secret`, LEGACY_MEDIA_UPLOAD_URL)).toBe(false);
    expect(isExactLegacyHttpEndpoint("https://www.remilia.net/media/upload/evil", LEGACY_MEDIA_UPLOAD_URL)).toBe(false);
  });

  it("bounds extension-worker reconnect backoff", () => {
    expect(LEGACY_SOCKET_IDLE_TIMEOUT_MS).toBe(70_000);
    expect([0, 1, 2, 3, 4, 5, 99].map(legacyPortReconnectDelay)).toEqual([500, 1_000, 2_500, 5_000, 10_000, 10_000, 10_000]);
  });
});

describe("legacy sender and socket schemas", () => {
  it("accepts only same-extension HTTPS top-frame role origins", () => {
    vi.stubGlobal("chrome", { runtime: { id: "extension-id" } });
    const sender = (url: string, frameId = 0): chrome.runtime.MessageSender => ({
      id: "extension-id",
      frameId,
      url,
      tab: { id: 7, url } as chrome.tabs.Tab,
    });
    expect(isAllowedLegacySender(sender("https://x.com/messages"), "x-content")).toBe(true);
    expect(isAllowedLegacySender(sender("https://twitter.com/i/chat"), "x-content")).toBe(true);
    expect(isAllowedLegacySender(sender("https://x.com/messages"), "runtime-content")).toBe(true);
    expect(isAllowedLegacySender(sender("https://twitter.com/i/chat"), "runtime-content")).toBe(true);
    expect(isAllowedLegacySender(sender("https://www.remilia.net/global-chat"), "runtime-content")).toBe(true);
    expect(isAllowedLegacySender(sender("https://remilia.net/global-chat"), "runtime-content")).toBe(false);
    expect(isAllowedLegacySender(sender("https://wiki.remilia.org/"), "runtime-content")).toBe(false);
    expect(isAllowedLegacySender(sender("http://www.remilia.net/"), "runtime-content")).toBe(false);
    expect(isAllowedLegacySender(sender("https://www.remilia.net/", 2), "runtime-content")).toBe(false);
    expect(isAllowedLegacySender(sender("https://www.remilia.net/global-chat"), "remilia-bridge")).toBe(true);
    expect(isAllowedLegacySender(sender("https://www.remilia.net.evil.example/"), "remilia-bridge")).toBe(false);
    expect(isAllowedLegacySender(sender("http://www.remilia.net/"), "remilia-bridge")).toBe(false);
    expect(isAllowedLegacySender(sender("https://www.remilia.net/", 2), "remilia-bridge")).toBe(false);
  });

  it("accepts only media-bearing submit and bounded reaction mutations", () => {
    const requestId = "2f57c4fc-6597-4ae5-9f46-c5996235dce1";
    expect(parseLegacySocketClientCommand({
      type: "mutate",
      requestId,
      mutation: { type: "submit", payload: { chat_id: LEGACY_CHAT_ID, text: "caption", media_ids: [12] } },
    })).toEqual({
      type: "mutate",
      requestId,
      mutation: { type: "submit", payload: { chat_id: LEGACY_CHAT_ID, text: "caption", media_ids: [12] } },
    });
    expect(parseLegacySocketClientCommand({
      type: "mutate",
      requestId,
      mutation: { type: "submit", payload: { chat_id: LEGACY_CHAT_ID, text: "text only", media_ids: [] } },
    })).toBeNull();
    expect(parseLegacySocketClientCommand({
      type: "mutate",
      requestId: "private-path",
      mutation: { type: "react", payload: { chat_id: LEGACY_CHAT_ID, message_id: 1, emoji: "👍" } },
    })).toBeNull();
    expect(parseLegacySocketClientCommand({ type: "send", payload: { token: "secret" } })).toBeNull();
    expect(parseLegacySocketClientCommand({ type: "connect", extra: true })).toBeNull();
  });

  it("bounds bridge events and validates allowed frame envelopes", () => {
    const frame = JSON.stringify({ type: "deliver", payload: { message_id: 99 } });
    expect(parseLegacySocketBridgeEvent({ type: "socket:hint", event: "deliver", at: 123 })).toEqual({ type: "socket:hint", event: "deliver", at: 123 });
    expect(parseLegacySocketFrame(frame)).toEqual({ type: "deliver", payload: { message_id: 99 } });
    expect(parseLegacySocketFrame(JSON.stringify({ type: "unknown", payload: {} }))).toBeNull();
    expect(parseLegacySocketFrame(JSON.stringify({ type: "deliver", payload: {}, token: "secret" }))).toBeNull();
    expect(parseLegacySocketFrame("x".repeat(LEGACY_SOCKET_FRAME_MAX_BYTES + 1))).toBeNull();
    expect(parseLegacySocketBridgeEvent({ type: "socket:hint", event: "unknown", at: 123 })).toBeNull();
    expect(parseLegacySocketBridgeEvent({ type: "socket:hint", event: "deliver", at: 123, body: "x".repeat(20_000) })).toBeNull();
    expect(parseLegacySocketBridgeEvent({ type: "socket:close", code: 1000, reason: "server leaked private reason", wasClean: true })).toBeNull();
  });
});

describe("legacy media schemas and executor", () => {
  const pngDataUrl = "data:image/png;base64,aGVsbG8=";

  it("requires a strict explicit-selection message and matching data URL type", () => {
    expect(parseLegacyMediaUploadRequest({
      type: "reminetChat:legacy:uploadAttachment",
      mimeType: "image/png",
      dataUrl: pngDataUrl,
    })).toEqual({ mimeType: "image/png", dataUrl: pngDataUrl });
    expect(parseLegacyMediaUploadRequest({
      type: "reminetChat:legacy:uploadAttachment",
      mimeType: "image/png",
      dataUrl: pngDataUrl,
      path: "C:\\private\\file.png",
    })).toBeNull();
    expect(decodeLegacyAttachmentDataUrl({ mimeType: "image/jpeg", dataUrl: pngDataUrl })).toEqual({
      ok: false,
      error: "ATTACHMENT_TYPE_MISMATCH",
      retryable: false,
    });
    expect(decodeLegacyAttachmentDataUrl({ mimeType: "image/png", dataUrl: "data:image/png;base64," })).toEqual({
      ok: false,
      error: "INVALID_ATTACHMENT",
      retryable: false,
    });
  });

  it("rejects ambiguous or hostile upload and confirmation responses", () => {
    expect(parseLegacyUploadToken({ success: true, token: " upload-token " })).toBe("upload-token");
    expect(parseLegacyUploadToken({ success: true, token: "token", path: "C:\\private" })).toBeNull();
    expect(parseLegacyConfirmedMedia({
      success: true,
      media: [{ media_id: 5, mime_type: "image/png", url: "https://evil.example/file.png" }],
    }, "image/png")).toBeNull();
    expect(parseLegacyConfirmedMedia({
      success: true,
      media: [{ media_id: 5, mediaId: 5, mime_type: "image/png", url: "https://media.remilia.net/file.png" }],
    }, "image/png")).toBeNull();
    expect(parseLegacyMediaUploadOutcome({
      ok: true,
      media: { mediaId: 5, mimeType: "image/png", url: "https://www.remilia.net/media/5.png", width: null, height: null },
    })).toEqual({
      ok: true,
      media: { mediaId: 5, mimeType: "image/png", url: "https://www.remilia.net/media/5.png", width: null, height: null },
    });
    expect(parseLegacyMediaUploadOutcome({
      ok: false,
      error: "LEGACY_UPLOAD_REJECTED",
      retryable: true,
      rawBody: "private",
    })).toBeNull();
    expect(parseLegacyMediaUploadOutcome({ ok: true, media: { mediaId: 5, mimeType: "image/png" } })).toBeNull();
  });

  it("uploads and confirms without returning the legacy token or raw response bodies", async () => {
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, token: "private-upload-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        success: true,
        media: [{ media_id: 42, mime_type: "image/png", url: "https://www.remilia.net/media/42.png", width: 2, height: 3 }],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }));

    const result = await executeLegacyMediaUpload({ mimeType: "image/png", dataUrl: pngDataUrl }, { fetch: fetchMock, accessToken: "private-access-token" });

    expect(result).toEqual({
      ok: true,
      media: { mediaId: 42, mimeType: "image/png", url: "https://www.remilia.net/media/42.png", width: 2, height: 3 },
    });
    expect(JSON.stringify(result)).not.toContain("private-upload-token");
    expect(fetchMock).toHaveBeenNthCalledWith(1, LEGACY_MEDIA_UPLOAD_URL, expect.objectContaining({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, LEGACY_MEDIA_CONFIRM_URL, expect.objectContaining({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" }));
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({ Authorization: "Bearer private-access-token" });
  });

  it("redacts rejected legacy response bodies", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      error: "Bearer private-token C:\\Users\\person\\private.png",
      body: "private caption",
    }), {
      status: 500,
      headers: { "content-type": "application/json" },
    }));

    const result = await executeLegacyMediaUpload({ mimeType: "image/png", dataUrl: pngDataUrl }, { fetch: fetchMock, accessToken: "private-access-token" });
    expect(result).toEqual({ ok: false, error: "LEGACY_UPLOAD_REJECTED", retryable: true });
    expect(JSON.stringify(result)).not.toContain("private-token");
    expect(JSON.stringify(result)).not.toContain("private caption");
  });

  it("aborts a stalled upload at the typed deadline", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>((_url, init) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
    }));
    const pending = executeLegacyMediaUpload({ mimeType: "image/png", dataUrl: pngDataUrl }, { fetch: fetchMock, accessToken: "private-access-token" });
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(pending).resolves.toEqual({ ok: false, error: "LEGACY_UPLOAD_TIMEOUT", retryable: true });
  });

  it("aborts a stalled confirmation at its independent typed deadline", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ success: true, token: "private-upload-token" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }))
      .mockImplementationOnce((_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason), { once: true });
      }));
    const pending = executeLegacyMediaUpload({ mimeType: "image/png", dataUrl: pngDataUrl }, { fetch: fetchMock, accessToken: "private-access-token" });
    await vi.advanceTimersByTimeAsync(12_000);
    await expect(pending).resolves.toEqual({ ok: false, error: "LEGACY_CONFIRM_TIMEOUT", retryable: true });
  });

  it("rejects oversized JSON without retaining its contents", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({
      success: true,
      token: `private-${"x".repeat(70 * 1024)}`,
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    const result = await executeLegacyMediaUpload({ mimeType: "image/png", dataUrl: pngDataUrl }, { fetch: fetchMock, accessToken: "private-access-token" });
    expect(result).toEqual({ ok: false, error: "LEGACY_UPLOAD_RESPONSE_INVALID", retryable: false });
    expect(JSON.stringify(result)).not.toContain("private-");
  });

  it("redacts a broken response stream behind a stable adapter failure", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream({
      start(controller) {
        controller.error(new Error("Bearer private-token C:\\Users\\person\\private.png"));
      },
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));

    const result = await executeLegacyMediaUpload({ mimeType: "image/png", dataUrl: pngDataUrl }, { fetch: fetchMock, accessToken: "private-access-token" });
    expect(result).toEqual({ ok: false, error: "LEGACY_UPLOAD_REJECTED", retryable: true });
    expect(JSON.stringify(result)).not.toContain("private-token");
  });
});
