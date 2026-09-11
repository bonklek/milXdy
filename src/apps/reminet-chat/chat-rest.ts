import type {
  RemiliaApiChatMessage,
  RemiliaApiChatPage,
  RemiliaApiError,
  RemiliaApiFailure,
  RemiliaApiResult,
} from "../../platform/auth/remilia-api";
import type { AppRuntimeScheduler } from "../../platform/app-sdk/app-platform";
import type {
  RemiliaCapabilityBrokerResult,
  RemiliaCapabilityParams,
} from "../../platform/app-sdk/remilia-capabilities";

export const CHAT_REST_MESSAGE_LIMIT_BYTES = 8_192;
export const CHAT_REST_POST_INTERVAL_MS = 2_000;
export const CHAT_REST_POLL_INTERVAL_MS = 15_000;
export const CHAT_REST_POLL_MAX_BACKOFF_MS = 60_000;
export const CHAT_REST_PAGE_SIZE = 30;

export type ChatRestReconciliationReason =
  | "initial"
  | "manual"
  | "visibility-resume"
  | "poll"
  | "realtime-hint"
  | "realtime-gap"
  | "realtime-invalid"
  | "post";

export type ChatRestPageDelivery = {
  page: RemiliaApiChatPage;
  reason: ChatRestReconciliationReason | "older";
};

export type ChatRestCapabilityOperation = "listGlobalChatMessages" | "postGlobalChatMessage";

export type ChatRestCapabilityInvoker = <Operation extends ChatRestCapabilityOperation>(
  operation: Operation,
  params: RemiliaCapabilityParams[Operation],
) => Promise<RemiliaCapabilityBrokerResult>;

export type NormalizedOfficialChatMessage = {
  id: string;
  author: RemiliaApiChatMessage["author"];
  text: string;
  createdAt: number;
  editedAt?: number;
  replyToId?: string;
  media: NonNullable<RemiliaApiChatMessage["media"]>;
  reactions: NonNullable<RemiliaApiChatMessage["reactions"]>;
};

export type ChatRestFailureKind =
  | "auth-expired"
  | "missing-scope"
  | "rate-limited"
  | "offline"
  | "cancelled"
  | "invalid-response"
  | "failed";

export type ChatRestControllerOptions = {
  invokeCapability: ChatRestCapabilityInvoker;
  scheduler: AppRuntimeScheduler;
  now?: () => number;
  onPage: (delivery: ChatRestPageDelivery) => void;
  onFailure?: (error: RemiliaApiError, kind: ChatRestFailureKind) => void;
  recordDiagnostic?: (key: string, value: Record<string, unknown>) => void;
};

export class ChatRestController {
  private readonly invokeCapability: ChatRestControllerOptions["invokeCapability"];
  private readonly scheduler: AppRuntimeScheduler;
  private readonly now: () => number;
  private readonly onPage: ChatRestControllerOptions["onPage"];
  private readonly onFailure: NonNullable<ChatRestControllerOptions["onFailure"]>;
  private readonly recordDiagnostic: NonNullable<ChatRestControllerOptions["recordDiagnostic"]>;
  private cancelPollTimer: (() => void) | null = null;
  private latestListInFlight: Promise<RemiliaApiResult<RemiliaApiChatPage>> | null = null;
  private readonly olderListInFlight = new Map<string, Promise<RemiliaApiResult<RemiliaApiChatPage>>>();
  private postInFlight: Promise<RemiliaApiResult<RemiliaApiChatMessage>> | null = null;
  private pollingActive = false;
  private pendingReconciliation: ChatRestReconciliationReason | null = null;
  private consecutivePollFailures = 0;
  private readonly olderCursors = new Set<string>();
  private lastPostAttemptAt = Number.NEGATIVE_INFINITY;
  private serverPostGateUntil = 0;

  constructor(options: ChatRestControllerOptions) {
    this.invokeCapability = options.invokeCapability;
    this.scheduler = options.scheduler;
    this.now = options.now ?? Date.now;
    this.onPage = options.onPage;
    this.onFailure = options.onFailure ?? (() => undefined);
    this.recordDiagnostic = options.recordDiagnostic ?? (() => undefined);
  }

