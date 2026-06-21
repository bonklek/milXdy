const BASE_URL = 'https://www.remilia.net';
const OIDC_URL = `${BASE_URL}/oidc/realms/remilia/protocol/openid-connect/token`;
const ACCESS_TOKEN_KEY = 'bextol.accessToken';
const REFRESH_TOKEN_KEY = 'bextol.refreshToken';
const TOKEN_KEYS = [ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY];
const ACTIONS = new Set(['catchBeetle', 'beetleHunt', 'claimUBC', 'junkFaucet']);

async function getStored(keys) {
  return chrome.storage.local.get(keys);
}

async function setStored(values) {
  return chrome.storage.local.set(values);
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
  const stored = await getStored([REFRESH_TOKEN_KEY]);
  const refreshToken = stored[REFRESH_TOKEN_KEY];
  if (!refreshToken) return false;
  const result = await oidc({ grant_type: 'refresh_token', refresh_token: refreshToken });
  return result.ok;
}

async function remiliaFetch(method, path, body, retry = true) {
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

async function getState() {
  const result = await remiliaFetch('GET', '/api/beetle/user');
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
  const before = await remiliaFetch('GET', '/api/beetle/user');
  const inventoryBefore = before.ok ? before.data?.inventory || {} : {};
  const result = await remiliaFetch('POST', `/api/beetle/action/${action}`, {});

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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      if (message?.type === 'bextol:login') {
        sendResponse(await oidc({
          grant_type: 'password',
          username: String(message.username || '').trim(),
          password: String(message.password || ''),
          scope: 'openid profile email',
        }));
        return;
      }
      if (message?.type === 'bextol:logout') {
        await clearAuth();
        sendResponse({ ok: true });
        return;
      }
      if (message?.type === 'bextol:authStatus') {
        const stored = await getStored([ACCESS_TOKEN_KEY]);
        sendResponse({ ok: true, signedIn: Boolean(stored[ACCESS_TOKEN_KEY]) });
        return;
      }
      if (message?.type === 'bextol:getState') {
        sendResponse(await getState());
        return;
      }
      if (message?.type === 'bextol:action') {
        sendResponse(await runAction(message.action));
        return;
      }
      sendResponse({ ok: false, error: 'UNKNOWN_MESSAGE' });
    } catch (error) {
      sendResponse({ ok: false, error: error?.message || String(error) });
    }
  })();
  return true;
});
