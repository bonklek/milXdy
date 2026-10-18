// One policy for native and scanner-marked author headers. Quote cards without
// profile links retain their own independent layout.
const scope = 'html:is([data-milxdy-reskin-profile="moderate"], [data-milxdy-reskin-profile="max"]) article[data-testid="tweet"]';
const header = `${scope} [data-testid="User-Name"]:has(a[href])`;
const detail = `${header}:not(:has(time))`;

// Text reflow belongs to X's identity nodes, never the badge's metric subtree.
const nativeIdentity = ':where(:not([data-reminet-badge-slot], [data-reminet-badge-slot] *))';

export const TWEET_HEADER_LAYOUT_CSS = `
  ${header} {
    display: flex !important;
    flex: 1 1 auto !important;
    flex-direction: row !important;
    flex-wrap: wrap !important;
    align-items: flex-start !important;
    justify-content: flex-start !important;
    gap: 2px 6px !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    min-height: 24px !important;
    overflow: hidden !important;
  }
  ${header}:not(:has(time)) {
    flex-direction: column !important;
    min-height: 47px !important;
  }
  ${scope} div:has(> [data-testid="User-Name"]:has(a[href])),
  ${scope} div:has(> div > [data-testid="User-Name"]:has(a[href])) {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
  }
  ${header} > div {
    display: flex !important;
    flex: 0 1 auto !important;
    flex-wrap: wrap !important;
    align-items: center !important;
    width: max-content !important;
    min-width: 0 !important;
    max-width: 100% !important;
    min-height: 24px !important;
    overflow: hidden !important;
  }
  ${header} > div:first-child div${nativeIdentity},
  ${header} > div:first-child a${nativeIdentity},
  ${header} > div:first-child span${nativeIdentity} {
    flex: 0 1 auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    text-overflow: clip !important;
  }
  /* Native wrappers must not make handle/date/metrics one indivisible item.
     Expose their real items to the outer wrapping row; keep metric internals. */
  ${header}:has(time) > div:last-child,
  ${header}:has(time) > div:last-child div:not([class*="reminet-"]):not([class*="miladymaxxer"]) {
    display: contents !important;
  }
  ${header} > div:last-child {
    gap: 4px !important;
    align-content: flex-start !important;
  }
  ${header} > div:last-child div${nativeIdentity},
  ${header} > div:last-child a${nativeIdentity},
  ${header} > div:last-child span${nativeIdentity} {
    flex: 0 1 auto !important;
    min-width: 0 !important;
    max-width: 100% !important;
    overflow: hidden !important;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
  }
  ${header} [data-milxdy-display-name-row="true"] {
    flex-wrap: wrap !important;
  }
  ${header} svg,
  ${header} time,
  ${header} [data-reminet-badge-slot],
  ${header} [data-reminet-badge-slot] * {
    flex: 0 0 auto !important;
    overflow: visible !important;
    white-space: nowrap !important;
    overflow-wrap: normal !important;
    word-break: normal !important;
    flex-wrap: nowrap !important;
  }
  ${header} [data-reminet-badge-slot],
  ${header} [data-reminet-badge-slot] :is(.reminet-score-badge, .reminet-badge-content, .reminet-badge-group, .reminet-label) {
    min-width: max-content !important;
    max-width: none !important;
  }

  /* Expanded posts have a stable identity column and an independent stats
     column. Metrics never insert a line between the name and its handle. */
  ${detail} {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) max-content !important;
    grid-template-rows: auto auto !important;
    column-gap: 8px !important;
    row-gap: 2px !important;
  }
  ${detail}:not(:has(> [data-reminet-badge-slot][data-reminet-state="ready"])) {
    grid-template-columns: minmax(0, 1fr) !important;
  }
  ${detail} > div:first-child {
    grid-column: 1 !important;
    grid-row: 1 !important;
    width: 100% !important;
  }
  ${detail} > div:last-of-type {
    grid-column: 1 !important;
    grid-row: 2 !important;
    width: 100% !important;
  }
  ${detail} > [data-reminet-badge-slot] {
    grid-column: 2 !important;
    grid-row: 1 / span 2 !important;
    align-self: start !important;
    margin-left: 0 !important;
  }
  ${detail}[data-reminet-detail-stacked] > div:first-child,
  ${detail}[data-reminet-detail-stacked] > div:last-of-type {
    grid-column: 1 / -1 !important;
  }
  ${detail}[data-reminet-detail-stacked] > [data-reminet-badge-slot] {
    grid-column: 1 / -1 !important;
    grid-row: 3 !important;
    justify-self: end !important;
  }
  ${detail}[data-reminet-handle-on-name-line] {
    grid-template-rows: auto !important;
  }
  ${detail}[data-reminet-handle-on-name-line] > div:last-of-type {
    grid-column: 1 / -1 !important;
    grid-row: 1 !important;
    align-self: end !important;
    justify-self: end !important;
    width: max-content !important;
    white-space: nowrap !important;
  }
  /* Inline identity markup lets verification follow the last name glyph,
     instead of centering beside the full multi-line name block. */
  ${detail} > div:first-child [data-milxdy-display-name-row],
  ${detail} > div:first-child a[href] {
    display: block !important;
    width: 100% !important;
  }
  ${detail} > div:first-child a[href] div,
  ${detail} > div:first-child a[href] span {
    display: inline !important;
  }
  ${detail} > div:first-child a[href] svg {
    display: inline-block !important;
    vertical-align: -0.125em !important;
    margin-left: 4px !important;
  }
`;
