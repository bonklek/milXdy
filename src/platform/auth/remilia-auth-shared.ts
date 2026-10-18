import type { RemiliaAuthErrorCode } from "./remilia-auth-contract";

export const REMILIA_BASE_URL = "https://www.remilia.net";
export const OIDC_ISSUER = `${REMILIA_BASE_URL}/oidc/realms/remilia`;
export const OIDC_DISCOVERY_URL = `${OIDC_ISSUER}/.well-known/openid-configuration`;
export const REMILIA_REQUIRED_SCOPES = [
  "remilia:stats.read", "remilia:notifications.read", "remilia:pokes.write", "remilia:beetle.read",
  "remilia:chat.read", "remilia:chat.write", "remilia:directory.read",
] as const;
export const REMILIA_ACCEPTED_ID_TOKEN_ALGORITHMS = ["RS256", "EdDSA"] as const;
export type RemiliaIdTokenAlgorithm = typeof REMILIA_ACCEPTED_ID_TOKEN_ALGORITHMS[number];
const protocolBase = `${OIDC_ISSUER}/protocol/openid-connect`;
export const OIDC_ENDPOINTS = {
  authorization_endpoint: `${protocolBase}/auth`, token_endpoint: `${protocolBase}/token`,
  jwks_uri: `${protocolBase}/certs`, revocation_endpoint: `${protocolBase}/revoke`,
  end_session_endpoint: `${protocolBase}/logout`, userinfo_endpoint: `${protocolBase}/userinfo`,
} as const;
export const DISCOVERY_TIMEOUT_MS = 10_000;
export const OIDC_NETWORK_TIMEOUT_MS = 10_000;
export const OIDC_JSON_MAX_BYTES = 256 * 1024;
export const ID_TOKEN_CLOCK_SKEW_MS = 5 * 60_000;
export const CREDENTIALS_KEY = "milxdy.remiliaAuth.credentials.v1";
export const CONTROL_KEY = "milxdy.remiliaAuth.control.v1";

let clientId = "";
let redirectPath = "remilia-oauth";
let registeredRedirectUri = "";

export class AuthProtocolError extends Error {
  readonly code: RemiliaAuthErrorCode;

  constructor(code: RemiliaAuthErrorCode) {
    super(code);
    this.name = "AuthProtocolError";
    this.code = code;
  }
}

export function configureAuthClient(config: { clientId: string; redirectPath?: string; redirectUri?: string }): void {
  const nextClientId = config.clientId.trim();
  const nextRedirectPath = (config.redirectPath || "remilia-oauth").trim().replace(/^\/+/, "");
  if (!nextClientId || !nextRedirectPath || nextRedirectPath.includes("?") || nextRedirectPath.includes("#")) {
    throw new Error("Invalid Remilia login client contract");
  }
  clientId = nextClientId;
  redirectPath = nextRedirectPath;
  registeredRedirectUri = config.redirectUri?.trim() || "";
}

export function authClientConfig(): { clientId: string; redirectPath: string; registeredRedirectUri: string } {
  return { clientId, redirectPath, registeredRedirectUri };
}

export function normalizeScopes(value: unknown, fallback: readonly string[] = []): string[] {
  const entries = typeof value === "string" ? value.split(/\s+/) : [...fallback];
  return Array.from(new Set(entries.filter((scope): scope is string => typeof scope === "string" && scope.length > 0))).sort();
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

export function isTimeoutError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "TimeoutError";
}

export function throwIfAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  throw signal.reason instanceof Error ? signal.reason : new DOMException("Remilia authentication cancelled", "AbortError");
}
