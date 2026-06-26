(function mountBeetolGame() {
  const ROOT_VERSION = '2026-06-26-hunt-state-v3';
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
  const HUNT_COOLDOWN_FALLBACK_MS = 60 * 60 * 1000;
  const TAB_ICON_URL = chrome.runtime.getURL('beetol/icons/hunt-beetle.png');
  const POSITION_KEY = 'beetol.hunterPosition';
  const COOLDOWN_STATE_KEY = 'beetol.cooldownState';
  const COOLDOWN_STATE_VERSION = 3;
  const ENABLED_KEY = 'milxdy.remistats.beetol.enabled';
  const SETTINGS_THEME_KEY = 'milxdy.settings.theme';
  const LEGACY_PREFIX = 'bex' + 'tol';
  const LEGACY_ENABLED_KEY = `milxdy.${LEGACY_PREFIX}.enabled`;
  const SNAP_MARGIN = 10;
  const prefersDark = globalThis.matchMedia?.('(prefers-color-scheme: dark)');

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
    dragging: null,
    photoViewerOpen: false,
  };

  const root = document.createElement('div');
  root.id = 'beetol-hunter-root';
  root.dataset.version = ROOT_VERSION;
  root.innerHTML = `
    <div class="beetol-shell" aria-live="polite">
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
          <button id="beetol-refresh" class="beetol-icon-btn" type="button" title="Refresh">â†»</button>
        </div>
        <div id="beetol-signed-out" class="beetol-signed-out-msg">Open Beetol Game from the extensions bar to sign in.</div>
        <div id="beetol-actions" class="beetol-actions"></div>
        <button id="beetol-crunch-junk" class="beetol-crunch-junk" type="button">Crunch All Junk</button>
        <div class="beetol-footer">
          <span id="beetol-message"></span>
        </div>
      </section>
    </div>
  `;
  document.documentElement.appendChild(root);
  root.querySelector('.beetol-icon').innerHTML = `<img src="${TAB_ICON_URL}" alt="">`;
  root.querySelector('#beetol-refresh').textContent = String.fromCharCode(8635);

  const els = {
    shell: root.querySelector('.beetol-shell'),
    panel: root.querySelector('.beetol-panel'),
    head: root.querySelector('.beetol-head'),
    next: root.querySelector('#beetol-next'),
    user: root.querySelector('#beetol-user'),
    signedOut: root.querySelector('#beetol-signed-out'),
    actions: root.querySelector('#beetol-actions'),
    crunchJunk: root.querySelector('#beetol-crunch-junk'),
    message: root.querySelector('#beetol-message'),
    refresh: root.querySelector('#beetol-refresh'),
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
    const next = position || { edge: 'left', x: SNAP_MARGIN, y: SNAP_MARGIN };
    const snapped = snapPosition(next.x, next.y);
    state.position = { edge: next.edge || snapped.edge, x: snapped.x, y: snapped.y };
    root.style.left = `${state.position.x}px`;
    root.style.top = `${state.position.y}px`;
    root.dataset.snap = state.position.edge;
    root.dataset.snapX = state.position.x > window.innerWidth / 2 ? 'right' : 'left';
    root.dataset.snapY = state.position.y > window.innerHeight / 2 ? 'bottom' : 'top';
  }

  function savePosition() {
    if (!hasExtensionRuntime() || !state.position) return;
    chrome.storage.local.set({ [POSITION_KEY]: state.position });
  }

  function saveCooldownState() {
    if (!hasExtensionRuntime()) return;
    chrome.storage.local.set({
      [COOLDOWN_STATE_KEY]: {
        version: COOLDOWN_STATE_VERSION,
        expiresAt: state.cooldownExpiresAt,
        huntCharges: state.huntCharges,
      },
    });
  }

  function send(message) {
    return chrome.runtime.sendMessage(message);
  }

  let audioContext = null;

  function playTone(frequency, duration = 0.08, gain = 0.035) {
    try {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return;
      audioContext ||= new AudioContext();
      const oscillator = audioContext.createOscillator();
      const volume = audioContext.createGain();
      oscillator.type = 'triangle';
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

  function playActionSound() {
    playTone(440, 0.05, 0.03);
    setTimeout(() => playTone(740, 0.08, 0.022), 38);
  }

  function playCrunchSound() {
    try {
      const AudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContext) return;
      audioContext ||= new AudioContext();
      audioContext.resume?.();
      const start = audioContext.currentTime;

      for (let i = 0; i < 7; i += 1) {
        const duration = 0.035 + i * 0.006;
        const buffer = audioContext.createBuffer(1, audioContext.sampleRate * duration, audioContext.sampleRate);
        const data = buffer.getChannelData(0);
        for (let j = 0; j < data.length; j += 1) {
          data[j] = (Math.random() * 2 - 1) * (1 - j / data.length);
        }
        const source = audioContext.createBufferSource();
        const filter = audioContext.createBiquadFilter();
        const gain = audioContext.createGain();
        filter.type = 'bandpass';
        filter.frequency.value = 480 + Math.random() * 780;
        filter.Q.value = 2.8;
        gain.gain.setValueAtTime(0.0001, start + i * 0.055);
        gain.gain.exponentialRampToValueAtTime(0.075, start + i * 0.055 + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + i * 0.055 + duration);
        source.buffer = buffer;
        source.connect(filter);
        filter.connect(gain);
        gain.connect(audioContext.destination);
        source.start(start + i * 0.055);
      }

      [120, 95, 72].forEach((frequency, index) => {
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();
        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, start + index * 0.11);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.62, start + index * 0.11 + 0.09);
        gain.gain.setValueAtTime(0.0001, start + index * 0.11);
        gain.gain.exponentialRampToValueAtTime(0.035, start + index * 0.11 + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + index * 0.11 + 0.1);
        oscillator.connect(gain);
        gain.connect(audioContext.destination);
        oscillator.start(start + index * 0.11);
        oscillator.stop(start + index * 0.11 + 0.11);
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
    return prefersDark?.matches ? 'dark' : 'light';
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
    const cooldownMs = normalizeCooldownMs(cooldown);
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
      needsCooldownFallback: cooldownActive === true || cooldownMessage,
      explicitlyReady: available === true || cooldown === 0,
      explicitlyUnavailable: available === false || cooldownActive === true || charges === 0 || cooldownMs > 0 || cooldownMessage,
    };
  }

  function mergeCooldowns(user) {
    const now = Date.now();
    state.fetchedAt = now;
    const huntState = huntStateFromUser(user);
    for (const key of Object.keys(state.cooldowns)) {
      const cooldown = cooldownFromUser(user, key);
      const cooldownMs = normalizeCooldownMs(cooldown);
      if (cooldownMs > 0 || cooldown === 0) {
        setActionCooldown(key, cooldownMs);
      } else if (state.cooldownExpiresAt[key] !== null && state.cooldownExpiresAt[key] <= now) {
        clearActionCooldown(key);
      }
    }
    if (huntState.explicitlyReady && (state.cooldownExpiresAt.beetleHunt ?? 0) <= now) {
      clearActionCooldown('beetleHunt');
    }
    if (huntState.charges !== null) {
      state.huntCharges = huntState.charges;
    }
    if (huntState.explicitlyUnavailable) {
      const nextCooldown = huntState.cooldownMs || (huntState.needsCooldownFallback ? HUNT_COOLDOWN_FALLBACK_MS : 0);
      if (nextCooldown > 0) {
        setActionCooldown('beetleHunt', nextCooldown);
      } else if ((state.cooldownExpiresAt.beetleHunt ?? 0) <= now) {
        state.huntCharges = 0;
      }
    }
    if ((state.cooldownExpiresAt.beetleHunt ?? 0) > now) {
      state.huntCharges = 0;
    } else if ((state.cooldownExpiresAt.beetleHunt ?? 0) <= now && state.huntCharges <= 0 && huntState.charges !== 0 && !huntState.explicitlyUnavailable) {
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
    const expiresAt = value.expiresAt || {};
    for (const key of Object.keys(state.cooldownExpiresAt)) {
      const expiry = Number(expiresAt[key]);
      state.cooldownExpiresAt[key] = Number.isFinite(expiry) && expiry > Date.now() ? expiry : null;
    }
    const charges = value.version === COOLDOWN_STATE_VERSION ? Number(value.huntCharges) : Number.NaN;
    if (Number.isFinite(charges)) {
      state.huntCharges = clamp(Math.floor(charges), 0, 3);
    } else if ((state.cooldownExpiresAt.beetleHunt ?? 0) <= Date.now()) {
      state.huntCharges = 3;
    }
    if ((state.cooldownExpiresAt.beetleHunt ?? 0) > Date.now()) state.huntCharges = 0;
  }

  function render() {
    if (!hasExtensionRuntime()) {
      root.hidden = true;
      state.enabled = false;
      return;
    }
    root.hidden = !state.enabled;
    if (!state.enabled) return;
    root.classList.toggle('beetol-signed-out', !state.signedIn);
    root.classList.toggle('beetol-loading', state.loading);
    els.head.hidden = !state.signedIn;
    els.signedOut.hidden = state.signedIn;
    els.actions.hidden = !state.signedIn;
    els.crunchJunk.hidden = !state.signedIn;
    els.crunchJunk.disabled = state.loading;

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
        const disabled = state.loading || cd > 0 || exhaustedClass ? ' disabled' : '';
        const iconUrl = chrome.runtime.getURL(`beetol/icons/${icon}`);
        const cooldownLabel = fmtMs(cd);
        const huntStatus = cd > 0 ? cooldownLabel : `${state.huntCharges}/3`;
        const huntChargeAttr = key === 'beetleHunt' ? ` data-hunt-charges="${state.huntCharges}"` : '';
        const huntFill = key === 'beetleHunt' ? ` style="--beetol-hunt-fill: ${Math.max(0, state.huntCharges) / 3 * 100}%"` : '';
        return `
          <button class="beetol-action${readyClass}${cooldownClass}${exhaustedClass}${huntClass}" data-action="${key}" type="button" title="${label}" aria-label="${label}"${disabled}${huntChargeAttr}${huntFill}>
            <span class="beetol-action-icon">
              <img src="${iconUrl}" alt="">
              ${key === 'beetleHunt' ? `<img class="beetol-hunt-fill-icon" src="${iconUrl}" alt="">` : ''}
            </span>
            <span class="beetol-action-label">${label}</span>
            <strong>${key === 'beetleHunt' ? huntStatus : cooldownLabel}</strong>
          </button>
        `;
      }).join('');
    }

    els.message.textContent = state.message;
    els.message.className = state.messageKind ? `beetol-${state.messageKind}` : '';
  }

  async function refreshState(silent = false) {
    if (!state.enabled || document.hidden) return;
    if (!state.signedIn) return;
    state.loading = true;
    if (!silent) setMessage('Refreshing...');
    render();
    const response = await send({ type: 'beetol:getState' });
    state.loading = false;

    if (response?.authRequired) {
      state.signedIn = false;
      setMessage('Session expired.', 'warn');
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
    if (!state.enabled) return;
    const label = ACTIONS.find(([key]) => key === action)?.[1] || action;
    const chargesBeforeAction = action === 'beetleHunt' ? displayedHuntCharges(button) : state.huntCharges;
    if (action === 'beetleHunt') state.huntCharges = chargesBeforeAction;
    state.loading = true;
    setMessage(`${label}...`);
    render();

    const response = await send({ type: 'beetol:action', action });
    state.loading = false;
    const responseMessage = response?.data?.message || response?.actionResult?.message || response?.error || '';

    if (response?.authRequired) {
      state.signedIn = false;
      setMessage('Session expired.', 'warn');
      render();
      return;
    }
    if (!response?.ok) {
      const cooldownMs = response?.cooldownMs || normalizeCooldownMs(responseMessage);
      if (action === 'beetleHunt' && (chargesBeforeAction <= 1 || isCooldownMessage(responseMessage))) {
        const nextCooldown = cooldownMs || HUNT_COOLDOWN_FALLBACK_MS;
        setActionCooldown(action, nextCooldown);
        state.fetchedAt = Date.now();
        saveCooldownState();
        setMessage(`${label} ready in ${fmtMs(nextCooldown)}.`, 'warn');
      } else {
        setMessage(responseMessage || `${label} failed.`, 'warn');
      }
      render();
      return;
    }
    if (response.actionResult?.success === false) {
      const cooldownMs = response.cooldownMs || response.actionResult.cooldownMs || 0;
      const message = response.actionResult.message || `${label} failed.`;
      const cooldownFallback = action === 'beetleHunt' && (chargesBeforeAction <= 1 || isCooldownMessage(message)) ? HUNT_COOLDOWN_FALLBACK_MS : 0;
      if (cooldownMs > 0 || cooldownFallback > 0) {
        const nextCooldown = cooldownMs || cooldownFallback;
        setActionCooldown(action, nextCooldown);
        state.fetchedAt = Date.now();
        saveCooldownState();
        setMessage(`${label} ready in ${fmtMs(nextCooldown)}.`, 'warn');
      } else {
        setMessage(message, 'warn');
      }
      render();
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
      if (nextCharges <= 0) {
        setActionCooldown(action, HUNT_COOLDOWN_FALLBACK_MS);
      } else {
        state.huntCharges = nextCharges;
      }
    }
    saveCooldownState();

    const gained = (response.gained || []).map(({ key, diff }) => (
      diff > 1 ? `${itemName(key)} x${diff}` : itemName(key)
    ));
    setMessage(gained.length ? `${label}: ${gained.join(', ')}` : `${label}: done.`);
    render();
  }

  async function crunchJunk() {
    if (!state.enabled) return;
    state.loading = true;
    setMessage('Crunching all junk...');
    render();

    const response = await send({ type: 'beetol:crunchJunk' });
    state.loading = false;

    if (response?.authRequired) {
      state.signedIn = false;
      setMessage('Session expired.', 'warn');
      render();
      return;
    }
    if (!response?.ok) {
      setMessage(response?.data?.message || response?.error || 'Crunch All Junk failed.', 'warn');
      render();
      return;
    }
    if (response.user) {
      state.user = response.user;
      mergeCooldowns(response.user);
    }
    if (response.made > 0) playCrunchSound();
    const skipped = response.skipped ? ` (${response.skipped} skipped)` : '';
    setMessage(`Crunch All Junk: made ${response.made}/${response.pairs} Junk Cube(s)${skipped}.`);
    render();
  }

  els.actions.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || state.loading || button.disabled) return;
    playActionSound();
    runAction(button.dataset.action, button);
  });

  els.refresh.addEventListener('click', () => {
    playActionSound();
    refreshState();
  });

  els.crunchJunk.addEventListener('click', () => {
    if (state.loading) return;
    playActionSound();
    crunchJunk();
  });

  function startDrag(event) {
    const button = event.target.closest('button');
    if (event.button !== 0 || (button && !button.classList.contains('beetol-tab'))) return;
    const rect = root.getBoundingClientRect();
    state.dragging = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      moved: false,
    };
    root.classList.add('beetol-dragging');
    root.setPointerCapture?.(event.pointerId);
  }

  root.addEventListener('pointerdown', event => {
    if (!event.target.closest('.beetol-tab, .beetol-head, .beetol-signed-out-msg')) return;
    startDrag(event);
  });

  root.addEventListener('pointermove', event => {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) return;
    const width = els.shell.offsetWidth || root.offsetWidth || 156;
    const height = els.shell.offsetHeight || root.offsetHeight || 42;
    const maxX = Math.max(SNAP_MARGIN, window.innerWidth - width - SNAP_MARGIN);
    const maxY = Math.max(SNAP_MARGIN, window.innerHeight - height - SNAP_MARGIN);
    const x = clamp(event.clientX - state.dragging.offsetX, SNAP_MARGIN, maxX);
    const y = clamp(event.clientY - state.dragging.offsetY, SNAP_MARGIN, maxY);
    state.dragging.moved = true;
    state.position = { edge: state.position?.edge || 'left', x, y };
    root.style.left = `${x}px`;
    root.style.top = `${y}px`;
  });

  root.addEventListener('pointerup', event => {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) return;
    const position = snapPosition(
      event.clientX - state.dragging.offsetX,
      event.clientY - state.dragging.offsetY,
    );
    state.dragging = null;
    state.position = position;
    root.classList.remove('beetol-dragging');
    root.releasePointerCapture?.(event.pointerId);
    applyPosition(position);
    savePosition();
  });

  root.addEventListener('pointercancel', event => {
    if (!state.dragging || state.dragging.pointerId !== event.pointerId) return;
    state.dragging = null;
    root.classList.remove('beetol-dragging');
    root.releasePointerCapture?.(event.pointerId);
    applyPosition();
  });

  window.addEventListener('resize', () => {
    applyPosition();
    savePosition();
  });

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

  const photoViewerObserver = new MutationObserver(syncPhotoViewerOffset);
  photoViewerObserver.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener('popstate', syncPhotoViewerOffset);
  window.addEventListener('hashchange', syncPhotoViewerOffset);
  window.setInterval(syncPhotoViewerOffset, 1000);

  els.shell.addEventListener('pointerenter', () => {
    if (state.menuSoundArmed) return;
    state.menuSoundArmed = true;
    playMenuSound();
  });

  els.shell.addEventListener('pointerleave', () => {
    state.menuSoundArmed = false;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
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
    if (changes['beetol.accessToken']) {
      state.signedIn = Boolean(changes['beetol.accessToken'].newValue);
      if (state.signedIn) refreshState(true);
      else {
        state.user = null;
        render();
      }
    } else {
      render();
    }
  });

  prefersDark?.addEventListener?.('change', () => {
    if (state.settings.mode !== 'settings' || state.settings.settingsTheme !== 'system') return;
    root.dataset.mode = resolvedPanelMode();
  });

  setInterval(() => {
    if (state.enabled && !document.hidden) render();
  }, 1000);
  setInterval(() => {
    if (state.enabled && !document.hidden) refreshState(true);
  }, 60_000);

  chrome.storage.local.get({
    beetolColor: 'red',
    beetolMode: 'settings',
    [SETTINGS_THEME_KEY]: 'system',
    [ENABLED_KEY]: undefined,
    [LEGACY_ENABLED_KEY]: true,
    [POSITION_KEY]: null,
    [COOLDOWN_STATE_KEY]: null,
  }).then(settings => {
    state.enabled = (settings[ENABLED_KEY] ?? settings[LEGACY_ENABLED_KEY]) !== false;
    state.position = settings[POSITION_KEY];
    applyStoredCooldownState(settings[COOLDOWN_STATE_KEY]);
    applyPosition();
    applySettings(settings);
    render();
    if (!state.enabled) return;
    send({ type: 'beetol:authStatus' }).then(response => {
      state.signedIn = Boolean(response?.signedIn);
      render();
      if (state.signedIn) refreshState(true);
    });
  });
  render();
})();

export {};
