const BASE_URL = "https://www.remilia.net";
const OIDC_ISSUER = `${BASE_URL}/oidc/realms/remilia`;
const OIDC_DISCOVERY_URL = `${OIDC_ISSUER}/.well-known/openid-configuration`;
export const REMILIA_REQUIRED_SCOPES = [
  "remilia:stats.read",
  "remilia:notifications.read",
  "remilia:pokes.write",
  "remilia:beetle.read",
  "remilia:chat.read",
  "remilia:chat.write",
  "remilia:directory.read",
] as const;
export const REMILIA_ACCEPTED_ID_TOKEN_ALGORITHMS = ["RS256", "EdDSA"] as const;
type RemiliaIdTokenAlgorithm = typeof REMILIA_ACCEPTED_ID_TOKEN_ALGORITHMS[number];
const OIDC_SCOPE = ["openid", ...REMILIA_REQUIRED_SCOPES].join(" ");
const OIDC_PROTOCOL_BASE = `${OIDC_ISSUER}/protocol/openid-connect`;
const OIDC_ENDPOINTS = {
  authorization_endpoint: `${OIDC_PROTOCOL_BASE}/auth`,
  token_endpoint: `${OIDC_PROTOCOL_BASE}/token`,
  jwks_uri: `${OIDC_PROTOCOL_BASE}/certs`,
  revocation_endpoint: `${OIDC_PROTOCOL_BASE}/revoke`,
  end_session_endpoint: `${OIDC_PROTOCOL_BASE}/logout`,
  userinfo_endpoint: `${OIDC_PROTOCOL_BASE}/userinfo`,
} as const;
const DEFAULT_AUTH_TIMEOUT_MS = 120_000;
const DISCOVERY_TIMEOUT_MS = 10_000;
const OIDC_NETWORK_TIMEOUT_MS = 10_000;
const OIDC_JSON_MAX_BYTES = 256 * 1024;
const ACCESS_TOKEN_SKEW_MS = 30_000;
const ID_TOKEN_CLOCK_SKEW_MS = 5 * 60_000;

declare const MILXDY_REMILIA_CLIENT_ID: string | undefined;
declare const MILXDY_REMILIA_ISSUER_URI: string | undefined;
declare const MILXDY_REMILIA_REDIRECT_PATH: string | undefined;
declare const MILXDY_REMILIA_REDIRECT_URI: string | undefined;

// Ticket #226 owns these build-time values. Non-beta artifacts intentionally
// leave them empty so they cannot impersonate the durable public login client.
let authClientId = "";
let authRedirectPath = "remilia-oauth";
let registeredRedirectUri = "";

const CREDENTIALS_KEY = "milxdy.remiliaAuth.credentials.v1";
const CONTROL_KEY = "milxdy.remiliaAuth.control.v1";
const ACCESS_TOKEN_KEY = "beetol.accessToken";
const REFRESH_TOKEN_KEY = "beetol.refreshToken";
const DISCONNECTED_KEY = "beetol.disconnected";
const LEGACY_PREFIX = "bex" + "tol";
const LEGACY_ACCESS_TOKEN_KEY = `${LEGACY_PREFIX}.accessToken`;
const LEGACY_REFRESH_TOKEN_KEY = `${LEGACY_PREFIX}.refreshToken`;

export const REMILIA_BASE_URL = BASE_URL;
export const REMILIA_AUTH_STATE_VERSION = 1;
export const REMILIA_AUTH_MIGRATION_VERSION = 1;
export const REMILIA_LEGACY_TOKEN_KEYS = [
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  LEGACY_ACCESS_TOKEN_KEY,
  LEGACY_REFRESH_TOKEN_KEY,
] as const;

export type RemiliaAuthErrorCode =
  | "AUTH_REQUIRED"
  | "MIGRATION_REQUIRED"
  | "ACCESS_DENIED"
  | "CANCELLED"
  | "AUTH_TIMEOUT"
  | "CONCURRENT_LOGIN"
  | "AUTH_SETUP_FAILED"
  | "AUTH_PAGE_LOAD_FAILED"
  | "AUTH_WINDOW_UNAVAILABLE"
  | "AUTH_WINDOW_FAILED"
  | "AUTH_RESPONSE_INVALID"
  | "AUTH_STORAGE_FAILED"
  | "REDIRECT_MISMATCH"
  | "STATE_MISMATCH"
  | "NONCE_MISMATCH"
  | "DISCOVERY_FAILED"
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
  | "TOKEN_EXPIRED"
  | "REFRESH_REJECTED"
  | "MISSING_SCOPE"
  | "OFFLINE"
  | "REVOKED"
  | "UNSUPPORTED"
  | "UNKNOWN";

export type RemiliaUiErrorCode =
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
  | "REVOKED"
  | "UNSUPPORTED"
  | "UNKNOWN";

export type RemiliaAuthIdentity = {
  id: string;
  displayName?: string;
  username?: string;
  avatarUrl?: string;
};

export type RemiliaAuthGrant =
  | {
    ok: true;
    accessToken: string;
    tokenType: "Bearer";
    expiresAt: number;
    grantedScopes: string[];
  }
  | {
    ok: false;
    error: RemiliaAuthErrorCode;
    grantedScopes: string[];
    missingScopes: string[];
  };

export type RemiliaAuthStatus = {
  phase: "unsupported" | "migration-required" | "disconnected" | "connecting" | "connected" | "expired" | "missing-scope" | "rate-limited" | "offline" | "error";
  identity?: RemiliaAuthIdentity;
  grantedScopes: string[];
  requiredScopes: string[];
  migration: {
    version: 1;
    required: boolean;
    legacyDeleted: boolean;
  };
  lastError?: {
    code: RemiliaUiErrorCode;
    retryAfterSeconds?: number;
  };
};

