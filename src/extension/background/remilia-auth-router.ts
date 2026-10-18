import { absoluteRemiliaMediaUrl } from "../../platform/media/remilia-media-allowlist";
import { RemiliaApiClient } from "../../platform/auth/remilia-api";
import { objectMessage, registerBackgroundMessageHandlers } from "../../platform/background/router";
import {
  REMILIA_AUTH_MIGRATION_VERSION,
  REMILIA_AUTH_STATE_VERSION,
  completeRemiliaAuthMigration,
  configureRemiliaAuthClientFromBuild,
  connectRemiliaAuth,
  disconnectRemiliaAuth,
  getRemiliaAuthStatus,
  noteRemiliaAuthInstalled,
  revokeRemiliaAuth,
  remiliaAuthProvider,
  type RemiliaAuthErrorCode,
  type RemiliaAuthStatus,
  type RemiliaUiErrorCode,
} from "../../platform/auth/remilia-auth";

configureRemiliaAuthClientFromBuild();

type StatusMessage = { type: "remilia-auth:status" | "remilia-auth:me" | "remilia-auth:previewFallback" };
type ConnectMessage = {
  type: "remilia-auth:connect" | "remilia-auth:reconnect";
  consentVersion: 1;
};
type MigrationMessage = {
  type: "remilia-auth:completeMigration";
  migrationVersion: 1;
  decision: "delete-legacy";
};
type DisconnectMessage = { type: "remilia-auth:disconnect" };
type RevokeMessage = { type: "remilia-auth:revoke" };

type AuthMessage = StatusMessage | ConnectMessage | MigrationMessage | DisconnectMessage | RevokeMessage;

registerBackgroundMessageHandlers([{
  type: "remilia-auth:*",
  matches: isAuthMessage,
  handle: handleAuthMessage,
}]);

chrome.runtime.onInstalled.addListener((details) => {
  void noteRemiliaAuthInstalled(details.reason);
});

async function handleAuthMessage(message: AuthMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (!isExtensionPageSender(sender)) {
    return {
      ok: false,
      authStateVersion: REMILIA_AUTH_STATE_VERSION,
      error: "UNKNOWN",
    };
  }
  if (message.type === "remilia-auth:previewFallback") {
    const result = await new RemiliaApiClient({ auth: remiliaAuthProvider, timeoutMs: 5_000 }).getUserProfile("remilia_jackson");
    return result.ok ? { ok: true, preview: projectPreview(result.data.user) } : { ok: false, error: result.error.code, status: result.error.status };
  }
  if (message.type === "remilia-auth:me") {
    const result = await new RemiliaApiClient({ auth: remiliaAuthProvider }).getMe();
    if (!result.ok) return { ok: false, error: result.error.code, status: result.error.status };
    // Project only presentation fields; never return the private profile envelope.
    const user = result.data.user;
    return { ok: true, identity: { username: user.username, displayName: user.displayName }, preview: projectPreview(user), theme: { mode: user.theme === "dark" || user.theme === "color" ? user.theme : "default", hue: typeof user.color === "number" && Number.isFinite(user.color) ? ((user.color % 360) + 360) % 360 : 180 } };
  }
  const currentStatus = await getRemiliaAuthStatus();
  if (message.type === "remilia-auth:status") return response(true, currentStatus);
  if (currentStatus.phase === "unsupported") return response(false, currentStatus, "UNSUPPORTED");

  if (message.type === "remilia-auth:connect" || message.type === "remilia-auth:reconnect") {
    if (message.consentVersion !== 1) return response(false, await getRemiliaAuthStatus(), "UNKNOWN");
    const result = await connectRemiliaAuth();
    return response(result.ok, await getRemiliaAuthStatus(), result.ok ? undefined : uiError(result.error));
  }

  if (message.type === "remilia-auth:completeMigration") {
    if (message.migrationVersion !== REMILIA_AUTH_MIGRATION_VERSION || message.decision !== "delete-legacy") {
      return response(false, await getRemiliaAuthStatus(), "UNKNOWN");
    }
    await completeRemiliaAuthMigration();
    return response(true, await getRemiliaAuthStatus());
  }

  if (message.type === "remilia-auth:disconnect") {
    await disconnectRemiliaAuth();
    return response(true, await getRemiliaAuthStatus());
  }

  if (currentStatus.phase !== "connected") {
    return { ...response(false, currentStatus, "TOKEN_EXPIRED"), remoteRevoked: false };
  }
  const revoked = await revokeRemiliaAuth();
  return {
    ...response(revoked.remoteRevoked, await getRemiliaAuthStatus(), revoked.remoteRevoked ? undefined : "OFFLINE"),
    remoteRevoked: revoked.remoteRevoked,
  };
}

