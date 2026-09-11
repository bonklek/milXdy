import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppRuntimeScheduler } from "../../platform/app-sdk/app-platform";
import type { RemiliaApiChatMessage } from "../../platform/auth/remilia-api";
import {
  CHAT_REST_MESSAGE_LIMIT_BYTES,
  CHAT_REST_PAGE_SIZE,
  CHAT_REST_POLL_INTERVAL_MS,
  CHAT_REST_POST_INTERVAL_MS,
  ChatRestController,
  chatRestUtf8Bytes,
  classifyChatRestFailure,
  mergeOfficialChatMessages,
  normalizeOfficialChatMessage,
  validateChatRestPost,
} from "./chat-rest";

const scheduler: AppRuntimeScheduler = {
  idle(callback) {
    const timer = setTimeout(callback, 0);
    return () => clearTimeout(timer);
  },
  timeout(callback, delayMs) {
    const timer = setTimeout(callback, delayMs);
    return () => clearTimeout(timer);
  },
};

function message(id: string, overrides: Partial<RemiliaApiChatMessage> = {}): RemiliaApiChatMessage {
  return {
    id,
    author: { handle: `user-${id}`, display_name: `User ${id}`, avatar_url: `https://cdn.remilia.net/${id}.png` },
    text: `message ${id}`,
    created_at: Number(id),
    ...overrides,
  };
}

function pageResponse(messages: RemiliaApiChatMessage[] = [message("1")], hasMore = false, nextCursor: string | null = null) {
  return { ok: true, status: 200, data: { messages, has_more: hasMore, next_cursor: nextCursor } };
}

