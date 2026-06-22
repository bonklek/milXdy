(function mountBeetolGame() {
  if (document.getElementById('beetol-hunter-root')) return;

  function hasExtensionRuntime() {
    return typeof globalThis.chrome?.runtime?.id === 'string' && chrome.runtime.id.length > 0;
  }

  const ACTIONS = [
    ['catchBeetle', 'Claim Beetle', 'claim-beetle.png'],
    ['beetleHunt', 'Hunt Beetle', 'hunt-beetle.png'],
    ['claimUBC', 'Claim Cheese', 'claim-cheese.png'],
    ['junkFaucet', 'Junk Faucet', 'junk-faucet.png'],
  ];
  const TAB_ICON_URL = chrome.runtime.getURL('beetol/icons/hunt-beetle.png');
  const POSITION_KEY = 'beetol.hunterPosition';
  const ENABLED_KEY = 'milxdy.remistats.beetol.enabled';
  const LEGACY_PREFIX = 'bex' + 'tol';
  const LEGACY_ENABLED_KEY = `milxdy.${LEGACY_PREFIX}.enabled`;
  const SNAP_MARGIN = 10;

  const state = {
    enabled: true,
    signedIn: false,
    loading: false,
    settings: {
      color: 'red',
      mode: 'dark',
    },
    user: null,
    fetchedAt: 0,
    cooldowns: {
      catchBeetle: null,
      beetleHunt: null,
      claimUBC: null,
      junkFaucet: null,
    },
    message: '',
    messageKind: '',
    menuSoundArmed: false,
    position: null,
    dragging: null,
  };

  const root = document.createElement('div');
  root.id = 'beetol-hunter-root';
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

  function currentCooldowns() {
    const elapsed = Date.now() - state.fetchedAt;
    return Object.fromEntries(Object.entries(state.cooldowns).map(([key, value]) => [
      key,
      value === null ? null : Math.max(0, value - elapsed),
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
      mode: settings.beetolMode || state.settings.mode || 'dark',
    };
    root.dataset.color = state.settings.color;
    root.dataset.mode = state.settings.mode;
  }

  function mergeCooldowns(user) {
    const elapsed = Date.now() - state.fetchedAt;
    const previous = state.cooldowns;
    const keep = key => previous[key] === null ? null : Math.max(0, previous[key] - elapsed);
    state.fetchedAt = Date.now();
    state.cooldowns = {
      catchBeetle: user?.cooldowns?.catchBeetle ?? keep('catchBeetle'),
      beetleHunt: user?.cooldowns?.beetleHunt ?? keep('beetleHunt'),
      claimUBC: user?.cooldowns?.claimUBC ?? keep('claimUBC'),
      junkFaucet: user?.cooldowns?.junkFaucet ?? keep('junkFaucet'),
    };
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
      const ready = ACTIONS.filter(([key]) => cds[key] === 0);
      if (ready.length) els.next.textContent = `${ready.length} ready`;
      else {
        const next = Object.values(cds).filter(value => value !== null && value > 0).sort((a, b) => a - b)[0];
        els.next.textContent = next ? fmtMs(next) : '--';
      }

      els.actions.innerHTML = ACTIONS.map(([key, label, icon]) => {
        const cd = cds[key];
        const readyClass = cd === 0 ? ' is-ready' : '';
        const disabled = state.loading ? ' disabled' : '';
        const iconUrl = chrome.runtime.getURL(`beetol/icons/${icon}`);
        const cooldownLabel = fmtMs(cd);
        const displayLabel = key === 'beetleHunt' && cd > 0 ? cooldownLabel : label;
        const displayStatus = key === 'beetleHunt' && cd > 0 ? 'Cooldown' : cooldownLabel;
        return `
          <button class="beetol-action${readyClass}" data-action="${key}" type="button" title="${label}" aria-label="${label}"${disabled}>
            <img src="${iconUrl}" alt="">
            <span>${displayLabel}</span>
            <strong>${key === 'beetleHunt' && cd === null ? 'Try once' : displayStatus}</strong>
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

  async function runAction(action) {
    if (!state.enabled) return;
    const label = ACTIONS.find(([key]) => key === action)?.[1] || action;
    state.loading = true;
    setMessage(`${label}...`);
    render();

    const response = await send({ type: 'beetol:action', action });
    state.loading = false;

    if (response?.authRequired) {
      state.signedIn = false;
      setMessage('Session expired.', 'warn');
      render();
      return;
    }
    if (!response?.ok) {
      setMessage(response?.data?.message || response?.error || `${label} failed.`, 'warn');
      render();
      return;
    }
    if (response.actionResult?.success === false) {
      if (response.actionResult.cooldownMs > 0) {
        state.cooldowns[action] = response.actionResult.cooldownMs;
        state.fetchedAt = Date.now();
        setMessage(`${label} ready in ${fmtMs(response.actionResult.cooldownMs)}.`, 'warn');
      } else {
        setMessage(response.actionResult.message || `${label} failed.`, 'warn');
      }
      render();
      return;
    }

    if (response.user) {
      state.user = response.user;
      mergeCooldowns(response.user);
    }

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
    const skipped = response.skipped ? ` (${response.skipped} skipped)` : '';
    setMessage(`Crunch All Junk: made ${response.made}/${response.pairs} Junk Cube(s)${skipped}.`);
    render();
  }

  els.actions.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || state.loading) return;
    playActionSound();
    runAction(button.dataset.action);
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

  setInterval(() => {
    if (state.enabled && !document.hidden) render();
  }, 1000);
  setInterval(() => {
    if (state.enabled && !document.hidden) refreshState(true);
  }, 60_000);

  chrome.storage.local.get({
    beetolColor: 'red',
    beetolMode: 'dark',
    [ENABLED_KEY]: undefined,
    [LEGACY_ENABLED_KEY]: true,
    [POSITION_KEY]: null,
  }).then(settings => {
    state.enabled = (settings[ENABLED_KEY] ?? settings[LEGACY_ENABLED_KEY]) !== false;
    state.position = settings[POSITION_KEY];
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