export interface RemiliaAuthProvider {
  prepare(requiredScopes?: readonly string[], options?: { signal?: AbortSignal }): Promise<RemiliaAuthGrant>;
  refresh(requiredScopes?: readonly string[], options?: { signal?: AbortSignal }): Promise<RemiliaAuthGrant>;
}

type StoredCredentials = {
  version: 1;
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
  grantedScopes: string[];
  identity: RemiliaAuthIdentity;
};

type AuthControl = {
  version: 1;
  disconnected: boolean;
  migration: {
    version: 1;
    required: boolean;
    legacyDeleted: boolean;
  };
  lastError?: {
    code: RemiliaUiErrorCode;
    retryAfterSeconds?: number;
  };
};

type OidcDiscovery = {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  revocation_endpoint?: string;
  end_session_endpoint?: string;
  userinfo_endpoint?: string;
  code_challenge_methods_supported?: string[];
  id_token_signing_alg_values_supported?: string[];
};

type TokenResponse = {
  access_token?: unknown;
  refresh_token?: unknown;
  id_token?: unknown;
  token_type?: unknown;
  expires_in?: unknown;
  scope?: unknown;
  error?: unknown;
};

class AuthProtocolError extends Error {
  readonly code: RemiliaAuthErrorCode;

  constructor(code: RemiliaAuthErrorCode) {
    super(code);
    this.name = "AuthProtocolError";
    this.code = code;
  }
}

let authGeneration = 0;
let activeLogin: Promise<RemiliaAuthGrant> | null = null;
let activeLoginAbort: AbortController | null = null;
let activeRefresh: Promise<RemiliaAuthGrant> | null = null;
let activeRefreshAbort: AbortController | null = null;
let discoveryPromise: Promise<OidcDiscovery> | null = null;
let jwksPromise: Promise<JsonWebKey[]> | null = null;
let sessionAccessConfigured = false;

export function configureRemiliaAuthClient(config: { clientId: string; redirectPath?: string; redirectUri?: string }): void {
  const clientId = config.clientId.trim();
  const redirectPath = (config.redirectPath || "remilia-oauth").trim().replace(/^\/+/, "");
  if (!clientId || !redirectPath || redirectPath.includes("?") || redirectPath.includes("#")) {
    throw new Error("Invalid Remilia login client contract");
  }
  authClientId = clientId;
  authRedirectPath = redirectPath;
  registeredRedirectUri = config.redirectUri?.trim() || "";
}

export function configureRemiliaAuthClientFromBuild(): void {
  const clientId = typeof MILXDY_REMILIA_CLIENT_ID === "string" ? MILXDY_REMILIA_CLIENT_ID : "";
  const issuer = typeof MILXDY_REMILIA_ISSUER_URI === "string" ? MILXDY_REMILIA_ISSUER_URI : "";
  const redirectPath = typeof MILXDY_REMILIA_REDIRECT_PATH === "string" ? MILXDY_REMILIA_REDIRECT_PATH : "";
  const redirectUri = typeof MILXDY_REMILIA_REDIRECT_URI === "string" ? MILXDY_REMILIA_REDIRECT_URI : "";
  if (!clientId && !issuer && !redirectPath && !redirectUri) return;
  if (issuer !== OIDC_ISSUER || !redirectUri) throw new Error("Invalid built Remilia login client contract");
  configureRemiliaAuthClient({ clientId, redirectPath, redirectUri });
}

export function hasRequiredRemiliaScopes(granted: readonly string[], required: readonly string[]): boolean {
  const grantedSet = new Set(granted);
  return required.every((scope) => grantedSet.has(scope));
}

export const remiliaAuthProvider: RemiliaAuthProvider = {
  prepare: prepareRemiliaAccess,
  refresh: refreshRemiliaAccess,
};

export async function prepareRemiliaAccess(
  requiredScopes: readonly string[] = [],
  options: { signal?: AbortSignal } = {},
): Promise<RemiliaAuthGrant> {
  throwIfAborted(options.signal);
  if (!authClientId) return failure("UNSUPPORTED", [], requiredScopes);
  const control = await readControl();
  if (control.migration.required) return failure("MIGRATION_REQUIRED", [], requiredScopes);
  if (control.disconnected) return failure("AUTH_REQUIRED", [], requiredScopes);

  const credentials = await readCredentials();
  if (!credentials) return failure("AUTH_REQUIRED", [], requiredScopes);
  if (!hasRequiredRemiliaScopes(credentials.grantedScopes, requiredScopes)) {
    await setLastError("MISSING_SCOPE");
    return failure("MISSING_SCOPE", credentials.grantedScopes, requiredScopes);
  }
  if (credentials.expiresAt > Date.now() + ACCESS_TOKEN_SKEW_MS) return grant(credentials);
  if (!credentials.refreshToken) {
    await clearCredentials();
    await setLastError("TOKEN_EXPIRED");
    return failure("TOKEN_EXPIRED", credentials.grantedScopes, requiredScopes);
  }
  return refreshRemiliaAccess(requiredScopes, options);
}

