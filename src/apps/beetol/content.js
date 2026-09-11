import { createOverlayAppFrame } from "../../platform/overlay/app-frame";
import {
  observeOverlayPanelTheme,
  resolveOverlayPanelTheme,
  restoreOverlayPanelBox,
  startOverlayPanelDrag,
} from "../../platform/overlay/panel-base";
import { registerOverlayAppRoot } from "../../platform/overlay/app-layout";
import { beetleHuntChargesFromUser, beetleHuntCooldownFromUser } from "./hunt-cooldown";
import { createBeetolSdkServices } from "./sdk-services";

function mountBeetolGame(context = {}) {
  const sdkServices = createBeetolSdkServices(context);
  const ROOT_VERSION = '2026-08-16-read-only-native-link';
  const existingRoot = document.getElementById('beetol-hunter-root');
  if (existingRoot) {
    if (existingRoot.dataset.version === ROOT_VERSION) return;
    existingRoot.remove();
  }

  function hasExtensionRuntime() {
    return typeof globalThis.chrome?.runtime?.id === 'string' && chrome.runtime.id.length > 0;
  }

  const STATUS_ITEMS = [
    ['catchBeetle', 'Claim Beetle'],
    ['beetleHunt', 'Hunt Beetle'],
    ['claimUBC', 'Claim Cheese'],
    ['junkFaucet', 'Junk Faucet'],
  ];
  const TAB_ICON_URL = sdkServices.tabIconUrl;
  const REMILIANET_ORIGIN = 'https://www.remilia.net';
  const POSITION_KEY = 'beetol.hunterPosition';
  const COOLDOWN_STATE_KEY = 'beetol.cooldownState';
  const COOLDOWN_STATE_VERSION = 3;
  const ENABLED_KEY = 'milxdy.remistats.beetol.enabled';
  const SETTINGS_THEME_KEY = 'milxdy.settings.theme';
  const LEGACY_PREFIX = 'bex' + 'tol';
  const LEGACY_ENABLED_KEY = `milxdy.${LEGACY_PREFIX}.enabled`;
  const SNAP_MARGIN = 10;
  const { runtimeScheduler, lifecycleSignal, appSdkSendMessage, getLocal, setLocal } = sdkServices;
  const lifecycleActive = () => state.enabled && lifecycleSignal?.aborted !== true;

  const state = {
    enabled: true,
    signedIn: false,
    loading: false,
    settings: {
      color: 'red',
      mode: 'settings',
      settingsTheme: 'system',
    },
    user: null,
    fetchedAt: 0,
    cooldowns: {
      catchBeetle: null,
      beetleHunt: null,
      claimUBC: null,
      junkFaucet: null,
    },
    cooldownExpiresAt: {
      catchBeetle: null,
      beetleHunt: null,
      claimUBC: null,
      junkFaucet: null,
    },
    huntCharges: 3,
    message: '',
    messageKind: '',
    menuSoundArmed: false,
    position: null,
    layout: { x: 10, width: 156, height: 320, topOffset: 10 },
    dragging: null,
    photoViewerOpen: false,
    dockOpen: false,
    dockSide: 'left',
    appFrame: null,
  };
  const disposables = [];
  function addDisposable(disposable) {
    disposables.push(disposable);
  }
  function addRepeatingTask(callback, delayMs) {
    let disposed = false;
    let cancelTimer = null;
    const run = () => {
      cancelTimer = null;
      if (disposed || !lifecycleActive()) return;
      callback();
      if (!disposed && lifecycleActive()) cancelTimer = runtimeScheduler.timeout(run, delayMs);
    };
    cancelTimer = runtimeScheduler.timeout(run, delayMs);
    addDisposable(() => {
      disposed = true;
      cancelTimer?.();
      cancelTimer = null;
    });
  }
  function disposeAll() {
    while (disposables.length) {
      const disposable = disposables.pop();
      try {
        disposable?.();
      } catch {
        // Best-effort cleanup for page-level listeners.
      }
    }
  }

  const root = document.createElement('div');
  root.id = 'beetol-hunter-root';
  root.dataset.version = ROOT_VERSION;
  root.innerHTML = `
    <div class="beetol-shell">
      <button class="beetol-tab" type="button" title="Beetol Game">
        <span class="beetol-icon">🪲</span>
        <span id="beetol-next">--</span>
      </button>
      <section class="beetol-panel">
        <div class="beetol-head">
          <div>
            <div class="beetol-title">Beetol Game</div>
            <div id="beetol-user" class="beetol-subtitle">Checking Remilia authorization...</div>
          </div>
          <button id="beetol-refresh" class="beetol-icon-btn" type="button" title="Refresh">&#8635;</button>
          <button id="beetol-minimize" class="beetol-icon-btn" type="button" title="Minimize" aria-label="Minimize">_</button>
        </div>
        <div id="beetol-signed-out" class="beetol-signed-out-msg">
          <span>Open the milXdy extension popup, then use Remilia connection &rarr; Connect/Reconnect.</span>
        </div>
        <div id="beetol-read-only" class="beetol-read-only" hidden>
          <strong>Official read-only status</strong>
          <span>Actions run in RemiliaNET's visible Beetle game.</span>
          <div id="beetol-status-list" class="beetol-status-list" role="list" aria-label="Official Beetle action status"></div>
          <a id="beetol-native-game" class="beetol-native-game" href="https://www.remilia.net" target="_blank" rel="noopener noreferrer">Play Beetle on RemiliaNET</a>
        </div>
        <div id="beetol-footer" class="beetol-footer">
          <span id="beetol-message" role="status" aria-live="polite" aria-atomic="true"></span>
        </div>
      </section>
    </div>
  `;
  document.documentElement.appendChild(root);
  root.dataset.docked = 'true';
  root.querySelector('.beetol-icon').innerHTML = `<img src="${TAB_ICON_URL}" alt="">`;
  root.querySelector('#beetol-refresh').textContent = String.fromCharCode(8635);

  const els = {
    shell: root.querySelector('.beetol-shell'),
    panel: root.querySelector('.beetol-panel'),
    head: root.querySelector('.beetol-head'),
    next: root.querySelector('#beetol-next'),
    user: root.querySelector('#beetol-user'),
    signedOut: root.querySelector('#beetol-signed-out'),
    readOnly: root.querySelector('#beetol-read-only'),
    statusList: root.querySelector('#beetol-status-list'),
    nativeGame: root.querySelector('#beetol-native-game'),
    footer: root.querySelector('#beetol-footer'),
    message: root.querySelector('#beetol-message'),
    refresh: root.querySelector('#beetol-refresh'),
    minimize: root.querySelector('#beetol-minimize'),
  };

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function snapPosition(x, y) {
    const width = els.shell.offsetWidth || root.offsetWidth || 156;
    const height = els.shell.offsetHeight || root.offsetHeight || 42;
    const maxX = Math.max(SNAP_MARGIN, window.innerWidth - width - SNAP_MARGIN);
    const maxY = Math.max(SNAP_MARGIN, window.innerHeight - height - SNAP_MARGIN);
    const clampedX = clamp(x, SNAP_MARGIN, maxX);
    const clampedY = clamp(y, SNAP_MARGIN, maxY);
    const distances = [
      { edge: 'left', distance: clampedX - SNAP_MARGIN, x: SNAP_MARGIN, y: clampedY },
      { edge: 'right', distance: maxX - clampedX, x: maxX, y: clampedY },
      { edge: 'top', distance: clampedY - SNAP_MARGIN, x: clampedX, y: SNAP_MARGIN },
      { edge: 'bottom', distance: maxY - clampedY, x: clampedX, y: maxY },
    ];
    return distances.sort((a, b) => a.distance - b.distance)[0];
  }

  function applyPosition(position = state.position) {
    if (root.dataset.docked === 'true') {
      applyDockPosition();
      return;
    }
    const next = position || { edge: 'left', x: state.layout.x, y: state.layout.topOffset };
    const snapped = snapPosition(next.x, next.y);
    state.position = { edge: next.edge || snapped.edge, x: snapped.x, y: snapped.y };
    state.layout.x = state.position.x;
    state.layout.topOffset = state.position.y;
    root.style.left = `${state.position.x}px`;
    root.style.top = `${state.position.y}px`;
    root.dataset.snap = state.position.edge;
    root.dataset.snapX = state.position.x > window.innerWidth / 2 ? 'right' : 'left';
    root.dataset.snapY = state.position.y > window.innerHeight / 2 ? 'bottom' : 'top';
  }

  function applyDockPosition() {
    registerOverlayAppRoot('beetol', root);
    state.position = { edge: state.dockSide, x: state.layout.x, y: state.layout.topOffset };
    root.style.left = `${state.layout.x}px`;
    root.style.right = 'auto';
    root.style.top = `${state.layout.topOffset}px`;
    root.dataset.snap = state.dockSide;
    root.dataset.snapX = state.dockSide;
    root.dataset.snapY = state.layout.topOffset > window.innerHeight / 2 ? 'bottom' : 'top';
  }

  async function restoreDockLayout(legacyPosition = state.position) {
    const layout = await restoreOverlayPanelBox('beetol', {
      side: state.dockSide,
      minWidth: 120,
      minHeight: 160,
      defaultWidth: els.shell.offsetWidth || root.offsetWidth || 156,
      defaultHeight: els.shell.offsetHeight || root.offsetHeight || 320,
      legacy: {
        width: els.shell.offsetWidth || root.offsetWidth || 156,
        height: els.shell.offsetHeight || root.offsetHeight || 320,
        topOffset: legacyPosition?.y,
      },
    });
    state.layout = {
      x: layout.x ?? legacyPosition?.x ?? state.layout.x,
      width: layout.width,
      height: layout.height,
      topOffset: layout.topOffset,
    };
    state.position = { edge: state.dockSide, x: state.layout.x, y: state.layout.topOffset };
    applyDockPosition();
  }

  function savePosition() {
    if (root.dataset.docked === 'true') return;
    if (!hasExtensionRuntime() || !state.position) return;
    setLocal({ [POSITION_KEY]: state.position });
  }

  function saveCooldownState() {
    if (!hasExtensionRuntime()) return;
    setLocal({
      [COOLDOWN_STATE_KEY]: {
        version: COOLDOWN_STATE_VERSION,
        savedAt: Date.now(),
        expiresAt: state.cooldownExpiresAt,
        huntCharges: state.huntCharges,
      },
    });
  }

  function send(message) {
    if (!lifecycleActive()) return Promise.resolve(null);
    const label = message?.type || 'beetol:message';
    if (appSdkSendMessage) {
      return appSdkSendMessage(message, label).catch((error) => ({
        ok: false,
        error: error instanceof Error ? error.message : String(error || 'Request failed'),
      }));
    }
    return Promise.resolve(null);
  }

  function preloadIcon(url) {
    try {
      const image = new Image();
      image.decoding = 'async';
      image.src = url;
      image.decode?.().catch(() => {});
    } catch {
      // Best effort; icon tags still load normally if decoding is unavailable.
    }
  }

  preloadIcon(TAB_ICON_URL);

  let audioContext = null;

  function playTone(frequency, duration = 0.08, gain = 0.035, type = 'triangle') {
    try {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return;
      audioContext ||= new AudioContext();
      if (audioContext.state === 'suspended') void audioContext.resume().catch(() => undefined);
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      volume.gain.setValueAtTime(0.0001, audioContext.currentTime);
      volume.gain.exponentialRampToValueAtTime(gain, audioContext.currentTime + 0.01);
      volume.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
      oscillator.connect(volume);
      volume.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + duration + 0.02);
    } catch {
      // Browsers may block hover-started audio until the user interacts with the page.
    }
  }

  function playMenuSound() {
    playTone(660, 0.07, 0.025);
    setTimeout(() => playTone(880, 0.06, 0.018), 42);
  }

  function playDefaultActionSound() {
    playTone(440, 0.05, 0.03);
    setTimeout(() => playTone(740, 0.08, 0.022), 38);
  }

  function fmtMs(ms) {
    if (ms === null || Number.isNaN(ms)) return '--';
    if (ms <= 0) return 'Available now';
    const seconds = Math.ceil(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
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
      const timestamp = Date.parse(trimmed);
      if (Number.isFinite(timestamp) && timestamp > Date.now()) return timestamp - Date.now();
    }
    return 0;
  }

  function currentCooldowns() {
    const now = Date.now();
    return Object.fromEntries(Object.entries(state.cooldownExpiresAt).map(([key, value]) => [
      key,
      value === null
        ? (state.cooldowns[key] === null ? null : 0)
        : Math.max(0, value - now),
    ]));
  }

  function setMessage(text, kind = '') {
    state.message = text;
    state.messageKind = kind;
    render();
  }

  function applySettings(settings = {}) {
    state.settings = {
      color: settings.beetolColor || state.settings.color || 'red',
      mode: settings.beetolMode || state.settings.mode || 'settings',
      settingsTheme: settings[SETTINGS_THEME_KEY] || state.settings.settingsTheme || 'system',
    };
    root.dataset.color = state.settings.color;
    root.dataset.mode = resolvedPanelMode();
  }

  function resolvedPanelMode() {
    if (state.settings.mode === 'light' || state.settings.mode === 'dark') return state.settings.mode;
    if (state.settings.settingsTheme === 'light' || state.settings.settingsTheme === 'dark') {
      return state.settings.settingsTheme;
    }
    return resolveOverlayPanelTheme();
  }

  function firstFiniteNumber(values) {
    for (const value of values) {
      const number = Number(value);
      if (Number.isFinite(number)) return number;
    }
    return null;
  }

  function firstBoolean(values) {
    for (const value of values) {
      if (typeof value === 'boolean') return value;
      if (typeof value === 'number' && Number.isFinite(value) && (value === 0 || value === 1)) return Boolean(value);
      if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['true', 'yes', 'ready', 'available', 'enabled', '1'].includes(normalized)) return true;
        if (['false', 'no', 'not_ready', 'not ready', 'unavailable', 'disabled', '0'].includes(normalized)) return false;
      }
    }
    return null;
  }

  function isCooldownMessage(message) {
    return /cool\s*down|try again|not ready|wait/i.test(String(message || ''));
  }

  function remiliaNetBeetleUrl(user) {
    const username = String(user?.username || '').trim().replace(/^@/, '');
    return username
      ? `${REMILIANET_ORIGIN}/~${encodeURIComponent(username)}?cartridge=beetle`
      : REMILIANET_ORIGIN;
  }

  function huntStateFromUser(user) {
    const actionData = user?.beetleHunt || user?.actions?.beetleHunt || {};
    const cooldown = cooldownFromUser(user, 'beetleHunt');
    const cooldownMs = Math.max(
      normalizeCooldownMs(cooldown),
      beetleHuntCooldownFromUser(user),
    );
    const message = [
      actionData?.message,
      actionData?.error,
      user?.beetleHuntMessage,
      user?.huntMessage,
    ].find(value => typeof value === 'string' && value.trim());
    const charges = firstFiniteNumber([
      user?.beetleHuntCharges,
      user?.huntCharges,
      user?.huntsRemaining,
      user?.beetleHuntsRemaining,
      user?.charges?.beetleHunt,
      actionData?.charges,
      actionData?.remainingCharges,
      actionData?.huntsRemaining,
      actionData?.remaining,
      beetleHuntChargesFromUser(user),
    ]);
    const available = firstBoolean([
      user?.canBeetleHunt,
      user?.canHunt,
      user?.beetleHuntAvailable,
      user?.huntAvailable,
      actionData?.canUse,
      actionData?.canRun,
      actionData?.canHunt,
      actionData?.available,
      actionData?.availableNow,
      actionData?.ready,
      actionData?.enabled,
    ]);
    const cooldownActive = firstBoolean([
      user?.beetleHuntOnCooldown,
      user?.huntOnCooldown,
      actionData?.onCooldown,
      actionData?.isCooldown,
      actionData?.cooldownActive,
      actionData?.cooldown,
      actionData?.disabled,
    ]);
    const cooldownMessage = isCooldownMessage(message);
    const hasSignal = charges !== null || available !== null || cooldownActive !== null || cooldownMs > 0 || cooldown === 0 || cooldownMessage;

    return {
      hasSignal,
      charges: charges === null ? null : clamp(Math.floor(charges), 0, 3),
      cooldownMs,
      explicitlyReady: available === true || cooldown === 0,
      explicitlyUnavailable: available === false || cooldownActive === true || charges === 0 || cooldownMs > 0 || cooldownMessage,
    };
  }

  function mergeCooldowns(user) {
    const now = Date.now();
    state.fetchedAt = now;
    const huntState = huntStateFromUser(user);
    const serverSaysHuntReady = huntState.hasSignal && !huntState.explicitlyUnavailable && (
      huntState.explicitlyReady
      || (huntState.charges !== null && huntState.charges > 0)
    );
    for (const key of Object.keys(state.cooldowns)) {
      const cooldown = cooldownFromUser(user, key);
      const cooldownMs = normalizeCooldownMs(cooldown);
      if (cooldownMs > 0 || cooldown === 0) {
        setActionCooldown(key, cooldownMs);
      } else if (state.cooldownExpiresAt[key] !== null && state.cooldownExpiresAt[key] <= now) {
        clearActionCooldown(key);
      }
    }
    if (serverSaysHuntReady) {
      clearActionCooldown('beetleHunt');
    }
    if (huntState.charges !== null) {
      state.huntCharges = huntState.charges;
    }
    if (huntState.explicitlyUnavailable) {
      if (huntState.cooldownMs > 0) {
        setActionCooldown('beetleHunt', huntState.cooldownMs);
      } else if ((state.cooldownExpiresAt.beetleHunt ?? 0) <= now) {
        state.huntCharges = 0;
      }
    }
    if ((state.cooldownExpiresAt.beetleHunt ?? 0) > now) {
      state.huntCharges = 0;
    } else if ((state.cooldownExpiresAt.beetleHunt ?? 0) <= now && state.huntCharges <= 0 && serverSaysHuntReady) {
      state.huntCharges = 3;
    }
    saveCooldownState();
  }

  function cooldownFromUser(user, action) {
    const actionData = user?.[action] || user?.actions?.[action] || {};
    const values = [
      user?.cooldowns?.[action],
      user?.cooldownExpiresAt?.[action],
      user?.cooldownUntil?.[action],
      actionData?.cooldownMs,
      actionData?.cooldown,
      actionData?.cooldownRemaining,
      actionData?.cooldownRemainingMs,
      actionData?.remainingMs,
      actionData?.remaining,
      actionData?.retryAfterMs,
      actionData?.retryAfter,
      actionData?.cooldownUntil,
      actionData?.availableAt,
      actionData?.nextAt,
    ];
    return values.find(value => normalizeCooldownMs(value) > 0 || value === 0);
  }

  function setActionCooldown(action, cooldownMs) {
    const ms = normalizeCooldownMs(cooldownMs);
    if (ms > 0) {
      state.cooldowns[action] = ms;
      state.cooldownExpiresAt[action] = Date.now() + ms;
      if (action === 'beetleHunt') state.huntCharges = 0;
    } else {
      clearActionCooldown(action);
    }
  }

  function clearActionCooldown(action) {
    state.cooldowns[action] = 0;
    state.cooldownExpiresAt[action] = null;
    if (action === 'beetleHunt' && state.huntCharges <= 0) state.huntCharges = 3;
  }

  function applyStoredCooldownState(value) {
    if (!value || typeof value !== 'object') return;
    const now = Date.now();
    const expiresAt = value.expiresAt || value.cooldownExpiresAt || {};
    const cooldowns = value.cooldowns || {};
    const savedAt = Number(value.savedAt || value.updatedAt || value.fetchedAt || 0);
    for (const key of Object.keys(state.cooldownExpiresAt)) {
      let expiry = Number(expiresAt[key]);
      if (!Number.isFinite(expiry)) {
        const cooldownMs = normalizeCooldownMs(cooldowns[key]);
        if (cooldownMs > 0) {
          expiry = Number.isFinite(savedAt) && savedAt > 0 ? savedAt + cooldownMs : now + cooldownMs;
        }
      }
      state.cooldownExpiresAt[key] = Number.isFinite(expiry) && expiry > now ? expiry : null;
    }
    const charges = value.version === COOLDOWN_STATE_VERSION ? Number(value.huntCharges) : Number.NaN;
    if (Number.isFinite(charges)) {
      state.huntCharges = clamp(Math.floor(charges), 0, 3);
    } else if ((state.cooldownExpiresAt.beetleHunt ?? 0) <= now) {
      state.huntCharges = 3;
    }
    if ((state.cooldownExpiresAt.beetleHunt ?? 0) > now) state.huntCharges = 0;
    else if (state.huntCharges <= 0) state.huntCharges = 3;
  }

  function render() {
    if (lifecycleSignal?.aborted) return;
    if (!hasExtensionRuntime()) {
      root.hidden = true;
      state.enabled = false;
      return;
    }
    root.hidden = !state.enabled;
    if (!state.enabled) return;
    root.dataset.dockOpen = String(state.dockOpen);
    root.classList.toggle('beetol-signed-out', !state.signedIn);
    root.classList.toggle('beetol-loading', state.loading);
    els.head.hidden = !state.signedIn;
    els.signedOut.hidden = state.signedIn;
    els.readOnly.hidden = !state.signedIn;
    els.footer.hidden = !state.signedIn;

    if (!state.signedIn) {
      els.user.textContent = 'Remilia connection required';
      els.next.textContent = 'Connect';
    } else {
      const name = state.user?.username || state.user?.name || state.user?.displayName || 'Signed in';
      els.user.textContent = name;
      els.next.textContent = 'Read only';
      els.nativeGame.href = remiliaNetBeetleUrl(state.user);
      const cds = currentCooldowns();
      els.statusList.innerHTML = STATUS_ITEMS.map(([key, label]) => {
        const cd = cds[key];
        const huntUnavailable = key === 'beetleHunt' && cd <= 0 && state.huntCharges <= 0;
        const value = huntUnavailable ? 'Unavailable' : fmtMs(cd);
        return `
          <div class="beetol-status-row" role="listitem">
            <span>${label}</span>
            <strong>${value}</strong>
          </div>
        `;
      }).join('');
    }

    els.message.textContent = state.message;
    els.message.className = state.messageKind ? `beetol-${state.messageKind}` : '';
    state.appFrame?.updateDock({
      badgeText: dockBadgeText(),
      title: state.signedIn ? `Beetol Game: ${els.next.textContent || ''}` : 'Beetol Game: connect in extension popup',
    });
  }

  function dockBadgeText() {
    return state.signedIn ? 'READ' : '';
  }

  function enterSignedOutState(message) {
    state.signedIn = false;
    state.user = null;
    state.loading = false;
    setMessage(message, 'warn');
  }

  async function checkAuthStatus(silent = false) {
    if (!lifecycleActive()) return false;
    state.loading = true;
    if (!silent) setMessage('Checking Remilia authorization...');
    render();
    const response = await send({ type: 'beetol:authStatus' });
    if (!lifecycleActive()) return false;
    state.loading = false;
    if (!response?.signedIn) {
      enterSignedOutState(response?.error || 'Remilia authorization is required.');
      render();
      return false;
    }
    state.signedIn = true;
    setMessage('Remilia authorization connected.');
    render();
    await refreshState(true);
    return true;
  }

  async function refreshState(silent = false) {
    if (!lifecycleActive() || document.hidden) return;
    if (!state.signedIn) return;
    state.loading = true;
    if (!silent) setMessage('Refreshing...');
    render();
    const response = await send({ type: 'beetol:getState' });
    if (!lifecycleActive()) return;
    state.loading = false;

    if (response?.authRequired) {
      enterSignedOutState(response?.data?.message || 'Remilia authorization expired.');
      render();
      return;
    }
    if (!response?.ok) {
      setMessage(response?.data?.message || response?.error || 'Refresh failed.', 'warn');
      render();
      return;
    }
    state.user = response.user;
    mergeCooldowns(response.user);
    if (!silent) setMessage('Updated.');
    render();
  }

  els.refresh.addEventListener('click', () => {
    playDefaultActionSound();
    if (state.signedIn) refreshState();
    else checkAuthStatus();
  });

  els.minimize?.addEventListener('click', () => {
    state.dockOpen = false;
    applyDockPosition();
    render();
  });

  function startDrag(event) {
    const button = event.target.closest('button');
    if (event.button !== 0 || (button && !button.classList.contains('beetol-tab'))) return;
    root.classList.add('beetol-dragging');
    startOverlayPanelDrag(event, {
      appId: 'beetol',
      root,
      minWidth: 120,
      minHeight: 160,
      side: () => state.dockSide,
      box: () => ({
        x: state.layout.x,
        width: els.shell.offsetWidth || root.offsetWidth || state.layout.width,
        height: els.shell.offsetHeight || root.offsetHeight || state.layout.height,
        topOffset: state.layout.topOffset,
      }),
      setBox: box => {
        if (typeof box.x === 'number') state.layout.x = box.x;
        if (typeof box.width === 'number') state.layout.width = box.width;
        if (typeof box.height === 'number') state.layout.height = box.height;
        if (typeof box.topOffset === 'number') state.layout.topOffset = box.topOffset;
        state.position = { edge: state.dockSide, x: state.layout.x, y: state.layout.topOffset };
      },
      apply: applyDockPosition,
      persist: () => {
        root.classList.remove('beetol-dragging');
        savePosition();
      },
      disabled: () => state.dockOpen !== true,
      allowInteractiveDragTarget: true,
    });
  }

  root.addEventListener('pointerdown', event => {
    if (event.target.closest('a')) return;
    if (!event.target.closest('.beetol-tab, .beetol-head, .beetol-signed-out-msg')) return;
    startDrag(event);
  });

  const resizeListener = () => {
    applyPosition();
    savePosition();
  };
  window.addEventListener('resize', resizeListener);
  addDisposable(() => window.removeEventListener('resize', resizeListener));

  function isPhotoViewerOpen() {
    if (location.pathname.includes('/photo/')) return true;
    return Boolean(document.querySelector(
      '[aria-modal="true"] [data-testid="tweetPhoto"], [aria-modal="true"] img[src*="twimg.com/media"]',
    ));
  }

  function syncPhotoViewerOffset() {
    const open = isPhotoViewerOpen();
    if (state.photoViewerOpen === open) return;
    state.photoViewerOpen = open;
    root.dataset.photoViewer = String(open);
  }

  let cancelPhotoViewerSync = null;
  const schedulePhotoViewerSync = () => {
    if (!lifecycleActive() || cancelPhotoViewerSync) return;
    cancelPhotoViewerSync = runtimeScheduler.timeout(() => {
      cancelPhotoViewerSync = null;
      if (!lifecycleActive()) return;
      syncPhotoViewerOffset();
    }, 80);
  };
  addDisposable(() => {
    cancelPhotoViewerSync?.();
    cancelPhotoViewerSync = null;
  });
  let cancelPhotoViewerFollowUp = null;
  const schedulePhotoViewerFollowUp = delayMs => {
    if (!lifecycleActive()) return;
    cancelPhotoViewerFollowUp?.();
    cancelPhotoViewerFollowUp = runtimeScheduler.timeout(() => {
      cancelPhotoViewerFollowUp = null;
      if (!lifecycleActive()) return;
      schedulePhotoViewerSync();
    }, delayMs);
  };
  addDisposable(() => {
    cancelPhotoViewerFollowUp?.();
    cancelPhotoViewerFollowUp = null;
  });
  const photoViewerClickListener = () => {
    schedulePhotoViewerSync();
    schedulePhotoViewerFollowUp(350);
  };
  document.addEventListener('click', photoViewerClickListener, true);
  addDisposable(() => document.removeEventListener('click', photoViewerClickListener, true));
  const photoViewerKeyListener = event => {
    if (event.key === 'Escape') schedulePhotoViewerFollowUp(120);
  };
  document.addEventListener('keydown', photoViewerKeyListener, true);
  addDisposable(() => document.removeEventListener('keydown', photoViewerKeyListener, true));
  syncPhotoViewerOffset();

  els.shell.addEventListener('pointerenter', () => {
    if (state.menuSoundArmed) return;
    state.menuSoundArmed = true;
    playMenuSound();
  });

  els.shell.addEventListener('pointerleave', () => {
    state.menuSoundArmed = false;
  });

  const storageListener = (changes, area) => {
    if (!lifecycleActive()) return;
    if (area !== 'local') return;
    if (changes[ENABLED_KEY]) {
      state.enabled = changes[ENABLED_KEY].newValue !== false;
      render();
      if (state.enabled && state.signedIn) refreshState(true);
      return;
    }
    applySettings({
      beetolColor: changes.beetolColor?.newValue,
      beetolMode: changes.beetolMode?.newValue,
      [SETTINGS_THEME_KEY]: changes[SETTINGS_THEME_KEY]?.newValue,
    });
    render();
  };
  addDisposable(sdkServices.observeLocal((changes) => storageListener(changes, 'local')));

  const panelThemeListener = () => {
    if (!lifecycleActive()) return;
    if (state.settings.mode !== 'settings' || state.settings.settingsTheme !== 'system') return;
    root.dataset.mode = resolvedPanelMode();
  };
  addDisposable(observeOverlayPanelTheme(panelThemeListener));

  addRepeatingTask(() => {
    if (lifecycleActive() && !document.hidden) render();
  }, 1000);
  addRepeatingTask(() => {
    if (lifecycleActive() && !document.hidden) refreshState(true);
  }, 60_000);

  state.appFrame = createOverlayAppFrame({
    id: 'beetol',
    label: 'Beetol Game',
    icon: TAB_ICON_URL,
    badgeText: '',
    isOpen: () => state.dockOpen,
    onOpen: () => {
      if (!lifecycleActive()) return;
      state.dockOpen = true;
      applyDockPosition();
      render();
    },
    onClose: () => {
      if (!lifecycleActive()) return;
      state.dockOpen = false;
      applyDockPosition();
      render();
    },
    onSideChange: side => {
      if (!lifecycleActive()) return;
      state.dockSide = side;
      applyDockPosition();
    },
  });
  window.__milxdyBeetolLifecycle = {
    open() {
      if (!lifecycleActive()) return;
      state.dockOpen = true;
      applyDockPosition();
      render();
    },
    close() {
      if (!lifecycleActive()) return;
      state.dockOpen = false;
      applyDockPosition();
      render();
    },
    dispose() {
      state.dockOpen = false;
      state.enabled = false;
      disposeAll();
      state.appFrame?.remove?.();
      root.remove();
      if (window.__milxdyBeetolLifecycle?.dispose === this.dispose) delete window.__milxdyBeetolLifecycle;
    },
    route() {
      if (!lifecycleActive()) return;
      syncPhotoViewerOffset();
    },
  };

  getLocal({
    beetolColor: 'red',
    beetolMode: 'settings',
    [SETTINGS_THEME_KEY]: 'system',
    [ENABLED_KEY]: undefined,
    [LEGACY_ENABLED_KEY]: true,
    [POSITION_KEY]: null,
    [COOLDOWN_STATE_KEY]: null,
  }).then(settings => {
    if (lifecycleSignal?.aborted) return;
    state.enabled = (settings[ENABLED_KEY] ?? settings[LEGACY_ENABLED_KEY]) !== false;
    state.position = settings[POSITION_KEY];
    void restoreDockLayout(state.position);
    applyStoredCooldownState(settings[COOLDOWN_STATE_KEY]);
    applySettings(settings);
    render();
    if (!state.enabled) return;
    checkAuthStatus(true);
  });
  render();
}

export function boot(context = {}) {
  mountBeetolGame(context);
}

export function open() {
  window.__milxdyBeetolLifecycle?.open?.();
}

export function close() {
  window.__milxdyBeetolLifecycle?.close?.();
}

export function onRouteChange() {
  window.__milxdyBeetolLifecycle?.route?.();
}

export function disable() {
  window.__milxdyBeetolLifecycle?.dispose?.();
}

export function dispose() {
  window.__milxdyBeetolLifecycle?.dispose?.();
}
