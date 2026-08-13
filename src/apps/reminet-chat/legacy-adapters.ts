import { isRemiliaMediaUrl } from "../../platform/media/remilia-media-allowlist";

export const LEGACY_CHAT_ID = 1;
export const LEGACY_SOCKET_URL = "wss://www.remilia.net/api/ws";
export const LEGACY_SOCKET_ORIGIN = "https://www.remilia.net";
export const LEGACY_MEDIA_UPLOAD_URL = "https://www.remilia.net/media/upload/";
export const LEGACY_MEDIA_CONFIRM_URL = "https://www.remilia.net/media/upload/confirm";
export const LEGACY_SOCKET_OPEN_TIMEOUT_MS = 12_000;
export const LEGACY_SOCKET_IDLE_TIMEOUT_MS = 70_000;
export const LEGACY_UPLOAD_TIMEOUT_MS = 30_000;
export const LEGACY_CONFIRM_TIMEOUT_MS = 12_000;
export const LEGACY_MUTATION_ACK_TIMEOUT_MS = 5_000;
export const LEGACY_RESPONSE_MAX_BYTES = 64 * 1024;
export const LEGACY_SOCKET_FRAME_MAX_BYTES = 256 * 1024;
export const LEGACY_SOCKET_COMMAND_MAX_BYTES = 16 * 1024;
export const LEGACY_CHAT_TEXT_MAX_BYTES = 8 * 1024;
export const LEGACY_MAX_MEDIA_IDS = 4;
export const LEGACY_MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const LEGACY_MAX_VIDEO_BYTES = 32 * 1024 * 1024;
export const LEGACY_PORT_RECONNECT_DELAYS_MS = Object.freeze([500, 1_000, 2_500, 5_000, 10_000] as const);

export const LEGACY_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
export const LEGACY_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export type LegacyAdapterId = "reminet-realtime-v0" | "reminet-media-v0";

export type LegacyAdapterRegistryEntry = Readonly<{
  id: LegacyAdapterId;
  classification: "legacy-undocumented";
  authority: "acceleration-only" | "media-mutation-only";
  transports: readonly string[];
  officialFallback: string;
  removalConditions: readonly string[];
}>;

export const LEGACY_ADAPTER_REGISTRY: readonly LegacyAdapterRegistryEntry[] = Object.freeze([
  Object.freeze({
    id: "reminet-realtime-v0",
    classification: "legacy-undocumented",
    authority: "acceleration-only",
    transports: Object.freeze([LEGACY_SOCKET_URL]),
    officialFallback: "GET /api/v1/global-chat/messages remains authoritative and reconciles every accepted or dropped realtime hint.",
    removalConditions: Object.freeze([
      "The official Remilia API documents a scoped realtime global-chat stream with equivalent deliver, edit, delete, and reaction coverage.",
      "The official stream passes reconnect, extension-worker restart, payload-boundary, and privacy parity tests.",
      "A release ships the official stream for one full cycle with the legacy adapter disabled by default and no material regression.",
    ]),
  }),
  Object.freeze({
    id: "reminet-media-v0",
    classification: "legacy-undocumented",
    authority: "media-mutation-only",
    transports: Object.freeze([LEGACY_MEDIA_UPLOAD_URL, LEGACY_MEDIA_CONFIRM_URL, LEGACY_SOCKET_URL]),
    officialFallback: "Text-only and reply-only messages use POST /api/v1/global-chat/messages after attachments are removed; media is never silently split from its message.",
    removalConditions: Object.freeze([
      "The official Remilia API documents scoped media upload plus media-bearing global-chat posting, or explicitly declares media unsupported.",
      "The official path provides equivalent type, size, timeout, retry, privacy, and confirmed-media semantics.",
      "Migration tests prove pending attachments survive failures and the legacy upload, confirm, and media-submit paths have no remaining callers.",
    ]),
  }),
]);

export type LegacyAdapterErrorCode =
  | "AUTH_REQUIRED"
  | "INVALID_ATTACHMENT"
  | "UNSUPPORTED_ATTACHMENT_TYPE"
  | "ATTACHMENT_TYPE_MISMATCH"
  | "ATTACHMENT_TOO_LARGE"
  | "LEGACY_ADAPTER_UNAVAILABLE"
  | "LEGACY_UPLOAD_TIMEOUT"
  | "LEGACY_UPLOAD_REJECTED"
  | "LEGACY_UPLOAD_RESPONSE_INVALID"
  | "LEGACY_CONFIRM_TIMEOUT"
  | "LEGACY_CONFIRM_REJECTED"
  | "LEGACY_CONFIRM_RESPONSE_INVALID"
  | "LEGACY_MEDIA_SUBMIT_UNAVAILABLE"
  | "LEGACY_MEDIA_SUBMIT_REJECTED"
  | "INVALID_LEGACY_COMMAND"
  | "INVALID_LEGACY_EVENT"
  | "LEGACY_FRAME_DROPPED";

