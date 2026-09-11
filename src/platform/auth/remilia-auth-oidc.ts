import type { OidcDiscovery, RemiliaAuthErrorCode, RemiliaAuthIdentity, StoredCredentials, TokenResponse } from "./remilia-auth-contract";
import { identityFromClaims } from "./remilia-auth-identity";
import {
  AuthProtocolError, DISCOVERY_TIMEOUT_MS, ID_TOKEN_CLOCK_SKEW_MS, OIDC_DISCOVERY_URL, OIDC_ENDPOINTS, OIDC_ISSUER,
  OIDC_JSON_MAX_BYTES, OIDC_NETWORK_TIMEOUT_MS, REMILIA_ACCEPTED_ID_TOKEN_ALGORITHMS,
  authClientConfig, isAbortError, normalizeScopes, throwIfAborted,
} from "./remilia-auth-shared";

type RemiliaIdTokenAlgorithm = typeof REMILIA_ACCEPTED_ID_TOKEN_ALGORITHMS[number];
let discoveryPromise: Promise<OidcDiscovery> | null = null;
let jwksPromise: Promise<JsonWebKey[]> | null = null;

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
    const { response, data } = await fetchOidcJsonWithTimeout<TokenResponse>(endpoint, {
      method: "POST",
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams(params),
      signal,
    }, "TOKEN_RESPONSE_INVALID").catch((error) => {
      if (isAbortError(error)) throw error;
      if (error instanceof AuthProtocolError) return { response: null, data: {} as TokenResponse };
      throw error;
    });
    if (!response) throw new AuthProtocolError("TOKEN_RESPONSE_INVALID");
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
    const pending = fetchOidcJsonWithTimeout<{ keys?: unknown }>(uri, {
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      headers: { Accept: "application/json" },
    }, "SIGNING_KEYS_UNAVAILABLE")
      .then(({ response, data }) => {
        if (!response.ok) throw new AuthProtocolError("SIGNING_KEYS_UNAVAILABLE");
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
  if (!audience.includes(authClientConfig().clientId)) throw new AuthProtocolError("ID_TOKEN_AUDIENCE_INVALID");
  if (audience.length > 1 && claims.azp !== authClientConfig().clientId) {
    throw new AuthProtocolError("ID_TOKEN_AUDIENCE_INVALID");
  }
  if (claims.azp !== undefined && claims.azp !== authClientConfig().clientId) {
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
      || url.pathname !== `/${authClientConfig().redirectPath}`
      || url.search
      || url.hash
      || url.username
      || url.password) {
      throw new Error("mismatch");
    }
    if (authClientConfig().registeredRedirectUri && redirectUri !== authClientConfig().registeredRedirectUri) throw new Error("mismatch");
  } catch {
    throw new AuthProtocolError("REDIRECT_MISMATCH");
  }
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

async function fetchOidcJsonWithTimeout<T>(
  input: RequestInfo | URL,
  init: RequestInit,
  errorCode: RemiliaAuthErrorCode,
): Promise<{ response: Response; data: T }> {
  const timeout = new AbortController();
  const signal = combineSignals(init.signal || undefined, timeout.signal);
  const timer = setTimeout(() => timeout.abort(new DOMException("OIDC request timed out", "TimeoutError")), OIDC_NETWORK_TIMEOUT_MS);
  try {
    const response = await raceWithAbort(fetch(input, { ...init, signal }), signal);
    const data = await readBoundedOidcJson<T>(response, OIDC_JSON_MAX_BYTES, errorCode, signal);
    return { response, data };
  } finally {
    clearTimeout(timer);
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
  signal?: AbortSignal,
): Promise<T> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new AuthProtocolError(errorCode);
  }
  if (!response.body) {
    const text = await raceWithAbort(response.text(), signal);
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
  const cancelReader = () => void reader.cancel(signal?.reason).catch(() => undefined);
  signal?.addEventListener("abort", cancelReader, { once: true });
  try {
    while (true) {
      const { done, value } = await raceWithAbort(reader.read(), signal);
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new AuthProtocolError(errorCode);
      }
      chunks.push(value);
    }
  } finally {
    signal?.removeEventListener("abort", cancelReader);
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

export {
  combineSignals, credentialsFromTokenResponse, discoverOidc, exchangeToken, fetchWithTimeout, randomBase64Url,
  raceWithAbort, sha256Base64Url, validateAuthorizationCallback, withTimeout,
  validateRedirectContract,
};