describe("official Remilia Chat REST controller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("enforces the documented UTF-8 byte limit rather than JavaScript character count", () => {
    const exact = "🫵".repeat(CHAT_REST_MESSAGE_LIMIT_BYTES / 4);
    expect(chatRestUtf8Bytes(exact)).toBe(CHAT_REST_MESSAGE_LIMIT_BYTES);
    expect(validateChatRestPost(exact)).toBeNull();
    expect(validateChatRestPost(`${exact}a`)?.error.code).toBe("invalid_request");
    expect(validateChatRestPost("hello", "not-an-id")?.error.code).toBe("invalid_request");
  });

  it("uses only the fixed capability operation and redacts message text and ids from diagnostics", async () => {
    let now = 10_000;
    const invokeCapability = vi.fn().mockResolvedValue({ ok: true, status: 201, data: message("22", { text: "private body" }) });
    const recordDiagnostic = vi.fn();
    const onPage = vi.fn();
    const controller = new ChatRestController({ invokeCapability, scheduler, now: () => now, onPage, recordDiagnostic });

    const result = await controller.postMessage("private body", "21");

    expect(result.ok).toBe(true);
    expect(invokeCapability).toHaveBeenCalledWith("postGlobalChatMessage", { text: "private body", replyToId: "21" });
    expect(onPage).toHaveBeenCalledWith(expect.objectContaining({ reason: "post" }));
    expect(JSON.stringify(recordDiagnostic.mock.calls)).not.toContain("private body");
    expect(JSON.stringify(recordDiagnostic.mock.calls)).not.toContain("22");

    now += CHAT_REST_POST_INTERVAL_MS;
    await controller.postMessage("next");
    expect(invokeCapability).toHaveBeenCalledTimes(2);
  });

  it("locally gates duplicate sends for two seconds while preserving server 429 authority", async () => {
    let now = 5_000;
    const invokeCapability = vi.fn()
      .mockResolvedValueOnce(pageResponse().data.messages[0] && { ok: true, status: 201, data: message("1") })
      .mockResolvedValueOnce({
        ok: false,
        error: {
          category: "rate_limit",
          code: "rate_limited",
          message: "raw server text must be replaced",
          status: 429,
          nextAllowedAt: 17,
        },
      })
      .mockResolvedValueOnce({ ok: true, status: 201, data: message("5") });
    const controller = new ChatRestController({ invokeCapability, scheduler, now: () => now, onPage: vi.fn() });

    expect((await controller.postMessage("one")).ok).toBe(true);
    expect((await controller.postMessage("two")).ok).toBe(false);
    expect(invokeCapability).toHaveBeenCalledTimes(1);

    now += CHAT_REST_POST_INTERVAL_MS;
    const serverLimited = await controller.postMessage("three");
    expect(serverLimited.ok).toBe(false);
    if (!serverLimited.ok) expect(serverLimited.error.message).toBe("Wait before sending another message.");

    now = 16_999;
    expect((await controller.postMessage("four")).ok).toBe(false);
    expect(invokeCapability).toHaveBeenCalledTimes(2);

    now = 17_000;
    expect((await controller.postMessage("five")).ok).toBe(true);
  });

  it("never overlaps list requests and coalesces realtime reconciliation hints", async () => {
    let resolveFirst!: (value: unknown) => void;
    const invokeCapability = vi.fn().mockImplementation(() => new Promise((resolve) => {
      resolveFirst = resolve;
    }));
    const controller = new ChatRestController({ invokeCapability, scheduler, onPage: vi.fn() });
    controller.setPollingActive(true);

    await vi.advanceTimersByTimeAsync(0);
    expect(invokeCapability).toHaveBeenCalledTimes(1);
    void controller.requestReconciliation("realtime-hint");
    void controller.requestReconciliation("realtime-invalid");
    await vi.advanceTimersByTimeAsync(CHAT_REST_POLL_INTERVAL_MS * 10);
    expect(invokeCapability).toHaveBeenCalledTimes(1);

    resolveFirst(pageResponse());
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    expect(invokeCapability).toHaveBeenCalledTimes(2);
  });

  it("keeps an older cursor request distinct from an in-flight latest-page request", async () => {
    let resolveLatest!: (value: unknown) => void;
    let resolveOlder!: (value: unknown) => void;
    const invokeCapability = vi.fn().mockImplementation((_operation, params) => new Promise((resolve) => {
      if (params.before) resolveOlder = resolve;
      else resolveLatest = resolve;
    }));
    const controller = new ChatRestController({ invokeCapability, scheduler, onPage: vi.fn() });

    const latest = controller.loadInitial();
    const older = controller.loadOlder("20");
    expect(invokeCapability).toHaveBeenNthCalledWith(1, "listGlobalChatMessages", { limit: CHAT_REST_PAGE_SIZE });
    expect(invokeCapability).toHaveBeenNthCalledWith(2, "listGlobalChatMessages", { limit: CHAT_REST_PAGE_SIZE, before: "20" });
    resolveLatest(pageResponse([message("30")], true, "20"));
    resolveOlder(pageResponse([message("20")], false, null));
    await expect(latest).resolves.toMatchObject({ ok: true });
    await expect(older).resolves.toMatchObject({ ok: true });
  });

  it("stops polling while inactive and resumes with one immediate reconciliation", async () => {
    const invokeCapability = vi.fn().mockResolvedValue(pageResponse());
    const controller = new ChatRestController({ invokeCapability, scheduler, onPage: vi.fn() });
    controller.setPollingActive(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(invokeCapability).toHaveBeenCalledTimes(1);

    controller.setPollingActive(false);
    await vi.advanceTimersByTimeAsync(CHAT_REST_POLL_INTERVAL_MS * 10);
    expect(invokeCapability).toHaveBeenCalledTimes(1);

    controller.setPollingActive(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(invokeCapability).toHaveBeenCalledTimes(2);
  });

  it("rejects missing and repeated older cursors instead of looping", async () => {
    const invokeCapability = vi.fn()
      .mockResolvedValueOnce(pageResponse([message("3")], true, "2"))
      .mockResolvedValueOnce(pageResponse([message("2")], true, "2"));
    const onPage = vi.fn();
    const onFailure = vi.fn();
    const controller = new ChatRestController({ invokeCapability, scheduler, onPage, onFailure });

    expect((await controller.loadInitial()).ok).toBe(true);
    const repeated = await controller.loadOlder("2");

    expect(repeated.ok).toBe(false);
    if (!repeated.ok) expect(repeated.error.code).toBe("invalid_response");
    expect(onPage).toHaveBeenCalledTimes(1);
    expect(onFailure).toHaveBeenCalledWith(expect.objectContaining({ code: "invalid_response" }), "invalid-response");
  });

  it("rejects nonnumeric or oversized server cursors before another page request", async () => {
    const invokeCapability = vi.fn().mockResolvedValue(pageResponse([message("3")], true, "opaque-cursor"));
    const controller = new ChatRestController({ invokeCapability, scheduler, onPage: vi.fn() });

    const result = await controller.loadInitial();

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_response");
    expect(invokeCapability).toHaveBeenCalledTimes(1);
  });

  it("deduplicates ids and replaces authoritative edit, reaction, and media metadata", () => {
    const original = message("90071992547409931234", {
      text: "before",
      media: [{ kind: "image", url: "https://cdn.remilia.net/old.png" }],
      reactions: [{ emoji: "🔥", count: 1 }],
    });
    const edited = message("90071992547409931234", {
      text: "after",
      edited_at: 99,
      reply_to_id: "7",
      media: [{ kind: "image", url: "https://cdn.remilia.net/new.png", width: 640, height: 480 }],
      reactions: [{ emoji: "🔥", count: 3 }],
    });

    expect(mergeOfficialChatMessages([original], [edited])).toEqual([edited]);
  });

  it("normalizes replies, edits, media metadata, and aggregate reactions", () => {
    const normalized = normalizeOfficialChatMessage(message("42", {
      reply_to_id: "41",
      edited_at: 123,
      media: [
        { kind: "image", url: "https://cdn.remilia.net/a.png", width: 640, height: 480, is_animated: false },
        { kind: "video", url: "https://cdn.remilia.net/a.mp4", thumbnail_url: "https://cdn.remilia.net/a.jpg" },
      ],
      reactions: [
        { emoji: "🔥", count: 2 },
        { emoji: "🔥", count: 3 },
        { emoji: "", count: 50 },
      ],
    }));

    expect(normalized).toMatchObject({
      id: "42",
      replyToId: "41",
      editedAt: 123,
      media: [
        { kind: "image", width: 640, height: 480, is_animated: false },
        { kind: "video", thumbnail_url: "https://cdn.remilia.net/a.jpg" },
      ],
      reactions: [{ emoji: "🔥", count: 5 }],
    });
  });

  it("keeps expired auth, missing scope, rate limiting, and connectivity distinct", () => {
    expect(classifyChatRestFailure({ category: "authentication", code: "invalid_token", message: "", status: 401 })).toBe("auth-expired");
    expect(classifyChatRestFailure({ category: "authorization", code: "insufficient_scope", message: "", status: 403 })).toBe("missing-scope");
    expect(classifyChatRestFailure({ category: "authorization", code: "forbidden", message: "", status: 403 })).toBe("failed");
    expect(classifyChatRestFailure({ category: "rate_limit", code: "rate_limited", message: "", status: 429 })).toBe("rate-limited");
    expect(classifyChatRestFailure({ category: "network", code: "network_error", message: "", status: 0 })).toBe("offline");
  });

  it("maps broker failures to stable redacted chat failures", async () => {
    const invokeCapability = vi.fn().mockResolvedValue({
      ok: false,
      error: {
        category: "broker",
        code: "consent_required",
        message: "raw broker detail with package identity",
        status: 403,
      },
    });
    const recordDiagnostic = vi.fn();
    const controller = new ChatRestController({ invokeCapability, scheduler, now: () => 20_000, onPage: vi.fn(), recordDiagnostic });

    const result = await controller.postMessage("hello");

    expect(result).toEqual({
      ok: false,
      error: {
        category: "authorization",
        code: "requires_user",
        message: "Send again from the Remilia Chat composer.",
        status: 403,
      },
    });
    expect(JSON.stringify(recordDiagnostic.mock.calls)).not.toContain("raw broker detail");
  });
});
