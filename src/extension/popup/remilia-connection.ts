export const REMILIA_AUTH_MESSAGE = {
  status: "remilia-auth:status",
  connect: "remilia-auth:connect",
  reconnect: "remilia-auth:reconnect",
  completeMigration: "remilia-auth:completeMigration",
  disconnect: "remilia-auth:disconnect",
  revoke: "remilia-auth:revoke",
} as const;

export const REMILIA_AUTH_STATE_VERSION = 1;
export const REMILIA_CONSENT_VERSION = 1;
export const REMILIA_MIGRATION_VERSION = 1;

export type RemiliaAuthPhase =
  | "migration-required"
  | "disconnected"
  | "connecting"
  | "connected"
  | "expired"
  | "missing-scope"
  | "rate-limited"
  | "offline"
  | "unsupported"
  | "error";

export type RemiliaAuthErrorCode =
  | "ACCESS_DENIED"
  | "TOKEN_EXPIRED"
  | "MISSING_SCOPE"
  | "RATE_LIMITED"
  | "OFFLINE"
  | "CANCELLED"
  | "CONCURRENT_LOGIN"
  | "AUTH_TIMEOUT"
  | "AUTH_SETUP_FAILED"
  | "AUTH_PAGE_LOAD_FAILED"
  | "AUTH_WINDOW_UNAVAILABLE"
  | "AUTH_WINDOW_FAILED"
  | "AUTH_RESPONSE_INVALID"
  | "TOKEN_EXCHANGE_FAILED"
  | "TOKEN_REQUEST_REJECTED"
  | "TOKEN_RESPONSE_INVALID"
  | "SIGNING_KEYS_UNAVAILABLE"
  | "ID_TOKEN_INVALID"
  | "ID_TOKEN_FORMAT_INVALID"
  | "ID_TOKEN_ALGORITHM_INVALID"
  | "ID_TOKEN_SIGNING_KEY_INVALID"
  | "ID_TOKEN_SIGNATURE_INVALID"
  | "ID_TOKEN_ISSUER_INVALID"
  | "ID_TOKEN_AUDIENCE_INVALID"
  | "ID_TOKEN_TIME_INVALID"
  | "ID_TOKEN_SUBJECT_INVALID"
  | "AUTH_STORAGE_FAILED"
  | "BACKGROUND_UNAVAILABLE"
  | "REVOKED"
  | "UNSUPPORTED"
  | "UNKNOWN";

export type RemiliaIdentity = {
  id: string;
  displayName: string;
  username: string;
  avatarUrl: string;
};

export type RemiliaAuthError = {
  code: RemiliaAuthErrorCode;
  retryAfterSeconds?: number;
};

export type RemiliaAuthStatus = {
  authStateVersion: number;
  phase: RemiliaAuthPhase;
  identity: RemiliaIdentity | null;
  grantedScopes: string[];
  requiredScopes: string[];
  migration: {
    version: number;
    required: boolean;
    legacyDeleted: boolean;
  };
  lastError: RemiliaAuthError | null;
};

export type RemiliaScopeRow = {
  scope: string;
  label: string;
  detail: string;
  granted: boolean;
};

export type RemiliaConnectionView = {
  phase: RemiliaAuthPhase;
  title: string;
  detail: string;
  tone: "neutral" | "success" | "warning" | "danger";
  showConsent: boolean;
  showMigration: boolean;
  showConnect: boolean;
  showReconnect: boolean;
  showDisconnect: boolean;
  showRevoke: boolean;
};

export type InstantBeetleResultsAvailability = {
  active: boolean;
  help: string;
};

const KNOWN_PHASES = new Set<RemiliaAuthPhase>([
  "migration-required",
  "disconnected",
  "connecting",
  "connected",
  "expired",
  "missing-scope",
  "rate-limited",
  "offline",
  "unsupported",
  "error",
]);