export type LegacyAdapterFailure = Readonly<{
  ok: false;
  error: LegacyAdapterErrorCode;
  retryable: boolean;
}>;

export type LegacyMediaReference = Readonly<{
  mediaId: number;
  url: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
}>;

export type LegacyMediaUploadSuccess = Readonly<{
  ok: true;
  media: LegacyMediaReference;
}>;

export type LegacyMediaUploadOutcome = LegacyMediaUploadSuccess | LegacyAdapterFailure;

export type LegacyMediaUploadRequest = Readonly<{
  mimeType: string;
  dataUrl: string;
}>;

export type LegacyMediaSubmitMutation = Readonly<{
  type: "submit";
  payload: Readonly<{
    chat_id: typeof LEGACY_CHAT_ID;
    text: string;
    in_reply_to_id?: number;
    media_ids: readonly number[];
  }>;
}>;

export type LegacyReactionMutation = Readonly<{
  type: "react" | "unreact";
  payload: Readonly<{
    chat_id: typeof LEGACY_CHAT_ID;
    message_id: number;
    emoji: string;
  }>;
}>;

export type LegacySocketMutation = LegacyMediaSubmitMutation | LegacyReactionMutation;

export type LegacySocketClientCommand =
  | Readonly<{ type: "connect" }>
  | Readonly<{ type: "close" }>
  | Readonly<{ type: "mutate"; requestId: string; mutation: LegacySocketMutation }>;

export type LegacySocketBridgeCommand =
  | Readonly<{ type: "connect" }>
  | Readonly<{ type: "close" }>
  | Readonly<{ type: "mutate"; requestId: string; mutation: LegacySocketMutation }>;

export type LegacySocketBridgeEvent =
  | Readonly<{ type: "socket:connecting" }>
  | Readonly<{ type: "socket:open"; at: number }>
  | Readonly<{ type: "socket:heartbeat"; ok: true; readyState: number; at: number }>
  | Readonly<{ type: "socket:hint"; event: LegacySocketHintType; at: number }>
  | Readonly<{ type: "socket:mutation-sent"; requestId: string; at: number }>
  | Readonly<{ type: "socket:close"; code: number; reason: "remote-close"; wasClean: boolean }>
  | Readonly<{ type: "socket:error"; error: "Connection interrupted." | "Socket is not open."; reason: LegacySocketReason }>
  | Readonly<{ type: "socket:reconcile"; reason: LegacyReconciliationReason }>;

export type LegacySocketReason =
  | "site-bridge-required"
  | "site-socket-error"
  | "site-socket-not-open"
  | "socket-open-timeout"
  | "invalid-client-command"
  | "invalid-bridge-event";

export type LegacyReconciliationReason =
  | "legacy-frame"
  | "legacy-frame-dropped"
  | "legacy-socket-open"
  | "legacy-socket-close"
  | "legacy-worker-restart";

export type LegacySocketHintType = "deliver" | "message_edit" | "reaction" | "message_delete" | "error";

export type LegacySocketFrame = Readonly<{
  type: "deliver" | "message_edit" | "reaction" | "message_delete" | "error";
  payload: Record<string, unknown>;
}>;

export function legacyAdapterEntry(id: LegacyAdapterId): LegacyAdapterRegistryEntry {
  const entry = LEGACY_ADAPTER_REGISTRY.find((candidate) => candidate.id === id);
  if (!entry) throw new Error(`Unknown legacy adapter: ${id}`);
  return entry;
}

export function legacyPortReconnectDelay(attempt: number): number {
  const normalized = Number.isFinite(attempt) ? Math.max(0, Math.floor(attempt)) : 0;
  return LEGACY_PORT_RECONNECT_DELAYS_MS[Math.min(normalized, LEGACY_PORT_RECONNECT_DELAYS_MS.length - 1)];
}

export function isExactLegacySocketUrl(value: string): boolean {
  return value === LEGACY_SOCKET_URL;
}

