import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CLIENT_ID = "milxdy-beta-test";
const REDIRECT_URI = "https://abcdefghijklmnopabcdefghijklmnop.chromiumapp.org/remilia-oauth";
const ISSUER = "https://www.remilia.net/oidc/realms/remilia";
const DISCOVERY_URL = `${ISSUER}/.well-known/openid-configuration`;
const AUTHORIZATION_ENDPOINT = `${ISSUER}/protocol/openid-connect/auth`;
const TOKEN_ENDPOINT = `${ISSUER}/protocol/openid-connect/token`;
const REVOCATION_ENDPOINT = `${ISSUER}/protocol/openid-connect/revoke`;
const JWKS_ENDPOINT = `${ISSUER}/protocol/openid-connect/certs`;
const REQUIRED_SCOPES = [
  "remilia:stats.read",
  "remilia:notifications.read",
  "remilia:pokes.write",
  "remilia:beetle.read",
  "remilia:chat.read",
  "remilia:chat.write",
  "remilia:directory.read",
] as const;
const SIGNING_KEY_ID = "milxdy-test-key";
const TEST_KEYS = generateKeyPairSync("rsa", { modulusLength: 2048 });
const TEST_PUBLIC_JWK = TEST_KEYS.publicKey.export({ format: "jwk" });

type StorageFixture = {
  local: Map<string, unknown>;
  session: Map<string, unknown>;
  localArea: ReturnType<typeof storageArea>;
  sessionArea: ReturnType<typeof storageArea> & { setAccessLevel: ReturnType<typeof vi.fn> };
};