const KNOWN_ERRORS = new Set<RemiliaAuthErrorCode>([
  "ACCESS_DENIED",
  "TOKEN_EXPIRED",
  "MISSING_SCOPE",
  "RATE_LIMITED",
  "OFFLINE",
  "CANCELLED",
  "CONCURRENT_LOGIN",
  "AUTH_TIMEOUT",
  "AUTH_SETUP_FAILED",
  "AUTH_PAGE_LOAD_FAILED",
  "AUTH_WINDOW_UNAVAILABLE",
  "AUTH_WINDOW_FAILED",
  "AUTH_RESPONSE_INVALID",
  "TOKEN_EXCHANGE_FAILED",
  "TOKEN_REQUEST_REJECTED",
  "TOKEN_RESPONSE_INVALID",
  "SIGNING_KEYS_UNAVAILABLE",
  "ID_TOKEN_INVALID",
  "ID_TOKEN_FORMAT_INVALID",
  "ID_TOKEN_ALGORITHM_INVALID",
  "ID_TOKEN_SIGNING_KEY_INVALID",
  "ID_TOKEN_SIGNATURE_INVALID",
  "ID_TOKEN_ISSUER_INVALID",
  "ID_TOKEN_AUDIENCE_INVALID",
  "ID_TOKEN_TIME_INVALID",
  "ID_TOKEN_SUBJECT_INVALID",
  "AUTH_STORAGE_FAILED",
  "BACKGROUND_UNAVAILABLE",
  "REVOKED",
  "UNSUPPORTED",
  "UNKNOWN",
]);

const PUBLISHED_SCOPE_COPY = [
  ["openid", "Confirm your Remilia account", "Verify which Remilia account is connecting."],
  ["remilia:stats.read", "Read your Remilia stats", "Load account stats for enabled features."],
  ["remilia:notifications.read", "Read your notifications", "Load your account notifications for enabled features."],
  ["remilia:pokes.write", "Send pokes", "Send a poke only after you choose that action."],
  ["remilia:beetle.read", "Read Beetle data", "Load official read-only Beetle account data."],
  ["remilia:chat.read", "Read Remilia chat", "Load conversations while the chat feature is enabled."],
  ["remilia:chat.write", "Send Remilia chat messages", "Send only the text messages you choose."],
  ["remilia:directory.read", "Read the Remilia directory", "Look up directory identities for enabled features."],
] as const;

export function normalizeRemiliaAuthResponse(value: unknown): RemiliaAuthStatus {
  const response = recordValue(value);
  const nested = recordValue(response.status);
  const source = Object.keys(nested).length > 0 ? nested : response;
  const migration = recordValue(source.migration);
  const error = normalizeError(source.lastError ?? response.error);
  const authStateVersion = positiveInteger(response.authStateVersion ?? source.authStateVersion, REMILIA_AUTH_STATE_VERSION);
  const rawPhase = stringValue(source.phase);
  const migrationRequired = migration.required === true || source.migrationRequired === true;
  const normalizedPhase = migrationRequired
    ? "migration-required"
    : KNOWN_PHASES.has(rawPhase as RemiliaAuthPhase)
      ? rawPhase as RemiliaAuthPhase
      : error
        ? phaseForError(error.code)
        : "error";
  const versionSupported = authStateVersion === REMILIA_AUTH_STATE_VERSION;

  return {
    authStateVersion,
    phase: versionSupported ? normalizedPhase : "error",
    identity: normalizeIdentity(source.identity),
    grantedScopes: stringList(source.grantedScopes),
    requiredScopes: stringList(source.requiredScopes),
    migration: {
      version: positiveInteger(migration.version, REMILIA_MIGRATION_VERSION),
      required: migrationRequired,
      legacyDeleted: migration.legacyDeleted === true,
    },
    lastError: versionSupported ? error : { code: "UNKNOWN" },
  };
}

