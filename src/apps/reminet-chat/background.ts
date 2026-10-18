import { registerBackgroundMessageHandlers } from "../../platform/background/router";
import { isRemiliaMediaUrl } from "../../platform/media/remilia-media-allowlist";
import {
  getRemiliaAuthStatus,
} from "../../platform/auth/remilia-auth";
import {
  isAllowedLegacySender,
  parseLegacyMediaUploadRequest,
  parseLegacySocketBridgeEvent,
  parseLegacySocketClientCommand,
  type LegacySocketBridgeCommand,
  type LegacySocketBridgeEvent,
} from "./legacy-adapters";

const SOCKET_PORT_NAME = "reminetChat:socket";
const SITE_SOCKET_PORT_NAME = "reminetChat:site-socket";
const MAX_INLINE_MEDIA_BYTES = 8 * 1024 * 1024;

type ChatMessage =
  | { type: "reminetChat:authStatus" }
  | { type: "reminetChat:openLogin" }
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
  if (!sender || sender.id !== chrome.runtime.id) return false;
  return isAllowedLegacySender(sender, "runtime-content");
}

function isReminetChatMessageSender(sender: chrome.runtime.MessageSender | undefined): boolean {
  return isAllowedLegacySender(sender, "x-content");
}

function isChatMessage(message: unknown): message is ChatMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  const keys = Object.keys(record);
  if (record.type === "reminetChat:authStatus" || record.type === "reminetChat:openLogin") return keys.length === 1;
  if (record.type === "reminetChat:legacy:uploadAttachment") {
    return keys.length === 3 && keys.every((key) => key === "type" || key === "mimeType" || key === "dataUrl");
  }
  return record.type === "reminetChat:fetchMedia"
    && keys.length === 2
    && keys.every((key) => key === "type" || key === "url");
}

async function handleChatMessage(message: ChatMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  try {
    if (!isReminetChatMessageSender(sender)) {
      return { ok: false, status: 0, error: "UNSUPPORTED_SENDER" };
    }
    if (message.type === "reminetChat:authStatus") {
      return await authStatus();
    }
    if (message.type === "reminetChat:openLogin") {
      await chrome.storage.session.set({ "milxdy.popup.focusRemiliaLogin": true });
      try {
        await chrome.action.openPopup();
      } catch {
        await chrome.tabs.create({ url: chrome.runtime.getURL("popup.html?focus=remilia-login"), active: true });
      }
      return { ok: true };
    }
    if (message.type === "reminetChat:legacy:uploadAttachment") {
      const request = parseLegacyMediaUploadRequest(message);
      if (!request) return { ok: false, error: "INVALID_ATTACHMENT", retryable: false };
      return { ok: false, error: "MEDIA_UNAVAILABLE", retryable: false, message: "Images and video require the RemiliaNET website; the official Chat API does not support media uploads." };
    }
    if (message.type === "reminetChat:fetchMedia") {
      return await fetchMediaDataUrl(message.url);
    }
    return { ok: false, error: "UNSUPPORTED_MESSAGE" };
  } catch {
    return { ok: false, error: "REQUEST_FAILED" };
  }
}

async function authStatus(): Promise<Record<string, unknown>> {
  const status = await getRemiliaAuthStatus();
  return { ok: true, signedIn: status.phase === "connected", phase: status.phase, user: status.identity || null };
}

async function fetchMediaDataUrl(url: unknown): Promise<Record<string, unknown>> {
  if (typeof url !== "string" || !isAllowedMediaUrl(url)) return { ok: false, error: "INVALID_MEDIA_URL" };
  const response = await fetch(url, { credentials: "omit", redirect: "error", referrerPolicy: "no-referrer" });
  if (!response.ok) return { ok: false, status: response.status };
  if (response.url && !isAllowedMediaUrl(response.url)) return { ok: false, error: "INVALID_MEDIA_URL" };
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

export {};