beforeEach(() => {
  vi.resetModules();
  vi.useRealTimers();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("Remilia OIDC PKCE", () => {
  it("uses discovery, exact callback/state, S256 PKCE, and nonce-bound ID tokens", async () => {
    const fixture = installChrome();
    let authorizationUrl = "";
    const launchWebAuthFlow = vi.mocked(chrome.identity.launchWebAuthFlow);
    launchWebAuthFlow.mockImplementation(async ({ url }) => {
      authorizationUrl = url;
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=one-use-code&state=${state}&iss=${encodeURIComponent(ISSUER)}`;
    });
    const fetchMock = installSuccessfulFetch(() => authorizationUrl);

    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");
    const result = await auth.connectRemiliaAuth();

    expect(result).toMatchObject({ ok: true, accessToken: "access-one", tokenType: "Bearer" });
    expect(launchWebAuthFlow).toHaveBeenCalledWith(
      expect.objectContaining({ interactive: true }),
      expect.any(Function),
    );
    expect(launchWebAuthFlow.mock.invocationCallOrder[0]).toBeLessThan(fetchMock.mock.invocationCallOrder[0]);
    const authorization = new URL(authorizationUrl);
    expect(authorization.origin + authorization.pathname).toBe(AUTHORIZATION_ENDPOINT);
    expect(authorization.searchParams.get("client_id")).toBe(CLIENT_ID);
    expect(authorization.searchParams.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(authorization.searchParams.get("scope")?.split(" ")).toEqual(["openid", ...REQUIRED_SCOPES]);
    expect(authorization.searchParams.get("prompt")).toBe("consent");
    expect(authorization.searchParams.get("code_challenge_method")).toBe("S256");
    expect(authorization.searchParams.get("state")).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(authorization.searchParams.get("nonce")).toMatch(/^[A-Za-z0-9_-]{40,}$/);

    const tokenCall = fetchMock.mock.calls.find(([input]) => String(input) === TOKEN_ENDPOINT);
    const body = new URLSearchParams(String((tokenCall?.[1] as RequestInit)?.body));
    const verifier = body.get("code_verifier") || "";
    const expectedChallenge = createHash("sha256").update(verifier).digest("base64url");
    expect(authorization.searchParams.get("code_challenge")).toBe(expectedChallenge);
    expect(body.get("redirect_uri")).toBe(REDIRECT_URI);
    expect(body.get("client_id")).toBe(CLIENT_ID);
    for (const endpoint of [DISCOVERY_URL, TOKEN_ENDPOINT, JWKS_ENDPOINT]) {
      const call = fetchMock.mock.calls.find(([input]) => String(input) === endpoint);
      expect(call?.[1]).toMatchObject({
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
    }

    expect(JSON.stringify([...fixture.local.values()])).not.toContain("access-one");
    expect(JSON.stringify([...fixture.local.values()])).not.toContain("refresh-one");
    expect(JSON.stringify([...fixture.session.values()])).toContain("access-one");
    expect(fixture.sessionArea.setAccessLevel).toHaveBeenCalledWith({ accessLevel: "TRUSTED_CONTEXTS" });
    expect(await auth.getRemiliaAuthStatus()).toMatchObject({
      phase: "connected",
      identity: { id: "user-1", username: "milady" },
      grantedScopes: expect.arrayContaining(["openid", "remilia:beetle.read"]),
    });
    expect(JSON.stringify(await auth.getRemiliaAuthStatus())).not.toContain("access-one");
  });

  it("fails closed on callback state mismatch", async () => {
    const fixture = installChrome();
    vi.mocked(chrome.identity.launchWebAuthFlow).mockResolvedValue(`${REDIRECT_URI}?code=code&state=wrong` as never);
    const fetchMock = installSuccessfulFetch(() => "");
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "STATE_MISMATCH" });
    expect((await auth.getRemiliaAuthStatus()).lastError).toEqual({ code: "AUTH_RESPONSE_INVALID" });
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === TOKEN_ENDPOINT)).toHaveLength(0);
    expect(fixture.session.size).toBe(0);
  });

  it("fails closed on duplicated callback security parameters", async () => {
    const fixture = installChrome();
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=one&code=two&state=${state}&state=${state}`;
    });
    const fetchMock = installSuccessfulFetch(() => "");
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "STATE_MISMATCH" });
    expect(fetchMock.mock.calls.filter(([input]) => String(input) === TOKEN_ENDPOINT)).toHaveLength(0);
    expect(fixture.session.size).toBe(0);
  });

  it("fails closed on redirect mismatch", async () => {
    const fixture = installChrome();
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      const state = new URL(url).searchParams.get("state");
      return `https://attacker.example/remilia-oauth?code=code&state=${state}`;
    });
    installSuccessfulFetch(() => "");
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "REDIRECT_MISMATCH" });
    expect(fixture.session.size).toBe(0);
  });

  it("fails closed when the returned ID token nonce does not match", async () => {
    const fixture = installChrome();
    let authorizationUrl = "";
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      authorizationUrl = url;
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=code&state=${state}`;
    });
    installSuccessfulFetch(() => authorizationUrl, { nonce: "wrong-nonce" });
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "NONCE_MISMATCH" });
    expect(fixture.session.size).toBe(0);
  });

  it("fails closed when the ID token authorized party does not match this client", async () => {
    const fixture = installChrome();
    let authorizationUrl = "";
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      authorizationUrl = url;
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=code&state=${state}`;
    });
    installSuccessfulFetch(() => authorizationUrl, {
      claims: { azp: "other-client" },
    });
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "TOKEN_EXCHANGE_FAILED" });
    expect(fixture.session.size).toBe(0);
  });

  it("accepts a multi-audience ID token only when this client is the authorized party", async () => {
    const fixture = installChrome();
    let authorizationUrl = "";
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      authorizationUrl = url;
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=code&state=${state}`;
    });
    installSuccessfulFetch(() => authorizationUrl, {
      claims: { aud: [CLIENT_ID, "other-client"], azp: CLIENT_ID },
    });
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: true, accessToken: "access-one" });
    expect(fixture.session.size).toBe(1);
  });

  it("fails closed when a multi-audience ID token omits the authorized party", async () => {
    const fixture = installChrome();
    let authorizationUrl = "";
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      authorizationUrl = url;
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=code&state=${state}`;
    });
    installSuccessfulFetch(() => authorizationUrl, {
      claims: { aud: [CLIENT_ID, "other-client"], azp: undefined },
    });
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "TOKEN_EXCHANGE_FAILED" });
    expect(fixture.session.size).toBe(0);
  });

  it("fails closed when the ID token has no issued-at claim", async () => {
    const fixture = installChrome();
    let authorizationUrl = "";
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      authorizationUrl = url;
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=code&state=${state}`;
    });
    installSuccessfulFetch(() => authorizationUrl, { claims: { iat: undefined } });
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "TOKEN_EXCHANGE_FAILED" });
    expect(fixture.session.size).toBe(0);
  });

  it("maps user denial without exposing the browser error", async () => {
    installChrome();
    vi.mocked(chrome.identity.launchWebAuthFlow).mockRejectedValue(new Error("The user did not approve access."));
    installSuccessfulFetch(() => "");
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "ACCESS_DENIED" });
    expect((await auth.getRemiliaAuthStatus()).lastError).toEqual({ code: "ACCESS_DENIED" });
  });

  it.each([
    ["Authorization page could not be loaded.", "AUTH_PAGE_LOAD_FAILED"],
    ["Authorization page load timed out.", "AUTH_PAGE_LOAD_FAILED"],
    ["Couldn't create a browser window to display an authorization page.", "AUTH_WINDOW_UNAVAILABLE"],
    ["Identity API is disabled in incognito windows.", "AUTH_WINDOW_UNAVAILABLE"],
    ["Only one web auth flow is allowed at a time.", "CONCURRENT_LOGIN"],
    ["A future native identity failure.", "AUTH_WINDOW_FAILED"],
  ])("captures and bounds native launch rejection %s", async (nativeMessage, expectedCode) => {
    const fixture = installChrome();
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(((_details: chrome.identity.WebAuthFlowDetails, callback?: (responseUrl?: string) => void) => {
      (chrome.runtime as typeof chrome.runtime & { lastError?: { message: string } }).lastError = { message: nativeMessage };
      callback?.();
      delete (chrome.runtime as typeof chrome.runtime & { lastError?: { message: string } }).lastError;
      return undefined;
    }) as never);
    installSuccessfulFetch(() => "");
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: expectedCode });
    expect((await auth.getRemiliaAuthStatus()).lastError).toEqual({ code: expectedCode });
    expect(JSON.stringify([...fixture.local.values()])).not.toContain(nativeMessage);
  });

  it("reports a timeout but retains the native attempt so retries cannot orphan or duplicate it", async () => {
    installChrome();
    let authorizationStarted = false;
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(() => {
      authorizationStarted = true;
      return new Promise(() => undefined);
    });
    installSuccessfulFetch(() => "");
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    vi.useFakeTimers();
    const pending = auth.connectRemiliaAuth({ timeoutMs: 1_000 });
    await vi.waitFor(() => expect(authorizationStarted).toBe(true));
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toMatchObject({ ok: false, error: "AUTH_TIMEOUT" });
    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "CONCURRENT_LOGIN" });
    expect(chrome.identity.launchWebAuthFlow).toHaveBeenCalledTimes(1);
    expect((await auth.getRemiliaAuthStatus()).lastError).toEqual({ code: "CONCURRENT_LOGIN" });
  });

  it("maps an unexpected setup failure to an actionable setup stage", async () => {
    installChrome();
    vi.mocked(chrome.identity.getRedirectURL).mockImplementation(() => { throw new Error("unexpected setup failure"); });
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "AUTH_SETUP_FAILED" });
    expect((await auth.getRemiliaAuthStatus()).lastError).toEqual({ code: "AUTH_SETUP_FAILED" });
    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
  });

  it("maps session custody failure without exposing storage details", async () => {
    const fixture = installChrome();
    let authorizationUrl = "";
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      authorizationUrl = url;
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=code&state=${state}`;
    });
    installSuccessfulFetch(() => authorizationUrl);
    fixture.sessionArea.set.mockRejectedValueOnce(new Error("sensitive storage implementation detail"));
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "AUTH_STORAGE_FAILED" });
    expect((await auth.getRemiliaAuthStatus()).lastError).toEqual({ code: "AUTH_STORAGE_FAILED" });
    expect(JSON.stringify([...fixture.local.values()])).not.toContain("sensitive storage implementation detail");
  });

  it("bounds a stalled token exchange independently of the browser auth flow", async () => {
    installChrome();
    let tokenExchangeStarted = false;
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=code&state=${state}`;
    });
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      if (String(input) === DISCOVERY_URL) return jsonResponse(discovery());
      if (String(input) === TOKEN_ENDPOINT) {
        tokenExchangeStarted = true;
        return new Promise<Response>(() => undefined);
      }
      throw new Error("unexpected request");
    }));
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    vi.useFakeTimers();
    const pending = auth.connectRemiliaAuth();
    await vi.waitFor(() => expect(tokenExchangeStarted).toBe(true));
    await vi.advanceTimersByTimeAsync(10_000);
    await expect(pending).resolves.toMatchObject({ ok: false, error: "OFFLINE" });
  });

  it("rejects oversized OIDC JSON before storing credentials", async () => {
    const fixture = installChrome();
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=code&state=${state}`;
    });
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      if (String(input) === DISCOVERY_URL) return jsonResponse(discovery());
      if (String(input) === TOKEN_ENDPOINT) {
        return new Response(JSON.stringify({ access_token: "x".repeat(300_000) }), {
          headers: { "Content-Type": "application/json", "Content-Length": "300000" },
        });
      }
      throw new Error("unexpected request");
    }));
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "TOKEN_EXCHANGE_FAILED" });
    expect(fixture.session.size).toBe(0);
  });
});

