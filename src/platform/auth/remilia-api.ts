import { parseAllowedUrl, type UrlAllowRule } from "../browser/url-allowlist";

export const REMILIA_API_V1_ORIGIN = "https://www.remilia.net";
export const REMILIA_API_V1_BASE_URL = `${REMILIA_API_V1_ORIGIN}/api/v1`;

export const REMILIA_SCOPE_STATS_READ = "remilia:stats.read";
export const REMILIA_SCOPE_NOTIFICATIONS_READ = "remilia:notifications.read";
export const REMILIA_SCOPE_POKES_WRITE = "remilia:pokes.write";
export const REMILIA_SCOPE_BEETLE_READ = "remilia:beetle.read";
export const REMILIA_SCOPE_CHAT_READ = "remilia:chat.read";
export const REMILIA_SCOPE_CHAT_WRITE = "remilia:chat.write";
export const REMILIA_SCOPE_DIRECTORY_READ = "remilia:directory.read";

export type RemiliaApiScope =
  | typeof REMILIA_SCOPE_STATS_READ
  | typeof REMILIA_SCOPE_NOTIFICATIONS_READ
  | typeof REMILIA_SCOPE_POKES_WRITE
  | typeof REMILIA_SCOPE_BEETLE_READ
  | typeof REMILIA_SCOPE_CHAT_READ
  | typeof REMILIA_SCOPE_CHAT_WRITE
  | typeof REMILIA_SCOPE_DIRECTORY_READ;

export const REMILIA_API_SCOPES: readonly RemiliaApiScope[] = [
  REMILIA_SCOPE_STATS_READ,
  REMILIA_SCOPE_NOTIFICATIONS_READ,
  REMILIA_SCOPE_POKES_WRITE,
  REMILIA_SCOPE_BEETLE_READ,
  REMILIA_SCOPE_CHAT_READ,
  REMILIA_SCOPE_CHAT_WRITE,
  REMILIA_SCOPE_DIRECTORY_READ,
];

export type RemiliaApiAuthGrant = {
  ok: true;
  accessToken: string;
  tokenType: "Bearer";
  expiresAt: number;
  grantedScopes: string[];
} | {
  ok: false;
  error: string;
  grantedScopes: string[];
  missingScopes: string[];
};

/**
 * Implemented by the trusted background auth owner. The API client never
 * reads credential storage and never starts an interactive login flow.
 */
export type RemiliaApiAuthProvider = {
  prepare(requiredScopes?: readonly string[], options?: { signal?: AbortSignal }): Promise<RemiliaApiAuthGrant>;
  refresh(requiredScopes?: readonly string[], options?: { signal?: AbortSignal }): Promise<RemiliaApiAuthGrant>;
};

export type RemiliaApiProfileUser = {
  username: string;
  displayName: string;
  bio?: string;
  location?: string;
  pfpUrl?: string;
  friendCount?: number;
  achievementsCount?: number;
  stats?: Record<string, unknown>;
  aggregateScores?: Record<string, number>;
  property?: Record<string, unknown>;
  [key: string]: unknown;
};

export type RemiliaApiProfile = {
  user: RemiliaApiProfileUser;
  achievementContext: Record<string, unknown>;
  viewerContext: { areFriends?: boolean; [key: string]: unknown };
  isAuthenticated: boolean;
  isOwnProfile: boolean;
};

export type RemiliaApiStats = {
  handle: string;
  display_name: string;
  stats: Record<string, unknown>;
  aggregate_scores: Record<string, number>;
};

export type RemiliaApiPublicIdentity = {
  handle: string;
  display_name: string;
  avatar_url: string;
  avatar_url_small?: string;
};

export type RemiliaApiNotification = {
  type: string;
  read: boolean;
  from?: RemiliaApiPublicIdentity;
  created_at: number;
  count?: number;
  guild_name?: string;
  message?: string;
  [key: string]: unknown;
};

