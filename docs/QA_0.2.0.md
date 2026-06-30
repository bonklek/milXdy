# milXdy 0.2.0 QA Checklist

Use this checklist before cutting the `0.2.0` release. The canonical release readiness gate is `npm run verify:release:gates:020`; live Chrome proof and screenshots are optional manual QA evidence.

## Automated Gates

Run from a clean dependency install:

```powershell
npm run verify:release:gates:020
```

`npm run verify:release:gates:020` runs TypeScript, profile builds, release contract verification, platform checks, URL allowlist checks, Music verification, Firefox lint, extension smoke, app smoke, release packaging, checksum verification, and reproducible archive verification. It intentionally does not run the live Chrome probe because that proof depends on a refreshed browser tab and is optional manual QA evidence for this release.

If `node` is unavailable on `PATH` in the test environment, run the same scripts through the known Node executable for that environment and record the substitution in the release notes.

## Apps Hub And Rail

- Follow [CHROME_LIVE_QA_0.2.0.md](CHROME_LIVE_QA_0.2.0.md) only when recording optional live browser evidence.
- Load `dist/chromium` in a Chromium browser and open X/Twitter.
- Before evaluating the rail, confirm the loaded X/Twitter page has milXdy runtime markers such as `#milxdy-overlay-dock-root` or `document.documentElement.dataset.milxdyPerformanceMode`. If they are absent, reload the unpacked extension and refresh X/Twitter before continuing.
- Run `npm run print:live-probe:020`, paste the emitted probe into the X/Twitter page console, and copy `window.__milxdy020LiveProbe` into [QA_LOG_0.2.0.md](QA_LOG_0.2.0.md).
- Run `npm run verify:live-probe:020` after updating the QA log when live browser evidence is being collected.
- Confirm the shared side rail appears.
- Open **Apps** and confirm Lite, Balanced, and Full first-run choices appear on a fresh profile or cleared extension storage.
- Click **Skip** in a fresh profile and confirm first-party apps remain available and toggleable by default.
- Confirm the Apps Hub runtime summary shows the active Performance mode plus enabled, pinned, loaded, loading, and failed counts.
- Confirm each Apps Hub card shows compact runtime state, load triggers, cost metadata, rail support, privacy labels, remote services, and deferred or loaded state when applicable.
- Open an app card's Details view and confirm it lists behavior, performance impact, load triggers, data notes, permission notes, storage notes, and current build availability.
- Use an available app card's Reset action and confirm it clears only that app's declared local/sync storage keys, refreshes enablement, updates rail visibility, and records a `hub.reset.<appId>` diagnostic.
- In Lite and Balanced builds, confirm every first-party app remains available with Enable, Pin, and Open controls where that app supports them.
- Apply each first-run preset in a fresh/cleared profile and confirm matching Performance mode, enabled apps, and default rail pins.
- Open the Apps Hub settings menu after first-run and confirm Lite, Balanced, and Full setup choices can still be reapplied.
- Confirm app enable/disable changes persist after refreshing X/Twitter.
- Confirm pin/unpin changes persist after refreshing X/Twitter.
- Confirm the dock gear can switch left/right side, reorder icons, and reset order.
- Confirm the dock gear or Apps Hub dock settings can reset app positions, then reopen moved rail apps and confirm they return to default safe placements.
- Confirm disabled heavy apps such as Music, Miladychan, RemiNet Chat, Beetol, and Maxxer do not import until enabled and opened or triggered.
- Open two or more rail apps at once and confirm each active rail icon remains highlighted while other apps stay open.
- Click an already-open rail app and confirm it minimizes with the same close animation and clears the active rail highlight.
- Drag Wiki, Miladychan, Music, RemiNet Chat, Milady Maxxer, Post Reading, and Beetol by their top/header chrome and confirm `grab` changes to `grabbing` where the app exposes header chrome.
- Confirm buttons, inputs, tabs, sliders, and close controls inside headers do not start a drag.
- While dragging near the milXdy rail, X/Twitter left nav, X/Twitter right sidebar, viewport edges, or another open app edge, confirm thin snap guide lines appear and release near a guide snaps the app to that line.
- Confirm dock-launched app windows cannot overlap the milXdy side rail on either rail side.
- Move several apps, refresh X/Twitter, reload the extension, and reopen the apps; confirm placement restores from `milxdy.overlayApps.layouts.v1` without storing app URLs, account IDs, or content payloads.

## Performance Modes

- In Fast mode, confirm heavy apps do not load from idle preloads.
- In Balanced mode, confirm normal post/wiki/reader/remistats surfaces work without periodic safety scans.
- In Full mode, confirm dockable full-profile apps can idle preload after X/Twitter settles.
- In Developer mode, enable diagnostics and confirm app/runtime diagnostics include loaded apps, deferred apps, scanner counters, network stats, long-task/layout-shift fields, and surface delivery stats.

## Remilia Wiki Sidebar

