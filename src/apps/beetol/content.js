import { createOverlayAppFrame } from "../../platform/overlay/app-frame";
import {
  observeOverlayPanelTheme,
  resolveOverlayPanelTheme,
  restoreOverlayPanelBox,
  startOverlayPanelDrag,
} from "../../platform/overlay/panel-base";
import { registerOverlayAppRoot } from "../../platform/overlay/app-layout";
import { createFallbackRuntimeScheduler } from "../../platform/runtime/scheduler";
import { BEETLE_HUNT_COOLDOWN_MS, beetleHuntChargesFromUser, beetleHuntCooldownFromUser } from "./hunt-cooldown";

function mountBeetolGame(context = {}) {
  const ROOT_VERSION = '2026-06-28-settings-dark-signin';
  const existingRoot = document.getElementById('beetol-hunter-root');
  if (existingRoot) {
    if (existingRoot.dataset.version === ROOT_VERSION) return;
    existingRoot.remove();
  }

  function hasExtensionRuntime() {
    return typeof globalThis.chrome?.runtime?.id === 'string' && chrome.runtime.id.length > 0;
  }

  const ACTIONS = [
    ['catchBeetle', 'Claim Beetle', 'claim-beetle.png'],
    ['beetleHunt', 'Hunt Beetle', 'hunt-beetle.png'],
    ['claimUBC', 'Claim Cheese', 'claim-cheese.png'],
    ['junkFaucet', 'Junk Faucet', 'junk-faucet.png'],
  ];
  const TAB_COOLDOWN_KEYS = ['catchBeetle', 'beetleHunt'];
  const TAB_ICON_URL = chrome.runtime.getURL('beetol/icons/hunt-beetle.png');
  const ACTION_ICON_URLS = Object.fromEntries(ACTIONS.map(([key, _label, icon]) => [
    key,
    chrome.runtime.getURL(`beetol/icons/${icon}`),
  ]));
  const CRUNCH_LOOP_URL = chrome.runtime.getURL('beetol/sounds/ticket-crunch-cell.wav');
  const CRUNCH_CELL_GAIN = 0.624;
  const POSITION_KEY = 'beetol.hunterPosition';
  const COOLDOWN_STATE_KEY = 'beetol.cooldownState';
  const COOLDOWN_STATE_VERSION = 3;
  const FINAL_HUNT_COOLDOWN_MS = BEETLE_HUNT_COOLDOWN_MS;
  const FINAL_HUNT_RESULT_HOLD_MS = 2400;
  const ENABLED_KEY = 'milxdy.remistats.beetol.enabled';
  const SETTINGS_THEME_KEY = 'milxdy.settings.theme';
  const LEGACY_PREFIX = 'bex' + 'tol';
  const LEGACY_ENABLED_KEY = `milxdy.${LEGACY_PREFIX}.enabled`;
  const SNAP_MARGIN = 10;
  const runtimeScheduler = context.scheduler || createFallbackRuntimeScheduler();
  const lifecycleSignal = context.signal || null;
  const appSdkSendMessage = typeof context.sendMessage === 'function' ? context.sendMessage : null;
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
    crunchProgress: null,
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
  let cancelFinalHuntDone = null;
  let messageRevision = 0;
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

  function cancelFinalHuntTransition() {
    cancelFinalHuntDone?.();
    cancelFinalHuntDone = null;
  }

  function scheduleFinalHuntDone() {
    cancelFinalHuntTransition();
    const expectedMessageRevision = messageRevision;
    cancelFinalHuntDone = runtimeScheduler.timeout(() => {
      cancelFinalHuntDone = null;
      if (!lifecycleActive() || messageRevision !== expectedMessageRevision) return;
      setMessage('Done', 'done');
    }, FINAL_HUNT_RESULT_HOLD_MS);
  }
  addDisposable(cancelFinalHuntTransition);

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
            <div id="beetol-user" class="beetol-subtitle">Checking session...</div>
          </div>
          <button id="beetol-refresh" class="beetol-icon-btn" type="button" title="Refresh">&#8635;</button>
          <button id="beetol-minimize" class="beetol-icon-btn" type="button" title="Minimize" aria-label="Minimize">_</button>
        </div>
        <div id="beetol-signed-out" class="beetol-signed-out-msg">
          <a href="https://www.remilia.net/" target="_blank" rel="noopener noreferrer">Sign in</a>
          <span>to RemiliaNET, then retry Beetol.</span>
          <button id="beetol-retry-session" type="button">Retry session</button>
        </div>
        <div id="beetol-actions" class="beetol-actions"></div>
        <button id="beetol-crunch-junk" class="beetol-crunch-junk" type="button">Crunch All Junk</button>
        <div id="beetol-crunch-progress" class="beetol-crunch-progress" hidden>
          <div class="beetol-crunch-progress-track" aria-hidden="true"><span></span></div>
          <span id="beetol-crunch-progress-label"></span>
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
    retrySession: root.querySelector('#beetol-retry-session'),
    actions: root.querySelector('#beetol-actions'),
    crunchJunk: root.querySelector('#beetol-crunch-junk'),
    crunchProgress: root.querySelector('#beetol-crunch-progress'),
    crunchProgressFill: root.querySelector('#beetol-crunch-progress .beetol-crunch-progress-track > span'),
    crunchProgressLabel: root.querySelector('#beetol-crunch-progress-label'),
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
    chrome.storage.local.set({ [POSITION_KEY]: state.position });
  }

  function saveCooldownState() {
    if (!hasExtensionRuntime()) return;
    chrome.storage.local.set({
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

  [TAB_ICON_URL, ...Object.values(ACTION_ICON_URLS)].forEach(preloadIcon);

  let audioContext = null;
  let crunchCellPromise = null;

  function crunchAudioContext() {
    const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AudioContext) return null;
    audioContext ||= new AudioContext();
    return audioContext;
  }

  async function loadCrunchCell() {
    if (!crunchCellPromise) {
      crunchCellPromise = (async () => {
        const context = crunchAudioContext();
        if (!context) throw new Error('Audio unavailable.');
        const response = await fetch(CRUNCH_LOOP_URL);
        if (!response.ok) throw new Error('Crunch sound asset unavailable.');
        return context.decodeAudioData(await response.arrayBuffer());
      })().catch(error => {
        crunchCellPromise = null;
        throw error;
      });
    }
    return crunchCellPromise;
  }

  function warmCrunchAudio() {
    const context = crunchAudioContext();
    context?.resume?.();
    void loadCrunchCell().catch(() => {});
  }

  async function playCrunchCell() {
    const context = crunchAudioContext();
    if (!context) return;
    try {
      context.resume?.();
      const cell = await loadCrunchCell();
      if (!lifecycleActive()) return;
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = cell;
      gain.gain.value = CRUNCH_CELL_GAIN;
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
    } catch {
      // The visual progress flow must still work when the audio asset cannot play.
    }
  }

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

  function playClaimSound() {
    playTone(520, 0.045, 0.024);
    setTimeout(() => playTone(660, 0.055, 0.018), 34);
    setTimeout(() => playTone(880, 0.05, 0.014), 74);
  }

  function playHuntSound() {
    playTone(330, 0.045, 0.038);
    setTimeout(() => playTone(494, 0.07, 0.03), 38);
    setTimeout(() => playTone(392, 0.045, 0.02), 88);
  }

  function playFinalHuntFanfare() {
    [
      [523.25, 0, 0.07],
      [659.25, 62, 0.07],
      [783.99, 124, 0.09],
      [1046.5, 210, 0.18],
    ].forEach(([frequency, delay, duration]) => {
      setTimeout(() => playTone(frequency, duration, 0.038, 'square'), delay);
    });
  }

  function playCheeseClaimSound() {
    playTone(466.16, 0.1, 0.075, 'sawtooth');
    setTimeout(() => playTone(349.23, 0.18, 0.065, 'sawtooth'), 96);
    setTimeout(() => playTone(698.46, 0.15, 0.045, 'triangle'), 232);
  }

  function playJunkClaimSound() {
    playTone(146.83, 0.11, 0.05, 'square');
    playTone(932.33, 0.07, 0.023, 'square');
    setTimeout(() => playTone(1396.91, 0.11, 0.018, 'square'), 18);
  }

  function playActionSound(action = '') {
    if (action === 'catchBeetle' || action === 'claimUBC') {
      playClaimSound();
      return;
    }
    if (action === 'beetleHunt') {
      playHuntSound();
      return;
    }
    playDefaultActionSound();
  }

  function playSuccessfulActionSound(action, finalHunt) {
    if (finalHunt) {
      playFinalHuntFanfare();
      return;
    }
    if (action === 'claimUBC') {
      playCheeseClaimSound();
      return;
    }
    if (action === 'junkFaucet') playJunkClaimSound();
  }

  function celebrateCheeseClaim() {
    const button = els.actions.querySelector('[data-action="claimUBC"]');
    if (!(button instanceof HTMLElement)) return;
    button.dataset.celebrating = 'true';
    button.querySelector('.beetol-cheese-celebration')?.remove();
    const celebration = document.createElement('span');
    celebration.className = 'beetol-cheese-celebration';
    celebration.setAttribute('aria-hidden', 'true');
    for (let index = 0; index < 14; index += 1) {
      const sparkle = document.createElement('i');
      sparkle.style.setProperty('--beetol-burst-x', `${(Math.random() * 90 - 45).toFixed(0)}px`);
      sparkle.style.setProperty('--beetol-burst-y', `${(-28 - Math.random() * 58).toFixed(0)}px`);
      sparkle.style.setProperty('--beetol-burst-delay', `${(Math.random() * 120).toFixed(0)}ms`);
      sparkle.style.setProperty('--beetol-burst-color', ['#ffe479', '#ffffff', '#f7a8d5', '#99e6ff'][index % 4]);
      celebration.append(sparkle);
    }
    button.append(celebration);
    window.setTimeout(() => {
      celebration.remove();
      delete button.dataset.celebrating;
    }, 1500);
  }

  function playCrunchSuccessSound() {
    void playCrunchCell();
  }

  function playCrunchCompleteSound() {
    try {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return;
      audioContext ||= new AudioContext();
      audioContext.resume?.();
      const start = audioContext.currentTime;

      const munches = [620, 780, 980, 760, 1080];
      munches.forEach((frequency, index) => {
        const offset = index * 0.052;
        const duration = 0.045;
        const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < data.length; j += 1) {
          data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
        }
        const source = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();
        filter.type = 'bandpass';
        filter.frequency.value = frequency;
        filter.Q.value = 2.2;
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.2, start + offset + 0.004);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + duration);
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        source.start(start + offset);
      });

      [660, 880, 1320].forEach((frequency, index) => {
        const offset = 0.285 + index * 0.065;
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency, start + offset);
        gain.gain.setValueAtTime(0.0001, start + offset);
        gain.gain.exponentialRampToValueAtTime(0.12, start + offset + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.105);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(start + offset);
        oscillator.stop(start + offset + 0.115);
      });
    } catch {
      // Best-effort UI sound; audio may be blocked or unavailable.
    }
  }

  function fmtMs(ms) {
    if (ms === null || Number.isNaN(ms)) return '--';
    if (ms <= 0) return 'Ready';
    const seconds = Math.ceil(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h) return `${h}h ${String(m).padStart(2, '0')}m`;
    if (m) return `${m}m ${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  }

  function fmtBadgeMs(ms) {
    if (ms === null || Number.isNaN(ms)) return '';
    if (ms <= 0) return '';
    const seconds = Math.ceil(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h) return m ? `${h}h${m}m` : `${h}h`;
    if (m) return `${m}m`;
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
      value === null ? 0 : Math.max(0, value - now),
    ]));
  }

  function itemName(key) {
    return key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());
  }

  function setMessage(text, kind = '') {
    messageRevision += 1;
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
    els.actions.hidden = !state.signedIn;
    els.crunchJunk.hidden = !state.signedIn;
    els.footer.hidden = !state.signedIn;
    els.crunchJunk.disabled = state.loading;
    const progress = state.crunchProgress;
    els.crunchProgress.hidden = !progress;
    if (progress) {
      const total = Math.max(0, Number(progress.total) || 0);
      const processed = Math.min(total, Math.max(0, Number(progress.processed) || 0));
      const percent = total ? Math.round((processed / total) * 100) : 0;
      els.crunchProgressFill.style.width = `${percent}%`;
      const active = progress.phase === 'processing' && processed < total ? ` · crunching ${processed + 1}` : '';
      const skippedPair = progress.lastSkippedPair;
      const skippedDetail = skippedPair ? ` · last skip: ${itemName(skippedPair.slot1)} + ${itemName(skippedPair.slot2)}` : '';
      els.crunchProgressLabel.textContent = `Crunching: ${processed} / ${total}${active} — ${progress.made || 0} cube(s), ${progress.skipped || 0} skipped${skippedDetail}`;
    }

    if (!state.signedIn) {
      els.user.textContent = 'Not signed in';
      els.next.textContent = 'Sign in';
    } else {
      const name = state.user?.username || state.user?.name || state.user?.displayName || 'Signed in';
      els.user.textContent = name;
      const cds = currentCooldowns();
      const tabCooldowns = TAB_COOLDOWN_KEYS.map(key => key === 'beetleHunt' && state.huntCharges <= 0 && cds[key] <= 0 ? null : cds[key]);
      const ready = tabCooldowns.filter(value => value === 0);
      if (ready.length) els.next.textContent = ready.length === 2 ? 'Both ready' : 'Ready';
      else {
        const next = tabCooldowns.filter(value => value !== null && value > 0).sort((a, b) => a - b)[0];
        els.next.textContent = next ? fmtMs(next) : '--';
      }

      els.actions.innerHTML = ACTIONS.map(([key, label, icon]) => {
        const cd = cds[key];
        const readyClass = cd === 0 ? ' is-ready' : '';
        const cooldownClass = cd > 0 ? ' is-cooldown' : '';
        const exhaustedClass = key === 'beetleHunt' && cd <= 0 && state.huntCharges <= 0 ? ' is-exhausted' : '';
        const huntClass = key === 'beetleHunt' ? ' is-hunt' : '';
        const disabled = state.loading || cd > 0 ? ' disabled' : '';
        const iconUrl = ACTION_ICON_URLS[key];
        const cooldownLabel = fmtMs(cd);
        const huntStatus = cd > 0 ? cooldownLabel : `${state.huntCharges}/3`;
        const huntChargeAttr = key === 'beetleHunt' ? ` data-hunt-charges="${state.huntCharges}"` : '';
        const huntFill = key === 'beetleHunt' ? ` style="--beetol-hunt-fill: ${Math.max(0, state.huntCharges) / 3 * 100}%; --beetol-hunt-icon: url('${iconUrl}')"` : '';
        return `
          <button class="beetol-action${readyClass}${cooldownClass}${exhaustedClass}${huntClass}" data-action="${key}" type="button" title="${label}" aria-label="${label}"${disabled}${huntChargeAttr}${huntFill}>
            <span class="beetol-action-icon">
              <img src="${iconUrl}" alt="">
              ${key === 'beetleHunt' ? '<span class="beetol-hunt-fill-icon" aria-hidden="true"></span>' : ''}
            </span>
            <span class="beetol-action-label">${label}</span>
            <strong>${key === 'beetleHunt' ? huntStatus : cooldownLabel}</strong>
          </button>
        `;
      }).join('');
    }

    els.message.textContent = state.message;
    els.message.className = state.messageKind ? `beetol-${state.messageKind}` : '';
    state.appFrame?.updateDock({
      badgeText: dockBadgeText(),
      title: state.signedIn ? `Beetol Game: ${els.next.textContent || ''}` : 'Beetol Game: sign in',
    });
  }

  function dockBadgeText() {
    if (!state.signedIn) return '';
    const cds = currentCooldowns();
    const tabCooldowns = TAB_COOLDOWN_KEYS.map(key => key === 'beetleHunt' && state.huntCharges <= 0 && cds[key] <= 0 ? null : cds[key]);
    const next = tabCooldowns.filter(value => value !== null && value > 0).sort((a, b) => a - b)[0];
    return next ? fmtBadgeMs(next) : '';
  }

  function enterSignedOutState(message) {
    cancelFinalHuntTransition();
    state.signedIn = false;
    state.user = null;
    state.loading = false;
    state.crunchProgress = null;
    setMessage(message, 'warn');
  }

  async function checkAuthStatus(silent = false) {
    if (!lifecycleActive()) return false;
    state.loading = true;
    if (!silent) setMessage('Checking session...');
    render();
    const response = await send({ type: 'beetol:authStatus' });
    if (!lifecycleActive()) return false;
    state.loading = false;
    if (!response?.signedIn) {
      enterSignedOutState(response?.error || 'No RemiliaNET browser session detected.');
      render();
      return false;
    }
    state.signedIn = true;
    setMessage('Session detected.');
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
      enterSignedOutState('Session expired.');
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

  function displayedHuntCharges(button) {
    const value = Number(button?.dataset?.huntCharges);
    return Number.isFinite(value) ? clamp(Math.floor(value), 0, 3) : state.huntCharges;
  }

  function isCooldownMessage(message) {
    return /cool\s*down|try again|not ready|wait/i.test(String(message || ''));
  }

  async function runAction(action, button = null) {
    if (!lifecycleActive()) return;
    cancelFinalHuntTransition();
    const label = ACTIONS.find(([key]) => key === action)?.[1] || action;
    const chargesBeforeAction = action === 'beetleHunt' ? displayedHuntCharges(button) : state.huntCharges;
    if (action === 'beetleHunt') state.huntCharges = chargesBeforeAction;
    state.loading = true;
    setMessage(`${label}...`);
    render();

    const response = await send({ type: 'beetol:action', action });
    if (!lifecycleActive()) return;
    state.loading = false;
    const responseMessage = response?.data?.message || response?.actionResult?.message || response?.error || '';

    if (response?.authRequired) {
      enterSignedOutState('Session expired.');
      render();
      return;
    }
    if (!response?.ok) {
      const cooldownMs = response?.cooldownMs || normalizeCooldownMs(responseMessage);
      if (action === 'beetleHunt' && (chargesBeforeAction <= 1 || isCooldownMessage(responseMessage))) {
        if (cooldownMs > 0) {
          setActionCooldown(action, cooldownMs);
        } else {
          state.huntCharges = 0;
        }
        state.fetchedAt = Date.now();
        saveCooldownState();
        setMessage(cooldownMs > 0 ? `${label} ready in ${fmtMs(cooldownMs)}.` : (responseMessage || `${label}: try again after cooldown.`), 'warn');
      } else {
        setMessage(responseMessage || `${label} failed.`, 'warn');
      }
      render();
      return;
    }
    if (response.actionResult?.success === false) {
      if (response.user) {
        state.user = response.user;
        mergeCooldowns(response.user);
      }
      const cooldownMs = response.cooldownMs || response.actionResult.cooldownMs || currentCooldowns()[action] || 0;
      const message = response.actionResult.message || `${label} failed.`;
      if (cooldownMs > 0) {
        setActionCooldown(action, cooldownMs);
        state.fetchedAt = Date.now();
        saveCooldownState();
        setMessage(`${label} ready in ${fmtMs(cooldownMs)}.`, 'warn');
      } else if (action === 'beetleHunt' && (chargesBeforeAction <= 1 || isCooldownMessage(message))) {
        state.huntCharges = 0;
        state.fetchedAt = Date.now();
        saveCooldownState();
        setMessage(message, 'warn');
      } else {
        setMessage(message, 'warn');
      }
      render();
      if (response.needsRefresh) void reconcileStateAfterAction();
      return;
    }

    if (response.user) {
      state.user = response.user;
      mergeCooldowns(response.user);
    }
    const hasAuthoritativeHuntState = action === 'beetleHunt' && response.user && huntStateFromUser(response.user).hasSignal;
    if (response.cooldownMs > 0) {
      setActionCooldown(action, response.cooldownMs);
    } else if (action === 'beetleHunt' && !hasAuthoritativeHuntState) {
      const nextCharges = clamp(chargesBeforeAction - 1, 0, 3);
      state.huntCharges = nextCharges;
    } else if (action === 'beetleHunt' && chargesBeforeAction <= 1 && currentCooldowns().beetleHunt <= 0) {
      state.huntCharges = 0;
    }
    const finalHunt = action === 'beetleHunt' && state.huntCharges <= 0;
    if (finalHunt && currentCooldowns().beetleHunt <= 0) {
      setActionCooldown('beetleHunt', FINAL_HUNT_COOLDOWN_MS);
    }
    saveCooldownState();

    const gained = (response.gained || []).map(({ key, diff }) => (
      diff > 1 ? `${itemName(key)} x${diff}` : itemName(key)
    ));
    setMessage(gained.length ? `${label}: ${gained.join(', ')}` : `${label}: done.`);
    render();
    playSuccessfulActionSound(action, finalHunt);
    if (action === 'claimUBC') celebrateCheeseClaim();
    if (finalHunt) scheduleFinalHuntDone();
    if (response.needsRefresh) void reconcileStateAfterAction();
  }

  async function reconcileStateAfterAction() {
    const response = await send({ type: 'beetol:getState' });
    if (!lifecycleActive() || !response?.ok || state.loading) return;
    state.user = response.user;
    mergeCooldowns(response.user);
    render();
  }

  async function crunchJunk() {
    if (!lifecycleActive()) return;
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    state.crunchProgress = { runId, total: 0, processed: 0, made: 0, skipped: 0 };
    warmCrunchAudio();
    state.loading = true;
    setMessage('Crunching all junk...');
    render();

    const response = await send({ type: 'beetol:crunchJunk', runId });
    if (!lifecycleActive()) return;
    state.loading = false;

    if (response?.authRequired) {
      enterSignedOutState('Session expired.');
      render();
      return;
    }
    if (!response?.ok) {
      state.crunchProgress = null;
      setMessage(response?.data?.message || response?.error || 'Crunch All Junk failed.', 'warn');
      render();
      return;
    }
    if (response.user) {
      state.user = response.user;
      mergeCooldowns(response.user);
    }
    state.crunchProgress = null;
    if (response.pairs > 0) playCrunchCompleteSound();
    const lastSkippedPair = Array.isArray(response.skippedPairs) ? response.skippedPairs.at(-1) : null;
    const skipped = response.skipped
      ? ` (${response.skipped} skipped${lastSkippedPair ? `; last: ${itemName(lastSkippedPair.slot1)} + ${itemName(lastSkippedPair.slot2)}` : ''})`
      : '';
    setMessage(`Crunch All Junk: made ${response.made}/${response.pairs} Junk Cube(s)${skipped}.`);
    render();
  }

  els.actions.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || state.loading || button.disabled) return;
    playActionSound(button.dataset.action);
    runAction(button.dataset.action, button);
  });

  els.refresh.addEventListener('click', () => {
    playActionSound();
    if (state.signedIn) refreshState();
    else checkAuthStatus();
  });

  els.retrySession?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    playActionSound();
    checkAuthStatus();
  });

  els.minimize?.addEventListener('click', () => {
    state.dockOpen = false;
    applyDockPosition();
    render();
  });

  els.crunchJunk.addEventListener('click', () => {
    if (state.loading) return;
    crunchJunk();
  });

  const crunchProgressListener = message => {
    if (message?.type !== 'beetol:crunchProgress' || message.runId !== state.crunchProgress?.runId) return;
    state.crunchProgress = {
      runId: message.runId,
      total: Math.max(0, Number(message.total) || 0),
      processed: Math.max(0, Number(message.processed) || 0),
      made: Math.max(0, Number(message.made) || 0),
      skipped: Math.max(0, Number(message.skipped) || 0),
      phase: message.phase === 'processing' ? 'processing' : '',
      lastSkippedPair: message.skippedPair?.slot1 && message.skippedPair?.slot2
        ? { slot1: message.skippedPair.slot1, slot2: message.skippedPair.slot2 }
        : state.crunchProgress?.lastSkippedPair || null,
    };
    if (message.phase === 'processing') playCrunchSuccessSound();
    render();
  };
  chrome.runtime.onMessage.addListener(crunchProgressListener);
  addDisposable(() => chrome.runtime.onMessage.removeListener(crunchProgressListener));

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
  chrome.storage.onChanged.addListener(storageListener);
  addDisposable(() => chrome.storage.onChanged.removeListener(storageListener));

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

  chrome.storage.local.get({
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
