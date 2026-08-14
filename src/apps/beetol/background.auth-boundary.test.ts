import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  prepare: vi.fn(),
  refresh: vi.fn(),
  status: vi.fn(),
}));

vi.mock("../../platform/background/router", () => ({
  registerBackgroundMessageHandlers: mocks.register,
}));

vi.mock("../../platform/auth/remilia-auth", () => ({
  REMILIA_BASE_URL: "https://api.remilia.net",
  prepareRemiliaAccess: mocks.prepare,
  refreshRemiliaAccess: mocks.refresh,
  getRemiliaAuthStatus: mocks.status,
  isRemiliaDisconnected: vi.fn().mockResolvedValue(false),
  remiliaAuthProvider: {},
}));

vi.mock("../../platform/auth/remilia-api", () => ({
  RemiliaApiClient: class {},
}));

vi.mock("./official-beetle-reads", () => ({
  officialBeetleReadFailure: vi.fn(),
  readOfficialBeetleSnapshot: vi.fn(),
}));

vi.mock("./legacy-beetle-actions", () => ({
  isLegacyBeetleAction: (action: unknown) => action === "catchBeetle",
  createLegacyBeetleActionsAdapter: (execute: (request: { method: string; path: string }) => Promise<unknown>) => ({
    runAction: () => execute({ method: "POST", path: "/api/beetle/catchBeetle" }),
    craftJunk: vi.fn(),
  }),
}));

describe("Beetol background auth boundary", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("chrome", {
      runtime: {
        id: "extension-id",
        getURL: (path = "") => `chrome-extension://extension-id/${path}`,
      },
      storage: {
        local: {
          get: vi.fn().mockResolvedValue({ lastUser: null }),
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
      tabs: { sendMessage: vi.fn().mockResolvedValue(undefined) },
    });
    mocks.prepare.mockResolvedValue({ ok: true, accessToken: "secret" });
    mocks.refresh.mockResolvedValue({ ok: true });
    mocks.status.mockResolvedValue({ phase: "disconnected", identity: null });
  });

  it("registers status-only auth messaging and rejects retired operations", async () => {
    const handler = await loadHandler();
    const extensionPage = { id: "extension-id", url: "chrome-extension://extension-id/popup.html" };
    const content = { id: "extension-id", url: "https://x.com/home", tab: { id: 1 }, frameId: 0 };

    expect(handler.matches({ type: "beetol:authStatus" })).toBe(true);
    expect(handler.matches({ type: "beetol:logout" })).toBe(false);
    expect(handler.matches({ type: "beetol:sessionStatus" })).toBe(false);
    await expect(handler.handle({ type: "beetol:authStatus" }, extensionPage)).resolves.toEqual({
      ok: true,
      signedIn: false,
      method: null,
      user: null,
    });
    await expect(handler.handle({ type: "beetol:logout" }, content)).resolves.toMatchObject({ error: "UNKNOWN_BEETOL_MESSAGE" });
    await expect(handler.handle({ type: "beetol:sessionStatus" }, content)).resolves.toMatchObject({ error: "UNKNOWN_BEETOL_MESSAGE" });

    mocks.status.mockResolvedValue({ phase: "unsupported", identity: null, lastError: { code: "UNSUPPORTED" } });
    await expect(handler.handle({ type: "beetol:authStatus" }, content)).resolves.toEqual({
      ok: true,
      signedIn: false,
      method: null,
      user: null,
    });
  });

  it("retries exactly one 401 and sends a contained bearer request", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(401))
      .mockResolvedValueOnce(response(200, { success: true }));
    vi.stubGlobal("fetch", fetchMock);
    const handler = await loadHandler();

    await expect(handler.handle({ type: "beetol:action", action: "catchBeetle" }, contentSender())).resolves.toMatchObject({ ok: true });

    expect(mocks.refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe("https://api.remilia.net/api/beetle/catchBeetle");
      expect(init).toMatchObject({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
      expect(init.headers.Authorization).toBe("Bearer secret");
    }
  });

  it("does not refresh or disconnect on 403", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(403, { message: "forbidden" })));
    const handler = await loadHandler();

    await expect(handler.handle({ type: "beetol:action", action: "catchBeetle" }, contentSender())).resolves.toMatchObject({
      ok: false,
      status: 403,
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it("rejects a mismatched final URL without refreshing its 401", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response(401, { message: "unauthorized" }, "https://evil.example/result")));
    const handler = await loadHandler();

    await expect(handler.handle({ type: "beetol:action", action: "catchBeetle" }, contentSender())).resolves.toMatchObject({
      ok: false,
      status: 0,
      data: { message: "INVALID_RESPONSE_URL" },
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});

function contentSender() {
  return { id: "extension-id", url: "https://x.com/home", tab: { id: 1 }, frameId: 0 };
}

function response(status: number, data: unknown = null, url = "https://api.remilia.net/api/beetle/catchBeetle") {
  return {
    ok: status >= 200 && status < 300,
    status,
    url,
    text: vi.fn().mockResolvedValue(data == null ? "" : JSON.stringify(data)),
  };
}

async function loadHandler() {
  await import("./background.js");
  return mocks.register.mock.calls[0][0][0] as {
    matches(message: unknown): boolean;
    handle(message: unknown, sender: unknown): Promise<Record<string, unknown>>;
  };
}
