import type {
  RemiliaApiAuthGrant, RemiliaApiDirectoryIdentifier, RemiliaApiDirectoryIdentity, RemiliaApiDirectoryPage,
  RemiliaApiDirectoryResolution, RemiliaApiDirectoryResult, RemiliaApiDocumentedErrorCode, RemiliaApiErrorCategory,
  RemiliaApiErrorCode, RemiliaApiFailure, RemiliaApiProfile, RemiliaApiPublicIdentity, RemiliaApiRateLimit,
  RemiliaApiStats, RemiliaApiNotificationsPage, RemiliaApiNotification, RemiliaApiBeetleCards, RemiliaApiPoke,
  RemiliaApiChatMessage, RemiliaApiChatPage, RemiliaApiSuccess, RemiliaApiScope,
} from "./remilia-api-contract";
import { REMILIA_API_V1_BASE_URL } from "./remilia-api-contract";

const DOCUMENTED_ERROR_CODES = new Set<RemiliaApiDocumentedErrorCode>([
  "invalid_request", "unauthorized", "invalid_token", "insufficient_scope", "requires_user", "forbidden",
  "not_found", "user_not_found", "method_not_allowed", "rate_limited", "poke_cooldown", "internal_error", "invalid_reply",
]);

function apiUrl(path: string): URL {
  return new URL(`${REMILIA_API_V1_BASE_URL}${path}`);
}

function createDeadline(externalSignal: AbortSignal | undefined, timeoutMs: number): {
  signal: AbortSignal;
  timedOut: () => boolean;
  dispose: () => void;
} {
  const controller = new AbortController();
  let timeoutReached = false;
  const onAbort = () => controller.abort(externalSignal?.reason ?? new DOMException("Request aborted", "AbortError"));
  if (externalSignal?.aborted) onAbort();
  else externalSignal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => {
    timeoutReached = true;
    controller.abort(new DOMException("Request timed out", "TimeoutError"));
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timeoutReached,
    dispose: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", onAbort);
    },
  };
}

function validateGrant(
  grant: RemiliaApiAuthGrant | null,
  requiredScopes: readonly RemiliaApiScope[],
  missingCode: "unauthorized" | "invalid_token" = "unauthorized",
): RemiliaApiFailure | null {
  if (!grant) return failure("authentication", "auth_unavailable", 0);
  if (!grant.ok) return authGrantFailure(grant.error, missingCode);
  if (!grant.accessToken.trim() || grant.tokenType !== "Bearer") return failure("authentication", missingCode, 401);
  const issuedScopes = new Set(grant.grantedScopes);
  if (requiredScopes.some((scope) => !issuedScopes.has(scope))) return failure("authorization", "insufficient_scope", 403);
  return null;
}

function authGrantFailure(error: string, missingCode: "unauthorized" | "invalid_token"): RemiliaApiFailure {
  if (error === "MISSING_SCOPE") return failure("authorization", "insufficient_scope", 403);
  if (error === "AUTH_TIMEOUT") return failure("timeout", "request_timeout", 0);
  if (error === "CANCELLED") return failure("aborted", "request_aborted", 0);
  if (error === "OFFLINE") return failure("network", "network_error", 0);
  if (["TOKEN_EXPIRED", "REFRESH_REJECTED", "REVOKED"].includes(error)) return failure("authentication", "invalid_token", 401);
  return failure("authentication", missingCode, 401);
}

async function parseResponse(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) return null;
  return response.json().catch(() => null);
}

function envelopeData(value: unknown): unknown {
  return isObject(value) && Object.hasOwn(value, "data") ? value.data : undefined;
}

function normalizeHttpFailure(response: Response, value: unknown, now: number): RemiliaApiFailure {
  const error = isObject(value) && isObject(value.error) ? value.error : null;
  const code = error && typeof error.code === "string" && DOCUMENTED_ERROR_CODES.has(error.code as RemiliaApiDocumentedErrorCode)
    ? error.code as RemiliaApiDocumentedErrorCode
    : "unknown_error";
  const nextAllowedAt = error && typeof error.next_allowed_at === "number" && Number.isFinite(error.next_allowed_at)
    ? normalizeEpochSeconds(error.next_allowed_at)
    : undefined;
  const retryAfterMs = readRetryAfterMs(response.headers, now, nextAllowedAt);
  return failure(categoryFor(response.status, code), code, response.status, { retryAfterMs, nextAllowedAt });
}