export async function refreshRemiliaAccess(
  requiredScopes: readonly string[] = [],
  options: { signal?: AbortSignal } = {},
): Promise<RemiliaAuthGrant> {
  throwIfAborted(options.signal);
  if (!authClientId) return failure("UNSUPPORTED", [], requiredScopes);
  const control = await readControl();
  if (control.migration.required) return failure("MIGRATION_REQUIRED", [], requiredScopes);
  if (control.disconnected) return failure("AUTH_REQUIRED", [], requiredScopes);

  if (!activeRefresh) {
    const generation = authGeneration;
    const abort = new AbortController();
    activeRefreshAbort = abort;
    const pending = performRefresh(generation, abort.signal);
    activeRefresh = pending;
    void pending.finally(() => {
      if (activeRefresh === pending) activeRefresh = null;
      if (activeRefreshAbort === abort) activeRefreshAbort = null;
    }).catch(() => undefined);
  }
  const refreshed = await raceWithAbort(activeRefresh, options.signal);
  if (!refreshed.ok) return refreshed;
  if (!hasRequiredRemiliaScopes(refreshed.grantedScopes, requiredScopes)) {
    await setLastError("MISSING_SCOPE");
    return failure("MISSING_SCOPE", refreshed.grantedScopes, requiredScopes);
  }
  return refreshed;
}

export async function connectRemiliaAuth(options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<RemiliaAuthGrant> {
  throwIfAborted(options.signal);
  if (!authClientId) return failure("UNSUPPORTED");
  const control = await readControl();
  if (control.migration.required) return failure("MIGRATION_REQUIRED");
  if (activeLogin) {
    await setLastError("CONCURRENT_LOGIN");
    return failure("CONCURRENT_LOGIN");
  }

  const generation = ++authGeneration;
  const abort = new AbortController();
  activeLoginAbort = abort;
  const combinedSignal = combineSignals(options.signal, abort.signal);
  const pending = performInteractiveLogin(generation, combinedSignal);
  activeLogin = pending;
  void pending.finally(() => {
    if (activeLogin === pending) activeLogin = null;
    if (activeLoginAbort === abort) activeLoginAbort = null;
  }).catch(() => undefined);
  try {
    return await withTimeout(pending, options.timeoutMs ?? DEFAULT_AUTH_TIMEOUT_MS, combinedSignal);
  } catch (error) {
    const code = normalizeAuthError(error);
    if (code === "AUTH_TIMEOUT" && activeLoginAbort === abort) {
      abort.abort(error);
      activeLoginAbort = null;
    }
    await setLastError(toUiError(code));
    return failure(code);
  }
}

export async function disconnectRemiliaAuth(): Promise<void> {
  invalidateActiveAuth();
  await clearCredentials();
  const control = await readControl();
  await writeControl({ ...control, disconnected: true, lastError: undefined });
}

export async function revokeRemiliaAuth(): Promise<{ remoteRevoked: boolean }> {
  const credentials = await readCredentials();
  invalidateActiveAuth();
  await clearCredentials();
  const control = await readControl();
  await writeControl({ ...control, disconnected: true, lastError: undefined });
  if (!credentials) return { remoteRevoked: true };

  let remoteRevoked = false;
  try {
    const discovery = await discoverOidc();
    if (!discovery.revocation_endpoint) throw new AuthProtocolError("UNSUPPORTED");
    const tokens = [
      [credentials.refreshToken, "refresh_token"],
      [credentials.accessToken, "access_token"],
    ] as const;
    const results = await Promise.all(tokens.filter(([token]) => token).map(async ([token, hint]) => {
      const response = await fetchWithTimeout(discovery.revocation_endpoint!, {
        method: "POST",
        credentials: "omit",
        redirect: "error",
        referrerPolicy: "no-referrer",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: authClientId, token, token_type_hint: hint }),
      });
      return response.ok;
    }));
    remoteRevoked = results.every(Boolean);
  } catch {
    remoteRevoked = false;
  }
  if (!remoteRevoked) await setLastError("OFFLINE");
  return { remoteRevoked };
}

export async function completeRemiliaAuthMigration(): Promise<void> {
  invalidateActiveAuth();
  await clearCredentials();
  await chrome.storage.local.remove([...REMILIA_LEGACY_TOKEN_KEYS, DISCONNECTED_KEY]);
  await writeControl({
    version: 1,
    disconnected: true,
    migration: { version: 1, required: false, legacyDeleted: true },
  });
}

export async function noteRemiliaAuthInstalled(reason: string): Promise<void> {
  const stored = await chrome.storage.local.get(CONTROL_KEY);
  const existing = normalizeControl(stored[CONTROL_KEY]);
  if (existing) return;
  await clearCredentials();
  await writeControl({
    version: 1,
    disconnected: true,
    migration: {
      version: 1,
      required: reason !== "install",
      legacyDeleted: reason === "install",
    },
  });
}

export async function getRemiliaAuthStatus(): Promise<RemiliaAuthStatus> {
  const control = await readControl();
  const requiredScopes = [...REMILIA_REQUIRED_SCOPES];
  if (!authClientId) {
    return {
      phase: "unsupported",
      grantedScopes: [],
      requiredScopes,
      migration: control.migration,
      lastError: { code: "UNSUPPORTED" },
    };
  }
  if (control.migration.required) {
    return {
      phase: "migration-required",
      grantedScopes: [],
      requiredScopes,
      migration: control.migration,
      lastError: control.lastError,
    };
  }
  if (activeLogin && activeLoginAbort) {
    return {
      phase: "connecting",
      grantedScopes: [],
      requiredScopes,
      migration: control.migration,
      lastError: control.lastError,
    };
  }
  if (control.disconnected) {
    return {
      phase: "disconnected",
      grantedScopes: [],
      requiredScopes,
      migration: control.migration,
      lastError: control.lastError,
    };
  }

  const credentials = await readCredentials();
  if (!credentials) {
    return {
      phase: "expired",
      grantedScopes: [],
      requiredScopes,
      migration: control.migration,
      lastError: control.lastError || { code: "TOKEN_EXPIRED" },
    };
  }
  const missingScope = !hasRequiredRemiliaScopes(credentials.grantedScopes, requiredScopes);
  return {
    phase: missingScope ? "missing-scope" : "connected",
    identity: credentials.identity,
    grantedScopes: [...credentials.grantedScopes],
    requiredScopes,
    migration: control.migration,
    lastError: missingScope ? { code: "MISSING_SCOPE" } : control.lastError,
  };
}

