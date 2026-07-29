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

// Bearer credentials stay in the background context. When an MV3 worker
// restarts, callers re-adopt the authenticated browser session instead of
// persisting tokens where extension content can read them.
let memoryAccessToken = "";
let memoryRefreshToken = "";
let authGeneration = 0;
let disconnectRequested = false;
let authMutationQueue: Promise<void> = Promise.resolve();

export type RemiliaAuthResult = {
  ok: boolean;
  token?: string;
  method?: "session" | "stored" | "refresh" | "silent-sso";
  user?: unknown;
  error?: string;
};

type RemiliaAuthOptions = {
  ignoreDisconnect?: boolean;
  signal?: AbortSignal;
  generation?: number;
};

export const REMILIA_BASE_URL = BASE_URL;
export const REMILIA_ACCESS_TOKEN_KEY = ACCESS_TOKEN_KEY;
export const REMILIA_REFRESH_TOKEN_KEY = REFRESH_TOKEN_KEY;
export const REMILIA_DISCONNECTED_KEY = DISCONNECTED_KEY;
export const REMILIA_AUTH_COOKIE_NAME = AUTH_COOKIE_NAME;
export const REMILIA_AUTH_COOKIE_TTL_SECONDS = AUTH_COOKIE_TTL_SECONDS;
export const REMILIA_LEGACY_TOKEN_KEYS = [LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY] as const;
export const REMILIA_TOKEN_KEYS = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY] as const;
const REMILIA_ALL_TOKEN_KEYS = [...REMILIA_TOKEN_KEYS, ...REMILIA_LEGACY_TOKEN_KEYS] as const;

async function getStored(keys: string[]): Promise<Record<string, unknown>> {
  return chrome.storage.local.get(keys);
}

async function setStored(values: Record<string, unknown>): Promise<void> {
  await chrome.storage.local.set(values);
}

async function removeStored(keys: readonly string[]): Promise<void> {
  await chrome.storage.local.remove([...keys]);
}

