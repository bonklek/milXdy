const BASE_URL = "https://www.remilia.net";
const OIDC_AUTH_URL = `${BASE_URL}/oidc/realms/remilia/protocol/openid-connect/auth`;
const OIDC_TOKEN_URL = `${BASE_URL}/oidc/realms/remilia/protocol/openid-connect/token`;
const OIDC_CLIENT_ID = "profile";
const OIDC_REDIRECT_URI = `${BASE_URL}/`;
const OIDC_SCOPE = "openid profile email offline_access";
const AUTH_COOKIE_NAME = "authToken";
const AUTH_COOKIE_TTL_SECONDS = 900;
const ACCESS_TOKEN_KEY = "beetol.accessToken";
const REFRESH_TOKEN_KEY = "beetol.refreshToken";
const DISCONNECTED_KEY = "beetol.disconnected";
const LEGACY_PREFIX = "bex" + "tol";
const LEGACY_ACCESS_TOKEN_KEY = `${LEGACY_PREFIX}.accessToken`;
const LEGACY_REFRESH_TOKEN_KEY = `${LEGACY_PREFIX}.refreshToken`;

let memoryRefreshToken = "";

export type RemiliaAuthResult = {
  ok: boolean;
  token?: string;
  method?: "session" | "stored" | "refresh" | "silent-sso";
  user?: unknown;
  error?: string;
};

export const REMILIA_BASE_URL = BASE_URL;
export const REMILIA_ACCESS_TOKEN_KEY = ACCESS_TOKEN_KEY;
export const REMILIA_REFRESH_TOKEN_KEY = REFRESH_TOKEN_KEY;
export const REMILIA_DISCONNECTED_KEY = DISCONNECTED_KEY;
export const REMILIA_AUTH_COOKIE_NAME = AUTH_COOKIE_NAME;
export const REMILIA_AUTH_COOKIE_TTL_SECONDS = AUTH_COOKIE_TTL_SECONDS;
export const REMILIA_LEGACY_TOKEN_KEYS = [LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY] as const;
export const REMILIA_TOKEN_KEYS = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY] as const;

async function getStored(keys: string[]): Promise<Record<string, unknown>> {
  return chrome.storage.local.get(keys);
}

async function setStored(values: Record<string, unknown>): Promise<void> {
  await chrome.storage.local.set(values);
}

async function removeStored(keys: readonly string[]): Promise<void> {
  await chrome.storage.local.remove([...keys]);
}

