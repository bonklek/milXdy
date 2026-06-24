const BASE_URL = 'https://www.remilia.net';
const OIDC_URL = `${BASE_URL}/oidc/realms/remilia/protocol/openid-connect/token`;
const AUTH_COOKIE_NAME = 'authToken';
const AUTH_COOKIE_TTL_SECONDS = 900;
const POKE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const INCOMING_POKE_WINDOW_MS = POKE_COOLDOWN_MS;
const INCOMING_POKE_CACHE_MS = 2 * 60 * 1000;
const POKE_ELIGIBILITY_CACHE_MS = 60 * 1000;
const ACCESS_TOKEN_KEY = 'beetol.accessToken';
const REFRESH_TOKEN_KEY = 'beetol.refreshToken';
const LAST_POKE_DIAGNOSTIC_KEY = 'milxdy.remistats.lastPokeDiagnostic';
const INCOMING_POKE_CACHE_KEY = 'milxdy.remistats.incomingPokeCache';
const TOKEN_KEYS = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY];
const LEGACY_PREFIX = 'bex' + 'tol';
const ACTIONS = new Set(['catchBeetle', 'beetleHunt', 'claimUBC', 'junkFaucet']);
const MESSAGE_TYPES = new Set([
  'beetol:login',
  'beetol:logout',
  'beetol:authStatus',
  'beetol:sessionStatus',
  'beetol:getState',
  'beetol:action',
  'beetol:crunchJunk',
  'beetol:poke',
  'beetol:pokeEligibility',
  'beetol:incomingPokes',
]);
const pokeEligibilityCache = new Map();
const KNOWN_ITEM_KEYS = new Set([
  'green', 'purple', 'ladybug', 'cucumber', 'monarch', 'pond', 'giraffe_weevil', 'pillbug',
  'imperial_tortoise', 'christmas', 'skull', 'bumblebee', 'golden_tiger', 'blue_longicorn',
  'goliath', 'bombardier', 'death_feigning', 'pondhawk', 'stag', 'sabertooth_longhorn',
  'sunset_moth', 'golden', 'widow', 'candycane_tiger_moth', 'mars_rhino', 'radbro',
  'daisy', 'sunflower', 'poppy', 'petunia', 'snapdragon', 'carnation', 'gallic_rose',
  'st_johns_wort', 'milk_thistle', 'marigold', 'magnolia', 'royal_poinciana', 'larkspur',
  'morning_glory', 'camellia', 'fringed_iris', 'pincushion', 'gazania', 'hellebore',
  'passionflower', 'black_lotus', 'pollen_common', 'pollen_uncommon', 'pollen_rare',
  'pollen_super_rare', 'junk_cube_t1', 'junk_cube_t2', 'nectar', 'cattail', 'pinecone',
  'moss', 'gunpowder', 'chinese_coin', 'prism', 'roman_dodeca', 'arrowhead', 'titanium_cube',
  'oriental_fan', 'mokia', 'thumb_drive', 'jade_cabbage', 'juex_card', 'cult_medallion',
  'd20', 'deck_of_cards', 'compass', 'stradivarius', 'engraved_lighter', 'joystick',
  'goya_miniature', 'police_badge', 'milady_fumoku', 'remilianet_id', 'hammer_t1',
  'hammer_t2', 'hammer_t3', 'hammer_t4', 'hammer_t5', 'beetleboy_key', 'specimen_pin',
  'trophy_chinese_coin', 'trophy_prism', 'trophy_roman_dodeca', 'trophy_arrowhead',
  'trophy_titanium_cube', 'trophy_oriental_fan', 'trophy_jade_cabbage', 'trophy_thumb_drive',
  'trophy_mokia', 'trophy_compass', 'trophy_juex_card', 'trophy_cult_medallion',
  'trophy_stradivarius', 'trophy_police_badge', 'trophy_goya_miniature', 'trophy_milady_fumoku',
  'trophy_remilianet_id', 'trophy_deck_of_cards', 'trophy_d20', 'trophy_engraved_lighter',
  'trophy_joystick',
]);

async function getStored(keys) {
  return chrome.storage.local.get(keys);
}

async function setStored(values) {
  return chrome.storage.local.set(values);
}

