import { registerBackgroundMessageHandlers } from "../../platform/background/router";
import { isRemiliaMediaUrl } from "../../platform/media/remilia-media-allowlist";
import {
  REMILIA_BASE_URL,
  prepareRemiliaAuth,
  renewRemiliaAuth,
  adoptRemiliaBrowserSession,
  isRemiliaDisconnected,
} from "../../platform/auth/remilia-auth";

const BASE_URL = REMILIA_BASE_URL;
const CHAT_ID = 1;
const SOCKET_URL = "wss://www.remilia.net/api/ws";
const SOCKET_PORT_NAME = "reminetChat:socket";
const SESSION_PROBE_PATH = "/api/profile/whoami";
const SOCKET_HEARTBEAT_MS = 25_000;
const SOCKET_AUTH_TIMEOUT_MS = 12_000;
const SOCKET_OPEN_TIMEOUT_MS = 12_000;
const SOCKET_AUTH_CACHE_MS = 45_000;
const MAX_INLINE_MEDIA_BYTES = 8 * 1024 * 1024;
const MAX_ATTACHMENT_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_ATTACHMENT_VIDEO_BYTES = 32 * 1024 * 1024;
const ALLOWED_ATTACHMENT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);
const ALLOWED_ATTACHMENT_VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

let socketAuthReadyUntil = 0;
let socketAuthPromise: Promise<{ ok: boolean; signedIn: boolean; error?: string }> | null = null;
let socketAuthGeneration = 0;

type DecodedAttachment = {
  contentType: string;
  bytes: Uint8Array<ArrayBuffer>;
  tooLarge?: boolean;
};

type ChatMessage =
  | { type: "reminetChat:authStatus" }
  | { type: "reminetChat:getHistory"; limit?: number; before?: number; after?: number }
  | { type: "reminetChat:prepareSocket" }
  | { type: "reminetChat:uploadAttachment"; name?: string; mimeType?: string; dataUrl?: string }
  | { type: "reminetChat:fetchMedia"; url?: string }
  | { type: "reminetChat:getProfile"; username?: string };

registerBackgroundMessageHandlers([{
  type: "reminetChat:*",
  matches: isChatMessage,
  handle: handleChatMessage,
}]);

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== SOCKET_PORT_NAME) return;
  if (!isReminetChatSocketSender(port.sender)) {
    port.disconnect();
    return;
  }
  let socket: WebSocket | null = null;
  let closed = false;
  let connectGeneration = 0;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const post = (message: Record<string, unknown>) => {
    try {
      port.postMessage(message);
    } catch {
      // The content side can disappear during navigation or extension reload.
    }
  };

  const closeSocket = () => {
    connectGeneration += 1;
    stopHeartbeat();
    const current = socket;
    socket = null;
    if (current && current.readyState !== WebSocket.CLOSED && current.readyState !== WebSocket.CLOSING) {
      current.close();
    }
  };

  const stopHeartbeat = () => {
    if (heartbeatTimer !== null) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  };

  const startHeartbeat = (target: WebSocket) => {
    stopHeartbeat();
    heartbeatTimer = setInterval(() => {
      if (socket !== target || closed) {
        stopHeartbeat();
        return;
      }
      if (target.readyState !== WebSocket.OPEN) {
        post({ type: "socket:heartbeat", ok: false, readyState: target.readyState, reason: "not-open" });
        return;
      }
      post({ type: "socket:heartbeat", ok: true, readyState: target.readyState, at: Date.now() });
    }, SOCKET_HEARTBEAT_MS);
  };

  const connectSocket = async () => {
    if (closed || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    const generation = ++connectGeneration;
    const ready = await prepareSocketAuth();
    if (closed || generation !== connectGeneration) return;
    if (!ready.ok) {
      const authRequired = ready.error === "AUTH_REQUIRED";
      post({
        type: "socket:error",
        error: authRequired ? "AUTH_REQUIRED" : "Live chat authentication timed out.",
        reason: authRequired ? "auth-required" : "socket-auth-timeout",
        authRequired,
      });
      return;
    }
    const nextSocket = new WebSocket(SOCKET_URL);
    socket = nextSocket;
    post({ type: "socket:connecting" });
    const openTimer = setTimeout(() => {
      if (socket !== nextSocket || closed || nextSocket.readyState === WebSocket.OPEN) return;
      post({ type: "socket:error", error: "Live chat connection timed out.", reason: "socket-open-timeout" });
      nextSocket.close();
    }, SOCKET_OPEN_TIMEOUT_MS);
    nextSocket.addEventListener("open", () => {
      clearTimeout(openTimer);
      if (socket !== nextSocket || closed) return;
      nextSocket.send(JSON.stringify({ type: "subscribe", payload: { chat_id: CHAT_ID } }));
      startHeartbeat(nextSocket);
      post({ type: "socket:open", at: Date.now() });
    });
    nextSocket.addEventListener("message", (event) => {
      if (socket !== nextSocket || closed) return;
      post({ type: "socket:frame", data: event.data });
    });
    nextSocket.addEventListener("close", (event) => {
      clearTimeout(openTimer);
      stopHeartbeat();
      if (socket === nextSocket) socket = null;
      post({ type: "socket:close", code: event.code, reason: event.reason, wasClean: event.wasClean });
    });
    nextSocket.addEventListener("error", () => {
      clearTimeout(openTimer);
      post({ type: "socket:error", error: "Connection interrupted.", reason: "socket-error" });
    });
  };

  port.onMessage.addListener((message: unknown) => {
    const record = objectValue(message);
    if (record.type === "connect") {
      void connectSocket();
      return;
    }
    if (record.type === "close") {
      closeSocket();
      return;
    }
    if (record.type === "send") {
      if (!socket || socket.readyState !== WebSocket.OPEN || typeof record.payload !== "object" || record.payload === null) {
        post({ type: "socket:error", error: "Socket is not open." });
        return;
      }
      socket.send(JSON.stringify(record.payload));
    }
  });
  port.onDisconnect.addListener(() => {
    connectGeneration += 1;
    closed = true;
    stopHeartbeat();
    closeSocket();
  });
});