  setPollingActive(active: boolean): void {
    if (this.pollingActive === active) return;
    this.pollingActive = active;
    this.clearPollTimer();
    if (active) void this.requestReconciliation("visibility-resume");
    else this.pendingReconciliation = null;
  }

  dispose(): void {
    this.pollingActive = false;
    this.pendingReconciliation = null;
    this.clearPollTimer();
  }

  loadInitial(): Promise<RemiliaApiResult<RemiliaApiChatPage>> {
    return this.fetchPage(undefined, "initial");
  }

  loadOlder(before: string): Promise<RemiliaApiResult<RemiliaApiChatPage>> {
    return this.fetchPage(before, "older");
  }

  async requestReconciliation(reason: ChatRestReconciliationReason): Promise<RemiliaApiResult<RemiliaApiChatPage> | null> {
    if (!this.pollingActive && reason !== "initial" && reason !== "manual") {
      this.pendingReconciliation = reason;
      return null;
    }
    if (this.latestListInFlight) {
      this.pendingReconciliation = reason;
      return this.latestListInFlight;
    }
    return this.fetchPage(undefined, reason);
  }

  postMessage(text: string, replyToId?: string): Promise<RemiliaApiResult<RemiliaApiChatMessage>> {
    const validation = validateChatRestPost(text, replyToId);
    if (validation) return Promise.resolve(validation);
    if (this.postInFlight) return this.postInFlight;

    const now = this.now();
    const nextAllowedAt = Math.max(this.lastPostAttemptAt + CHAT_REST_POST_INTERVAL_MS, this.serverPostGateUntil);
    if (now < nextAllowedAt) return Promise.resolve(localRateLimitFailure(nextAllowedAt, now));
    this.lastPostAttemptAt = now;

    const request = this.invokeCapability("postGlobalChatMessage", {
      text,
      ...(replyToId === undefined ? {} : { replyToId }),
    })
      .then(normalizeMessageResult)
      .catch(() => localFailure("network", "network_error", 0))
      .then((result) => {
        this.recordResult("post", result);
        if (result.ok) {
          this.onPage({
            reason: "post",
            page: { messages: [result.data], has_more: false, next_cursor: null },
          });
          void this.requestReconciliation("post");
        } else {
          this.rememberServerGate(result.error);
          this.onFailure(result.error, classifyChatRestFailure(result.error));
        }
        return result;
      })
      .finally(() => {
        this.postInFlight = null;
      });
    this.postInFlight = request;
    return request;
  }

  nextPostAllowedAt(): number {
    return Math.max(this.lastPostAttemptAt + CHAT_REST_POST_INTERVAL_MS, this.serverPostGateUntil);
  }

  private fetchPage(
    before: string | undefined,
    reason: ChatRestReconciliationReason | "older",
  ): Promise<RemiliaApiResult<RemiliaApiChatPage>> {
    if (before === undefined && this.latestListInFlight) return this.latestListInFlight;
    if (before !== undefined && this.olderListInFlight.has(before)) return this.olderListInFlight.get(before)!;
    this.clearPollTimer();
    const request = this.invokeCapability("listGlobalChatMessages", {
      limit: CHAT_REST_PAGE_SIZE,
      ...(before === undefined ? {} : { before }),
    })
      .then(normalizePageResult)
      .catch(() => localFailure("network", "network_error", 0))
      .then((result) => {
        if (result.ok && (reason === "initial" || reason === "manual")) {
          if (result.data.has_more && !result.data.next_cursor) return localFailure("invalid_response", "invalid_response", 0);
          this.olderCursors.clear();
          if (result.data.next_cursor) this.olderCursors.add(result.data.next_cursor);
        } else if (result.ok && reason === "older") {
          const next = result.data.next_cursor;
          if (result.data.has_more && (!next || next === before || this.olderCursors.has(next))) {
            return localFailure("invalid_response", "invalid_response", 0);
          }
          if (next) this.olderCursors.add(next);
        }
        return result;
      })
      .then((result) => {
        this.recordResult(reason, result);
        if (result.ok) {
          this.consecutivePollFailures = 0;
          this.onPage({ page: result.data, reason });
        } else {
          this.consecutivePollFailures += 1;
          this.onFailure(result.error, classifyChatRestFailure(result.error));
        }
        return result;
      })
      .finally(() => {
        if (before === undefined) this.latestListInFlight = null;
        else this.olderListInFlight.delete(before);
        const pending = this.pendingReconciliation;
        this.pendingReconciliation = null;
        if (pending && this.pollingActive) {
          this.schedulePoll(0, pending);
          return;
        }
        if (this.pollingActive) this.schedulePoll(this.nextPollDelay(), "poll");
      });
    if (before === undefined) this.latestListInFlight = request;
    else this.olderListInFlight.set(before, request);
    return request;
  }