export async function isRemiliaDisconnected(): Promise<boolean> {
  const control = await readControl();
  return control.disconnected || control.migration.required;
}

async function performInteractiveLogin(generation: number, signal: AbortSignal): Promise<RemiliaAuthGrant> {
  let stage: "setup" | "launch" | "response" | "exchange" | "custody" = "setup";
  try {
    if (!chrome.identity?.launchWebAuthFlow || !chrome.identity?.getRedirectURL) {
      throw new AuthProtocolError("UNSUPPORTED");
    }
    const redirectUri = chrome.identity.getRedirectURL(authRedirectPath);
    validateRedirectContract(redirectUri);
    const state = randomBase64Url(32);
    const nonce = randomBase64Url(32);
    const verifier = randomBase64Url(64);
    const challenge = await sha256Base64Url(verifier);
    const authUrl = new URL(OIDC_ENDPOINTS.authorization_endpoint);
    authUrl.search = new URLSearchParams({
      client_id: authClientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: OIDC_SCOPE,
      prompt: "consent",
      state,
      nonce,
      code_challenge: challenge,
      code_challenge_method: "S256",
    }).toString();

    stage = "launch";
    const callbackUrl = await launchIdentityWebAuthFlow(authUrl.toString());
    stage = "response";
    const code = validateAuthorizationCallback(callbackUrl, redirectUri, state, OIDC_ISSUER);
    stage = "exchange";
    const discovery = await discoverOidc(signal);
    const tokenResponse = await exchangeToken(discovery.token_endpoint, {
      grant_type: "authorization_code",
      client_id: authClientId,
      code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
    }, signal);
    const credentials = await credentialsFromTokenResponse(tokenResponse, discovery, nonce);
    stage = "custody";
    throwIfInvalidated(generation, signal);
    await writeCredentials(credentials);
    throwIfInvalidated(generation, signal);
    const control = await readControl();
    await writeControl({ ...control, disconnected: false, lastError: undefined });
    return grant(credentials);
  } catch (error) {
    const normalized = normalizeAuthError(error);
    const code = normalized === "UNKNOWN" ? authErrorForStage(stage) : normalized;
    await setLastError(toUiError(code));
    return failure(code);
  }
}

async function performRefresh(generation: number, signal: AbortSignal): Promise<RemiliaAuthGrant> {
  const credentials = await readCredentials();
  if (!credentials?.refreshToken) return failure("TOKEN_EXPIRED", credentials?.grantedScopes || []);
  try {
    const discovery = await discoverOidc(signal);
    const tokenResponse = await exchangeToken(discovery.token_endpoint, {
      grant_type: "refresh_token",
      client_id: authClientId,
      refresh_token: credentials.refreshToken,
    }, signal);
    const rotated = await credentialsFromTokenResponse(tokenResponse, discovery, undefined, credentials, signal);
    throwIfInvalidated(generation);
    await writeCredentials(rotated);
    throwIfInvalidated(generation);
    await setLastError(undefined);
    return grant(rotated);
  } catch (error) {
    const code = normalizeAuthError(error);
    if (code === "REFRESH_REJECTED" || code === "TOKEN_EXPIRED") {
      await clearCredentials();
      await setLastError("TOKEN_EXPIRED");
      return failure("REFRESH_REJECTED", credentials.grantedScopes);
    }
    await setLastError(toUiError(code));
    return failure(code, credentials.grantedScopes);
  }
}

async function discoverOidc(signal?: AbortSignal): Promise<OidcDiscovery> {
  if (!discoveryPromise) {
    const pending = fetchDiscovery();
    discoveryPromise = pending;
    void pending.catch(() => {
      if (discoveryPromise === pending) discoveryPromise = null;
    });
  }
  return raceWithAbort(discoveryPromise, signal);
}