function isReminetChatSocketSender(sender: chrome.runtime.MessageSender | undefined): boolean {
  return isAllowedReminetChatSender(sender, ["x.com", "twitter.com"]);
}

function isReminetChatMessageSender(sender: chrome.runtime.MessageSender | undefined): boolean {
  return isAllowedReminetChatSender(sender, ["x.com", "twitter.com", "www.remilia.net"]);
}

function isAllowedReminetChatSender(sender: chrome.runtime.MessageSender | undefined, allowedHosts: readonly string[]): boolean {
  if (!sender || sender.id !== chrome.runtime.id || typeof sender.tab?.id !== "number") return false;
  if (sender.frameId !== undefined && sender.frameId !== 0) return false;
  const source = sender.url || sender.origin || sender.tab.url || "";
  try {
    const url = new URL(source);
    return url.protocol === "https:" && allowedHosts.includes(url.hostname);
  } catch {
    return false;
  }
}

function isChatMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== "object") return false;
  const type = (message as Record<string, unknown>).type;
  return type === "reminetChat:authStatus"
    || type === "reminetChat:getHistory"
    || type === "reminetChat:prepareSocket"
    || type === "reminetChat:uploadAttachment"
    || type === "reminetChat:fetchMedia"
    || type === "reminetChat:getProfile";
}

async function handleChatMessage(message: ChatMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  try {
    if (!isReminetChatMessageSender(sender)) {
      return { ok: false, status: 0, error: "UNSUPPORTED_SENDER" };
    }
    if (message.type === "reminetChat:authStatus") {
      return await authStatus();
    }
    if (message.type === "reminetChat:prepareSocket") {
      return await prepareSocketAuth();
    }
    if (message.type === "reminetChat:getHistory") {
      const limit = clampNumber(message.limit, 1, 50, 30);
      const params = new URLSearchParams({ limit: String(limit) });
      if (typeof message.before === "number" && Number.isFinite(message.before)) params.set("before", String(message.before));
      if (typeof message.after === "number" && Number.isFinite(message.after)) params.set("after", String(message.after));
      return await remiliaAuthedFetch("GET", `/api/chats/${CHAT_ID}/messages?${params.toString()}`);
    }
    if (message.type === "reminetChat:uploadAttachment") {
      return await uploadAttachment(message.name, message.mimeType, message.dataUrl);
    }
    if (message.type === "reminetChat:fetchMedia") {
      return await fetchMediaDataUrl(message.url);
    }
    return await getProfile(message.username);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(next)));
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

async function refreshAccessToken(): Promise<boolean> {
  const result = await renewRemiliaAuth(SESSION_PROBE_PATH);
  return result.ok;
}

