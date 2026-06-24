const BASE_URL = "https://www.remilia.net";
const CHAT_ID = 1;
const AUTH_COOKIE_NAME = "authToken";
const AUTH_COOKIE_TTL_SECONDS = 900;
const ACCESS_TOKEN_KEY = "beetol.accessToken";
const REFRESH_TOKEN_KEY = "beetol.refreshToken";
const LEGACY_PREFIX = "bex" + "tol";
const OIDC_URL = `${BASE_URL}/oidc/realms/remilia/protocol/openid-connect/token`;

type ChatMessage =
  | { type: "reminetChat:authStatus" }
  | { type: "reminetChat:getHistory"; limit?: number; before?: number; after?: number }
  | { type: "reminetChat:prepareSocket" }
  | { type: "reminetChat:uploadAttachment"; name?: string; mimeType?: string; dataUrl?: string }
  | { type: "reminetChat:fetchMedia"; url?: string }
  | { type: "reminetChat:getProfile"; username?: string };

chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
  if (!isChatMessage(message)) return false;

  (async () => {
    try {
      if (message.type === "reminetChat:authStatus") {
        sendResponse(await authStatus());
        return;
      }
      if (message.type === "reminetChat:prepareSocket") {
        const ready = await prepareSocketAuth();
        sendResponse(ready);
        return;
      }
      if (message.type === "reminetChat:getHistory") {
        const limit = clampNumber(message.limit, 1, 50, 30);
        const params = new URLSearchParams({ limit: String(limit) });
        if (typeof message.before === "number" && Number.isFinite(message.before)) params.set("before", String(message.before));
        if (typeof message.after === "number" && Number.isFinite(message.after)) params.set("after", String(message.after));
        sendResponse(await remiliaAuthedFetch("GET", `/api/chats/${CHAT_ID}/messages?${params.toString()}`));
        return;
      }
      if (message.type === "reminetChat:uploadAttachment") {
        sendResponse(await uploadAttachment(message.name, message.mimeType, message.dataUrl));
        return;
      }
      if (message.type === "reminetChat:fetchMedia") {
        sendResponse(await fetchMediaDataUrl(message.url));
        return;
      }
      if (message.type === "reminetChat:getProfile") {
        sendResponse(await getProfile(message.username));
      }
    } catch (error) {
      sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
    }
  })();

  return true;
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

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(next)));
}

async function getStored(keys: string[]): Promise<Record<string, unknown>> {
  return chrome.storage.local.get(keys);
}

async function setStored(values: Record<string, unknown>): Promise<void> {
  await chrome.storage.local.set(values);
}

async function migrateAuth(): Promise<void> {
  const legacyAccessKey = `${LEGACY_PREFIX}.accessToken`;
  const legacyRefreshKey = `${LEGACY_PREFIX}.refreshToken`;
  const stored = await getStored([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, legacyAccessKey, legacyRefreshKey]);
  const next: Record<string, unknown> = {};
  if (!stored[ACCESS_TOKEN_KEY] && stored[legacyAccessKey]) next[ACCESS_TOKEN_KEY] = stored[legacyAccessKey];
  if (!stored[REFRESH_TOKEN_KEY] && stored[legacyRefreshKey]) next[REFRESH_TOKEN_KEY] = stored[legacyRefreshKey];
  if (Object.keys(next).length) await setStored(next);
}

async function setAuthCookie(accessToken: string): Promise<void> {
  if (!accessToken || !chrome.cookies?.set) return;
  await chrome.cookies.set({
    url: BASE_URL,
    name: AUTH_COOKIE_NAME,
    value: accessToken,
    path: "/",
    secure: true,
    sameSite: "no_restriction",
    expirationDate: Math.floor(Date.now() / 1000) + AUTH_COOKIE_TTL_SECONDS,
  });
}

async function oidc(params: Record<string, string>): Promise<{ ok: boolean }> {
  const response = await fetch(OIDC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: "profile", ...params }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) return { ok: false };
  await setAuthCookie(data.access_token);
  await setStored({
    [ACCESS_TOKEN_KEY]: data.access_token,
    [REFRESH_TOKEN_KEY]: data.refresh_token || null,
  });
  return { ok: true };
}

async function refreshAccessToken(): Promise<boolean> {
  await migrateAuth();
  const stored = await getStored([REFRESH_TOKEN_KEY]);
  const refreshToken = typeof stored[REFRESH_TOKEN_KEY] === "string" ? stored[REFRESH_TOKEN_KEY] : "";
  if (!refreshToken) return false;
  const result = await oidc({ grant_type: "refresh_token", refresh_token: refreshToken });
  return result.ok;
}

async function prepareSocketAuth(): Promise<{ ok: boolean; signedIn: boolean; error?: string }> {
  await migrateAuth();
  const stored = await getStored([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  let accessToken = typeof stored[ACCESS_TOKEN_KEY] === "string" ? stored[ACCESS_TOKEN_KEY] : "";
  if (!accessToken && stored[REFRESH_TOKEN_KEY] && await refreshAccessToken()) {
    const refreshed = await getStored([ACCESS_TOKEN_KEY]);
    accessToken = typeof refreshed[ACCESS_TOKEN_KEY] === "string" ? refreshed[ACCESS_TOKEN_KEY] : "";
  }
  if (!accessToken) return { ok: false, signedIn: false, error: "AUTH_REQUIRED" };
  await setAuthCookie(accessToken);
  return { ok: true, signedIn: true };
}

async function authStatus(): Promise<Record<string, unknown>> {
  const ready = await prepareSocketAuth();
  if (!ready.ok) return { ok: true, signedIn: false };
  const whoami = await remiliaRequest("GET", "/api/profile/whoami", null);
  return { ok: true, signedIn: whoami.ok, user: whoami.ok ? whoami.data : null };
}

async function remiliaAuthedFetch(method: string, path: string): Promise<Record<string, unknown>> {
  const ready = await prepareSocketAuth();
  if (!ready.ok) return { ok: false, authRequired: true };
  const result = await remiliaRequest(method, path, null);
  if ((result.status === 401 || result.status === 403) && await refreshAccessToken()) {
    await prepareSocketAuth();
    return remiliaRequest(method, path, null);
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
  if (!contentType.startsWith("image/")) return { ok: false, error: "UNSUPPORTED_MEDIA_TYPE", contentType };
  const dataUrl = await blobToDataUrl(await response.blob(), contentType);
  return { ok: true, dataUrl, contentType };
}

async function getProfile(username: unknown): Promise<Record<string, unknown>> {
  if (typeof username !== "string" || !username) return { ok: false, error: "INVALID_USERNAME" };
  const clean = username.replace(/^~/, "").replace(/^@/, "");
  return remiliaAuthedFetch("GET", `/api/profile/~${encodeURIComponent(clean)}`);
}

function isAllowedMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === "www.remilia.net" || url.hostname.endsWith(".remilia.net"));
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
