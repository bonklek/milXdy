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