  private schedulePoll(delayMs: number, reason: ChatRestReconciliationReason): void {
    this.clearPollTimer();
    if (!this.pollingActive) return;
    this.cancelPollTimer = this.scheduler.timeout(() => {
      this.cancelPollTimer = null;
      void this.requestReconciliation(reason);
    }, delayMs);
  }

  private nextPollDelay(): number {
    if (this.consecutivePollFailures === 0) return CHAT_REST_POLL_INTERVAL_MS;
    return Math.min(
      CHAT_REST_POLL_MAX_BACKOFF_MS,
      CHAT_REST_POLL_INTERVAL_MS * 2 ** Math.min(this.consecutivePollFailures - 1, 2),
    );
  }

  private clearPollTimer(): void {
    this.cancelPollTimer?.();
    this.cancelPollTimer = null;
  }

  private rememberServerGate(error: RemiliaApiError): void {
    if (error.code !== "rate_limited") return;
    if (typeof error.nextAllowedAt === "number") this.serverPostGateUntil = Math.max(this.serverPostGateUntil, error.nextAllowedAt * 1_000);
    if (typeof error.retryAfterMs === "number") this.serverPostGateUntil = Math.max(this.serverPostGateUntil, this.now() + error.retryAfterMs);
  }

  private recordResult(reason: ChatRestReconciliationReason | "older", result: RemiliaApiResult<unknown>): void {
    this.recordDiagnostic("official-rest", result.ok
      ? { operation: reason === "post" ? "post" : "list", reason, ok: true, status: result.status }
      : {
          operation: reason === "post" ? "post" : "list",
          reason,
          ok: false,
          status: result.error.status,
          category: result.error.category,
          code: result.error.code,
        });
  }
}

export function validateChatRestPost(text: string, replyToId?: string): RemiliaApiFailure | null {
  const bytes = new TextEncoder().encode(text).byteLength;
  if (!text || bytes > CHAT_REST_MESSAGE_LIMIT_BYTES) return localFailure("request", "invalid_request", 400);
  if (replyToId !== undefined && !isOfficialMessageId(replyToId)) return localFailure("request", "invalid_request", 400);
  return null;
}

export function chatRestUtf8Bytes(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function classifyChatRestFailure(error: RemiliaApiError): ChatRestFailureKind {
  if (error.code === "invalid_token" || error.code === "unauthorized" || error.code === "auth_unavailable") return "auth-expired";
  if (error.code === "insufficient_scope") return "missing-scope";
  if (error.code === "rate_limited" || error.category === "rate_limit") return "rate-limited";
  if (error.category === "network" || error.category === "timeout") return "offline";
  if (error.category === "aborted") return "cancelled";
  if (error.category === "invalid_response") return "invalid-response";
  return "failed";
}

export function mergeOfficialChatMessages(
  current: readonly RemiliaApiChatMessage[],
  incoming: readonly RemiliaApiChatMessage[],
  maxMessages = 1_200,
): RemiliaApiChatMessage[] {
  const byId = new Map<string, RemiliaApiChatMessage>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) byId.set(message.id, message);
  return [...byId.values()]
    .sort((left, right) => left.created_at - right.created_at || compareNumericIds(left.id, right.id))
    .slice(-Math.max(1, maxMessages));
}