export type RemiliaApiNotificationsPage = {
  notifications: RemiliaApiNotification[];
  page: number;
  limit: number;
  has_more: boolean;
};

export type RemiliaApiBeetleState = {
  xp?: number;
  level?: number;
  inventory?: unknown[] | Record<string, unknown>;
  hammer_durabilities?: Record<string, number>;
  cooldowns?: Record<string, unknown>;
  [key: string]: unknown;
};

export type RemiliaApiBeetleCard = {
  codename?: string;
  [key: string]: unknown;
};

export type RemiliaApiBeetleCards = Record<string, RemiliaApiBeetleCard>;

export type RemiliaApiPoke = {
  target_handle: string;
  poked_at: number;
};

export type RemiliaApiChatMedia = {
  kind: string;
  url: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
  is_animated?: boolean;
};

export type RemiliaApiChatReaction = { emoji: string; count: number };

export type RemiliaApiChatMessage = {
  id: string;
  author: RemiliaApiPublicIdentity;
  text: string;
  created_at: number;
  reply_to_id?: string;
  media?: RemiliaApiChatMedia[];
  reactions?: RemiliaApiChatReaction[];
  edited_at?: number;
};

export type RemiliaApiChatPage = {
  messages: RemiliaApiChatMessage[];
  has_more: boolean;
  next_cursor: string | null;
};

export type RemiliaApiDirectoryIdentifierType = "handle" | "x_handle" | "github" | "discord";
export type RemiliaApiDirectoryIdentifier = { type: RemiliaApiDirectoryIdentifierType; value: string };
export type RemiliaApiDirectoryResult = {
  query: RemiliaApiDirectoryIdentifier;
  identity: RemiliaApiPublicIdentity | null;
};
export type RemiliaApiDirectoryResolution = { results: RemiliaApiDirectoryResult[] };
export type RemiliaApiDirectoryPage = {
  users: RemiliaApiPublicIdentity[];
  next_cursor: string | null;
};

export type RemiliaApiDocumentedErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "invalid_token"
  | "insufficient_scope"
  | "requires_user"
  | "forbidden"
  | "not_found"
  | "user_not_found"
  | "method_not_allowed"
  | "rate_limited"
  | "poke_cooldown"
  | "internal_error"
  | "invalid_reply";

export type RemiliaApiLocalErrorCode =
  | "invalid_response"
  | "network_error"
  | "request_timeout"
  | "request_aborted"
  | "auth_unavailable";

export type RemiliaApiErrorCode = RemiliaApiDocumentedErrorCode | RemiliaApiLocalErrorCode | "unknown_error";
export type RemiliaApiErrorCategory =
  | "request"
  | "authentication"
  | "authorization"
  | "not_found"
  | "rate_limit"
  | "cooldown"
  | "server"
  | "network"
  | "timeout"
  | "aborted"
  | "invalid_response";

export type RemiliaApiError = {
  category: RemiliaApiErrorCategory;
  code: RemiliaApiErrorCode;
  message: string;
  status: number;
  retryAfterMs?: number;
  nextAllowedAt?: number;
};

export type RemiliaApiRateLimit = {
  limit?: number;
  remaining?: number;
  resetAt?: number;
};

export type RemiliaApiSuccess<T> = { ok: true; data: T; status: number; rateLimit?: RemiliaApiRateLimit };
export type RemiliaApiFailure = { ok: false; error: RemiliaApiError };
export type RemiliaApiResult<T> = RemiliaApiSuccess<T> | RemiliaApiFailure;

export type RemiliaApiOperation =
  | "getUserProfile"
  | "getMe"
  | "getMyStats"
  | "listMyNotifications"
  | "getMyBeetle"
  | "getMyBeetleCards"
  | "pokeUser"
  | "listGlobalChatMessages"
  | "postGlobalChatMessage"
  | "resolveDirectory"
  | "listDirectoryUsers";