function response(ok: boolean, status: RemiliaAuthStatus, error?: RemiliaUiErrorCode): Record<string, unknown> {
  return {
    ok,
    authStateVersion: REMILIA_AUTH_STATE_VERSION,
    status,
    ...(error ? { error } : {}),
  };
}

function isAuthMessage(message: unknown): message is AuthMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  if (!objectMessage("remilia-auth:previewFallback")(message)
    && !objectMessage("remilia-auth:me")(message)
    && !objectMessage("remilia-auth:status")(message)
    && !objectMessage("remilia-auth:connect")(message)
    && !objectMessage("remilia-auth:reconnect")(message)
    && !objectMessage("remilia-auth:completeMigration")(message)
    && !objectMessage("remilia-auth:disconnect")(message)
    && !objectMessage("remilia-auth:revoke")(message)) return false;
  if (record.type === "remilia-auth:connect" || record.type === "remilia-auth:reconnect") return record.consentVersion === 1;
  if (record.type === "remilia-auth:completeMigration") {
    return record.migrationVersion === 1 && record.decision === "delete-legacy";
  }
  return true;
}

function isExtensionPageSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id || (sender.frameId !== undefined && sender.frameId !== 0)) return false;
  // Only the shipped popup may invoke account actions, including its explicit
  // tab fallback when action.openPopup is unavailable. Content scripts cannot.
  if (!sender.url) return false;
  try {
    const expected = new URL(chrome.runtime.getURL("popup.html"));
    const actual = new URL(sender.url);
    return actual.protocol === expected.protocol && actual.host === expected.host
      && actual.pathname === expected.pathname && !actual.username && !actual.password;
  } catch {
    return false;
  }
}

function uiError(code: RemiliaAuthErrorCode): RemiliaUiErrorCode {
  if (code === "ACCESS_DENIED" || code === "TOKEN_EXPIRED" || code === "MISSING_SCOPE"
    || code === "OFFLINE" || code === "CANCELLED" || code === "CONCURRENT_LOGIN"
    || code === "AUTH_TIMEOUT" || code === "REVOKED" || code === "UNSUPPORTED"
    || code === "AUTH_SETUP_FAILED" || code === "AUTH_PAGE_LOAD_FAILED"
    || code === "AUTH_WINDOW_UNAVAILABLE" || code === "AUTH_WINDOW_FAILED"
    || code === "AUTH_RESPONSE_INVALID" || code === "TOKEN_EXCHANGE_FAILED"
    || code === "TOKEN_REQUEST_REJECTED" || code === "TOKEN_RESPONSE_INVALID"
    || code === "SIGNING_KEYS_UNAVAILABLE" || code === "ID_TOKEN_INVALID"
    || code === "ID_TOKEN_FORMAT_INVALID" || code === "ID_TOKEN_ALGORITHM_INVALID"
    || code === "ID_TOKEN_SIGNING_KEY_INVALID" || code === "ID_TOKEN_SIGNATURE_INVALID"
    || code === "ID_TOKEN_ISSUER_INVALID" || code === "ID_TOKEN_AUDIENCE_INVALID"
    || code === "ID_TOKEN_TIME_INVALID" || code === "ID_TOKEN_SUBJECT_INVALID"
    || code === "AUTH_STORAGE_FAILED") return code;
  if (code === "REFRESH_REJECTED") return "TOKEN_EXPIRED";
  if (code === "DISCOVERY_FAILED" || code === "REDIRECT_MISMATCH") return "AUTH_SETUP_FAILED";
  if (code === "STATE_MISMATCH" || code === "NONCE_MISMATCH") return "AUTH_RESPONSE_INVALID";
  return "UNKNOWN";
}

/** Narrow presentation projection; neither credentials nor private profile fields cross this boundary. */
function projectPreview(user: Record<string, unknown>) {
  const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 100) : "";
  const person = (value: Record<string, unknown>) => ({
    username: text(value.username ?? value.userHandle).replace(/^@/, ""),
    displayName: text(value.displayName),
    avatarUrl: typeof value.pfpUrl === "string" ? absoluteRemiliaMediaUrl(value.pfpUrl) : "",
  });
  const friends = Array.isArray(user.friendsDisplayed) ? user.friendsDisplayed.slice(0, 3)
    .filter((value): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value))
    .map(person).filter(value => !!value.username) : [];
  return { account: person(user), friends };
}