export function normalizeOfficialChatMessage(message: RemiliaApiChatMessage): NormalizedOfficialChatMessage {
  const reactionCounts = new Map<string, number>();
  for (const reaction of message.reactions ?? []) {
    const emoji = typeof reaction?.emoji === "string" ? reaction.emoji.trim() : "";
    const count = Number.isSafeInteger(reaction?.count) && reaction.count > 0 ? reaction.count : 0;
    if (!emoji || !count) continue;
    reactionCounts.set(emoji, (reactionCounts.get(emoji) ?? 0) + count);
  }
  const media = (message.media ?? []).flatMap((item) => {
    if (!item || typeof item.kind !== "string" || typeof item.url !== "string") return [];
    return [{
      kind: item.kind,
      url: item.url,
      ...(typeof item.thumbnail_url === "string" ? { thumbnail_url: item.thumbnail_url } : {}),
      ...(finitePositiveNumber(item.width) === undefined ? {} : { width: finitePositiveNumber(item.width) }),
      ...(finitePositiveNumber(item.height) === undefined ? {} : { height: finitePositiveNumber(item.height) }),
      ...(typeof item.is_animated === "boolean" ? { is_animated: item.is_animated } : {}),
    }];
  });
  return {
    id: message.id,
    author: { ...message.author },
    text: message.text,
    createdAt: message.created_at,
    ...(message.edited_at === undefined ? {} : { editedAt: message.edited_at }),
    ...(message.reply_to_id === undefined ? {} : { replyToId: message.reply_to_id }),
    media,
    reactions: [...reactionCounts].map(([emoji, count]) => ({ emoji, count })),
  };
}

function normalizePageResult(value: unknown): RemiliaApiResult<RemiliaApiChatPage> {
  if (!isRecord(value) || typeof value.ok !== "boolean") return localFailure("invalid_response", "invalid_response", 0);
  if (!value.ok) return normalizeFailure(value);
  if (!isRecord(value.data) || !Array.isArray(value.data.messages)
    || typeof value.data.has_more !== "boolean"
    || !(value.data.next_cursor === null || isOfficialMessageId(value.data.next_cursor))
    || !value.data.messages.every(isChatMessage)) {
    return localFailure("invalid_response", "invalid_response", 0);
  }
  return {
    ok: true,
    data: value.data as RemiliaApiChatPage,
    status: finiteNumber(value.status, 200),
  };
}

function normalizeMessageResult(value: unknown): RemiliaApiResult<RemiliaApiChatMessage> {
  if (!isRecord(value) || typeof value.ok !== "boolean") return localFailure("invalid_response", "invalid_response", 0);
  if (!value.ok) return normalizeFailure(value);
  if (!isChatMessage(value.data)) return localFailure("invalid_response", "invalid_response", 0);
  return { ok: true, data: value.data, status: finiteNumber(value.status, 200) };
}

function normalizeFailure(value: Record<string, unknown>): RemiliaApiFailure {
  if (!isRecord(value.error)) return localFailure("invalid_response", "invalid_response", 0);
  const brokerFailure = value.error.category === "broker" ? normalizedBrokerFailure(value.error.code) : null;
  const category = brokerFailure?.category ?? normalizedErrorCategory(value.error.category);
  const code = brokerFailure?.code ?? normalizedErrorCode(value.error.code);
  const status = finiteNumber(value.error.status, 0);
  return {
    ok: false,
    error: {
      category,
      code,
      status,
      message: stableFailureMessage(code),
      ...(typeof value.error.retryAfterMs === "number" ? { retryAfterMs: Math.max(0, value.error.retryAfterMs) } : {}),
      ...(typeof value.error.nextAllowedAt === "number" ? { nextAllowedAt: Math.max(0, value.error.nextAllowedAt) } : {}),
    },
  };
}