export type RemiliaApiDiagnostic = {
  operation: RemiliaApiOperation;
  ok: boolean;
  attempt: 1 | 2;
  status: number;
  category?: RemiliaApiErrorCategory;
  code?: RemiliaApiErrorCode;
};

export type RemiliaApiClientOptions = {
  auth: RemiliaApiAuthProvider;
  fetch?: typeof fetch;
  timeoutMs?: number;
  now?: () => number;
  onDiagnostic?: (diagnostic: RemiliaApiDiagnostic) => void;
};

type RequestOptions = { signal?: AbortSignal };
type AuthenticatedProfileOptions = RequestOptions & { authenticated?: boolean };
type NotificationsOptions = RequestOptions & { limit?: number; page?: number };
type ChatListOptions = RequestOptions & { limit?: number; before?: string };
type DirectoryListOptions = RequestOptions & { limit?: number; cursor?: string };
type CollectOptions = RequestOptions & { maxPages?: number };

type EndpointRule = UrlAllowRule & { method: "GET" | "POST" };
const REMILIA_API_V1_REQUEST_RULES: readonly EndpointRule[] = [
  { method: "GET", origin: REMILIA_API_V1_ORIGIN, pathPattern: /^\/api\/v1\/users\/[^/]+$/, allowedSearchParams: [], allowHash: false },
  { method: "GET", origin: REMILIA_API_V1_ORIGIN, pathPattern: /^\/api\/v1\/me$/, allowedSearchParams: [], allowHash: false },
  { method: "GET", origin: REMILIA_API_V1_ORIGIN, pathPattern: /^\/api\/v1\/me\/stats$/, allowedSearchParams: [], allowHash: false },
  { method: "GET", origin: REMILIA_API_V1_ORIGIN, pathPattern: /^\/api\/v1\/me\/notifications$/, allowedSearchParams: ["limit", "page"], allowHash: false },
  { method: "GET", origin: REMILIA_API_V1_ORIGIN, pathPattern: /^\/api\/v1\/me\/beetle$/, allowedSearchParams: [], allowHash: false },
  { method: "GET", origin: REMILIA_API_V1_ORIGIN, pathPattern: /^\/api\/v1\/me\/beetle\/cards$/, allowedSearchParams: [], allowHash: false },
  { method: "POST", origin: REMILIA_API_V1_ORIGIN, pathPattern: /^\/api\/v1\/users\/[^/]+\/poke$/, allowedSearchParams: [], allowHash: false },
  { method: "GET", origin: REMILIA_API_V1_ORIGIN, pathPattern: /^\/api\/v1\/global-chat\/messages$/, allowedSearchParams: ["limit", "before"], allowHash: false },
  { method: "POST", origin: REMILIA_API_V1_ORIGIN, pathPattern: /^\/api\/v1\/global-chat\/messages$/, allowedSearchParams: [], allowHash: false },
  { method: "POST", origin: REMILIA_API_V1_ORIGIN, pathPattern: /^\/api\/v1\/directory\/resolve$/, allowedSearchParams: [], allowHash: false },
  { method: "GET", origin: REMILIA_API_V1_ORIGIN, pathPattern: /^\/api\/v1\/users$/, allowedSearchParams: ["limit", "cursor"], allowHash: false },
];

export function isAllowedRemiliaApiV1Request(method: string, value: string): boolean {
  if (method !== "GET" && method !== "POST") return false;
  return REMILIA_API_V1_REQUEST_RULES.some((rule) => rule.method === method && parseAllowedUrl(value, [rule]) !== null);
}

type Endpoint<T> = {
  operation: RemiliaApiOperation;
  method: "GET" | "POST";
  url: URL;
  requiredScopes: readonly RemiliaApiScope[];
  requireUser: boolean;
  authenticate: boolean;
  body?: unknown;
  validate: (value: unknown) => value is T;
  rateLimitKey?: string;
  bare?: boolean;
};

