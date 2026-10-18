import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  register: vi.fn(),
  configure: vi.fn(),
  status: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  revoke: vi.fn(),
  migrate: vi.fn(),
  installed: vi.fn(),
  me: vi.fn(),
  publicProfile: vi.fn(),
}));

vi.mock("../../platform/background/router", () => ({
  objectMessage: (type: string) => (message: unknown) => Boolean(message && typeof message === "object"
    && (message as Record<string, unknown>).type === type),
  registerBackgroundMessageHandlers: mocks.register,
}));

vi.mock("../../platform/auth/remilia-api", () => ({ RemiliaApiClient: class { getMe = mocks.me; getUserProfile = mocks.publicProfile; } }));

vi.mock("../../platform/auth/remilia-auth", () => ({
  REMILIA_AUTH_MIGRATION_VERSION: 1,
  REMILIA_AUTH_STATE_VERSION: 1,
  completeRemiliaAuthMigration: mocks.migrate,
  configureRemiliaAuthClientFromBuild: mocks.configure,
  connectRemiliaAuth: mocks.connect,
  disconnectRemiliaAuth: mocks.disconnect,
  getRemiliaAuthStatus: mocks.status,
  noteRemiliaAuthInstalled: mocks.installed,
  revokeRemiliaAuth: mocks.revoke,
  remiliaAuthProvider: {},
}));