- Enable and pin **Wiki** from Apps in a Balanced or Full build.
- Open the Wiki rail item and confirm the docked panel opens the Remilia Wiki homepage or the last stored wiki URL.
- Click an inline wiki article link and confirm it opens the Wiki sidebar rather than a new tab.
- Modifier-click the same link and confirm normal browser link behavior is preserved.
- Hover a wiki link, click the preview read-more link, and confirm it routes into the Wiki sidebar.
- Enter a non-`wiki.remilia.org` URL in the sidebar URL field and confirm it does not navigate the embedded panel away from the wiki.
- Use the open-in-tab control and confirm it opens the current wiki page in a normal browser tab.
- Start Wiki article read-aloud and confirm the reader docks to the Wiki sidebar, highlights the active article text, and follows the current line when Wiki auto-scroll is enabled.
- While Wiki article read-aloud is active, start tweet Post-reading and confirm Wiki playback pauses; then restart Wiki playback and confirm tweet playback pauses.

## Post-reading

- Enable **Post-reading controls** and confirm read buttons appear on X/Twitter posts.
- Start tweet read-aloud and confirm the side-rail Post-reading player shows playback state, previous/next controls, OCR skip behavior, and completion state.
- Switch between a known boundary-capable voice and an unsupported or unprobed voice and confirm read-aloud still highlights text, using synced boundaries when available and the estimated fallback otherwise.
- If testing a custom HTTP TTS endpoint, confirm audio playback works with and without returned timing boundaries, and that returned boundaries improve highlight/seek behavior.
- Run `npm run build:post-reading` and load `dist/post-reading-chromium` when validating the standalone X/Twitter reader extraction.

## Miladychan Portal

- Enable and pin **Miladychan** from Apps.
- Open the portal and confirm board summaries load from `https://boards.miladychan.org/json/board-list` and board JSON endpoints.
- Open at least one board and confirm thread ordering, titles, counts, media thumbnails, and timestamps render.
- Open at least one thread and confirm posts, media previews, and board-theme styling render.
- Click a thread/native link and confirm it opens the native Miladychan site rather than replacing upstream posting behavior.
- Refresh the panel and confirm it updates the current board or thread.
- Disable Miladychan from Apps and confirm the panel closes or stops loading.

## Music

- Enable and pin **Music** from Apps in Chromium.
- Add a small local folder with known audio files through the folder picker.
- Confirm indexed tracks persist after refreshing X/Twitter.
- Revoke or block folder permission, then use **Test** or **Rescan** and confirm Music shows a permission recovery state.
- Remove or rename one indexed test file, rescan, and confirm Music marks it missing/unavailable without deleting playlist metadata.
- Add two copies of the same test track or matching ISRC metadata and confirm duplicate state is visible.
- Confirm search, sort, play, pause, next, previous, queue reorder, seek, shuffle, repeat, and volume behavior.
- Create a playlist, add visible tracks after creation, reorder tracks, remove tracks, rename the playlist, retry matching an unresolved row, and play it.
- Export playlist JSON and QR. Re-import both into a fresh/cleared music library and confirm tracks resolve by ISRC or title/artist/album/duration metadata when available.
- Start a radio session from a playlist, export its QR, import it, and confirm Join computes the current track and offset from the shared start time and marks the active session.
- Run MusicBrainz ISRC enrichment on test tracks and review at least one candidate.
- Add an AcoustID key only in a test profile, run optional acoustic lookup, then remove the key and confirm lookup is disabled.
- In Firefox, confirm Music explains local folder limitations rather than failing silently.

## Background Security

- Confirm background URL fetches reject unsupported origins for Miladychan, MusicBrainz, AcoustID, Milady Maker image proxy, Music image proxy, and RemiNet media.
- Confirm `npm run verify:url-allowlist` passes after any background fetch or media proxy rule change.
- Confirm supported allowlisted URLs still work for the app flows above.
- Confirm feature background modules do not add separate `chrome.runtime.onMessage` listeners.

## Release Metadata

- Confirm `CHANGELOG.md` links the `0.2.0` release notes.
- Confirm `docs/RELEASE_NOTES_0.2.0.md` has no stale "Remaining Before Release" item that has already shipped.
- Confirm [RELEASE_SCREENSHOTS_0.2.0.md](RELEASE_SCREENSHOTS_0.2.0.md) has matching screenshot evidence for side rail, Performance modes, Miladychan Portal, and Music before publishing release media.
- Confirm `package.json`, `public/manifest.json`, and generated Chromium/Firefox manifests report version `0.2.0`.
- Confirm GitHub release assets include Chromium/Firefox Lite, Balanced, and Full zips plus `milXdy-0.2.0-checksums.sha256` from `npm run package:release`, then run `npm run verify:release:checksums` and `npm run verify:release:reproducible`, and confirm the GitHub release is published as a normal release.
- Confirm generated release archives contain source-built extension output only, with local browser caches and machine-specific test output excluded.
- Confirm `.gitignore` keeps secret-bearing files out of the repository while allowing `.env.example`.
