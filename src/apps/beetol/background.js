import { registerBackgroundMessageHandlers } from "../../platform/background/router";
import {
  REMILIA_BASE_URL,
  prepareRemiliaAuth,
  renewRemiliaAuth,
  clearRemiliaAuth,
  clearStoredRemiliaAuth,
  isRemiliaDisconnected,
  adoptRemiliaBrowserSession,
  migrateRemiliaAuth,
  refreshRemiliaBrowserSessionTab,
} from "../../platform/auth/remilia-auth";

const BASE_URL = REMILIA_BASE_URL;
const POKE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const INCOMING_POKE_WINDOW_MS = POKE_COOLDOWN_MS;
const INCOMING_POKE_CACHE_MS = 2 * 60 * 1000;
const LAST_POKE_DIAGNOSTIC_KEY = 'milxdy.remistats.lastPokeDiagnostic';
const INCOMING_POKE_CACHE_KEY = 'milxdy.remistats.incomingPokeCache';
const SESSION_PROBE_PATH = '/api/beetle/user';
const AUTH_SESSION_PROBE_PATH = '/api/profile/whoami';
const ACTIONS = new Set(['catchBeetle', 'beetleHunt', 'claimUBC', 'junkFaucet']);
const MESSAGE_TYPES = new Set([
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

const migrateAuth = migrateRemiliaAuth;

async function clearAuth() {
  return clearRemiliaAuth();
}

async function clearStoredAuth() {
  return clearStoredRemiliaAuth();
}

async function adoptBrowserSession(options = {}) {
  return adoptRemiliaBrowserSession(AUTH_SESSION_PROBE_PATH, options);
}

async function refreshAccessToken() {
  const result = await renewRemiliaAuth(AUTH_SESSION_PROBE_PATH);
  return result.ok;
}

async function remiliaFetch(method, path, body, retry = true) {
  if (await isRemiliaDisconnected()) return { ok: false, authRequired: true, disconnected: true };
  await migrateAuth();
  const prepared = await prepareRemiliaAuth(AUTH_SESSION_PROBE_PATH);
  const accessToken = prepared.token;
  if (!accessToken) return { ok: false, authRequired: true };

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
  // A failed mutation may already have reached the server. Only retry using
  // browser-session auth when the token path definitively rejected auth.
  if (!tokenResult.authRequired) return tokenResult;
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
  // Do not surround the mutation with two state reads. The shared runtime
  // deadline applies to the whole message handler, and a successful action
  // used to time out while waiting for the trailing GET. Use the last known
  // snapshot for best-effort reward labels and let the content panel reconcile
  // state in a separate, non-blocking request after it receives this result.
  const stored = await getStored({ lastUser: null });
  const inventoryBefore = stored.lastUser?.inventory || {};
  const result = await remiliaAuthedFetch('POST', `/api/beetle/action/${action}`, {});

  if (!result.ok) return result;
  const cooldownMs = extractActionCooldownMs(result.data, action);
  const responseUser = result.data?.user || null;
  if (result.data?.success === false) {
    return {
      ok: true,
      actionResult: result.data,
      cooldownMs,
      user: responseUser,
      fetchedAt: Date.now(),
      needsRefresh: true,
    };
  }

  const inventoryAfter = responseUser?.inventory || result.data?.inventory || {};
  const gained = Object.entries(inventoryAfter)
    .map(([key, qty]) => [key, qty - (inventoryBefore[key] || 0)])
    .filter(([, diff]) => diff > 0)
    .map(([key, diff]) => ({ key, diff }));

  return {
    ok: true,
    actionResult: result.data,
    cooldownMs,
    user: responseUser,
    fetchedAt: Date.now(),
    gained,
    needsRefresh: true,
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
  if (!result.ok) {
    const cooldownMs = !result.authRequired && isExplicitPokeCooldownResponse(result)
      ? extractCooldownMs(result.data)
      : 0;
    return cooldownMs > 0 ? { ...result, cooldownMs } : result;
  }

  const data = result.data || {};
  const responseCooldownMs = extractCooldownMs(data);
  if (data.success === false || data.ok === false || isExplicitPokeCooldownResponse(result)) {
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
  return {
    ok: true,
    username: cleanUsername,
    canPoke: true,
    cooldownMs: 0,
    skippedProfileLookup: true,
  };
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
  if (await isRemiliaDisconnected()) return { ok: false, authRequired: true, disconnected: true, error: 'REMILIA_LOGIN_REQUIRED' };
  await migrateAuth();
  const prepared = await prepareRemiliaAuth(SESSION_PROBE_PATH);
  if (!prepared.ok) {
    const refreshed = await refreshRemiliaBrowserSessionTab(SESSION_PROBE_PATH);
    if (!refreshed.ok) return { ok: false, authRequired: true, error: 'REMILIA_LOGIN_REQUIRED', sessionRefresh: refreshed };
    return remiliaPokeFetchWithPrepared(username, refreshed);
  }

  const firstResult = await remiliaPokeFetchWithPrepared(username, prepared);
  if (!pokeResultNeedsSessionRefresh(firstResult)) return firstResult;

  await clearStoredAuth();
  const refreshed = await refreshRemiliaBrowserSessionTab(SESSION_PROBE_PATH);
  if (!refreshed.ok) return firstResult;

  const retryResult = await remiliaPokeFetchWithPrepared(username, refreshed);
  if (!retryResult.ok && retryResult.authRequired) {
    return { ...retryResult, sessionRefresh: { ok: true } };
  }
  return { ...retryResult, sessionRefresh: { ok: true } };
}

async function remiliaPokeFetchWithPrepared(username, prepared) {
  const accessToken = prepared?.token || '';
  if (!accessToken && !prepared?.ok) return { ok: false, authRequired: true, error: 'REMILIA_LOGIN_REQUIRED' };

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
    if (result.ok && result.data?.success !== false && result.data?.ok !== false && !isExplicitPokeCooldownResponse(result)) {
      const accepted = {
        ...result,
        ok: true,
        username,
        authMethod: attempt.authMethod,
        cooldownMs: extractCooldownMs(result.data),
        attempts,
      };
      await storePokeDiagnostic(accepted);
      return accepted;
    }
    if (result.ok && isExplicitPokeCooldownResponse(result)) {
      const rejected = {
        ...result,
        ok: false,
        username,
        authMethod: attempt.authMethod,
        cooldownMs: extractCooldownMs(result.data),
        error: result.data?.message || result.data?.error || 'POKE_COOLDOWN',
      };
      await storePokeDiagnostic(rejected);
      return rejected;
    }
    if (result.status && result.status !== 401 && result.status !== 403) {
      await storePokeDiagnostic({ ok: false, username, attempts: results });
      return result;
    }
  }

  const fallback = {
    ok: false,
    authRequired: results.some(result => result.status === 401 || result.status === 403),
    error: 'POKE_AUTH_FAILED',
    username,
    attempts: results,
  };
  await storePokeDiagnostic(fallback);
  return fallback;
}

function pokeResultNeedsSessionRefresh(result) {
  if (!result || result.ok || !result.authRequired) return false;
  const attempts = Array.isArray(result.attempts) ? result.attempts : [];
  if (attempts.some(attempt => attempt.status === 401 || attempt.status === 403)) return true;
  return result.error === 'POKE_AUTH_FAILED' || result.error === 'REMILIA_LOGIN_REQUIRED';
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

async function storePokeDiagnostic(diagnostic) {
  await setStored({
    [LAST_POKE_DIAGNOSTIC_KEY]: {
      ...diagnostic,
      updatedAt: Date.now(),
    },
  });
}

function extractCooldownMs(data, action) {
  const nested = data?.data || {};
  const actionCooldowns = data?.cooldowns || nested?.cooldowns || {};
  const actionData = action ? data?.[action] || nested?.[action] || data?.actions?.[action] || nested?.actions?.[action] || {} : {};
  const values = [
    action ? actionCooldowns?.[action] : undefined,
    actionData?.cooldownMs,
    actionData?.cooldown,
    actionData?.cooldownRemaining,
    actionData?.cooldownRemainingMs,
    actionData?.remainingMs,
    actionData?.remaining,
    actionData?.retryAfterMs,
    actionData?.retryAfter,
    actionData?.message,
    actionData?.error,
    data?.cooldownMs,
    data?.cooldown,
    data?.cooldownRemaining,
    data?.cooldownRemainingMs,
    data?.remainingMs,
    data?.remaining,
    data?.retryAfterMs,
    data?.retryAfter,
    data?.message,
    data?.error,
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
    nested?.message,
    nested?.error,
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
    actionData?.cooldownUntil,
    actionData?.availableAt,
    actionData?.nextAt,
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

function extractActionCooldownMs(data, action) {
  const cooldownMs = extractCooldownMs(data, action);
  if (cooldownMs > 0) return cooldownMs;
  return 0;
}

function isCooldownMessage(message) {
  return /cool\s*down|try again|not ready|wait/i.test(String(message || ''));
}

function isExplicitPokeCooldownResponse(response) {
  if (!response || response.authRequired) return false;
  const data = response.data || {};
  const nested = data.data || {};
  const fields = [
    response.error,
    data.error,
    data.message,
    data.reason,
    data.code,
    nested.error,
    nested.message,
    nested.reason,
    nested.code,
  ];
  return fields.some(isExplicitPokeCooldownText);
}

function isExplicitPokeCooldownText(value) {
  const text = String(value || '');
  return /already\s+poked|poke(?:\s+is)?\s+on\s+cool\s*down|poke\s+cool\s*down|cool\s*down/i.test(text)
    || /try again(?:\s+\w+){0,4}\s+to\s+poke/i.test(text)
    || /try again(?:\s+\w+){0,4}\s+(?:after|when|once)(?:\s+\w+){0,4}\s+cool\s*down/i.test(text);
}

function normalizeCooldownMs(value) {
  if (value == null || value === false) return 0;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (value > 1000000000000) return Math.max(0, value - Date.now());
    return value < 1000 ? value * 1000 : value;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return 0;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) return normalizeCooldownMs(numeric);
    const colonMatch = trimmed.match(/\b(?:(\d+):)?([0-5]?\d):([0-5]\d)\b/);
    if (colonMatch) {
      const hours = Number(colonMatch[1] || 0);
      const minutes = Number(colonMatch[2] || 0);
      const seconds = Number(colonMatch[3] || 0);
      return ((hours * 60 + minutes) * 60 + seconds) * 1000;
    }
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

registerBackgroundMessageHandlers([{
  type: 'beetol:*',
  matches: isBeetolMessage,
  handle: handleBeetolMessage,
}]);

function isBeetolMessage(message) {
  return MESSAGE_TYPES.has(message?.type);
}

async function handleBeetolMessage(message, sender) {
  if (!isBeetolMessageSender(message, sender)) {
    return { ok: false, status: 0, error: 'UNSUPPORTED_SENDER' };
  }
  if (message?.type === 'beetol:logout') {
    await clearAuth();
    return { ok: true };
  }
  if (message?.type === 'beetol:authStatus') {
    return getAuthStatus();
  }
  if (message?.type === 'beetol:sessionStatus') {
    const adopted = await adoptBrowserSession({ ignoreDisconnect: true });
    return {
      ok: true,
      signedIn: Boolean(adopted.ok),
      method: adopted.ok ? (adopted.token ? 'sso' : 'session') : null,
    };
  }
  if (message?.type === 'beetol:getState') {
    return getState();
  }
  if (message?.type === 'beetol:action') {
    return runAction(message.action);
  }
  if (message?.type === 'beetol:crunchJunk') {
    return crunchJunk();
  }
  if (message?.type === 'beetol:poke') {
    return pokeUser(message.username);
  }
  if (message?.type === 'beetol:pokeEligibility') {
    return getPokeEligibility(message.username);
  }
  if (message?.type === 'beetol:incomingPokes') {
    return getIncomingPokes();
  }
  return { ok: false, error: 'UNKNOWN_BEETOL_MESSAGE' };
}

function isBeetolMessageSender(message, sender) {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  if (isBeetolExtensionPageSender(sender)) {
    return message?.type === 'beetol:authStatus'
      || message?.type === 'beetol:sessionStatus'
      || message?.type === 'beetol:logout';
  }
  return isBeetolContentScriptSender(sender);
}

function isBeetolExtensionPageSender(sender) {
  if (sender.tab) return false;
  const source = sender.url || sender.origin || '';
  try {
    return new URL(source).origin === new URL(chrome.runtime.getURL('')).origin;
  } catch {
    return false;
  }
}

function isBeetolContentScriptSender(sender) {
  if (!sender || sender.id !== chrome.runtime.id || typeof sender.tab?.id !== 'number') return false;
  if (sender.frameId !== undefined && sender.frameId !== 0) return false;
  const source = sender.url || sender.origin || sender.tab.url || '';
  try {
    const url = new URL(source);
    return url.protocol === 'https:' && (
      url.hostname === 'x.com'
      || url.hostname === 'twitter.com'
      || url.hostname === 'www.remilia.net'
    );
  } catch {
    return false;
  }
}

async function getAuthStatus() {
  await migrateAuth();
  const adopted = await adoptBrowserSession();
  if (adopted.ok) {
    return {
      ok: true,
      signedIn: true,
      method: adopted.token ? 'sso' : 'session',
    };
  }
  const renewed = await renewRemiliaAuth(AUTH_SESSION_PROBE_PATH);
  if (renewed.ok) {
    return authStatusFromWhoami(renewed.method || 'token');
  }
  return {
    ok: true,
    signedIn: false,
    method: null,
  };
}

async function authStatusFromWhoami(method = 'token') {
  const whoami = await remiliaFetch('GET', '/api/profile/whoami');
  return {
    ok: true,
    signedIn: Boolean(whoami.ok),
    method: whoami.ok ? method : null,
    user: whoami.ok ? whoami.data : null,
  };
}
