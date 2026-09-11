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

/**
 * Directory resolution authorizes an identity from the exact query/handle
 * pair. Presentation fields are optional in provider responses and must not
 * turn an otherwise authoritative mapping into a miss.
 */
export type RemiliaApiDirectoryIdentity = {
  handle: string;
  display_name?: string | null;
  avatar_url?: string | null;
  avatar_url_small?: string | null;
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
  identity: RemiliaApiDirectoryIdentity | null;
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