async function migrateAuth() {
  const legacyAccessKey = `${LEGACY_PREFIX}.accessToken`;
  const legacyRefreshKey = `${LEGACY_PREFIX}.refreshToken`;
  const stored = await getStored([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, legacyAccessKey, legacyRefreshKey]);
  const next = {};
  if (!stored[ACCESS_TOKEN_KEY] && stored[legacyAccessKey]) next[ACCESS_TOKEN_KEY] = stored[legacyAccessKey];
  if (!stored[REFRESH_TOKEN_KEY] && stored[legacyRefreshKey]) next[REFRESH_TOKEN_KEY] = stored[legacyRefreshKey];
  if (Object.keys(next).length) await setStored(next);
}

async function clearAuth() {
  await clearAuthCookie();
  return chrome.storage.local.remove(TOKEN_KEYS);
}

async function clearStoredAuth() {
  return chrome.storage.local.remove(TOKEN_KEYS);
}

async function setAuthCookie(accessToken) {
  if (!accessToken || !chrome.cookies?.set) return;
  try {
    await chrome.cookies.set({
      url: BASE_URL,
      name: AUTH_COOKIE_NAME,
      value: accessToken,
      path: '/',
      secure: true,
      sameSite: 'no_restriction',
      expirationDate: Math.floor(Date.now() / 1000) + AUTH_COOKIE_TTL_SECONDS,
    });
  } catch (error) {
    console.warn('Failed to set RemiliaNET auth cookie', error);
  }
}

async function clearAuthCookie() {
  if (!chrome.cookies?.remove) return;
  try {
    await chrome.cookies.remove({ url: BASE_URL, name: AUTH_COOKIE_NAME });
  } catch (error) {
    console.warn('Failed to clear RemiliaNET auth cookie', error);
  }
}

async function getAuthCookie() {
  if (!chrome.cookies?.get) return '';
  try {
    const cookie = await chrome.cookies.get({ url: BASE_URL, name: AUTH_COOKIE_NAME });
    return typeof cookie?.value === 'string' ? cookie.value : '';
  } catch (error) {
    console.warn('Failed to read RemiliaNET auth cookie', error);
    return '';
  }
}

async function adoptBrowserSession() {
  const session = await remiliaSessionFetch('GET', '/api/beetle/user');
  if (!session.ok) return { ok: false, session };

  const cookieToken = await getAuthCookie();
  if (cookieToken) {
    await setStored({
      [ACCESS_TOKEN_KEY]: cookieToken,
      [REFRESH_TOKEN_KEY]: null,
    });
  }

  return { ok: true, token: cookieToken, session };
}

async function oidc(params) {
  const response = await fetch(OIDC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: 'profile', ...params }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: data.error || `HTTP ${response.status}`,
      description: data.error_description || '',
    };
  }
  if (!data.access_token) return { ok: false, error: 'NO_ACCESS_TOKEN' };
  await setAuthCookie(data.access_token);
  await setStored({
    [ACCESS_TOKEN_KEY]: data.access_token,
    [REFRESH_TOKEN_KEY]: data.refresh_token || null,
  });
  return { ok: true };
}

async function refreshAccessToken() {
  await migrateAuth();
  const stored = await getStored([REFRESH_TOKEN_KEY]);
  const refreshToken = stored[REFRESH_TOKEN_KEY];
  if (!refreshToken) return false;
  const result = await oidc({ grant_type: 'refresh_token', refresh_token: refreshToken });
  return result.ok;
}

async function remiliaFetch(method, path, body, retry = true) {
  await migrateAuth();
  const stored = await getStored([ACCESS_TOKEN_KEY]);
  const adopted = await adoptBrowserSession();
  const accessToken = adopted.token || stored[ACCESS_TOKEN_KEY];
  if (!accessToken) return { ok: false, authRequired: true };
  await setAuthCookie(accessToken);

  const result = await remiliaRequest(method, path, body, {
    credentials: 'include',
    authMethod: 'cookie',
  });

  if ((result.status === 401 || result.status === 403) && retry) {
    if (await refreshAccessToken()) return remiliaFetch(method, path, body, false);
    await clearStoredAuth();
    return { ok: false, authRequired: true, status: result.status, data: result.data, authMethod: result.authMethod };
  }

  return result;
}

async function remiliaRequest(method, path, body, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(body == null ? {} : { 'Content-Type': 'application/json' }),
    ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
  };
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: options.credentials || 'omit',
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });

  const data = await readResponseBody(response);
  if (!response.ok) {
    return { ok: false, status: response.status, data, authMethod: options.authMethod };
  }
  return { ok: true, status: response.status, data, authMethod: options.authMethod };
}