export function remiliaConnectionView(status: RemiliaAuthStatus): RemiliaConnectionView {
  if (status.migration.required || status.phase === "migration-required") {
    return {
      phase: "migration-required",
      title: "Review the connection update",
      detail: "Old browser-session login data must be deleted before you can choose whether to connect with Remilia Login.",
      tone: "warning",
      showConsent: true,
      showMigration: true,
      showConnect: false,
      showReconnect: false,
      showDisconnect: false,
      showRevoke: false,
    };
  }

  const connected = status.phase === "connected";
  const unsupported = status.phase === "unsupported";
  const reconnect = status.phase === "expired" || status.phase === "missing-scope" || status.phase === "rate-limited" || status.phase === "offline";
  const copy: Record<RemiliaAuthPhase, Pick<RemiliaConnectionView, "title" | "detail" | "tone">> = {
    "migration-required": { title: "Review the connection update", detail: "Delete old login data before connecting.", tone: "warning" },
    disconnected: { title: "Not connected", detail: "No RemiliaNET account is connected. The requested abilities are listed below.", tone: "neutral" },
    connecting: { title: "Waiting for Remilia Login", detail: "Finish the official authorization window. You can safely cancel and try again.", tone: "neutral" },
    connected: { title: "Connected", detail: "milXdy can use only the abilities listed below for this Remilia account.", tone: "success" },
    expired: { title: "Connection expired", detail: "Reconnect to renew the official authorization. No browser session will be reused.", tone: "warning" },
    "missing-scope": { title: "More permission is required", detail: "Reconnect and approve the missing ability shown below.", tone: "warning" },
    "rate-limited": { title: "Remilia is limiting requests", detail: "Wait before reconnecting. Your local settings are unchanged.", tone: "warning" },
    offline: { title: "You appear to be offline", detail: "Check your connection, then reconnect. Your local settings are unchanged.", tone: "warning" },
    unsupported: { title: "Remilia connection is unavailable in Firefox", detail: "This Firefox build is intentionally keyless and does not include a Remilia identity client. Other milXdy settings and features remain available.", tone: "neutral" },
    error: { title: "Connection unavailable", detail: "The connection could not be checked. Reload the popup or try again.", tone: "danger" },
  };
  return {
    phase: status.phase,
    ...copy[status.phase],
    showConsent: !connected && !unsupported,
    showMigration: false,
    showConnect: status.phase === "disconnected" || status.phase === "error",
    showReconnect: reconnect,
    showDisconnect: connected,
    showRevoke: connected || reconnect,
  };
}

export function instantBeetleResultsAvailability(status: RemiliaAuthStatus): InstantBeetleResultsAvailability {
  if (status.phase === "connected") {
    return {
      active: true,
      help: "Connected. milXdy can accelerate RemiliaNET's native Claim/Hunt presentation; RemiliaNET still performs the action.",
    };
  }
  return {
    active: false,
    help: "Connect RemiliaNET in this milXdy popup below to use instant results. Your saved choice returns after reconnecting.",
  };
}

export function remiliaScopeRows(status: RemiliaAuthStatus): RemiliaScopeRow[] {
  const requested = new Set([...status.requiredScopes, ...status.grantedScopes].map((scope) => scope.toLowerCase()));
  const granted = new Set(status.grantedScopes.map((scope) => scope.toLowerCase()));
  return PUBLISHED_SCOPE_COPY
    .filter(([scope]) => requested.has(scope))
    .map(([scope, label, detail]) => ({ scope, label, detail, granted: granted.has(scope) }));
}

export function remiliaIdentityLabel(identity: RemiliaIdentity | null): string {
  if (!identity) return "Remilia account";
  if (identity.displayName && identity.username) return `${identity.displayName} (@${identity.username.replace(/^@/, "")})`;
  if (identity.displayName) return identity.displayName;
  if (identity.username) return `@${identity.username.replace(/^@/, "")}`;
  return "Remilia account";
}

