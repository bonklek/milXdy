export function injectStyles(): void {
  if (document.getElementById("post-reading-style")) return;
  const style = document.createElement("style");
  style.id = "post-reading-style";
  style.textContent = `
    .post-reading-button {
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: rgb(83, 100, 113);
      background: transparent;
      cursor: pointer;
      padding: 0;
      flex: 0 0 auto;
      position: relative;
      z-index: 2;
    }
    .post-reading-button-slot {
      position: relative;
      display: inline-block;
      width: 0;
      height: 0;
      flex: 0 0 0;
      overflow: visible;
      vertical-align: top;
    }
    .post-reading-button-slot--header {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 22px;
      height: 20px;
      min-height: 20px;
      flex: 0 0 22px;
      overflow: visible;
      vertical-align: middle;
    }
    .post-reading-button-slot .post-reading-button {
      position: absolute;
      left: 4px;
      top: 0;
      transform: translateY(-50%);
    }
    .post-reading-button-slot--header .post-reading-button {
      position: static;
      transform: none;
      width: 22px;
      height: 20px;
      min-height: 20px;
    }
    .post-reading-button:hover,
    .post-reading-button[aria-pressed="true"] {
      color: rgb(199, 102, 147);
      background: rgba(199, 102, 147, 0.12);
    }
    .post-reading-button svg {
      width: 18px;
      height: 18px;
      pointer-events: none;
    }
    .post-reading-player {
      --post-reading-accent: #626bb2;
      --post-reading-link: #171f82;
      --post-reading-surface-1: #fbfbfb;
      --post-reading-surface-2: #e5e5e5;
      --post-reading-surface-3: #d4d4d4;
      --post-reading-border: #b4b4b4;
      --post-reading-border-dark: #464a6c;
      --post-reading-text: #19191d;
      --post-reading-muted: rgba(0, 0, 0, 0.58);
      --post-reading-highlight: #ffffff;
      position: fixed;
      top: 84px;
      right: 104px;
      z-index: 2147483646;
      display: grid;
      width: min(360px, calc(100vw - 128px));
      min-width: 280px;
      min-height: 120px;
      max-height: calc(100vh - 104px);
      color: var(--post-reading-text);
      font: 13px/1.2 var(--milxdy-font-ui, TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      letter-spacing: 0;
      filter: none !important;
      box-shadow: none !important;
    }
    .post-reading-player *,
    .post-reading-player *::before,
    .post-reading-player *::after {
      box-sizing: border-box;
    }
    .post-reading-box {
      position: relative;
      display: grid;
      grid-template-rows: auto auto;
      height: 100%;
      min-height: 0;
      overflow: hidden;
      border: 1px solid var(--post-reading-border);
      border-right: 3px solid #a3a3a3;
      border-bottom: 4px solid #a3a3a3;
      border-radius: 6px;
      background:
        linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 42px),
        var(--post-reading-surface-1);
      box-shadow:
        inset 2px 2px 1px var(--post-reading-highlight),
        4px 4px 0 rgba(0, 0, 0, 0.22);
    }
    .post-reading-box.milxdy-overlay-app-card {
      border-radius: 0 !important;
      box-shadow:
        inset 2px 2px 1px var(--post-reading-highlight),
        4px 4px 0 rgba(0, 0, 0, 0.22) !important;
    }
    .post-reading-box::before {
      content: "";
      pointer-events: none;
      position: absolute;
      inset: 0;
      background:
        repeating-linear-gradient(0deg, rgba(98, 107, 178, 0.035), rgba(98, 107, 178, 0.035) 1px, transparent 1px, transparent 8px),
        repeating-linear-gradient(90deg, rgba(98, 107, 178, 0.025), rgba(98, 107, 178, 0.025) 1px, transparent 1px, transparent 8px);
      opacity: 0.68;
    }
    .post-reading-box > * {
      position: relative;
      z-index: 1;
    }
    .post-reading-shell {
      display: grid;
      gap: 10px;
      padding: 9px 10px 10px;
      border-bottom: 1px solid var(--post-reading-border);
      background: var(--post-reading-surface-3);
      box-shadow: inset 2px 2px 1px rgba(255, 255, 255, 0.52);
    }
    .post-reading-panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      min-width: 0;
      cursor: grab;
    }
    .post-reading-player[data-dragging="true"] .post-reading-panel-header {
      cursor: grabbing;
    }
    .post-reading-panel-heading {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
    }
    .post-reading-panel-logo {
      width: 30px;
      height: 30px;
      border: 1px solid var(--post-reading-border);
      border-right: 3px solid #adadad;
      border-bottom: 3px solid #adadad;
      border-radius: 5px;
      background: var(--post-reading-surface-2);
      flex: 0 0 auto;
    }
    .post-reading-panel-heading-text {
      display: grid;
      gap: 2px;
      min-width: 0;
    }
    .post-reading-panel-heading-text strong {
      color: var(--post-reading-link);
      font-size: 18px;
      font-weight: 400;
      line-height: 1;
      text-transform: uppercase;
      text-shadow: 1px 1px 0 #ffffff;
    }
    .post-reading-panel-actions {
      display: flex;
      align-items: center;
      gap: 4px;
      flex: 0 0 auto;
    }
    .post-reading-controls {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      gap: 3px;
      min-width: 0;
      padding: 0;
      border: 0;
      background: transparent;
    }
    .post-reading-player[data-visible="false"] {
      display: none;
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] {
      position: static;
      z-index: auto;
      width: 100%;
      max-height: none;
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-shell {
      gap: 6px;
      padding: 7px 8px;
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-panel-header {
      display: none;
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-box {
      border-radius: 7px;
      box-shadow: none !important;
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-controls {
      justify-content: flex-start;
      gap: 5px;
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-panel-actions {
      display: flex;
      align-items: center;
      gap: 5px;
      margin-left: auto;
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-resize-grip,
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-resize-edge {
      display: none;
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-ocr-control {
      display: none;
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-settings {
      max-height: min(221px, 32vh);
    }
    .post-reading-control {
      min-width: 31px;
      height: 31px;
      border: 1px solid var(--post-reading-border);
      border-right: 3px solid #adadad;
      border-bottom: 3px solid #adadad;
      border-radius: 5px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: var(--post-reading-border-dark);
      background: var(--post-reading-surface-3);
      cursor: pointer;
      padding: 0;
      box-shadow: inset 2px 2px 1px rgba(255, 255, 255, 0.5);
    }
    .post-reading-control:hover {
      filter: brightness(0.98);
      transform: translate(1px, 1px);
      border-right-width: 2px;
      border-bottom-width: 2px;
    }
    .post-reading-control svg {
      width: 16px;
      height: 16px;
      pointer-events: none;
    }
    .post-reading-control:disabled {
      cursor: default;
      opacity: 0.48;
      filter: grayscale(0.25);
      transform: none;
    }
    .post-reading-control:disabled:hover {
      filter: grayscale(0.25);
      transform: none;
      border-right-width: 3px;
      border-bottom-width: 3px;
    }
    .post-reading-ocr-control {
      min-width: 52px;
      margin-left: auto;
      padding: 0 8px;
      font-family: var(--milxdy-font-mono, "SFMono-Regular", Consolas, "Liberation Mono", monospace);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0;
    }
    .post-reading-ocr-control[data-active="true"] {
      color: var(--post-reading-link);
    }
    .post-reading-close {
      margin-left: 2px;
      color: var(--post-reading-border-dark);
    }
    .post-reading-close:hover {
      color: var(--post-reading-border-dark);
    }
    .post-reading-title {
      max-width: 220px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--post-reading-muted);
      font-family: var(--milxdy-font-tweet, TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      font-size: 11px;
      line-height: 1.3;
    }
    .post-reading-ocr {
      display: block;
      min-width: 220px;
      padding: 1px 0 0;
      color: var(--post-reading-muted);
      font-size: 12px;
    }
    .post-reading-ocr-details {
      display: grid;
      gap: 4px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .post-reading-ocr-bar {
      --post-reading-ocr-progress: 0%;
      height: 4px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(98, 107, 178, 0.16);
    }
    .post-reading-ocr-bar span {
      display: block;
      width: var(--post-reading-ocr-progress);
      height: 100%;
      border-radius: inherit;
      background: var(--post-reading-accent);
      transition: width 160ms linear;
    }
    .post-reading-ocr[hidden] {
      display: none;
    }
    .post-reading-resize-grip,
    .post-reading-resize-edge {
      position: absolute;
      z-index: 4;
      opacity: 0;
      transition: opacity 120ms linear, background 120ms linear;
    }
    .post-reading-player:hover .post-reading-resize-grip,
    .post-reading-player:hover .post-reading-resize-edge,
    .post-reading-player[data-resizing="true"] .post-reading-resize-grip,
    .post-reading-player[data-resizing="true"] .post-reading-resize-edge {
      opacity: 1;
    }
    .post-reading-resize-edge-side {
      top: 0;
      right: -2px;
      bottom: 0;
      width: 10px;
      cursor: ew-resize;
      background: linear-gradient(90deg, transparent, rgba(70, 74, 108, 0.16));
    }
    .post-reading-resize-edge-bottom {
      left: 0;
      right: 0;
      bottom: -2px;
      height: 10px;
      cursor: ns-resize;
      background: linear-gradient(180deg, transparent, rgba(70, 74, 108, 0.16));
    }
    .post-reading-resize-grip {
      right: 0;
      bottom: 0;
      width: 18px;
      height: 18px;
      cursor: nwse-resize;
      color: var(--post-reading-border-dark);
      background:
        linear-gradient(135deg, transparent 0 44%, currentColor 45% 50%, transparent 51%),
        linear-gradient(135deg, transparent 0 62%, currentColor 63% 68%, transparent 69%);
      background-size: 14px 14px, 10px 10px;
      background-position: right 2px bottom 2px, right 2px bottom 2px;
      background-repeat: no-repeat;
    }
    .post-reading-settings {
      display: grid;
      grid-template-rows: auto minmax(0, 1fr);
      max-height: min(520px, calc(100vh - 260px));
      overflow: hidden;
      padding: 0;
      background: var(--post-reading-surface-1);
    }
    .post-reading-settings[hidden] {
      display: none;
    }
    .post-reading-settings-body {
      display: grid;
      gap: 10px;
      min-height: 0;
      overflow: auto;
      padding: 12px;
      scrollbar-width: thin;
    }
    .post-reading-settings label {
      display: grid;
      gap: 4px;
      color: var(--post-reading-muted);
      font-size: 12px;
    }
    .post-reading-tabs {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding: 10px 12px 6px;
      background: var(--post-reading-surface-1);
      border-bottom: 1px solid rgba(180, 180, 180, 0.55);
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-settings-body {
      gap: 8px;
      padding: 8px 10px;
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-tabs {
      display: grid;
      grid-auto-columns: minmax(0, 1fr);
      grid-auto-flow: column;
      gap: 3px;
      overflow: visible;
      padding: 6px;
    }
    .post-reading-tabs button {
      border: 1px solid var(--post-reading-border);
      border-right: 3px solid #adadad;
      border-bottom: 3px solid #adadad;
      border-radius: 5px;
      background: var(--post-reading-surface-3);
      color: var(--post-reading-border-dark);
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      padding: 5px 8px;
      white-space: nowrap;
    }
    .post-reading-player[data-attached="wikiSidebarBottom"] .post-reading-tabs button {
      min-width: 0;
      overflow: hidden;
      padding: 4px 3px;
      text-overflow: ellipsis;
      font-size: 10px;
    }
    .post-reading-tabs button[data-active="true"] {
      background: var(--post-reading-surface-2);
      color: var(--post-reading-link);
      border-color: var(--post-reading-border-dark);
    }
    .post-reading-hint {
      color: var(--post-reading-muted);
      font-size: 12px;
    }
    .post-reading-settings select,
    .post-reading-settings input[type="number"],
    .post-reading-settings input[type="text"],
    .post-reading-settings input[type="url"],
    .post-reading-settings input[type="range"] {
      width: 100%;
      box-sizing: border-box;
    }
    .post-reading-settings select,
    .post-reading-settings input[type="number"],
    .post-reading-settings input[type="text"],
    .post-reading-settings input[type="url"] {
      border: 1px solid var(--post-reading-border);
      border-radius: 5px;
      padding: 6px 8px;
      background: #ffffff;
      color: inherit;
    }
    .post-reading-secondary {
      border: 1px solid var(--post-reading-border);
      border-right: 3px solid #adadad;
      border-bottom: 3px solid #adadad;
      border-radius: 5px;
      padding: 7px 9px;
      background: var(--post-reading-surface-3);
      color: var(--post-reading-border-dark);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
      box-shadow: inset 2px 2px 1px rgba(255, 255, 255, 0.5);
    }
    .post-reading-secondary:disabled {
      cursor: default;
      opacity: 0.65;
    }
    .post-reading-checkbox {
      grid-template-columns: 18px 1fr;
      align-items: center;
    }
    .post-reading-checkbox input {
      margin: 0;
    }
    article[data-post-reading-active="true"][data-post-reading-active-background="true"] {
      box-shadow: inset 3px 0 0 rgba(199, 102, 147, 0.9);
      background: linear-gradient(90deg, rgba(199, 102, 147, 0.08), transparent 42%);
    }
    article[data-post-reading-active="true"][data-post-reading-active-background="true"][data-miladymaxxer-effect="milady"] {
      outline-color: rgba(199, 102, 147, 0.55) !important;
      box-shadow:
        inset 4px 0 0 rgba(199, 102, 147, 0.85),
        0 2px 6px rgba(184, 134, 11, 0.12),
        0 6px 20px rgba(212, 175, 55, 0.18),
        0 0 0 1px rgba(199, 102, 147, 0.18),
        inset 0 1px 0 rgba(255, 223, 100, 0.2) !important;
      background:
        linear-gradient(90deg, rgba(199, 102, 147, 0.11), rgba(199, 102, 147, 0) 38%),
        linear-gradient(180deg, rgba(255, 253, 244, 1) 0%, rgba(255, 255, 252, 1) 100%) !important;
    }
    [data-post-reading-preview-hidden="true"] {
      display: none;
    }
    .post-reading-full-quote {
      margin-top: 0;
      padding: 11px 12px;
      border: 1px solid rgb(207, 217, 222);
      border-radius: 12px;
      background: transparent;
      color: rgb(15, 20, 25);
      font: inherit;
      font-family: inherit;
      font-size: 15px;
      letter-spacing: inherit;
      line-height: 20px;
      cursor: text;
    }
    .post-reading-full-quote-label {
      margin-bottom: 2px;
      color: rgb(83, 100, 113);
      font: inherit;
      font-size: 13px;
      line-height: 16px;
      font-weight: 400;
    }
    .post-reading-full-quote-body {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: rgb(15, 20, 25);
      font: inherit;
      font-size: 15px;
      line-height: 20px;
    }
    .post-reading-full-quote-paragraph {
      margin: 0 0 12px;
      white-space: pre-wrap;
    }
    .post-reading-full-quote-paragraph[data-tight="true"] {
      margin-bottom: 4px;
    }
    .post-reading-full-quote-paragraph:last-child {
      margin-bottom: 0;
    }
    .post-reading-full-quote-list {
      margin: 0 0 12px;
      padding-left: 0;
      list-style: none;
    }
    .post-reading-full-quote-list:last-child {
      margin-bottom: 0;
    }
    .post-reading-full-quote-list li {
      margin: 0 0 4px;
      padding-left: 0;
    }
    .post-reading-full-quote-list li:last-child {
      margin-bottom: 0;
    }
    .post-reading-full-quote[data-mode="scroll"] .post-reading-full-quote-body {
      max-height: 112px;
      min-height: 68px;
      overflow-y: auto;
      padding-right: 6px;
      scrollbar-width: thin;
    }
    [data-post-reading-word="true"][data-post-reading-current-word="true"] {
      background: rgba(199, 102, 147, 0.18);
      border-radius: 4px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      transition: background 80ms linear;
    }
    [data-post-reading-smooth-word="true"] {
      --post-reading-fill: 0%;
      --post-reading-fill-duration: 160ms;
      white-space: pre-wrap;
      background:
        linear-gradient(90deg, rgba(199, 102, 147, 0.24) var(--post-reading-fill), transparent var(--post-reading-fill));
      border-radius: 4px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      transition: background var(--post-reading-fill-duration) linear;
    }
    [data-post-reading-smooth-word="true"][data-post-reading-smooth-filled="true"] {
      --post-reading-fill: 100%;
    }
    [data-post-reading-smooth-word="true"][data-post-reading-token-kind="space"] {
      border-radius: 0;
    }
    @media (prefers-color-scheme: dark) {
      .post-reading-player {
        --post-reading-surface-1: #242634;
        --post-reading-surface-2: #303345;
        --post-reading-surface-3: #2b2e3d;
        --post-reading-border: #575d82;
        --post-reading-border-dark: #c6ccff;
        --post-reading-text: #f0f1f8;
        --post-reading-muted: rgba(240, 241, 248, 0.68);
        --post-reading-highlight: rgba(255, 255, 255, 0.12);
        --post-reading-link: #c6ccff;
      }
      .post-reading-panel-heading-text strong {
        color: var(--post-reading-link);
        text-shadow: none;
      }
      .post-reading-box {
        border-color: var(--post-reading-border);
        border-right-color: #3a3f59;
        border-bottom-color: #363b54;
        background:
          linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0) 42px),
          var(--post-reading-surface-1);
        box-shadow:
          inset 1px 1px 0 rgba(255, 255, 255, 0.12),
          inset -1px -1px 0 rgba(0, 0, 0, 0.2),
          4px 4px 0 rgba(0, 0, 0, 0.36);
      }
      .post-reading-shell {
        background: #2b2e3d;
        border-bottom-color: #4f5577;
        box-shadow:
          inset 1px 1px 0 rgba(255, 255, 255, 0.1),
          inset 0 -1px 0 rgba(0, 0, 0, 0.22);
      }
      .post-reading-panel-logo {
        border-color: rgba(198, 204, 255, 0.78);
        border-right-color: rgba(128, 136, 191, 0.9);
        border-bottom-color: rgba(95, 102, 148, 0.95);
        background: var(--post-reading-link);
        box-shadow:
          inset 1px 1px 0 rgba(255, 255, 255, 0.45),
          inset -1px -1px 0 rgba(32, 36, 70, 0.32),
          0 1px 2px rgba(0, 0, 0, 0.24);
      }
      .post-reading-control,
      .post-reading-secondary,
      .post-reading-tabs button {
        border-color: #687096;
        border-right-color: #454b68;
        border-bottom-color: #3d435e;
        background: linear-gradient(180deg, #33374a, #282b3a);
        color: var(--post-reading-border-dark);
        box-shadow:
          inset 1px 1px 0 rgba(255, 255, 255, 0.16),
          inset -1px -1px 0 rgba(0, 0, 0, 0.22),
          0 1px 2px rgba(0, 0, 0, 0.24);
      }
      .post-reading-control:hover,
      .post-reading-secondary:hover,
      .post-reading-tabs button:hover {
        background: linear-gradient(180deg, #3a3f55, #2e3245);
        filter: none;
      }
      .post-reading-settings select,
      .post-reading-settings input[type="number"],
      .post-reading-settings input[type="text"],
      .post-reading-settings input[type="url"] {
        border-color: var(--post-reading-border);
        background: var(--post-reading-surface-2);
        color: var(--post-reading-text);
      }
      .post-reading-full-quote {
        border-color: rgb(47, 51, 54);
        color: rgb(231, 233, 234);
      }
      .post-reading-full-quote-label {
        color: rgb(113, 118, 123);
      }
      .post-reading-full-quote-body {
        color: rgb(231, 233, 234);
      }
      article[data-post-reading-active="true"][data-post-reading-active-background="true"][data-miladymaxxer-effect="milady"] {
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
    }
  `;
  document.head.appendChild(style);
}
