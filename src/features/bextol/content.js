(function mountBeXtolHunter() {
  if (document.getElementById('bextol-hunter-root')) return;

  function hasExtensionRuntime() {
    return typeof globalThis.chrome?.runtime?.id === 'string' && chrome.runtime.id.length > 0;
  }

  const ACTIONS = [
    ['catchBeetle', 'Claim Beetle', 'claim-beetle.png'],
    ['beetleHunt', 'Hunt Beetle', 'hunt-beetle.png'],
    ['claimUBC', 'Claim Cheese', 'claim-cheese.png'],
    ['junkFaucet', 'Junk Faucet', 'junk-faucet.png'],
  ];

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
  };

  const root = document.createElement('div');
  root.id = 'bextol-hunter-root';
  root.innerHTML = `
    <div class="bextol-shell" aria-live="polite">
      <button class="bextol-tab" type="button" title="beXtol Hunter">
        <span class="bextol-icon">🪲</span>
        <span id="bextol-next">--</span>
      </button>
      <section class="bextol-panel">
        <div class="bextol-head">
          <div>
            <div class="bextol-title">beXtol Hunter</div>
            <div id="bextol-user" class="bextol-subtitle">Checking session...</div>
          </div>
          <button id="bextol-refresh" class="bextol-icon-btn" type="button" title="Refresh">↻</button>
        </div>
        <div id="bextol-signed-out" class="bextol-signed-out-msg">Open beXtol Hunter from the extensions bar to sign in.</div>
        <div id="bextol-actions" class="bextol-actions"></div>
        <div class="bextol-footer">
          <span id="bextol-message"></span>
        </div>
      </section>
    </div>
  `;
  document.documentElement.appendChild(root);

  const els = {
    next: root.querySelector('#bextol-next'),
    user: root.querySelector('#bextol-user'),
    signedOut: root.querySelector('#bextol-signed-out'),
    actions: root.querySelector('#bextol-actions'),
    message: root.querySelector('#bextol-message'),
    refresh: root.querySelector('#bextol-refresh'),
  };

  function send(message) {
    return chrome.runtime.sendMessage(message);
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
      color: settings.bextolColor || state.settings.color || 'red',
      mode: settings.bextolMode || state.settings.mode || 'dark',
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
    root.classList.toggle('bextol-signed-out', !state.signedIn);
    root.classList.toggle('bextol-loading', state.loading);
    els.signedOut.hidden = state.signedIn;
    els.actions.hidden = !state.signedIn;

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
        const iconUrl = chrome.runtime.getURL(`bextol/icons/${icon}`);
        return `
          <button class="bextol-action${readyClass}" data-action="${key}" type="button" title="${label}" aria-label="${label}"${disabled}>
            <img src="${iconUrl}" alt="">
            <span>${label}</span>
            <strong>${key === 'beetleHunt' && cd === null ? 'Try once' : fmtMs(cd)}</strong>
          </button>
        `;
      }).join('');
    }

    els.message.textContent = state.message;
    els.message.className = state.messageKind ? `bextol-${state.messageKind}` : '';
  }

  async function refreshState(silent = false) {
    if (!state.enabled || document.hidden) return;
    if (!state.signedIn) return;
    state.loading = true;
    if (!silent) setMessage('Refreshing...');
    render();
    const response = await send({ type: 'bextol:getState' });
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

    const response = await send({ type: 'bextol:action', action });
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

  els.actions.addEventListener('click', event => {
    const button = event.target.closest('[data-action]');
    if (!button || state.loading) return;
    runAction(button.dataset.action);
  });

  els.refresh.addEventListener('click', () => refreshState());

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes['milxdy.bextol.enabled']) {
      state.enabled = changes['milxdy.bextol.enabled'].newValue !== false;
      render();
      if (state.enabled && state.signedIn) refreshState(true);
      return;
    }
    applySettings({
      bextolColor: changes.bextolColor?.newValue,
      bextolMode: changes.bextolMode?.newValue,
    });
    if (changes['bextol.accessToken']) {
      state.signedIn = Boolean(changes['bextol.accessToken'].newValue);
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
    bextolColor: 'red',
    bextolMode: 'dark',
    'milxdy.bextol.enabled': true,
  }).then(settings => {
    state.enabled = settings['milxdy.bextol.enabled'] !== false;
    applySettings(settings);
    render();
    if (!state.enabled) return;
    send({ type: 'bextol:authStatus' }).then(response => {
      state.signedIn = Boolean(response?.signedIn);
      render();
      if (state.signedIn) refreshState(true);
    });
  });
  render();
})();

export {};