function categoryFor(status: number, code: RemiliaApiErrorCode): RemiliaApiErrorCategory {
  if (code === "poke_cooldown") return "cooldown";
  if (status === 429) return "rate_limit";
  if (status === 401) return "authentication";
  if (status === 403) return "authorization";
  if (status === 404) return "not_found";
  if (status >= 500) return "server";
  return "request";
}

function failure(
  category: RemiliaApiErrorCategory,
  code: RemiliaApiErrorCode,
  status: number,
  optional: { retryAfterMs?: number; nextAllowedAt?: number } = {},
): RemiliaApiFailure {
  return {
    ok: false,
    error: {
      category,
      code,
      status,
      message: stableErrorMessage(code),
      ...(optional.retryAfterMs === undefined ? {} : { retryAfterMs: optional.retryAfterMs }),
      ...(optional.nextAllowedAt === undefined ? {} : { nextAllowedAt: optional.nextAllowedAt }),
    },
  };
}

function stableErrorMessage(code: RemiliaApiErrorCode): string {
  const messages: Record<RemiliaApiErrorCode, string> = {
    invalid_request: "The Remilia API request was invalid.",
    unauthorized: "Remilia authentication is required.",
    invalid_token: "The Remilia session expired or is invalid.",
    insufficient_scope: "The Remilia connection has not granted the required permission.",
    requires_user: "This Remilia API operation requires a signed-in user.",
    forbidden: "The Remilia API operation is not permitted.",
    not_found: "The requested Remilia resource was not found.",
    user_not_found: "The requested Remilia user was not found.",
    method_not_allowed: "The Remilia API operation is not supported.",
    rate_limited: "The Remilia API is rate limiting this operation.",
    poke_cooldown: "This Remilia poke is still on cooldown.",
    internal_error: "The Remilia API could not complete the operation.",
    invalid_reply: "The referenced Remilia chat message does not exist.",
    invalid_response: "The Remilia API returned an invalid response.",
    network_error: "The Remilia API could not be reached.",
    request_timeout: "The Remilia API request timed out.",
    request_aborted: "The Remilia API request was cancelled.",
    auth_unavailable: "Remilia authentication is unavailable.",
    unknown_error: "The Remilia API request failed.",
  };
  return messages[code];
}

function inputFailure(_reason: string): RemiliaApiFailure {
  return failure("request", "invalid_request", 400);
}

function invalidResponseFailure(): RemiliaApiFailure {
  return failure("invalid_response", "invalid_response", 0);
}

function requestFailure(error: unknown, timedOut: boolean, externallyAborted: boolean): RemiliaApiFailure {
  if (timedOut) return failure("timeout", "request_timeout", 0);
  if (externallyAborted || (error instanceof DOMException && error.name === "AbortError")) return failure("aborted", "request_aborted", 0);
  return failure("network", "network_error", 0);
}

