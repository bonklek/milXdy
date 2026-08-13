import { describe, expect, it, vi } from "vitest";
import {
  REMILIA_API_SCOPES,
  REMILIA_SCOPE_BEETLE_READ,
  REMILIA_SCOPE_CHAT_READ,
  REMILIA_SCOPE_CHAT_WRITE,
  REMILIA_SCOPE_DIRECTORY_READ,
  REMILIA_SCOPE_NOTIFICATIONS_READ,
  REMILIA_SCOPE_POKES_WRITE,
  REMILIA_SCOPE_STATS_READ,
  RemiliaApiClient,
  isAllowedRemiliaApiV1Request,
  type RemiliaApiAuthGrant,
  type RemiliaApiAuthProvider,
  type RemiliaApiDiagnostic,
} from "./remilia-api";
import { REMILIA_API_V1_ERROR_FIXTURES, REMILIA_API_V1_SUCCESS_FIXTURES } from "./__fixtures__/remilia-api-v1";

function grant(accessToken = "fixture-access-token", scopes: readonly string[] = REMILIA_API_SCOPES): RemiliaApiAuthGrant {
  return { ok: true, accessToken, tokenType: "Bearer", expiresAt: 9_999_999_999_999, grantedScopes: [...scopes] };
}

function authProvider(initial: RemiliaApiAuthGrant = grant(), refreshed: RemiliaApiAuthGrant = grant("refreshed-access-token")): RemiliaApiAuthProvider {
  return {
    prepare: vi.fn(async () => initial),
    refresh: vi.fn(async () => refreshed),
  };
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

describe("Remilia API v1 endpoint fixtures", () => {
  it("covers and accepts every documented endpoint", async () => {
    const fixtures = REMILIA_API_V1_SUCCESS_FIXTURES;
    expect(Object.keys(fixtures).sort()).toEqual([
      "getMe", "getMyBeetle", "getMyBeetleCards", "getMyStats", "getUserProfile", "listDirectoryUsers",
      "listGlobalChatMessages", "listMyNotifications", "pokeUser", "postGlobalChatMessage", "resolveDirectory",
    ].sort());

    const fetchMock = vi.fn<typeof fetch>();
    for (const fixture of Object.values(fixtures)) fetchMock.mockResolvedValueOnce(jsonResponse(fixture));
    const client = new RemiliaApiClient({ auth: authProvider(), fetch: fetchMock });
    const results = [
      await client.getUserProfile("remilia"),
      await client.getMe(),
      await client.getMyStats(),
      await client.listMyNotifications({ limit: 20, page: 1 }),
      await client.getMyBeetle(),
      await client.getMyBeetleCards(),
      await client.pokeUser("remilia"),
      await client.listGlobalChatMessages({ limit: 50 }),
      await client.postGlobalChatMessage("gm", "1042"),
      await client.resolveDirectory([{ type: "handle", value: "remilia" }]),
      await client.listDirectoryUsers({ limit: 100 }),
    ];

    expect(results.every((result) => result.ok)).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(11);
  });

  it("covers and normalizes every documented error without retaining private messages", async () => {
    for (const [code, fixture] of Object.entries(REMILIA_API_V1_ERROR_FIXTURES)) {
      const client = new RemiliaApiClient({
        auth: authProvider(),
        fetch: vi.fn(async () => jsonResponse(fixture.body, fixture.status)),
      });
      const result = await client.getUserProfile("remilia");
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe(code);
        expect(JSON.stringify(result)).not.toContain("private server detail");
        expect(JSON.stringify(result)).not.toContain("scope remilia:pokes.write required");
      }
    }
  });
});