async function readResponseBody(response) {
  const text = await response.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { message: text };
  }
}

async function remiliaSessionFetch(method, path, body) {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(body == null ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }
  return { ok: true, data, session: true };
}

async function remiliaAuthedFetch(method, path, body, retry = true) {
  const tokenResult = await remiliaFetch(method, path, body, retry);
  if (tokenResult.ok) return tokenResult;
  if (!tokenResult.authRequired) {
    const sessionResult = await remiliaSessionFetch(method, path, body);
    return sessionResult.ok ? sessionResult : tokenResult;
  }
  return remiliaSessionFetch(method, path, body);
}

async function getState() {
  const result = await remiliaAuthedFetch('GET', '/api/beetle/user');
  if (!result.ok) return result;
  await setStored({ lastUser: result.data, lastFetchedAt: Date.now() });
  return {
    ok: true,
    user: result.data,
    fetchedAt: Date.now(),
  };
}

async function runAction(action) {
  if (!ACTIONS.has(action)) return { ok: false, error: 'UNKNOWN_ACTION' };
  const before = await remiliaAuthedFetch('GET', '/api/beetle/user');
  const inventoryBefore = before.ok ? before.data?.inventory || {} : {};
  const result = await remiliaAuthedFetch('POST', `/api/beetle/action/${action}`, {});

  if (!result.ok) return result;
  const cooldownMs = extractCooldownMs(result.data);
  if (result.data?.success === false) return { ok: true, actionResult: result.data, cooldownMs };

  const after = await getState();
  const inventoryAfter = after.ok ? after.user?.inventory || {} : {};
  const gained = Object.entries(inventoryAfter)
    .map(([key, qty]) => [key, qty - (inventoryBefore[key] || 0)])
    .filter(([, diff]) => diff > 0)
    .map(([key, diff]) => ({ key, diff }));

  return {
    ok: true,
    actionResult: result.data,
    cooldownMs,
    user: after.ok ? after.user : null,
    fetchedAt: after.ok ? after.fetchedAt : Date.now(),
    gained,
  };
}

function junkPool(inventory) {
  const pool = [];
  for (const [key, qty] of Object.entries(inventory || {})) {
    if (KNOWN_ITEM_KEYS.has(key) || key === 'cheese' || key.endsWith('_shelf')) continue;
    const count = Number(qty);
    if (Number.isFinite(count) && count > 0) pool.push(...Array(Math.floor(count)).fill(key));
  }
  return pool;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function crunchJunk() {
  const before = await remiliaFetch('GET', '/api/beetle/user');
  if (!before.ok) return before;

  const pool = junkPool(before.data?.inventory);
  if (pool.length < 2) {
    return { ok: false, error: 'Not enough loose junk.' };
  }

  const pairs = Math.floor(pool.length / 2);
  let made = 0;
  let skipped = 0;

  for (let i = 0; i < pairs * 2; i += 2) {
    const result = await remiliaFetch('POST', '/api/beetle/action/craft', {
      type: 1,
      slot1: pool[i],
      slot2: pool[i + 1],
    });
    if (!result.ok) return { ...result, made, skipped, pairs };
    if (result.data?.success !== false) made += 1;
    else if (result.data?.message === 'INVALID_RECIPE') skipped += 1;
    else return { ok: false, error: result.data?.message || 'Failed mid-crunch.', made, skipped, pairs };
    await sleep(200);
  }

  const after = await getState();
  return {
    ok: true,
    made,
    skipped,
    pairs,
    user: after.ok ? after.user : null,
    fetchedAt: after.ok ? after.fetchedAt : Date.now(),
  };
}

async function pokeUser(username) {
  const cleanUsername = normalizeUsername(username);
  if (!cleanUsername) return { ok: false, error: 'MISSING_USERNAME' };
  const result = await remiliaPokeFetch(cleanUsername);
  if (!result.ok) return result;

  const data = result.data || {};
  const responseCooldownMs = extractCooldownMs(data);
  if (data.success === false || data.ok === false) {
    return {
      ok: false,
      status: result.status,
      data,
      cooldownMs: responseCooldownMs,
      error: data.message || data.error || 'POKE_REJECTED',
    };
  }

  return {
    ...result,
    cooldownMs: responseCooldownMs || POKE_COOLDOWN_MS,
  };
}

async function getPokeEligibility(username) {
  const cleanUsername = normalizeUsername(username);
  if (!cleanUsername) return { ok: false, error: 'MISSING_USERNAME' };
  const key = cleanUsername.toLowerCase();
  const cached = pokeEligibilityCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < POKE_ELIGIBILITY_CACHE_MS) {
    return { ...cached.value, cached: true };
  }

  const result = await remiliaAuthedFetch('GET', `/api/profile/~${encodeURIComponent(cleanUsername)}`);
  if (!result.ok) return result;
  const viewerContext = result.data?.viewerContext || {};
  const cooldownMs = extractCooldownMs(viewerContext);
  const value = {
    ok: true,
    username: cleanUsername,
    canPoke: viewerContext.canPoke !== false,
    cooldownMs: viewerContext.canPoke === false ? cooldownMs : 0,
    data: result.data,
  };
  pokeEligibilityCache.set(key, { fetchedAt: Date.now(), value });
  return value;
}

