import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Remilia auth logout boundary", () => {
  it("does not let delayed session adoption restore credentials after logout begins", async () => {
    const stored = new Map<string, unknown>();
    let resolveCookie: ((value: { value: string }) => void) | undefined;
    const delayedCookie = new Promise<{ value: string }>((resolve) => {
      resolveCookie = resolve;
    });

    vi.stubGlobal("chrome", {
      storage: {
        local: {
          get: vi.fn(async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, stored.get(key)]))),
          set: vi.fn(async (values: Record<string, unknown>) => {
            for (const [key, value] of Object.entries(values)) stored.set(key, value);
          }),
          remove: vi.fn(async (keys: string[]) => {
            for (const key of keys) stored.delete(key);
          }),
        },
      },
      cookies: {
        get: vi.fn(() => delayedCookie),
        set: vi.fn(async () => undefined),
        remove: vi.fn(async () => undefined),
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: "session-user" }),
    })));

    const auth = await import("./remilia-auth");
    const adoption = auth.adoptRemiliaBrowserSession("/api/profile/whoami");
    await vi.waitFor(() => expect(chrome.cookies.get).toHaveBeenCalledOnce());

    await auth.clearRemiliaAuth();
    resolveCookie?.({ value: "stale-access-token" });

    await expect(adoption).rejects.toMatchObject({ name: "AbortError" });
    expect(stored.get(auth.REMILIA_DISCONNECTED_KEY)).toBe(true);
    expect(stored.get(auth.REMILIA_ACCESS_TOKEN_KEY)).toBeUndefined();
    expect(chrome.cookies.set).not.toHaveBeenCalled();
  });
});

describe("Remilia auth token custody", () => {
  it("keeps issued bearer credentials out of extension storage", async () => {
    const stored = new Map<string, unknown>([
      ["beetol.accessToken", "legacy-access"],
      ["beetol.refreshToken", "legacy-refresh"],
    ]);
    const set = vi.fn(async (values: Record<string, unknown>) => {
      for (const [key, value] of Object.entries(values)) stored.set(key, value);
    });
    const remove = vi.fn(async (keys: string[]) => {
      for (const key of keys) stored.delete(key);
    });
    vi.stubGlobal("chrome", {
      storage: { local: { get: vi.fn(async (keys: string[]) => Object.fromEntries(keys.map((key) => [key, stored.get(key)]))), set, remove } },
      cookies: { get: vi.fn(async () => null), set: vi.fn(async () => undefined), remove: vi.fn(async () => undefined) },
    });
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => {
      if (String(input).includes("/token")) {
        return { ok: true, json: async () => ({ access_token: "new-access", refresh_token: "new-refresh" }) };
      }
      return { ok: true, json: async () => ({ id: "session-user" }) };
    }));

    const auth = await import("./remilia-auth");
    await auth.migrateRemiliaAuth();
    await auth.renewRemiliaAuth("/api/profile/whoami");

    expect(stored.get(auth.REMILIA_ACCESS_TOKEN_KEY)).toBeUndefined();
    expect(stored.get(auth.REMILIA_REFRESH_TOKEN_KEY)).toBeUndefined();
    expect(set).not.toHaveBeenCalledWith(expect.objectContaining({ [auth.REMILIA_ACCESS_TOKEN_KEY]: expect.anything() }));
    expect(remove).toHaveBeenCalledWith(expect.arrayContaining([auth.REMILIA_ACCESS_TOKEN_KEY, auth.REMILIA_REFRESH_TOKEN_KEY]));
  });
});