describe("Remilia API v1 security boundary", () => {
  it("allows only exact documented method/path/query combinations", () => {
    expect(isAllowedRemiliaApiV1Request("GET", "https://www.remilia.net/api/v1/me/stats")).toBe(true);
    expect(isAllowedRemiliaApiV1Request("GET", "https://www.remilia.net/api/v1/users?limit=25&cursor=abc")).toBe(true);
    expect(isAllowedRemiliaApiV1Request("POST", "https://www.remilia.net/api/v1/users/remilia/poke")).toBe(true);
    expect(isAllowedRemiliaApiV1Request("GET", "https://evil.example/api/v1/me/stats")).toBe(false);
    expect(isAllowedRemiliaApiV1Request("GET", "https://www.remilia.net/api/v1/me/stats?url=https://evil.example")).toBe(false);
    expect(isAllowedRemiliaApiV1Request("POST", "https://www.remilia.net/api/v1/me/stats")).toBe(false);
    expect(isAllowedRemiliaApiV1Request("GET", "https://www.remilia.net/api/v1/admin")).toBe(false);
  });

  it("fails closed on missing or case-mismatched delegated scopes before fetch", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const auth = authProvider(grant("token", ["REMILIA:STATS.READ"]));
    const client = new RemiliaApiClient({ auth, fetch: fetchMock });

    const result = await client.getMyStats();

    expect(result).toMatchObject({ ok: false, error: { status: 403, code: "insufficient_scope", category: "authorization" } });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(auth.prepare).toHaveBeenCalledWith([REMILIA_SCOPE_STATS_READ], expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("injects bearer credentials only inside the trusted fetch call", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse(REMILIA_API_V1_SUCCESS_FIXTURES.getMyStats));
    const client = new RemiliaApiClient({ auth: authProvider(grant("private-bearer")), fetch: fetchMock });

    const result = await client.getMyStats();

    expect(result.ok).toBe(true);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe("https://www.remilia.net/api/v1/me/stats");
    expect(new Headers(init?.headers).get("Authorization")).toBe("Bearer private-bearer");
    expect(init).toMatchObject({ credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
  });

  it("emits bounded diagnostics without credentials, paths, or response content", async () => {
    const diagnostics: RemiliaApiDiagnostic[] = [];
    const client = new RemiliaApiClient({
      auth: authProvider(grant("private-bearer")),
      fetch: vi.fn(async () => jsonResponse({ error: { code: "forbidden", message: "private response body" } }, 403)),
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
    });

    await client.pokeUser("private-username");

    expect(diagnostics).toEqual([{ operation: "pokeUser", ok: false, attempt: 1, status: 403, category: "authorization", code: "forbidden" }]);
    expect(JSON.stringify(diagnostics)).not.toContain("private-bearer");
    expect(JSON.stringify(diagnostics)).not.toContain("private-username");
    expect(JSON.stringify(diagnostics)).not.toContain("private response body");
  });
});

describe("Remilia API v1 retry, rate limit, and cancellation", () => {
  it("refreshes once for a 401 and retries once with the rotated bearer", async () => {
    const auth = authProvider(grant("first-token", [REMILIA_SCOPE_STATS_READ]), grant("second-token", [REMILIA_SCOPE_STATS_READ]));
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ error: { code: "invalid_token", message: "expired" } }, 401))
      .mockResolvedValueOnce(jsonResponse(REMILIA_API_V1_SUCCESS_FIXTURES.getMyStats));
    const client = new RemiliaApiClient({ auth, fetch: fetchMock });

    const result = await client.getMyStats();

    expect(result.ok).toBe(true);
    expect(auth.refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new Headers(fetchMock.mock.calls[0][1]?.headers).get("Authorization")).toBe("Bearer first-token");
    expect(new Headers(fetchMock.mock.calls[1][1]?.headers).get("Authorization")).toBe("Bearer second-token");
  });

  it("stops after the retried request returns a second 401", async () => {
    const auth = authProvider(grant("first-token", [REMILIA_SCOPE_STATS_READ]), grant("second-token", [REMILIA_SCOPE_STATS_READ]));
    const unauthorized = jsonResponse({ error: { code: "invalid_token", message: "expired" } }, 401);
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(unauthorized)
      .mockResolvedValueOnce(jsonResponse({ error: { code: "invalid_token", message: "still expired" } }, 401));
    const client = new RemiliaApiClient({ auth, fetch: fetchMock });

    const result = await client.getMyStats();

    expect(result).toMatchObject({ ok: false, error: { code: "invalid_token", status: 401 } });
    expect(auth.refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not refresh 403 or 429 responses and keeps them distinct", async () => {
    const auth = authProvider(grant("token", [REMILIA_SCOPE_POKES_WRITE]));
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(REMILIA_API_V1_ERROR_FIXTURES.insufficient_scope.body, 403))
      .mockResolvedValueOnce(jsonResponse(REMILIA_API_V1_ERROR_FIXTURES.poke_cooldown.body, 429));
    const client = new RemiliaApiClient({ auth, fetch: fetchMock, now: () => 1_754_870_400_000 });

    const forbidden = await client.pokeUser("first-user");
    const cooldown = await client.pokeUser("second-user");

    expect(forbidden).toMatchObject({ ok: false, error: { category: "authorization", status: 403, code: "insufficient_scope" } });
    expect(cooldown).toMatchObject({ ok: false, error: { category: "cooldown", status: 429, code: "poke_cooldown" } });
    expect(auth.refresh).not.toHaveBeenCalled();
  });

  it("honors Retry-After locally before issuing another request", async () => {
    let now = 10_000;
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(REMILIA_API_V1_ERROR_FIXTURES.rate_limited.body, 429, { "Retry-After": "2" }))
      .mockResolvedValueOnce(jsonResponse(REMILIA_API_V1_SUCCESS_FIXTURES.postGlobalChatMessage, 201));
    const client = new RemiliaApiClient({ auth: authProvider(grant("token", [REMILIA_SCOPE_CHAT_WRITE])), fetch: fetchMock, now: () => now });

    expect(await client.postGlobalChatMessage("one")).toMatchObject({ ok: false, error: { retryAfterMs: 2_000 } });
    expect(await client.postGlobalChatMessage("two")).toMatchObject({ ok: false, error: { status: 429 } });
    expect(fetchMock).toHaveBeenCalledOnce();
    now += 2_001;
    expect((await client.postGlobalChatMessage("three")).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("exposes standard rate-limit headers and pauses at zero remaining until reset", async () => {
    let now = 10_000;
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(REMILIA_API_V1_SUCCESS_FIXTURES.getMyStats, 200, {
        "RateLimit-Limit": "100",
        "RateLimit-Remaining": "0",
        "RateLimit-Reset": "12",
      }))
      .mockResolvedValueOnce(jsonResponse(REMILIA_API_V1_SUCCESS_FIXTURES.getMyStats));
    const client = new RemiliaApiClient({ auth: authProvider(grant("token", [REMILIA_SCOPE_STATS_READ])), fetch: fetchMock, now: () => now });

    expect(await client.getMyStats()).toMatchObject({ ok: true, rateLimit: { limit: 100, remaining: 0, resetAt: 12_000 } });
    expect(await client.getMyStats()).toMatchObject({ ok: false, error: { code: "rate_limited", retryAfterMs: 2_000 } });
    expect(fetchMock).toHaveBeenCalledOnce();
    now = 12_001;
    expect((await client.getMyStats()).ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("normalizes caller abort without leaking the abort reason", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      if (init?.signal?.aborted) reject(init.signal.reason);
      else init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const client = new RemiliaApiClient({ auth: authProvider(grant("token", [REMILIA_SCOPE_BEETLE_READ])), fetch: fetchMock });

    const pending = client.getMyBeetle({ signal: controller.signal });
    controller.abort(new Error("private abort reason"));
    const result = await pending;

    expect(result).toMatchObject({ ok: false, error: { category: "aborted", code: "request_aborted" } });
    expect(JSON.stringify(result)).not.toContain("private abort reason");
  });

  it("propagates cancellation through auth preparation", async () => {
    const controller = new AbortController();
    const auth: RemiliaApiAuthProvider = {
      prepare: vi.fn((_scopes, options) => new Promise<RemiliaApiAuthGrant>((_resolve, reject) => {
        options?.signal?.addEventListener("abort", () => reject(options.signal?.reason));
      })),
      refresh: vi.fn(),
    };
    const client = new RemiliaApiClient({ auth, fetch: vi.fn<typeof fetch>() });

    const pending = client.getMyStats({ signal: controller.signal });
    controller.abort(new Error("private auth abort reason"));
    const result = await pending;

    expect(result).toMatchObject({ ok: false, error: { category: "aborted", code: "request_aborted" } });
    expect(JSON.stringify(result)).not.toContain("private auth abort reason");
  });

  it("aborts and normalizes requests that exceed the configured timeout", async () => {
    const fetchMock = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
    }));
    const client = new RemiliaApiClient({
      auth: authProvider(grant("token", [REMILIA_SCOPE_BEETLE_READ])),
      fetch: fetchMock,
      timeoutMs: 5,
    });

    const result = await client.getMyBeetle();

    expect(result).toMatchObject({ ok: false, error: { category: "timeout", code: "request_timeout" } });
  });
});

