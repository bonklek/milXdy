import { registerBackgroundMessageHandlers } from "../../platform/background/router";
import { isRemiliaMediaUrl } from "../../platform/media/remilia-media-allowlist";
import {
  REMILIA_BASE_URL,
  prepareRemiliaAccess,
  refreshRemiliaAccess,
  getRemiliaAuthStatus,
  isRemiliaDisconnected,
  type RemiliaAuthGrant,
} from "../../platform/auth/remilia-auth";
import { resolveSocketAuthCredential } from "./socket-auth-policy";
import {
  isAllowedLegacySender,
  parseLegacyMediaUploadRequest,
  parseLegacySocketBridgeEvent,
  parseLegacySocketClientCommand,
  type LegacySocketBridgeCommand,
  type LegacySocketBridgeEvent,
} from "./legacy-adapters";
import { executeLegacyMediaUpload } from "./legacy-media-upload";

const BASE_URL = REMILIA_BASE_URL;
const CHAT_ID = 1;
const SOCKET_PORT_NAME = "reminetChat:socket";
const SITE_SOCKET_PORT_NAME = "reminetChat:site-socket";
const SOCKET_AUTH_TIMEOUT_MS = 12_000;
const SOCKET_AUTH_CACHE_MS = 45_000;
const MAX_INLINE_MEDIA_BYTES = 8 * 1024 * 1024;

let socketAuthReadyUntil = 0;
let socketAuthPromise: Promise<{ ok: boolean; signedIn: boolean; error?: string }> | null = null;
let socketAuthGeneration = 0;

type ChatMessage =
  | { type: "reminetChat:authStatus" }
  | { type: "reminetChat:getHistory"; limit?: number; before?: number; after?: number }
  | { type: "reminetChat:prepareSocket" }
  | { type: "reminetChat:legacy:uploadAttachment"; mimeType?: string; dataUrl?: string }
  | { type: "reminetChat:fetchMedia"; url?: string };

registerBackgroundMessageHandlers([{
  type: "reminetChat:*",
  matches: isChatMessage,
  handle: handleChatMessage,
}]);

let siteSocketBridge: chrome.runtime.Port | null = null;
const siteSocketBridges = new Set<chrome.runtime.Port>();
const socketClients = new Set<chrome.runtime.Port>();

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === SITE_SOCKET_PORT_NAME) {
    registerSiteSocketBridge(port);
    return;
  }
  if (port.name !== SOCKET_PORT_NAME) return;
  if (!isReminetChatSocketSender(port.sender)) {
    port.disconnect();
    return;
  }
  socketClients.add(port);

  const post = (message: Record<string, unknown>) => {
    try {
      port.postMessage(message);
    } catch {
      // The content side can disappear during navigation or extension reload.
    }
  };

  port.onMessage.addListener((message: unknown) => {
    const command = parseLegacySocketClientCommand(message);
    if (!command) {
      post({ type: "socket:error", error: "Connection interrupted.", reason: "invalid-client-command" });
      post({ type: "socket:reconcile", reason: "legacy-frame-dropped" });
      return;
    }
    if (command.type === "connect") {
      if (!siteSocketBridge) {
        post({
          type: "socket:error",
          error: "Connection interrupted.",
          reason: "site-bridge-required",
        });
        return;
      }
      postToSiteSocketBridge({ type: "connect" });
      return;
    }
    if (command.type === "close") {
      socketClients.delete(port);
      if (socketClients.size === 0) postToSiteSocketBridge({ type: "close" });
      return;
    }
    if (command.type === "mutate") {
      if (!siteSocketBridge) {
        post({ type: "socket:error", error: "Socket is not open.", reason: "site-socket-not-open" });
        return;
      }
      postToSiteSocketBridge(command);
    }
  });
  port.onDisconnect.addListener(() => {
    socketClients.delete(port);
    if (socketClients.size === 0) postToSiteSocketBridge({ type: "close" });
  });
});

function registerSiteSocketBridge(port: chrome.runtime.Port): void {
  if (!isAllowedLegacySender(port.sender, "remilia-bridge")) {
    port.disconnect();
    return;
  }
  siteSocketBridges.add(port);
  if (!siteSocketBridge) siteSocketBridge = port;
  port.onMessage.addListener((message: unknown) => {
    if (siteSocketBridge !== port) return;
    const event = parseLegacySocketBridgeEvent(message);
    if (!event) {
      broadcastSocketEvent({ type: "socket:error", error: "Connection interrupted.", reason: "invalid-bridge-event" });
      broadcastSocketEvent({ type: "socket:reconcile", reason: "legacy-frame-dropped" });
      return;
    }
    broadcastSocketEvent(event);
  });
  port.onDisconnect.addListener(() => {
    siteSocketBridges.delete(port);
    if (siteSocketBridge !== port) return;
    siteSocketBridge = siteSocketBridges.values().next().value ?? null;
    if (siteSocketBridge && socketClients.size > 0) {
      postToSiteSocketBridge({ type: "connect" });
      broadcastSocketEvent({ type: "socket:reconcile", reason: "legacy-worker-restart" });
      return;
    }
    broadcastSocketEvent({
      type: "socket:error",
      error: "Connection interrupted.",
      reason: "site-bridge-required",
    });
    broadcastSocketEvent({ type: "socket:reconcile", reason: "legacy-socket-close" });
  });
  if (socketClients.size > 0) {
    postToSiteSocketBridge({ type: "connect" });
    broadcastSocketEvent({ type: "socket:reconcile", reason: "legacy-worker-restart" });
  }
}