export function remiliaErrorMessage(error: RemiliaAuthError | null): string {
  if (!error) return "The connection service did not return a usable status. Reload the popup and try again.";
  const messages: Record<RemiliaAuthErrorCode, string> = {
    ACCESS_DENIED: "Remilia Login was denied. Nothing was connected; review the abilities and try again when ready.",
    TOKEN_EXPIRED: "The authorization expired. Reconnect to continue.",
    MISSING_SCOPE: "The authorization is missing a required ability. Reconnect and approve the missing item.",
    RATE_LIMITED: error.retryAfterSeconds
      ? `Remilia is limiting requests. Try again in about ${error.retryAfterSeconds} seconds.`
      : "Remilia is limiting requests. Wait a moment, then try again.",
    OFFLINE: "milXdy could not reach Remilia. Check your connection and try again.",
    CANCELLED: "The connection window was closed. Nothing was connected.",
    CONCURRENT_LOGIN: "Another connection attempt is already open. Finish or close it before trying again.",
    AUTH_TIMEOUT: "Remilia Login took too long to respond. Nothing was connected; try again.",
    AUTH_SETUP_FAILED: "milXdy could not prepare Remilia Login. Check your connection and try again.",
    AUTH_PAGE_LOAD_FAILED: "Remilia Login could not load its authorization page. Check your connection and try again.",
    AUTH_WINDOW_UNAVAILABLE: "Chrome could not open the Remilia Login window. Use a regular Chrome window, then try again.",
    AUTH_WINDOW_FAILED: "Chrome could not start Remilia Login. Close any other Remilia Login window, then try again.",
    AUTH_RESPONSE_INVALID: "Remilia Login returned an invalid authorization response. Nothing was stored; try again.",
    TOKEN_EXCHANGE_FAILED: "Remilia Login finished, but the secure connection could not be completed. Nothing was stored; try again.",
    TOKEN_REQUEST_REJECTED: "Remilia Login returned, but Remilia rejected the secure connection request. Nothing was stored; try once more. If it repeats, the Login client needs review.",
    TOKEN_RESPONSE_INVALID: "Remilia returned an incomplete secure connection response. Nothing was stored; try again.",
    SIGNING_KEYS_UNAVAILABLE: "milXdy could not load Remilia's identity verification keys. Nothing was stored; check your connection and try again.",
    ID_TOKEN_INVALID: "Remilia returned identity proof that did not pass secure validation. Nothing was stored; try again.",
    ID_TOKEN_FORMAT_INVALID: "Remilia returned incomplete identity proof. Nothing was stored; the Login client response needs review.",
    ID_TOKEN_ALGORITHM_INVALID: "Remilia returned identity proof using an unsupported signing algorithm. Nothing was stored; the Login client signing configuration needs review.",
    ID_TOKEN_SIGNING_KEY_INVALID: "Remilia's identity proof did not match a published RS256 or Ed25519 signing key. Nothing was stored; the Login signing keys need review.",
    ID_TOKEN_SIGNATURE_INVALID: "Remilia's identity-proof signature could not be verified. Nothing was stored; the Login signing configuration needs review.",
    ID_TOKEN_ISSUER_INVALID: "Remilia's identity proof named an unexpected issuer. Nothing was stored; the Login issuer configuration needs review.",
    ID_TOKEN_AUDIENCE_INVALID: "Remilia's identity proof was not issued for this milXdy Login client. Nothing was stored; the Login client audience configuration needs review.",
    ID_TOKEN_TIME_INVALID: "Remilia's identity proof contained an invalid issue time. Nothing was stored; check the system clock and Login server time.",
    ID_TOKEN_SUBJECT_INVALID: "Remilia's identity proof did not identify an account. Nothing was stored; the Login claim configuration needs review.",
    AUTH_STORAGE_FAILED: "milXdy could not safely store the connection for this browser session. Nothing was connected; reload the extension and try again.",
    BACKGROUND_UNAVAILABLE: "The milXdy connection service did not respond. Reload the extension, reopen the popup, and try again.",
    REVOKED: "This authorization was revoked. Reconnect if you want to use Remilia features again.",
    UNSUPPORTED: "Remilia connection is unavailable in this intentionally keyless Firefox build.",
    UNKNOWN: "The connection could not be completed. Reload the popup and try again.",
  };
  return messages[error.code];
}

function normalizeIdentity(value: unknown): RemiliaIdentity | null {
  const identity = recordValue(value);
  const id = stringValue(identity.id ?? identity.sub);
  const displayName = stringValue(identity.displayName ?? identity.name);
  const username = stringValue(identity.username ?? identity.preferredUsername);
  const avatarUrl = stringValue(identity.avatarUrl ?? identity.picture);
  if (!id && !displayName && !username) return null;
  return { id, displayName, username, avatarUrl };
}

function normalizeError(value: unknown): RemiliaAuthError | null {
  if (typeof value === "string") {
    const code = normalizeErrorCode(value);
    return { code };
  }
  const error = recordValue(value);
  if (Object.keys(error).length === 0) return null;
  return {
    code: normalizeErrorCode(stringValue(error.code)),
    retryAfterSeconds: positiveInteger(error.retryAfterSeconds, 0) || undefined,
  };
}

function normalizeErrorCode(value: string): RemiliaAuthErrorCode {
  const code = value.toUpperCase().replace(/[\s-]+/g, "_");
  return KNOWN_ERRORS.has(code as RemiliaAuthErrorCode) ? code as RemiliaAuthErrorCode : "UNKNOWN";
}

function phaseForError(code: RemiliaAuthErrorCode): RemiliaAuthPhase {
  if (code === "TOKEN_EXPIRED" || code === "REVOKED") return "expired";
  if (code === "MISSING_SCOPE") return "missing-scope";
  if (code === "RATE_LIMITED") return "rate-limited";
  if (code === "OFFLINE") return "offline";
  if (code === "UNSUPPORTED") return "unsupported";
  return "error";
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(value.map(stringValue).filter(Boolean));
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function positiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