describe("Remilia credential lifecycle", () => {
  it("rotates refresh tokens once for concurrent refresh callers", async () => {
    const fixture = installChrome();
    let authorizationUrl = "";
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      authorizationUrl = url;
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=code&state=${state}`;
    });
    let resolveRefresh: ((value: Response) => void) | undefined;
    let refreshCalls = 0;
    const baseFetch = successfulFetchImplementation(() => authorizationUrl);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      if (String(input) === TOKEN_ENDPOINT && new URLSearchParams(String(init?.body)).get("grant_type") === "refresh_token") {
        refreshCalls += 1;
        return new Promise<Response>((resolve) => { resolveRefresh = resolve; });
      }
      return baseFetch(input, init);
    }));
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");
    expect((await auth.connectRemiliaAuth()).ok).toBe(true);

    const first = auth.refreshRemiliaAccess(["remilia:beetle.read"]);
    const second = auth.refreshRemiliaAccess(["remilia:beetle.read"]);
    await vi.waitFor(() => expect(refreshCalls).toBe(1));
    resolveRefresh?.(jsonResponse({
      access_token: "access-two",
      refresh_token: "refresh-two",
      id_token: jwt({
        iss: ISSUER,
        aud: CLIENT_ID,
        sub: "user-1",
        preferred_username: "milady",
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
      token_type: "Bearer",
      expires_in: 3600,
      scope: "openid remilia:beetle.read",
    }));

    await expect(first).resolves.toMatchObject({ ok: true, accessToken: "access-two" });
    await expect(second).resolves.toMatchObject({ ok: true, accessToken: "access-two" });
    expect(JSON.stringify([...fixture.session.values()])).toContain("refresh-two");
    expect(JSON.stringify([...fixture.session.values()])).not.toContain("refresh-one");
  });

  it("clears credentials when refresh is rejected as expired or revoked", async () => {
    const fixture = installChrome();
    let authorizationUrl = "";
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      authorizationUrl = url;
      return `${REDIRECT_URI}?code=code&state=${new URL(url).searchParams.get("state")}`;
    });
    const baseFetch = successfulFetchImplementation(() => authorizationUrl);
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const body = new URLSearchParams(String(init?.body));
      if (String(input) === TOKEN_ENDPOINT && body.get("grant_type") === "refresh_token") {
        return jsonResponse({ error: "invalid_grant" }, 400);
      }
      return baseFetch(input, init);
    }));
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");
    expect((await auth.connectRemiliaAuth()).ok).toBe(true);

    await expect(auth.refreshRemiliaAccess()).resolves.toMatchObject({ ok: false, error: "REFRESH_REJECTED" });
    expect(fixture.session.size).toBe(0);
    expect((await auth.getRemiliaAuthStatus()).phase).toBe("expired");
  });

  it("restores session-vault credentials after a service-worker module restart", async () => {
    const fixture = installChrome();
    let authorizationUrl = "";
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      authorizationUrl = url;
      return `${REDIRECT_URI}?code=code&state=${new URL(url).searchParams.get("state")}`;
    });
    installSuccessfulFetch(() => authorizationUrl);
    let auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");
    expect((await auth.connectRemiliaAuth()).ok).toBe(true);

    vi.resetModules();
    auth = await loadAuth();
    await expect(auth.prepareRemiliaAccess(["remilia:beetle.read"])).resolves.toMatchObject({
      ok: true,
      accessToken: "access-one",
    });
    expect(JSON.stringify([...fixture.local.values()])).not.toContain("access-one");
  });

  it("rejects concurrent login and disconnect cancels the in-flight attempt", async () => {
    const fixture = installChrome();
    let authorizationStarted = false;
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(() => {
      authorizationStarted = true;
      return new Promise(() => undefined);
    });
    installSuccessfulFetch(() => "");
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    const first = auth.connectRemiliaAuth();
    await vi.waitFor(() => expect(authorizationStarted).toBe(true));
    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "CONCURRENT_LOGIN" });
    await auth.disconnectRemiliaAuth();
    await expect(first).resolves.toMatchObject({ ok: false, error: "CANCELLED" });
    expect(fixture.session.size).toBe(0);
    expect((await auth.getRemiliaAuthStatus()).phase).toBe("disconnected");
  });

  it("revokes refresh and access credentials then always clears local custody", async () => {
    const fixture = installChrome();
    let authorizationUrl = "";
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      authorizationUrl = url;
      return `${REDIRECT_URI}?code=code&state=${new URL(url).searchParams.get("state")}`;
    });
    const fetchMock = installSuccessfulFetch(() => authorizationUrl);
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");
    expect((await auth.connectRemiliaAuth()).ok).toBe(true);

    await expect(auth.revokeRemiliaAuth()).resolves.toEqual({ remoteRevoked: true });
    const revokedBodies = fetchMock.mock.calls
      .filter(([input]) => String(input) === REVOCATION_ENDPOINT)
      .map(([, init]) => new URLSearchParams(String((init as RequestInit)?.body)));
    expect(revokedBodies).toHaveLength(2);
    expect(revokedBodies.map((body) => body.get("token_type_hint"))).toEqual(["refresh_token", "access_token"]);
    for (const [, init] of fetchMock.mock.calls.filter(([input]) => String(input) === REVOCATION_ENDPOINT)) {
      expect(init).toMatchObject({
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
      });
    }
    expect(fixture.session.size).toBe(0);
    expect((await auth.getRemiliaAuthStatus()).phase).toBe("disconnected");
  });
});

describe("Remilia migration and scope boundaries", () => {
  it("keeps keyless Firefox-compatible builds token-free and noninteractive", async () => {
    const fixture = installChrome({
      local: {
        "beetol.accessToken": "legacy-access",
        "beetol.refreshToken": "legacy-refresh",
      },
    });
    const auth = await import("./remilia-auth");

    await expect(auth.getRemiliaAuthStatus()).resolves.toMatchObject({
      phase: "unsupported",
      grantedScopes: [],
      lastError: { code: "UNSUPPORTED" },
    });
    await expect(auth.prepareRemiliaAccess(["remilia:beetle.read"]))
      .resolves.toMatchObject({ ok: false, error: "UNSUPPORTED", missingScopes: ["remilia:beetle.read"] });
    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "UNSUPPORTED" });

    expect(chrome.identity.launchWebAuthFlow).not.toHaveBeenCalled();
    expect(fixture.session.size).toBe(0);
    expect(fixture.local.get("beetol.accessToken")).toBe("legacy-access");
    expect(fixture.local.get("beetol.refreshToken")).toBe("legacy-refresh");
  });

  it("requires explicit update migration and deletes only legacy auth material on consent", async () => {
    const fixture = installChrome({
      local: {
        "beetol.accessToken": "legacy-access",
        "beetol.refreshToken": "legacy-refresh",
        "bextol.accessToken": "older-access",
        "bextol.refreshToken": "older-refresh",
        "unrelated.setting": "keep-me",
      },
    });
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("update");

    expect((await auth.getRemiliaAuthStatus()).phase).toBe("migration-required");
    await expect(auth.prepareRemiliaAccess()).resolves.toMatchObject({ ok: false, error: "MIGRATION_REQUIRED" });
    expect(fixture.local.get("beetol.refreshToken")).toBe("legacy-refresh");

    await auth.completeRemiliaAuthMigration();
    expect(fixture.local.get("beetol.accessToken")).toBeUndefined();
    expect(fixture.local.get("bextol.refreshToken")).toBeUndefined();
    expect(fixture.local.get("unrelated.setting")).toBe("keep-me");
    expect(await auth.getRemiliaAuthStatus()).toMatchObject({
      phase: "disconnected",
      migration: { version: 1, required: false, legacyDeleted: true },
    });
  });

  it("checks delegated scopes using exact case-sensitive set membership", async () => {
    installChrome();
    const auth = await loadAuth();
    expect(auth.hasRequiredRemiliaScopes(["remilia:beetle.read"], ["remilia:beetle.read"])).toBe(true);
    expect(auth.hasRequiredRemiliaScopes(["remilia:beetle.read.extra"], ["remilia:beetle.read"])).toBe(false);
    expect(auth.hasRequiredRemiliaScopes(["Remilia:beetle.read"], ["remilia:beetle.read"])).toBe(false);
  });

  it("rejects discovery endpoints outside the fixed issuer origin", async () => {
    const fixture = installChrome();
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=code&state=${state}`;
    });
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      if (String(input) === DISCOVERY_URL) {
        return jsonResponse({
          ...discovery(),
          token_endpoint: "https://attacker.example/token",
        });
      }
      if (String(input) === JWKS_ENDPOINT) return jsonResponse({ keys: [] });
      throw new Error("unexpected request");
    }));
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "DISCOVERY_FAILED" });
    expect((await auth.getRemiliaAuthStatus()).lastError).toEqual({ code: "AUTH_SETUP_FAILED" });
    expect(fixture.session.size).toBe(0);
  });

  it("rejects unexpected discovery paths on the fixed issuer origin", async () => {
    const fixture = installChrome();
    vi.mocked(chrome.identity.launchWebAuthFlow).mockImplementation(async ({ url }) => {
      const state = new URL(url).searchParams.get("state");
      return `${REDIRECT_URI}?code=code&state=${state}`;
    });
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      if (String(input) === DISCOVERY_URL) {
        return jsonResponse({
          ...discovery(),
          token_endpoint: `${ISSUER}/protocol/openid-connect/token/alternate`,
        });
      }
      throw new Error("unexpected request");
    }));
    const auth = await loadAuth();
    await auth.noteRemiliaAuthInstalled("install");

    await expect(auth.connectRemiliaAuth()).resolves.toMatchObject({ ok: false, error: "DISCOVERY_FAILED" });
    expect((await auth.getRemiliaAuthStatus()).lastError).toEqual({ code: "AUTH_SETUP_FAILED" });
    expect(fixture.session.size).toBe(0);
  });
});

