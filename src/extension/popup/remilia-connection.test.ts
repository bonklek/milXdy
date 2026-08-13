import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  REMILIA_CONNECTION_UI_VERSION,
  normalizeRemiliaAuthResponse,
  normalizeRemiliaConnectionUiState,
  remiliaConnectionView,
  remiliaErrorMessage,
  remiliaIdentityLabel,
  remiliaScopeRows,
} from "./remilia-connection";

describe("Remilia connection UI contract", () => {
  it("renders migration as an explicit deletion step without treating legacy state as connected", () => {
    const status = normalizeRemiliaAuthResponse({
      ok: true,
      authStateVersion: 1,
      status: {
        phase: "disconnected",
        migration: { version: 1, required: true, legacyDeleted: false },
        grantedScopes: ["openid"],
        requiredScopes: ["openid", "remilia:stats.read"],
      },
    });

    expect(status.phase).toBe("migration-required");
    expect(remiliaConnectionView(status)).toMatchObject({
      showMigration: true,
      showConnect: false,
      showDisconnect: false,
      showRevoke: false,
    });
  });

  it("removes the one-time migration prompt after background-owned deletion completes", () => {
    const afterRestart = normalizeRemiliaAuthResponse({
      authStateVersion: 1,
      status: {
        phase: "disconnected",
        requiredScopes: ["openid", "remilia:stats.read"],
        migration: { version: 1, required: false, legacyDeleted: true },
      },
    });

    expect(remiliaConnectionView(afterRestart)).toMatchObject({
      phase: "disconnected",
      showMigration: false,
      showConnect: true,
    });
  });

  it("makes the connected identity and granted versus missing abilities understandable", () => {
    const status = normalizeRemiliaAuthResponse({
      authStateVersion: 1,
      status: {
        phase: "connected",
        identity: { sub: "remilia-1", name: "Milady", preferredUsername: "milady" },
        grantedScopes: ["openid", "remilia:stats.read", "remilia:beetle.read"],
        requiredScopes: ["openid", "remilia:stats.read", "remilia:beetle.read", "remilia:pokes.write"],
        migration: { version: 1, required: false, legacyDeleted: true },
      },
    });

    expect(remiliaIdentityLabel(status.identity)).toBe("Milady (@milady)");
    expect(remiliaScopeRows(status)).toEqual([
      expect.objectContaining({ scope: "openid", granted: true }),
      expect.objectContaining({ scope: "remilia:stats.read", granted: true }),
      expect.objectContaining({ scope: "remilia:pokes.write", granted: false }),
      expect.objectContaining({ scope: "remilia:beetle.read", granted: true }),
    ]);
    expect(remiliaConnectionView(status)).toMatchObject({ showDisconnect: true, showRevoke: true, showConnect: false });
  });

  it("uses only the published Remilia API scope vocabulary and read-only Beetle semantics", () => {
    const status = normalizeRemiliaAuthResponse({
      authStateVersion: 1,
      status: {
        phase: "connected",
        grantedScopes: [
          "openid",
          "remilia:stats.read",
          "remilia:notifications.read",
          "remilia:pokes.write",
          "remilia:beetle.read",
          "remilia:chat.read",
          "remilia:chat.write",
          "remilia:directory.read",
        ],
        requiredScopes: [],
        migration: { version: 1, required: false, legacyDeleted: true },
      },
    });
    const rows = remiliaScopeRows(status);
    expect(rows).toHaveLength(8);
    expect(rows.find((row) => row.scope === "remilia:beetle.read")?.detail).toContain("read-only");
    expect(rows.find((row) => row.scope === "remilia:chat.write")?.detail).toContain("text messages");
    expect(JSON.stringify(rows)).not.toMatch(/hunt|claim|reaction|media|realtime/i);
  });

  it("refuses to render protocol-internal, legacy, or unknown scope aliases", () => {
    const status = normalizeRemiliaAuthResponse({
      authStateVersion: 1,
      status: {
        phase: "connected",
        grantedScopes: ["OPENID", "profile", "offline_access", "beetle:write", "mystery:admin"],
        requiredScopes: ["openid", "remistats:read", "poke:write", "remilia:stats.read"],
        migration: { version: 1, required: false, legacyDeleted: true },
      },
    });
    expect(remiliaScopeRows(status).map((row) => row.scope)).toEqual(["openid", "remilia:stats.read"]);
  });

  it.each([
    ["ACCESS_DENIED", "denied"],
    ["TOKEN_EXPIRED", "expired"],
    ["MISSING_SCOPE", "missing"],
    ["RATE_LIMITED", "limiting"],
    ["OFFLINE", "reach Remilia"],
    ["CANCELLED", "closed"],
    ["CONCURRENT_LOGIN", "already open"],
    ["AUTH_TIMEOUT", "too long"],
    ["REVOKED", "revoked"],
    ["UNSUPPORTED", "Firefox"],
  ])("maps %s to actionable accessible copy", (code, expected) => {
    const status = normalizeRemiliaAuthResponse({ error: { code, retryAfterSeconds: 30 } });
    expect(remiliaErrorMessage(status.lastError)).toContain(expected);
  });

  it("keeps rollback state versioned and presentation-only", () => {
    expect(normalizeRemiliaConnectionUiState({
      schemaVersion: 99,
      presentationVersion: 0,
      compatibilityPresentation: true,
      legacyCookieAuth: true,
    })).toEqual({
      schemaVersion: REMILIA_CONNECTION_UI_VERSION,
      presentationVersion: REMILIA_CONNECTION_UI_VERSION,
      compatibilityPresentation: true,
    });
  });

  it.each([
    [{ authStateVersion: 1, status: { phase: "unsupported" } }],
    [{ authStateVersion: 1, error: { code: "UNSUPPORTED" } }],
  ])("renders Firefox keyless status neutrally without authorization actions", (response) => {
    const status = normalizeRemiliaAuthResponse(response);
    expect(status.phase).toBe("unsupported");
    expect(remiliaConnectionView(status)).toMatchObject({
      title: "Remilia connection is unavailable in Firefox",
      tone: "neutral",
      showConsent: false,
      showConnect: false,
      showReconnect: false,
      showDisconnect: false,
      showRevoke: false,
    });
  });

  it("fails closed on malformed or future background responses", () => {
    const status = normalizeRemiliaAuthResponse({
      authStateVersion: 400,
      status: { phase: "browser-session", identity: { token: "must-not-render" } },
    });
    expect(status.phase).toBe("error");
    expect(status.identity).toBeNull();
    expect(remiliaConnectionView(status).showConnect).toBe(true);
  });

  it("keeps popup auth actions on the official token-free message boundary", () => {
    const source = readFileSync(resolve(process.cwd(), "src/extension/popup/index.ts"), "utf8");
    expect(source).not.toContain("beetol:authStatus");
    expect(source).not.toContain("beetol:sessionStatus");
    expect(source).not.toContain("beetol:logout");
    expect(source).not.toContain("chrome.cookies");
    expect(source).toContain("REMILIA_AUTH_MESSAGE.completeMigration");
    expect(source).toContain("decision: \"delete-legacy\"");
    expect(source).toContain("response.remoteRevoked === false");
  });

  it("ships labeled live status, alert, scope, migration, and rollback controls", () => {
    const html = readFileSync(resolve(process.cwd(), "assets/extension/popup/popup.html"), "utf8");
    expect(html).toContain('id="remiliaAuthStatus" role="status" aria-live="polite"');
    expect(html).toContain('id="remiliaAuthError" role="alert" tabindex="-1"');
    expect(html).toContain('id="remiliaMigration" role="region" aria-labelledby="remiliaMigrationTitle"');
    expect(html).toContain('id="remiliaScopesTitle">Requested abilities');
    expect(html).toContain('id="remiliaConnect"');
    expect(html).toContain('id="remiliaReconnect"');
    expect(html).toContain('id="remiliaDisconnect"');
    expect(html).toContain('id="remiliaRevoke"');
    expect(html).toContain('id="remiliaUiRollback"');
  });
});