async function prepareSocketAuth(): Promise<{ ok: boolean; signedIn: boolean; error?: string }> {
  if (await isRemiliaDisconnected()) {
    socketAuthReadyUntil = 0;
    socketAuthGeneration += 1;
    socketAuthPromise = null;
    return { ok: false, signedIn: false, error: "AUTH_REQUIRED" };
  }
  if (Date.now() < socketAuthReadyUntil) return { ok: true, signedIn: true };
  if (socketAuthPromise) return socketAuthPromise;
  const generation = ++socketAuthGeneration;
  const abort = new AbortController();
  const pending = withDeadline(
    prepareRemiliaAuth(SESSION_PROBE_PATH, { signal: abort.signal }).then(async (auth) => {
      if (generation !== socketAuthGeneration || await isRemiliaDisconnected()) {
        return { ok: false, signedIn: false, error: "AUTH_REQUIRED" };
      }
      if (!auth.ok) return { ok: false, signedIn: false, error: "AUTH_REQUIRED" };
      socketAuthReadyUntil = Date.now() + SOCKET_AUTH_CACHE_MS;
      return { ok: true, signedIn: true };
    }),
    SOCKET_AUTH_TIMEOUT_MS,
    { ok: false, signedIn: false, error: "AUTH_TIMEOUT" },
    () => {
      abort.abort(new DOMException("Remilia chat authentication timed out", "TimeoutError"));
      if (generation === socketAuthGeneration) socketAuthGeneration += 1;
    },
  );
  socketAuthPromise = pending;
  try {
    return await pending;
  } finally {
    if (socketAuthPromise === pending) socketAuthPromise = null;
  }
}

async function authStatus(): Promise<Record<string, unknown>> {
  const ready = await prepareSocketAuth();
  if (!ready.ok) return { ok: true, signedIn: false };
  const whoami = await remiliaRequest("GET", "/api/profile/whoami", null);
  if (whoami.ok) return { ok: true, signedIn: true, user: whoami.data };
  const adopted = await adoptRemiliaBrowserSession(SESSION_PROBE_PATH);
  return { ok: true, signedIn: adopted.ok, user: adopted.ok ? adopted.user ?? null : null };
}

async function remiliaAuthedFetch(method: string, path: string): Promise<Record<string, unknown>> {
  const ready = await prepareSocketAuth();
  if (!ready.ok) return { ok: false, authRequired: true };
  const result = await remiliaRequest(method, path, null);
  if ((result.status === 401 || result.status === 403) && await refreshAccessToken()) {
    socketAuthReadyUntil = 0;
    await prepareSocketAuth();
    return remiliaRequest(method, path, null);
  }
  if (result.status === 401 || result.status === 403) {
    socketAuthReadyUntil = 0;
    const adopted = await adoptRemiliaBrowserSession(SESSION_PROBE_PATH);
    if (adopted.ok) return remiliaRequest(method, path, null);
  }
  return result;
}

async function withDeadline<T>(promise: Promise<T>, timeoutMs: number, fallback: T, onTimeout?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => {
          onTimeout?.();
          resolve(fallback);
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

async function remiliaRequest(method: string, path: string, body: unknown): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: {
      Accept: "application/json",
      ...(body == null ? {} : { "Content-Type": "application/json" }),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text().catch(() => "");
  const data = text ? parseJson(text) : null;
  if (!response.ok) return { ok: false, status: response.status, data };
  return { ok: true, status: response.status, data };
}

async function uploadAttachment(name: unknown, mimeType: unknown, dataUrl: unknown): Promise<Record<string, unknown>> {
  const ready = await prepareSocketAuth();
  if (!ready.ok) return { ok: false, authRequired: true };
  if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) return { ok: false, error: "INVALID_ATTACHMENT" };

  const declaredMimeType = typeof mimeType === "string" ? mimeType.toLowerCase() : "";
  if (!isAllowedAttachmentMimeType(declaredMimeType)) return { ok: false, error: "UNSUPPORTED_ATTACHMENT_TYPE" };
  const decoded = decodeAttachmentDataUrl(dataUrl);
  if (!decoded) return { ok: false, error: "INVALID_ATTACHMENT" };
  if (decoded.contentType !== declaredMimeType) return { ok: false, error: "ATTACHMENT_TYPE_MISMATCH" };
  const maxBytes = maxAttachmentBytes(decoded.contentType);
  if (decoded.tooLarge || decoded.bytes.byteLength > maxBytes) return { ok: false, error: "ATTACHMENT_TOO_LARGE" };

  const blob = new Blob([decoded.bytes], { type: decoded.contentType });
  const file = new File([blob], typeof name === "string" && name ? name : "attachment", {
    type: decoded.contentType,
  });
  const form = new FormData();
  form.append("file", file);

  const uploaded = await remiliaMultipart("/media/upload/", form);
  if (!uploaded.ok) return uploaded;
  const token = stringFrom(uploaded.data, "token");
  if (!token) return { ok: false, error: "UPLOAD_TOKEN_MISSING", data: uploaded.data };

  const confirmed = await remiliaRequest("POST", "/media/upload/confirm", { tokens: [token] });
  if (!confirmed.ok) return confirmed;
  const data = confirmed.data && typeof confirmed.data === "object" ? confirmed.data as Record<string, unknown> : {};
  return {
    ok: true,
    media: {
      url: firstArrayString(data.urls),
      mimeType: firstArrayString(data.mime_types),
      mediaId: firstArrayNumber(data.media_ids),
      width: firstArrayNumber(data.widths),
      height: firstArrayNumber(data.heights),
    },
  };
}

function decodeAttachmentDataUrl(dataUrl: string): DecodedAttachment | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\s]+)$/u.exec(dataUrl);
  if (!match) return null;
  const contentType = match[1].toLowerCase();
  if (!isAllowedAttachmentMimeType(contentType)) return null;
  const base64 = match[2].replace(/\s+/g, "");
  const maxBytes = maxAttachmentBytes(contentType);
  if (estimatedBase64Bytes(base64) > maxBytes) return { contentType, bytes: new Uint8Array(new ArrayBuffer(0)), tooLarge: true };
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return { contentType, bytes };
  } catch {
    return null;
  }
}

