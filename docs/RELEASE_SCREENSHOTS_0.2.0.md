# milXdy 0.2.0 Release Screenshots

Use these optional screenshot asks when preparing the `0.2.0` release post and release page. Capture from a test browser profile with no private DMs, personal account data, private local file paths, API keys, or unpublished user content visible.

## Required Shots

1. Shared side rail with multiple first-party apps visible.
2. Performance mode setting or diagnostics showing Fast, Balanced, Full, and Developer modes.
3. Miladychan Portal docked panel showing a board or thread browser state.
4. Music app docked panel showing library, playlist, or radio-session scaffolding.

## Capture Rules

- Use the rebuilt `0.2.0` Chromium build for the primary screenshot set.
- Run the live probe from `npm run print:live-probe:020` before capture when collecting optional live evidence, and record the resulting `window.__milxdy020LiveProbe` status in [QA_LOG_0.2.0.md](QA_LOG_0.2.0.md).
- Keep screenshots honest to the beta scope. Do not imply a full app store, full Miladychan replacement, or final Remilia Radio experience.
- Prefer test data or public demo content. Blur or crop account-specific handles, private files, playlist names, and local folder paths unless they are intentionally public test fixtures.
- Do not use screenshots from a tab where `#milxdy-overlay-dock-root` or `document.documentElement.dataset.milxdyPerformanceMode` is missing.
