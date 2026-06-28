import { registerBackgroundMessageHandlers } from "../../shared/backgroundRouter";
import { isAllowedUrl, type UrlAllowRule } from "../../shared/urlAllowlist";
import {
  REMILIA_BASE_URL,
  prepareRemiliaAuth,
  renewRemiliaAuth,
  setRemiliaAuthCookie,
  adoptRemiliaBrowserSession,
} from "../../shared/remiliaAuth";

const BASE_URL = REMILIA_BASE_URL;
const CHAT_ID = 1;
const SOCKET_URL = "wss://www.remilia.net/api/ws";
const SOCKET_PORT_NAME = "reminetChat:socket";
const SESSION_PROBE_PATH = "/api/profile/whoami";
const REMILIA_MEDIA_RULES: readonly UrlAllowRule[] = [
  { protocol: "https:", hostname: "www.remilia.net", includeSubdomains: true },
];

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
  let socket: WebSocket | null = null;
  let closed = false;

  const post = (message: Record<string, unknown>) => {
    try {
      port.postMessage(message);
    } catch {
      // The content side can disappear during navigation or extension reload.
    }
  };

  const closeSocket = () => {
    const current = socket;
    socket = null;
    if (current && current.readyState !== WebSocket.CLOSED && current.readyState !== WebSocket.CLOSING) {
      current.close();
    }
  };

  const connectSocket = async () => {
    if (closed || socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) return;
    const ready = await prepareSocketAuth();
    if (!ready.ok) {
      post({ type: "socket:error", error: ready.error || "AUTH_REQUIRED", authRequired: true });
      return;
    }
    const nextSocket = new WebSocket(SOCKET_URL);
    socket = nextSocket;
    post({ type: "socket:connecting" });
    nextSocket.addEventListener("open", () => {
      if (socket !== nextSocket || closed) return;
      nextSocket.send(JSON.stringify({ type: "subscribe", payload: { chat_id: CHAT_ID } }));
      post({ type: "socket:open" });
    });
    nextSocket.addEventListener("message", (event) => {
      if (socket !== nextSocket || closed) return;
      post({ type: "socket:frame", data: event.data });
    });
    nextSocket.addEventListener("close", () => {
      if (socket === nextSocket) socket = null;
      post({ type: "socket:close" });
    });
    nextSocket.addEventListener("error", () => {
      post({ type: "socket:error", error: "Connection interrupted." });
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
    closed = true;
    closeSocket();
  });
});

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

async function handleChatMessage(message: ChatMessage): Promise<Record<string, unknown>> {
  try {
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
  const auth = await prepareRemiliaAuth(SESSION_PROBE_PATH);
  if (!auth.ok) return { ok: false, signedIn: false, error: "AUTH_REQUIRED" };
  if (auth.token) await setRemiliaAuthCookie(auth.token);
  return { ok: true, signedIn: true };
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
    await prepareSocketAuth();
    return remiliaRequest(method, path, null);
  }
  if (result.status === 401 || result.status === 403) {
    const adopted = await adoptRemiliaBrowserSession(SESSION_PROBE_PATH);
    if (adopted.ok) return remiliaRequest(method, path, null);
  }
  return result;
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

  const blob = await fetch(dataUrl).then((response) => response.blob());
  const file = new File([blob], typeof name === "string" && name ? name : "attachment", {
    type: typeof mimeType === "string" && mimeType ? mimeType : blob.type,
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
  const response = await fetch(url, { credentials: "include" });
  if (!response.ok) return { ok: false, status: response.status };
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  if (!contentType.startsWith("image/") && !contentType.startsWith("video/")) return { ok: false, error: "UNSUPPORTED_MEDIA_TYPE", contentType };
  const dataUrl = await blobToDataUrl(await response.blob(), contentType);
  return { ok: true, dataUrl, contentType };
}

async function getProfile(username: unknown): Promise<Record<string, unknown>> {
  if (typeof username !== "string" || !username) return { ok: false, error: "INVALID_USERNAME" };
  const clean = username.replace(/^~/, "").replace(/^@/, "");
  return remiliaAuthedFetch("GET", `/api/profile/~${encodeURIComponent(clean)}`);
}

function isAllowedMediaUrl(value: string): boolean {
  return isAllowedUrl(value, REMILIA_MEDIA_RULES);
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
