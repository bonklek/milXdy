const STYLE_ID = "miladymaxxer-style";

export function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) {
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .miladymaxxer-panel {
      --miladymaxxer-panel-face: #1f222a;
      --miladymaxxer-panel-surface: #101218;
      --miladymaxxer-panel-list: #08090d;
      --miladymaxxer-panel-input: #08090d;
      --miladymaxxer-panel-border-light: #454953;
      --miladymaxxer-panel-border-dark: #050608;
      --miladymaxxer-panel-outline: #8f7932;
      --miladymaxxer-panel-title: #081d68;
      --miladymaxxer-panel-title-text: #fff2b8;
      --miladymaxxer-panel-button: #20232b;
      --miladymaxxer-panel-row: #101218;
      --miladymaxxer-panel-row-hover: #1b1d1d;
      --miladymaxxer-panel-line: rgba(191, 151, 38, 0.48);
      --miladymaxxer-panel-text: #f2ecd5;
      --miladymaxxer-panel-muted: rgba(242, 236, 213, 0.62);
      --miladymaxxer-panel-soft: rgba(242, 236, 213, 0.76);
      --miladymaxxer-panel-accent: #f0b72d;
      --miladymaxxer-panel-button-border: rgba(191, 151, 38, 0.52);
      position: fixed;
      top: 16px;
      z-index: 2147483645;
      display: grid;
      grid-template-rows: auto 1fr;
      gap: 8px;
      width: 380px;
      height: 640px;
      max-height: calc(100vh - 32px);
      overflow: auto;
      box-sizing: border-box;
      padding: 10px;
      border: 2px solid var(--miladymaxxer-panel-outline);
      border-radius: 0;
      background: var(--miladymaxxer-panel-face);
      box-shadow:
        inset 2px 2px 0 var(--miladymaxxer-panel-border-light),
        inset -2px -2px 0 var(--miladymaxxer-panel-border-dark),
        8px 8px 0 rgba(0, 0, 0, 0.34);
      color: var(--miladymaxxer-panel-text);
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      user-select: none;
      scrollbar-color: var(--miladymaxxer-panel-outline) var(--miladymaxxer-panel-surface);
    }

    .miladymaxxer-panel[data-side="left"] {
      left: 104px;
      right: auto;
    }

    .miladymaxxer-panel[data-side="right"] {
      right: 104px;
      left: auto;
    }

    html[data-milxdy-x-theme="light"] .miladymaxxer-panel,
    html[data-milxdy-settings-theme="light"] .miladymaxxer-panel,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .miladymaxxer-panel {
      --miladymaxxer-panel-face: #d4d0c8;
      --miladymaxxer-panel-surface: #ece9df;
      --miladymaxxer-panel-list: #ffffff;
      --miladymaxxer-panel-input: #ffffff;
      --miladymaxxer-panel-border-light: #ffffff;
      --miladymaxxer-panel-border-dark: #404040;
      --miladymaxxer-panel-outline: #808080;
      --miladymaxxer-panel-title: #000080;
      --miladymaxxer-panel-title-text: #ffffff;
      --miladymaxxer-panel-button: #d4d0c8;
      --miladymaxxer-panel-row: #ece9df;
      --miladymaxxer-panel-row-hover: #fff6cb;
      --miladymaxxer-panel-line: rgba(64, 64, 64, 0.42);
      --miladymaxxer-panel-text: #101014;
      --miladymaxxer-panel-muted: rgba(16, 16, 20, 0.62);
      --miladymaxxer-panel-soft: rgba(16, 16, 20, 0.74);
      --miladymaxxer-panel-accent: #000080;
      --miladymaxxer-panel-button-border: #808080;
      color: var(--miladymaxxer-panel-text);
      color-scheme: light;
      box-shadow:
        inset 2px 2px 0 var(--miladymaxxer-panel-border-light),
        inset -2px -2px 0 var(--miladymaxxer-panel-border-dark),
        8px 8px 0 rgba(15, 23, 42, 0.18);
    }

    html[data-milxdy-x-theme="dark"] .miladymaxxer-panel,
    html[data-milxdy-x-theme="dim"] .miladymaxxer-panel,
    html[data-milxdy-settings-theme="dark"] .miladymaxxer-panel {
      --miladymaxxer-panel-face: #1f222a;
      --miladymaxxer-panel-surface: #101218;
      --miladymaxxer-panel-list: #08090d;
      --miladymaxxer-panel-input: #08090d;
      --miladymaxxer-panel-border-light: #454953;
      --miladymaxxer-panel-border-dark: #050608;
      --miladymaxxer-panel-outline: #8f7932;
      --miladymaxxer-panel-title: #081d68;
      --miladymaxxer-panel-title-text: #fff2b8;
      --miladymaxxer-panel-button: #20232b;
      --miladymaxxer-panel-row: #101218;
      --miladymaxxer-panel-row-hover: #1b1d1d;
      --miladymaxxer-panel-line: rgba(191, 151, 38, 0.48);
      --miladymaxxer-panel-text: #f2ecd5;
      --miladymaxxer-panel-muted: rgba(242, 236, 213, 0.62);
      --miladymaxxer-panel-soft: rgba(242, 236, 213, 0.76);
      --miladymaxxer-panel-accent: #f0b72d;
      --miladymaxxer-panel-button-border: rgba(191, 151, 38, 0.52);
      color: var(--miladymaxxer-panel-text);
      color-scheme: dark;
    }

    .miladymaxxer-panel-header {
      position: sticky;
      top: 0;
      z-index: 5;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
      min-height: 34px;
      margin: -4px -4px 4px;
      padding: 3px 4px 3px 9px;
      border: 2px solid var(--miladymaxxer-panel-outline);
      background: var(--miladymaxxer-panel-title);
      box-shadow:
        inset 2px 2px 0 var(--miladymaxxer-panel-border-light),
        inset -2px -2px 0 rgba(0, 0, 0, 0.76);
      cursor: grab;
    }

    .miladymaxxer-panel[data-dragging="true"] .miladymaxxer-panel-header {
      cursor: grabbing;
    }

    .miladymaxxer-panel-header div {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .miladymaxxer-panel-header strong {
      color: var(--miladymaxxer-panel-title-text);
      font-size: 16px;
      line-height: 1.1;
    }

    .miladymaxxer-panel-header span,
    .miladymaxxer-panel-section-title span,
    .miladymaxxer-panel-hero span,
    .miladymaxxer-panel-stat span {
      color: var(--miladymaxxer-panel-muted);
      font-size: 11px;
      font-weight: 800;
      line-height: 1.2;
      text-transform: uppercase;
    }

    .miladymaxxer-panel-header button,
    .miladymaxxer-panel-tools button {
      min-height: 30px;
      border: 2px solid var(--miladymaxxer-panel-button-border);
      border-radius: 0;
      background: var(--miladymaxxer-panel-button);
      color: inherit;
      cursor: pointer;
      font: 900 12px/1 inherit;
      box-shadow:
        inset 2px 2px 0 var(--miladymaxxer-panel-border-light),
        inset -2px -2px 0 rgba(0, 0, 0, 0.58);
    }

    .miladymaxxer-panel-header button:active,
    .miladymaxxer-panel-tools button:active {
      box-shadow:
        inset 2px 2px 0 rgba(0, 0, 0, 0.58),
        inset -2px -2px 0 var(--miladymaxxer-panel-border-light);
      transform: translate(1px, 1px);
    }

    .miladymaxxer-panel-hero,
    .miladymaxxer-panel-section {
      display: grid;
      gap: 10px;
      padding: 10px;
      border: 2px solid var(--miladymaxxer-panel-outline);
      border-radius: 0;
      background: var(--miladymaxxer-panel-surface);
      box-shadow:
        inset 1px 1px 0 var(--miladymaxxer-panel-border-dark),
        inset -1px -1px 0 var(--miladymaxxer-panel-border-light);
    }

    html[data-milxdy-x-theme="light"] .miladymaxxer-panel-hero,
    html[data-milxdy-x-theme="light"] .miladymaxxer-panel-section,
    html[data-milxdy-settings-theme="light"] .miladymaxxer-panel-hero,
    html[data-milxdy-settings-theme="light"] .miladymaxxer-panel-section,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .miladymaxxer-panel-hero,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .miladymaxxer-panel-section {
      border-color: var(--miladymaxxer-panel-outline);
      background: var(--miladymaxxer-panel-surface);
    }

    .miladymaxxer-panel-hero > div:first-child {
      display: grid;
      gap: 3px;
    }

    .miladymaxxer-panel-hero strong {
      font-size: 28px;
      line-height: 1;
    }

    .miladymaxxer-panel-hero small,
    .miladymaxxer-panel-account small,
    .miladymaxxer-panel-level small {
      color: var(--miladymaxxer-panel-muted);
      font-size: 11px;
      line-height: 1.25;
    }

    .miladymaxxer-panel-meter {
      height: 8px;
      overflow: hidden;
      border: 1px solid var(--miladymaxxer-panel-border-dark);
      border-radius: 0;
      background: var(--miladymaxxer-panel-list);
      box-shadow:
        inset 1px 1px 0 var(--miladymaxxer-panel-border-dark),
        inset -1px -1px 0 var(--miladymaxxer-panel-border-light);
    }

    .miladymaxxer-panel-meter span {
      display: block;
      height: 100%;
      border-radius: 0;
      background: var(--miladymaxxer-panel-accent);
    }

    .miladymaxxer-panel-grid {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 8px;
    }

    .miladymaxxer-panel-stat {
      display: grid;
      gap: 4px;
      min-width: 0;
      padding: 8px;
      border: 1px solid var(--miladymaxxer-panel-line);
      border-radius: 0;
      background: var(--miladymaxxer-panel-row);
    }

    html[data-milxdy-x-theme="light"] .miladymaxxer-panel-stat,
    html[data-milxdy-settings-theme="light"] .miladymaxxer-panel-stat,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .miladymaxxer-panel-stat {
      background: var(--miladymaxxer-panel-row);
    }

    .miladymaxxer-panel-stat strong {
      overflow: hidden;
      font-size: 16px;
      line-height: 1.1;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .miladymaxxer-panel-section-title {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
    }

    .miladymaxxer-panel-section-title strong {
      font-size: 13px;
      line-height: 1.2;
    }

    .miladymaxxer-panel-tools {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 6px;
    }

    .miladymaxxer-panel-tools input {
      min-width: 0;
      min-height: 30px;
      border: 2px solid var(--miladymaxxer-panel-outline);
      border-radius: 0;
      background: var(--miladymaxxer-panel-input);
      color: inherit;
      font: 700 12px/1 inherit;
      padding: 0 9px;
    }

    html[data-milxdy-x-theme="light"] .miladymaxxer-panel-tools input,
    html[data-milxdy-settings-theme="light"] .miladymaxxer-panel-tools input,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .miladymaxxer-panel-tools input {
      background: var(--miladymaxxer-panel-input);
      border-color: var(--miladymaxxer-panel-outline);
    }

    .miladymaxxer-panel-tools button[data-active="true"] {
      color: var(--miladymaxxer-panel-title-text);
      background: var(--miladymaxxer-panel-title);
      border-color: var(--miladymaxxer-panel-outline);
    }

    .miladymaxxer-panel-list {
      display: grid;
      gap: 0;
      overflow: visible;
      padding: 3px;
      border: 2px solid var(--miladymaxxer-panel-outline);
      background: var(--miladymaxxer-panel-list);
      box-shadow:
        inset 2px 2px 0 var(--miladymaxxer-panel-border-dark),
        inset -2px -2px 0 rgba(255, 244, 207, 0.12);
      scrollbar-color: var(--miladymaxxer-panel-outline) var(--miladymaxxer-panel-surface);
    }

    .miladymaxxer-panel-account {
      display: grid;
      grid-template-columns: 22px 38px minmax(0, 1fr) auto;
      align-items: center;
      gap: 8px;
      min-height: 48px;
      padding: 7px;
      border: 0;
      border-bottom: 1px solid var(--miladymaxxer-panel-line);
      border-radius: 0;
      background: var(--miladymaxxer-panel-row);
      color: inherit;
      text-decoration: none;
    }

    .miladymaxxer-panel-account:hover {
      background: var(--miladymaxxer-panel-row-hover);
    }

    html[data-milxdy-x-theme="light"] .miladymaxxer-panel-account,
    html[data-milxdy-settings-theme="light"] .miladymaxxer-panel-account,
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) .miladymaxxer-panel-account {
      border-color: var(--miladymaxxer-panel-line);
      background: var(--miladymaxxer-panel-row);
    }

    .miladymaxxer-panel-rank {
      color: var(--miladymaxxer-panel-accent);
      font-size: 13px;
      font-weight: 900;
      text-align: center;
    }

    .miladymaxxer-panel-account img,
    .miladymaxxer-panel-avatar-fallback {
      display: grid;
      width: 38px;
      height: 38px;
      place-items: center;
      border: 1px solid var(--miladymaxxer-panel-button-border);
      border-radius: 0;
      background: color-mix(in srgb, var(--miladymaxxer-panel-accent) 16%, transparent);
      color: var(--miladymaxxer-panel-accent);
      font-weight: 900;
      object-fit: cover;
    }

    .miladymaxxer-panel-account-main {
      display: grid;
      gap: 2px;
      min-width: 0;
    }

    .miladymaxxer-panel-account-main strong,
    .miladymaxxer-panel-account-main small {
      overflow: hidden;
      text-overflow: ellipsis;
      overflow-wrap: anywhere;
    }

    .miladymaxxer-panel-account-main strong {
      white-space: normal;
    }

    .miladymaxxer-panel-account-main small {
      white-space: normal;
    }

    .miladymaxxer-panel-level {
      display: grid;
      gap: 2px;
      text-align: right;
      white-space: nowrap;
    }

    .miladymaxxer-panel-level strong {
      color: var(--miladymaxxer-panel-accent);
      font-size: 13px;
      line-height: 1.1;
    }

    .miladymaxxer-panel-empty {
      padding: 14px;
      border: 1px dashed var(--miladymaxxer-panel-line);
      border-radius: 0;
      color: var(--miladymaxxer-panel-muted);
      font-size: 12px;
      text-align: center;
    }

    .miladymaxxer-panel-resize-grip {
      position: absolute;
      z-index: 30 !important;
      right: 0;
      bottom: 0;
      display: block;
      width: 24px;
      height: 24px;
      cursor: nwse-resize !important;
      pointer-events: auto;
      touch-action: none;
    }

    .miladymaxxer-panel-resize-grip::before {
      content: "";
      position: absolute;
      right: 3px;
      bottom: 3px;
      width: 9px;
      height: 9px;
      border-right: 2px solid var(--miladymaxxer-panel-accent);
      border-bottom: 2px solid var(--miladymaxxer-panel-accent);
      opacity: 0.82;
    }

    .miladymaxxer-panel-resize-edge {
      position: absolute;
      z-index: 29 !important;
      display: block;
      border: 0;
      background: transparent;
      pointer-events: auto;
      touch-action: none;
    }

    .miladymaxxer-panel-resize-edge-side {
      top: 0;
      right: 0;
      bottom: 0;
      width: 14px;
      cursor: ew-resize !important;
    }

    .miladymaxxer-panel[data-side="right"] .miladymaxxer-panel-resize-edge-side {
      right: auto;
      left: 0;
    }

    .miladymaxxer-panel[data-side="right"] .miladymaxxer-panel-resize-grip {
      right: auto;
      left: 0;
      cursor: nesw-resize !important;
    }

    .miladymaxxer-panel[data-side="right"] .miladymaxxer-panel-resize-grip::before {
      right: auto;
      left: 3px;
      border-right: 0;
      border-left: 2px solid var(--miladymaxxer-panel-accent);
    }

    .miladymaxxer-panel-resize-edge-bottom {
      right: 0;
      bottom: 0;
      left: 0;
      height: 14px;
      cursor: ns-resize !important;
    }

    @media (max-width: 720px) {
      .miladymaxxer-panel {
        top: 8px;
        right: 8px !important;
        left: 8px !important;
        width: auto;
        height: auto;
        max-width: none !important;
        max-height: calc(100vh - 96px);
      }
    }

    html[data-milxdy-visual-disable-maxxer="true"] [data-miladymaxxer-effect],
    html[data-milxdy-visual-disable-maxxer="true"] [data-miladymaxxer-profile] {
      background: unset !important;
      border-color: unset !important;
      box-shadow: none !important;
      filter: none !important;
      outline: none !important;
      transform: none !important;
      animation: none !important;
    }

    html[data-milxdy-visual-disable-maxxer="true"] [data-miladymaxxer-effect]::before,
    html[data-milxdy-visual-disable-maxxer="true"] [data-miladymaxxer-effect]::after,
    html[data-milxdy-visual-disable-maxxer="true"] [data-miladymaxxer-profile]::before,
    html[data-milxdy-visual-disable-maxxer="true"] [data-miladymaxxer-profile]::after {
      content: none !important;
      display: none !important;
      animation: none !important;
      box-shadow: none !important;
      background: transparent !important;
      border: 0 !important;
    }

    html[data-milxdy-visual-disable-maxxer="true"] [data-miladymaxxer-profile] [aria-label*="Follow"],
    html[data-milxdy-visual-disable-maxxer="true"] [data-miladymaxxer-profile] button[aria-label*="Follow"],
    html[data-milxdy-visual-disable-maxxer="true"] [data-miladymaxxer-effect] [data-testid$="-follow"],
    html[data-milxdy-visual-disable-maxxer="true"] [data-miladymaxxer-effect] button[aria-label*="Follow"] {
      background: unset !important;
      border-color: unset !important;
      box-shadow: none !important;
      color: inherit !important;
      text-shadow: none !important;
      transform: none !important;
      animation: none !important;
    }

    /* Diminish effect - subtle shrink, no margin changes to prevent layout shift */
    /* Milady posts - ensure full opacity on all content */
    [data-miladymaxxer-effect="milady"] [data-testid="tweetPhoto"],
    [data-miladymaxxer-effect="milady"] [data-testid="videoPlayer"],
    [data-miladymaxxer-effect="milady"] [data-testid="card.wrapper"],
    [data-miladymaxxer-effect="milady"] [data-testid="card.layoutLarge.media"] {
      opacity: 1 !important;
    }

    /* Restore full opacity on hover */
    /* Sparkle animation */
    @keyframes milady-sparkle {
      0%, 100% {
        opacity: 0;
        transform: scale(0) rotate(0deg);
      }
      50% {
        opacity: 1;
        transform: scale(1) rotate(180deg);
      }
    }

    @keyframes milady-shimmer {
      0% {
        background-position: -200% 0;
      }
      100% {
        background-position: 200% 0;
      }
    }

    @keyframes milady-catch-pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.6);
      }
      50% {
        box-shadow: 0 0 20px 4px rgba(212, 175, 55, 0.4);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(212, 175, 55, 0);
      }
    }

    @keyframes milady-levelup-pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(255, 215, 0, 0.7);
      }
      40% {
        box-shadow: 0 0 24px 6px rgba(255, 215, 0, 0.5);
      }
      100% {
        box-shadow: 0 0 0 0 rgba(255, 215, 0, 0);
      }
    }

    [data-miladymaxxer-catch-anim="catch"] {
      animation: milady-catch-pulse 0.5s ease-out !important;
    }

    [data-miladymaxxer-catch-anim="levelup"] {
      animation: milady-levelup-pulse 0.6s ease-out !important;
    }

    .miladymaxxer-add-btn {
      display: inline !important;
      padding: 0 !important;
      margin-left: 6px !important;
      border: none !important;
      background: transparent !important;
      color: rgb(113, 118, 123) !important;
      font: inherit !important;
      font-weight: 400 !important;
      cursor: pointer !important;
      opacity: 0.3 !important;
      transition: color 0.15s ease, opacity 0.15s ease !important;
      vertical-align: baseline !important;
    }

    article:hover .miladymaxxer-add-btn {
      opacity: 0.6 !important;
    }

    .miladymaxxer-add-btn:hover {
      opacity: 1 !important;
      color: #d4af37 !important;
    }

    .miladymaxxer-add-btn[data-milady-list-state="remove"] {
      opacity: 0 !important;
    }

    article:hover .miladymaxxer-add-btn[data-milady-list-state="remove"] {
      opacity: 0.5 !important;
    }

    .miladymaxxer-add-btn[data-milady-list-state="remove"]:hover {
      opacity: 1 !important;
      color: rgb(244, 33, 46) !important;
    }

    @keyframes milady-level-flash {
      0% { color: rgb(113, 118, 123); }
      15% { color: #2f4d0c; transform: scale(1.15); }
      40% { color: #3d6510; }
      100% { color: rgb(113, 118, 123); transform: scale(1); }
    }

    .miladymaxxer-level-flash {
      animation: milady-level-flash 1.2s ease-out !important;
    }

    .miladymaxxer-level-inline {
      color: rgb(113, 118, 123) !important;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      font-size: 13px !important;
      font-weight: 400 !important;
      white-space: nowrap !important;
      margin-left: 4px !important;
      display: inline-flex !important;
      flex: 0 1 auto !important;
      max-width: 72px !important;
      min-width: 0 !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      position: relative !important;
      top: -1px !important;
    }

    /* Player level badge — right of logo */
    .miladymaxxer-player-level {
      display: block !important;
      color: #2f4d0c !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
      white-space: nowrap !important;
      margin-top: 4px !important;
      text-align: center !important;
      opacity: 0.6 !important;
      transition: transform 0.3s ease, opacity 0.15s ease !important;
      overflow: visible !important;
    }

    /* Prevent sidebar from clipping logo area */
    h1:has(a[href="/home"]) {
      overflow: visible !important;
    }

    h1:has(a[href="/home"]) a {
      overflow: visible !important;
    }

    .miladymaxxer-player-level:hover {
      opacity: 1 !important;
    }

    html[style*="background-color: rgb(0, 0, 0)"] .miladymaxxer-player-level,
    html[style*="background-color: rgb(22, 24, 28)"] .miladymaxxer-player-level,
    body[style*="background-color: rgb(0, 0, 0)"] .miladymaxxer-player-level,
    body[style*="background-color: rgb(22, 24, 28)"] .miladymaxxer-player-level {
      color: rgba(140, 210, 170, 0.7) !important;
    }

    /* Player profile badge — same layout as milady profile badge */
    .miladymaxxer-player-profile-level {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      margin-left: 8px !important;
      vertical-align: middle !important;
      white-space: nowrap !important;
    }

    /* MILADY effect - gold floating card with depth */
    [data-miladymaxxer-effect="milady"] {
      position: relative !important;
      z-index: 1 !important;
      border-radius: 12px !important;
      margin: 6px 6px 8px !important;
      border: none !important;
      outline: 1px solid rgba(212, 175, 55, 0.4) !important;
      outline-offset: -1px !important;
      overflow: hidden !important;
      box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.1),
        0 8px 24px rgba(212, 175, 55, 0.2),
        inset 0 1px 0 rgba(255, 215, 0, 0.15) !important;
      transition: transform 0.3s ease, box-shadow 0.3s ease !important;
    }

    /* Subtle centered float on hover */
    [data-miladymaxxer-effect="milady"]:hover {
      transform: translateY(-1px) scale(1.003) !important;
      z-index: 10 !important;
      box-shadow:
        0 4px 8px rgba(0, 0, 0, 0.12),
        0 8px 24px rgba(212, 175, 55, 0.28),
        inset 0 1px 0 rgba(255, 215, 0, 0.15) !important;
    }





    /* Faded pink heart and count on milady posts to encourage liking */
    [data-miladymaxxer-effect="milady"] [data-testid="like"] svg {
      color: rgba(249, 24, 128, 0.4) !important;
      transition: color 0.2s ease, transform 0.2s ease !important;
    }

    [data-miladymaxxer-effect="milady"] [data-testid="like"] span {
      color: rgba(249, 24, 128, 0.5) !important;
    }

    [data-miladymaxxer-effect="milady"] [data-testid="like"]:hover svg {
      color: rgba(249, 24, 128, 0.7) !important;
      transform: scale(1.1) !important;
    }

    [data-miladymaxxer-effect="milady"] [data-testid="like"]:hover span {
      color: rgba(249, 24, 128, 0.7) !important;
    }

    /* Hide dislike/downvote button on milady posts */
    [data-miladymaxxer-effect="milady"] [data-testid="downvote"],
    [data-miladymaxxer-effect="milady"] [data-testid="dislike"],
    [data-miladymaxxer-effect="milady"] [aria-label*="Downvote"],
    [data-miladymaxxer-effect="milady"] [aria-label*="downvote"],
    [data-miladymaxxer-effect="milady"] [aria-label*="Dislike"],
    [data-miladymaxxer-effect="milady"] [aria-label*="dislike"] {
      display: none !important;
    }

    /* Silver metallic for milady posts with 0 likes */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"] {
      background: linear-gradient(180deg, rgba(245, 245, 248, 1) 0%, rgba(255, 255, 255, 1) 100%) !important;
      outline-color: rgba(160, 160, 170, 0.4) !important;
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.08),
        0 4px 12px rgba(140, 140, 150, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.8) !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"]::before {
      background:
        linear-gradient(
          135deg,
          rgba(200, 200, 210, 0.2) 0%,
          rgba(230, 230, 235, 0.25) 15%,
          rgba(255, 255, 255, 0) 40%,
          rgba(180, 180, 190, 0.1) 65%,
          rgba(220, 220, 230, 0.2) 85%,
          rgba(192, 192, 200, 0.15) 100%
        ) !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"]::after {
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(220, 220, 230, 0.15) 25%,
        rgba(255, 255, 255, 0.25) 50%,
        rgba(220, 220, 230, 0.15) 75%,
        rgba(255, 255, 255, 0) 100%
      ) !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"] [data-testid="Tweet-User-Avatar"] {
      filter: drop-shadow(0 0 8px rgba(170, 175, 195, 0.5)) !important;
    }

    /* Light mode - explicit override for silver */
    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"],
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"] {
      background: linear-gradient(180deg, rgba(242, 242, 247, 1) 0%, rgba(255, 255, 255, 1) 100%) !important;
      outline-color: rgba(160, 160, 170, 0.4) !important;
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.06),
        0 4px 12px rgba(140, 140, 150, 0.12),
        inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
    }

    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"]::before,
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"]::before {
      background:
        linear-gradient(
          135deg,
          rgba(180, 180, 195, 0.15) 0%,
          rgba(210, 210, 220, 0.2) 15%,
          rgba(255, 255, 255, 0) 40%,
          rgba(170, 170, 185, 0.08) 65%,
          rgba(200, 200, 215, 0.15) 85%,
          rgba(185, 185, 200, 0.1) 100%
        ) !important;
    }

    /* Dark mode - rich silver card */
    /* Dark mode silver (uncaught) */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"] {
      background: linear-gradient(180deg, rgb(24, 25, 30) 0%, rgb(18, 19, 24) 100%) !important;
      outline-color: rgba(110, 115, 140, 0.4) !important;
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.4),
        0 4px 14px rgba(100, 105, 130, 0.06),
        inset 0 1px 0 rgba(140, 145, 170, 0.08) !important;
    }

    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"]::before,
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"]::before {
      background:
        linear-gradient(
          135deg,
          rgba(140, 145, 160, 0.03) 0%,
          rgba(120, 125, 140, 0.02) 25%,
          rgba(255, 255, 255, 0) 50%,
          rgba(120, 125, 140, 0.02) 75%,
          rgba(140, 145, 160, 0.03) 100%
        ) !important;
    }

    /* Mint green card — caught milady with <75 likes (base: subtle but visible) */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"] {
      background: linear-gradient(180deg, rgba(250, 255, 248, 1) 0%, rgba(255, 255, 255, 1) 100%) !important;
      outline-color: rgba(47, 77, 12, 0.25) !important;
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.06),
        0 4px 12px rgba(47, 77, 12, 0.08),
        inset 0 1px 0 rgba(200, 240, 180, 0.3) !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"]::before {
      background:
        linear-gradient(
          135deg,
          rgba(47, 77, 12, 0.03) 0%,
          rgba(100, 160, 60, 0.04) 15%,
          rgba(255, 255, 255, 0) 40%,
          rgba(47, 77, 12, 0.01) 65%,
          rgba(80, 140, 40, 0.03) 85%,
          rgba(47, 77, 12, 0.02) 100%
        ) !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"] [data-testid="Tweet-User-Avatar"] {
      filter: drop-shadow(0 0 8px rgba(47, 77, 12, 0.3)) !important;
    }

    /* Light mode mint (base: subtle but visible) */
    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"],
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"] {
      background: linear-gradient(180deg, rgba(248, 255, 246, 1) 0%, rgba(255, 255, 254, 1) 100%) !important;
      outline-color: rgba(47, 77, 12, 0.25) !important;
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.06),
        0 4px 12px rgba(47, 77, 12, 0.08),
        inset 0 1px 0 rgba(217, 240, 214, 0.35) !important;
    }

    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"]::before,
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"]::before {
      background:
        linear-gradient(
          135deg,
          rgba(47, 77, 12, 0.06) 0%,
          rgba(100, 160, 60, 0.1) 15%,
          rgba(255, 255, 255, 0) 40%,
          rgba(47, 77, 12, 0.03) 65%,
          rgba(80, 140, 40, 0.08) 85%,
          rgba(47, 77, 12, 0.05) 100%
        ) !important;
    }

    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"]::after,
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"]::after {
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(47, 77, 12, 0.04) 25%,
        rgba(232, 245, 224, 0.1) 50%,
        rgba(47, 77, 12, 0.04) 75%,
        rgba(255, 255, 255, 0) 100%
      ) !important;
    }

    /* Dark mode mint */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"] {
      background: linear-gradient(180deg, rgb(12, 30, 16) 0%, rgb(8, 24, 12) 100%) !important;
      outline-color: rgba(60, 140, 50, 0.45) !important;
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.4),
        0 4px 14px rgba(40, 120, 30, 0.1),
        inset 0 1px 0 rgba(80, 160, 55, 0.1) !important;
    }

    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"]::before,
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"]::before {
      background:
        linear-gradient(
          135deg,
          rgba(60, 120, 40, 0.04) 0%,
          rgba(50, 100, 35, 0.02) 25%,
          rgba(255, 255, 255, 0) 50%,
          rgba(50, 100, 35, 0.02) 75%,
          rgba(60, 120, 40, 0.03) 100%
        ) !important;
    }

    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"]::after,
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"]::after {
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(60, 120, 40, 0.03) 25%,
        rgba(100, 160, 70, 0.04) 50%,
        rgba(60, 120, 40, 0.03) 75%,
        rgba(255, 255, 255, 0) 100%
      ) !important;
    }

    /* Dark mode mint liked — noticeably richer */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"][data-miladymaxxer-liked="true"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"][data-miladymaxxer-liked="true"] {
      background: linear-gradient(180deg, rgb(14, 36, 18) 0%, rgb(10, 30, 14) 100%) !important;
      outline-color: rgba(55, 150, 45, 0.55) !important;
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.4),
        0 4px 16px rgba(40, 130, 30, 0.12),
        inset 0 1px 0 rgba(80, 170, 55, 0.12) !important;
    }

    /* Dark mode gold liked — clean step up, no gradient shine */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-liked="true"]:not([data-miladymaxxer-mint="true"]):not([data-miladymaxxer-uncaught="true"]):not([data-miladymaxxer-diamond="true"]),
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-liked="true"]:not([data-miladymaxxer-mint="true"]):not([data-miladymaxxer-uncaught="true"]):not([data-miladymaxxer-diamond="true"]) {
      background: linear-gradient(180deg, rgb(36, 30, 16) 0%, rgb(28, 23, 12) 100%) !important;
      outline-color: rgba(160, 135, 50, 0.5) !important;
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.4),
        0 4px 16px rgba(120, 100, 30, 0.08),
        inset 0 1px 0 rgba(160, 135, 50, 0.08) !important;
    }

    /* Mint avatar glow — green instead of gold */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"] [data-testid="Tweet-User-Avatar"] {
      filter: drop-shadow(0 0 6px rgba(47, 77, 12, 0.3)) !important;
    }

    /* Mint shimmer override — green tint instead of gold */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"]::after {
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(47, 77, 12, 0.06) 25%,
        rgba(232, 245, 224, 0.12) 50%,
        rgba(47, 77, 12, 0.06) 75%,
        rgba(255, 255, 255, 0) 100%
      ) !important;
    }

    /* Mint liked — noticeably green */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"][data-miladymaxxer-liked="true"] {
      background: linear-gradient(180deg, rgba(240, 252, 236, 1) 0%, rgba(250, 255, 248, 1) 100%) !important;
      outline-color: rgba(47, 77, 12, 0.22) !important;
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.04),
        0 4px 12px rgba(47, 77, 12, 0.07),
        inset 0 1px 0 rgba(200, 240, 180, 0.35) !important;
    }

    /* Light mode mint liked — noticeably green */
    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"][data-miladymaxxer-liked="true"],
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"][data-miladymaxxer-liked="true"] {
      background: linear-gradient(180deg, rgba(240, 252, 236, 1) 0%, rgba(250, 255, 248, 1) 100%) !important;
      outline-color: rgba(47, 77, 12, 0.22) !important;
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.04),
        0 4px 12px rgba(47, 77, 12, 0.07),
        inset 0 1px 0 rgba(200, 240, 180, 0.35) !important;
    }

    /* Enhanced gold for posts user has liked - 20% more gold (only non-mint/non-uncaught) */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-liked="true"]:not([data-miladymaxxer-mint="true"]):not([data-miladymaxxer-uncaught="true"]):not([data-miladymaxxer-diamond="true"]) {
      box-shadow:
        0 2px 6px rgba(184, 134, 11, 0.12),
        0 4px 18px rgba(212, 175, 55, 0.2),
        inset 0 1px 0 rgba(255, 215, 0, 0.25) !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-liked="true"]:not([data-miladymaxxer-mint="true"]):not([data-miladymaxxer-uncaught="true"]):not([data-miladymaxxer-diamond="true"])::before {
      background:
        linear-gradient(
          135deg,
          rgba(212, 175, 55, 0.1) 0%,
          rgba(255, 223, 100, 0.12) 15%,
          rgba(255, 255, 255, 0) 40%,
          rgba(212, 175, 55, 0.05) 65%,
          rgba(255, 215, 0, 0.1) 85%,
          rgba(184, 134, 11, 0.06) 100%
        ) !important;
    }

    /* Dark mode: kill the liked gold sheen entirely — let bg/outline carry it */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-liked="true"]::before,
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-liked="true"]::before {
      background: none !important;
    }

    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-liked="true"]::after,
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-liked="true"]::after {
      background: none !important;
      animation: none !important;
    }

    /* Light mode liked - richer gold (gold only) */
    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-liked="true"]:not([data-miladymaxxer-mint="true"]):not([data-miladymaxxer-uncaught="true"]):not([data-miladymaxxer-diamond="true"]),
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-liked="true"]:not([data-miladymaxxer-mint="true"]):not([data-miladymaxxer-uncaught="true"]):not([data-miladymaxxer-diamond="true"]) {
      background: linear-gradient(180deg, rgba(255, 249, 228, 1) 0%, rgba(255, 254, 245, 1) 100%) !important;
      outline-color: rgba(212, 175, 55, 0.3) !important;
      box-shadow:
        0 2px 4px rgba(184, 134, 11, 0.08),
        0 4px 12px rgba(212, 175, 55, 0.12),
        inset 0 1px 0 rgba(255, 223, 100, 0.3) !important;
    }

    /* Diamond tier - 150+ likes */
    @keyframes milady-diamond-shimmer {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }

    @keyframes milady-diamond-streak {
      0% { transform: translateX(-100%) skewX(-15deg); opacity: 0; }
      3% { opacity: 1; }
      25% { opacity: 1; }
      30% { transform: translateX(300%) skewX(-15deg); opacity: 0; }
      100% { transform: translateX(300%) skewX(-15deg); opacity: 0; }
    }

    /* Diamond light mode */
    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"],
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"] {
      background: linear-gradient(135deg, #f2f4ff 0%, #e8ecff 20%, #f6f7ff 40%, #e4e9ff 60%, #f2f4ff 80%, #e8ecff 100%) !important;
      background-size: 300% 300% !important;
      animation: milady-diamond-shimmer 4s ease infinite !important;
      outline-color: rgba(130, 160, 230, 0.35) !important;
      border: none !important;
      box-shadow:
        0 4px 12px rgba(80, 120, 200, 0.08),
        0 8px 24px rgba(100, 140, 220, 0.06),
        inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
    }

    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"]::before,
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"]::before {
      background: linear-gradient(
        135deg,
        rgba(180, 200, 255, 0.4) 0%,
        rgba(220, 230, 255, 0.2) 30%,
        rgba(255, 255, 255, 0.6) 50%,
        rgba(200, 215, 255, 0.2) 70%,
        rgba(180, 200, 255, 0.35) 100%
      ) !important;
    }

    /* Diamond light streak (::after) */
    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"]::after,
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"]::after {
      content: "" !important;
      position: absolute !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      border-radius: inherit !important;
      pointer-events: none !important;
      z-index: 1 !important;
      background: linear-gradient(
        105deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 255, 255, 0) 35%,
        rgba(200, 220, 255, 0.25) 45%,
        rgba(255, 255, 255, 0.4) 50%,
        rgba(200, 220, 255, 0.25) 55%,
        rgba(255, 255, 255, 0) 65%,
        rgba(255, 255, 255, 0) 100%
      ) !important;
      animation: milady-diamond-streak 8s ease-in-out infinite !important;
    }

    /* Diamond dark mode */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"] {
      background: linear-gradient(135deg, rgb(14, 16, 32) 0%, rgb(18, 22, 42) 20%, rgb(14, 16, 32) 40%, rgb(20, 26, 48) 60%, rgb(14, 16, 32) 80%, rgb(18, 22, 42) 100%) !important;
      background-size: 300% 300% !important;
      animation: milady-diamond-shimmer 4s ease infinite !important;
      outline-color: rgba(90, 120, 200, 0.4) !important;
      border: none !important;
      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.5),
        0 8px 32px rgba(60, 90, 180, 0.1),
        inset 0 1px 0 rgba(100, 140, 220, 0.1) !important;
    }

    /* Diamond liked — light mode richer */
    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"][data-miladymaxxer-liked="true"],
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"][data-miladymaxxer-liked="true"] {
      background: linear-gradient(135deg, #e4e9ff 0%, #d4dcff 20%, #eef1ff 40%, #d0d8ff 60%, #e4e9ff 80%, #d4dcff 100%) !important;
      outline-color: rgba(100, 140, 220, 0.45) !important;
      box-shadow:
        0 4px 12px rgba(80, 120, 200, 0.12),
        0 8px 24px rgba(100, 140, 220, 0.1),
        inset 0 1px 0 rgba(255, 255, 255, 0.9) !important;
    }

    /* Diamond liked — dark mode richer */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"][data-miladymaxxer-liked="true"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"][data-miladymaxxer-liked="true"] {
      background: linear-gradient(135deg, rgb(16, 20, 42) 0%, rgb(22, 28, 55) 20%, rgb(16, 20, 42) 40%, rgb(26, 34, 60) 60%, rgb(16, 20, 42) 80%, rgb(22, 28, 55) 100%) !important;
      outline-color: rgba(90, 130, 220, 0.55) !important;
      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.5),
        0 8px 32px rgba(60, 100, 200, 0.14),
        inset 0 1px 0 rgba(120, 160, 240, 0.14) !important;
    }

    /* Diamond avatar glow */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"] [data-testid="Tweet-User-Avatar"] {
      filter: drop-shadow(0 0 10px rgba(100, 150, 255, 0.4)) drop-shadow(0 0 20px rgba(120, 160, 240, 0.15)) !important;
    }

    /* Diamond border shimmer on hover */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"]:hover {
      box-shadow:
        0 6px 20px rgba(80, 120, 200, 0.25),
        0 12px 40px rgba(100, 140, 220, 0.15),
        0 0 30px rgba(130, 170, 255, 0.12) !important;
    }

    /* Milady DMs / groupchat messages */
    [data-miladymaxxer-effect="milady-dm"] {
      position: relative !important;
    }

    /* Style the bubble itself, not the full-width DM row — green theme */
    [data-miladymaxxer-effect="milady-dm"] [data-testid^="message-text-"] {
      position: relative !important;
      border-radius: 18px !important;
      outline: 1px solid rgba(47, 77, 12, 0.2) !important;
      outline-offset: -1px !important;
      background: linear-gradient(180deg, rgba(248, 255, 246, 0.8) 0%, rgba(255, 255, 255, 0.85) 100%) !important;
      box-shadow:
        0 4px 14px rgba(47, 77, 12, 0.06),
        0 8px 24px rgba(47, 77, 12, 0.04) !important;
      overflow: hidden !important;
    }

    [data-miladymaxxer-effect="milady-dm"] [data-testid^="message-text-"] > * {
      position: relative !important;
      z-index: 1 !important;
    }

    [data-miladymaxxer-effect="milady-dm"] [data-testid^="message-text-"]::before {
      content: "" !important;
      position: absolute !important;
      inset: 0 !important;
      border-radius: inherit !important;
      background: linear-gradient(
        135deg,
        rgba(47, 77, 12, 0.06) 0%,
        rgba(100, 160, 60, 0.03) 30%,
        rgba(255, 255, 255, 0) 60%,
        rgba(47, 77, 12, 0.04) 100%
      ) !important;
      pointer-events: none !important;
      z-index: 0 !important;
    }

    /* Keep the sender avatar a little brighter to match highlighted bubbles. */
    [data-miladymaxxer-effect="milady-dm"] img[src*="profile_images"] {
      filter:
        contrast(1.08)
        saturate(1.2)
        brightness(1.04)
        drop-shadow(0 0 6px rgba(47, 77, 12, 0.2)) !important;
    }

    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady-dm"] [data-testid^="message-text-"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady-dm"] [data-testid^="message-text-"] {
      background: linear-gradient(180deg, rgba(14, 26, 16, 0.9) 0%, rgba(10, 20, 12, 0.92) 100%) !important;
      outline-color: rgba(60, 120, 40, 0.3) !important;
      box-shadow:
        0 4px 16px rgba(0, 0, 0, 0.35),
        0 8px 28px rgba(40, 100, 25, 0.08) !important;
    }

    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady-dm"] [data-testid^="message-text-"]::before,
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady-dm"] [data-testid^="message-text-"]::before {
      background: linear-gradient(
        135deg,
        rgba(47, 77, 12, 0.05) 0%,
        rgba(40, 65, 15, 0.02) 30%,
        rgba(255, 255, 255, 0) 60%,
        rgba(47, 77, 12, 0.03) 100%
      ) !important;
    }

    /* Milady user cells (follow recommendations) — green theme, override gold */
    [data-miladymaxxer-effect="milady"][data-testid="UserCell"],
    [data-miladymaxxer-effect="milady"][data-testid="user-cell"] {
      margin: 4px 4px 8px !important;
      padding: 10px 12px !important;
      border-radius: 12px !important;
      background: linear-gradient(180deg, rgba(244, 255, 238, 1) 0%, rgba(255, 255, 255, 1) 100%) !important;
      outline-color: rgba(47, 77, 12, 0.2) !important;
      box-shadow:
        0 2px 4px rgba(0, 0, 0, 0.04),
        0 4px 12px rgba(47, 77, 12, 0.06),
        inset 0 1px 0 rgba(200, 240, 180, 0.3) !important;
      overflow: visible !important;
    }

    /* Reset child negative margins for user cells */
    [data-miladymaxxer-effect="milady"][data-testid="UserCell"] > *,
    [data-miladymaxxer-effect="milady"][data-testid="user-cell"] > * {
      margin-left: 0 !important;
      margin-right: 0 !important;
    }

    /* Green overlays for user cells — override gold sheen/shimmer */
    [data-miladymaxxer-effect="milady"][data-testid="UserCell"]::before,
    [data-miladymaxxer-effect="milady"][data-testid="user-cell"]::before {
      background:
        linear-gradient(
          135deg,
          rgba(47, 77, 12, 0.03) 0%,
          rgba(100, 160, 60, 0.04) 15%,
          rgba(255, 255, 255, 0) 40%,
          rgba(47, 77, 12, 0.02) 65%,
          rgba(80, 140, 40, 0.03) 85%,
          rgba(47, 77, 12, 0.02) 100%
        ) !important;
      animation: none !important;
    }

    [data-miladymaxxer-effect="milady"][data-testid="UserCell"]::after,
    [data-miladymaxxer-effect="milady"][data-testid="user-cell"]::after {
      background: none !important;
      animation: none !important;
    }

    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-testid="UserCell"],
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-testid="user-cell"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-testid="UserCell"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-testid="user-cell"] {
      background: linear-gradient(180deg, rgb(12, 22, 18) 0%, rgb(8, 16, 13) 100%) !important;
      outline-color: rgba(100, 180, 140, 0.3) !important;
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.3),
        0 4px 14px rgba(80, 160, 120, 0.06),
        inset 0 1px 0 rgba(140, 210, 170, 0.08) !important;
    }

    /* Silver Follow button for miladys (they don't follow you, plain Follow) */
    /* Exclude: Following/unfollow buttons, Follow back buttons */
    [data-miladymaxxer-effect="milady"] [data-testid$="-follow"]:not([data-testid*="unfollow"]):not([aria-label*="back"]):not([aria-label*="Following"]),
    [data-miladymaxxer-effect="milady"] button[aria-label="Follow"]:not([aria-label*="back"]) {
      background: linear-gradient(135deg, #a8a8a8 0%, #d0d0d0 50%, #a8a8a8 100%) !important;
      background-size: 200% 200% !important;
      border: 1px solid rgba(128, 128, 128, 0.5) !important;
      color: #1a1a1a !important;
      font-weight: 700 !important;
      box-shadow:
        0 2px 6px rgba(100, 100, 100, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.5) !important;
      transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease !important;
    }

    /* Gold Follow Back button for miladys (they follow you!) */
    [data-miladymaxxer-effect="milady"] [aria-label*="Follow back"],
    [data-miladymaxxer-effect="milady"] button[aria-label*="Follow back"] {
      background: linear-gradient(135deg, #d4af37 0%, #f0c850 50%, #d4af37 100%) !important;
      background-size: 200% 200% !important;
      animation: milady-shimmer 3s ease-in-out infinite !important;
      border: 1px solid rgba(184, 134, 11, 0.5) !important;
      color: #1a1a1a !important;
      font-weight: 700 !important;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3) !important;
      box-shadow:
        0 2px 8px rgba(212, 175, 55, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
      transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease !important;
    }

    [data-miladymaxxer-effect="milady"] [aria-label*="Follow back"]:hover,
    [data-miladymaxxer-effect="milady"] button[aria-label*="Follow back"]:hover {
      transform: scale(1.05) !important;
      box-shadow:
        0 4px 16px rgba(212, 175, 55, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.5) !important;
    }

    /* Silver button text */
    [data-miladymaxxer-effect="milady"] [data-testid$="-follow"]:not([data-testid*="unfollow"]):not([aria-label*="back"]) span,
    [data-miladymaxxer-effect="milady"] button[aria-label="Follow"] span {
      color: #1a1a1a !important;
    }

    /* Gold button text */
    [data-miladymaxxer-effect="milady"] [aria-label*="Follow back"] span {
      color: #1a1a1a !important;
    }

    /* ===== PROFILE PAGE STYLING ===== */

    /* Gold rim and glow around milady profile avatar */
    [data-miladymaxxer-profile="milady"] a[href*="/photo"] img {
      border: 3px solid #d4af37 !important;
      box-shadow: 0 0 16px rgba(212, 175, 55, 0.4), 0 0 32px rgba(212, 175, 55, 0.15) !important;
    }

    /* Subtle gold border on the header photo */
    [data-miladymaxxer-profile="milady"] a[href$="/header_photo"] {
      outline: 1px solid rgba(212, 175, 55, 0.25) !important;
      outline-offset: -1px !important;
    }

    /* Profile level badge — inline after @handle */
    .miladymaxxer-profile-level {
      display: inline-flex !important;
      align-items: center !important;
      gap: 6px !important;
      margin-left: 8px !important;
      vertical-align: middle !important;
      white-space: nowrap !important;
      cursor: pointer !important;
      z-index: 100 !important;
    }

    .miladymaxxer-profile-level {
      pointer-events: auto !important;
      cursor: pointer !important;
    }

    .miladymaxxer-profile-level-typewriter {
      display: inline !important;
      color: #2f4d0c !important;
      font-size: 10px !important;
      font-weight: 600 !important;
      letter-spacing: 1px !important;
      white-space: nowrap !important;
      opacity: 0 !important;
      transition: opacity 0.3s ease !important;
      margin-left: 6px !important;
    }

    .miladymaxxer-profile-level-pill {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 2px 10px !important;
      margin-right: 6px !important;
      border-radius: 10px !important;
      background: linear-gradient(135deg, #4a7a28 0%, #5d9432 50%, #4a7a28 100%) !important;
      color: #f4ffee !important;
      font-size: 12px !important;
      font-weight: 700 !important;
      text-shadow: 0 1px 0 rgba(0, 0, 0, 0.2) !important;
      white-space: nowrap !important;
      line-height: 1.4 !important;
    }

    .miladymaxxer-profile-level-pill-grey {
      background: linear-gradient(135deg, #888 0%, #aaa 50%, #888 100%) !important;
      color: #fff !important;
      text-shadow: none !important;
    }

    .miladymaxxer-profile-level-xp {
      display: inline-flex !important;
      align-items: center !important;
      gap: 4px !important;
      color: rgb(113, 118, 123) !important;
      font-size: 11px !important;
      white-space: nowrap !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    }

    /* Gold accent on the "Follows you" badge and handle area */
    [data-miladymaxxer-profile="milady"] [data-testid="userFollowIndicator"] {
      border-color: rgba(212, 175, 55, 0.3) !important;
    }


    /* Gold Follow back button on profile pages */
    [data-miladymaxxer-profile="milady"] [aria-label*="Follow back"],
    [data-miladymaxxer-profile="milady"] button[aria-label*="Follow back"] {
      background: linear-gradient(135deg, #d4af37 0%, #f0c850 50%, #d4af37 100%) !important;
      background-size: 200% 200% !important;
      animation: milady-shimmer 3s ease-in-out infinite !important;
      border: 1px solid rgba(184, 134, 11, 0.5) !important;
      color: #1a1a1a !important;
      font-weight: 700 !important;
      text-shadow: 0 1px 0 rgba(255, 255, 255, 0.3) !important;
      box-shadow:
        0 2px 8px rgba(212, 175, 55, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.4) !important;
      transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease !important;
    }

    [data-miladymaxxer-profile="milady"] [aria-label*="Follow back"]:hover,
    [data-miladymaxxer-profile="milady"] button[aria-label*="Follow back"]:hover {
      transform: scale(1.05) !important;
      box-shadow:
        0 4px 16px rgba(212, 175, 55, 0.6),
        inset 0 1px 0 rgba(255, 255, 255, 0.5) !important;
    }

    [data-miladymaxxer-profile="milady"] [aria-label*="Follow back"] span {
      color: #1a1a1a !important;
    }

    /* Silver Follow button on profile pages (they don't follow you) */
    [data-miladymaxxer-profile="milady"] [data-testid$="-follow"]:not([aria-label*="back"]):not([aria-label*="Following"]),
    [data-miladymaxxer-profile="milady"] button[aria-label="Follow"] {
      background: linear-gradient(135deg, #a8a8a8 0%, #d0d0d0 50%, #a8a8a8 100%) !important;
      background-size: 200% 200% !important;
      border: 1px solid rgba(128, 128, 128, 0.5) !important;
      color: #1a1a1a !important;
      font-weight: 700 !important;
      box-shadow:
        0 2px 6px rgba(100, 100, 100, 0.3),
        inset 0 1px 0 rgba(255, 255, 255, 0.5) !important;
      transition: transform 0.2s ease, background-color 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease, color 0.2s ease !important;
    }

    [data-miladymaxxer-profile="milady"] [data-testid$="-follow"]:not([aria-label*="back"]):not([aria-label*="Following"]):hover,
    [data-miladymaxxer-profile="milady"] button[aria-label="Follow"]:hover {
      transform: scale(1.05) !important;
      box-shadow:
        0 4px 12px rgba(100, 100, 100, 0.4),
        inset 0 1px 0 rgba(255, 255, 255, 0.6) !important;
    }

    /* "You might like" section - add spacing between user cells */
    [data-miladymaxxer-effect="milady"][data-testid="UserCell"],
    [data-miladymaxxer-effect="milady"][data-testid="user-cell"] {
      margin: 4px 4px 8px 4px !important;
      padding: 8px !important;
      border-radius: 12px !important;
    }

    /* ===== END PROFILE PAGE STYLING ===== */


    /* Adjacent milady cards — tighter spacing */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-adjacent-below="true"] {
      margin-bottom: 3px !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-adjacent-above="true"] {
      margin-top: 0 !important;
    }

    /* ===== EDGE FADE ===== */
    /* Mask only the ::before and ::after overlays — tweet content and connector lines stay visible */

    /* Fade top edge — square top corners, fade side borders at top */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="top"],
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="top"]::before,
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="top"]::after {
      border-top-left-radius: 0 !important;
      border-top-right-radius: 0 !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="top"] {
      margin-top: 3px !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="top"]::before,
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="top"]::after {
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 5%) !important;
      mask-image: linear-gradient(to bottom, transparent 0%, black 5%) !important;
    }

    /* Fade both edges — square all corners */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="both"],
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="both"]::before,
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="both"]::after {
      border-radius: 0 !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="both"] {
      margin-top: 3px !important;
      margin-bottom: 3px !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="both"]::before,
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="both"]::after {
      -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%) !important;
      mask-image: linear-gradient(to bottom, transparent 0%, black 5%, black 95%, transparent 100%) !important;
    }

    /* Fade bottom edge — square bottom corners */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="bottom"],
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="bottom"]::before,
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="bottom"]::after {
      border-bottom-left-radius: 0 !important;
      border-bottom-right-radius: 0 !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="bottom"] {
      margin-bottom: 3px !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="bottom"]::before,
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade="bottom"]::after {
      -webkit-mask-image: linear-gradient(to bottom, black 95%, transparent 100%) !important;
      mask-image: linear-gradient(to bottom, black 95%, transparent 100%) !important;
    }


    /* Hover: remove fade, restore rounded corners */
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade]:hover,
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade]:hover::before,
    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade]:hover::after {
      border-radius: 12px !important;
      -webkit-mask-image: none !important;
      mask-image: none !important;
    }

    [data-miladymaxxer-effect="milady"][data-miladymaxxer-fade]:hover {
      outline-color: rgba(212, 175, 55, 0.4) !important;
    }

    /* Reset styling for quoted tweets inside milady posts - give them opaque background */
    [data-miladymaxxer-effect="milady"] [data-testid="quoteTweet"] {
      background: rgb(247, 249, 249) !important;
      border: 1px solid rgb(207, 217, 222) !important;
      border-radius: 16px !important;
      box-shadow: none !important;
      position: relative !important;
      z-index: 3 !important;
      isolation: isolate !important;
    }

    /* Dark mode quote tweets */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"] [data-testid="quoteTweet"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"] [data-testid="quoteTweet"] {
      background: rgb(22, 24, 28) !important;
      border-color: rgb(51, 54, 57) !important;
    }

    /* ===== MILADY QUOTE TWEETS - Gold styling when a milady is quoted ===== */
    [data-miladymaxxer-quote="milady"] {
      background: linear-gradient(180deg, rgba(255, 240, 190, 0.95) 0%, rgba(255, 250, 235, 0.95) 100%) !important;
      border: 1.5px solid rgba(212, 175, 55, 0.5) !important;
      border-radius: 16px !important;
      box-shadow:
        0 2px 8px rgba(184, 134, 11, 0.15),
        inset 0 1px 0 rgba(255, 255, 255, 0.6) !important;
      position: relative !important;
      overflow: hidden !important;
    }

    /* Gold sheen on milady quote */
    [data-miladymaxxer-quote="milady"]::before {
      content: "" !important;
      position: absolute !important;
      inset: 0 !important;
      background: linear-gradient(
        135deg,
        rgba(255, 248, 220, 0.4) 0%,
        transparent 50%,
        rgba(255, 248, 220, 0.2) 100%
      ) !important;
      pointer-events: none !important;
      z-index: 1 !important;
    }

    /* Dark mode milady quote tweets */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-quote="milady"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-quote="milady"] {
      background: rgb(24, 20, 9) !important;
      border-color: rgba(150, 120, 42, 0.3) !important;
      box-shadow:
        0 2px 8px rgba(130, 105, 35, 0.08),
        inset 0 1px 0 rgba(180, 145, 55, 0.08) !important;
    }

    /* ===== NON-MILADY QUOTE TWEETS - Neutral styling, no gold ===== */
    [data-miladymaxxer-quote="other"] {
      background: rgb(247, 249, 249) !important;
      border: 1px solid rgb(207, 217, 222) !important;
      border-radius: 16px !important;
      box-shadow: none !important;
      position: relative !important;
      z-index: 3 !important;
      isolation: isolate !important;
    }

    /* Dark mode non-milady quote tweets */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-quote="other"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-quote="other"] {
      background: rgb(22, 24, 28) !important;
      border-color: rgb(51, 54, 57) !important;
    }

    /* Card wrappers inside milady posts */
    [data-miladymaxxer-effect="milady"] [data-testid="card.wrapper"] {
      position: relative !important;
      z-index: 3 !important;
    }

    /* Content sits above the overlays; pull inward to compensate for side margins */
    [data-miladymaxxer-effect="milady"] > * {
      position: relative !important;
      z-index: 5 !important;
      margin-left: -6px !important;
      margin-right: -6px !important;
    }

    /* Gold metallic sheen overlay - behind content */
    [data-miladymaxxer-effect="milady"]::before {
      content: "" !important;
      position: absolute !important;
      inset: 0 !important;
      border-radius: 12px !important;
      background:
        linear-gradient(
          135deg,
          rgba(255, 215, 0, 0.15) 0%,
          rgba(212, 175, 55, 0.05) 20%,
          rgba(255, 255, 255, 0) 45%,
          rgba(212, 175, 55, 0.03) 70%,
          rgba(255, 215, 0, 0.12) 100%
        ) !important;
      pointer-events: none !important;
      z-index: 1 !important;
    }

    /* Shimmer effect overlay - behind content */
    [data-miladymaxxer-effect="milady"]::after {
      content: "" !important;
      position: absolute !important;
      inset: 0 !important;
      border-radius: 12px !important;
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(255, 215, 0, 0.08) 25%,
        rgba(255, 255, 255, 0.15) 50%,
        rgba(255, 215, 0, 0.08) 75%,
        rgba(255, 255, 255, 0) 100%
      ) !important;
      background-size: 200% 100% !important;
      animation: milady-shimmer 6s ease-in-out infinite !important;
      pointer-events: none !important;
      z-index: 1 !important;
    }

    /* Light mode - gold sheen */
    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"]::before,
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"]::before {
      background:
        linear-gradient(
          135deg,
          rgba(212, 175, 55, 0.12) 0%,
          rgba(255, 223, 100, 0.2) 15%,
          rgba(255, 255, 255, 0) 40%,
          rgba(212, 175, 55, 0.05) 65%,
          rgba(255, 215, 0, 0.15) 85%,
          rgba(184, 134, 11, 0.08) 100%
        ) !important;
    }

    /* Light mode - very subtle gold tint */
    [data-miladymaxxer-effect="milady"] {
      background: linear-gradient(180deg, rgba(255, 254, 248, 1) 0%, rgba(255, 255, 255, 1) 100%) !important;
    }

    /* Dark mode fallback */
    @media (prefers-color-scheme: dark) {
      [data-miladymaxxer-effect="milady"] {
        background: linear-gradient(180deg, rgb(32, 26, 14) 0%, rgb(24, 20, 10) 100%) !important;
        outline-color: rgba(160, 135, 50, 0.4) !important;
        box-shadow:
          0 2px 8px rgba(0, 0, 0, 0.4),
          0 4px 16px rgba(120, 100, 30, 0.08),
          inset 0 1px 0 rgba(160, 135, 50, 0.08) !important;
      }

      [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"] {
        background: linear-gradient(180deg, rgb(24, 26, 36) 0%, rgb(17, 19, 27) 100%) !important;
        outline-color: rgba(110, 115, 140, 0.3) !important;
        box-shadow:
          0 4px 14px rgba(110, 115, 140, 0.06),
          inset 0 1px 0 rgba(150, 155, 175, 0.1) !important;
      }
    }

    /* Twitter Light mode - subtle gold (base unliked) */
    html[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"],
    body[style*="background-color: rgb(255, 255, 255)"] [data-miladymaxxer-effect="milady"] {
      background: linear-gradient(180deg, rgba(255, 253, 244, 1) 0%, rgba(255, 255, 252, 1) 100%) !important;
      outline-color: rgba(212, 175, 55, 0.2) !important;
      box-shadow:
        0 2px 4px rgba(184, 134, 11, 0.05),
        0 4px 12px rgba(212, 175, 55, 0.08),
        inset 0 1px 0 rgba(255, 223, 100, 0.2) !important;
    }

    [data-miladymaxxer-effect="milady"][data-post-reading-active="true"][data-post-reading-active-background="true"] {
      outline-color: rgba(199, 102, 147, 0.55) !important;
      background:
        linear-gradient(90deg, rgba(199, 102, 147, 0.11), rgba(199, 102, 147, 0) 38%),
        linear-gradient(180deg, rgba(255, 253, 244, 1) 0%, rgba(255, 255, 252, 1) 100%) !important;
      box-shadow:
        inset 4px 0 0 rgba(199, 102, 147, 0.85),
        0 2px 6px rgba(184, 134, 11, 0.12),
        0 6px 20px rgba(212, 175, 55, 0.18),
        0 0 0 1px rgba(199, 102, 147, 0.18),
        inset 0 1px 0 rgba(255, 223, 100, 0.2) !important;
    }


    /* Twitter Dark mode (black) - gold card (base: distinctly warm) */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"] {
      background: linear-gradient(180deg, rgb(32, 26, 14) 0%, rgb(24, 20, 10) 100%) !important;
      outline-color: rgba(160, 135, 50, 0.4) !important;
      box-shadow:
        0 2px 8px rgba(0, 0, 0, 0.4),
        0 4px 16px rgba(120, 100, 30, 0.08),
        inset 0 1px 0 rgba(160, 135, 50, 0.08) !important;
    }

    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-post-reading-active="true"][data-post-reading-active-background="true"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-post-reading-active="true"][data-post-reading-active-background="true"] {
      background:
        linear-gradient(90deg, rgba(220, 133, 174, 0.13), rgba(220, 133, 174, 0) 38%),
        linear-gradient(180deg, rgb(32, 26, 14) 0%, rgb(24, 20, 10) 100%) !important;
      box-shadow:
        inset 4px 0 0 rgba(220, 133, 174, 0.78),
        0 2px 8px rgba(0, 0, 0, 0.4),
        0 4px 16px rgba(120, 100, 30, 0.08),
        0 0 0 1px rgba(220, 133, 174, 0.16),
        inset 0 1px 0 rgba(160, 135, 50, 0.08) !important;
    }


    /* Dark mode gold sheen — barely there */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"]::before,
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"]::before {
      background:
        linear-gradient(
          135deg,
          rgba(160, 140, 55, 0.03) 0%,
          rgba(140, 120, 45, 0.015) 25%,
          rgba(255, 255, 255, 0) 50%,
          rgba(140, 120, 45, 0.015) 75%,
          rgba(160, 140, 55, 0.02) 100%
        ) !important;
    }

    /* Dark mode shimmer — barely there */
    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"]::after,
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"]::after {
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(160, 140, 55, 0.02) 25%,
        rgba(180, 160, 100, 0.03) 50%,
        rgba(160, 140, 55, 0.02) 75%,
        rgba(255, 255, 255, 0) 100%
      ) !important;
    }

    /* HDR effect on Milady avatars */
    [data-miladymaxxer-effect="milady"] [data-testid="Tweet-User-Avatar"] img,
    [data-miladymaxxer-effect="milady"] img[src*="profile_images"] {
      filter:
        contrast(1.08)
        saturate(1.25)
        brightness(1.05) !important;
      image-rendering: high-quality !important;
    }

    /* Gold glow behind the avatar */
    [data-miladymaxxer-effect="milady"] [data-testid="Tweet-User-Avatar"] {
      filter: drop-shadow(0 0 6px rgba(212, 175, 55, 0.3)) !important;
    }

    /* Subtle gold glow in dark modes */
    @media (prefers-color-scheme: dark) {
      [data-miladymaxxer-effect="milady"] [data-testid="Tweet-User-Avatar"] {
        filter: drop-shadow(0 0 6px rgba(212, 175, 55, 0.2)) !important;
      }
    }

    html[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"] [data-testid="Tweet-User-Avatar"],
    body[style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"] [data-testid="Tweet-User-Avatar"] {
      filter: drop-shadow(0 0 6px rgba(212, 175, 55, 0.2)) !important;
    }

    [data-miladymaxxer-effect="debug-match"] {
      position: relative !important;
    }

    [data-miladymaxxer-effect="debug-miss"] {
      position: relative !important;
    }

    [data-miladymaxxer-effect="debug-match"]::after,
    [data-miladymaxxer-effect="debug-miss"]::after {
      content: "";
      position: absolute;
      inset: 0;
      border: 2px solid transparent;
      border-radius: 0 !important;
      pointer-events: none;
      z-index: 2147483647;
    }

    [data-miladymaxxer-effect="debug-match"]::before,
    [data-miladymaxxer-effect="debug-miss"]::before {
      content: attr(data-miladymaxxer-debug);
      position: absolute;
      top: 6px;
      right: 6px;
      z-index: 2147483647;
      padding: 2px 6px;
      background: rgba(15, 20, 25, 0.92);
      color: rgb(255, 255, 255);
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 11px;
      font-weight: 600;
      line-height: 1.4;
      pointer-events: none;
      border-radius: 0;
    }

    [data-miladymaxxer-effect="debug-match"]::after {
      border-color: rgba(46, 204, 113, 0.85);
    }

    [data-miladymaxxer-effect="debug-miss"]::after {
      border-color: rgba(231, 76, 60, 0.75);
    }

    .miladymaxxer-placeholder {
      display: flex;
      align-items: center;
      gap: 12px;
      box-sizing: border-box;
      min-height: 52px;
      padding: 12px 16px;
      margin: 0;
      border-bottom: 1px solid rgb(239, 243, 244);
      background: rgb(255, 255, 255);
      color: rgb(83, 100, 113);
      font-family: TwitterChirp, -apple-system, system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      font-size: 15px;
      font-weight: 400;
      line-height: 20px;
    }

    .miladymaxxer-placeholder button {
      border: 0;
      padding: 0;
      background: transparent;
      color: rgb(29, 155, 240);
      font: inherit;
      cursor: pointer;
    }

    .miladymaxxer-placeholder button:hover {
      text-decoration: underline;
    }

    /* ===== RESKIN PROFILE OVERRIDES ===== */
    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"] {
      margin: 0 !important;
      border-radius: 0 !important;
      outline: 0 !important;
      border-left: 3px solid rgba(47, 77, 12, 0.72) !important;
      background: transparent !important;
      box-shadow: none !important;
      transform: none !important;
    }

    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"]:hover {
      transform: none !important;
      box-shadow: none !important;
    }

    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"]::before,
    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"]::after,
    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-quote="milady"]::before,
    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady-dm"] [data-testid^="message-text-"]::before {
      display: none !important;
      animation: none !important;
    }

    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"] > * {
      margin-left: 0 !important;
      margin-right: 0 !important;
    }

    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"] [data-testid="Tweet-User-Avatar"],
    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"] [data-testid="Tweet-User-Avatar"] img,
    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"] img[src*="profile_images"] {
      filter: none !important;
    }

    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"],
    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"],
    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"],
    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-liked="true"] {
      background: transparent !important;
      box-shadow: none !important;
    }

    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"] {
      border-left-color: rgba(160, 160, 170, 0.82) !important;
    }

    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"] {
      border-left-color: rgba(47, 77, 12, 0.82) !important;
    }

    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"] {
      border-left-color: rgba(112, 175, 189, 0.9) !important;
    }

    html[data-milxdy-reskin-profile="min"] [data-miladymaxxer-quote="milady"] {
      background: transparent !important;
      border-color: rgba(212, 175, 55, 0.42) !important;
      box-shadow: none !important;
    }

    html[data-milxdy-reskin-profile="moderate"] [data-miladymaxxer-effect="milady"]::after {
      animation: none !important;
      opacity: 0.72 !important;
    }

    html[data-milxdy-reskin-profile="moderate"] [data-miladymaxxer-effect="milady"] [data-testid="Tweet-User-Avatar"] img,
    html[data-milxdy-reskin-profile="moderate"] [data-miladymaxxer-effect="milady"] img[src*="profile_images"] {
      filter: saturate(1.12) contrast(1.04) !important;
    }

    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] {
      border: 0 !important;
      border-left: 3px solid rgba(184, 134, 11, 0.42) !important;
      border-bottom: 1px solid rgba(212, 175, 55, 0.28) !important;
      border-radius: 0 !important;
      margin: 0 !important;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 38px),
        linear-gradient(180deg, rgba(255, 253, 244, 1), rgba(255, 255, 252, 1)) !important;
      box-shadow:
        inset 3px 0 0 rgba(242, 188, 33, 0.2),
        inset 0 1px 0 rgba(255, 255, 255, 0.5) !important;
      outline: 0 !important;
    }

    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"]::before {
      opacity: 1 !important;
    }

    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"]::after {
      animation-duration: 4.8s !important;
      opacity: 1 !important;
    }

    html[data-milxdy-reskin-profile="max"][data-milxdy-visual-maxxer-shimmer="false"] [data-miladymaxxer-effect="milady"]::after {
      animation: none !important;
      opacity: 0.28 !important;
    }

    html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] [data-miladymaxxer-effect="milady"],
    html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] [data-miladymaxxer-effect="milady"],
    html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"],
    html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] [data-miladymaxxer-effect="milady"] {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0) 24px),
        linear-gradient(180deg, rgb(32, 26, 14), rgb(24, 20, 10)) !important;
      box-shadow:
        inset 3px 0 0 rgba(242, 188, 33, 0.18),
        inset 0 1px 0 rgba(255, 255, 255, 0.045) !important;
    }

    html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"],
    html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"],
    html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"],
    html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"] {
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.022), rgba(255, 255, 255, 0) 24px),
        linear-gradient(180deg, rgb(24, 26, 36), rgb(17, 19, 27)) !important;
    }

    html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] [data-miladymaxxer-effect="milady"]::before,
    html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] [data-miladymaxxer-effect="milady"]::before,
    html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"]::before,
    html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] [data-miladymaxxer-effect="milady"]::before {
      background:
        linear-gradient(
          135deg,
          rgba(160, 140, 55, 0.025) 0%,
          rgba(140, 120, 45, 0.012) 25%,
          rgba(255, 255, 255, 0) 50%,
          rgba(140, 120, 45, 0.012) 75%,
          rgba(160, 140, 55, 0.018) 100%
        ) !important;
    }

    html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] [data-miladymaxxer-effect="milady"]::after,
    html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] [data-miladymaxxer-effect="milady"]::after,
    html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] [data-miladymaxxer-effect="milady"]::after,
    html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] [data-miladymaxxer-effect="milady"]::after {
      background: linear-gradient(
        90deg,
        rgba(255, 255, 255, 0) 0%,
        rgba(160, 140, 55, 0.012) 25%,
        rgba(180, 160, 100, 0.018) 50%,
        rgba(160, 140, 55, 0.012) 75%,
        rgba(255, 255, 255, 0) 100%
      ) !important;
      animation: none !important;
      opacity: 0.14 !important;
    }

    html[data-milxdy-reskin-profile="max"][data-milxdy-visual-maxxer-intensity="subtle"] [data-miladymaxxer-effect="milady"] {
      background: transparent !important;
      box-shadow: none !important;
      border-left-width: 2px !important;
    }

    html[data-milxdy-reskin-profile="max"][data-milxdy-visual-maxxer-intensity="subtle"] [data-miladymaxxer-effect="milady"]::before,
    html[data-milxdy-reskin-profile="max"][data-milxdy-visual-maxxer-intensity="subtle"] [data-miladymaxxer-effect="milady"]::after {
      opacity: 0.16 !important;
      animation: none !important;
    }

    html[data-milxdy-reskin-profile="max"][data-milxdy-visual-maxxer-intensity="card"] [data-miladymaxxer-effect="milady"] {
      border: 1px solid rgba(212, 175, 55, 0.48) !important;
      border-right: 3px solid rgba(184, 134, 11, 0.55) !important;
      border-bottom: 4px solid rgba(184, 134, 11, 0.55) !important;
      margin: 7px 8px 10px !important;
      box-shadow:
        inset 2px 2px 1px rgba(255, 255, 255, 0.62),
        0 6px 2px rgba(47, 77, 12, 0.16),
        0 10px 26px rgba(212, 175, 55, 0.22) !important;
    }

    html[data-milxdy-performance-mode="fast"][data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"],
    html[data-milxdy-performance-mode="balanced"][data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] {
      border: 0 !important;
      margin: 0 !important;
      outline: 0 !important;
      transform: none !important;
      box-shadow:
        inset 3px 0 0 rgba(242, 188, 33, 0.28),
        inset 0 -1px 0 rgba(212, 175, 55, 0.22) !important;
    }

    html[data-milxdy-performance-mode="fast"][data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"]::before,
    html[data-milxdy-performance-mode="fast"][data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"]::after,
    html[data-milxdy-performance-mode="balanced"][data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"]::before,
    html[data-milxdy-performance-mode="balanced"][data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"]::after {
      animation: none !important;
      pointer-events: none !important;
    }

    html[data-milxdy-reskin-profile="max"][data-milxdy-visual-maxxer-separators="none"] [data-miladymaxxer-effect="milady"] {
      border-bottom-color: transparent !important;
    }

    html[data-milxdy-reskin-profile="max"][data-milxdy-visual-maxxer-separators="beveled"] [data-miladymaxxer-effect="milady"] {
      border-right: 2px solid rgba(184, 134, 11, 0.35) !important;
      border-bottom: 2px solid rgba(184, 134, 11, 0.35) !important;
    }

    html[data-milxdy-performance-mode="fast"][data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"],
    html[data-milxdy-performance-mode="balanced"][data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] {
      border: 0 !important;
      margin: 0 !important;
    }

    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-uncaught="true"] {
      border-left-color: rgba(130, 130, 140, 0.6) !important;
      border-bottom-color: rgba(161, 161, 161, 0.26) !important;
    }

    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-mint="true"] {
      border-left-color: rgba(47, 77, 12, 0.62) !important;
      border-bottom-color: rgba(47, 77, 12, 0.22) !important;
    }

    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"][data-miladymaxxer-diamond="true"] {
      border-left-color: rgba(112, 175, 189, 0.72) !important;
      border-bottom-color: rgba(112, 175, 189, 0.26) !important;
    }

    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-profile="milady"] a[href*="/photo"] img {
      border: 2px solid rgba(242, 188, 33, 0.82) !important;
      border-right-width: 4px !important;
      border-bottom-width: 4px !important;
      border-radius: 7px !important;
    }

    html[data-milxdy-reskin-profile="max"] .miladymaxxer-placeholder {
      border: 1px solid rgba(47, 77, 12, 0.32) !important;
      background: linear-gradient(180deg, #f4ffee, #ffffff) !important;
      color: #2f4d0c !important;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    }

    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"]::before,
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"]::after,
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-quote="milady"],
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-quote="milady"]::before,
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-quote="other"],
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] [data-testid="quoteTweet"],
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] [data-testid="tweetPhoto"],
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] [data-testid="videoPlayer"],
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] [data-testid="card.wrapper"] {
      border-radius: 0 !important;
    }

    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] [data-testid="tweetPhoto"] + [data-testid="quoteTweet"],
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] [data-testid="videoPlayer"] + [data-testid="quoteTweet"],
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] [data-testid="card.wrapper"] + [data-testid="quoteTweet"],
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] [data-testid="quoteTweet"] {
      margin-top: 0 !important;
    }

    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] [data-testid="Tweet-User-Avatar"],
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] [data-testid="Tweet-User-Avatar"] *,
    html[data-milxdy-reskin-profile="max"] [data-miladymaxxer-effect="milady"] img[src*="profile_images"] {
      border-radius: 7px !important;
    }

    @media (prefers-reduced-motion: reduce) {
      [data-miladymaxxer-effect="milady"]::after,
      [data-miladymaxxer-catch-anim],
      .miladymaxxer-level-flash {
        animation: none !important;
      }
    }
  `;
  document.head.append(style);
}