function isAllowedAttachmentMimeType(value: string): boolean {
  return ALLOWED_ATTACHMENT_IMAGE_TYPES.has(value) || ALLOWED_ATTACHMENT_VIDEO_TYPES.has(value);
}

function maxAttachmentBytes(contentType: string): number {
  return ALLOWED_ATTACHMENT_VIDEO_TYPES.has(contentType) ? MAX_ATTACHMENT_VIDEO_BYTES : MAX_ATTACHMENT_IMAGE_BYTES;
}

function estimatedBase64Bytes(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

async function remiliaMultipart(path: string, body: FormData): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    headers: { Accept: "application/json" },
    body,
  });
  const text = await response.text().catch(() => "");
  const data = text ? parseJson(text) : null;
  if (!response.ok) return { ok: false, status: response.status, data };
  return { ok: true, status: response.status, data };
}

async function fetchMediaDataUrl(url: unknown): Promise<Record<string, unknown>> {
  if (typeof url !== "string" || !isAllowedMediaUrl(url)) return { ok: false, error: "INVALID_MEDIA_URL" };
  const response = await fetch(url, { credentials: shouldSendRemiliaMediaCredentials(url) ? "include" : "omit" });
  if (!response.ok) return { ok: false, status: response.status };
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) return { ok: false, error: "UNSUPPORTED_MEDIA_TYPE", contentType };
  const contentLength = Number(response.headers.get("content-length") || "");
  if (Number.isFinite(contentLength) && contentLength > MAX_INLINE_MEDIA_BYTES) return { ok: false, error: "MEDIA_TOO_LARGE" };
  const blob = await readCappedResponseBlob(response, MAX_INLINE_MEDIA_BYTES, contentType);
  if (!blob) return { ok: false, error: "MEDIA_TOO_LARGE" };
  const dataUrl = await blobToDataUrl(blob, contentType);
  return { ok: true, dataUrl, contentType };
}

async function readCappedResponseBlob(response: Response, maxBytes: number, contentType: string): Promise<Blob | null> {
  if (!response.body) {
    const blob = await response.blob();
    return blob.size <= maxBytes ? blob : null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("Media exceeds inline limit");
        return null;
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  return new Blob(chunks, { type: contentType });
}

async function getProfile(username: unknown): Promise<Record<string, unknown>> {
  if (typeof username !== "string" || !username) return { ok: false, error: "INVALID_USERNAME" };
  const clean = username.replace(/^~/, "").replace(/^@/, "");
  return remiliaAuthedFetch("GET", `/api/profile/~${encodeURIComponent(clean)}`);
}

function isAllowedMediaUrl(value: string): boolean {
  return isRemiliaMediaUrl(value);
}

function shouldSendRemiliaMediaCredentials(value: string): boolean {
  try {
    return new URL(value).hostname.toLowerCase() === "www.remilia.net";
  } catch {
    return false;
  }
}

async function blobToDataUrl(blob: Blob, contentType: string): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return `data:${contentType};base64,${btoa(binary)}`;
}

function stringFrom(value: unknown, key: string): string {
  if (!value || typeof value !== "object") return "";
  const candidate = (value as Record<string, unknown>)[key];
  return typeof candidate === "string" ? candidate : "";
}

function firstArrayString(value: unknown): string | null {
  return Array.isArray(value) && typeof value[0] === "string" ? value[0] : null;
}

function firstArrayNumber(value: unknown): number | null {
  const numeric = Array.isArray(value) ? Number(value[0]) : NaN;
  return Number.isFinite(numeric) ? numeric : null;
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export {};
