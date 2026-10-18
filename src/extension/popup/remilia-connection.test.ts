import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  instantBeetleResultsAvailability,
  normalizeRemiliaAuthResponse,
  remiliaConnectionView,
  remiliaErrorMessage,
  remiliaIdentityLabel,
  remiliaScopeRows,
} from "./remilia-connection";

describe("Remilia connection UI contract", () => {
  it("fails the instant Beetle setting closed until the connector is active", () => {
    const statuses = ["disconnected", "unsupported", "error", "offline"] as const;
    for (const phase of statuses) {
      const status = normalizeRemiliaAuthResponse({ authStateVersion: 1, status: { phase } });
      expect(instantBeetleResultsAvailability(status)).toMatchObject({ active: false });
    }

    const connected = normalizeRemiliaAuthResponse({ authStateVersion: 1, status: { phase: "connected" } });
    expect(instantBeetleResultsAvailability(connected)).toEqual({
      active: true,
      help: "Connected. milXdy can accelerate RemiliaNET's native Claim/Hunt presentation; RemiliaNET still performs the action.",
    });
    expect([
      normalizeRemiliaAuthResponse({ authStateVersion: 1, status: { phase: "disconnected" } }),
      connected,
      normalizeRemiliaAuthResponse({ authStateVersion: 1, status: { phase: "expired" } }),
      connected,
    ].map((status) => instantBeetleResultsAvailability(status).active)).toEqual([false, true, false, true]);
  });

  it("ships the instant Beetle setting disabled and accessibly described before status resolves", () => {
    const html = readFileSync(resolve(process.cwd(), "assets/extension/popup/popup.html"), "utf8");
    const source = ["remilia-connection-panel.ts", "remilia-connection-presentation.ts"].map(file => readFileSync(resolve(process.cwd(), `src/extension/popup/${file}`), "utf8")).join("\n");
    expect(html).toContain('id="beetleInstantResultsSetting" data-connector-available="false" aria-disabled="true"');
    expect(html).toContain('data-control="reminet.beetleInstantResults" aria-describedby="beetleInstantResultsHelp" disabled');
    expect(html).toContain('id="beetleInstantResultsHelp" class="setting-availability-help" role="status" aria-live="polite"');
    expect(source).toContain("instantResultsControl!.disabled = !instantResultsAvailability.active");
    expect(source).toContain('setAttribute("aria-disabled", String(!instantResultsAvailability.active))');
    expect(source).toContain("const statusTimer = setInterval");
    expect(source).not.toContain('chrome.storage.sync.set({ [BEETLE_INSTANT_RESULTS_KEY]');
  });

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
    ["AUTH_SETUP_FAILED", "prepare Remilia Login"],
    ["AUTH_PAGE_LOAD_FAILED", "authorization page"],
    ["AUTH_WINDOW_UNAVAILABLE", "regular Chrome window"],
    ["AUTH_WINDOW_FAILED", "could not start Remilia Login"],
    ["AUTH_RESPONSE_INVALID", "invalid authorization response"],
    ["TOKEN_EXCHANGE_FAILED", "secure connection"],
    ["TOKEN_REQUEST_REJECTED", "rejected the secure connection request"],
    ["TOKEN_RESPONSE_INVALID", "incomplete secure connection response"],
    ["SIGNING_KEYS_UNAVAILABLE", "identity verification keys"],
    ["ID_TOKEN_INVALID", "did not pass secure validation"],
    ["ID_TOKEN_FORMAT_INVALID", "incomplete identity proof"],
    ["ID_TOKEN_ALGORITHM_INVALID", "unsupported signing algorithm"],
    ["ID_TOKEN_SIGNING_KEY_INVALID", "published RS256 or Ed25519 signing key"],
    ["ID_TOKEN_SIGNATURE_INVALID", "signature could not be verified"],
    ["ID_TOKEN_ISSUER_INVALID", "unexpected issuer"],
    ["ID_TOKEN_AUDIENCE_INVALID", "not issued for this milXdy Login client"],
    ["ID_TOKEN_TIME_INVALID", "invalid issue time"],
    ["ID_TOKEN_SUBJECT_INVALID", "did not identify an account"],
    ["AUTH_STORAGE_FAILED", "safely store"],
    ["BACKGROUND_UNAVAILABLE", "connection service did not respond"],
    ["REVOKED", "revoked"],
    ["UNSUPPORTED", "Chromium release"],
    ["UNKNOWN", "could not be completed"],
  ])("maps %s to actionable accessible copy", (code, expected) => {
    const status = normalizeRemiliaAuthResponse({ error: { code, retryAfterSeconds: 30 } });
    expect(remiliaErrorMessage(status.lastError)).toContain(expected);
  });

  it.each([
    [{ authStateVersion: 1, status: { phase: "unsupported" } }],
    [{ authStateVersion: 1, error: { code: "UNSUPPORTED" } }],
  ])("renders keyless build status neutrally without authorization actions", (response) => {
    const status = normalizeRemiliaAuthResponse(response);
    expect(status.phase).toBe("unsupported");
    expect(remiliaConnectionView(status)).toMatchObject({
      title: "Remilia connection is unavailable in this build",
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
    const source = ["remilia-connection-panel.ts", "remilia-connection-presentation.ts"].map(file => readFileSync(resolve(process.cwd(), `src/extension/popup/${file}`), "utf8")).join("\n");
    expect(source).not.toContain("beetol:authStatus");
    expect(source).not.toContain("beetol:sessionStatus");
    expect(source).not.toContain("beetol:logout");
    expect(source).not.toContain("chrome.cookies");
    expect(source).toContain("REMILIA_AUTH_MESSAGE.completeMigration");
    expect(source).toContain("decision: \"delete-legacy\"");
    expect(source).toContain("response.remoteRevoked === false");
    expect(source).not.toContain("onboardingOpenRemilia");
    expect(source).not.toContain("onboardingRetryRemilia");
    expect(source).not.toContain("Check connection");
    expect(source).not.toContain("setMessage(remiliaErrorMessage");
  });

  it("renders one primary connection action when the account is known disconnected", () => {
    const html = readFileSync(resolve(process.cwd(), "assets/extension/popup/popup.html"), "utf8");
    expect(html.match(/>Log in with RemiliaNET<\/span>/gu)).toHaveLength(2);

    expect(html.match(/class="remilia-auth-error"/gu)).toHaveLength(1);
    expect(html).not.toContain("Review Remilia connection");
    expect(html).not.toContain("Check connection");
    expect(html).not.toContain("Recheck");

    const disconnected = normalizeRemiliaAuthResponse({
      authStateVersion: 1,
      status: {
        phase: "disconnected",
        requiredScopes: ["openid", "remilia:stats.read"],
        migration: { version: 1, required: false, legacyDeleted: true },
      },
    });
    expect(remiliaConnectionView(disconnected)).toMatchObject({
      showConnect: true,
      showReconnect: false,
      showDisconnect: false,
      showRevoke: false,
    });
  });

  it("offers login again without revocation when the local session has expired", () => {
    const status = normalizeRemiliaAuthResponse({ authStateVersion: 1, status: {
      phase: "expired", requiredScopes: ["openid"], grantedScopes: [],
      migration: { version: 1, required: false, legacyDeleted: true },
    } });
    expect(remiliaConnectionView(status)).toMatchObject({ showReconnect: true, showRevoke: false, showDisconnect: false });
  });

  it("ships the compact connection layout as the only default while retaining required controls", () => {
    const html = readFileSync(resolve(process.cwd(), "assets/extension/popup/popup.html"), "utf8");
    const css = readFileSync(resolve(process.cwd(), "assets/extension/popup/popup.css"), "utf8").replaceAll("\r\n", "\n");
    const popupSource = readFileSync(resolve(process.cwd(), "src/extension/popup/index.ts"), "utf8");
    const contractSource = readFileSync(resolve(process.cwd(), "src/extension/popup/remilia-connection.ts"), "utf8");
    expect(html).toContain('id="remiliaConnection"');
    expect(html).toContain('data-layout="compact"');
    expect(html).toContain('id="remiliaAuthStatus" role="status" aria-live="polite"');
    expect(html).toContain('id="remiliaAuthError" role="alert" tabindex="-1"');
    expect(html).toContain('id="remiliaMigration" role="region" aria-labelledby="remiliaMigrationTitle"');
    expect(html).toContain('id="remiliaScopesTitle">Requested abilities');
    expect(html).toContain('id="remiliaConnect"');
    expect(html).toContain('id="remiliaReconnect"');
    expect(html).toContain('id="remiliaDisconnect"');
    expect(html).toContain('id="remiliaRevoke"');
    expect(html).not.toContain("Use compact connection layout");
    expect(html).not.toContain('id="remiliaUiRollback"');
    expect(html).not.toContain("full connection");
    expect(css).toContain(".remilia-consent,\n.remilia-scopes li small {\n  display: none;");
    expect(css).toContain(".remilia-scopes ul {\n  grid-template-columns: repeat(2, minmax(0, 1fr));");
    expect(css).not.toContain("data-compatibility");
    expect(popupSource).not.toContain("milxdy.remilia.connectionUi");
    expect(popupSource).not.toContain("compatibilityPresentation");
    expect(contractSource).not.toContain("RemiliaConnectionUiState");
  });
});
