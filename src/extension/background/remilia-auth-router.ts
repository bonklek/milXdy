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
  type RemiliaAuthErrorCode,
  type RemiliaAuthStatus,
  type RemiliaUiErrorCode,
} from "../../platform/auth/remilia-auth";

configureRemiliaAuthClientFromBuild();

type StatusMessage = { type: "remilia-auth:status" };
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
  if (!isExtensionPageSender(sender)) return response(false, await getRemiliaAuthStatus(), "UNKNOWN");
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
  if (!objectMessage("remilia-auth:status")(message)
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
  if (sender.id !== chrome.runtime.id || sender.tab) return false;
  const source = sender.url || sender.origin || "";
  if (!source) return false;
  try {
    const expected = new URL(chrome.runtime.getURL(""));
    const actual = new URL(source);
    return actual.origin === expected.origin;
  } catch {
    return false;
  }
}

function uiError(code: RemiliaAuthErrorCode): RemiliaUiErrorCode {
  if (code === "ACCESS_DENIED" || code === "TOKEN_EXPIRED" || code === "MISSING_SCOPE"
    || code === "OFFLINE" || code === "CANCELLED" || code === "CONCURRENT_LOGIN"
    || code === "AUTH_TIMEOUT" || code === "REVOKED" || code === "UNSUPPORTED") return code;
  if (code === "REFRESH_REJECTED") return "TOKEN_EXPIRED";
  return "UNKNOWN";
}