async function loadAuth() {
  const auth = await import("./remilia-auth");
  auth.configureRemiliaAuthClient({ clientId: CLIENT_ID, redirectPath: "remilia-oauth" });
  return auth;
}

function installChrome(initial: { local?: Record<string, unknown>; session?: Record<string, unknown> } = {}): StorageFixture {
  const local = new Map(Object.entries(initial.local || {}));
  const session = new Map(Object.entries(initial.session || {}));
  const localArea = storageArea(local);
  const sessionArea = Object.assign(storageArea(session), { setAccessLevel: vi.fn(async () => undefined) });
  vi.stubGlobal("chrome", {
    runtime: {
      id: "abcdefghijklmnopabcdefghijklmnop",
      getURL: vi.fn((path = "") => `chrome-extension://abcdefghijklmnopabcdefghijklmnop/${path}`),
    },
    identity: {
      getRedirectURL: vi.fn(() => REDIRECT_URI),
      launchWebAuthFlow: vi.fn(),
    },
    storage: { local: localArea, session: sessionArea },
  });
  return { local, session, localArea, sessionArea };
}

function storageArea(store: Map<string, unknown>) {
  return {
    get: vi.fn(async (keys?: string | string[] | Record<string, unknown> | null) => {
      if (keys == null) return Object.fromEntries(store);
      if (typeof keys === "string") return { [keys]: store.get(keys) };
      if (Array.isArray(keys)) return Object.fromEntries(keys.map((key) => [key, store.get(key)]));
      return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, store.has(key) ? store.get(key) : fallback]));
    }),
    set: vi.fn(async (values: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(values)) store.set(key, value);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) store.delete(key);
    }),
  };
}

