const OVERLAY_APP_CHROME_STYLE_ID = "milxdy-overlay-app-chrome-style";
const OVERLAY_APP_OPENING_MS = 150;
const OVERLAY_APP_CLOSING_MS = 130;
const openingTimers = new WeakMap<HTMLElement, number>();
const closingTimers = new WeakMap<HTMLElement, number>();

export function ensureOverlayAppChromeStyles(): void {
  if (document.getElementById(OVERLAY_APP_CHROME_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = OVERLAY_APP_CHROME_STYLE_ID;
  style.textContent = `
    .milxdy-overlay-app-shell {
      --milxdy-overlay-app-surface: #fbfbfb;
      --milxdy-overlay-app-surface-2: #e5e5e5;
      --milxdy-overlay-app-surface-3: #d4d4d4;
      --milxdy-overlay-app-border: #b4b4b4;
      --milxdy-overlay-app-bevel-shadow: #a3a3a3;
      --milxdy-overlay-app-highlight: #ffffff;
      --milxdy-overlay-app-accent: #626bb2;
      --milxdy-overlay-app-title: #171f82;
      --milxdy-overlay-app-text: #19191d;
      --milxdy-overlay-app-muted: rgba(0, 0, 0, 0.58);
      color: var(--milxdy-overlay-app-text);
      font-family: var(--milxdy-font-ui, TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      letter-spacing: 0;
    }

    .milxdy-overlay-app-shell[data-layout-ready="false"] {
      visibility: hidden !important;
    }

    .milxdy-overlay-app-shell[data-overlay-opening="true"] {
      transform-origin: var(--milxdy-overlay-app-transform-origin, top left);
      animation: milxdy-overlay-app-grow-in 150ms ease-out both;
    }

    .milxdy-overlay-app-shell[data-overlay-closing="true"] {
      pointer-events: none !important;
      transform-origin: var(--milxdy-overlay-app-transform-origin, top left);
      animation: milxdy-overlay-app-shrink-out 130ms ease-in both;
    }

    @keyframes milxdy-overlay-app-grow-in {
      from {
        opacity: 0;
        transform: scale(0.96);
      }
      to {
        opacity: 1;
        transform: scale(1);
      }
    }

    @keyframes milxdy-overlay-app-shrink-out {
      from {
        opacity: 1;
        transform: scale(1);
      }
      to {
        opacity: 0;
        transform: scale(0.96);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .milxdy-overlay-app-shell[data-overlay-opening="true"],
      .milxdy-overlay-app-shell[data-overlay-closing="true"] {
        animation: none;
      }
    }

    .milxdy-overlay-app-shell,
    .milxdy-overlay-app-shell *,
    .milxdy-overlay-app-shell *::before,
    .milxdy-overlay-app-shell *::after {
      box-sizing: border-box;
    }

    #milxdy-music-root.milxdy-overlay-app-shell {
      --milxdy-overlay-app-surface: var(--music-surface);
      --milxdy-overlay-app-surface-2: var(--music-body-bg);
      --milxdy-overlay-app-surface-3: var(--music-header-bg);
      --milxdy-overlay-app-border: var(--music-border);
      --milxdy-overlay-app-bevel-shadow: color-mix(in srgb, var(--music-border-dark) 52%, #a3a3a3 48%);
      --milxdy-overlay-app-highlight: var(--music-control-highlight);
      --milxdy-overlay-app-accent: var(--music-accent);
      --milxdy-overlay-app-title: var(--music-link);
      --milxdy-overlay-app-text: var(--music-text);
      --milxdy-overlay-app-muted: var(--music-muted);
    }

    .post-reading-player.milxdy-overlay-app-shell {
      --milxdy-overlay-app-surface: var(--post-reading-surface-1);
      --milxdy-overlay-app-surface-2: var(--post-reading-surface-2);
      --milxdy-overlay-app-surface-3: var(--post-reading-surface-3);
      --milxdy-overlay-app-border: var(--post-reading-border);
      --milxdy-overlay-app-bevel-shadow: #a3a3a3;
      --milxdy-overlay-app-highlight: var(--post-reading-highlight);
      --milxdy-overlay-app-accent: var(--post-reading-accent);
      --milxdy-overlay-app-title: var(--post-reading-link);
      --milxdy-overlay-app-text: var(--post-reading-text);
      --milxdy-overlay-app-muted: var(--post-reading-muted);
    }

    #milxdy-wiki-sidebar-root.milxdy-overlay-app-shell {
      --milxdy-overlay-app-surface: #171922;
      --milxdy-overlay-app-surface-2: #20232e;
      --milxdy-overlay-app-surface-3: #292c38;
      --milxdy-overlay-app-border: rgba(252, 224, 150, 0.32);
      --milxdy-overlay-app-bevel-shadow: rgba(252, 224, 150, 0.28);
      --milxdy-overlay-app-highlight: rgba(255, 255, 255, 0.12);
      --milxdy-overlay-app-accent: #fce096;
      --milxdy-overlay-app-title: #fff2ba;
      --milxdy-overlay-app-text: #eef0ff;
      --milxdy-overlay-app-muted: rgba(238, 240, 255, 0.58);
    }

    #milxdy-wiki-sidebar-root.milxdy-overlay-app-shell[data-theme="light"] {
      --milxdy-overlay-app-surface: #fbfbfb;
      --milxdy-overlay-app-surface-2: #eceef4;
      --milxdy-overlay-app-surface-3: #dde0ea;
      --milxdy-overlay-app-border: #b9bccd;
      --milxdy-overlay-app-bevel-shadow: #a3a7ba;
      --milxdy-overlay-app-highlight: #ffffff;
      --milxdy-overlay-app-accent: #626bb2;
      --milxdy-overlay-app-title: #171f82;
      --milxdy-overlay-app-text: #202336;
      --milxdy-overlay-app-muted: rgba(32, 35, 54, 0.58);
    }

    .miladymaxxer-panel.milxdy-overlay-app-shell {
      --milxdy-overlay-app-surface: var(--miladymaxxer-panel-face);
      --milxdy-overlay-app-surface-2: var(--miladymaxxer-panel-surface);
      --milxdy-overlay-app-surface-3: var(--miladymaxxer-panel-button);
      --milxdy-overlay-app-border: var(--miladymaxxer-panel-outline);
      --milxdy-overlay-app-bevel-shadow: var(--miladymaxxer-panel-border-dark);
      --milxdy-overlay-app-highlight: var(--miladymaxxer-panel-border-light);
      --milxdy-overlay-app-accent: var(--miladymaxxer-panel-accent);
      --milxdy-overlay-app-title: var(--miladymaxxer-panel-title-text);
      --milxdy-overlay-app-text: var(--miladymaxxer-panel-text);
      --milxdy-overlay-app-muted: var(--miladymaxxer-panel-muted);
    }

    .milxdy-overlay-app-card {
      border: 1px solid var(--milxdy-overlay-app-border) !important;
      border-right: 3px solid var(--milxdy-overlay-app-bevel-shadow) !important;
      border-bottom: 4px solid var(--milxdy-overlay-app-bevel-shadow) !important;
      border-radius: 6px !important;
      background:
        linear-gradient(180deg, color-mix(in srgb, var(--milxdy-overlay-app-highlight) 72%, transparent) 0, transparent 44px),
        var(--milxdy-overlay-app-surface) !important;
      box-shadow:
        inset 2px 2px 1px color-mix(in srgb, var(--milxdy-overlay-app-highlight) 78%, transparent),
        4px 4px 0 rgba(0, 0, 0, 0.22) !important;
    }

    .milxdy-overlay-app-card:not(.milxdy-overlay-app-shell) {
      position: relative;
    }

    .milxdy-overlay-app-card::before {
      content: "";
      pointer-events: none;
      position: absolute;
      inset: 0;
      z-index: 0;
      background:
        repeating-linear-gradient(0deg, color-mix(in srgb, var(--milxdy-overlay-app-accent) 5%, transparent), color-mix(in srgb, var(--milxdy-overlay-app-accent) 5%, transparent) 1px, transparent 1px, transparent 8px),
        repeating-linear-gradient(90deg, color-mix(in srgb, var(--milxdy-overlay-app-accent) 3.5%, transparent), color-mix(in srgb, var(--milxdy-overlay-app-accent) 3.5%, transparent) 1px, transparent 1px, transparent 8px);
      opacity: 0.68;
    }

    .milxdy-overlay-app-card > * {
      position: relative;
      z-index: 1;
    }

    .milxdy-overlay-app-header {
      cursor: grab !important;
    }

    .milxdy-overlay-app-shell[data-dragging="true"] .milxdy-overlay-app-header {
      cursor: grabbing !important;
    }

    .milxdy-overlay-app-header strong {
      color: var(--milxdy-overlay-app-title);
      letter-spacing: 0;
      text-shadow: 0 1px 0 color-mix(in srgb, var(--milxdy-overlay-app-highlight) 34%, transparent);
    }

    .milxdy-overlay-app-header span {
      color: var(--milxdy-overlay-app-muted);
    }

    .milxdy-overlay-app-header button {
      border-color: color-mix(in srgb, var(--milxdy-overlay-app-border) 78%, transparent) !important;
      background: color-mix(in srgb, var(--milxdy-overlay-app-surface-3) 82%, var(--milxdy-overlay-app-highlight) 18%) !important;
      box-shadow:
        inset 1px 1px 0 color-mix(in srgb, var(--milxdy-overlay-app-highlight) 64%, transparent),
        inset -1px -1px 0 color-mix(in srgb, var(--milxdy-overlay-app-bevel-shadow) 44%, transparent);
    }
  `;
  document.documentElement.appendChild(style);
}

export function prepareOverlayAppRoot(root: HTMLElement): void {
  cancelOverlayAppClose(root);
  root.dataset.layoutReady = "false";
  root.dataset.overlayOpening = "false";
  root.dataset.overlayClosing = "false";
}

export function markOverlayAppLayoutReady(root: HTMLElement, ready = true): void {
  cancelOverlayAppClose(root);
  if (!ready) {
    root.dataset.layoutReady = "false";
    return;
  }
  const alreadyReady = root.dataset.layoutReady === "true";
  root.dataset.layoutReady = "true";
  if (!alreadyReady) triggerOverlayAppOpening(root);
}

export function animateOverlayAppOpen(root: HTMLElement | null | undefined): void {
  if (!root?.isConnected) return;
  cancelOverlayAppClose(root);
  triggerOverlayAppOpening(root);
}

function triggerOverlayAppOpening(root: HTMLElement): void {
  const existing = openingTimers.get(root);
  if (existing) window.clearTimeout(existing);
  root.dataset.overlayOpening = "false";
  window.requestAnimationFrame(() => {
    if (!root.isConnected || root.dataset.layoutReady !== "true") return;
    root.dataset.overlayOpening = "true";
    const timer = window.setTimeout(() => {
      if (root.dataset.overlayOpening === "true") root.dataset.overlayOpening = "false";
      openingTimers.delete(root);
    }, OVERLAY_APP_OPENING_MS);
    openingTimers.set(root, timer);
  });
}

export function animateOverlayAppClose(root: HTMLElement | null | undefined, afterClose: () => void): void {
  if (!root?.isConnected) {
    afterClose();
    return;
  }
  const existingOpen = openingTimers.get(root);
  if (existingOpen) {
    window.clearTimeout(existingOpen);
    openingTimers.delete(root);
  }
  const existingClose = closingTimers.get(root);
  if (existingClose) window.clearTimeout(existingClose);
  root.dataset.overlayOpening = "false";
  root.dataset.overlayClosing = "true";
  const timer = window.setTimeout(() => {
    closingTimers.delete(root);
    if (root.dataset.overlayClosing === "true") root.dataset.overlayClosing = "false";
    afterClose();
  }, OVERLAY_APP_CLOSING_MS);
  closingTimers.set(root, timer);
}

function cancelOverlayAppClose(root: HTMLElement): void {
  const existing = closingTimers.get(root);
  if (existing) {
    window.clearTimeout(existing);
    closingTimers.delete(root);
  }
  if (root.dataset.overlayClosing === "true") root.dataset.overlayClosing = "false";
}