export async function migrateRemiliaAuth(signal?: AbortSignal, generation = authGeneration): Promise<void> {
  throwIfAuthAborted(signal);
  const stored = await getStored([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
  await mutateRemiliaAuth(generation, signal, async () => {
    if (!memoryRefreshToken && typeof stored[REFRESH_TOKEN_KEY] === "string") memoryRefreshToken = stored[REFRESH_TOKEN_KEY];
    if (!memoryRefreshToken && typeof stored[LEGACY_REFRESH_TOKEN_KEY] === "string") memoryRefreshToken = stored[LEGACY_REFRESH_TOKEN_KEY];
    await removeStored(REMILIA_ALL_TOKEN_KEYS);
  });
}

export async function clearRemiliaAuth(): Promise<void> {
  authGeneration += 1;
  disconnectRequested = true;
  await queueAuthMutation(async () => {
    memoryAccessToken = "";
    memoryRefreshToken = "";
    await clearRemiliaAuthCookieRaw();
    await removeStored([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
    await setStored({ [DISCONNECTED_KEY]: true });
  });
}

export async function clearStoredRemiliaAuth(): Promise<void> {
  authGeneration += 1;
  await queueAuthMutation(async () => {
    memoryAccessToken = "";
    memoryRefreshToken = "";
    await removeStored([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, LEGACY_ACCESS_TOKEN_KEY, LEGACY_REFRESH_TOKEN_KEY]);
  });
}

export async function isRemiliaDisconnected(): Promise<boolean> {
  if (disconnectRequested) return true;
  const stored = await getStored([DISCONNECTED_KEY]);
  if (stored[DISCONNECTED_KEY] === true) disconnectRequested = true;
  return disconnectRequested;
}

export async function allowRemiliaSessionAuth(signal?: AbortSignal): Promise<void> {
  const generation = authGeneration;
  await mutateRemiliaAuth(generation, signal, () => allowRemiliaSessionAuthRaw(generation));
}

export async function setRemiliaAuthCookie(accessToken: string, signal?: AbortSignal): Promise<void> {
  const generation = authGeneration;
  await mutateRemiliaAuth(generation, signal, () => setRemiliaAuthCookieRaw(accessToken));
}

async function setRemiliaAuthCookieRaw(accessToken: string): Promise<void> {
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
  await queueAuthMutation(clearRemiliaAuthCookieRaw);
}

async function clearRemiliaAuthCookieRaw(): Promise<void> {
  if (!chrome.cookies?.remove) return;
  await chrome.cookies.remove({ url: BASE_URL, name: AUTH_COOKIE_NAME }).catch(() => undefined);
}

export async function getRemiliaAuthCookie(): Promise<string> {
  if (!chrome.cookies?.get) return "";
  const cookie = await chrome.cookies.get({ url: BASE_URL, name: AUTH_COOKIE_NAME }).catch(() => null);
  return typeof cookie?.value === "string" ? cookie.value : "";
}

export async function refreshRemiliaBrowserSessionTab(
  sessionPath: string,
  options: { timeoutMs?: number } = {},
): Promise<RemiliaAuthResult> {
  if (!chrome.tabs?.create || !chrome.tabs?.remove) return { ok: false, error: "TABS_UNAVAILABLE" };
  if (await isRemiliaDisconnected()) return { ok: false, error: "DISCONNECTED" };

  const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1000, Number(options.timeoutMs)) : 12000;
  let tabId = 0;
  try {
    const tab = await chrome.tabs.create({ url: BASE_URL, active: false });
    tabId = typeof tab.id === "number" ? tab.id : 0;
    if (!tabId) return { ok: false, error: "TAB_CREATE_FAILED" };
    await waitForTabLoad(tabId, timeoutMs);
  } finally {
    if (tabId) await chrome.tabs.remove(tabId).catch(() => undefined);
  }

  return adoptRemiliaBrowserSession(sessionPath);
}

export async function adoptRemiliaBrowserSession(
  sessionPath: string,
  options: RemiliaAuthOptions = {},
): Promise<RemiliaAuthResult> {
  const generation = options.generation ?? authGeneration;
  options = { ...options, generation };
  throwIfAuthAborted(options.signal);
  if (!options.ignoreDisconnect && await isRemiliaDisconnected()) return { ok: false, error: "DISCONNECTED" };
  throwIfAuthAborted(options.signal);

  const session = await remiliaSessionProbe(sessionPath, options.signal);
  if (!session.ok) return { ok: false, error: "NO_BROWSER_SESSION" };

  const cookieToken = await getRemiliaAuthCookie();
  await mutateRemiliaAuth(generation, options.signal, async () => {
    if (cookieToken) {
      memoryAccessToken = cookieToken;
    }
    await allowRemiliaSessionAuthRaw(generation);
  });
  return { ok: true, token: cookieToken, user: session.data, method: cookieToken ? "session" : "session" };
}

export async function prepareRemiliaAuth(sessionPath: string, options: RemiliaAuthOptions = {}): Promise<RemiliaAuthResult> {
  const generation = options.generation ?? authGeneration;
  options = { ...options, generation };
  throwIfAuthAborted(options.signal);
  if (await isRemiliaDisconnected()) return { ok: false, error: "AUTH_REQUIRED" };
  await migrateRemiliaAuth(options.signal, options.generation);

  const adopted = await adoptRemiliaBrowserSession(sessionPath, options);
  if (adopted.ok && adopted.token) return adopted;

  if (memoryAccessToken) {
    await mutateRemiliaAuth(generation, options.signal, () => setRemiliaAuthCookieRaw(memoryAccessToken));
    return { ok: true, token: memoryAccessToken, method: "stored" };
  }

  const renewed = await renewRemiliaAuth(sessionPath, options);
  if (renewed.ok) return renewed;
  return adopted.ok ? adopted : { ok: false, error: "AUTH_REQUIRED" };
}

export async function renewRemiliaAuth(sessionPath: string, options: RemiliaAuthOptions = {}): Promise<RemiliaAuthResult> {
  options = { ...options, generation: options.generation ?? authGeneration };
  throwIfAuthAborted(options.signal);
  if (await isRemiliaDisconnected()) return { ok: false, error: "AUTH_REQUIRED" };
  await migrateRemiliaAuth(options.signal, options.generation);

  if (memoryRefreshToken) {
    const refreshed = await oidcToken({ grant_type: "refresh_token", refresh_token: memoryRefreshToken }, "refresh", options);
    if (refreshed.ok) return refreshed;
    await mutateRemiliaAuth(options.generation ?? authGeneration, options.signal, async () => {
      memoryRefreshToken = "";
    });
  }

  const bootstrapped = await bootstrapRemiliaAuth(options);
  if (bootstrapped.ok) return bootstrapped;

  return adoptRemiliaBrowserSession(sessionPath, options);
}

async function bootstrapRemiliaAuth(options: RemiliaAuthOptions): Promise<RemiliaAuthResult> {
  const { signal } = options;
  throwIfAuthAborted(signal);
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
    signal,
  }).catch(() => null);
  throwIfAuthAborted(signal);
  if (!response) return { ok: false, error: "SILENT_AUTH_FAILED" };

  const location = response.headers.get("location") || response.url;
  const code = extractAuthCode(location, state);
  if (!code) return { ok: false, error: "SILENT_AUTH_NO_CODE" };

  return oidcToken({
    grant_type: "authorization_code",
    code,
    redirect_uri: OIDC_REDIRECT_URI,
    code_verifier: verifier,
  }, "silent-sso", options);
}

async function oidcToken(params: Record<string, string>, method: RemiliaAuthResult["method"], options: RemiliaAuthOptions): Promise<RemiliaAuthResult> {
  const { signal } = options;
  const generation = options.generation ?? authGeneration;
  throwIfAuthAborted(signal);
  const response = await fetch(OIDC_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: OIDC_CLIENT_ID, ...params }),
    signal,
  }).catch(() => null);
  const data = await response?.json().catch(() => ({})) ?? {};
  throwIfAuthAborted(signal);
  if (!response?.ok || typeof data.access_token !== "string") {
    return { ok: false, error: typeof data.error === "string" ? data.error : "TOKEN_EXCHANGE_FAILED" };
  }

  await mutateRemiliaAuth(generation, signal, async () => {
    memoryAccessToken = data.access_token;
    memoryRefreshToken = typeof data.refresh_token === "string" ? data.refresh_token : memoryRefreshToken;
    await setRemiliaAuthCookieRaw(data.access_token);
    await removeStored(REMILIA_ALL_TOKEN_KEYS);
    await allowRemiliaSessionAuthRaw(generation);
  });
  return { ok: true, token: data.access_token, method };
}