describe("Remilia auth background router", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal("chrome", {
      runtime: {
        id: "extension-id",
        getURL: (path = "") => `chrome-extension://extension-id/${path}`,
        onInstalled: { addListener: vi.fn() },
      },
    });
  });

  it("registers the versioned, extension-page-only message actions", async () => {
    const handler = await loadHandler();
    const valid = [
      { type: "remilia-auth:status" },
      { type: "remilia-auth:me" },
      { type: "remilia-auth:previewFallback" },
      { type: "remilia-auth:connect", consentVersion: 1 },
      { type: "remilia-auth:reconnect", consentVersion: 1 },
      { type: "remilia-auth:completeMigration", migrationVersion: 1, decision: "delete-legacy" },
      { type: "remilia-auth:disconnect" },
      { type: "remilia-auth:revoke" },
    ];
    expect(valid.every(handler.matches)).toBe(true);
    expect(handler.matches({ type: "remilia-auth:connect", consentVersion: 2 })).toBe(false);
    expect(mocks.configure).toHaveBeenCalledOnce();
  });

  it("returns a token-free noninteractive UNSUPPORTED status for keyless builds", async () => {
    const unsupported = {
      phase: "unsupported",
      grantedScopes: [],
      requiredScopes: ["remilia:beetle.read"],
      migration: { version: 1, required: false, legacyDeleted: true },
      lastError: { code: "UNSUPPORTED" },
    };
    mocks.status.mockResolvedValue(unsupported);
    const handler = await loadHandler();
    const sender = { id: "extension-id", url: "chrome-extension://extension-id/popup.html" };

    const statusResponse = await handler.handle({ type: "remilia-auth:status" }, sender);
    const connectResponse = await handler.handle({ type: "remilia-auth:connect", consentVersion: 1 }, sender);

    expect(statusResponse).toEqual({ ok: true, authStateVersion: 1, status: unsupported });
    expect(connectResponse).toEqual({ ok: false, authStateVersion: 1, status: unsupported, error: "UNSUPPORTED" });
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(JSON.stringify([statusResponse, connectResponse])).not.toMatch(/accessToken|refreshToken|idToken/u);
  });

  it.each([
    ["AUTH_SETUP_FAILED", "AUTH_SETUP_FAILED"],
    ["DISCOVERY_FAILED", "AUTH_SETUP_FAILED"],
    ["REDIRECT_MISMATCH", "AUTH_SETUP_FAILED"],
    ["AUTH_RESPONSE_INVALID", "AUTH_RESPONSE_INVALID"],
    ["STATE_MISMATCH", "AUTH_RESPONSE_INVALID"],
    ["NONCE_MISMATCH", "AUTH_RESPONSE_INVALID"],
    ["TOKEN_EXCHANGE_FAILED", "TOKEN_EXCHANGE_FAILED"],
    ["TOKEN_REQUEST_REJECTED", "TOKEN_REQUEST_REJECTED"],
    ["TOKEN_RESPONSE_INVALID", "TOKEN_RESPONSE_INVALID"],
    ["SIGNING_KEYS_UNAVAILABLE", "SIGNING_KEYS_UNAVAILABLE"],
    ["ID_TOKEN_INVALID", "ID_TOKEN_INVALID"],
    ["ID_TOKEN_FORMAT_INVALID", "ID_TOKEN_FORMAT_INVALID"],
    ["ID_TOKEN_ALGORITHM_INVALID", "ID_TOKEN_ALGORITHM_INVALID"],
    ["ID_TOKEN_SIGNING_KEY_INVALID", "ID_TOKEN_SIGNING_KEY_INVALID"],
    ["ID_TOKEN_SIGNATURE_INVALID", "ID_TOKEN_SIGNATURE_INVALID"],
    ["ID_TOKEN_ISSUER_INVALID", "ID_TOKEN_ISSUER_INVALID"],
    ["ID_TOKEN_AUDIENCE_INVALID", "ID_TOKEN_AUDIENCE_INVALID"],
    ["ID_TOKEN_TIME_INVALID", "ID_TOKEN_TIME_INVALID"],
    ["ID_TOKEN_SUBJECT_INVALID", "ID_TOKEN_SUBJECT_INVALID"],
    ["AUTH_PAGE_LOAD_FAILED", "AUTH_PAGE_LOAD_FAILED"],
    ["AUTH_WINDOW_UNAVAILABLE", "AUTH_WINDOW_UNAVAILABLE"],
    ["AUTH_WINDOW_FAILED", "AUTH_WINDOW_FAILED"],
    ["AUTH_STORAGE_FAILED", "AUTH_STORAGE_FAILED"],
  ])("maps %s to the bounded popup error %s", async (runtimeError, uiError) => {
    const disconnected = {
      phase: "disconnected",
      grantedScopes: [],
      requiredScopes: ["openid"],
      migration: { version: 1, required: false, legacyDeleted: true },
      lastError: { code: uiError },
    };
    mocks.status.mockResolvedValue(disconnected);
    mocks.connect.mockResolvedValue({ ok: false, error: runtimeError });
    const handler = await loadHandler();

    const result = await handler.handle(
      { type: "remilia-auth:connect", consentVersion: 1 },
      { id: "extension-id", url: "chrome-extension://extension-id/popup.html" },
    );

    expect(result).toEqual({ ok: false, authStateVersion: 1, status: disconnected, error: uiError });
    expect(JSON.stringify(result)).not.toMatch(/https?:|accessToken|refreshToken|idToken|state|nonce|code=/u);
  });

  it("projects only intended identity fields from the authenticated profile", async () => {
    mocks.me.mockResolvedValue({ ok: true, data: { user: { username: "fixture", displayName: "Fixture", privateData: "secret" }, viewerContext: { secret: true } } });
    const handler = await loadHandler();
    expect(await handler.handle({ type: "remilia-auth:me" }, { id: "extension-id", url: "chrome-extension://extension-id/popup.html" }))
      .toEqual({ ok: true, identity: { username: "fixture", displayName: "Fixture" }, preview: { account: { username: "fixture", displayName: "Fixture", avatarUrl: "" }, friends: [] }, theme: { mode: "default", hue: 180 } });
    expect(await handler.handle({ type: "remilia-auth:me" }, { id: "extension-id", url: "https://x.com", tab: { id: 1 } }))
      .toEqual({ ok: false, authStateVersion: 1, error: "UNKNOWN" });
    expect(mocks.me).toHaveBeenCalledOnce();
  });

  it("projects bounded friends and safe images without private fields", async () => {
    mocks.me.mockResolvedValue({ ok: true, data: { user: {
      username: "fixture", displayName: "<img onerror=alert(1)>", pfpUrl: "/image.png", theme: "color", color: 0, accessToken: "secret",
      friendsDisplayed: [{ userHandle: "@friend", displayName: "Friend", pfpUrl: "https://evil.example/pixel", privateData: "secret" }],
    } } });
    const handler = await loadHandler();
    const response = await handler.handle({ type: "remilia-auth:me" }, { id: "extension-id", url: "chrome-extension://extension-id/popup.html" });
    expect(response.theme).toEqual({ mode: "color", hue: 0 });
    expect(response.preview).toEqual({ account: { username: "fixture", displayName: "<img onerror=alert(1)>", avatarUrl: "https://www.remilia.net/image.png" }, friends: [{ username: "friend", displayName: "Friend", avatarUrl: "" }] });
    expect(JSON.stringify(response)).not.toContain("secret");
  });

  it("uses the tokenless Jackson public profile for fallback and rejects content scripts", async () => {
    mocks.publicProfile.mockResolvedValue({ ok: true, data: { user: { username: "remilia_jackson", displayName: "Remilia Jackson" } } });
    const handler = await loadHandler();
    const message = { type: "remilia-auth:previewFallback" };
    await handler.handle(message, { id: "extension-id", url: "https://x.com", tab: { id: 1 } });
    expect(mocks.publicProfile).not.toHaveBeenCalled();
    const result = await handler.handle(message, { id: "extension-id", url: "chrome-extension://extension-id/popup.html" });
    expect(result.ok).toBe(true);
    expect(mocks.publicProfile).toHaveBeenCalledWith("remilia_jackson");
    expect(mocks.me).not.toHaveBeenCalled();
    mocks.publicProfile.mockResolvedValue({ ok: false, error: { code: "network_error", status: 0, message: "private" } });
    expect(await handler.handle(message, { id: "extension-id", url: "chrome-extension://extension-id/popup.html" })).toEqual({ ok: false, error: "network_error", status: 0 });
  });

  it("returns only the bounded account failure code and status", async () => {
    const handler = await loadHandler();
    mocks.me.mockResolvedValue({ ok: false, error: { code: "invalid_token", status: 401, message: "private server detail" } });
    expect(await handler.handle({ type: "remilia-auth:me" }, { id: "extension-id", url: "chrome-extension://extension-id/popup.html" }))
      .toEqual({ ok: false, error: "invalid_token", status: 401 });
  });

  it("allows the exact top-level popup tab fallback but rejects other extension pages and frames", async () => {
    mocks.status.mockResolvedValue({ phase: "disconnected", grantedScopes: [], requiredScopes: [], migration: { version: 1 } });
    const handler = await loadHandler();
    const valid = { id: "extension-id", frameId: 0, url: "chrome-extension://extension-id/popup.html?focus=remilia-login", tab: { id: 8 } };
    expect(await handler.handle({ type: "remilia-auth:status" }, valid)).toMatchObject({ ok: true });
    mocks.connect.mockResolvedValue({ ok: true });
    expect(await handler.handle({ type: "remilia-auth:connect", consentVersion: 1 }, valid)).toMatchObject({ ok: true });
    expect(mocks.connect).toHaveBeenCalledOnce();
    mocks.connect.mockClear();
    expect(await handler.handle({ type: "remilia-auth:connect", consentVersion: 1 }, { ...valid, frameId: 1 })).toMatchObject({ ok: false });
    for (const path of ["options.html", "popup.html/extra", "frames/ocr-host.html"]) {
      expect(await handler.handle({ type: "remilia-auth:connect", consentVersion: 1 }, { ...valid, url: `chrome-extension://extension-id/${path}` })).toMatchObject({ ok: false });
    }
    expect(mocks.connect).not.toHaveBeenCalled();
  });

  it("rejects unauthorized senders without exposing auth status or invoking an auth action", async () => {
    mocks.status.mockResolvedValue({
      phase: "disconnected",
      grantedScopes: [],
      requiredScopes: [],
      migration: { version: 1, required: false, legacyDeleted: true },
    });
    const handler = await loadHandler();
    const rejectedSenders = [
      { id: "other-extension", url: "chrome-extension://other-extension/popup.html" },
      { id: "extension-id", url: "chrome-extension://other-extension/popup.html" },
      { id: "extension-id", url: "https://x.com/home" },
      { id: "extension-id" },
      { id: "extension-id", url: "https://x.com/home", tab: { id: 1 } },
    ];
    const responses = await Promise.all(rejectedSenders.map((sender) => handler.handle(
      { type: "remilia-auth:connect", consentVersion: 1 },
      sender,
    )));

    expect(responses).toEqual(rejectedSenders.map(() => ({ ok: false, authStateVersion: 1, error: "UNKNOWN" })));
    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.connect).not.toHaveBeenCalled();
    expect(JSON.stringify(responses)).not.toMatch(/status|identity|scope|migration|accessToken|refreshToken|idToken/u);
  });
});

async function loadHandler() {
  await import("./remilia-auth-router");
  return mocks.register.mock.calls[0][0][0] as {
    matches(message: unknown): boolean;
    handle(message: unknown, sender: unknown): Promise<Record<string, unknown>>;
  };
}
