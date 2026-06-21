export function injectStyles(): void {
  if (document.getElementById("postreader-style")) return;
  const style = document.createElement("style");
  style.id = "postreader-style";
  style.textContent = `
    .postreader-button {
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
    .postreader-button:hover,
    .postreader-button[aria-pressed="true"] {
      color: rgb(199, 102, 147);
      background: rgba(199, 102, 147, 0.12);
    }
    .postreader-button svg {
      width: 18px;
      height: 18px;
      pointer-events: none;
    }
    .postreader-player {
      position: fixed;
      top: 12px;
      right: 16px;
      z-index: 2147483646;
      display: block;
      padding: 6px;
      border: 1px solid rgba(199, 102, 147, 0.42);
      border-radius: 999px;
      background: linear-gradient(180deg, rgba(255, 252, 254, 0.96), rgba(255, 246, 250, 0.94));
      color: rgb(15, 20, 25);
      box-shadow: 0 4px 18px rgba(199, 102, 147, 0.18), 0 1px 0 rgba(255, 255, 255, 0.8) inset;
      font: 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      backdrop-filter: blur(12px);
    }
    .postreader-shell {
      display: grid;
      gap: 6px;
    }
    .postreader-controls {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .postreader-player[data-position="top-right"] { top: 12px; right: 16px; bottom: auto; left: auto; }
    .postreader-player[data-position="bottom-right"] { top: auto; right: 16px; bottom: 16px; left: auto; }
    .postreader-player[data-position="top-left"] { top: 12px; right: auto; bottom: auto; left: 16px; }
    .postreader-player[data-position="bottom-left"] { top: auto; right: auto; bottom: 16px; left: 16px; }
    .postreader-player[data-visible="false"] {
      display: none;
    }
    .postreader-control {
      width: 30px;
      height: 30px;
      border: 0;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: inherit;
      background: transparent;
      cursor: pointer;
      padding: 0;
    }
    .postreader-control:hover {
      color: rgb(199, 102, 147);
      background: rgba(199, 102, 147, 0.12);
    }
    .postreader-control svg {
      width: 16px;
      height: 16px;
      pointer-events: none;
    }
    .postreader-close {
      margin-left: 2px;
      color: rgb(122, 83, 104);
    }
    .postreader-close:hover {
      color: rgb(211, 67, 120);
      background: rgba(211, 67, 120, 0.14);
    }
    .postreader-title {
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      padding: 0 4px;
      color: rgb(122, 83, 104);
    }
    .postreader-ocr {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-width: 220px;
      padding: 4px 6px 2px;
      color: rgb(122, 83, 104);
      font-size: 12px;
    }
    .postreader-ocr-details {
      display: grid;
      gap: 4px;
      min-width: 0;
      flex: 1 1 auto;
    }
    .postreader-ocr-bar {
      --postreader-ocr-progress: 0%;
      height: 4px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(199, 102, 147, 0.16);
    }
    .postreader-ocr-bar span {
      display: block;
      width: var(--postreader-ocr-progress);
      height: 100%;
      border-radius: inherit;
      background: rgb(199, 102, 147);
      transition: width 160ms linear;
    }
    .postreader-ocr[hidden] {
      display: none;
    }
    .postreader-ocr-skip {
      padding: 4px 7px;
      white-space: nowrap;
    }
    .postreader-settings {
      position: absolute;
      top: calc(100% + 8px);
      right: 0;
      width: 260px;
      padding: 12px;
      border: 1px solid rgba(199, 102, 147, 0.38);
      border-radius: 8px;
      background: linear-gradient(180deg, rgba(255, 252, 254, 0.99), rgba(255, 247, 251, 0.98));
      box-shadow: 0 10px 30px rgba(82, 39, 62, 0.18);
      display: grid;
      gap: 10px;
    }
    .postreader-settings[hidden] {
      display: none;
    }
    .postreader-settings label {
      display: grid;
      gap: 4px;
      color: rgb(83, 100, 113);
      font-size: 12px;
    }
    .postreader-tabs {
      display: flex;
      gap: 4px;
      overflow-x: auto;
      padding-bottom: 2px;
    }
    .postreader-tabs button {
      border: 1px solid rgba(199, 102, 147, 0.25);
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.62);
      color: rgb(122, 83, 104);
      cursor: pointer;
      font: inherit;
      font-size: 11px;
      padding: 5px 8px;
      white-space: nowrap;
    }
    .postreader-tabs button[data-active="true"] {
      background: rgba(199, 102, 147, 0.16);
      color: rgb(159, 62, 108);
      border-color: rgba(199, 102, 147, 0.45);
    }
    .postreader-hint {
      color: rgb(122, 83, 104);
      font-size: 12px;
    }
    .postreader-settings select,
    .postreader-settings input[type="number"],
    .postreader-settings input[type="range"] {
      width: 100%;
      box-sizing: border-box;
    }
    .postreader-settings select,
    .postreader-settings input[type="number"] {
      border: 1px solid rgba(199, 102, 147, 0.35);
      border-radius: 6px;
      padding: 6px 8px;
      background: rgba(255, 255, 255, 0.82);
      color: inherit;
    }
    .postreader-secondary {
      border: 1px solid rgba(199, 102, 147, 0.35);
      border-radius: 6px;
      padding: 7px 9px;
      background: rgba(199, 102, 147, 0.1);
      color: rgb(122, 83, 104);
      cursor: pointer;
      font: inherit;
      font-size: 12px;
    }
    .postreader-secondary:disabled {
      cursor: default;
      opacity: 0.65;
    }
    .postreader-checkbox {
      grid-template-columns: 18px 1fr;
      align-items: center;
    }
    .postreader-checkbox input {
      margin: 0;
    }
    article[data-postreader-active="true"][data-postreader-active-background="true"] {
      box-shadow: inset 3px 0 0 rgba(199, 102, 147, 0.9);
      background: linear-gradient(90deg, rgba(199, 102, 147, 0.08), transparent 42%);
    }
    article[data-postreader-active="true"][data-postreader-active-background="true"][data-miladymaxxer-effect="milady"] {
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
    [data-postreader-preview-hidden="true"] {
      display: none;
    }
    .postreader-full-quote {
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
    .postreader-full-quote-label {
      margin-bottom: 2px;
      color: rgb(83, 100, 113);
      font: inherit;
      font-size: 13px;
      line-height: 16px;
      font-weight: 400;
    }
    .postreader-full-quote-body {
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      color: rgb(15, 20, 25);
      font: inherit;
      font-size: 15px;
      line-height: 20px;
    }
    .postreader-full-quote-paragraph {
      margin: 0 0 12px;
      white-space: pre-wrap;
    }
    .postreader-full-quote-paragraph[data-tight="true"] {
      margin-bottom: 4px;
    }
    .postreader-full-quote-paragraph:last-child {
      margin-bottom: 0;
    }
    .postreader-full-quote-list {
      margin: 0 0 12px;
      padding-left: 0;
      list-style: none;
    }
    .postreader-full-quote-list:last-child {
      margin-bottom: 0;
    }
    .postreader-full-quote-list li {
      margin: 0 0 4px;
      padding-left: 0;
    }
    .postreader-full-quote-list li:last-child {
      margin-bottom: 0;
    }
    .postreader-full-quote[data-mode="scroll"] .postreader-full-quote-body {
      max-height: 112px;
      min-height: 68px;
      overflow-y: auto;
      padding-right: 6px;
      scrollbar-width: thin;
    }
    [data-postreader-word="true"][data-postreader-current-word="true"] {
      background: rgba(199, 102, 147, 0.18);
      border-radius: 4px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      transition: background 80ms linear;
    }
    [data-postreader-smooth-word="true"] {
      --postreader-fill: 0%;
      --postreader-fill-duration: 160ms;
      white-space: pre-wrap;
      background:
        linear-gradient(90deg, rgba(199, 102, 147, 0.24) var(--postreader-fill), transparent var(--postreader-fill));
      border-radius: 4px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
      transition: background var(--postreader-fill-duration) linear;
    }
    [data-postreader-smooth-word="true"][data-postreader-smooth-filled="true"] {
      --postreader-fill: 100%;
    }
    [data-postreader-smooth-word="true"][data-postreader-token-kind="space"] {
      border-radius: 0;
    }
    @media (prefers-color-scheme: dark) {
      .postreader-player,
      .postreader-settings {
        background: linear-gradient(180deg, rgba(21, 18, 24, 0.94), rgba(34, 24, 31, 0.92));
        color: rgb(231, 233, 234);
        border-color: rgba(220, 133, 174, 0.42);
      }
      .postreader-control:hover {
        background: rgba(239, 243, 244, 0.1);
      }
      .postreader-full-quote {
        border-color: rgb(47, 51, 54);
        color: rgb(231, 233, 234);
      }
      .postreader-full-quote-label {
        color: rgb(113, 118, 123);
      }
      .postreader-full-quote-body {
        color: rgb(231, 233, 234);
      }
      article[data-postreader-active="true"][data-postreader-active-background="true"][data-miladymaxxer-effect="milady"] {
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
