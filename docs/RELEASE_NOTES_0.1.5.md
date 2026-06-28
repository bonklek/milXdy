# milXdy 0.1.5 Release Notes

milXdy `0.1.5` focuses on RemiNet polish, profile identity surfaces, Tweet PNG export, performance diagnostics, and the first repeatable Firefox package pipeline.

## Highlights

- Added a unified **Audio** tab for read-aloud playback, browser voices, RemiStats sounds, Milady Maxxer sounds, and visual interaction sounds.
- Added RemiChat replies with reply previews, reply context, richer reactions, video hydration, and cached profile lookup behavior.
- Reworked RemiliaNET connector login around browser-session auth and explicit disconnect/retry behavior.
- Added X-native outline poke controls, persisted poke cooldowns, gold incoming-poke styling, and Miladymaxxer XP credit for successful pokes.
- Added Beetle trophy shelf profile banners and profile banner cycling with original, trophy shelf, and random Banners NFT modes.
- Added Tweet PNG export from X/Twitter share actions with local rendering, clipboard/download/share behavior, media, quotes, date, and RemiStats options.
- Added repeatable Chromium and Firefox build targets, Firefox manifest generation, and Firefox lint/QA docs.

## Added

### Firefox package pipeline

- `npm run build:chromium` emits Chromium output under `dist/chromium`.
- `npm run build:firefox` emits Firefox output under `dist/firefox`.
- `npm run build:all` builds both targets.
- `npm run lint:firefox` runs `web-ext lint --source-dir dist/firefox`.
- Added [Firefox QA](FIREFOX_QA.md) with the manual load and smoke-test checklist.

### RemiNet and RemiChat

- RemiChat reply action, reply preview, reply context rendering, and reply payload support.
- Expanded reaction options and reaction tooltips.
- Inline video attachment hydration in RemiChat.
- RemiChat profile lookup cache and miss caching.
- Browser-session RemiliaNET auth flow with explicit disconnect behavior.

### Pokes, Beetol, and profile identity

- Outline poke icon asset and X-like action-row styling.
- Persisted local poke cooldown state.
- Miladymaxxer XP credit for successful pokes against tracked accounts.
- Optional gold incoming-poke alerts.
- Beetol cooldown persistence, hunt-charge display, and clearer ready/cooldown/exhausted states.
- Beetle trophy shelf profile banners.
- Random Banners NFT profile banner cycling with lever artwork, loading state, and spin sound.

### Tweet PNG export

- Adds **Copy tweet as PNG** from X/Twitter share actions.
- Renders a local PNG card with tweet text, media, quote content, date, avatar, and optional RemiStats values.
- Adds Appearance controls for PNG media, quote text, quote media, tall-image shrinking, date, stats, border, and palette.
- Uses a restricted background image-fetch bridge for approved Milady Maker Banners NFT PNG URLs.

### Performance and diagnostics

- Shared Twitter scanner now extracts handles, pauses safety scans while the tab is hidden, and writes scanner diagnostics when enabled.
- Feature timing diagnostics are available for RemiStats, Miladymaxxer, Post-reading, and Wiki processing.
- Health/reporting moved into the Main popup tab.

## Changed

- Popup navigation is now **Main**, **Appearance**, **Audio**, **RemiNet**, and **Wiki**.
- Post-reading voice selection now uses an installed browser voice dropdown instead of a free-text URI field.
- Post-reading placement prefers the X action row instead of tweet header controls.
- Max visual profile now has configurable max media height and improved tweet-header overflow behavior.
- Unread notification tinting is more precise and no longer broadly styles all notification articles.
- Miladymaxxer self profile badges are suppressed when self-tracking is disabled.

## Known Limits

- Firefox automated build/lint checks pass, but Firefox support should not be advertised broadly until manual Firefox smoke testing passes using [Firefox QA](FIREFOX_QA.md).
- `web-ext` reports no Firefox lint errors. The current package still has reviewed warnings from bundled OCR/ONNX/Tesseract code and existing dynamic-rendering patterns, plus a future AMO notice for `browser_specific_settings.gecko.data_collection_permissions`.
- `npm audit --omit=dev` reports no production dependency vulnerabilities. `npm ci` still reports dev-tree audit findings, which should be reviewed separately from the frozen feature package.
- Direct RemiNet upload/share for Tweet PNG exports is still blocked until a suitable endpoint and privacy behavior are confirmed.
- X/Twitter DOM changes can affect share-menu injection, RemiNet surfaces, and profile banner rendering.

## Updating Safely

Keep the same loaded extension folder when updating. Replace files in place, reload the existing extension card, and refresh X/Twitter tabs.