async function getIncomingPokes() {
  const cached = await getStored([INCOMING_POKE_CACHE_KEY]);
  const cache = cached[INCOMING_POKE_CACHE_KEY];
  if (cache?.fetchedAt && Date.now() - cache.fetchedAt < INCOMING_POKE_CACHE_MS) {
    return { ok: true, ...cache, cached: true };
  }

  const result = await remiliaAuthedFetch('GET', '/api/notifications?type=poke&limit=50');
  if (!result.ok) return result;

  const notifications = collectNotificationItems(result.data);
  const pokers = [];
  const seen = new Set();
  const cutoff = Date.now() - INCOMING_POKE_WINDOW_MS;

  for (const notification of notifications) {
    const type = String(notification?.type || notification?.notificationType || notification?.action || '').toLowerCase();
    if (type && type !== 'poke') continue;
    const timestamp = extractNotificationTimestamp(notification);
    if (!timestamp || timestamp < cutoff) continue;

    const sender = extractNotificationSender(notification);
    const handle = normalizeUsername(sender?.userHandle || sender?.username || sender?.handle || sender?.twitterHandle || sender);
    if (!handle) continue;

    const key = handle.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    pokers.push(handle);
  }

  const payload = {
    pokers,
    fetchedAt: Date.now(),
    notificationCount: notifications.length,
  };
  await setStored({ [INCOMING_POKE_CACHE_KEY]: payload });
  return { ok: true, ...payload };
}

function collectNotificationItems(data) {
  const candidates = [
    data?.notifications,
    data?.data?.notifications,
    data?.items,
    data?.data?.items,
    data?.results,
    data?.data?.results,
  ];
  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }
  return Array.isArray(data) ? data : [];
}

function extractNotificationSender(notification) {
  const content = notification?.content || notification?.data || {};
  return (
    content.from
    || content.sender
    || content.actor
    || notification?.from
    || notification?.sender
    || notification?.actor
    || notification?.user
    || content.user
    || null
  );
}

function extractNotificationTimestamp(notification) {
  const content = notification?.content || notification?.data || {};
  const values = [
    notification?.createdAt,
    notification?.created_at,
    notification?.timestamp,
    notification?.time,
    notification?.date,
    notification?.updatedAt,
    content?.createdAt,
    content?.created_at,
    content?.timestamp,
    content?.time,
    content?.date,
  ];

  for (const value of values) {
    const timestamp = normalizeTimestamp(value);
    if (timestamp) return timestamp;
  }
  return 0;
}