async function fetchDiscovery(): Promise<OidcDiscovery> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new DOMException("OIDC discovery timed out", "TimeoutError")), DISCOVERY_TIMEOUT_MS);
  try {
    const response = await fetch(OIDC_DISCOVERY_URL, {
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!response.ok) throw new AuthProtocolError("DISCOVERY_FAILED");
    const value = await readBoundedOidcJson<Partial<OidcDiscovery>>(response, OIDC_JSON_MAX_BYTES, "DISCOVERY_FAILED");
    const discovery: OidcDiscovery = {
      issuer: String(value.issuer || ""),
      authorization_endpoint: String(value.authorization_endpoint || ""),
      token_endpoint: String(value.token_endpoint || ""),
      jwks_uri: String(value.jwks_uri || ""),
      revocation_endpoint: typeof value.revocation_endpoint === "string" ? value.revocation_endpoint : undefined,
      end_session_endpoint: typeof value.end_session_endpoint === "string" ? value.end_session_endpoint : undefined,
      userinfo_endpoint: typeof value.userinfo_endpoint === "string" ? value.userinfo_endpoint : undefined,
      code_challenge_methods_supported: Array.isArray(value.code_challenge_methods_supported)
        ? value.code_challenge_methods_supported.map(String)
        : [],
      id_token_signing_alg_values_supported: Array.isArray(value.id_token_signing_alg_values_supported)
        ? value.id_token_signing_alg_values_supported.map(String)
        : [],
    };
    if (discovery.issuer !== OIDC_ISSUER
      || discovery.authorization_endpoint !== OIDC_ENDPOINTS.authorization_endpoint
      || discovery.token_endpoint !== OIDC_ENDPOINTS.token_endpoint
      || discovery.jwks_uri !== OIDC_ENDPOINTS.jwks_uri
      || (discovery.revocation_endpoint && discovery.revocation_endpoint !== OIDC_ENDPOINTS.revocation_endpoint)
      || (discovery.end_session_endpoint && discovery.end_session_endpoint !== OIDC_ENDPOINTS.end_session_endpoint)
      || (discovery.userinfo_endpoint && discovery.userinfo_endpoint !== OIDC_ENDPOINTS.userinfo_endpoint)
      || !discovery.code_challenge_methods_supported?.includes("S256")
      || !REMILIA_ACCEPTED_ID_TOKEN_ALGORITHMS.some((algorithm) => (
        discovery.id_token_signing_alg_values_supported?.includes(algorithm)
      ))) {
      throw new AuthProtocolError("DISCOVERY_FAILED");
    }
    return discovery;
  } catch (error) {
    if (error instanceof AuthProtocolError) throw error;
    throw new AuthProtocolError("DISCOVERY_FAILED");
  } finally {
    clearTimeout(timer);
  }
}

async function exchangeToken(endpoint: string, params: Record<string, string>, signal?: AbortSignal): Promise<TokenResponse> {
  try {
    const response = await fetchWithTimeout(endpoint, {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(params),
      signal,
    });
    const data = await readBoundedOidcJson<TokenResponse>(response, OIDC_JSON_MAX_BYTES, "TOKEN_RESPONSE_INVALID")
      .catch(() => ({} as TokenResponse));
    if (!response.ok) {
      if (data.error === "invalid_grant" && params.grant_type === "refresh_token") {
        throw new AuthProtocolError("REFRESH_REJECTED");
      }
      throw new AuthProtocolError("TOKEN_REQUEST_REJECTED");
    }
    return data;
  } catch (error) {
    if (error instanceof AuthProtocolError) throw error;
    if (isAbortError(error)) throw error;
    throw new AuthProtocolError("OFFLINE");
  }
}

async function credentialsFromTokenResponse(
  data: TokenResponse,
  discovery: OidcDiscovery,
  expectedNonce?: string,
  previous?: StoredCredentials,
  signal?: AbortSignal,
): Promise<StoredCredentials> {
  if (typeof data.access_token !== "string" || !data.access_token
    || (data.token_type !== undefined && String(data.token_type).toLowerCase() !== "bearer")) {
    throw new AuthProtocolError("TOKEN_RESPONSE_INVALID");
  }
  const returnedIdToken = typeof data.id_token === "string" && data.id_token ? data.id_token : "";
  const idToken = returnedIdToken || previous?.idToken || "";
  if (!idToken) throw new AuthProtocolError("ID_TOKEN_FORMAT_INVALID");
  const claims = returnedIdToken
    ? await validateIdToken(idToken, discovery, expectedNonce, signal)
    : previous ? { sub: previous.identity.id } : null;
  if (!claims) throw new AuthProtocolError("ID_TOKEN_FORMAT_INVALID");
  const expiresIn = Number(data.expires_in);
  if (!Number.isFinite(expiresIn) || expiresIn <= 0) throw new AuthProtocolError("TOKEN_RESPONSE_INVALID");
  const grantedScopes = normalizeScopes(data.scope, previous?.grantedScopes);
  return {
    version: 1,
    accessToken: data.access_token,
    refreshToken: typeof data.refresh_token === "string" && data.refresh_token
      ? data.refresh_token
      : previous?.refreshToken || "",
    idToken,
    expiresAt: Date.now() + Math.floor(expiresIn * 1000),
    grantedScopes,
    identity: returnedIdToken ? identityFromClaims(claims) : previous!.identity,
  };
}

