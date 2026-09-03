import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  status: vi.fn(),
  read: vi.fn(),
}));

vi.mock("../../platform/background/router", () => ({
  registerBackgroundMessageHandlers: mocks.register,
}));

vi.mock("../../platform/auth/remilia-auth", () => ({
  getRemiliaAuthStatus: mocks.status,
  remiliaAuthProvider: {},
}));

vi.mock("../../platform/auth/remilia-api", () => ({
  RemiliaApiClient: class {},
}));

vi.mock("./official-beetle-reads", () => ({
  officialBeetleReadFailure: vi.fn(),
  readOfficialBeetleSnapshot: mocks.read,
}));

vi.mock("./legacy-beetle-actions", () => ({
  isLegacyBeetleAction: (action: unknown) => ["catchBeetle", "beetleHunt", "claimUBC", "junkFaucet"].includes(String(action)),
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
          set: vi.fn().mockResolvedValue(undefined),
        },
      },
    });
    mocks.status.mockResolvedValue({ phase: "connected", identity: null });
    mocks.read.mockResolvedValue({ user: { beetles: {} }, fetchedAt: 1 });
  });

  it("keeps auth messaging token-free and labels the native RemiliaNET action mode", async () => {
    const handler = await loadHandler();
    const extensionPage = { id: "extension-id", url: "chrome-extension://extension-id/popup.html" };

    await expect(handler.handle({ type: "beetol:authStatus" }, extensionPage)).resolves.toEqual({
      ok: true,
      signedIn: true,
      method: "oidc",
      actionMode: "native-remilianet",
      user: null,
    });
    expect(handler.matches({ type: "beetol:logout" })).toBe(false);
    expect(handler.matches({ type: "beetol:sessionStatus" })).toBe(false);
  });

  it("labels documented state reads as official API coverage", async () => {
    const handler = await loadHandler();
    await expect(handler.handle({ type: "beetol:getState" }, contentSender())).resolves.toMatchObject({
      ok: true,
      readMode: "official-api",
    });
  });

  it("routes connected actions to the visible native RemiliaNET control without transport", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const handler = await loadHandler();

    await expect(handler.handle({ type: "beetol:action", action: "beetleHunt" }, contentSender()))
      .resolves.toMatchObject({
        ok: false,
        status: 0,
        error: "NATIVE_ACTION_REQUIRED",
        nativeAction: true,
        action: "beetleHunt",
        actionMode: "native-remilianet",
        data: { message: expect.stringContaining("visible RemiliaNET Beetle control") },
      });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([401, 403])("ignores caller-supplied HTTP %s state and never refreshes or proxies an action", async (status) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const handler = await loadHandler();

    await expect(handler.handle({
      type: "beetol:action",
      action: "catchBeetle",
      status,
      error: status === 401 ? "unauthorized" : "forbidden",
    }, contentSender())).resolves.toMatchObject({
      ok: false,
      status: 0,
      error: "NATIVE_ACTION_REQUIRED",
      actionMode: "native-remilianet",
      data: { message: expect.stringContaining("visible RemiliaNET Beetle control") },
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed while disconnected without attempting an action transport", async () => {
    mocks.status.mockResolvedValue({ phase: "disconnected", identity: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const handler = await loadHandler();

    await expect(handler.handle({ type: "beetol:action", action: "catchBeetle" }, contentSender()))
      .resolves.toMatchObject({ ok: false, error: "AUTH_REQUIRED", authRequired: true, actionMode: "unavailable" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fails closed on missing scope with a bounded visible reconnect instruction", async () => {
    mocks.status.mockResolvedValue({ phase: "missing-scope", identity: null });
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const handler = await loadHandler();

    await expect(handler.handle({ type: "beetol:action", action: "catchBeetle" }, contentSender()))
      .resolves.toMatchObject({
        ok: false,
        error: "MISSING_SCOPE",
        missingScope: true,
        actionMode: "unavailable",
        data: { message: expect.stringContaining("approve Beetle read access") },
      });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("contains no cookie, hidden-tab, legacy mutation, or bearer transport", () => {
    const source = readFileSync(resolve(process.cwd(), "src/apps/beetol/background.js"), "utf8");
    expect(source).not.toContain("/api/beetle/action/");
    expect(source).not.toContain("Authorization");
    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toContain("prepareRemiliaAccess");
    expect(source).not.toContain("refreshRemiliaAccess");
    expect(source).not.toContain("credentials: 'include'");
    expect(source).not.toContain("chrome.tabs.create");
    expect(source).not.toContain("chrome.windows.create");
  });
});

function contentSender() {
  return { id: "extension-id", url: "https://www.remilia.net/~remilia", tab: { id: 1 }, frameId: 0 };
}

async function loadHandler() {
  await import("./background.js");
  return mocks.register.mock.calls[0][0][0] as {
    matches(message: unknown): boolean;
    handle(message: unknown, sender: unknown): Promise<Record<string, unknown>>;
  };
}