function readRetryAfterMs(headers: Headers, now: number, nextAllowedAt?: number): number | undefined {
  if (nextAllowedAt !== undefined) return Math.max(0, nextAllowedAt * 1000 - now);
  const value = headers.get("retry-after");
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.round(seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : undefined;
}

function normalizeEpochSeconds(value: number): number {
  // The documented API uses Unix seconds, but deployed cooldown responses have
  // also returned Unix milliseconds. Keep the client contract in seconds.
  return value >= 100_000_000_000 ? value / 1000 : value;
}

function readRateLimit(headers: Headers): RemiliaApiRateLimit | undefined {
  const limit = finiteHeaderNumber(headers, "ratelimit-limit") ?? finiteHeaderNumber(headers, "x-ratelimit-limit");
  const remaining = finiteHeaderNumber(headers, "ratelimit-remaining") ?? finiteHeaderNumber(headers, "x-ratelimit-remaining");
  const reset = finiteHeaderNumber(headers, "ratelimit-reset") ?? finiteHeaderNumber(headers, "x-ratelimit-reset");
  if (limit === undefined && remaining === undefined && reset === undefined) return undefined;
  return {
    ...(limit === undefined ? {} : { limit }),
    ...(remaining === undefined ? {} : { remaining }),
    ...(reset === undefined ? {} : { resetAt: reset * 1000 }),
  };
}

function finiteHeaderNumber(headers: Headers, name: string): number | undefined {
  const value = headers.get(name);
  if (value === null) return undefined;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : undefined;
}

function validateHandle(value: string): string | null {
  return /^[A-Za-z0-9_.-]{1,64}$/.test(value) ? null : "handle is invalid";
}

function integerInRange(value: number, min: number, max: number): boolean {
  return Number.isSafeInteger(value) && value >= min && value <= max;
}

function isNumericId(value: string): boolean {
  return /^\d{1,32}$/.test(value);
}

function isOpaqueCursor(value: string): boolean {
  return value.length > 0 && value.length <= 2048 && !/[\u0000-\u001f\u007f]/.test(value);
}

function normalizeMaxPages(value: number | undefined): number | null {
  const normalized = value ?? 100;
  return integerInRange(normalized, 1, 10_000) ? normalized : null;
}

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isProfile(value: unknown): value is RemiliaApiProfile {
  return isObject(value) && isObject(value.user) && typeof value.user.username === "string" && typeof value.user.displayName === "string"
    && isObject(value.achievementContext) && isObject(value.viewerContext)
    && typeof value.isAuthenticated === "boolean" && typeof value.isOwnProfile === "boolean";
}

function isStats(value: unknown): value is RemiliaApiStats {
  return isObject(value) && typeof value.handle === "string" && typeof value.display_name === "string"
    && isObject(value.stats) && isObject(value.aggregate_scores);
}

function isPublicIdentity(value: unknown): value is RemiliaApiPublicIdentity {
  return isObject(value) && typeof value.handle === "string" && typeof value.display_name === "string" && typeof value.avatar_url === "string";
}

function isNotification(value: unknown): value is RemiliaApiNotification {
  return isObject(value) && typeof value.type === "string" && typeof value.read === "boolean" && typeof value.created_at === "number"
    && (value.from === undefined || isPublicIdentity(value.from));
}

function isNotificationsPage(value: unknown): value is RemiliaApiNotificationsPage {
  return isObject(value) && Array.isArray(value.notifications) && value.notifications.every(isNotification)
    && integerInRange(value.page, 1, Number.MAX_SAFE_INTEGER) && integerInRange(value.limit, 1, 50) && typeof value.has_more === "boolean";
}

function isBeetleCards(value: unknown): value is RemiliaApiBeetleCards {
  return isObject(value) && Object.values(value).every(isObject);
}

function isPoke(value: unknown): value is RemiliaApiPoke {
  return isObject(value) && typeof value.target_handle === "string" && typeof value.poked_at === "number";
}

function isChatMessage(value: unknown): value is RemiliaApiChatMessage {
  return isObject(value) && typeof value.id === "string" && isPublicIdentity(value.author)
    && typeof value.text === "string" && typeof value.created_at === "number";
}

function isChatPage(value: unknown): value is RemiliaApiChatPage {
  return isObject(value) && Array.isArray(value.messages) && value.messages.every(isChatMessage)
    && typeof value.has_more === "boolean" && (value.next_cursor === null || typeof value.next_cursor === "string");
}

function isDirectoryIdentifier(value: unknown): value is RemiliaApiDirectoryIdentifier {
  return isObject(value) && ["handle", "x_handle", "github", "discord"].includes(value.type)
    && typeof value.value === "string" && value.value.length > 0 && value.value.length <= 256;
}

function isDirectoryResult(value: unknown): value is RemiliaApiDirectoryResult {
  return isObject(value) && isDirectoryIdentifier(value.query) && (value.identity === null || isDirectoryIdentity(value.identity));
}

function isDirectoryIdentity(value: unknown): value is RemiliaApiDirectoryIdentity {
  return isObject(value)
    && typeof value.handle === "string"
    && optionalNullableString(value.display_name)
    && optionalNullableString(value.avatar_url)
    && optionalNullableString(value.avatar_url_small);
}

function optionalNullableString(value: unknown): boolean {
  return value === undefined || value === null || typeof value === "string";
}

function isDirectoryResultsEnvelopeData(value: unknown): value is RemiliaApiDirectoryResolution {
  return isObject(value) && Array.isArray(value.results) && value.results.every(isDirectoryResult);
}

function isDirectoryPage(value: unknown): value is RemiliaApiDirectoryPage {
  return isObject(value) && Array.isArray(value.users) && value.users.every(isPublicIdentity)
    && (value.next_cursor === null || typeof value.next_cursor === "string");
}

export {
  apiUrl, authGrantFailure, createDeadline, envelopeData, failure, inputFailure, invalidResponseFailure,
  isBeetleCards, isChatMessage, isChatPage, isDirectoryIdentifier, isDirectoryPage, isDirectoryResultsEnvelopeData,
  isNotificationsPage,
  isNumericId, isObject, isOpaqueCursor, isPoke, isProfile, isStats, normalizeHttpFailure, normalizeMaxPages,
  parseResponse, readRateLimit, requestFailure, validateGrant, validateHandle, integerInRange,
};