async function validateIdToken(
  idToken: string,
  discovery: OidcDiscovery,
  expectedNonce?: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown>> {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new AuthProtocolError("ID_TOKEN_FORMAT_INVALID");
  const header = decodeJwtPart(parts[0]);
  if (!header) throw new AuthProtocolError("ID_TOKEN_FORMAT_INVALID");
  const algorithm = readIdTokenAlgorithm(header.alg);
  if (!algorithm || !discovery.id_token_signing_alg_values_supported?.includes(algorithm)) {
    throw new AuthProtocolError("ID_TOKEN_ALGORITHM_INVALID");
  }
  if (typeof header.kid !== "string" || !header.kid) throw new AuthProtocolError("ID_TOKEN_SIGNING_KEY_INVALID");
  let keys = await readJwks(discovery.jwks_uri, signal);
  let jwk = findSigningKey(keys, header.kid, algorithm);
  if (!jwk) {
    keys = await readJwks(discovery.jwks_uri, signal, true);
    jwk = findSigningKey(keys, header.kid, algorithm);
  }
  if (!jwk) throw new AuthProtocolError("ID_TOKEN_SIGNING_KEY_INVALID");
  try {
    let valid = await verifyIdTokenSignature(parts, jwk, algorithm);
    if (!valid) {
      keys = await readJwks(discovery.jwks_uri, signal, true);
      const refreshed = findSigningKey(keys, header.kid, algorithm);
      valid = Boolean(refreshed && await verifyIdTokenSignature(parts, refreshed, algorithm));
    }
    if (!valid) throw new AuthProtocolError("ID_TOKEN_SIGNATURE_INVALID");
  } catch (error) {
    if (error instanceof AuthProtocolError) throw error;
    throw new AuthProtocolError("ID_TOKEN_SIGNATURE_INVALID");
  }
  return validateIdTokenClaims(idToken, discovery.issuer, expectedNonce);
}

function readIdTokenAlgorithm(value: unknown): RemiliaIdTokenAlgorithm | undefined {
  return REMILIA_ACCEPTED_ID_TOKEN_ALGORITHMS.find((algorithm) => value === algorithm);
}

function findSigningKey(
  keys: JsonWebKey[],
  kid: string,
  algorithm: RemiliaIdTokenAlgorithm,
): JsonWebKey | undefined {
  return keys.find((candidate) => {
    if ((candidate as JsonWebKey & { kid?: string }).kid !== kid
      || candidate.use !== "sig"
      || candidate.alg !== algorithm) return false;
    if (algorithm === "RS256") return candidate.kty === "RSA";
    return candidate.kty === "OKP" && candidate.crv === "Ed25519";
  });
}

async function verifyIdTokenSignature(
  parts: string[],
  jwk: JsonWebKey,
  algorithm: RemiliaIdTokenAlgorithm,
): Promise<boolean> {
  const webCryptoAlgorithm = algorithm === "RS256"
    ? { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }
    : { name: "Ed25519" };
  const key = await crypto.subtle.importKey(
    "jwk",
    jwk,
    webCryptoAlgorithm,
    false,
    ["verify"],
  );
  return crypto.subtle.verify(
    webCryptoAlgorithm,
    key,
    base64UrlBytes(parts[2]).buffer as ArrayBuffer,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
}

async function readJwks(uri: string, signal?: AbortSignal, forceRefresh = false): Promise<JsonWebKey[]> {
  if (forceRefresh) jwksPromise = null;
  if (!jwksPromise) {
    const pending = fetchWithTimeout(uri, {
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        if (!response.ok) throw new AuthProtocolError("SIGNING_KEYS_UNAVAILABLE");
        const data = await readBoundedOidcJson<{ keys?: unknown }>(response, OIDC_JSON_MAX_BYTES, "SIGNING_KEYS_UNAVAILABLE");
        if (!Array.isArray(data.keys)) throw new AuthProtocolError("SIGNING_KEYS_UNAVAILABLE");
        return data.keys.filter((key): key is JsonWebKey => Boolean(key && typeof key === "object"));
      })
      .catch((error) => {
        if (error instanceof AuthProtocolError || isAbortError(error)) throw error;
        throw new AuthProtocolError("SIGNING_KEYS_UNAVAILABLE");
      });
    jwksPromise = pending;
    void pending.catch(() => {
      if (jwksPromise === pending) jwksPromise = null;
    });
  }
  return raceWithAbort(jwksPromise, signal);
}

function validateIdTokenClaims(idToken: string, issuer: string, expectedNonce?: string): Record<string, unknown> {
  const claims = decodeJwtPayload(idToken);
  if (!claims) throw new AuthProtocolError("ID_TOKEN_FORMAT_INVALID");
  if (claims.iss !== issuer) throw new AuthProtocolError("ID_TOKEN_ISSUER_INVALID");
  const audience = Array.isArray(claims.aud) ? claims.aud.map(String) : [String(claims.aud || "")];
  if (!audience.includes(authClientId)) throw new AuthProtocolError("ID_TOKEN_AUDIENCE_INVALID");
  if (audience.length > 1 && claims.azp !== authClientId) {
    throw new AuthProtocolError("ID_TOKEN_AUDIENCE_INVALID");
  }
  if (claims.azp !== undefined && claims.azp !== authClientId) {
    throw new AuthProtocolError("ID_TOKEN_AUDIENCE_INVALID");
  }
  if (expectedNonce !== undefined && claims.nonce !== expectedNonce) throw new AuthProtocolError("NONCE_MISMATCH");
  const expiresAt = Number(claims.exp) * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) throw new AuthProtocolError("TOKEN_EXPIRED");
  const issuedAt = Number(claims.iat) * 1000;
  if (!Number.isFinite(issuedAt) || issuedAt <= 0 || issuedAt > Date.now() + ID_TOKEN_CLOCK_SKEW_MS) {
    throw new AuthProtocolError("ID_TOKEN_TIME_INVALID");
  }
  if (typeof claims.sub !== "string" || !claims.sub) throw new AuthProtocolError("ID_TOKEN_SUBJECT_INVALID");
  return claims;
}

function identityFromClaims(claims: Record<string, unknown>): RemiliaAuthIdentity {
  return compactObject({
    id: String(claims.sub),
    displayName: optionalString(claims.name),
    username: optionalString(claims.preferred_username),
    avatarUrl: optionalHttpsUrl(claims.picture),
  });
}

function validateAuthorizationCallback(callback: string | undefined, redirectUri: string, state: string, issuer: string): string {
  if (!callback) throw new AuthProtocolError("CANCELLED");
  let actual: URL;
  let expected: URL;
  try {
    actual = new URL(callback);
    expected = new URL(redirectUri);
  } catch {
    throw new AuthProtocolError("REDIRECT_MISMATCH");
  }
  if (actual.origin !== expected.origin
    || actual.pathname !== expected.pathname
    || actual.username
    || actual.password
    || actual.hash) {
    throw new AuthProtocolError("REDIRECT_MISMATCH");
  }
  if (actual.searchParams.getAll("iss").length > 1
    || actual.searchParams.getAll("error").length > 1) {
    throw new AuthProtocolError("REDIRECT_MISMATCH");
  }
  const callbackIssuer = actual.searchParams.get("iss");
  if (callbackIssuer && callbackIssuer !== issuer) throw new AuthProtocolError("REDIRECT_MISMATCH");
  const oauthError = actual.searchParams.get("error");
  if (oauthError) throw new AuthProtocolError(oauthError === "access_denied" ? "ACCESS_DENIED" : "CANCELLED");
  if (actual.searchParams.getAll("state").length !== 1 || actual.searchParams.get("state") !== state) {
    throw new AuthProtocolError("STATE_MISMATCH");
  }
  if (actual.searchParams.getAll("code").length !== 1) throw new AuthProtocolError("TOKEN_EXCHANGE_FAILED");
  const code = actual.searchParams.get("code");
  if (!code) throw new AuthProtocolError("TOKEN_EXCHANGE_FAILED");
  return code;
}

function validateRedirectContract(redirectUri: string): void {
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== "https:"
      || !url.hostname.endsWith(".chromiumapp.org")
      || url.pathname !== `/${authRedirectPath}`
      || url.search
      || url.hash
      || url.username
      || url.password) {
      throw new Error("mismatch");
    }
    if (registeredRedirectUri && redirectUri !== registeredRedirectUri) throw new Error("mismatch");
  } catch {
    throw new AuthProtocolError("REDIRECT_MISMATCH");
  }
}