describe("Remilia API v1 pagination", () => {
  it("collects numbered notification pages", async () => {
    const first = structuredClone(REMILIA_API_V1_SUCCESS_FIXTURES.listMyNotifications) as any;
    first.data.has_more = true;
    const second = structuredClone(first);
    second.data.page = 2;
    second.data.has_more = false;
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(jsonResponse(first)).mockResolvedValueOnce(jsonResponse(second));
    const client = new RemiliaApiClient({ auth: authProvider(grant("token", [REMILIA_SCOPE_NOTIFICATIONS_READ])), fetch: fetchMock });

    const result = await client.collectMyNotifications({ limit: 20 });

    expect(result.ok && result.data).toHaveLength(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain("page=1");
    expect(String(fetchMock.mock.calls[1][0])).toContain("page=2");
  });

  it("follows chat and directory cursors verbatim and stops at the final page", async () => {
    const chatFirst = structuredClone(REMILIA_API_V1_SUCCESS_FIXTURES.listGlobalChatMessages) as any;
    const chatLast = structuredClone(chatFirst);
    chatLast.data.has_more = false;
    chatLast.data.next_cursor = null;
    const directoryFirst = structuredClone(REMILIA_API_V1_SUCCESS_FIXTURES.listDirectoryUsers) as any;
    const directoryLast = structuredClone(directoryFirst);
    directoryLast.data.next_cursor = null;
    const fetchMock = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse(chatFirst)).mockResolvedValueOnce(jsonResponse(chatLast))
      .mockResolvedValueOnce(jsonResponse(directoryFirst)).mockResolvedValueOnce(jsonResponse(directoryLast));
    const client = new RemiliaApiClient({
      auth: authProvider(grant("token", [REMILIA_SCOPE_CHAT_READ, REMILIA_SCOPE_DIRECTORY_READ])),
      fetch: fetchMock,
    });

    expect((await client.collectGlobalChatMessages()).ok).toBe(true);
    expect((await client.collectDirectoryUsers()).ok).toBe(true);
    expect(String(fetchMock.mock.calls[1][0])).toContain("before=998");
    expect(String(fetchMock.mock.calls[3][0])).toContain("cursor=MTA0Mg");
  });
});
