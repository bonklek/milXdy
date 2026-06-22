const BASE_URL = 'https://www.remilia.net';
const OIDC_URL = `${BASE_URL}/oidc/realms/remilia/protocol/openid-connect/token`;
const ACCESS_TOKEN_KEY = 'beetol.accessToken';
const REFRESH_TOKEN_KEY = 'beetol.refreshToken';
const TOKEN_KEYS = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY];
const LEGACY_PREFIX = 'bex' + 'tol';
const ACTIONS = new Set(['catchBeetle', 'beetleHunt', 'claimUBC', 'junkFaucet']);
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
  return chrome.storage.local.remove(TOKEN_KEYS);
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
  const accessToken = stored[ACCESS_TOKEN_KEY];
  if (!accessToken) return { ok: false, authRequired: true };

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(body == null ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  if ((response.status === 401 || response.status === 403) && retry) {
    if (await refreshAccessToken()) return remiliaFetch(method, path, body, false);
    await clearAuth();
    return { ok: false, authRequired: true };
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    return { ok: false, status: response.status, data };
  }
  return { ok: true, data };
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
  if (tokenResult.ok || !tokenResult.authRequired) return tokenResult;
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
  if (result.data?.success === false) return { ok: true, actionResult: result.data };

  const after = await getState();
  const inventoryAfter = after.ok ? after.user?.inventory || {} : {};
  const gained = Object.entries(inventoryAfter)
    .map(([key, qty]) => [key, qty - (inventoryBefore[key] || 0)])
    .filter(([, diff]) => diff > 0)
    .map(([key, diff]) => ({ key, diff }));

  return {
    ok: true,
    actionResult: result.data,
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
  const cleanUsername = String(username || '').replace(/^@/, '').trim();
  if (!cleanUsername) return { ok: false, error: 'MISSING_USERNAME' };
  return remiliaAuthedFetch('POST', '/api/pokeUser', { username: cleanUsername });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
        const stored = await getStored([ACCESS_TOKEN_KEY]);
        if (stored[ACCESS_TOKEN_KEY]) {
          sendResponse({ ok: true, signedIn: true, method: 'token' });
          return;
        }
        const session = await remiliaSessionFetch('GET', '/api/beetle/user');
        sendResponse({ ok: true, signedIn: Boolean(session.ok), method: session.ok ? 'session' : null });
        return;
      }
      if (message?.type === 'beetol:sessionStatus') {
        const session = await remiliaSessionFetch('GET', '/api/beetle/user');
        sendResponse({ ok: true, signedIn: Boolean(session.ok), method: session.ok ? 'session' : null });
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
      sendResponse({ ok: false, error: 'UNKNOWN_MESSAGE' });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || String(error) });
    }
  })();
  return true;
});
