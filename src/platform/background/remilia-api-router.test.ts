import { beforeEach, describe, expect, it, vi } from "vitest";
import { REMILIA_SCOPE_STATS_READ, RemiliaApiClient, type RemiliaApiAuthGrant, type RemiliaApiAuthProvider } from "../auth/remilia-api";
import { REMILIA_API_V1_SUCCESS_FIXTURES } from "../auth/__fixtures__/remilia-api-v1";
import { createRemiliaApiRouterHandlers, isRemiliaApiRouterMessage } from "./remilia-api-router";

beforeEach(() => {
  vi.stubGlobal("chrome", { runtime: { id: "milxdy-extension" } });
});

describe("Remilia API router message allowlist", () => {
  it("accepts typed operations and rejects URLs, scope overrides, extra keys, and unknown operations", () => {
    expect(isRemiliaApiRouterMessage({ type: "remiliaApi:request", operation: "getMe" })).toBe(true);
    expect(isRemiliaApiRouterMessage({
      type: "remiliaApi:request",
      operation: "resolveDirectory",
      params: { identifiers: [{ type: "github", value: "remilia" }] },
    })).toBe(true);
    expect(isRemiliaApiRouterMessage({ type: "remiliaApi:request", operation: "fetch", params: { url: "https://evil.example" } })).toBe(false);
    expect(isRemiliaApiRouterMessage({
      type: "remiliaApi:request",
      operation: "getMyStats",
      params: { scopes: [] },
    })).toBe(false);
    expect(isRemiliaApiRouterMessage({
      type: "remiliaApi:request",
      operation: "pokeUser",
      params: { handle: "remilia", accessToken: "caller-token" },
    })).toBe(false);
    expect(isRemiliaApiRouterMessage({
      type: "remiliaApi:request",
      operation: "postGlobalChatMessage",
      params: { text: "gm", replyToId: "not-numeric" },
    })).toBe(true);
  });

  it("rejects messages from outside this extension before client dispatch", async () => {
    const client = { getMe: vi.fn() } as unknown as RemiliaApiClient;
    const [handler] = createRemiliaApiRouterHandlers(client);

    const response = await handler.handle(
      { type: "remiliaApi:request", operation: "getMe" },
      { id: "other-extension" } as chrome.runtime.MessageSender,
    );

    expect(response).toMatchObject({ ok: false, error: { code: "invalid_request" } });
    expect(client.getMe).not.toHaveBeenCalled();
  });
});

describe("Remilia API router integration", () => {
  it("dispatches an allowed operation through scope gating and returns no credential fields", async () => {
    const auth: RemiliaApiAuthProvider = {
      prepare: vi.fn(async (): Promise<RemiliaApiAuthGrant> => ({
        ok: true,
        accessToken: "background-only-token",
        tokenType: "Bearer",
        expiresAt: Date.now() + 60_000,
        grantedScopes: [REMILIA_SCOPE_STATS_READ],
      })),
      refresh: vi.fn(),
    };
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(REMILIA_API_V1_SUCCESS_FIXTURES.getMyStats), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    const [handler] = createRemiliaApiRouterHandlers(new RemiliaApiClient({ auth, fetch: fetchMock }));

    const response = await handler.handle(
      { type: "remiliaApi:request", operation: "getMyStats" },
      { id: "milxdy-extension" } as chrome.runtime.MessageSender,
    );

    expect(response).toMatchObject({ ok: true, status: 200, data: { handle: "remilia" } });
    expect(JSON.stringify(response)).not.toContain("background-only-token");
    expect(auth.prepare).toHaveBeenCalledWith([REMILIA_SCOPE_STATS_READ], expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("fails a scope bypass before network access", async () => {
    const auth: RemiliaApiAuthProvider = {
      prepare: vi.fn(async (): Promise<RemiliaApiAuthGrant> => ({
        ok: true,
        accessToken: "background-only-token",
        tokenType: "Bearer",
        expiresAt: Date.now() + 60_000,
        grantedScopes: [],
      })),
      refresh: vi.fn(),
    };
    const fetchMock = vi.fn<typeof fetch>();
    const [handler] = createRemiliaApiRouterHandlers(new RemiliaApiClient({ auth, fetch: fetchMock }));

    const response = await handler.handle(
      { type: "remiliaApi:request", operation: "getMyStats" },
      { id: "milxdy-extension" } as chrome.runtime.MessageSender,
    );

    expect(response).toMatchObject({ ok: false, error: { code: "insufficient_scope", status: 403 } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