export async function migrateRemiliaAuth(): Promise<void> {
  const stored = await getStored([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
  const next: Record<string, unknown> = {};
  if (!stored[ACCESS_TOKEN_KEY] && stored[LEGACY_ACCESS_TOKEN_KEY]) next[ACCESS_TOKEN_KEY] = stored[LEGACY_ACCESS_TOKEN_KEY];
  if (!memoryRefreshToken && typeof stored[REFRESH_TOKEN_KEY] === "string") memoryRefreshToken = stored[REFRESH_TOKEN_KEY];
  if (!memoryRefreshToken && typeof stored[LEGACY_REFRESH_TOKEN_KEY] === "string") memoryRefreshToken = stored[LEGACY_REFRESH_TOKEN_KEY];
  if (Object.keys(next).length) await setStored(next);
  if (stored[REFRESH_TOKEN_KEY] || stored[LEGACY_REFRESH_TOKEN_KEY]) {
    await removeStored([REFRESH_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
  }
}

export async function clearRemiliaAuth(): Promise<void> {
  memoryRefreshToken = "";
  await clearRemiliaAuthCookie();
  await removeStored([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
  await setStored({ [DISCONNECTED_KEY]: true });
}

export async function clearStoredRemiliaAuth(): Promise<void> {
  memoryRefreshToken = "";
  await removeStored([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
}

export async function isRemiliaDisconnected(): Promise<boolean> {
  const stored = await getStored([DISCONNECTED_KEY]);
  return stored[DISCONNECTED_KEY] === true;
}

export async function allowRemiliaSessionAuth(): Promise<void> {
  await chrome.storage.local.remove([DISCONNECTED_KEY]);
}

export async function setRemiliaAuthCookie(accessToken: string): Promise<void> {
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

export async function clearRemiliaAuthCookie(): Promise<void> {
  if (!chrome.cookies?.remove) return;
  await chrome.cookies.remove({ url: BASE_URL, name: AUTH_COOKIE_NAME }).catch(() => undefined);
}

export async function getRemiliaAuthCookie(): Promise<string> {
  if (!chrome.cookies?.get) return "";
  const cookie = await chrome.cookies.get({ url: BASE_URL, name: AUTH_COOKIE_NAME }).catch(() => null);
  return typeof cookie?.value === "string" ? cookie.value : "";
}

export async function adoptRemiliaBrowserSession(
  sessionPath: string,
  options: { ignoreDisconnect?: boolean } = {},
): Promise<RemiliaAuthResult> {
  if (!options.ignoreDisconnect && await isRemiliaDisconnected()) return { ok: false, error: "DISCONNECTED" };

  const session = await remiliaSessionProbe(sessionPath);
  if (!session.ok) return { ok: false, error: "NO_BROWSER_SESSION" };

  const cookieToken = await getRemiliaAuthCookie();
  if (cookieToken) {
    await setStored({ [ACCESS_TOKEN_KEY]: cookieToken });
    await removeStored([REFRESH_TOKEN_KEY]);
  }

  await allowRemiliaSessionAuth();
  return { ok: true, token: cookieToken, user: session.data, method: cookieToken ? "session" : "session" };
}

export async function prepareRemiliaAuth(sessionPath: string): Promise<RemiliaAuthResult> {
  if (await isRemiliaDisconnected()) return { ok: false, error: "AUTH_REQUIRED" };
  await migrateRemiliaAuth();

  const adopted = await adoptRemiliaBrowserSession(sessionPath);
  if (adopted.ok && adopted.token) return adopted;

  const stored = await getStored([ACCESS_TOKEN_KEY]);
  const accessToken = typeof stored[ACCESS_TOKEN_KEY] === "string" ? stored[ACCESS_TOKEN_KEY] : "";
  if (accessToken) {
    await setRemiliaAuthCookie(accessToken);
    return { ok: true, token: accessToken, method: "stored" };
  }

  const renewed = await renewRemiliaAuth(sessionPath);
  if (renewed.ok) return renewed;
  return adopted.ok ? adopted : { ok: false, error: "AUTH_REQUIRED" };
}

export async function renewRemiliaAuth(sessionPath: string): Promise<RemiliaAuthResult> {
  if (await isRemiliaDisconnected()) return { ok: false, error: "AUTH_REQUIRED" };
  await migrateRemiliaAuth();

  if (memoryRefreshToken) {
    const refreshed = await oidcToken({ grant_type: "refresh_token", refresh_token: memoryRefreshToken }, "refresh");
    if (refreshed.ok) return refreshed;
    memoryRefreshToken = "";
  }

  const bootstrapped = await bootstrapRemiliaAuth();
  if (bootstrapped.ok) return bootstrapped;

  return adoptRemiliaBrowserSession(sessionPath);
}

async function bootstrapRemiliaAuth(): Promise<RemiliaAuthResult> {
  const verifier = randomBase64Url(32);
  const challenge = await sha256Base64Url(verifier);
  const state = randomBase64Url(16);
  const authUrl = new URL(OIDC_AUTH_URL);
  authUrl.search = new URLSearchParams({
    client_id: OIDC_CLIENT_ID,
    redirect_uri: OIDC_REDIRECT_URI,
    response_type: "code",
    scope: OIDC_SCOPE,
    prompt: "none",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
  }).toString();

  const response = await fetch(authUrl.toString(), {
    credentials: "include",
    redirect: "manual",
  }).catch(() => null);
  if (!response) return { ok: false, error: "SILENT_AUTH_FAILED" };

  const location = response.headers.get("location") || response.url;
  const code = extractAuthCode(location, state);
  if (!code) return { ok: false, error: "SILENT_AUTH_NO_CODE" };

  return oidcToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: OIDC_REDIRECT_URI,
    code_verifier: verifier,
  }, "silent-sso");
}

async function oidcToken(params: Record<string, string>, method: RemiliaAuthResult["method"]): Promise<RemiliaAuthResult> {
  const response = await fetch(OIDC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: OIDC_CLIENT_ID, ...params }),
  }).catch(() => null);
  const data = await response?.json().catch(() => ({})) ?? {};
  if (!response?.ok || typeof data.access_token !== "string") {
    return { ok: false, error: typeof data.error === "string" ? data.error : "TOKEN_EXCHANGE_FAILED" };
  }

  memoryRefreshToken = typeof data.refresh_token === "string" ? data.refresh_token : memoryRefreshToken;
  await setRemiliaAuthCookie(data.access_token);
  await setStored({ [ACCESS_TOKEN_KEY]: data.access_token });
  await removeStored([REFRESH_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
  await allowRemiliaSessionAuth();
  return { ok: true, token: data.access_token, method };
}

async function remiliaSessionProbe(path: string): Promise<{ ok: boolean; data?: unknown }> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  }).catch(() => null);
  if (!response?.ok) return { ok: false };
  const data = await response.json().catch(() => null);
  return { ok: true, data };
}

function extractAuthCode(location: string, expectedState: string): string {
  try {
    const url = new URL(location, BASE_URL);
    if (url.searchParams.get("state") !== expectedState) return "";
    return url.searchParams.get("code") || "";
  } catch {
    return "";
  }
}

function randomBase64Url(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

async function sha256Base64Url(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return bytesToBase64Url(new Uint8Array(digest));
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
