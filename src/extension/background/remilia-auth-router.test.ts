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
}));

vi.mock("../../platform/background/router", () => ({
  objectMessage: (type: string) => (message: unknown) => Boolean(message && typeof message === "object"
    && (message as Record<string, unknown>).type === type),
  registerBackgroundMessageHandlers: mocks.register,
}));

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

  it("registers the six versioned, extension-page-only message actions", async () => {
    const handler = await loadHandler();
    const valid = [
      { type: "remilia-auth:status" },
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

  it("rejects content-script senders before invoking an auth action", async () => {
    mocks.status.mockResolvedValue({
      phase: "disconnected",
      grantedScopes: [],
      requiredScopes: [],
      migration: { version: 1, required: false, legacyDeleted: true },
    });
    const handler = await loadHandler();
    const response = await handler.handle(
      { type: "remilia-auth:connect", consentVersion: 1 },
      { id: "extension-id", url: "https://x.com/home", tab: { id: 1 } },
    );

    expect(response).toMatchObject({ ok: false, error: "UNKNOWN" });
    expect(mocks.connect).not.toHaveBeenCalled();
  });
});

async function loadHandler() {
  await import("./remilia-auth-router");
  return mocks.register.mock.calls[0][0][0] as {
    matches(message: unknown): boolean;
    handle(message: unknown, sender: unknown): Promise<Record<string, unknown>>;
  };
}
