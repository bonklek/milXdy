export const RESKIN_STYLE_ID = "milxdy-reskin-profile-style";

export const RESKIN_CSS = `
  @font-face {
    font-family: "Milxdy Remilia Mincho";
    src: url("__MILXDY_FONT_BASE__RemiliaMincho-Regular.otf") format("opentype");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: "Milxdy Remilia Hei";
    src: url("__MILXDY_FONT_BASE__Hei.ttf") format("truetype");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  @font-face {
    font-family: "Milxdy Remilia Menlo";
    src: url("__MILXDY_FONT_BASE__Menlo.woff2") format("woff2");
    font-weight: 400;
    font-style: normal;
    font-display: swap;
  }

  :root {
    --milxdy-rn-blue: #626bb2;
    --milxdy-rn-blue-dark: #171f82;
    --milxdy-green: #2f4d0c;
    --milxdy-green-soft: #b9d9b7;
    --milxdy-mint-bg: #f4ffee;
    --milxdy-pink: #f1a8b7;
    --milxdy-pink-dark: #b35e7d;
    --milxdy-gold: #f2bc21;
    --milxdy-gold-dark: #dda004;
    --milxdy-cream: #ffffee;
    --milxdy-surface: #fbfbfb;
    --milxdy-surface-2: #e5e5e5;
    --milxdy-border: #b4b4b4;
    --milxdy-border-dark: #464a6c;
    --milxdy-text: #19191d;
    --milxdy-muted: rgba(0, 0, 0, 0.56);
    --milxdy-frame-shadow: 0 5px 2.5px rgba(0, 0, 0, 0.15);
    --milxdy-font-tweet: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    --milxdy-font-ui: "Milxdy Remilia Hei", "Milxdy Remilia Menlo", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    --milxdy-font-mono: "Milxdy Remilia Menlo", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  }

  @media (prefers-color-scheme: dark) {
    :root {
      --milxdy-rn-blue: #9ea7ff;
      --milxdy-rn-blue-dark: #cbd0ff;
      --milxdy-green: #c9f0a8;
      --milxdy-green-soft: #263f2b;
      --milxdy-mint-bg: #101b13;
      --milxdy-pink: #7b4056;
      --milxdy-pink-dark: #ffc2d2;
      --milxdy-gold: #ffd978;
      --milxdy-gold-dark: #ffe7a8;
      --milxdy-cream: #f4ffe8;
      --milxdy-surface: #171820;
      --milxdy-surface-2: #20222d;
      --milxdy-border: #4c5064;
      --milxdy-border-dark: #858cc9;
      --milxdy-text: #f0f1f8;
      --milxdy-muted: rgba(240, 241, 248, 0.62);
      --milxdy-frame-shadow: 0 5px 2.5px rgba(0, 0, 0, 0.42);
    }
  }

  html[data-milxdy-reskin-profile][data-milxdy-x-theme="light"] {
    --milxdy-rn-blue: #626bb2;
    --milxdy-rn-blue-dark: #171f82;
    --milxdy-green: #2f4d0c;
    --milxdy-green-soft: #b9d9b7;
    --milxdy-mint-bg: #f4ffee;
    --milxdy-pink: #f1a8b7;
    --milxdy-pink-dark: #b35e7d;
    --milxdy-gold: #f2bc21;
    --milxdy-gold-dark: #dda004;
    --milxdy-cream: #ffffee;
    --milxdy-surface: #fbfbfb;
    --milxdy-surface-2: #e5e5e5;
    --milxdy-border: #b4b4b4;
    --milxdy-border-dark: #464a6c;
    --milxdy-text: #19191d;
    --milxdy-muted: rgba(0, 0, 0, 0.56);
    --milxdy-frame-shadow: 0 5px 2.5px rgba(0, 0, 0, 0.15);
  }

  html[data-milxdy-reskin-profile]:not([data-milxdy-settings-theme="light"])[style*="background-color: rgb(0, 0, 0)"],
  html[data-milxdy-reskin-profile]:not([data-milxdy-settings-theme="light"])[style*="background-color: rgb(22, 24, 28)"],
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"],
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"],
  html[data-milxdy-reskin-profile]:not([data-milxdy-settings-theme="light"]):has(body[style*="background-color: rgb(0, 0, 0)"]),
  html[data-milxdy-reskin-profile]:not([data-milxdy-settings-theme="light"]):has(body[style*="background-color: rgb(22, 24, 28)"]) {
    --milxdy-rn-blue: #9ea7ff;
    --milxdy-rn-blue-dark: #cbd0ff;
    --milxdy-green: #c9f0a8;
    --milxdy-green-soft: #263f2b;
    --milxdy-mint-bg: #101b13;
    --milxdy-pink: #7b4056;
    --milxdy-pink-dark: #ffc2d2;
    --milxdy-gold: #ffd978;
    --milxdy-gold-dark: #ffe7a8;
    --milxdy-cream: #f4ffe8;
    --milxdy-surface: #171820;
    --milxdy-surface-2: #20222d;
    --milxdy-border: #4c5064;
    --milxdy-border-dark: #858cc9;
    --milxdy-text: #f0f1f8;
    --milxdy-muted: rgba(240, 241, 248, 0.62);
    --milxdy-frame-shadow: 0 5px 2.5px rgba(0, 0, 0, 0.42);
  }

  html[data-milxdy-reskin-profile] .remilia-wiki-preview,
  html[data-milxdy-reskin-profile] .post-reading-player,
  html[data-milxdy-reskin-profile] .post-reading-settings,
  html[data-milxdy-reskin-profile] .reminet-tooltip,
  html[data-milxdy-reskin-profile] #beetol-hunter-root .beetol-panel,
  html[data-milxdy-reskin-profile] #beetol-hunter-root .beetol-tab,
  html[data-milxdy-reskin-profile] #milxdy-reminet-chat-root .milxdy-chat-card {
    font-family: "Milxdy Remilia Hei", "Milxdy Remilia Menlo", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    letter-spacing: 0 !important;
  }

  html[data-milxdy-settings-theme="light"],
  html[data-milxdy-settings-theme="light"] body,
  html[data-milxdy-settings-theme="light"] #react-root,
  html[data-milxdy-settings-theme="light"] main,
  html[data-milxdy-settings-theme="light"] [data-testid="primaryColumn"],
  html[data-milxdy-settings-theme="light"] [data-testid="sidebarColumn"] {
    background-color: #ffffff !important;
    color: #0f1419 !important;
    color-scheme: light !important;
  }

  html[data-milxdy-settings-theme="light"] [data-testid="primaryColumn"] > div > div:first-child,
  html[data-milxdy-settings-theme="light"] [data-testid="primaryColumn"] [role="navigation"],
  html[data-milxdy-settings-theme="light"] [data-testid="sidebarColumn"] [role="search"],
  html[data-milxdy-settings-theme="light"] [data-testid="sidebarColumn"] [role="search"] *,
  html[data-milxdy-settings-theme="light"] [aria-label="Search query"],
  html[data-milxdy-settings-theme="light"] [data-testid="SearchBox_Search_Input"],
  html[data-milxdy-settings-theme="light"] [data-testid="DMDrawer"],
  html[data-milxdy-settings-theme="light"] [data-testid="GrokDrawer"],
  html[data-milxdy-settings-theme="light"] [aria-label*="Grok" i][role="button"],
  html[data-milxdy-settings-theme="light"] [aria-label*="Chat" i][role="button"] {
    background-color: #ffffff !important;
    color: #0f1419 !important;
    border-color: #eff3f4 !important;
    color-scheme: light !important;
  }

  html[data-milxdy-settings-theme="light"] [data-testid="sidebarColumn"] [role="search"] > div,
  html[data-milxdy-settings-theme="light"] [data-testid="sidebarColumn"] [role="search"] label,
  html[data-milxdy-settings-theme="light"] [data-testid="sidebarColumn"] [role="search"] [dir],
  html[data-milxdy-settings-theme="light"] [data-testid="SearchBox_Search_Input"] {
    background-color: #eff3f4 !important;
    color: #0f1419 !important;
  }

  html[data-milxdy-settings-theme="light"] [style*="background-color: rgb(0, 0, 0)"],
  html[data-milxdy-settings-theme="light"] [style*="background-color: rgb(22, 24, 28)"],
  html[data-milxdy-settings-theme="light"] [style*="background-color: rgb(32, 35, 39)"],
  html[data-milxdy-settings-theme="light"] [style*="background-color: rgb(39, 44, 48)"],
  html[data-milxdy-settings-theme="light"] [style*="background-color: rgba(0, 0, 0"],
  html[data-milxdy-settings-theme="light"] [style*="background-color: rgba(22, 24, 28"],
  html[data-milxdy-settings-theme="light"] [style*="background-color: rgba(32, 35, 39"] {
    background-color: #ffffff !important;
  }

  html[data-milxdy-settings-theme="light"] [style*="background-color: rgb(21, 32, 43)"],
  html[data-milxdy-settings-theme="light"] [style*="background-color: rgb(25, 39, 52)"],
  html[data-milxdy-settings-theme="light"] [style*="background-color: rgb(30, 39, 50)"] {
    background-color: #f7f9f9 !important;
  }

  html[data-milxdy-settings-theme="light"] [style*="border-color: rgb(47, 51, 54)"],
  html[data-milxdy-settings-theme="light"] [style*="border-color: rgb(56, 68, 77)"],
  html[data-milxdy-settings-theme="light"] [style*="border-color: rgba(47, 51, 54"],
  html[data-milxdy-settings-theme="light"] [style*="border-color: rgba(56, 68, 77"],
  html[data-milxdy-settings-theme="light"] [style*="border-bottom-color: rgb(47, 51, 54)"],
  html[data-milxdy-settings-theme="light"] [style*="border-bottom-color: rgb(56, 68, 77)"],
  html[data-milxdy-settings-theme="light"] [style*="border-bottom-color: rgba(47, 51, 54"],
  html[data-milxdy-settings-theme="light"] [style*="border-bottom-color: rgba(56, 68, 77"] {
    border-color: #eff3f4 !important;
  }

  html[data-milxdy-settings-theme="light"] [style*="color: rgb(231, 233, 234)"],
  html[data-milxdy-settings-theme="light"] [style*="color: rgb(247, 249, 249)"] {
    color: #0f1419 !important;
  }

  html[data-milxdy-settings-theme="light"] [style*="color: rgb(113, 118, 123)"],
  html[data-milxdy-settings-theme="light"] [style*="color: rgb(139, 152, 165)"] {
    color: #536471 !important;
  }

  html[data-milxdy-settings-theme="dark"],
  html[data-milxdy-settings-theme="dark"] body,
  html[data-milxdy-settings-theme="dark"] #react-root,
  html[data-milxdy-settings-theme="dark"] main,
  html[data-milxdy-settings-theme="dark"] [data-testid="primaryColumn"],
  html[data-milxdy-settings-theme="dark"] [data-testid="sidebarColumn"] {
    background-color: #000000 !important;
    color: #e7e9ea !important;
    color-scheme: dark !important;
  }

  html[data-milxdy-settings-theme="dark"] [data-testid="primaryColumn"] > div > div:first-child,
  html[data-milxdy-settings-theme="dark"] [data-testid="primaryColumn"] [role="navigation"],
  html[data-milxdy-settings-theme="dark"] [data-testid="sidebarColumn"] [role="search"],
  html[data-milxdy-settings-theme="dark"] [data-testid="sidebarColumn"] [role="search"] *,
  html[data-milxdy-settings-theme="dark"] [aria-label="Search query"],
  html[data-milxdy-settings-theme="dark"] [data-testid="SearchBox_Search_Input"],
  html[data-milxdy-settings-theme="dark"] [data-testid="DMDrawer"],
  html[data-milxdy-settings-theme="dark"] [data-testid="GrokDrawer"],
  html[data-milxdy-settings-theme="dark"] [aria-label*="Grok" i][role="button"],
  html[data-milxdy-settings-theme="dark"] [aria-label*="Chat" i][role="button"] {
    background-color: #000000 !important;
    color: #e7e9ea !important;
    border-color: #2f3336 !important;
    color-scheme: dark !important;
  }

  html[data-milxdy-settings-theme="dark"] [data-testid="sidebarColumn"] [role="search"] > div,
  html[data-milxdy-settings-theme="dark"] [data-testid="sidebarColumn"] [role="search"] label,
  html[data-milxdy-settings-theme="dark"] [data-testid="sidebarColumn"] [role="search"] [dir],
  html[data-milxdy-settings-theme="dark"] [data-testid="SearchBox_Search_Input"] {
    background-color: #202327 !important;
    color: #e7e9ea !important;
  }

  html[data-milxdy-settings-theme="dark"] [style*="background-color: rgb(255, 255, 255)"],
  html[data-milxdy-settings-theme="dark"] [style*="background-color: rgb(247, 249, 249)"],
  html[data-milxdy-settings-theme="dark"] [style*="background-color: rgb(239, 243, 244)"],
  html[data-milxdy-settings-theme="dark"] [style*="background-color: rgba(255, 255, 255"],
  html[data-milxdy-settings-theme="dark"] [style*="background-color: rgba(247, 249, 249"],
  html[data-milxdy-settings-theme="dark"] [style*="background-color: rgba(239, 243, 244"] {
    background-color: #000000 !important;
  }

  html[data-milxdy-settings-theme="dark"] [style*="border-color: rgb(239, 243, 244)"],
  html[data-milxdy-settings-theme="dark"] [style*="border-color: rgb(207, 217, 222)"],
  html[data-milxdy-settings-theme="dark"] [style*="border-bottom-color: rgb(239, 243, 244)"],
  html[data-milxdy-settings-theme="dark"] [style*="border-bottom-color: rgb(207, 217, 222)"] {
    border-color: #2f3336 !important;
  }

  html[data-milxdy-settings-theme="dark"] [style*="color: rgb(15, 20, 25)"],
  html[data-milxdy-settings-theme="dark"] [style*="color: rgb(0, 0, 0)"] {
    color: #e7e9ea !important;
  }

  html[data-milxdy-settings-theme="dark"] [style*="color: rgb(83, 100, 113)"],
  html[data-milxdy-settings-theme="dark"] [style*="color: rgb(113, 118, 123)"] {
    color: #71767b !important;
  }

  html[data-milxdy-reskin-profile="moderate"] .remilia-wiki-preview,
  html[data-milxdy-reskin-profile="moderate"] .post-reading-player,
  html[data-milxdy-reskin-profile="moderate"] .post-reading-settings {
    border-color: color-mix(in srgb, var(--milxdy-pink-dark) 42%, var(--milxdy-border)) !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0) 38px),
      var(--milxdy-surface) !important;
    color: var(--milxdy-text) !important;
  }

  html[data-milxdy-reskin-profile="moderate"] .remilia-wiki-link {
    color: var(--remilia-wiki-link-color, var(--milxdy-pink-dark)) !important;
  }

  html[data-milxdy-reskin-profile="moderate"] .post-reading-button:hover,
  html[data-milxdy-reskin-profile="moderate"] .post-reading-button[aria-pressed="true"],
  html[data-milxdy-reskin-profile="moderate"] .post-reading-control:hover {
    color: var(--milxdy-pink-dark) !important;
    background: color-mix(in srgb, var(--milxdy-pink) 28%, transparent) !important;
  }

  html[data-milxdy-reskin-profile="moderate"] .reminet-badge-content,
  html[data-milxdy-reskin-profile="moderate"] .reminet-compact-badge {
    border: 1px solid color-mix(in srgb, var(--milxdy-rn-blue) 48%, var(--milxdy-border)) !important;
    border-radius: 5px !important;
    background: color-mix(in srgb, var(--milxdy-rn-blue) 10%, var(--milxdy-surface)) !important;
  }

  html[data-milxdy-reskin-profile="moderate"] #beetol-hunter-root {
    --beetol-accent: var(--milxdy-green);
    --beetol-accent-strong: #23784b;
  }

  html[data-milxdy-reskin-profile="max"] .remilia-wiki-preview,
  html[data-milxdy-reskin-profile="max"] .post-reading-player,
  html[data-milxdy-reskin-profile="max"] .post-reading-settings,
  html[data-milxdy-reskin-profile="max"] .reminet-tooltip {
    border: 1px solid var(--milxdy-border) !important;
    border-right: 3px solid #a3a3a3 !important;
    border-bottom: 4px solid #a3a3a3 !important;
    border-radius: 6px !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 38px),
      var(--milxdy-surface) !important;
    color: var(--milxdy-text) !important;
    box-shadow: var(--milxdy-frame-shadow) !important;
  }

  html[data-milxdy-reskin-profile="max"] .remilia-wiki-link {
    color: var(--milxdy-pink-dark) !important;
    text-decoration-style: solid !important;
  }

  html[data-milxdy-reskin-profile="max"] .post-reading-player {
    border-radius: 999px !important;
  }

  html[data-milxdy-reskin-profile="max"] .post-reading-button:hover,
  html[data-milxdy-reskin-profile="max"] .post-reading-button[aria-pressed="true"],
  html[data-milxdy-reskin-profile="max"] .post-reading-control:hover {
    color: var(--milxdy-pink-dark) !important;
    background: color-mix(in srgb, var(--milxdy-pink) 36%, transparent) !important;
  }

  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] .post-reading-player,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] .post-reading-settings,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] .post-reading-player,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] .post-reading-settings {
    border-color: color-mix(in srgb, var(--milxdy-border-dark) 72%, #ffffff 12%) !important;
    border-right-color: color-mix(in srgb, var(--milxdy-border-dark) 84%, #000000) !important;
    border-bottom-color: color-mix(in srgb, var(--milxdy-border-dark) 84%, #000000) !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0) 18px),
      linear-gradient(180deg, rgb(37, 39, 48), rgb(23, 24, 32)) !important;
    color: #f4ffe8 !important;
    box-shadow:
      0 8px 24px rgba(0, 0, 0, 0.42),
      inset 1px 1px 0 rgba(255, 255, 255, 0.12) !important;
  }

  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] .post-reading-title,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] .post-reading-ocr,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] .post-reading-hint,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] .post-reading-settings label,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] .post-reading-title,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] .post-reading-ocr,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] .post-reading-hint,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] .post-reading-settings label {
    color: #f4ffe8 !important;
  }

  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] .post-reading-control,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] .post-reading-close,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] .post-reading-control,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] .post-reading-close {
    color: #f4ffe8 !important;
  }

  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] .post-reading-control:hover,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] .post-reading-close:hover,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] .post-reading-control:hover,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] .post-reading-close:hover {
    color: #ffc2d2 !important;
    background: rgba(255, 194, 210, 0.14) !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-remistats-box="true"] .reminet-badge-content,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-remistats-box="true"] .reminet-compact-badge,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-remistats-box="true"] .reminet-incoming-poke-flag {
    border: 1px solid var(--milxdy-border) !important;
    border-right: 2px solid var(--milxdy-border-dark) !important;
    border-bottom: 2px solid var(--milxdy-border-dark) !important;
    border-radius: 5px !important;
    background: color-mix(in srgb, var(--milxdy-rn-blue) 16%, var(--milxdy-surface)) !important;
    color: var(--milxdy-rn-blue-dark) !important;
    box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.52) !important;
  }

  html[data-milxdy-reskin-profile="max"] #beetol-hunter-root {
    --beetol-accent: var(--milxdy-green);
    --beetol-accent-strong: #23784b;
    --beetol-panel: color-mix(in srgb, var(--milxdy-surface) 96%, transparent);
    --beetol-button: color-mix(in srgb, var(--milxdy-green-soft) 34%, var(--milxdy-surface));
    --beetol-border: var(--milxdy-border);
    --beetol-text: var(--milxdy-text);
    --beetol-muted: var(--milxdy-muted);
  }

  html[data-milxdy-reskin-profile="min"] .remilia-wiki-preview {
    border-radius: 6px !important;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.14) !important;
  }

  html[data-milxdy-reskin-profile="min"] .reminet-badge-content {
    padding-left: 4px !important;
    padding-right: 4px !important;
    background: transparent !important;
  }

  html[data-milxdy-reskin-profile="max"] {
    background:
      linear-gradient(180deg, rgba(217, 240, 214, 0.42), rgba(244, 255, 238, 0.2) 180px, transparent 360px),
      var(--milxdy-surface) !important;
    background-attachment: fixed, fixed !important;
    background-repeat: no-repeat, repeat !important;
    background-size: 100vw 420px, auto !important;
  }

  html[data-milxdy-reskin-profile="moderate"] {
    background: color-mix(in srgb, var(--milxdy-green-soft) 20%, var(--milxdy-surface)) !important;
  }

  html[data-milxdy-reskin-profile="max"] body,
  html[data-milxdy-reskin-profile="moderate"] body {
    background: transparent !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-background-fade="false"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-background-fade="false"] {
    background: var(--milxdy-surface) !important;
  }

  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"],
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"],
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]),
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) {
    background:
      linear-gradient(180deg, rgba(43, 70, 48, 0.4), rgba(16, 27, 19, 0.24) 180px, transparent 360px),
      var(--milxdy-surface) !important;
  }

  html[data-milxdy-reskin-profile="moderate"][style*="background-color: rgb(0, 0, 0)"],
  html[data-milxdy-reskin-profile="moderate"][style*="background-color: rgb(22, 24, 28)"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dark"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dim"] {
    background: color-mix(in srgb, var(--milxdy-green-soft) 14%, var(--milxdy-surface)) !important;
  }

  html[data-milxdy-reskin-profile="max"] body,
  html[data-milxdy-reskin-profile="max"] button,
  html[data-milxdy-reskin-profile="max"] input,
  html[data-milxdy-reskin-profile="max"] textarea,
  html[data-milxdy-reskin-profile="max"] select {
    font-family: var(--milxdy-font-ui) !important;
    letter-spacing: 0 !important;
  }

  html[data-milxdy-reskin-profile="moderate"] button,
  html[data-milxdy-reskin-profile="moderate"] input,
  html[data-milxdy-reskin-profile="moderate"] textarea,
  html[data-milxdy-reskin-profile="moderate"] select {
    font-family: var(--milxdy-font-ui) !important;
    letter-spacing: 0 !important;
  }

  html[data-milxdy-reskin-profile="max"] article [data-testid="tweetText"],
  html[data-milxdy-reskin-profile="max"] article [data-testid="tweetText"] *,
  html[data-milxdy-reskin-profile="max"] [data-testid="quoteTweet"] [data-testid="tweetText"],
  html[data-milxdy-reskin-profile="max"] [data-testid="quoteTweet"] [data-testid="tweetText"] * {
    font-family: var(--milxdy-font-tweet) !important;
    letter-spacing: 0 !important;
  }

  html[data-milxdy-reskin-profile="moderate"] article [data-testid="tweetText"],
  html[data-milxdy-reskin-profile="moderate"] article [data-testid="tweetText"] *,
  html[data-milxdy-reskin-profile="moderate"] [data-testid="quoteTweet"] [data-testid="tweetText"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="quoteTweet"] [data-testid="tweetText"] * {
    font-family: var(--milxdy-font-tweet) !important;
    letter-spacing: 0 !important;
  }

  html[data-milxdy-reskin-profile="max"] header[role="banner"],
  html[data-milxdy-reskin-profile="max"] header[role="banner"] *,
  html[data-milxdy-reskin-profile="max"] [data-testid="sidebarColumn"],
  html[data-milxdy-reskin-profile="max"] [data-testid="sidebarColumn"] *,
  html[data-milxdy-reskin-profile="max"] [data-testid="User-Name"],
  html[data-milxdy-reskin-profile="max"] [data-testid="User-Name"] *,
  html[data-milxdy-reskin-profile="max"] time,
  html[data-milxdy-reskin-profile="max"] [data-testid="app-bar-close"] {
    font-family: var(--milxdy-font-ui) !important;
    letter-spacing: 0 !important;
  }

  html[data-milxdy-reskin-profile="moderate"] header[role="banner"],
  html[data-milxdy-reskin-profile="moderate"] header[role="banner"] *,
  html[data-milxdy-reskin-profile="moderate"] article [data-testid="User-Name"],
  html[data-milxdy-reskin-profile="moderate"] article [data-testid="User-Name"] *,
  html[data-milxdy-reskin-profile="moderate"] [data-testid="primaryColumn"] [data-testid="UserName"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="primaryColumn"] [data-testid="UserName"] *,
  html[data-milxdy-reskin-profile="moderate"] article time,
  html[data-milxdy-reskin-profile="moderate"] [data-testid="app-bar-close"] {
    font-family: var(--milxdy-font-ui) !important;
    letter-spacing: 0 !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="User-Name"] span,
  html[data-milxdy-reskin-profile="max"] article time {
    font-family: var(--milxdy-font-mono) !important;
  }

  html[data-milxdy-reskin-profile="moderate"] article [data-testid="User-Name"] span,
  html[data-milxdy-reskin-profile="moderate"] article time {
    font-family: var(--milxdy-font-mono) !important;
  }

  html[data-milxdy-reskin-profile="moderate"] article [data-testid="User-Name"],
  html[data-milxdy-reskin-profile="moderate"] article [data-testid="User-Name"] *,
  html[data-milxdy-reskin-profile="moderate"] [data-testid="primaryColumn"] [data-testid="UserName"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="primaryColumn"] [data-testid="UserName"] *,
  html[data-milxdy-reskin-profile="moderate"] article time {
    font-family: TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    letter-spacing: 0 !important;
  }

  html[data-milxdy-reskin-profile="moderate"] [data-testid="UserDescription"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="UserDescription"] * {
    font-family: var(--milxdy-font-tweet) !important;
    letter-spacing: 0 !important;
  }

  html[data-milxdy-reskin-profile="moderate"] article [data-milxdy-tweet-header="true"] {
    align-items: center !important;
    column-gap: 4px !important;
    display: flex !important;
    flex-wrap: wrap !important;
    min-width: 0 !important;
    row-gap: 1px !important;
  }

  html[data-milxdy-reskin-profile="moderate"] article [data-milxdy-display-name-row="true"] {
    flex: 1 1 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    overflow: hidden !important;
  }

  html[data-milxdy-reskin-profile="moderate"] article [data-milxdy-display-name="true"],
  html[data-milxdy-reskin-profile="moderate"] article [data-milxdy-display-name="true"] span {
    max-width: 100% !important;
    min-width: 0 !important;
    overflow: hidden !important;
    overflow-wrap: normal !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  html[data-milxdy-reskin-profile="moderate"] article [data-milxdy-metadata-row="true"] {
    align-items: center !important;
    display: flex !important;
    flex: 1 1 100% !important;
    flex-wrap: nowrap !important;
    gap: 4px !important;
    max-width: 100% !important;
    min-height: 17px !important;
    min-width: 0 !important;
    overflow: visible !important;
  }

  html[data-milxdy-reskin-profile="moderate"] article [data-milxdy-metadata-row="true"] a,
  html[data-milxdy-reskin-profile="moderate"] article [data-milxdy-metadata-row="true"] div,
  html[data-milxdy-reskin-profile="moderate"] article [data-milxdy-metadata-row="true"] span {
    flex: 0 1 auto !important;
    max-width: none !important;
    min-width: auto !important;
    overflow: visible !important;
    overflow-wrap: normal !important;
    text-overflow: clip !important;
    white-space: nowrap !important;
  }

  html[data-milxdy-reskin-profile="moderate"] article [data-milxdy-metadata-row="true"] .reminet-badge-slot,
  html[data-milxdy-reskin-profile="moderate"] article [data-milxdy-metadata-row="true"] .reminet-score-badge {
    flex: 0 0 auto !important;
    margin-left: 4px !important;
    min-width: 0 !important;
  }

  html[data-milxdy-reskin-profile="max"] article [data-milxdy-tweet-header="true"],
  html[data-milxdy-reskin-profile="max"] article [data-milxdy-display-name-row="true"],
  html[data-milxdy-reskin-profile="max"] article [data-milxdy-metadata-row="true"] {
    min-width: 0 !important;
  }

  html[data-milxdy-reskin-profile="max"] article [data-milxdy-display-name-row="true"] {
    flex: 1 1 100% !important;
    max-width: 100% !important;
    overflow: hidden !important;
  }

  html[data-milxdy-reskin-profile="max"] article [data-milxdy-display-name="true"],
  html[data-milxdy-reskin-profile="max"] article [data-milxdy-display-name="true"] span {
    min-width: 0 !important;
    max-width: 100% !important;
    overflow: hidden !important;
    overflow-wrap: normal !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  html[data-milxdy-reskin-profile="max"] article [data-milxdy-metadata-row="true"] {
    align-items: center !important;
    display: flex !important;
    flex: 1 1 auto !important;
    flex-wrap: nowrap !important;
    gap: 4px !important;
    max-width: 100% !important;
    min-height: 17px !important;
    min-width: 0 !important;
    overflow: visible !important;
  }

  html[data-milxdy-reskin-profile="max"] article [data-milxdy-metadata-row="true"] a,
  html[data-milxdy-reskin-profile="max"] article [data-milxdy-metadata-row="true"] span {
    min-width: auto !important;
    max-width: none !important;
    overflow: visible !important;
    overflow-wrap: normal !important;
    text-overflow: clip !important;
    white-space: nowrap !important;
  }

  html[data-milxdy-reskin-profile="max"] article [data-milxdy-metadata-row="true"] .reminet-badge-slot,
  html[data-milxdy-reskin-profile="max"] article [data-milxdy-metadata-row="true"] .reminet-score-badge {
    flex: 0 0 auto !important;
    min-width: 0 !important;
  }

  html[data-milxdy-reskin-profile="max"] article [data-testid="User-Name"] time,
  html[data-milxdy-reskin-profile="max"] article [data-testid="User-Name"] time *,
  html[data-milxdy-reskin-profile="max"] article [data-testid="User-Name"] .miladymaxxer-level-inline,
  html[data-milxdy-reskin-profile="max"] article [data-testid="User-Name"] .reminet-score-badge {
    flex: 0 0 auto !important;
    white-space: nowrap !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="tweetPhoto"],
  html[data-milxdy-reskin-profile="max"] [data-testid="videoPlayer"],
  html[data-milxdy-reskin-profile="max"] div[aria-label="Image"] {
    max-height: var(--milxdy-max-media-height, none) !important;
  }

  html[data-milxdy-reskin-profile="max"]:not([data-milxdy-visual-max-media-height="0"]) [data-testid="tweetPhoto"],
  html[data-milxdy-reskin-profile="max"]:not([data-milxdy-visual-max-media-height="0"]) [data-testid="videoPlayer"],
  html[data-milxdy-reskin-profile="max"]:not([data-milxdy-visual-max-media-height="0"]) div[aria-label="Image"] {
    overflow: hidden !important;
  }

  html[data-milxdy-reskin-profile="max"]:not([data-milxdy-visual-max-media-height="0"]) [data-testid="tweetPhoto"] img,
  html[data-milxdy-reskin-profile="max"]:not([data-milxdy-visual-max-media-height="0"]) [data-testid="videoPlayer"] video,
  html[data-milxdy-reskin-profile="max"]:not([data-milxdy-visual-max-media-height="0"]) div[aria-label="Image"] img {
    max-height: var(--milxdy-max-media-height, none) !important;
    object-fit: contain !important;
  }

  html[data-milxdy-reskin-profile="moderate"]:not([data-milxdy-visual-max-media-height="0"]) [data-testid="tweetPhoto"],
  html[data-milxdy-reskin-profile="moderate"]:not([data-milxdy-visual-max-media-height="0"]) [data-testid="videoPlayer"],
  html[data-milxdy-reskin-profile="moderate"]:not([data-milxdy-visual-max-media-height="0"]) div[aria-label="Image"] {
    max-height: var(--milxdy-max-media-height, none) !important;
    overflow: hidden !important;
  }

  html[data-milxdy-reskin-profile="moderate"]:not([data-milxdy-visual-max-media-height="0"]) [data-testid="tweetPhoto"] img,
  html[data-milxdy-reskin-profile="moderate"]:not([data-milxdy-visual-max-media-height="0"]) [data-testid="videoPlayer"] video,
  html[data-milxdy-reskin-profile="moderate"]:not([data-milxdy-visual-max-media-height="0"]) div[aria-label="Image"] img {
    max-height: var(--milxdy-max-media-height, none) !important;
    object-fit: contain !important;
  }

  html[data-milxdy-reskin-profile="max"] main[role="main"] > div > div:first-child,
  html[data-milxdy-reskin-profile="max"] [data-testid="primaryColumn"] > div > div:first-child {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--milxdy-green-soft) 72%, #ffffff), color-mix(in srgb, var(--milxdy-green-soft) 26%, #ffffff)) !important;
    border-bottom: 1px solid var(--milxdy-green) !important;
    box-shadow: inset 2px 2px 1px rgba(255, 255, 255, 0.55) !important;
  }

  html[data-milxdy-reskin-profile="moderate"] main[role="main"] > div > div:first-child,
  html[data-milxdy-reskin-profile="moderate"] [data-testid="primaryColumn"] > div > div:first-child {
    background: color-mix(in srgb, var(--milxdy-green-soft) 42%, var(--milxdy-surface)) !important;
    border-bottom: 1px solid color-mix(in srgb, var(--milxdy-green) 38%, transparent) !important;
    box-shadow: none !important;
  }

  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] main[role="main"] > div > div:first-child,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] [data-testid="primaryColumn"] > div > div:first-child,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] main[role="main"] > div > div:first-child,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] [data-testid="primaryColumn"] > div > div:first-child,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) main[role="main"] > div > div:first-child,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) [data-testid="primaryColumn"] > div > div:first-child,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) main[role="main"] > div > div:first-child,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) [data-testid="primaryColumn"] > div > div:first-child {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--milxdy-green-soft) 78%, var(--milxdy-surface-2)), color-mix(in srgb, var(--milxdy-green-soft) 34%, var(--milxdy-surface))) !important;
    box-shadow: inset 2px 2px 1px rgba(255, 255, 255, 0.08) !important;
  }

  html[data-milxdy-reskin-profile="moderate"][style*="background-color: rgb(0, 0, 0)"] main[role="main"] > div > div:first-child,
  html[data-milxdy-reskin-profile="moderate"][style*="background-color: rgb(0, 0, 0)"] [data-testid="primaryColumn"] > div > div:first-child,
  html[data-milxdy-reskin-profile="moderate"][style*="background-color: rgb(22, 24, 28)"] main[role="main"] > div > div:first-child,
  html[data-milxdy-reskin-profile="moderate"][style*="background-color: rgb(22, 24, 28)"] [data-testid="primaryColumn"] > div > div:first-child,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dark"] main[role="main"] > div > div:first-child,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dark"] [data-testid="primaryColumn"] > div > div:first-child,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dim"] main[role="main"] > div > div:first-child,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dim"] [data-testid="primaryColumn"] > div > div:first-child {
    background: color-mix(in srgb, var(--milxdy-green-soft) 22%, var(--milxdy-surface-2)) !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="primaryColumn"],
  html[data-milxdy-reskin-profile="max"] [data-testid="sidebarColumn"] {
    border-color: var(--milxdy-border) !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="primaryColumn"] {
    background:
      repeating-linear-gradient(0deg, rgba(98, 107, 178, 0.028), rgba(98, 107, 178, 0.028) 1px, transparent 1px, transparent 8px),
      var(--milxdy-surface) !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="sidebarColumn"] section,
  html[data-milxdy-reskin-profile="max"] [data-testid="sidebarColumn"] [aria-label],
  html[data-milxdy-reskin-profile="max"] [data-testid="sidebarColumn"] [role="search"] {
    border-radius: 6px !important;
  }

  html[data-milxdy-reskin-profile="max"] header[role="banner"] nav a,
  html[data-milxdy-reskin-profile="max"] header[role="banner"] nav a *,
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Home_Link"],
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Home_Link"] *,
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Explore_Link"],
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Explore_Link"] *,
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Notifications_Link"],
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Notifications_Link"] *,
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Messages_Link"],
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Messages_Link"] * {
    font-family: var(--milxdy-font-ui) !important;
    letter-spacing: 0 !important;
    border-radius: 5px !important;
    color: var(--milxdy-green) !important;
    transition: background 120ms ease, transform 120ms ease !important;
  }

  html[data-milxdy-reskin-profile="moderate"] header[role="banner"] nav a,
  html[data-milxdy-reskin-profile="moderate"] header[role="banner"] nav a *,
  html[data-milxdy-reskin-profile="moderate"] [data-testid^="AppTabBar_"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid^="AppTabBar_"] *,
  html[data-milxdy-reskin-profile="moderate"] header[role="banner"] svg,
  html[data-milxdy-reskin-profile="moderate"] header[role="banner"] svg * {
    color: var(--milxdy-green) !important;
    fill: currentColor !important;
  }

  html[data-milxdy-reskin-profile="moderate"] [data-testid^="AppTabBar_"] span:not([aria-hidden="true"]),
  html[data-milxdy-reskin-profile="moderate"] header[role="banner"] nav a span:not([aria-hidden="true"]) {
    font-weight: 700 !important;
  }

  @media (prefers-color-scheme: dark) {
    html[data-milxdy-reskin-profile="max"] header[role="banner"] nav a,
    html[data-milxdy-reskin-profile="max"] header[role="banner"] nav a *,
    html[data-milxdy-reskin-profile="max"] [data-testid^="AppTabBar_"],
    html[data-milxdy-reskin-profile="max"] [data-testid^="AppTabBar_"] * {
      color: var(--milxdy-green) !important;
      fill: currentColor !important;
    }
  }

  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] header[role="banner"] nav a,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] header[role="banner"] nav a *,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] [data-testid^="AppTabBar_"],
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] [data-testid^="AppTabBar_"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] header[role="banner"] nav a,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] header[role="banner"] nav a *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] [data-testid^="AppTabBar_"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] [data-testid^="AppTabBar_"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] header[role="banner"] nav a,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] header[role="banner"] nav a *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] [data-testid^="AppTabBar_"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] [data-testid^="AppTabBar_"] *,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] header[role="banner"] nav a,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] header[role="banner"] nav a *,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] [data-testid^="AppTabBar_"],
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] [data-testid^="AppTabBar_"] *,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) header[role="banner"] nav a,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) header[role="banner"] nav a *,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) [data-testid^="AppTabBar_"],
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) [data-testid^="AppTabBar_"] *,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) header[role="banner"] nav a,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) header[role="banner"] nav a *,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) [data-testid^="AppTabBar_"],
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) [data-testid^="AppTabBar_"] * {
    color: var(--milxdy-green) !important;
    fill: currentColor !important;
  }

  html[data-milxdy-reskin-profile="max"] header[role="banner"] nav a:hover {
    background: color-mix(in srgb, var(--milxdy-green-soft) 42%, transparent) !important;
    transform: translate(1px, 1px) !important;
  }

  html[data-milxdy-reskin-profile="max"] header[role="banner"] nav a:hover *,
  html[data-milxdy-reskin-profile="max"] [data-testid^="AppTabBar_"]:hover,
  html[data-milxdy-reskin-profile="max"] [data-testid^="AppTabBar_"]:hover * {
    background-color: transparent !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Notifications_Link"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Notifications_Link"]:hover span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Messages_Link"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Messages_Link"]:hover span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] a[href="/notifications"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] a[href="/notifications"]:hover span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] a[href="/messages"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] a[href="/messages"]:hover span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Notifications_Link"] div[aria-live] span,
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Notifications_Link"]:hover div[aria-live] span,
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Messages_Link"] div[aria-live] span,
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Messages_Link"]:hover div[aria-live] span,
  html[data-milxdy-reskin-profile="max"] a[href="/notifications"] div[aria-live] span,
  html[data-milxdy-reskin-profile="max"] a[href="/notifications"]:hover div[aria-live] span,
  html[data-milxdy-reskin-profile="max"] a[href="/messages"] div[aria-live] span,
  html[data-milxdy-reskin-profile="max"] a[href="/messages"]:hover div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Notifications_Link"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Notifications_Link"]:hover span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Messages_Link"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Messages_Link"]:hover span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] a[href="/notifications"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] a[href="/notifications"]:hover span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] a[href="/messages"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] a[href="/messages"]:hover span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Notifications_Link"] div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Notifications_Link"]:hover div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Messages_Link"] div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Messages_Link"]:hover div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] a[href="/notifications"] div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] a[href="/notifications"]:hover div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] a[href="/messages"] div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] a[href="/messages"]:hover div[aria-live] span {
    background-color: rgb(29, 155, 240) !important;
    color: #ffffff !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Notifications_Link"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Notifications_Link"] div[aria-live] span,
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Messages_Link"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] [data-testid="AppTabBar_Messages_Link"] div[aria-live] span,
  html[data-milxdy-reskin-profile="max"] a[href="/notifications"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] a[href="/notifications"] div[aria-live] span,
  html[data-milxdy-reskin-profile="max"] a[href="/messages"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="max"] a[href="/messages"] div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Notifications_Link"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Notifications_Link"] div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Messages_Link"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="AppTabBar_Messages_Link"] div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] a[href="/notifications"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] a[href="/notifications"] div[aria-live] span,
  html[data-milxdy-reskin-profile="moderate"] a[href="/messages"] span[aria-hidden="true"],
  html[data-milxdy-reskin-profile="moderate"] a[href="/messages"] div[aria-live] span {
    align-items: center !important;
    border-radius: 3px !important;
    box-sizing: border-box !important;
    display: inline-flex !important;
    justify-content: center !important;
    line-height: 1 !important;
    min-height: 16px !important;
    min-width: 16px !important;
    padding: 0 4px !important;
    text-align: center !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-sidebar-bevel="true"] header[role="banner"] nav a,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-sidebar-bevel="true"] [data-testid^="AppTabBar_"] {
    border: 1px solid transparent !important;
    border-right-width: 2px !important;
    border-bottom-width: 2px !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-sidebar-bevel="true"] header[role="banner"] nav a:hover,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-sidebar-bevel="true"] [data-testid^="AppTabBar_"]:hover {
    border-color: color-mix(in srgb, var(--milxdy-green) 42%, transparent) !important;
    box-shadow: inset 1px 1px 0 rgba(255, 255, 255, 0.35) !important;
  }

  html[data-milxdy-reskin-profile="max"] header[role="banner"] svg {
    color: var(--milxdy-green) !important;
    fill: currentColor !important;
    stroke: currentColor !important;
  }

  @media (prefers-color-scheme: dark) {
    html[data-milxdy-reskin-profile] header[role="banner"],
    html[data-milxdy-reskin-profile] header[role="banner"] nav,
    html[data-milxdy-reskin-profile] header[role="banner"] a,
    html[data-milxdy-reskin-profile] header[role="banner"] a > div,
    html[data-milxdy-reskin-profile] header[role="banner"] svg,
    html[data-milxdy-reskin-profile] header[role="banner"] svg *,
    html[data-milxdy-reskin-profile] header[role="banner"] svg path,
    html[data-milxdy-reskin-profile] header[role="banner"] svg g,
    html[data-milxdy-reskin-profile] header[role="banner"] svg circle,
    html[data-milxdy-reskin-profile] header[role="banner"] svg rect {
      color: var(--milxdy-green) !important;
      fill: currentColor !important;
    }
  }

  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] header[role="banner"],
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] header[role="banner"] nav,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] header[role="banner"] a,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] header[role="banner"] a > div,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] header[role="banner"] svg,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] header[role="banner"] svg *,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] header[role="banner"] svg path,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] header[role="banner"] svg g,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] header[role="banner"] svg circle,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"] header[role="banner"] svg rect,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] header[role="banner"],
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] header[role="banner"] nav,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] header[role="banner"] a,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] header[role="banner"] a > div,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] header[role="banner"] svg,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] header[role="banner"] svg *,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] header[role="banner"] svg path,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] header[role="banner"] svg g,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] header[role="banner"] svg circle,
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"] header[role="banner"] svg rect {
    color: var(--milxdy-green) !important;
    fill: currentColor !important;
  }

  html[data-milxdy-reskin-profile="max"] header[role="banner"] svg *,
  html[data-milxdy-reskin-profile="max"] [data-testid^="AppTabBar_"] svg,
  html[data-milxdy-reskin-profile="max"] [data-testid^="AppTabBar_"] svg *,
  html[data-milxdy-reskin-profile="max"] header[role="banner"] nav a svg,
  html[data-milxdy-reskin-profile="max"] header[role="banner"] nav a svg * {
    color: var(--milxdy-green) !important;
    fill: currentColor !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] header[role="banner"] svg,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] header[role="banner"] svg *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] [data-testid^="AppTabBar_"] svg,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] [data-testid^="AppTabBar_"] svg *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] header[role="banner"] svg,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] header[role="banner"] svg *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] [data-testid^="AppTabBar_"] svg,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] [data-testid^="AppTabBar_"] svg *,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] header[role="banner"] svg,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] header[role="banner"] svg *,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] header[role="banner"] svg,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] header[role="banner"] svg * {
    color: var(--milxdy-green) !important;
    fill: currentColor !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="SideNav_NewTweet_Button"],
  html[data-milxdy-reskin-profile="max"] [data-testid="tweetButtonInline"],
  html[data-milxdy-reskin-profile="max"] [data-testid="tweetButton"] {
    border: 1px solid var(--milxdy-border-dark) !important;
    border-right: 3px solid var(--milxdy-border-dark) !important;
    border-bottom: 3px solid var(--milxdy-border-dark) !important;
    border-radius: 0 !important;
    background: var(--milxdy-rn-blue) !important;
    color: #ffffff !important;
    box-shadow: inset 2px 2px 1px rgba(255, 255, 255, 0.32) !important;
    text-transform: uppercase !important;
    transform: translate(0, 0) !important;
    transition: transform 80ms ease, box-shadow 80ms ease, filter 80ms ease !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="SideNav_NewTweet_Button"] svg,
  html[data-milxdy-reskin-profile="max"] [data-testid="SideNav_NewTweet_Button"] svg *,
  html[data-milxdy-reskin-profile="max"] [data-testid="tweetButtonInline"] svg,
  html[data-milxdy-reskin-profile="max"] [data-testid="tweetButtonInline"] svg *,
  html[data-milxdy-reskin-profile="max"] [data-testid="tweetButton"] svg,
  html[data-milxdy-reskin-profile="max"] [data-testid="tweetButton"] svg *,
  html[data-milxdy-reskin-profile="max"] a[href="/messages/compose"] svg,
  html[data-milxdy-reskin-profile="max"] a[href="/messages/compose"] svg *,
  html[data-milxdy-reskin-profile="max"] a[href="/i/chat/compose"] svg,
  html[data-milxdy-reskin-profile="max"] a[href="/i/chat/compose"] svg *,
  html[data-milxdy-reskin-profile="max"] [aria-label*="Compose"] svg,
  html[data-milxdy-reskin-profile="max"] [aria-label*="Compose"] svg *,
  html[data-milxdy-reskin-profile="max"] [aria-label*="New message"] svg,
  html[data-milxdy-reskin-profile="max"] [aria-label*="New message"] svg *,
  html[data-milxdy-reskin-profile="max"] [data-testid*="Compose"] svg,
  html[data-milxdy-reskin-profile="max"] [data-testid*="Compose"] svg *,
  html[data-milxdy-reskin-profile="max"] [data-testid*="compose"] svg,
  html[data-milxdy-reskin-profile="max"] [data-testid*="compose"] svg * {
    color: #ffffff !important;
    fill: currentColor !important;
    stroke: currentColor !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="SideNav_NewTweet_Button"]:hover,
  html[data-milxdy-reskin-profile="max"] [data-testid="tweetButtonInline"]:hover,
  html[data-milxdy-reskin-profile="max"] [data-testid="tweetButton"]:hover {
    filter: brightness(1.04) !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="SideNav_NewTweet_Button"]:active,
  html[data-milxdy-reskin-profile="max"] [data-testid="tweetButtonInline"]:active,
  html[data-milxdy-reskin-profile="max"] [data-testid="tweetButton"]:active {
    border-right-width: 1px !important;
    border-bottom-width: 1px !important;
    transform: translate(2px, 2px) !important;
    box-shadow:
      inset 2px 2px 4px rgba(0, 0, 0, 0.24),
      inset -1px -1px 0 rgba(255, 255, 255, 0.18) !important;
    filter: brightness(0.96) !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-post-button="flat"] [data-testid="SideNav_NewTweet_Button"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-post-button="flat"] [data-testid="tweetButtonInline"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-post-button="flat"] [data-testid="tweetButton"] {
    border-width: 1px !important;
    box-shadow: none !important;
    transform: none !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="SideNav_NewTweet_Button"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="tweetButtonInline"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="tweetButton"] {
    border: 1px solid var(--milxdy-border-dark) !important;
    border-right: 3px solid var(--milxdy-border-dark) !important;
    border-bottom: 3px solid var(--milxdy-border-dark) !important;
    border-radius: 0 !important;
    background: var(--milxdy-rn-blue) !important;
    color: #ffffff !important;
    box-shadow: none !important;
    filter: none !important;
    text-transform: uppercase !important;
    transform: translate(0, 0) !important;
    transition: transform 80ms ease !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="SideNav_NewTweet_Button"] *,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="tweetButtonInline"] *,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="tweetButton"] * {
    text-transform: uppercase !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="SideNav_NewTweet_Button"]:hover,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="tweetButtonInline"]:hover,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="tweetButton"]:hover {
    filter: none !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="SideNav_NewTweet_Button"]:active,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="tweetButtonInline"]:active,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-post-button="clickly"] [data-testid="tweetButton"]:active {
    border-right-width: 1px !important;
    border-bottom-width: 1px !important;
    transform: translate(2px, 2px) !important;
    box-shadow: none !important;
    filter: none !important;
  }

  html[data-milxdy-reskin-profile="max"] button:not(.post-reading-button):not(.post-reading-control):not(.reminet-poke-button):not(.beetol-action):not(.beetol-icon-btn),
  html[data-milxdy-reskin-profile="max"] [role="button"] {
    border-radius: 0 !important;
  }

  html[data-milxdy-reskin-profile="moderate"] button:not(.post-reading-button):not(.post-reading-control):not(.reminet-poke-button):not(.beetol-action):not(.beetol-icon-btn),
  html[data-milxdy-reskin-profile="moderate"] [role="button"] {
    border-radius: 0 !important;
  }

  html[data-milxdy-reskin-profile="max"] :is(
    [data-testid="dm-composer-attachment-button"],
    [data-testid="dm-composer-gif-button"],
    [data-testid="dm-composer-emoji-button"],
    [data-testid="dm-composer-send-button"],
    [data-testid="dm-composer-voice-button"]
  ) {
    border: 0 !important;
    border-radius: 999px !important;
    background: transparent !important;
    box-shadow: none !important;
    color: rgb(29, 155, 240) !important;
    text-shadow: none !important;
    text-transform: none !important;
    transform: none !important;
  }

  html[data-milxdy-reskin-profile="max"] :is(
    [data-testid="dm-composer-attachment-button"],
    [data-testid="dm-composer-gif-button"],
    [data-testid="dm-composer-emoji-button"],
    [data-testid="dm-composer-send-button"],
    [data-testid="dm-composer-voice-button"]
  ):hover {
    background: rgba(29, 155, 240, 0.1) !important;
    filter: none !important;
  }

  html[data-milxdy-reskin-profile="max"] :is(
    [data-testid="dm-composer-attachment-button"],
    [data-testid="dm-composer-gif-button"],
    [data-testid="dm-composer-emoji-button"],
    [data-testid="dm-composer-send-button"],
    [data-testid="dm-composer-voice-button"]
  ):where(:disabled, [aria-disabled="true"]) {
    opacity: 0.5 !important;
  }

  html[data-milxdy-reskin-profile="max"] :is(
    [data-testid="dm-composer-attachment-button"],
    [data-testid="dm-composer-gif-button"],
    [data-testid="dm-composer-emoji-button"],
    [data-testid="dm-composer-send-button"],
    [data-testid="dm-composer-voice-button"]
  ) svg,
  html[data-milxdy-reskin-profile="max"] :is(
    [data-testid="dm-composer-attachment-button"],
    [data-testid="dm-composer-gif-button"],
    [data-testid="dm-composer-emoji-button"],
    [data-testid="dm-composer-send-button"],
    [data-testid="dm-composer-voice-button"]
  ) svg * {
    color: rgb(29, 155, 240) !important;
    fill: currentColor !important;
    stroke: currentColor !important;
  }

  html[data-milxdy-reskin-profile="max"] :is(
    [data-testid="dm-composer-attachment-button"],
    [data-testid="dm-composer-gif-button"],
    [data-testid="dm-composer-emoji-button"],
    [data-testid="dm-composer-send-button"],
    [data-testid="dm-composer-voice-button"]
  ) * {
    color: rgb(29, 155, 240) !important;
  }

  html[data-milxdy-reskin-profile="max"] :is(
    [data-testid="dm-composer-textarea"],
    [data-testid="dm-composer-input"],
    [data-testid="dm-composer-editor"]
  ),
  html[data-milxdy-reskin-profile="max"] :is(
    [data-testid="dm-composer-textarea"],
    [data-testid="dm-composer-input"],
    [data-testid="dm-composer-editor"]
  ) * {
    font-family: var(--milxdy-font-tweet) !important;
    font-weight: 400 !important;
    letter-spacing: 0 !important;
    text-shadow: none !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="ScrollSnap-List"] {
    background: color-mix(in srgb, var(--milxdy-mint-bg) 36%, transparent) !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="cellInnerDiv"] > div,
  html[data-milxdy-reskin-profile="max"] article {
    border-color: color-mix(in srgb, var(--milxdy-border) 76%, transparent) !important;
  }

  html[data-milxdy-reskin-profile="max"] article:not([data-miladymaxxer-effect]) {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.5), rgba(255, 255, 255, 0) 34px),
      color-mix(in srgb, var(--milxdy-surface) 92%, var(--milxdy-mint-bg)) !important;
  }

  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] article:not([data-miladymaxxer-effect]),
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] article:not([data-miladymaxxer-effect]),
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"] article:not([data-miladymaxxer-effect]),
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"] article:not([data-miladymaxxer-effect]),
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) article:not([data-miladymaxxer-effect]),
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) article:not([data-miladymaxxer-effect]) {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.025), rgba(255, 255, 255, 0) 24px),
      color-mix(in srgb, var(--milxdy-surface) 86%, var(--milxdy-mint-bg)) !important;
  }

  html[data-milxdy-reskin-profile="max"] article,
  html[data-milxdy-reskin-profile="max"] article > div,
  html[data-milxdy-reskin-profile="max"] [data-testid="cellInnerDiv"] > div,
  html[data-milxdy-reskin-profile="max"] [data-testid="primaryColumn"],
  html[data-milxdy-reskin-profile="max"] [data-testid="sidebarColumn"],
  html[data-milxdy-reskin-profile="max"] [data-testid="sidebarColumn"] *,
  html[data-milxdy-reskin-profile="max"] [data-testid="tweetPhoto"],
  html[data-milxdy-reskin-profile="max"] [data-testid="videoPlayer"],
  html[data-milxdy-reskin-profile="max"] [data-testid="card.wrapper"],
  html[data-milxdy-reskin-profile="max"] [data-testid="card.layoutLarge.media"],
  html[data-milxdy-reskin-profile="max"] [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="max"] div[aria-label="Image"],
  html[data-milxdy-reskin-profile="max"] a[href*="/photo/"],
  html[data-milxdy-reskin-profile="max"] img {
    border-radius: 0 !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="tweetPhoto"] img,
  html[data-milxdy-reskin-profile="max"] [data-testid="videoPlayer"] video,
  html[data-milxdy-reskin-profile="max"] [data-testid="quoteTweet"] {
    border-radius: 0 !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="tweetPhoto"] + [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="max"] [data-testid="videoPlayer"] + [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="max"] [data-testid="card.wrapper"] + [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="max"] [data-testid="quoteTweet"] {
    margin-top: 0 !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="tweetPhoto"],
  html[data-milxdy-reskin-profile="max"] [data-testid="videoPlayer"],
  html[data-milxdy-reskin-profile="max"] [data-testid="quoteTweet"] {
    overflow: hidden !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="Tweet-User-Avatar"],
  html[data-milxdy-reskin-profile="max"] [data-testid="Tweet-User-Avatar"] *,
  html[data-milxdy-reskin-profile="max"] [data-testid="UserAvatar-Container-unknown"],
  html[data-milxdy-reskin-profile="max"] [data-testid="UserAvatar-Container-unknown"] *,
  html[data-milxdy-reskin-profile="max"] [aria-label="Timeline: Messages"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="max"] [aria-label="Timeline: Messages"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="max"] [data-testid="dm-container"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="max"] [data-testid="dm-container"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="max"] a[href*="/photo"] img[src*="profile_images"],
  html[data-milxdy-reskin-profile="max"] img[src*="profile_images"] {
    border-radius: 7px !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-square-media="false"] [data-testid="tweetPhoto"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-square-media="false"] [data-testid="tweetPhoto"] img,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-square-media="false"] [data-testid="videoPlayer"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-square-media="false"] [data-testid="videoPlayer"] video,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-square-media="false"] [data-testid="card.wrapper"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-square-media="false"] [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-square-media="false"] div[aria-label="Image"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-square-media="false"] a[href*="/photo/"] {
    border-radius: 16px !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-quote-media-gap="true"] [data-testid="tweetPhoto"] + [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-quote-media-gap="true"] [data-testid="videoPlayer"] + [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-quote-media-gap="true"] [data-testid="card.wrapper"] + [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-quote-media-gap="true"] [data-testid="quoteTweet"] {
    margin-top: 12px !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-square-media="true"] [data-testid="tweetPhoto"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-square-media="true"] [data-testid="tweetPhoto"] img,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-square-media="true"] [data-testid="videoPlayer"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-square-media="true"] [data-testid="videoPlayer"] video,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-square-media="true"] [data-testid="card.wrapper"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-square-media="true"] [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-square-media="true"] div[aria-label="Image"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-square-media="true"] a[href*="/photo/"] {
    border-radius: 0 !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-square-media="true"] [data-testid="tweetPhoto"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-square-media="true"] [data-testid="videoPlayer"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-square-media="true"] [data-testid="quoteTweet"] {
    overflow: hidden !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-quote-media-gap="true"] [data-testid="tweetPhoto"] + [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-quote-media-gap="true"] [data-testid="videoPlayer"] + [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-quote-media-gap="true"] [data-testid="card.wrapper"] + [data-testid="quoteTweet"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-quote-media-gap="true"] [data-testid="quoteTweet"] {
    margin-top: 12px !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="circle"] [data-testid="Tweet-User-Avatar"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="circle"] [data-testid="Tweet-User-Avatar"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="circle"] [data-testid="UserAvatar-Container-unknown"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="circle"] [data-testid="UserAvatar-Container-unknown"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="true"][data-milxdy-visual-pfp-shape="circle"] [aria-label="Timeline: Messages"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="true"][data-milxdy-visual-pfp-shape="circle"] [aria-label="Timeline: Messages"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="true"][data-milxdy-visual-pfp-shape="circle"] [data-testid="dm-container"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="true"][data-milxdy-visual-pfp-shape="circle"] [data-testid="dm-container"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="circle"] img[src*="profile_images"] {
    border-radius: 999px !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="square"] [data-testid="Tweet-User-Avatar"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="square"] [data-testid="Tweet-User-Avatar"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="square"] [data-testid="UserAvatar-Container-unknown"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="square"] [data-testid="UserAvatar-Container-unknown"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="true"][data-milxdy-visual-pfp-shape="square"] [aria-label="Timeline: Messages"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="true"][data-milxdy-visual-pfp-shape="square"] [aria-label="Timeline: Messages"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="true"][data-milxdy-visual-pfp-shape="square"] [data-testid="dm-container"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="true"][data-milxdy-visual-pfp-shape="square"] [data-testid="dm-container"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="square"] img[src*="profile_images"] {
    border-radius: 0 !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="rounded-square"][data-milxdy-visual-pfp-feed="true"] article [data-testid="Tweet-User-Avatar"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="rounded-square"][data-milxdy-visual-pfp-feed="true"] article [data-testid="Tweet-User-Avatar"] *,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="rounded-square"][data-milxdy-visual-pfp-feed="true"] article img[src*="profile_images"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="rounded-square"][data-milxdy-visual-pfp-notifications="true"] [aria-label="Timeline: Notifications"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="rounded-square"][data-milxdy-visual-pfp-notifications="true"] [aria-label="Timeline: Notifications"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="rounded-square"][data-milxdy-visual-pfp-notifications="true"] [aria-label="Timeline: Notifications"] img[src*="profile_images"] {
    border-radius: 7px !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="square"][data-milxdy-visual-pfp-feed="true"] article [data-testid="Tweet-User-Avatar"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="square"][data-milxdy-visual-pfp-feed="true"] article [data-testid="Tweet-User-Avatar"] *,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="square"][data-milxdy-visual-pfp-feed="true"] article img[src*="profile_images"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="square"][data-milxdy-visual-pfp-notifications="true"] [aria-label="Timeline: Notifications"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="square"][data-milxdy-visual-pfp-notifications="true"] [aria-label="Timeline: Notifications"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-pfp-shape="square"][data-milxdy-visual-pfp-notifications="true"] [aria-label="Timeline: Notifications"] img[src*="profile_images"] {
    border-radius: 0 !important;
  }

  html[data-milxdy-reskin-profile="moderate"] [data-testid="primaryColumn"] a[href*="/photo"] img[src*="profile_images"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="primaryColumn"] a[href*="/photo"] div[style*="border-radius"],
  html[data-milxdy-reskin-profile="moderate"] [data-testid="primaryColumn"] a[href*="/photo"] div[style*="overflow"] {
    border-radius: 0 !important;
  }

  html[data-milxdy-reskin-profile="moderate"] [data-testid="primaryColumn"] a[href*="/photo"] {
    border-radius: 0 !important;
    overflow: hidden !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-feed="false"] article [data-testid="Tweet-User-Avatar"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-feed="false"] article [data-testid="Tweet-User-Avatar"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-notifications="false"] [aria-label="Timeline: Notifications"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-notifications="false"] [aria-label="Timeline: Notifications"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="false"] [aria-label="Timeline: Messages"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="false"] [aria-label="Timeline: Messages"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="false"] [data-testid="dm-container"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="false"] [data-testid="dm-container"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="false"] [aria-label="Timeline: Messages"] img[src*="profile_images"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="false"] [data-testid="dm-container"] img[src*="profile_images"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="false"] [data-testid="dm-message-list"] img[src*="profile_images"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="false"] [data-testid="dm-message-list-container"] img[src*="profile_images"] {
    border-radius: 999px !important;
  }

  html[data-milxdy-reskin-profile="max"] article a {
    color: var(--milxdy-rn-blue-dark) !important;
    text-decoration-color: color-mix(in srgb, var(--milxdy-rn-blue) 60%, transparent) !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgb(232, 245, 253"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgb(232, 245, 253"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] article[data-testid="notification"][style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] article[data-testid="notification"][style*="background-color: rgb(232, 245, 253"] {
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--milxdy-green) 20%, transparent), transparent 72%),
      color-mix(in srgb, var(--milxdy-green-soft) 38%, var(--milxdy-surface)) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--milxdy-green) 18%, transparent) !important;
    position: relative !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgb(22, 36, 46"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgb(22, 36, 46"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgb(22, 36, 46"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgb(22, 36, 46"] {
    background:
      linear-gradient(90deg, rgba(201, 240, 168, 0.24), rgba(201, 240, 168, 0.05) 58%, rgba(201, 240, 168, 0) 86%),
      rgb(31, 42, 34) !important;
    box-shadow:
      inset 0 0 0 1px rgba(201, 240, 168, 0.2),
      inset 3px 0 0 rgba(201, 240, 168, 0.95) !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgb(232, 245, 253"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgb(232, 245, 253"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] article[data-testid="notification"][style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] article[data-testid="notification"][style*="background-color: rgb(232, 245, 253"] {
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--milxdy-green) 16%, transparent), transparent 72%),
      color-mix(in srgb, var(--milxdy-green-soft) 28%, var(--milxdy-surface)) !important;
    box-shadow: inset 3px 0 0 color-mix(in srgb, var(--milxdy-green) 64%, transparent) !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgb(22, 36, 46"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgb(22, 36, 46"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"][style*="background-color: rgb(22, 36, 46"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgba(29, 155, 240"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [aria-label="Timeline: Notifications"] [data-testid="cellInnerDiv"] > div[style*="background-color: rgb(22, 36, 46"] {
    background:
      linear-gradient(90deg, rgba(201, 240, 168, 0.18), rgba(201, 240, 168, 0.04) 58%, rgba(201, 240, 168, 0) 86%),
      rgb(31, 42, 34) !important;
    box-shadow: inset 3px 0 0 rgba(201, 240, 168, 0.78) !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"]:has(article[data-testid="notification"][data-milxdy-notification-unread="true"]) > div,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"][data-milxdy-notification-unread="true"] > div,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] article[data-testid="notification"][data-milxdy-notification-unread="true"] {
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--milxdy-green) 20%, transparent), transparent 72%),
      color-mix(in srgb, var(--milxdy-green-soft) 38%, var(--milxdy-surface)) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--milxdy-green) 18%, transparent) !important;
    position: relative !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"]:has(article[data-testid="notification"][data-milxdy-notification-unread="true"]) > div,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"][data-milxdy-notification-unread="true"] > div {
    overflow: hidden !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"]:has(article[data-testid="notification"][data-milxdy-notification-unread="true"]) > div::before,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"][data-milxdy-notification-unread="true"] > div::before {
    background: color-mix(in srgb, var(--milxdy-green) 72%, var(--milxdy-rn-blue)) !important;
    content: "" !important;
    display: block !important;
    height: 100% !important;
    left: 0 !important;
    opacity: 0.92 !important;
    position: absolute !important;
    pointer-events: none !important;
    top: 0 !important;
    width: 3px !important;
    z-index: 1 !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"]:has(article[data-testid="notification"][data-milxdy-notification-unread="true"]) > div,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"][data-milxdy-notification-unread="true"] > div,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] article[data-testid="notification"][data-milxdy-notification-unread="true"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"]:has(article[data-testid="notification"][data-milxdy-notification-unread="true"]) > div,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"][data-milxdy-notification-unread="true"] > div,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] article[data-testid="notification"][data-milxdy-notification-unread="true"] {
    background:
      linear-gradient(90deg, rgba(201, 240, 168, 0.24), rgba(201, 240, 168, 0.05) 58%, rgba(201, 240, 168, 0) 86%),
      rgb(31, 42, 34) !important;
    box-shadow:
      inset 0 0 0 1px rgba(201, 240, 168, 0.2),
      inset 3px 0 0 rgba(201, 240, 168, 0.95) !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"]:has(article[data-testid="notification"][data-milxdy-notification-unread="true"]) > div::before,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"][data-milxdy-notification-unread="true"] > div::before,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"]:has(article[data-testid="notification"][data-milxdy-notification-unread="true"]) > div::before,
  html[data-milxdy-reskin-profile="max"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"][data-milxdy-notification-unread="true"] > div::before {
    background: #c9f0a8 !important;
    opacity: 1 !important;
    width: 4px !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"][data-milxdy-notification-unread="true"] > div,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-notification-unread-tint="true"] article[data-testid="notification"][data-milxdy-notification-unread="true"] {
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--milxdy-green) 16%, transparent), transparent 72%),
      color-mix(in srgb, var(--milxdy-green-soft) 28%, var(--milxdy-surface)) !important;
    box-shadow: inset 3px 0 0 color-mix(in srgb, var(--milxdy-green) 64%, transparent) !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"][data-milxdy-notification-unread="true"] > div,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dark"][data-milxdy-visual-notification-unread-tint="true"] article[data-testid="notification"][data-milxdy-notification-unread="true"],
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"][data-milxdy-notification-unread="true"] > div,
  html[data-milxdy-reskin-profile="moderate"][data-milxdy-x-theme="dim"][data-milxdy-visual-notification-unread-tint="true"] article[data-testid="notification"][data-milxdy-notification-unread="true"] {
    background:
      linear-gradient(90deg, rgba(201, 240, 168, 0.18), rgba(201, 240, 168, 0.04) 58%, rgba(201, 240, 168, 0) 86%),
      rgb(31, 42, 34) !important;
    box-shadow: inset 3px 0 0 rgba(201, 240, 168, 0.78) !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-new-posts-pill="true"] [data-milxdy-show-new-posts="true"] {
    transition: background 80ms ease, transform 80ms ease !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-new-posts-pill="true"] [data-milxdy-show-new-posts="true"] span {
    border-radius: 999px !important;
    padding: 4px 12px !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-new-posts-pill="true"] [data-milxdy-show-new-posts="true"]:hover {
    background: transparent !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-new-posts-pill="true"] [data-milxdy-show-new-posts="true"]:hover span {
    background: color-mix(in srgb, var(--milxdy-green-soft) 52%, transparent) !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-new-posts-pill="true"] [data-milxdy-show-new-posts="true"]:active span {
    transform: translate(1px, 1px) !important;
    filter: brightness(0.94) !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-new-posts-pill="true"] [data-milxdy-show-new-posts="true"] {
    transition: background 80ms ease, transform 80ms ease !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-new-posts-pill="true"] [data-milxdy-show-new-posts="true"] span {
    border-radius: 999px !important;
    padding: 4px 12px !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-new-posts-pill="true"] [data-milxdy-show-new-posts="true"]:hover {
    background: transparent !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-new-posts-pill="true"] [data-milxdy-show-new-posts="true"]:hover span {
    background: color-mix(in srgb, var(--milxdy-green-soft) 42%, transparent) !important;
  }

  html[data-milxdy-reskin-profile="moderate"][data-milxdy-visual-new-posts-pill="true"] [data-milxdy-show-new-posts="true"]:active span {
    transform: translate(1px, 1px) !important;
    filter: brightness(0.94) !important;
  }

  html[data-milxdy-visual-remistats-box="false"] .reminet-badge-content,
  html[data-milxdy-visual-remistats-box="false"] .reminet-compact-badge,
  html[data-milxdy-visual-remistats-box="false"] .reminet-incoming-poke-flag {
    border-color: transparent !important;
    border-right-color: transparent !important;
    border-bottom-color: transparent !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  html[data-milxdy-visual-incoming-poke-gold="true"] .reminet-incoming-poke-flag,
  html[data-milxdy-visual-remistats-box="false"][data-milxdy-visual-incoming-poke-gold="true"] .reminet-incoming-poke-flag {
    border-color: rgba(199, 142, 15, 0.58) !important;
    background:
      linear-gradient(135deg, rgba(255, 247, 186, 0.92) 0%, rgba(246, 203, 79, 0.82) 45%, rgba(178, 112, 9, 0.9) 100%) !important;
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.72),
      0 0 0 1px rgba(255, 231, 146, 0.18),
      0 0 10px rgba(246, 203, 79, 0.34) !important;
    color: #4d3000 !important;
    text-shadow: 0 1px 0 rgba(255, 255, 255, 0.55) !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="like"] svg,
  html[data-milxdy-reskin-profile="max"] [data-testid="reply"] svg,
  html[data-milxdy-reskin-profile="max"] [data-testid="retweet"] svg,
  html[data-milxdy-reskin-profile="max"] [data-testid="bookmark"] svg,
  html[data-milxdy-reskin-profile="max"] [data-testid="share"] svg {
    color: var(--milxdy-border-dark) !important;
  }

  html[data-milxdy-reskin-profile="max"] [aria-label="Timeline: Trending now"],
  html[data-milxdy-reskin-profile="max"] [aria-label="Who to follow"],
  html[data-milxdy-reskin-profile="max"] aside [role="complementary"] > div > div {
    border: 1px solid var(--milxdy-border) !important;
    border-right: 3px solid #a3a3a3 !important;
    border-bottom: 4px solid #a3a3a3 !important;
    border-radius: 0 !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 38px),
      var(--milxdy-surface) !important;
    box-shadow: var(--milxdy-frame-shadow) !important;
    overflow: hidden !important;
  }

  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] [aria-label="Timeline: Trending now"],
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] [aria-label="Who to follow"],
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] aside [role="complementary"] > div > div,
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] [aria-label="Timeline: Trending now"],
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] [aria-label="Who to follow"],
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] aside [role="complementary"] > div > div,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) [aria-label="Timeline: Trending now"],
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) [aria-label="Who to follow"],
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) aside [role="complementary"] > div > div,
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) [aria-label="Timeline: Trending now"],
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) [aria-label="Who to follow"],
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) aside [role="complementary"] > div > div {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0) 38px),
      var(--milxdy-surface) !important;
  }

  html[data-milxdy-reskin-profile="max"] [role="tablist"] [role="tab"][aria-selected="true"] {
    color: var(--milxdy-rn-blue-dark) !important;
  }

  html[data-milxdy-reskin-profile="max"] [role="tablist"] [role="tab"][aria-selected="true"]::after {
    background: var(--milxdy-rn-blue) !important;
  }

  html[data-milxdy-reskin-profile="max"] div[role="dialog"],
  html[data-milxdy-reskin-profile="max"] div[aria-modal="true"] {
    border: 1px solid var(--milxdy-border) !important;
    border-right: 3px solid #a3a3a3 !important;
    border-bottom: 4px solid #a3a3a3 !important;
    border-radius: 0 !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 38px),
      var(--milxdy-surface) !important;
  }

  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] div[role="dialog"],
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(0, 0, 0)"] div[aria-modal="true"],
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] div[role="dialog"],
  html[data-milxdy-reskin-profile="max"][style*="background-color: rgb(22, 24, 28)"] div[aria-modal="true"],
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) div[role="dialog"],
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(0, 0, 0)"]) div[aria-modal="true"],
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) div[role="dialog"],
  html[data-milxdy-reskin-profile="max"]:has(body[style*="background-color: rgb(22, 24, 28)"]) div[aria-modal="true"] {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.045), rgba(255, 255, 255, 0) 38px),
      var(--milxdy-surface) !important;
  }

  html[data-milxdy-reskin-profile="max"] #milxdy-reminet-chat-root .milxdy-chat-card,
  html[data-milxdy-reskin-profile="max"] #beetol-hunter-root .beetol-panel,
  html[data-milxdy-reskin-profile="max"] #beetol-hunter-root .beetol-tab {
    border-radius: 0 !important;
    border-right-width: 3px !important;
    border-bottom-width: 4px !important;
  }

  html[data-milxdy-reskin-profile="moderate"] .reminet-tooltip,
  html[data-milxdy-reskin-profile="max"] .reminet-tooltip {
    border-radius: 6px !important;
    border-right-width: 3px !important;
    border-bottom-width: 4px !important;
  }

  html[data-milxdy-reskin-profile="min"] .reminet-tooltip,
  html[data-milxdy-reskin-profile="min"] .post-reading-player,
  html[data-milxdy-reskin-profile="min"] #beetol-hunter-root {
    box-shadow: none !important;
  }

  html[data-milxdy-visual-app-window-style="reminet"] .milxdy-overlay-app-shell,
  html[data-milxdy-visual-app-window-style="reminet"] #milxdy-app-hub-panel,
  html[data-milxdy-visual-app-window-style="reminet"] .miladymaxxer-panel {
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
  }

  html[data-milxdy-visual-app-window-style="reminet"] #milxdy-app-hub-panel {
    --milxdy-hub-face: #fbfbfb;
    --milxdy-hub-panel: #e5e5e5;
    --milxdy-hub-list: #ffffff;
    --milxdy-hub-input: #ffffff;
    --milxdy-hub-border-light: #ffffff;
    --milxdy-hub-border-dark: #a3a3a3;
    --milxdy-hub-outline: #b4b4b4;
    --milxdy-hub-title: #d4d4d4;
    --milxdy-hub-title-text: #171f82;
    --milxdy-hub-button: #d4d4d4;
    --milxdy-hub-row: #f8f8fb;
    --milxdy-hub-row-hover: #ffffff;
    --milxdy-hub-row-line: rgba(98, 107, 178, 0.2);
    --milxdy-hub-text: #19191d;
    --milxdy-hub-muted: rgba(0, 0, 0, 0.58);
    --milxdy-hub-soft: rgba(0, 0, 0, 0.72);
    --milxdy-hub-accent: #171f82;
    --milxdy-hub-button-border: #b4b4b4;
    border: 1px solid var(--milxdy-hub-outline) !important;
    border-right: 3px solid var(--milxdy-hub-border-dark) !important;
    border-bottom: 4px solid var(--milxdy-hub-border-dark) !important;
    border-radius: 6px !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 42px),
      var(--milxdy-hub-face) !important;
    box-shadow:
      inset 2px 2px 1px var(--milxdy-hub-border-light),
      4px 4px 0 rgba(0, 0, 0, 0.22) !important;
  }

  html[data-milxdy-visual-app-window-style="reminet"] .miladymaxxer-panel {
    --miladymaxxer-panel-face: #fbfbfb;
    --miladymaxxer-panel-surface: #e5e5e5;
    --miladymaxxer-panel-list: #ffffff;
    --miladymaxxer-panel-input: #ffffff;
    --miladymaxxer-panel-border-light: #ffffff;
    --miladymaxxer-panel-border-dark: #a3a3a3;
    --miladymaxxer-panel-outline: #b4b4b4;
    --miladymaxxer-panel-title: #d4d4d4;
    --miladymaxxer-panel-title-text: #171f82;
    --miladymaxxer-panel-button: #d4d4d4;
    --miladymaxxer-panel-row: #f8f8fb;
    --miladymaxxer-panel-row-hover: #ffffff;
    --miladymaxxer-panel-line: rgba(98, 107, 178, 0.2);
    --miladymaxxer-panel-text: #19191d;
    --miladymaxxer-panel-muted: rgba(0, 0, 0, 0.58);
    --miladymaxxer-panel-soft: rgba(0, 0, 0, 0.72);
    --miladymaxxer-panel-accent: #171f82;
    --miladymaxxer-panel-button-border: #b4b4b4;
    border: 1px solid var(--miladymaxxer-panel-outline) !important;
    border-right: 3px solid var(--miladymaxxer-panel-border-dark) !important;
    border-bottom: 4px solid var(--miladymaxxer-panel-border-dark) !important;
    border-radius: 6px !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0) 42px),
      var(--miladymaxxer-panel-face) !important;
    box-shadow:
      inset 2px 2px 1px var(--miladymaxxer-panel-border-light),
      4px 4px 0 rgba(0, 0, 0, 0.22) !important;
  }

  html[data-milxdy-visual-app-window-style="reminet"] #milxdy-app-hub-panel .milxdy-app-hub-header,
  html[data-milxdy-visual-app-window-style="reminet"] .miladymaxxer-panel-header {
    border: 0 !important;
    border-bottom: 1px solid var(--milxdy-overlay-app-border, #b4b4b4) !important;
    border-radius: 0 !important;
    background: var(--milxdy-overlay-app-surface-3, #d4d4d4) !important;
    box-shadow: inset 2px 2px 1px rgba(255, 255, 255, 0.52) !important;
  }

  html[data-milxdy-visual-app-window-style="reminet"] #milxdy-app-hub-panel .milxdy-app-hub-header strong,
  html[data-milxdy-visual-app-window-style="reminet"] .miladymaxxer-panel-header strong {
    color: var(--milxdy-overlay-app-title, #171f82) !important;
    text-shadow: 1px 1px 0 #ffffff !important;
  }

  html[data-milxdy-visual-app-window-style="reminet"] #milxdy-app-hub-panel button,
  html[data-milxdy-visual-app-window-style="reminet"] .miladymaxxer-panel button {
    border-width: 1px 3px 3px 1px !important;
    border-radius: 5px !important;
  }

  html[data-milxdy-visual-app-window-style="classic"] .milxdy-overlay-app-shell,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-reminet-chat-root,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-miladychan-root,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-music-root {
    --milxdy-overlay-app-surface: #d4d0c8;
    --milxdy-overlay-app-surface-2: #ece9df;
    --milxdy-overlay-app-surface-3: #000080;
    --milxdy-overlay-app-border: #808080;
    --milxdy-overlay-app-bevel-shadow: #404040;
    --milxdy-overlay-app-highlight: #ffffff;
    --milxdy-overlay-app-accent: #000080;
    --milxdy-overlay-app-title: #ffffff;
    --milxdy-overlay-app-text: #101014;
    --milxdy-overlay-app-muted: rgba(16, 16, 20, 0.62);
  }

  html[data-milxdy-visual-app-window-style="classic"] #milxdy-reminet-chat-root,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-miladychan-root {
    --rn-accent: #000080;
    --rn-link: #ffffff;
    --rn-surface-1: #d4d0c8;
    --rn-surface-2: #ece9df;
    --rn-surface-3: #000080;
    --rn-border: #808080;
    --rn-border-dark: #404040;
    --rn-text: #101014;
    --rn-muted: rgba(16, 16, 20, 0.62);
    --rn-highlight: #ffffff;
    --mc-accent: #000080;
    --mc-link: #ffffff;
    --mc-surface-1: #d4d0c8;
    --mc-surface-2: #ece9df;
    --mc-surface-3: #000080;
    --mc-border: #808080;
    --mc-border-dark: #404040;
    --mc-text: #101014;
    --mc-muted: rgba(16, 16, 20, 0.62);
    --mc-highlight: #ffffff;
  }

  html[data-milxdy-visual-app-window-style="classic"] #milxdy-music-root {
    --music-surface: #d4d0c8;
    --music-panel: #ece9df;
    --music-bar: #d4d0c8;
    --music-border: #808080;
    --music-border-dark: #404040;
    --music-text: #101014;
    --music-muted: rgba(16, 16, 20, 0.62);
    --music-link: #000080;
    --music-accent: #000080;
    --music-header-bg: #000080;
    --music-body-bg: #ece9df;
    --music-player-bg: #d4d0c8;
    --music-control: #d4d0c8;
    --music-control-border: #808080;
    --music-control-highlight: #ffffff;
    --music-control-shadow: #404040;
  }

  html[data-milxdy-visual-app-window-style="classic"] .milxdy-overlay-app-card,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-reminet-chat-root .milxdy-chat-card,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-miladychan-root .milxdy-chan-card,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-music-root .milxdy-music-card {
    border: 2px solid var(--milxdy-overlay-app-border, #808080) !important;
    border-radius: 0 !important;
    background: var(--milxdy-overlay-app-surface, #d4d0c8) !important;
    box-shadow:
      inset 2px 2px 0 var(--milxdy-overlay-app-highlight, #ffffff),
      inset -2px -2px 0 var(--milxdy-overlay-app-bevel-shadow, #404040),
      8px 8px 0 rgba(0, 0, 0, 0.24) !important;
  }

  html[data-milxdy-visual-app-window-style="classic"] .milxdy-overlay-app-card::before,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-reminet-chat-root .milxdy-chat-card::before,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-miladychan-root .milxdy-chan-card::before,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-music-root .milxdy-music-card::before {
    opacity: 0 !important;
  }

  html[data-milxdy-visual-app-window-style="classic"] .milxdy-overlay-app-header,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-reminet-chat-root .milxdy-chat-header,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-miladychan-root .milxdy-chan-header,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-music-root .milxdy-music-header {
    border: 2px solid var(--milxdy-overlay-app-border, #808080) !important;
    background: var(--milxdy-overlay-app-surface-3, #000080) !important;
    box-shadow:
      inset 2px 2px 0 var(--milxdy-overlay-app-highlight, #ffffff),
      inset -2px -2px 0 var(--milxdy-overlay-app-bevel-shadow, #404040) !important;
  }

  html[data-milxdy-visual-app-window-style="classic"] .milxdy-overlay-app-header strong,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-reminet-chat-root .milxdy-chat-header strong,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-miladychan-root .milxdy-chan-header strong,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-music-root .milxdy-music-title strong {
    color: var(--milxdy-overlay-app-title, #ffffff) !important;
    text-shadow: none !important;
  }

  html[data-milxdy-visual-app-window-style="classic"] .milxdy-overlay-app-header span,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-reminet-chat-root .milxdy-chat-header span,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-miladychan-root .milxdy-chan-header span,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-music-root .milxdy-music-title span {
    color: rgba(255, 255, 255, 0.72) !important;
  }

  html[data-milxdy-visual-app-window-style="classic"] .milxdy-overlay-app-header button,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-reminet-chat-root .milxdy-chat-header button,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-miladychan-root .milxdy-chan-header button,
  html[data-milxdy-visual-app-window-style="classic"] #milxdy-music-root .milxdy-music-header button {
    border-width: 2px !important;
    border-radius: 0 !important;
    background: var(--milxdy-overlay-app-surface, #d4d0c8) !important;
    color: #101014 !important;
    box-shadow:
      inset 2px 2px 0 var(--milxdy-overlay-app-highlight, #ffffff),
      inset -2px -2px 0 var(--milxdy-overlay-app-bevel-shadow, #404040) !important;
  }

  html[data-milxdy-visual-app-shadows="false"] .milxdy-overlay-app-card,
  html[data-milxdy-visual-app-shadows="false"] #milxdy-app-hub-panel,
  html[data-milxdy-visual-app-shadows="false"] #milxdy-wiki-sidebar-root,
  html[data-milxdy-visual-app-shadows="false"] .post-reading-player,
  html[data-milxdy-visual-app-shadows="false"] .post-reading-box,
  html[data-milxdy-visual-app-shadows="false"] #milxdy-music-root .milxdy-music-card,
  html[data-milxdy-visual-app-shadows="false"] #milxdy-reminet-chat-root .milxdy-chat-card,
  html[data-milxdy-visual-app-shadows="false"] #milxdy-miladychan-root .milxdy-chan-card,
  html[data-milxdy-visual-app-shadows="false"] #beetol-hunter-root .beetol-panel,
  html[data-milxdy-visual-app-shadows="false"] #beetol-hunter-root .beetol-tab,
  html[data-milxdy-visual-app-shadows="false"] .miladymaxxer-panel {
    box-shadow: none !important;
    filter: none !important;
  }

  html[data-milxdy-reskin-profile="max"] [data-testid="primaryColumn"],
  html[data-milxdy-reskin-profile="max"] [data-testid="sidebarColumn"],
  html[data-milxdy-reskin-profile="max"] [data-testid="cellInnerDiv"],
  html[data-milxdy-reskin-profile="max"] [data-testid="cellInnerDiv"] > div,
  html[data-milxdy-reskin-profile="max"] article,
  html[data-milxdy-reskin-profile="max"] header[role="banner"],
  html[data-milxdy-reskin-profile="max"] header[role="banner"] nav,
  html[data-milxdy-reskin-profile="max"] header[role="banner"] nav a,
  html[data-milxdy-reskin-profile="max"] [role="button"],
  html[data-milxdy-reskin-profile="max"] button {
    transition-property: background-color, color, opacity, filter, transform, box-shadow, border-color !important;
  }

  @media (prefers-reduced-motion: reduce) {
    html[data-milxdy-reskin-profile] *,
    html[data-milxdy-reskin-profile] *::before,
    html[data-milxdy-reskin-profile] *::after {
      animation-duration: 0.001ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      scroll-behavior: auto !important;
    }
  }
`;

export function injectReskinStyles(): void {
  if (document.getElementById(RESKIN_STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = RESKIN_STYLE_ID;
  style.textContent = RESKIN_CSS.replaceAll("__MILXDY_FONT_BASE__", chrome.runtime.getURL("remilia-fonts/"));
  document.documentElement.appendChild(style);
}