function normalizeTimestamp(value) {
  if (value == null) return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value < 10000000000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return normalizeTimestamp(numeric);
    const parsed = Date.parse(trimmed);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function normalizeUsername(value) {
  return typeof value === 'string' ? value.replace(/^@/, '').trim() : '';
}

async function remiliaPokeFetch(username) {
  await migrateAuth();
  const stored = await getStored([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
  const adoptedSession = await adoptBrowserSession();
  let accessToken = adoptedSession.token || stored[ACCESS_TOKEN_KEY];
  if (!accessToken && stored[REFRESH_TOKEN_KEY] && await refreshAccessToken()) {
    accessToken = (await getStored([ACCESS_TOKEN_KEY]))[ACCESS_TOKEN_KEY];
  }
  if (!accessToken) {
    if (!adoptedSession.ok) return { ok: false, authRequired: true, error: 'REMILIA_LOGIN_REQUIRED' };
  }

  if (accessToken) await setAuthCookie(accessToken);
  const before = await remiliaRequest('GET', `/api/profile/~${encodeURIComponent(username)}`, null, {
    credentials: 'include',
    authMethod: 'profile-before-cookie',
  });

  const attempts = [
    { authMethod: 'cookie', credentials: 'include' },
    ...(accessToken ? [
      { authMethod: 'bearer', credentials: 'omit', accessToken },
      { authMethod: 'cookie+bearer', credentials: 'include', accessToken },
    ] : []),
  ];
  const results = [];
  for (const attempt of attempts) {
    const result = await remiliaRequest('POST', '/api/pokeUser', { username }, attempt);
    results.push(summarizeRequestResult(result));
    if (result.ok && result.data?.success !== false && result.data?.ok !== false) {
      const verified = await verifyPokeResult(username, before, result, attempt.authMethod, results);
      await storePokeDiagnostic(verified);
      return verified.ok ? verified : result;
    }
    if (result.status && result.status !== 401 && result.status !== 403) {
      await storePokeDiagnostic({ ok: false, username, before: summarizeProfile(before), attempts: results });
      return result;
    }
  }

  const fallback = {
    ok: false,
    authRequired: results.some(result => result.status === 401 || result.status === 403),
    error: 'POKE_AUTH_FAILED',
    username,
    before: summarizeProfile(before),
    attempts: results,
  };
  await storePokeDiagnostic(fallback);
  return fallback;
}

async function verifyPokeResult(username, before, pokeResult, authMethod, attempts) {
  const after = await remiliaRequest('GET', `/api/profile/~${encodeURIComponent(username)}`, null, {
    credentials: 'include',
    authMethod: 'profile-after-cookie',
  });
  const beforeProfile = summarizeProfile(before);
  const afterProfile = summarizeProfile(after);
  const beforePokes = Number(before?.data?.user?.pokes);
  const afterPokes = Number(after?.data?.user?.pokes);
  const cooldownMs = extractCooldownMs(pokeResult.data) || extractCooldownMs(after.data?.viewerContext) || POKE_COOLDOWN_MS;
  const verified = pokeResult.data?.success === true
    || after.data?.viewerContext?.canPoke === false && Number(after.data?.viewerContext?.pokeCooldownSeconds) > 0
    || Number.isFinite(beforePokes) && Number.isFinite(afterPokes) && afterPokes > beforePokes;

  return {
    ...pokeResult,
    ok: Boolean(verified),
    error: verified ? undefined : 'POKE_NOT_VERIFIED',
    cooldownMs: verified ? cooldownMs : 0,
    username,
    authMethod,
    before: beforeProfile,
    after: afterProfile,
    attempts,
  };
}

function summarizeRequestResult(result) {
  return {
    ok: Boolean(result?.ok),
    status: result?.status || 0,
    authMethod: result?.authMethod || '',
    success: result?.data?.success,
    message: result?.data?.message || result?.data?.error || '',
  };
}

function summarizeProfile(result) {
  return {
    ok: Boolean(result?.ok),
    status: result?.status || 0,
    authMethod: result?.authMethod || '',
    username: result?.data?.user?.username || '',
    pokes: result?.data?.user?.pokes,
    canPoke: result?.data?.viewerContext?.canPoke,
    pokeCooldownSeconds: result?.data?.viewerContext?.pokeCooldownSeconds,
    isAuthenticated: result?.data?.isAuthenticated,
  };
}

async function storePokeDiagnostic(diagnostic) {
  await setStored({
    [LAST_POKE_DIAGNOSTIC_KEY]: {
      ...diagnostic,
      updatedAt: Date.now(),
    },
  });
}

function extractCooldownMs(data) {
  const nested = data?.data || {};
  const values = [
    data?.cooldownMs,
    data?.cooldown,
    data?.cooldownRemaining,
    data?.cooldownRemainingMs,
    data?.remainingMs,
    data?.remaining,
    data?.retryAfterMs,
    data?.retryAfter,
    data?.nextPokeInMs,
    data?.nextPokeIn,
    data?.pokeCooldownMs,
    data?.pokeCooldown,
    data?.pokeCooldownSeconds,
    nested?.cooldownMs,
    nested?.cooldown,
    nested?.cooldownRemaining,
    nested?.cooldownRemainingMs,
    nested?.remainingMs,
    nested?.remaining,
    nested?.retryAfterMs,
    nested?.retryAfter,
    nested?.nextPokeInMs,
    nested?.nextPokeIn,
    nested?.pokeCooldownMs,
    nested?.pokeCooldown,
    nested?.pokeCooldownSeconds,
  ];

  for (const value of values) {
    const ms = normalizeCooldownMs(value);
    if (ms > 0) return ms;
  }

  const untilValues = [
    data?.cooldownUntil,
    data?.nextPokeAt,
    data?.pokeAvailableAt,
    data?.availableAt,
    nested?.cooldownUntil,
    nested?.nextPokeAt,
    nested?.pokeAvailableAt,
    nested?.availableAt,
  ];
  for (const value of untilValues) {
    const timestamp = Date.parse(value);
    if (Number.isFinite(timestamp) && timestamp > Date.now()) {
      return timestamp - Date.now();
    }
  }

  return 0;
}

function normalizeCooldownMs(value) {
  if (value == null || value === false) return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0;
    return value < 1000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return normalizeCooldownMs(numeric);
    const match = trimmed.match(/(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?\s*(?:(\d+)\s*s)?/i);
    if (match && match[0].trim()) {
      const days = Number(match[1] || 0);
      const hours = Number(match[2] || 0);
      const minutes = Number(match[3] || 0);
      const seconds = Number(match[4] || 0);
      return (((days * 24 + hours) * 60 + minutes) * 60 + seconds) * 1000;
    }
  }
  return 0;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!MESSAGE_TYPES.has(message?.type)) return false;

  (async () => {
    try {
      if (message?.type === 'beetol:login') {
        sendResponse(await oidc({
          grant_type: 'password',
          username: String(message.username || '').trim(),
          password: String(message.password || ''),
          scope: 'openid profile email',
        }));
        return;
      }
      if (message?.type === 'beetol:logout') {
        await clearAuth();
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === 'beetol:authStatus') {
        await migrateAuth();
        const adopted = await adoptBrowserSession();
        if (adopted.ok) {
          sendResponse({
            ok: true,
            signedIn: true,
            method: adopted.token ? 'sso' : 'session',
          });
          return;
        }
        const stored = await getStored([ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY]);
        if (stored[ACCESS_TOKEN_KEY]) {
          const whoami = await remiliaFetch('GET', '/api/profile/whoami');
          sendResponse({
            ok: true,
            signedIn: Boolean(whoami.ok),
            method: whoami.ok ? 'token' : null,
            user: whoami.ok ? whoami.data : null,
          });
          return;
        }
        if (stored[REFRESH_TOKEN_KEY] && await refreshAccessToken()) {
          const whoami = await remiliaFetch('GET', '/api/profile/whoami');
          sendResponse({
            ok: true,
            signedIn: Boolean(whoami.ok),
            method: whoami.ok ? 'token' : null,
            user: whoami.ok ? whoami.data : null,
          });
          return;
        }
        sendResponse({
          ok: true,
          signedIn: false,
          method: null,
        });
        return;
      }
      if (message?.type === 'beetol:sessionStatus') {
        const adopted = await adoptBrowserSession();
        sendResponse({
          ok: true,
          signedIn: Boolean(adopted.ok),
          method: adopted.ok ? (adopted.token ? 'sso' : 'session') : null,
        });
        return;
      }
      if (message?.type === 'beetol:getState') {
        sendResponse(await getState());
        return;
      }
      if (message?.type === 'beetol:action') {
        sendResponse(await runAction(message.action));
        return;
      }
      if (message?.type === 'beetol:crunchJunk') {
        sendResponse(await crunchJunk());
        return;
      }
      if (message?.type === 'beetol:poke') {
        sendResponse(await pokeUser(message.username));
        return;
      }
      if (message?.type === 'beetol:pokeEligibility') {
        sendResponse(await getPokeEligibility(message.username));
        return;
      }
      if (message?.type === 'beetol:incomingPokes') {
        sendResponse(await getIncomingPokes());
        return;
      }
      sendResponse({ ok: false, error: 'UNKNOWN_BEETOL_MESSAGE' });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || String(error) });
    }
  })();
  return true;
});