function installSuccessfulFetch(
  getAuthorizationUrl: () => string,
  overrides: { nonce?: string; claims?: Record<string, unknown> } = {},
) {
  const mock = vi.fn(successfulFetchImplementation(getAuthorizationUrl, overrides));
  vi.stubGlobal("fetch", mock);
  return mock;
}

function successfulFetchImplementation(
  getAuthorizationUrl: () => string,
  overrides: { nonce?: string; claims?: Record<string, unknown> } = {},
) {
  return async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    if (url === DISCOVERY_URL) return jsonResponse(discovery());
    if (url === JWKS_ENDPOINT) return jsonResponse({ keys: [{ ...TEST_PUBLIC_JWK, kid: SIGNING_KEY_ID, use: "sig", alg: "RS256" }] });
    if (url === REVOCATION_ENDPOINT) return jsonResponse({});
    if (url === TOKEN_ENDPOINT) {
      const body = new URLSearchParams(String(init?.body));
      const authorization = new URL(getAuthorizationUrl());
      const nonce = overrides.nonce ?? authorization.searchParams.get("nonce");
      return jsonResponse({
        access_token: "access-one",
        refresh_token: "refresh-one",
        id_token: jwt({
          iss: ISSUER,
          aud: CLIENT_ID,
          sub: "user-1",
          preferred_username: "milady",
          name: "Milady",
          nonce,
          exp: Math.floor(Date.now() / 1000) + 3600,
          ...overrides.claims,
        }),
        token_type: "Bearer",
        expires_in: 3600,
        scope: body.get("grant_type") === "refresh_token"
          ? "openid remilia:beetle.read"
          : "openid remilia:stats.read remilia:notifications.read remilia:pokes.write remilia:beetle.read remilia:chat.read remilia:chat.write remilia:directory.read",
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

function discovery() {
  return {
    issuer: ISSUER,
    authorization_endpoint: AUTHORIZATION_ENDPOINT,
    token_endpoint: TOKEN_ENDPOINT,
    jwks_uri: JWKS_ENDPOINT,
    revocation_endpoint: REVOCATION_ENDPOINT,
    end_session_endpoint: `${ISSUER}/protocol/openid-connect/logout`,
    userinfo_endpoint: `${ISSUER}/protocol/openid-connect/userinfo`,
    code_challenge_methods_supported: ["S256"],
    id_token_signing_alg_values_supported: ["RS256"],
  };
}

function jwt(claims: Record<string, unknown>): string {
  const encode = (value: Record<string, unknown>) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const signingInput = `${encode({ alg: "RS256", typ: "JWT", kid: SIGNING_KEY_ID })}.${encode({
    iat: Math.floor(Date.now() / 1000),
    ...claims,
  })}`;
  const signature = sign("RSA-SHA256", Buffer.from(signingInput), TEST_KEYS.privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
