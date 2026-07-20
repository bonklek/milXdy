import { describe, expect, it, vi } from "vitest";
import { resolveSocketAuthCredential } from "./socket-auth-policy";

describe("resolveSocketAuthCredential", () => {
  it("reuses a prepared access token without refreshing the browser session", async () => {
    const refreshBrowserSession = vi.fn();

    const result = await resolveSocketAuthCredential(
      async () => ({ ok: true, token: "prepared-token" }),
      refreshBrowserSession,
    );

    expect(result).toEqual({ ok: true, token: "prepared-token" });
    expect(refreshBrowserSession).not.toHaveBeenCalled();
  });

  it("accepts a signed-in browser session without requiring an exposed access-token cookie", async () => {
    const refreshBrowserSession = vi.fn();
    const result = await resolveSocketAuthCredential(
      async () => ({ ok: true }),
      refreshBrowserSession,
    );

    expect(result).toEqual({ ok: true });
    expect(refreshBrowserSession).not.toHaveBeenCalled();
  });

  it("uses a refreshed browser session after the prepared session fails", async () => {
    const result = await resolveSocketAuthCredential(
      async () => ({ ok: false, error: "AUTH_REQUIRED" }),
      async () => ({ ok: true }),
    );

    expect(result).toEqual({ ok: true });
  });

  it("refreshes after the server rejects a previously prepared socket credential", async () => {
    const prepare = vi.fn(async () => ({ ok: true, token: "stale-token" }));

    const result = await resolveSocketAuthCredential(
      prepare,
      async () => ({ ok: true }),
      { forceBrowserSessionRefresh: true },
    );

    expect(result).toEqual({ ok: true });
    expect(prepare).not.toHaveBeenCalled();
  });

  it("does not reuse a tokenless browser session after an authenticated socket is rejected", async () => {
    const result = await resolveSocketAuthCredential(
      async () => ({ ok: true, token: "stale-token" }),
      async () => ({ ok: true }),
      { forceBrowserSessionRefresh: true, requireAccessTokenAfterRefresh: true },
    );

    expect(result).toEqual({ ok: false, error: "AUTH_REQUIRED" });
  });

  it("accepts a renewed access token after an authenticated socket is rejected", async () => {
    const result = await resolveSocketAuthCredential(
      async () => ({ ok: true, token: "stale-token" }),
      async () => ({ ok: true, token: "renewed-token" }),
      { forceBrowserSessionRefresh: true, requireAccessTokenAfterRefresh: true },
    );

    expect(result).toEqual({ ok: true, token: "renewed-token" });
  });
});