async function remiliaSessionProbe(path: string, signal?: AbortSignal): Promise<{ ok: boolean; data?: unknown }> {
  throwIfAuthAborted(signal);
  const response = await fetch(`${BASE_URL}${path}`, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
    signal,
  }).catch(() => null);
  throwIfAuthAborted(signal);
  if (!response?.ok) return { ok: false };
  const data = await response.json().catch(() => null);
  throwIfAuthAborted(signal);
  return { ok: true, data };
}

function throwIfAuthAborted(signal?: AbortSignal): void {
  if (!signal?.aborted) return;
  if (signal.reason instanceof Error) throw signal.reason;
  throw new DOMException("Remilia authentication was cancelled", "AbortError");
}

function throwIfAuthInvalidated(generation: number, signal?: AbortSignal): void {
  throwIfAuthAborted(signal);
  if (generation !== authGeneration) throw new DOMException("Remilia authentication was invalidated", "AbortError");
}

async function mutateRemiliaAuth(generation: number, signal: AbortSignal | undefined, mutation: () => Promise<void>): Promise<void> {
  await queueAuthMutation(async () => {
    throwIfAuthInvalidated(generation, signal);
    await mutation();
  });
}

async function queueAuthMutation(mutation: () => Promise<void>): Promise<void> {
  const pending = authMutationQueue.then(mutation, mutation);
  authMutationQueue = pending.then(() => undefined, () => undefined);
  await pending;
}

async function allowRemiliaSessionAuthRaw(generation: number): Promise<void> {
  await chrome.storage.local.remove([DISCONNECTED_KEY]);
  if (generation === authGeneration) disconnectRequested = false;
}

async function waitForTabLoad(tabId: number, timeoutMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    let done = false;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = () => {
      if (done) return;
      done = true;
      if (settleTimer) clearTimeout(settleTimer);
      clearTimeout(timeoutTimer);
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const settle = () => {
      if (done || settleTimer) return;
      settleTimer = setTimeout(finish, 750);
    };
    const listener = (updatedTabId: number, changeInfo: { status?: string }) => {
      if (updatedTabId === tabId && changeInfo.status === "complete") settle();
    };
    const timeoutTimer = setTimeout(finish, timeoutMs);
    chrome.tabs.onUpdated.addListener(listener);
    chrome.tabs.get(tabId).then((tab) => {
      if (tab.status === "complete") settle();
    }).catch(() => undefined);
  });
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
