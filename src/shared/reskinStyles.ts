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

  html[data-milxdy-reskin-profile][style*="background-color: rgb(0, 0, 0)"],
  html[data-milxdy-reskin-profile][style*="background-color: rgb(22, 24, 28)"],
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dark"],
  html[data-milxdy-reskin-profile][data-milxdy-x-theme="dim"],
  html[data-milxdy-reskin-profile]:has(body[style*="background-color: rgb(0, 0, 0)"]),
  html[data-milxdy-reskin-profile]:has(body[style*="background-color: rgb(22, 24, 28)"]) {
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
  html[data-milxdy-reskin-profile] .postreader-player,
  html[data-milxdy-reskin-profile] .postreader-settings,
  html[data-milxdy-reskin-profile] .reminet-tooltip,
  html[data-milxdy-reskin-profile] #beetol-hunter-root .beetol-panel,
  html[data-milxdy-reskin-profile] #beetol-hunter-root .beetol-tab,
  html[data-milxdy-reskin-profile] #milxdy-reminet-chat-root .milxdy-chat-card {
    font-family: "Milxdy Remilia Hei", "Milxdy Remilia Menlo", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    letter-spacing: 0 !important;
  }

  html[data-milxdy-reskin-profile="moderate"] .remilia-wiki-preview,
  html[data-milxdy-reskin-profile="moderate"] .postreader-player,
  html[data-milxdy-reskin-profile="moderate"] .postreader-settings {
    border-color: color-mix(in srgb, var(--milxdy-pink-dark) 42%, var(--milxdy-border)) !important;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(255, 255, 255, 0) 38px),
      var(--milxdy-surface) !important;
    color: var(--milxdy-text) !important;
  }

  html[data-milxdy-reskin-profile="moderate"] .remilia-wiki-link {
    color: var(--remilia-wiki-link-color, var(--milxdy-pink-dark)) !important;
  }

  html[data-milxdy-reskin-profile="moderate"] .postreader-button:hover,
  html[data-milxdy-reskin-profile="moderate"] .postreader-button[aria-pressed="true"],
  html[data-milxdy-reskin-profile="moderate"] .postreader-control:hover {
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
  html[data-milxdy-reskin-profile="max"] .postreader-player,
  html[data-milxdy-reskin-profile="max"] .postreader-settings,
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

  html[data-milxdy-reskin-profile="max"] .postreader-player {
    border-radius: 999px !important;
  }

  html[data-milxdy-reskin-profile="max"] .postreader-button:hover,
  html[data-milxdy-reskin-profile="max"] .postreader-button[aria-pressed="true"],
  html[data-milxdy-reskin-profile="max"] .postreader-control:hover {
    color: var(--milxdy-pink-dark) !important;
    background: color-mix(in srgb, var(--milxdy-pink) 36%, transparent) !important;
  }

  html[data-milxdy-reskin-profile="max"] .reminet-badge-content,
  html[data-milxdy-reskin-profile="max"] .reminet-compact-badge,
  html[data-milxdy-reskin-profile="max"] .reminet-incoming-poke-flag {
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

  html[data-milxdy-reskin-profile="max"] body {
    background: transparent !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-background-fade="false"] {
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

  html[data-milxdy-reskin-profile="max"] body,
  html[data-milxdy-reskin-profile="max"] button,
  html[data-milxdy-reskin-profile="max"] input,
  html[data-milxdy-reskin-profile="max"] textarea,
  html[data-milxdy-reskin-profile="max"] select {
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

  html[data-milxdy-reskin-profile="max"] [data-testid="User-Name"] span,
  html[data-milxdy-reskin-profile="max"] article time {
    font-family: var(--milxdy-font-mono) !important;
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
    flex: 1 1 100% !important;
    flex-wrap: nowrap !important;
    gap: 4px !important;
    max-width: 100% !important;
    min-height: 17px !important;
    min-width: 0 !important;
    overflow: hidden !important;
  }

  html[data-milxdy-reskin-profile="max"] article [data-milxdy-metadata-row="true"] a,
  html[data-milxdy-reskin-profile="max"] article [data-milxdy-metadata-row="true"] span {
    min-width: 0 !important;
    max-width: 100% !important;
    overflow: hidden !important;
    overflow-wrap: normal !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
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

  html[data-milxdy-reskin-profile="max"] main[role="main"] > div > div:first-child,
  html[data-milxdy-reskin-profile="max"] [data-testid="primaryColumn"] > div > div:first-child {
    background:
      linear-gradient(180deg, color-mix(in srgb, var(--milxdy-green-soft) 72%, #ffffff), color-mix(in srgb, var(--milxdy-green-soft) 26%, #ffffff)) !important;
    border-bottom: 1px solid var(--milxdy-green) !important;
    box-shadow: inset 2px 2px 1px rgba(255, 255, 255, 0.55) !important;
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
  html[data-milxdy-reskin-profile="max"] a[href="/messages"]:hover div[aria-live] span {
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
  html[data-milxdy-reskin-profile="max"] a[href="/messages"] div[aria-live] span {
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
    transition: transform 80ms ease, border-width 80ms ease, box-shadow 80ms ease, filter 80ms ease !important;
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

  html[data-milxdy-reskin-profile="max"] button:not(.postreader-button):not(.postreader-control):not(.reminet-poke-button):not(.beetol-action):not(.beetol-icon-btn),
  html[data-milxdy-reskin-profile="max"] [role="button"] {
    border-radius: 0 !important;
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

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="circle"] [data-testid="Tweet-User-Avatar"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="circle"] [data-testid="Tweet-User-Avatar"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="circle"] [data-testid="UserAvatar-Container-unknown"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="circle"] [data-testid="UserAvatar-Container-unknown"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="circle"] img[src*="profile_images"] {
    border-radius: 999px !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="square"] [data-testid="Tweet-User-Avatar"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="square"] [data-testid="Tweet-User-Avatar"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="square"] [data-testid="UserAvatar-Container-unknown"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="square"] [data-testid="UserAvatar-Container-unknown"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-shape="square"] img[src*="profile_images"] {
    border-radius: 0 !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-feed="false"] article [data-testid="Tweet-User-Avatar"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-feed="false"] article [data-testid="Tweet-User-Avatar"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-notifications="false"] [aria-label="Timeline: Notifications"] [data-testid^="UserAvatar-Container-"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-notifications="false"] [aria-label="Timeline: Notifications"] [data-testid^="UserAvatar-Container-"] *,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="false"] [data-testid="dm-message-list"] img[src*="profile_images"],
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-pfp-chat="false"] [data-testid="dm-message-list-container"] img[src*="profile_images"] {
    border-radius: 999px !important;
  }

  html[data-milxdy-reskin-profile="max"] article a {
    color: var(--milxdy-rn-blue-dark) !important;
    text-decoration-color: color-mix(in srgb, var(--milxdy-rn-blue) 60%, transparent) !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"]:has(article[data-testid="notification"][data-milxdy-notification-unread="true"]) > div,
  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] article[data-testid="notification"][data-milxdy-notification-unread="true"] {
    background:
      linear-gradient(90deg, color-mix(in srgb, var(--milxdy-green) 20%, transparent), transparent 72%),
      color-mix(in srgb, var(--milxdy-green-soft) 38%, var(--milxdy-surface)) !important;
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--milxdy-green) 18%, transparent) !important;
    position: relative !important;
  }

  html[data-milxdy-reskin-profile="max"][data-milxdy-visual-notification-unread-tint="true"] [data-testid="cellInnerDiv"]:has(article[data-testid="notification"][data-milxdy-notification-unread="true"]) > div::before {
    background: color-mix(in srgb, var(--milxdy-green) 72%, var(--milxdy-rn-blue)) !important;
    content: "" !important;
    display: block !important;
    height: 100% !important;
    left: 0 !important;
    opacity: 0.92 !important;
    position: absolute !important;
    top: 0 !important;
    width: 3px !important;
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

  html[data-milxdy-visual-remistats-box="false"] .reminet-badge-content,
  html[data-milxdy-visual-remistats-box="false"] .reminet-compact-badge,
  html[data-milxdy-visual-remistats-box="false"] .reminet-incoming-poke-flag {
    border-color: transparent !important;
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
  html[data-milxdy-reskin-profile="min"] .postreader-player,
  html[data-milxdy-reskin-profile="min"] #beetol-hunter-root {
    box-shadow: none !important;
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