function broadcastSocketEvent(event: LegacySocketBridgeEvent): void {
    for (const client of socketClients) {
      try {
        client.postMessage(event);
      } catch {
        socketClients.delete(client);
      }
    }
}

function postToSiteSocketBridge(message: LegacySocketBridgeCommand): void {
  try {
    siteSocketBridge?.postMessage(message);
  } catch {
    if (siteSocketBridge) siteSocketBridges.delete(siteSocketBridge);
    siteSocketBridge = null;
  }
}

function isReminetChatSocketSender(sender: chrome.runtime.MessageSender | undefined): boolean {
  return isAllowedLegacySender(sender, "x-content");
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
    || type === "reminetChat:legacy:uploadAttachment"
    || type === "reminetChat:fetchMedia";
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
    if (message.type === "reminetChat:legacy:uploadAttachment") {
      if (!isAllowedLegacySender(sender, "x-content")) return { ok: false, error: "UNSUPPORTED_SENDER" };
      const request = parseLegacyMediaUploadRequest(message);
      if (!request) return { ok: false, error: "INVALID_ATTACHMENT", retryable: false };
      return await uploadAttachment(request);
    }
    if (message.type === "reminetChat:fetchMedia") {
      return await fetchMediaDataUrl(message.url);
    }
    return { ok: false, error: "UNSUPPORTED_MESSAGE" };
  } catch {
    return { ok: false, error: "REQUEST_FAILED" };
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

function socketCredential(result: RemiliaAuthGrant): { ok: boolean; token?: string; error?: string } {
  return result.ok
    ? { ok: true, token: result.accessToken }
    : { ok: false, error: result.error };
}

async function refreshAccessToken(): Promise<boolean> {
  const result = await refreshRemiliaAccess(["remilia:chat.read"]);
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
    resolveSocketAuthCredential(
      () => prepareRemiliaAccess(["remilia:chat.read"], { signal: abort.signal }).then(socketCredential),
      () => refreshRemiliaAccess(["remilia:chat.read"], { signal: abort.signal }).then(socketCredential),
    ).then(async (auth) => {
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
  const status = await getRemiliaAuthStatus();
  return { ok: true, signedIn: status.phase === "connected", user: status.identity || null };
}

async function remiliaAuthedFetch(method: string, path: string): Promise<Record<string, unknown>> {
  const prepared = await prepareRemiliaAccess(["remilia:chat.read"]);
  if (!prepared.ok) return { ok: false, authRequired: true, error: prepared.error };
  const result = await remiliaRequest(method, path, null, prepared.accessToken);
  if ((result.status === 401 || result.status === 403) && await refreshAccessToken()) {
    const refreshed = await prepareRemiliaAccess(["remilia:chat.read"]);
    if (refreshed.ok) return remiliaRequest(method, path, null, refreshed.accessToken);
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

async function remiliaRequest(method: string, path: string, body: unknown, accessToken: string): Promise<Record<string, unknown>> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: "omit",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      ...(body == null ? {} : { "Content-Type": "application/json" }),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const text = await response.text().catch(() => "");
  const data = text ? parseJson(text) : null;
  if (!response.ok) return { ok: false, status: response.status, data };
  return { ok: true, status: response.status, data };
}

async function uploadAttachment(request: { mimeType: string; dataUrl: string }): Promise<Record<string, unknown>> {
  const ready = await prepareSocketAuth();
  if (!ready.ok) return { ok: false, authRequired: true, error: "AUTH_REQUIRED", retryable: false };
  return await executeLegacyMediaUpload(request);
}

async function fetchMediaDataUrl(url: unknown): Promise<Record<string, unknown>> {
  if (typeof url !== "string" || !isAllowedMediaUrl(url)) return { ok: false, error: "INVALID_MEDIA_URL" };
  const response = await fetch(url, { credentials: "omit" });
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

function isAllowedMediaUrl(value: string): boolean {
  return isRemiliaMediaUrl(value);
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

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

export {};