async function readCredentials(): Promise<StoredCredentials | null> {
  await configureSessionAccess();
  const session = chrome.storage.session;
  if (!session) throw new AuthProtocolError("UNSUPPORTED");
  const stored = await session.get(CREDENTIALS_KEY);
  const credentials = normalizeCredentials(stored[CREDENTIALS_KEY]);
  if (!credentials && stored[CREDENTIALS_KEY] !== undefined) await session.remove(CREDENTIALS_KEY);
  return credentials;
}

async function writeCredentials(credentials: StoredCredentials): Promise<void> {
  await configureSessionAccess();
  if (!chrome.storage.session) throw new AuthProtocolError("UNSUPPORTED");
  await chrome.storage.session.set({ [CREDENTIALS_KEY]: credentials });
}

async function clearCredentials(): Promise<void> {
  await configureSessionAccess();
  await chrome.storage.session?.remove(CREDENTIALS_KEY);
}

async function configureSessionAccess(): Promise<void> {
  if (sessionAccessConfigured) return;
  if (!chrome.storage.session) throw new AuthProtocolError("UNSUPPORTED");
  await chrome.storage.session.setAccessLevel?.({ accessLevel: "TRUSTED_CONTEXTS" }).catch(() => undefined);
  sessionAccessConfigured = true;
}

async function readControl(): Promise<AuthControl> {
  const stored = await chrome.storage.local.get(CONTROL_KEY);
  return normalizeControl(stored[CONTROL_KEY]) || {
    version: 1,
    disconnected: true,
    migration: { version: 1, required: false, legacyDeleted: false },
  };
}

async function writeControl(control: AuthControl): Promise<void> {
  await chrome.storage.local.set({ [CONTROL_KEY]: control });
}

async function setLastError(code?: RemiliaUiErrorCode): Promise<void> {
  const control = await readControl();
  await writeControl({ ...control, lastError: code ? { code } : undefined });
}

function normalizeCredentials(value: unknown): StoredCredentials | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<StoredCredentials>;
  if (raw.version !== 1
    || typeof raw.accessToken !== "string"
    || typeof raw.refreshToken !== "string"
    || typeof raw.idToken !== "string"
    || typeof raw.expiresAt !== "number"
    || !Array.isArray(raw.grantedScopes)
    || !raw.identity
    || typeof raw.identity.id !== "string") return null;
  return {
    version: 1,
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
    idToken: raw.idToken,
    expiresAt: raw.expiresAt,
    grantedScopes: normalizeScopes(raw.grantedScopes.join(" ")),
    identity: raw.identity,
  };
}

function normalizeControl(value: unknown): AuthControl | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Partial<AuthControl>;
  if (raw.version !== 1 || typeof raw.disconnected !== "boolean"
    || !raw.migration || raw.migration.version !== 1
    || typeof raw.migration.required !== "boolean"
    || typeof raw.migration.legacyDeleted !== "boolean") return null;
  return raw as AuthControl;
}

function normalizeScopes(value: unknown, fallback: readonly string[] = []): string[] {
  const entries = typeof value === "string" ? value.split(/\s+/) : [...fallback];
  return Array.from(new Set(entries.filter((scope): scope is string => typeof scope === "string" && scope.length > 0))).sort();
}

function grant(credentials: StoredCredentials): RemiliaAuthGrant {
  return {
    ok: true,
    accessToken: credentials.accessToken,
    tokenType: "Bearer",
    expiresAt: credentials.expiresAt,
    grantedScopes: [...credentials.grantedScopes],
  };
}

function failure(
  error: RemiliaAuthErrorCode,
  grantedScopes: readonly string[] = [],
  requiredScopes: readonly string[] = [],
): RemiliaAuthGrant {
  const granted = [...grantedScopes];
  const grantedSet = new Set(granted);
  return {
    ok: false,
    error,
    grantedScopes: granted,
    missingScopes: requiredScopes.filter((scope) => !grantedSet.has(scope)),
  };
}