function normalizedBrokerFailure(code: unknown): Pick<RemiliaApiError, "category" | "code"> | null {
  if (code === "invalid_request") return { category: "request", code: "invalid_request" };
  if (code === "consent_required") return { category: "authorization", code: "requires_user" };
  if (code === "scope_mismatch") return { category: "authorization", code: "insufficient_scope" };
  if (code === "client_unavailable") return { category: "network", code: "network_error" };
  if ([
    "unauthorized_sender",
    "package_not_reviewed",
    "package_not_granted",
    "grant_revoked",
    "capability_not_declared",
    "operation_not_declared",
    "credential_isolation",
  ].includes(String(code))) return { category: "authorization", code: "forbidden" };
  return null;
}

function normalizedErrorCategory(value: unknown): RemiliaApiError["category"] {
  const allowed: readonly RemiliaApiError["category"][] = [
    "request", "authentication", "authorization", "not_found", "rate_limit", "cooldown",
    "server", "network", "timeout", "aborted", "invalid_response",
  ];
  return allowed.includes(value as RemiliaApiError["category"])
    ? value as RemiliaApiError["category"]
    : "invalid_response";
}

function normalizedErrorCode(value: unknown): RemiliaApiError["code"] {
  const allowed: readonly RemiliaApiError["code"][] = [
    "invalid_request", "unauthorized", "invalid_token", "insufficient_scope", "requires_user", "forbidden",
    "not_found", "user_not_found", "method_not_allowed", "rate_limited", "poke_cooldown", "internal_error",
    "invalid_reply", "invalid_response", "network_error", "request_timeout", "request_aborted", "auth_unavailable",
    "unknown_error",
  ];
  return allowed.includes(value as RemiliaApiError["code"])
    ? value as RemiliaApiError["code"]
    : "invalid_response";
}

function isChatMessage(value: unknown): value is RemiliaApiChatMessage {
  return isRecord(value)
    && isOfficialMessageId(value.id)
    && isRecord(value.author)
    && typeof value.author.handle === "string"
    && typeof value.author.display_name === "string"
    && typeof value.author.avatar_url === "string"
    && typeof value.text === "string"
    && typeof value.created_at === "number"
    && (value.reply_to_id === undefined || isOfficialMessageId(value.reply_to_id))
    && (value.media === undefined || Array.isArray(value.media))
    && (value.reactions === undefined || Array.isArray(value.reactions))
    && (value.edited_at === undefined || typeof value.edited_at === "number");
}

function isOfficialMessageId(value: unknown): value is string {
  return typeof value === "string" && /^\d{1,32}$/.test(value);
}

function localRateLimitFailure(nextAllowedAt: number, now: number): RemiliaApiFailure {
  return {
    ok: false,
    error: {
      category: "rate_limit",
      code: "rate_limited",
      status: 429,
      message: stableFailureMessage("rate_limited"),
      nextAllowedAt,
      retryAfterMs: Math.max(0, nextAllowedAt - now),
    },
  };
}

function localFailure(
  category: RemiliaApiError["category"],
  code: RemiliaApiError["code"],
  status: number,
): RemiliaApiFailure {
  return { ok: false, error: { category, code, status, message: stableFailureMessage(code) } };
}

function stableFailureMessage(code: RemiliaApiError["code"]): string {
  if (code === "invalid_token" || code === "unauthorized" || code === "auth_unavailable") return "Reconnect your Remilia account.";
  if (code === "insufficient_scope") return "Reconnect Remilia and grant Chat access.";
  if (code === "rate_limited") return "Wait before sending another message.";
  if (code === "network_error" || code === "request_timeout") return "Remilia Chat is offline. Your message was not sent.";
  if (code === "invalid_reply") return "The replied-to message is no longer available.";
  if (code === "invalid_request") return "The chat message is empty, too long, or invalid.";
  if (code === "requires_user") return "Send again from the Remilia Chat composer.";
  if (code === "forbidden") return "Remilia Chat access is not permitted.";
  return "Remilia Chat could not complete the request.";
}

function compareNumericIds(left: string, right: string): number {
  const normalizedLeft = left.replace(/^0+(?=\d)/, "");
  const normalizedRight = right.replace(/^0+(?=\d)/, "");
  if (normalizedLeft.length !== normalizedRight.length) return normalizedLeft.length - normalizedRight.length;
  return normalizedLeft.localeCompare(normalizedRight);
}

function finiteNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function finitePositiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
