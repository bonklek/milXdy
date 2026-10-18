import type {
  RemiliaApiAuthGrant, RemiliaApiAuthProvider, RemiliaApiBeetleCards, RemiliaApiBeetleState,
  RemiliaApiChatMessage, RemiliaApiChatPage, RemiliaApiDiagnostic, RemiliaApiDirectoryIdentifier,
  RemiliaApiClientOptions, RemiliaApiDirectoryPage, RemiliaApiDirectoryResolution, RemiliaApiFailure, RemiliaApiNotification,
  RemiliaApiNotificationsPage, RemiliaApiOperation, RemiliaApiProfile, RemiliaApiPublicIdentity,
  RemiliaApiPoke, RemiliaApiRateLimit, RemiliaApiResult, RemiliaApiScope, RemiliaApiStats, RemiliaApiSuccess,
} from "./remilia-api-contract";
import {
  REMILIA_API_V1_BASE_URL, REMILIA_SCOPE_BEETLE_READ, REMILIA_SCOPE_CHAT_READ, REMILIA_SCOPE_CHAT_WRITE,
  REMILIA_SCOPE_DIRECTORY_READ, REMILIA_SCOPE_NOTIFICATIONS_READ, REMILIA_SCOPE_POKES_WRITE,
  REMILIA_SCOPE_STATS_READ, isAllowedRemiliaApiV1Request,
} from "./remilia-api-contract";

export {
  REMILIA_API_SCOPES, REMILIA_API_V1_BASE_URL, REMILIA_API_V1_ORIGIN, REMILIA_SCOPE_BEETLE_READ,
  REMILIA_SCOPE_CHAT_READ, REMILIA_SCOPE_CHAT_WRITE, REMILIA_SCOPE_DIRECTORY_READ,
  REMILIA_SCOPE_NOTIFICATIONS_READ, REMILIA_SCOPE_POKES_WRITE, REMILIA_SCOPE_STATS_READ,
  isAllowedRemiliaApiV1Request,
} from "./remilia-api-contract";
export type {
  RemiliaApiAuthGrant, RemiliaApiAuthProvider, RemiliaApiBeetleCard, RemiliaApiBeetleCards,
  RemiliaApiBeetleState, RemiliaApiChatMedia, RemiliaApiChatMessage, RemiliaApiChatPage,
  RemiliaApiChatReaction, RemiliaApiClientOptions, RemiliaApiDiagnostic, RemiliaApiDirectoryIdentifier,
  RemiliaApiDirectoryIdentifierType, RemiliaApiDirectoryIdentity, RemiliaApiDirectoryPage,
  RemiliaApiDirectoryResolution, RemiliaApiDirectoryResult, RemiliaApiDocumentedErrorCode,
  RemiliaApiError, RemiliaApiErrorCategory, RemiliaApiErrorCode, RemiliaApiFailure,
  RemiliaApiLocalErrorCode, RemiliaApiNotification, RemiliaApiNotificationsPage, RemiliaApiOperation,
  RemiliaApiPoke, RemiliaApiProfile, RemiliaApiProfileUser, RemiliaApiPublicIdentity,
  RemiliaApiRateLimit, RemiliaApiResult, RemiliaApiScope, RemiliaApiStats, RemiliaApiSuccess,
} from "./remilia-api-contract";
type RequestOptions = { signal?: AbortSignal };
type AuthenticatedProfileOptions = RequestOptions & { authenticated?: boolean };
type NotificationsOptions = RequestOptions & { limit?: number; page?: number };
type ChatListOptions = RequestOptions & { limit?: number; before?: string };
type DirectoryListOptions = RequestOptions & { limit?: number; cursor?: string };
type CollectOptions = RequestOptions & { maxPages?: number };
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

import {
  apiUrl, authGrantFailure, createDeadline, envelopeData, failure, inputFailure, invalidResponseFailure,
  isBeetleCards, isChatMessage, isChatPage, isDirectoryIdentifier, isDirectoryPage, isDirectoryResultsEnvelopeData,
  isNotificationsPage, isNumericId, isObject, isOpaqueCursor, isPoke, isProfile, isStats, normalizeHttpFailure, normalizeMaxPages,
  parseResponse, readRateLimit, requestFailure, validateGrant, validateHandle, integerInRange,
} from "./remilia-api-support";

export class RemiliaApiClient {
  private readonly auth: RemiliaApiAuthProvider;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly onDiagnostic?: (diagnostic: RemiliaApiDiagnostic) => void;
  private readonly blockedUntil = new Map<string, number>();

  constructor(options: RemiliaApiClientOptions) {
    this.auth = options.auth;
    this.fetchImpl = (options.fetch ?? globalThis.fetch).bind(globalThis);
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
