import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  prepareAccess: vi.fn(),
  authStatus: vi.fn(),
}));
vi.mock("../../platform/background/router", () => ({ registerBackgroundMessageHandlers: mocks.register }));
vi.mock("../../platform/auth/remilia-auth", () => ({ prepareRemiliaAccess: mocks.prepareAccess, getRemiliaAuthStatus: mocks.authStatus }));

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.clearAllMocks(); });

describe("Chat media authorization boundary", () => {
  it("rejects a valid attachment before obtaining a bearer or performing network work", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    vi.stubGlobal("chrome", { runtime: { id: "test-extension", onConnect: { addListener: vi.fn() } } });
    await import("./background");
    const handler = mocks.register.mock.calls[0][0][0].handle;
    const result = await handler(
      { type: "reminetChat:legacy:uploadAttachment", mimeType: "image/png", dataUrl: "data:image/png;base64,aGVsbG8=" },
      { id: "test-extension", url: "https://x.com/home", tab: { id: 1, url: "https://x.com/home" } },
    );
    expect(result).toMatchObject({ ok: false, error: "MEDIA_UNAVAILABLE", retryable: false });
    expect(result.message).toContain("RemiliaNET website");
    expect(mocks.prepareAccess).not.toHaveBeenCalled();
    expect(mocks.authStatus).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