export function isExactLegacyHttpEndpoint(value: string, expected: string): boolean {
  if (expected !== LEGACY_MEDIA_UPLOAD_URL && expected !== LEGACY_MEDIA_CONFIRM_URL) return false;
  try {
    const url = new URL(value);
    const endpoint = new URL(expected);
    return url.href === endpoint.href && url.origin === LEGACY_SOCKET_ORIGIN && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

export function isAllowedLegacySender(
  sender: chrome.runtime.MessageSender | undefined,
  role: "x-content" | "remilia-bridge",
): boolean {
  if (!sender || sender.id !== chrome.runtime.id || typeof sender.tab?.id !== "number") return false;
  if (sender.frameId !== undefined && sender.frameId !== 0) return false;
  const source = sender.url || sender.origin || sender.tab.url || "";
  try {
    const url = new URL(source);
    if (url.protocol !== "https:" || url.username || url.password) return false;
    if (role === "remilia-bridge") return url.origin === LEGACY_SOCKET_ORIGIN;
    return url.origin === "https://x.com" || url.origin === "https://twitter.com";
  } catch {
    return false;
  }
}

export function parseLegacyMediaUploadRequest(value: unknown): LegacyMediaUploadRequest | null {
  const record = exactRecord(value, ["type", "mimeType", "dataUrl"]);
  if (!record || record.type !== "reminetChat:legacy:uploadAttachment") return null;
  if (typeof record.mimeType !== "string" || typeof record.dataUrl !== "string") return null;
  const mimeType = record.mimeType.toLowerCase();
  if (!isAllowedLegacyMediaType(mimeType)) return null;
  const maxBytes = maxLegacyAttachmentBytes(mimeType);
  if (record.dataUrl.length > maxLegacyDataUrlCharacters(maxBytes)) return null;
  return { mimeType, dataUrl: record.dataUrl };
}

export function parseLegacySocketClientCommand(value: unknown): LegacySocketClientCommand | null {
  if (encodedByteLength(value) > LEGACY_SOCKET_COMMAND_MAX_BYTES) return null;
  const record = exactRecord(value, ["type", "requestId", "mutation"]);
  if (!record || typeof record.type !== "string") return null;
  if (record.type === "connect" || record.type === "close") {
    return Object.keys(record).length === 1 ? { type: record.type } : null;
  }
  if (record.type !== "mutate" || Object.keys(record).length !== 3 || !isLegacyRequestId(record.requestId)) return null;
  const mutation = parseLegacySocketMutation(record.mutation);
  return mutation ? { type: "mutate", requestId: record.requestId as string, mutation } : null;
}

export function parseLegacySocketBridgeCommand(value: unknown): LegacySocketBridgeCommand | null {
  return parseLegacySocketClientCommand(value);
}

export function parseLegacySocketBridgeEvent(value: unknown): LegacySocketBridgeEvent | null {
  if (encodedByteLength(value) > LEGACY_SOCKET_FRAME_MAX_BYTES + 1024) return null;
  const record = objectRecord(value);
  if (!record) return null;
  const type = record?.type;
  if (type === "socket:connecting" && hasExactKeys(record, ["type"])) return { type };
  if (type === "socket:open" && hasExactKeys(record, ["type", "at"]) && isSafeTimestamp(record.at)) {
    return { type, at: record.at as number };
  }
  if (type === "socket:heartbeat" && hasExactKeys(record, ["type", "ok", "readyState", "at"])
    && record.ok === true && isSafeInteger(record.readyState, 0, 3) && isSafeTimestamp(record.at)) {
    return { type, ok: true, readyState: record.readyState as number, at: record.at as number };
  }
  if (type === "socket:hint" && hasExactKeys(record, ["type", "event", "at"])
    && isLegacyFrameType(record.event) && isSafeTimestamp(record.at)) {
    return { type, event: record.event, at: record.at as number };
  }
  if (type === "socket:mutation-sent" && hasExactKeys(record, ["type", "requestId", "at"])
    && isLegacyRequestId(record.requestId) && isSafeTimestamp(record.at)) {
    return { type, requestId: record.requestId as string, at: record.at as number };
  }
  if (type === "socket:close" && hasExactKeys(record, ["type", "code", "reason", "wasClean"])
    && isSafeInteger(record.code, 0, 4999) && record.reason === "remote-close" && typeof record.wasClean === "boolean") {
    return { type, code: record.code as number, reason: "remote-close", wasClean: record.wasClean };
  }
  if (type === "socket:error" && hasExactKeys(record, ["type", "error", "reason"])
    && (record.error === "Connection interrupted." || record.error === "Socket is not open.") && isLegacySocketReason(record.reason)) {
    return { type, error: record.error, reason: record.reason };
  }
  if (type === "socket:reconcile" && hasExactKeys(record, ["type", "reason"]) && isLegacyReconciliationReason(record.reason)) {
    return { type, reason: record.reason };
  }
  return null;
}

export function parseLegacySocketFrame(data: unknown): LegacySocketFrame | null {
  if (typeof data !== "string" || utf8ByteLength(data) > LEGACY_SOCKET_FRAME_MAX_BYTES) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  const record = exactRecord(parsed, ["type", "payload"]);
  if (!record || !isLegacyFrameType(record.type)) return null;
  const payload = objectRecord(record.payload);
  if (!payload) return null;
  return { type: record.type, payload };
}

export function parseLegacyUploadToken(value: unknown): string | null {
  const response = exactRecord(value, ["token", "success"]);
  if (!response || (response.success !== undefined && response.success !== true)) return null;
  if (typeof response.token !== "string") return null;
  const token = response.token.trim();
  return token.length > 0 && utf8ByteLength(token) <= 1024 ? token : null;
}

export function parseLegacyConfirmedMedia(value: unknown, expectedMimeType: string): LegacyMediaReference | null {
  const response = exactRecord(value, ["success", "media"]);
  if (!response || response.success !== true || !Array.isArray(response.media) || response.media.length !== 1) return null;
  const media = exactRecord(response.media[0], ["url", "mime_type", "mimeType", "media_id", "mediaId", "width", "height"]);
  if (!media) return null;
  if ((media.media_id === undefined) === (media.mediaId === undefined)) return null;
  if ((media.mime_type === undefined) === (media.mimeType === undefined)) return null;
  if (media.url !== undefined && media.url !== null && typeof media.url !== "string") return null;
  const mediaId = positiveInteger(media.media_id ?? media.mediaId);
  const mimeType = nonEmptyString(media.mime_type ?? media.mimeType)?.toLowerCase() ?? null;
  if (mediaId === null || mimeType !== expectedMimeType || !isAllowedLegacyMediaType(mimeType)) return null;
  const rawUrl = nullableString(media.url);
  if (rawUrl !== null && !isRemiliaMediaUrl(rawUrl)) return null;
  const width = nullableDimension(media.width);
  const height = nullableDimension(media.height);
  if (width === undefined || height === undefined) return null;
  return { mediaId, url: rawUrl, mimeType, width, height };
}

export function parseLegacyMediaUploadOutcome(value: unknown): LegacyMediaUploadOutcome | null {
  const record = objectRecord(value);
  if (!record) return null;
  if (record.ok === false && hasExactKeys(record, ["ok", "error", "retryable"])
    && isLegacyAdapterErrorCode(record.error) && typeof record.retryable === "boolean") {
    return { ok: false, error: record.error, retryable: record.retryable };
  }
  if (record.ok !== true || !hasExactKeys(record, ["ok", "media"])) return null;
  const media = exactRecord(record.media, ["mediaId", "url", "mimeType", "width", "height"]);
  if (!media || !hasExactKeys(media, ["mediaId", "url", "mimeType", "width", "height"])) return null;
  const mediaId = positiveInteger(media.mediaId);
  const mimeType = nonEmptyString(media.mimeType)?.toLowerCase() ?? null;
  const url = nullableString(media.url);
  const width = nullableDimension(media.width);
  const height = nullableDimension(media.height);
  if (mediaId === null || !mimeType || !isAllowedLegacyMediaType(mimeType)
    || (url !== null && !isRemiliaMediaUrl(url)) || width === undefined || height === undefined) return null;
  return { ok: true, media: { mediaId, url, mimeType, width, height } };
}

export function publicLegacyFailure(
  error: LegacyAdapterErrorCode,
  retryable: boolean,
): LegacyAdapterFailure {
  return { ok: false, error, retryable };
}

export function isAllowedLegacyMediaType(value: string): boolean {
  return LEGACY_IMAGE_TYPES.has(value) || LEGACY_VIDEO_TYPES.has(value);
}

export function maxLegacyAttachmentBytes(contentType: string): number {
  return LEGACY_VIDEO_TYPES.has(contentType) ? LEGACY_MAX_VIDEO_BYTES : LEGACY_MAX_IMAGE_BYTES;
}

export function estimatedBase64Bytes(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((value.length * 3) / 4) - padding);
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function parseLegacySocketMutation(value: unknown): LegacySocketMutation | null {
  const record = exactRecord(value, ["type", "payload"]);
  if (!record || typeof record.type !== "string") return null;
  const payload = objectRecord(record.payload);
  if (!payload || payload.chat_id !== LEGACY_CHAT_ID) return null;
  if (record.type === "submit") {
    if (!hasExactKeys(payload, ["chat_id", "text", "in_reply_to_id", "media_ids"])) return null;
    if (typeof payload.text !== "string" || utf8ByteLength(payload.text) > LEGACY_CHAT_TEXT_MAX_BYTES) return null;
    if (payload.in_reply_to_id !== undefined && positiveInteger(payload.in_reply_to_id) === null) return null;
    if (!Array.isArray(payload.media_ids) || payload.media_ids.length < 1 || payload.media_ids.length > LEGACY_MAX_MEDIA_IDS) return null;
    const mediaIds = payload.media_ids.map(positiveInteger);
    if (mediaIds.some((id) => id === null) || new Set(mediaIds).size !== mediaIds.length) return null;
    return {
      type: "submit",
      payload: {
        chat_id: LEGACY_CHAT_ID,
        text: payload.text,
        ...(payload.in_reply_to_id === undefined ? {} : { in_reply_to_id: payload.in_reply_to_id as number }),
        media_ids: mediaIds as number[],
      },
    };
  }
  if (record.type === "react" || record.type === "unreact") {
    if (!hasExactKeys(payload, ["chat_id", "message_id", "emoji"])) return null;
    const messageId = positiveInteger(payload.message_id);
    if (messageId === null || typeof payload.emoji !== "string" || payload.emoji.length < 1 || utf8ByteLength(payload.emoji) > 32) return null;
    return { type: record.type, payload: { chat_id: LEGACY_CHAT_ID, message_id: messageId, emoji: payload.emoji } };
  }
  return null;
}

function exactRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | null {
  const record = objectRecord(value);
  if (!record || Object.keys(record).some((key) => !allowedKeys.includes(key))) return null;
  return record;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function hasExactKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(record).every((key) => allowedKeys.includes(key));
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function nullableDimension(value: unknown): number | null | undefined {
  if (value === undefined || value === null) return null;
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000 ? value : undefined;
}

function nullableString(value: unknown): string | null {
  return value === undefined || value === null ? null : nonEmptyString(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isSafeTimestamp(value: unknown): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isSafeInteger(value: unknown, min: number, max: number): boolean {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= min && value <= max;
}

function isLegacyFrameType(value: unknown): value is LegacySocketFrame["type"] {
  return value === "deliver" || value === "message_edit" || value === "reaction" || value === "message_delete" || value === "error";
}

function isLegacySocketReason(value: unknown): value is LegacySocketReason {
  return value === "site-bridge-required" || value === "site-socket-error" || value === "site-socket-not-open"
    || value === "socket-open-timeout" || value === "invalid-client-command" || value === "invalid-bridge-event";
}

function isLegacyReconciliationReason(value: unknown): value is LegacyReconciliationReason {
  return value === "legacy-frame" || value === "legacy-frame-dropped" || value === "legacy-socket-open"
    || value === "legacy-socket-close" || value === "legacy-worker-restart";
}

function isLegacyRequestId(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(value);
}

function isLegacyAdapterErrorCode(value: unknown): value is LegacyAdapterErrorCode {
  return typeof value === "string" && (
    value === "AUTH_REQUIRED"
    || value === "INVALID_ATTACHMENT"
    || value === "UNSUPPORTED_ATTACHMENT_TYPE"
    || value === "ATTACHMENT_TYPE_MISMATCH"
    || value === "ATTACHMENT_TOO_LARGE"
    || value === "LEGACY_ADAPTER_UNAVAILABLE"
    || value === "LEGACY_UPLOAD_TIMEOUT"
    || value === "LEGACY_UPLOAD_REJECTED"
    || value === "LEGACY_UPLOAD_RESPONSE_INVALID"
    || value === "LEGACY_CONFIRM_TIMEOUT"
    || value === "LEGACY_CONFIRM_REJECTED"
    || value === "LEGACY_CONFIRM_RESPONSE_INVALID"
    || value === "LEGACY_MEDIA_SUBMIT_UNAVAILABLE"
    || value === "LEGACY_MEDIA_SUBMIT_REJECTED"
    || value === "INVALID_LEGACY_COMMAND"
    || value === "INVALID_LEGACY_EVENT"
    || value === "LEGACY_FRAME_DROPPED"
  );
}

function encodedByteLength(value: unknown): number {
  try {
    return utf8ByteLength(JSON.stringify(value));
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function maxLegacyDataUrlCharacters(maxBytes: number): number {
  return Math.ceil(maxBytes / 3) * 4 + 128;
}