function invalidateActiveAuth(): void {
  authGeneration += 1;
  activeLoginAbort?.abort(new DOMException("Remilia authentication cancelled", "AbortError"));
  activeLoginAbort = null;
  activeRefreshAbort?.abort(new DOMException("Remilia refresh cancelled", "AbortError"));
  activeRefreshAbort = null;
}

function throwIfInvalidated(generation: number, signal?: AbortSignal): void {
  throwIfAborted(signal);
  if (generation !== authGeneration) throw new AuthProtocolError("CANCELLED");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("Remilia authentication cancelled", "AbortError");
}

function normalizeAuthError(error: unknown): RemiliaAuthErrorCode {
  if (error instanceof AuthProtocolError) return error.code;
  if (isTimeoutError(error)) return "AUTH_TIMEOUT";
  if (isAbortError(error)) return "CANCELLED";
  const message = error instanceof Error ? error.message.toLowerCase() : "";
  if (message.includes("user did not approve") || message.includes("access denied")) return "ACCESS_DENIED";
  if (message.includes("canceled") || message.includes("cancelled") || message.includes("closed")) return "CANCELLED";
  if (message.includes("only one web auth flow") || (message.includes("web auth flow") && message.includes("in progress"))) {
    return "CONCURRENT_LOGIN";
  }
  if (message.includes("authorization page could not be loaded") || message.includes("authorization page load timed out")) {
    return "AUTH_PAGE_LOAD_FAILED";
  }
  if (message.includes("identity api is disabled in incognito")
    || message.includes("couldn't create a browser window")
    || message.includes("browser context has been shut down")
    || message.includes("auth url has an invalid scheme")
    || message.includes("did not redirect to the right url")) {
    return "AUTH_WINDOW_UNAVAILABLE";
  }
  return "UNKNOWN";
}

function toUiError(code: RemiliaAuthErrorCode): RemiliaUiErrorCode {
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

function authErrorForStage(stage: "setup" | "launch" | "response" | "exchange" | "custody"): RemiliaAuthErrorCode {
  if (stage === "launch") return "AUTH_WINDOW_FAILED";
  if (stage === "response") return "AUTH_RESPONSE_INVALID";
  if (stage === "exchange") return "TOKEN_EXCHANGE_FAILED";
  if (stage === "custody") return "AUTH_STORAGE_FAILED";
  return "AUTH_SETUP_FAILED";
}

function launchIdentityWebAuthFlow(url: string): Promise<string | undefined> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const succeed = (callbackUrl?: string) => {
      if (settled) return;
      settled = true;
      resolve(callbackUrl);
    };
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      const code = normalizeAuthError(error);
      reject(new AuthProtocolError(code === "UNKNOWN" ? "AUTH_WINDOW_FAILED" : code));
    };
    const callback = (callbackUrl?: string) => {
      const nativeMessage = chrome.runtime.lastError?.message;
      if (nativeMessage) fail(new Error(nativeMessage));
      else succeed(callbackUrl);
    };
    try {
      const returned = chrome.identity.launchWebAuthFlow(
        { url, interactive: true },
        callback,
      ) as Promise<string | undefined> | undefined;
      if (returned && typeof returned.then === "function") returned.then(succeed, fail);
    } catch (error) {
      fail(error);
    }
  });
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

function combineSignals(...signals: Array<AbortSignal | undefined>): AbortSignal {
  const present = signals.filter((signal): signal is AbortSignal => Boolean(signal));
  if (typeof AbortSignal.any === "function") return AbortSignal.any(present);
  const controller = new AbortController();
  const abort = (signal: AbortSignal) => controller.abort(signal.reason);
  for (const signal of present) {
    if (signal.aborted) {
      abort(signal);
      break;
    }
    signal.addEventListener("abort", () => abort(signal), { once: true });
  }
  return controller.signal;
}

async function raceWithAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  throwIfAborted(signal);
  return Promise.race([
    promise,
    new Promise<T>((_resolve, reject) => {
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }),
  ]);
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, signal?: AbortSignal): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await raceWithAbort(Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = setTimeout(() => reject(new DOMException("Remilia authentication timed out", "TimeoutError")), Math.max(1_000, timeoutMs));
      }),
    ]), signal);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const timeout = new AbortController();
  const signal = combineSignals(init.signal || undefined, timeout.signal);
  const timer = setTimeout(() => timeout.abort(new DOMException("OIDC request timed out", "TimeoutError")), OIDC_NETWORK_TIMEOUT_MS);
  try {
    return await raceWithAbort(fetch(input, { ...init, signal }), signal);
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedOidcJson<T>(
  response: Response,
  maxBytes: number,
  errorCode: RemiliaAuthErrorCode,
): Promise<T> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AuthProtocolError(errorCode);
  }
  if (!response.body) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) throw new AuthProtocolError(errorCode);
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new AuthProtocolError(errorCode);
    }
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new AuthProtocolError(errorCode);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new AuthProtocolError(errorCode);
  }
}

function decodeJwtPayload(value: string): Record<string, unknown> | null {
  try {
    const encoded = value.split(".")[1];
    return encoded ? decodeJwtPart(encoded) : null;
  } catch {
    return null;
  }
}

function decodeJwtPart(value: string): Record<string, unknown> | null {
  try {
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlBytes(value)));
    return decoded && typeof decoded === "object" && !Array.isArray(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function base64UrlBytes(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function optionalHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function compactObject<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as T;
}
