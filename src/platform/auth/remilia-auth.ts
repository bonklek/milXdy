import {
  AuthProtocolError, CONTROL_KEY, OIDC_ENDPOINTS, OIDC_ISSUER, REMILIA_ACCEPTED_ID_TOKEN_ALGORITHMS,
  REMILIA_REQUIRED_SCOPES, authClientConfig, configureAuthClient, throwIfAborted,
} from "./remilia-auth-shared";
export { REMILIA_ACCEPTED_ID_TOKEN_ALGORITHMS, REMILIA_BASE_URL, REMILIA_REQUIRED_SCOPES } from "./remilia-auth-shared";
export type { RemiliaIdTokenAlgorithm } from "./remilia-auth-shared";
const OIDC_SCOPE = ["openid", ...REMILIA_REQUIRED_SCOPES].join(" ");
const DEFAULT_AUTH_TIMEOUT_MS = 120_000;
const ACCESS_TOKEN_SKEW_MS = 30_000;
declare const MILXDY_REMILIA_CLIENT_ID: string | undefined;
declare const MILXDY_REMILIA_ISSUER_URI: string | undefined;
declare const MILXDY_REMILIA_REDIRECT_PATH: string | undefined;
declare const MILXDY_REMILIA_REDIRECT_URI: string | undefined;

const ACCESS_TOKEN_KEY = "beetol.accessToken";
const REFRESH_TOKEN_KEY = "beetol.refreshToken";
const DISCONNECTED_KEY = "beetol.disconnected";
const LEGACY_PREFIX = "bex" + "tol";
const LEGACY_ACCESS_TOKEN_KEY = `${LEGACY_PREFIX}.accessToken`;
const LEGACY_REFRESH_TOKEN_KEY = `${LEGACY_PREFIX}.refreshToken`;

export const REMILIA_AUTH_STATE_VERSION = 1;
export const REMILIA_AUTH_MIGRATION_VERSION = 1;
export const REMILIA_LEGACY_TOKEN_KEYS = [
  ACCESS_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  LEGACY_ACCESS_TOKEN_KEY,
  LEGACY_REFRESH_TOKEN_KEY,
] as const;

import type {
  AuthControl, OidcDiscovery, RemiliaAuthErrorCode, RemiliaAuthGrant, RemiliaAuthIdentity,
  RemiliaAuthProvider, RemiliaAuthStatus, RemiliaUiErrorCode, StoredCredentials, TokenResponse,
} from "./remilia-auth-contract";
export type {
  AuthControl, OidcDiscovery, RemiliaAuthErrorCode, RemiliaAuthGrant, RemiliaAuthIdentity,
  RemiliaAuthProvider, RemiliaAuthStatus, RemiliaUiErrorCode, StoredCredentials, TokenResponse,
} from "./remilia-auth-contract";
import {
  combineSignals, credentialsFromTokenResponse, discoverOidc, exchangeToken, fetchWithTimeout, randomBase64Url,
  raceWithAbort, sha256Base64Url, validateAuthorizationCallback, validateRedirectContract, withTimeout,
} from "./remilia-auth-oidc";
import { clearCredentials, normalizeControl, readControl, readCredentials, setLastError, writeControl, writeCredentials } from "./remilia-auth-storage";
import { authErrorForStage, launchIdentityWebAuthFlow, normalizeAuthError, toUiError } from "./remilia-auth-errors";
let authGeneration = 0;
let activeLogin: Promise<RemiliaAuthGrant> | null = null;
let activeLoginAbort: AbortController | null = null;
let activeRefresh: Promise<RemiliaAuthGrant> | null = null;
let activeRefreshAbort: AbortController | null = null;

export function configureRemiliaAuthClient(config: { clientId: string; redirectPath?: string; redirectUri?: string }): void {
  configureAuthClient(config);
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
  if (!authClientConfig().clientId) return failure("UNSUPPORTED", [], requiredScopes);
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
  if (!authClientConfig().clientId) return failure("UNSUPPORTED", [], requiredScopes);
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
  if (!authClientConfig().clientId) return failure("UNSUPPORTED");
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
        body: new URLSearchParams({ client_id: authClientConfig().clientId, token, token_type_hint: hint }),
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
  if (!authClientConfig().clientId) {
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
    const redirectUri = chrome.identity.getRedirectURL(authClientConfig().redirectPath);
    validateRedirectContract(redirectUri);
    const state = randomBase64Url(32);
    const nonce = randomBase64Url(32);
    const verifier = randomBase64Url(64);
    const challenge = await sha256Base64Url(verifier);
    const authUrl = new URL(OIDC_ENDPOINTS.authorization_endpoint);
    authUrl.search = new URLSearchParams({
      client_id: authClientConfig().clientId,
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
      client_id: authClientConfig().clientId,
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
      client_id: authClientConfig().clientId,
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
