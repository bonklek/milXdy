# milXdy 0.2.0 Release Notes

milXdy `0.2.0` is the Platform Update. It moves first-party features toward shared app metadata, runtime-owned lifecycle, one side rail, explicit Performance modes, and new docked app surfaces.

This release is the first public pass at the milXdy app-platform concept, not the final implementation of the full app layer. It lays the rails for a longer-term mod system by reformatting first-party features into shared registry metadata, lifecycle hooks, dock surfaces, and side-rail navigation that future app-layer work can build on.

The long-term goal is a complete composable app/mod system where today's default apps become packages that can live in an apps folder, use a common manifest shape, and eventually sit beside community-built apps. That work is deliberately staged: many default apps need to share scanners, route detection, visual effects, background services, and performance budgets so third-party apps can be powerful without each package duplicating expensive X/Twitter observers. `0.2.0` advertises the platform direction and exposes the design vocabulary early so developers can start planning milXdy apps before the final external-package implementation lands.

Status: released.

## Platform Preview Scope

What this release provides now:

- A shared app registry for first-party apps.
- A shared runtime lifecycle for loading, enabling, disabling, surface delivery, and diagnostics.
- A shared Apps Hub and side rail for app discovery, enablement, and pinning.
- Registry-backed metadata for cost, load triggers, permissions, privacy notes, assets, and build profiles.
- A local-first App SDK document that describes the manifest and lifecycle shape future app packages should follow.

What this release does not provide yet:

- A finished external mod loader.
- A user-installable community app store.
- A stable public package API for arbitrary third-party code.
- Fully extracted default apps living as standalone packages in an apps folder.

Developers should treat `0.2.0` as the app-platform preview and planning target: useful for understanding the direction, strong enough to begin designing app ideas, but still before the hard extraction/refactor work needed for a complete mod system.

## Implemented Platform Work

- Added a shared first-party app registry in `src/shared/firstPartyApps.json`.
- Moved root content bootstrapping through the shared content runtime.
- Added lifecycle hooks for app boot, enable, disable, route changes, surface delivery, open, close, and dispose.
- Added app cost metadata, load triggers, package metadata, host permissions, dock metadata, Hub metadata, and privacy labels.
- Made build entries, copied assets, CSS files, host permissions, web-accessible resources, and profile-specific bundle sets registry-driven.
- Added Lite, Balanced, and Full build profiles for Chromium and Firefox outputs.
- Added Fast, Balanced, Full, and Developer Performance modes separate from Appearance presets.
- Added one shared Twitter/X scanner, route service, idle scheduler, surface delivery queue, network queue, and runtime diagnostics.
- Added the shared Apps Hub for enablement, rail pinning, and first-run Lite/Balanced/Full setup.
- Added shared overlay dock, app frame, and panel behavior for dockable apps.
- Moved feature background message handlers onto the shared background router. RemiNet Chat keeps a long-lived `runtime.connect` socket bridge for WebSocket streaming.
- Added a shared URL allowlist helper for background fetch services and moved Miladychan, Music, RemiNet media, and Milady Maker image-proxy checks onto explicit allowlist rules.
- Added shared Wiki sidebar background routing for validated wiki navigation, open-in-tab, iframe history, article read-aloud handoff, and wiki image fetches.
- Added a shared Remilia auth helper for browser-session adoption, short-lived auth-cookie sync, stored-token migration, silent OIDC refresh, explicit disconnect, and legacy token cleanup.
- Centralized fresh-install defaults so the Apps Hub first-run prompt and enabled app defaults are seeded from the main background handler instead of feature-local install listeners.
- Hardened RemiStats tooltip rendering by escaping profile fields and encoding PFP image URL segments before writing tooltip HTML.
- Refreshed RemiStats beetle and poke-outline assets used by the RemiNet profile/action surfaces.
- Added dependency override pins for release-maintenance packages already resolved in the lockfile.
- Expanded Post-reading/read-aloud beyond tweet playback with Wiki sidebar article handoff, a Wiki-attached reader slot, article highlight boundary messages, optional Wiki auto-scroll, and mutual pause behavior between tweet and Wiki reading.
- Improved read-aloud timing with known/probed voice boundary support, sorted voice choices, estimated smooth-highlight fallback for unsynced voices, and optional custom HTTP TTS boundaries for synced playback and seek.
- Added a standalone Chromium Post-reading build path so the extracted reader can be tested independently before any future repository split.

## New App Surfaces

### Miladychan Portal

- Added a docked Miladychan app in the shared side rail.
- Added board summaries, thread browsing, thread post reading, media previews, board-theme styling, refresh behavior, and links back to native Miladychan.
- Kept the native Miladychan site as the posting and full-board surface.

### Remilia Wiki Sidebar

- Added a docked Remilia Wiki app in the shared side rail for Balanced and Full builds.
- Added validated `wiki.remilia.org` navigation, homepage open, last-page restore, refresh, close, resize, and open-in-tab controls.
- Routed normal clicks on inline wiki article links and preview read-more links into the sidebar app while preserving modifier-click native browser behavior.
- Kept the existing inline linker, previews, Link Later, and Grok drafting workflows as the wiki scanner layer.

