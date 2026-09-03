import { registerBackgroundMessageHandlers } from "../../platform/background/router";
import { RemiliaApiClient } from "../../platform/auth/remilia-api";
import { isLegacyBeetleAction } from "./legacy-beetle-actions";
import {
  officialBeetleReadFailure,
  readOfficialBeetleSnapshot,
} from "./official-beetle-reads";
import {
  getRemiliaAuthStatus,
  remiliaAuthProvider,
} from "../../platform/auth/remilia-auth";

const officialBeetleReads = new RemiliaApiClient({ auth: remiliaAuthProvider });
const MESSAGE_TYPES = new Set([
  'beetol:authStatus',
  'beetol:getState',
  'beetol:action',
  'beetol:crunchJunk',
]);
async function setStored(values) {
  return chrome.storage.local.set(values);
}

async function getState() {
  try {
    const snapshot = await readOfficialBeetleSnapshot(officialBeetleReads);
    await setStored({ lastUser: snapshot.user, lastFetchedAt: snapshot.fetchedAt });
    return { ok: true, readMode: 'official-api', ...snapshot };
  } catch (error) {
    return { readMode: 'official-api', ...officialBeetleReadFailure(error) };
  }
}

async function runAction(action) {
  if (!isLegacyBeetleAction(action)) return { ok: false, error: 'UNKNOWN_ACTION' };
  return nativeBeetleActionResponse(action);
}

async function crunchJunk() {
  return nativeBeetleActionResponse('craft');
}

async function nativeBeetleActionResponse(action) {
  const status = await getRemiliaAuthStatus();
  if (status.phase !== 'connected') {
    const unsupported = status.phase === 'unsupported';
    const missingScope = status.phase === 'missing-scope';
    return {
      ok: false,
      status: 0,
      error: unsupported ? 'CONNECTOR_UNSUPPORTED' : (missingScope ? 'MISSING_SCOPE' : 'AUTH_REQUIRED'),
      authRequired: !missingScope,
      missingScope,
      actionMode: 'unavailable',
      data: {
        message: unsupported
          ? 'RemiliaNET connection is not supported in this extension build.'
          : (missingScope
            ? 'Reconnect RemiliaNET in the milXdy popup and approve Beetle read access.'
            : 'Connect RemiliaNET in the milXdy popup before using Beetle actions.'),
      },
    };
  }
  return {
    ok: false,
    status: 0,
    error: 'NATIVE_ACTION_REQUIRED',
    nativeAction: true,
    action,
    actionMode: 'native-remilianet',
    data: {
      message: 'Use the visible RemiliaNET Beetle control. milXdy will accelerate its native result without replacing the site action.',
    },
  };
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
  if (message?.type === 'beetol:authStatus') {
    return getAuthStatus();
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
  return { ok: false, error: 'UNKNOWN_BEETOL_MESSAGE' };
}

function isBeetolMessageSender(message, sender) {
  if (!sender || sender.id !== chrome.runtime.id) return false;
  if (isBeetolExtensionPageSender(sender)) {
    return message?.type === 'beetol:authStatus';
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
  const status = await getRemiliaAuthStatus();
  return {
    ok: true,
    signedIn: status.phase === 'connected',
    method: status.phase === 'connected' ? 'oidc' : null,
    actionMode: status.phase === 'connected' ? 'native-remilianet' : 'unavailable',
    user: status.identity || null,
  };
}