const DOCUMENTED_ERROR_CODES = new Set<RemiliaApiDocumentedErrorCode>([
  "invalid_request", "unauthorized", "invalid_token", "insufficient_scope", "requires_user", "forbidden",
  "not_found", "user_not_found", "method_not_allowed", "rate_limited", "poke_cooldown", "internal_error", "invalid_reply",
]);

export class RemiliaApiClient {
  private readonly auth: RemiliaApiAuthProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly onDiagnostic?: (diagnostic: RemiliaApiDiagnostic) => void;
  private readonly blockedUntil = new Map<string, number>();

  constructor(options: RemiliaApiClientOptions) {
    this.auth = options.auth;
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1, Number(options.timeoutMs)) : 30_000;
    this.now = options.now ?? Date.now;
    this.onDiagnostic = options.onDiagnostic;
  }

  getUserProfile(username: string, options: AuthenticatedProfileOptions = {}): Promise<RemiliaApiResult<RemiliaApiProfile>> {
    const invalid = validateHandle(username);
    if (invalid) return Promise.resolve(inputFailure(invalid));
    return this.execute({
      operation: "getUserProfile", method: "GET", url: apiUrl(`/users/${encodeURIComponent(username)}`),
      requiredScopes: [], requireUser: false, authenticate: options.authenticated === true,
      validate: isProfile, bare: true,
    }, options.signal);
  }

  getMe(options: RequestOptions = {}): Promise<RemiliaApiResult<RemiliaApiProfile>> {
    return this.execute({
      operation: "getMe", method: "GET", url: apiUrl("/me"), requiredScopes: [], requireUser: true,
      authenticate: true, validate: isProfile, bare: true,
    }, options.signal);
  }

  getMyStats(options: RequestOptions = {}): Promise<RemiliaApiResult<RemiliaApiStats>> {
    return this.execute({
      operation: "getMyStats", method: "GET", url: apiUrl("/me/stats"), requiredScopes: [REMILIA_SCOPE_STATS_READ],
      requireUser: true, authenticate: true, validate: isStats,
    }, options.signal);
  }

  listMyNotifications(options: NotificationsOptions = {}): Promise<RemiliaApiResult<RemiliaApiNotificationsPage>> {
    if (options.limit !== undefined && !integerInRange(options.limit, 1, 50)) return Promise.resolve(inputFailure("limit must be between 1 and 50"));
    if (options.page !== undefined && !integerInRange(options.page, 1, Number.MAX_SAFE_INTEGER)) return Promise.resolve(inputFailure("page must be a positive integer"));
    const url = apiUrl("/me/notifications");
    if (options.limit !== undefined) url.searchParams.set("limit", String(options.limit));
    if (options.page !== undefined) url.searchParams.set("page", String(options.page));
    return this.execute({
      operation: "listMyNotifications", method: "GET", url, requiredScopes: [REMILIA_SCOPE_NOTIFICATIONS_READ],
      requireUser: true, authenticate: true, validate: isNotificationsPage,
    }, options.signal);
  }

  getMyBeetle(options: RequestOptions = {}): Promise<RemiliaApiResult<RemiliaApiBeetleState>> {
    return this.execute({
      operation: "getMyBeetle", method: "GET", url: apiUrl("/me/beetle"), requiredScopes: [REMILIA_SCOPE_BEETLE_READ],
      requireUser: true, authenticate: true, validate: isObject,
    }, options.signal);
  }

  getMyBeetleCards(options: RequestOptions = {}): Promise<RemiliaApiResult<RemiliaApiBeetleCards>> {
    return this.execute({
      operation: "getMyBeetleCards", method: "GET", url: apiUrl("/me/beetle/cards"), requiredScopes: [REMILIA_SCOPE_BEETLE_READ],
      requireUser: true, authenticate: true, validate: isBeetleCards,
    }, options.signal);
  }

  pokeUser(handle: string, options: RequestOptions = {}): Promise<RemiliaApiResult<RemiliaApiPoke>> {
    const invalid = validateHandle(handle);
    if (invalid) return Promise.resolve(inputFailure(invalid));
    const encoded = encodeURIComponent(handle);
    return this.execute({
      operation: "pokeUser", method: "POST", url: apiUrl(`/users/${encoded}/poke`), requiredScopes: [REMILIA_SCOPE_POKES_WRITE],
      requireUser: true, authenticate: true, validate: isPoke, rateLimitKey: `pokeUser:${encoded}`,
    }, options.signal);
  }

  listGlobalChatMessages(options: ChatListOptions = {}): Promise<RemiliaApiResult<RemiliaApiChatPage>> {
    if (options.limit !== undefined && !integerInRange(options.limit, 1, 100)) return Promise.resolve(inputFailure("limit must be between 1 and 100"));
    if (options.before !== undefined && !isNumericId(options.before)) return Promise.resolve(inputFailure("before must be a numeric message id"));
    const url = apiUrl("/global-chat/messages");
    if (options.limit !== undefined) url.searchParams.set("limit", String(options.limit));
    if (options.before !== undefined) url.searchParams.set("before", options.before);
    return this.execute({
      operation: "listGlobalChatMessages", method: "GET", url, requiredScopes: [REMILIA_SCOPE_CHAT_READ],
      requireUser: false, authenticate: true, validate: isChatPage,
    }, options.signal);
  }

  postGlobalChatMessage(text: string, replyToId?: string, options: RequestOptions = {}): Promise<RemiliaApiResult<RemiliaApiChatMessage>> {
    if (!text || new TextEncoder().encode(text).byteLength > 8192) return Promise.resolve(inputFailure("text must be between 1 and 8192 UTF-8 bytes"));
    if (replyToId !== undefined && !isNumericId(replyToId)) return Promise.resolve(inputFailure("reply_to_id must be numeric"));
    return this.execute({
      operation: "postGlobalChatMessage", method: "POST", url: apiUrl("/global-chat/messages"), requiredScopes: [REMILIA_SCOPE_CHAT_WRITE],
      requireUser: true, authenticate: true, body: { text, ...(replyToId === undefined ? {} : { reply_to_id: replyToId }) },
      validate: isChatMessage, rateLimitKey: "postGlobalChatMessage",
    }, options.signal);
  }

  resolveDirectory(identifiers: readonly RemiliaApiDirectoryIdentifier[], options: RequestOptions = {}): Promise<RemiliaApiResult<RemiliaApiDirectoryResolution>> {
    if (identifiers.length < 1 || identifiers.length > 50 || !identifiers.every(isDirectoryIdentifier)) {
      return Promise.resolve(inputFailure("identifiers must contain 1 to 50 supported, non-empty identifiers"));
    }
    return this.execute({
      operation: "resolveDirectory", method: "POST", url: apiUrl("/directory/resolve"), requiredScopes: [REMILIA_SCOPE_DIRECTORY_READ],
      requireUser: false, authenticate: true, body: { identifiers }, validate: isDirectoryResultsEnvelopeData,
    }, options.signal);
  }

  listDirectoryUsers(options: DirectoryListOptions = {}): Promise<RemiliaApiResult<RemiliaApiDirectoryPage>> {
    if (options.limit !== undefined && !integerInRange(options.limit, 1, 100)) return Promise.resolve(inputFailure("limit must be between 1 and 100"));
    if (options.cursor !== undefined && !isOpaqueCursor(options.cursor)) return Promise.resolve(inputFailure("cursor is invalid"));
    const url = apiUrl("/users");
    if (options.limit !== undefined) url.searchParams.set("limit", String(options.limit));
    if (options.cursor !== undefined) url.searchParams.set("cursor", options.cursor);
    return this.execute({
      operation: "listDirectoryUsers", method: "GET", url, requiredScopes: [REMILIA_SCOPE_DIRECTORY_READ],
      requireUser: false, authenticate: true, validate: isDirectoryPage,
    }, options.signal);
  }

  async collectMyNotifications(options: NotificationsOptions & CollectOptions = {}): Promise<RemiliaApiResult<RemiliaApiNotification[]>> {
    const maxPages = normalizeMaxPages(options.maxPages);
    if (!maxPages) return inputFailure("maxPages must be a positive integer");
    const notifications: RemiliaApiNotification[] = [];
    let page = options.page ?? 1;
    for (let count = 0; count < maxPages; count += 1) {
      const result = await this.listMyNotifications({ limit: options.limit, page, signal: options.signal });
      if (!result.ok) return result;
      notifications.push(...result.data.notifications);
      if (!result.data.has_more) return { ...result, data: notifications };
      page = result.data.page + 1;
    }
    return inputFailure("pagination exceeded maxPages");
  }

  async collectGlobalChatMessages(options: ChatListOptions & CollectOptions = {}): Promise<RemiliaApiResult<RemiliaApiChatMessage[]>> {
    const maxPages = normalizeMaxPages(options.maxPages);
    if (!maxPages) return inputFailure("maxPages must be a positive integer");
    const messages: RemiliaApiChatMessage[] = [];
    const cursors = new Set<string>();
    let before = options.before;
    for (let count = 0; count < maxPages; count += 1) {
      const result = await this.listGlobalChatMessages({ limit: options.limit, before, signal: options.signal });
      if (!result.ok) return result;
      messages.push(...result.data.messages);
      if (!result.data.has_more) return { ...result, data: messages };
      const cursor = result.data.next_cursor;
      if (!cursor || cursors.has(cursor)) return invalidResponseFailure();
      cursors.add(cursor);
      before = cursor;
    }
    return inputFailure("pagination exceeded maxPages");
  }

  async collectDirectoryUsers(options: DirectoryListOptions & CollectOptions = {}): Promise<RemiliaApiResult<RemiliaApiPublicIdentity[]>> {
    const maxPages = normalizeMaxPages(options.maxPages);
    if (!maxPages) return inputFailure("maxPages must be a positive integer");
    const users: RemiliaApiPublicIdentity[] = [];
    const cursors = new Set<string>();
    let cursor = options.cursor;
    for (let count = 0; count < maxPages; count += 1) {
      const result = await this.listDirectoryUsers({ limit: options.limit, cursor, signal: options.signal });
      if (!result.ok) return result;
      users.push(...result.data.users);
      const next = result.data.next_cursor;
      if (!next) return { ...result, data: users };
      if (cursors.has(next)) return invalidResponseFailure();
      cursors.add(next);
      cursor = next;
    }
    return inputFailure("pagination exceeded maxPages");
  }

  private async execute<T>(endpoint: Endpoint<T>, externalSignal?: AbortSignal): Promise<RemiliaApiResult<T>> {
    if (!isAllowedRemiliaApiV1Request(endpoint.method, endpoint.url.toString())) return inputFailure("endpoint is not allowlisted");
    const rateLimitKey = endpoint.rateLimitKey ?? endpoint.operation;
    const blockedUntil = this.blockedUntil.get(rateLimitKey) ?? 0;
    if (blockedUntil > this.now()) {
      return failure("rate_limit", "rate_limited", 429, { retryAfterMs: blockedUntil - this.now() });
    }

    const deadline = createDeadline(externalSignal, this.timeoutMs);
    try {
      let session: Extract<RemiliaApiAuthGrant, { ok: true }> | null = null;
      if (endpoint.authenticate) {
        const grant = await this.auth.prepare(endpoint.requiredScopes, { signal: deadline.signal });
        const authFailure = validateGrant(grant, endpoint.requiredScopes);
        if (authFailure) return authFailure;
        session = grant && grant.ok ? grant : null;
      }

      for (let attempt = 1 as 1 | 2; attempt <= 2; attempt = 2) {
        const response = await this.performFetch(endpoint, session, deadline.signal).catch((error: unknown) => error);
        if (!(response instanceof Response)) {
          const result = requestFailure(response, deadline.timedOut(), externalSignal?.aborted === true);
          this.emitDiagnostic(endpoint.operation, attempt, result);
          return result;
        }

        const parsed = await parseResponse(response);
        if (response.ok) {
          const value = endpoint.bare ? parsed : envelopeData(parsed);
          if (!endpoint.validate(value)) {
            const result = invalidResponseFailure();
            this.emitDiagnostic(endpoint.operation, attempt, result);
            return result;
          }
          const rateLimit = readRateLimit(response.headers);
          if (rateLimit?.remaining === 0 && rateLimit.resetAt !== undefined && rateLimit.resetAt > this.now()) {
            this.blockedUntil.set(rateLimitKey, rateLimit.resetAt);
          }
          const success: RemiliaApiSuccess<T> = {
            ok: true,
            data: value,
            status: response.status,
            ...(rateLimit ? { rateLimit } : {}),
          };
          this.emitDiagnostic(endpoint.operation, attempt, success);
          return success;
        }

        const result = normalizeHttpFailure(response, parsed, this.now());
        if (response.status === 401 && endpoint.authenticate && attempt === 1) {
          const grant = await this.auth.refresh(endpoint.requiredScopes, { signal: deadline.signal });
          const authFailure = validateGrant(grant, endpoint.requiredScopes, "invalid_token");
          if (authFailure) {
            this.emitDiagnostic(endpoint.operation, attempt, authFailure);
            return authFailure;
          }
          session = grant && grant.ok ? grant : null;
          continue;
        }
        if (response.status === 429) {
          const delay = result.error.retryAfterMs ?? 0;
          if (delay > 0) this.blockedUntil.set(rateLimitKey, this.now() + delay);
        }
        this.emitDiagnostic(endpoint.operation, attempt, result);
        return result;
      }
      return failure("authentication", "invalid_token", 401);
    } catch (error) {
      const result = requestFailure(error, deadline.timedOut(), externalSignal?.aborted === true);
      this.emitDiagnostic(endpoint.operation, 1, result);
      return result;
    } finally {
      deadline.dispose();
    }
  }

  private performFetch<T>(endpoint: Endpoint<T>, session: Extract<RemiliaApiAuthGrant, { ok: true }> | null, signal: AbortSignal): Promise<Response> {
    const headers = new Headers({ Accept: "application/json" });
    if (session) headers.set("Authorization", `Bearer ${session.accessToken}`);
    if (endpoint.body !== undefined) headers.set("Content-Type", "application/json");
    return this.fetchImpl(endpoint.url, {
      method: endpoint.method,
      headers,
      body: endpoint.body === undefined ? undefined : JSON.stringify(endpoint.body),
      credentials: "omit",
      redirect: "error",
      referrerPolicy: "no-referrer",
      signal,
    });
  }

  private emitDiagnostic<T>(operation: RemiliaApiOperation, attempt: 1 | 2, result: RemiliaApiResult<T>): void {
    if (!this.onDiagnostic) return;
    try {
      if (result.ok) this.onDiagnostic({ operation, ok: true, attempt, status: result.status });
      else this.onDiagnostic({ operation, ok: false, attempt, status: result.error.status, category: result.error.category, code: result.error.code });
    } catch {
      // Diagnostics are observational and must never change request behavior.
    }
  }
}

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
    ? error.next_allowed_at
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
  return isObject(value) && isDirectoryIdentifier(value.query) && (value.identity === null || isPublicIdentity(value.identity));
}

function isDirectoryResultsEnvelopeData(value: unknown): value is RemiliaApiDirectoryResolution {
  return isObject(value) && Array.isArray(value.results) && value.results.every(isDirectoryResult);
}

function isDirectoryPage(value: unknown): value is RemiliaApiDirectoryPage {
  return isObject(value) && Array.isArray(value.users) && value.users.every(isPublicIdentity)
    && (value.next_cursor === null || typeof value.next_cursor === "string");
}