### Music

- Added a docked local music app in the shared side rail.
- Added local folder indexing for Chromium browsers with persistent folder handles, including permission recovery status, rescans, missing-file marking, metadata normalization, and duplicate detection.
- Added library search/sort, queue playback and reordering, playlists, playlist JSON import/export, QR import/export, metadata-based track matching, unresolved-track states, and shared-start radio sessions.
- Added local-first ISRC enrichment with metadata inference, MusicBrainz lookup, optional AcoustID lookup, candidate review, and manual ISRC editing.
- This is a local Remilia Radio-ready baseline: playlist/radio QR payloads share metadata only, joining computes the current track and offset locally, and Firefox shows clear local-folder limitations while preserving the rest of the Music UI.

## Documentation

- Added [App SDK](APP_SDK.md) covering manifests, runtime lifecycle, Apps Hub, Performance modes, overlay panels, background services, and the future GitHub app package path.
- Added [0.2.0 QA checklist](QA_0.2.0.md), [0.2.0 QA evidence log](QA_LOG_0.2.0.md), [0.2.0 Chrome live QA handoff](CHROME_LIVE_QA_0.2.0.md), [0.2.0 release screenshot asks](RELEASE_SCREENSHOTS_0.2.0.md), `npm run build:profiles`, `npm run verify:release:020`, `npm run verify:release:gates:020`, `npm run verify:app-smoke:020`, `npm run verify:smoke:020`, `npm run verify:url-allowlist`, `npm run print:live-probe:020`, `npm run verify:live-probe:020`, `npm run package:release`, `npm run verify:release:checksums`, and `npm run verify:release:reproducible` to keep release-gate coverage tied to the platform roadmap, generated extension outputs, background URL security rules, app-specific smoke contracts, non-live release gate orchestration, optional live browser probe status, release media, release archive checksums, and deterministic archive reproduction.
- Updated [User guide](USER_GUIDE.md) with Apps Hub, side rail, Performance modes, Miladychan Portal, and Music workflows.
- Updated [Post-reading user guide](user-guides/post-reading.md) and [Post-reading standalone notes](POST_READING_STANDALONE.md) with Wiki read-aloud handoff, voice timing behavior, custom TTS timing support, and the extracted Chromium build scope.
- Updated [Privacy and permissions](PRIVACY_AND_PERMISSIONS.md) for Miladychan and Music data flows.
- Updated [Troubleshooting](TROUBLESHOOTING.md) for Apps Hub, Miladychan, Music folders, enrichment, and QR import.
- Updated the GitHub README presentation with the high-resolution full milXdy logo from `public/brand/milxdy-home-logo-wide.png`.

## Code Freeze Notes

- Treat this release as the initial platform/mod-system pass, not the completed external app loader. The Apps Hub, registry, lifecycle, side rail, Performance modes, and SDK vocabulary are the contract preview; external package loading and stable third-party compatibility remain future work.
- Include all untracked 0.2.0 files when transferring to the public repo: release docs, user guides, release scripts, reproducible-release verifier, profile-build helpers, `post-reading` renamed source/assets, Wiki sidebar read-aloud entries/assets, Music/Miladychan assets, shared runtime helpers, and standalone Post-reading files.
- Do not transfer generated browser-profile artifacts under `tmp/pw-wiki-urlbar-profile-*` or other local smoke-test cache output.
- When copying to `bonklek/milXdy`, restore the public repo's secret-file ignore rules for `.env`, `.env.*`, `!.env.example`, `*.pem`, `*.key`, `*.p12`, and `*.pfx`.
- Preserve the public maintenance fixes during transfer: Post-reading URL allowlists, removed X GraphQL bearer fallback, RemiStats tooltip escaping, encoded RemiStats PFP URL segments, and dependency security overrides.

## Remaining Before Release

- Keep `npm run verify:release:gates:020` passing before cutting the release. It runs the non-live 0.2.0 gate stack, rebuilds profile outputs, packages release archives, verifies checksums, and verifies deterministic archive reproduction.
- Keep `npm run verify:release:020` passing as release notes, docs, registry metadata, and app surfaces change.
- Run `git status --short --untracked-files=all` before the public handoff and explicitly separate release files from local `tmp/` browser-profile output.
- Smoke test the Apps Hub and pinned app rail on X/Twitter.
- Smoke test Miladychan board/thread loading against live board JSON.
- Smoke test Music local folder indexing, permission recovery, missing-file repair, duplicate display, playlist export/import, QR import/export, radio join, and ISRC enrichment.
- Capture the four optional release-media screenshots in [RELEASE_SCREENSHOTS_0.2.0.md](RELEASE_SCREENSHOTS_0.2.0.md) when preparing the release post.
- Confirm generated Chromium and Firefox Lite/Balanced/Full release archives contain manifest version `0.2.0` and are listed in `release/milXdy-0.2.0-checksums.sha256`.
