# Changelog

## 0.2.3

See [milXdy 0.2.3 release notes](docs/RELEASE_NOTES_0.2.3.md).

- Carries forward the Firefox/Waterfox compatibility, browser-specific update download, fullscreen DM media, and Tweet PNG rendering fixes originally prepared as an unpublished `0.2.2.1` hotfix.
- Completes the code-level reliability and accessibility remediation pass for all 43 findings documented in the UX and feature reliability audit.
- Returns Beetol hunt results immediately after the action request and reconciles inventory/cooldowns separately, preventing successful hunts from appearing stuck behind sequential state refreshes.
- Routes RemiNet Chat's live WebSocket through an already-open, signed-in RemiliaNET tab, preventing the extension-origin socket from losing the site session while history remains readable; recovery no longer opens or closes hidden tabs on failed sends.
- Preserves a bounded session history for Music shuffle playback so Previous retraces tracks actually heard and Next resumes forward history before selecting another random track.
- Pins the bundled Music track above local tracks in the new Default library order, while explicit Artist, Title, Album, and Added sorts remain exact; background library updates no longer destroy an open sort menu.
- Collapses Music library row actions into a hover/focus three-dot menu that overlays the far-right duration only while active, leaving no permanent action column and substantially more width for titles and artist/album metadata.
- Replaces textual Music ISRC states with compact, tooltipped square lightbulbs: green for resolved, yellow for pending/review, and red for unresolved/error; the bundled track omits the indicator.
- Makes X's native font the default interface face across appearance presets, adds **X default** to the renamed **Interface font** control, and applies that choice consistently to profile/navigation tabs instead of styling only the active label.
- Passes the complete non-live 0.2.3 release gate, including both browser builds, package/security contracts, smoke tests, archive checksums, and reproducibility; authenticated live QA remains the publication gate.
- Invalidates cached Chat authentication across connector logout/timeouts and propagates shared background deadlines into fetch abort signals so expired work cannot continue consuming privileged network resources.
- Reorganizes Root Visual fine controls without changing their stored profile-pack shape, adds rail overflow direction indicators, strengthens Chat reaction, pop-out, and Messages-row dark states, darkens Post/Reply controls in the dark preset, keeps Post labels white in both top and sidebar composers, and matches the Wiki read-aloud button to the square Wiki control family.
- Restores a compact Apps & Features rail-settings view with single-line ordering controls, removes the redundant self-link, and keeps app presets collapsed until requested.
- Keeps X's native Like feedback responsive by removing broad button-transition overrides and replacing Maxxer's full-card shadow animation with short compositor-friendly feedback.
- Clears Chrome's stranded Web Speech pause state before starting a new read-aloud utterance, preventing a silent first-word hang.
- Restores continuous paragraph-level smooth highlighting by carrying each boundary toward the next one and continuously recalibrating fill speed against speech instead of limiting animation to the current token.
- Keeps that paragraph scan moving when Chrome continues speaking after emitting only its first synchronized boundary, while yielding immediately if native boundary events resume.
- Restores navigation-sized speech chunks so the small previous/next paragraph controls move within long readings while the large controls remain previous/next post actions.
- Reconstructs the Beetle Hunt cooldown from the API's `beetleHuntsUsed` and `lastBeetleHuntDate` fields and reads nested action cooldowns, preserving the actual remainder of the 90-minute timer across reloads and server cooldown responses.
- Removes two suspected reliability-audit lag contributors: main-column mutation-driven button rescans are replaced by a disabled-aware, capped visible-page check every five seconds, and the root-level relational dock selector is replaced by a static left-rail safe area.
- Keeps the final Beetle Hunt reward visible before transitioning to a red Done status and the persisted 90-minute cooldown.
- Opens supported collapsed Wiki sections and inactive tabs as read-aloud reaches them, keeping highlights and auto-scroll on visible text.
- Hides RemiStats poke controls until the visible account resolves to a confirmed RemiliaNET identity, including the optional poke-on-Like path.
- Prevents Grok-generated posts from being clipped when the Read Aloud control is added to X's specialized Grok post layout.
- Lets X's expanded image and video viewers bypass the Moderate profile's inline-media height cap.
- Avoids repeated forced-layout stabilization for already-rendered RemiStats badges, improving Max-profile timeline responsiveness.
- Narrows Max typography selectors to their owning elements, reducing style recalculation while X virtualizes a scrolling timeline.
- Removes Max's root-level relational theme fallbacks and uses the runtime's explicit X theme marker instead, avoiding document-wide selector invalidation during feed updates.
- Makes the Max-profile benchmark use a fixed built-in timeline scroll cadence after a short settle period, removing manual-scroll variance from profile comparisons.
- Includes inverse average FPS in the Max-versus-Moderate benchmark verdict so low sustained frame rate cannot be masked by a shorter worst-frame gap.
- Labels sub-threshold mixed benchmark results as within the 2× tolerance instead of calling Max simply worse.
- Adds a dedicated RemiNet setting to remove nonessential motion on remilia.net Beetle Hunt routes without changing the separate X/Twitter Beetol panel.
- Keeps Beetle Hunt's action-result video intact under reduced motion so its site-managed reward transition remains coherent rather than appearing partially suppressed.
- Adds an opt-in instant-result path that uses Remilia's existing Beetle display pane for direct Claim/Hunt results instead of the native video sequence.
- Makes reduced motion apply to Beetle Craft's result flow as well: valid Assemble and Smash actions now skip Remilia's staged result timers, so the sidebar result and next usable action state appear immediately.
- Adds a one-click Max-versus-Moderate benchmark suite that restores the prior visual theme after both controlled samples finish.
- Keeps X's native tweet font in the Moderate preset; custom tweet typography remains the Max preset default.
- Keeps the RemiStats action-row poke position stable while its lazy app bundle loads, and lets tweet names and handles use available header space before truncating.
- Corrects the tweet-header flex allocation so longer display names do not ellipsize against an oversized metadata basis while usable row space remains.
- Restores embedded local cover art in Music from the selected audio file, retries stale metadata results when the parser or file changes, and persists recovered artwork for later popout renders.
- Makes Apps & Features the single place to enable or disable RemiNet Chat by removing the duplicate popup toggle, and relabels the updater handoff action as **Open in LLM**.
- Enables RemiStats poke-on-Like when applying the Medium or Max appearance preset while keeping it disabled in Minimal.
- Replaces several implementation-coupled regression checks with registry-driven and production-policy tests for app enablement, profile-pack sections, Music artwork caching, and Post-reading hyperlink offsets.
- Removes Chromaprint WASM and AcoustID acoustic lookup from Music, reducing release size and host permissions while preserving metadata inference, MusicBrainz enrichment, candidate review, and manual ISRC editing.
- Removes the redundant RemiNet Chat overlay control from Appearance; RemiNet Chat enablement now lives exclusively in Apps & Features.

Status: in development.

## 0.2.2

See [milXdy 0.2.2 release notes](docs/RELEASE_NOTES_0.2.2.md).

- Aligned the package and public manifest versions with the `0.2.2` App SDK
  release metadata, and made the current release verifier fail on future
  package/App SDK version drift.
- Added a release archive Markdown payload allowlist so helper and OCR Markdown
  files are explicit public archive contents instead of accidental payloads.
- Finalized Firefox data-collection manifest metadata for the documented
  browser-session, remote-service, and site-content flows, and made Firefox lint
  fail if the missing-data-collection or unsupported-min-version warnings return.
- Hardened local package composition so custom builds expose runtime-imported
  package entries, reject untranspiled content entries and direct runtime API
  bypass patterns without reviewed exceptions, preserve disabled-by-default
  consent packages, and accept workspace absolute package paths consistently.
- Made local package runtime message and port API findings fail closed even
  under sensitive API review acknowledgement, including reflective
  `Reflect.get(...).runtime.sendMessage` access patterns.
- Added Composer Tools as a local-only X/Twitter post composer helper that
  converts typed double dashes to em dashes and can be toggled from Apps &
  Features without adding network access or permissions.

Status: released.

Post-`0.2.1` hotfix highlights:

- Improved RemiNet Chat placement in X Messages so the RemiliaNET Chat row stays pinned above native conversations and message selection remains stable.
- Fixed RemiStats action-row poke rendering and added an opt-in **Poke users when liking** setting that can poke a tweet author after the user clicks X's Like button.
- Improved Beetol/RemiStats RemiliaNET auth recovery by refreshing the existing browser session before retrying stale or failed poke requests.
- Expanded Post-reading support for X Articles, improved long-text highlighting with segmented smooth rendering, made stop/quit distinct from minimize, improved OCR skip/status behavior, and tightened OCR quality filtering.
- Hardened Post-reading OCR image loading so the OCR host accepts only `https://pbs.twimg.com/media/...` image URLs and continues to use credentialless fetches/background fallback.
- Replaced the stale active release gate with the current release gate, version-neutral `npm run verify:release:gates`, including current app smoke and Post-reading distribution contract coverage; `verify:release:gates:020` remains a historical 0.2.0 evidence gate.
- Added light/dark Post-reading dock icon support and refreshed app icon validation for themed assets.
- Added a **Wiki browser follows dark mode** setting for the docked Remilia Wiki sidebar.
- Polished visual behavior around post sounds, media height limits in modals, shaped PFP coverage, and unread notification tinting.
- Updated roadmap scope so `0.2.2` emphasizes Apps and Settings cleanup,
  App SDK preparation, local package/custom-build groundwork, and release-gate
  hardening, while marketplace/distribution follow-through and reviewed sharing
  work move into later planned releases.

## 0.2.1

Status: released.

See [milXdy 0.2.1 release notes](docs/RELEASE_NOTES_0.2.1.md).

Current release-gate state:

- `typecheck`, browser release builds, update-check verification, Post-reading hyperlink-offset verification, extension smoke, app smoke, and platform checks passed in this workspace.
- Live QA is complete for the 0.2.1 release scope, including the Post-reading smooth-highlight freeze follow-up, RemiNet/RemiStats poke state, Beetol cooldown memory, notification tinting, and thread/reply visual behavior.
- Release packaging, checksum verification, and reproducibility verification passed for the published 0.2.1 artifacts.

Implemented highlights:

- Repaired the normal GitHub update channel for published releases, profile-matching archive selection, and safe in-place update handoff.
- Added update-step LLM handoff support so testers can copy the update prompt and open their configured assistant target.
- Improved Apps Hub/profile behavior so setup choices preserve app availability, expanded cards expose enable/disable controls, and the app enable switch has stronger selected-state contrast.
- Reduced runtime lag by moving more work through shared scanners, performance budgets, and cached RemiStats behavior in Fast mode.
- Improved RemiStats/RemiNet poke state with cooldown fallback, local cooldown restoration, synchronized visible buttons for the same user, optional tweet-like-on-poke, sanitized score/beetle metrics, safer Remilia profile links, and clearer incoming-poke placement.
- Preserved Beetol hunt cooldown/exhausted state across refreshes and restored ready charges when no cooldown remains.
- Polished Post-reading with voice language/gender filters, smoother estimated highlighting on feed playback, hyperlink-skip offset correction, a stop control for voice-highlight testing, and removal of the extra bottom strip under the player/settings surface.
- Polished Music panel sizing with compact-mode height limits, narrower width resizing, persisted layout state, simplified minimized controls, and volume control overflow fixes.
- Added RemiNet Chat older-message loading and safer media preview behavior.
- Restored stronger notification card tints and reply/thread connector hints for orphaned replies.
- Classified Firefox CSP/PFP behavior and kept Firefox builds in the release matrix.
- Updated `esbuild` to `0.28.1` and kept the release smoke verifier aligned with the active package/manifest version.

## 0.2.0

Status: released.

See [milXdy 0.2.0 release notes](docs/RELEASE_NOTES_0.2.0.md).

Current release-gate state:

- Non-live release gates are consolidated under `npm run verify:release:gates:020` and are passing in this workspace.
- Live Chrome/X runtime proof is optional manual QA for 0.2.0 and is not part of the release readiness gate.

Highlights:

- Added the shared app registry, runtime lifecycle, Apps Hub, side rail, Performance modes, profile build matrix, and release packaging/checksum gates.
- Added the docked Remilia Wiki sidebar, Miladychan Portal, and Music MVP surfaces.
- Moved background fetches toward shared routing and explicit URL allowlists.
- Documented `0.2.0` as the first app-platform preview before the complete composable app/mod system, where default and community apps can eventually live as packages while sharing scanners, effects, runtime services, and performance budgets.
- Expanded Post-reading/read-aloud with Wiki sidebar article routing, dock-attached Wiki playback, boundary-aware highlighting, voice support probing, estimated highlight fallbacks, custom TTS timing support, and a standalone Chromium build path.
- Added reproducible release archive verification so the 0.2.0 release gate checks deterministic ZIP output in addition to package checksums.
- Added final release documentation for shared Wiki sidebar routing, shared Remilia auth, centralized install defaults, RemiStats tooltip hardening, dependency overrides, and release hygiene.
- Updated `esbuild` to `0.28.1` in both checked-in lockfiles after the final audit pass so the Windows dev-server file-read advisory is not present in the release dependency tree.

## 0.1.5

Status: released.

Highlights:

- Added a unified **Audio** tab that groups Post-reading voice/playback settings, RemiStats sounds, Milady Maxxer sounds, and visual interaction sounds.
- Removed the obsolete RemiliaNET username/password popup login form and made browser-session RemiliaNET auth the connector path for Beetol, RemiStats pokes, and RemiNet Chat.
- Added explicit RemiNet disconnect behavior so **Log out** stops automatic browser-session reuse until **Retry session** is clicked again.
- Added RemiChat replies with reply actions, reply previews, reply context rendering, and reply payload support.
- Expanded RemiChat reactions with more emoji options, reaction tooltips, video attachment hydration, and cached profile lookup behavior.
- Added an outline RemiStats poke icon and more X-native action-row poke styling.
- Added persisted poke cooldown state so active poke cooldowns survive X/Twitter refreshes.
- Added Miladymaxxer XP credit for successful RemiNet pokes against tracked Milady accounts.
- Added optional gold styling for incoming RemiNet poke alerts.
- Improved Beetol hunter cooldown handling with persisted cooldowns, hunt charge display, and clearer ready/cooldown/exhausted states.
- Added Beetle trophy shelf profile-banner rendering and profile banner cycling, including original, trophy shelf, and random Banners NFT modes.
- Added custom lever artwork, loading state, and spin sound for profile banner cycling.
- Added a Tweet PNG exporter from X/Twitter share actions with local card rendering, clipboard/download/share behavior, and quote/media/stat support.
- Added PNG exporter appearance controls for attached images, quote text, quote media, tall-image shrinking, date display, RemiStats values, borders, and border palette.
- Added a restricted background image-fetch bridge and manifest host permission for Milady Maker Banners NFT images used by banner cycling.
- Added visual theme controls for max media height, gold incoming poke alerts, and Tweet PNG export styling.
- Improved Max visual profile layout with tweet-header/metadata overflow handling, configurable media height limits, and more precise unread notification tinting.
- Improved shared X/Twitter surface scanning with extracted handles, visibility-aware safety scans, and scanner diagnostics.
- Added feature timing diagnostics for RemiStats, Miladymaxxer, Post-reading, and Wiki processing when performance diagnostics are enabled.
- Added repeatable Chromium and Firefox build targets, with Firefox manifest generation and QA linting inspired by the contributor work in bonklek/milXdy#4.
- Moved Health/reporting into the Main popup tab and compressed popup navigation to Main, Wiki Links, Audio, RemiNet, and Milady Maxxer.
- Changed Post-reading button placement to prefer the action row instead of tweet header controls.
- Suppressed Miladymaxxer self profile badges when self-tracking is disabled.

Still pending:

- Firefox automated build/lint checks pass, but Firefox support still needs manual browser smoke testing before it can be advertised to beta users.
- Screenshot-to-RemiNet still needs endpoint/API confirmation, preview/review behavior, and privacy review.
- Complete non-Milady minimization still needs implementation or confirmation before it can be listed as shipped.

## 0.1.4

See [milXdy 0.1.4 release notes](docs/RELEASE_NOTES_0.1.4.md).

Highlights:

- Added the Appearance tab with Max, Medium, Minimal, and Custom visual presets.
- Added custom visual theme editing, saved themes, import/export, and share strings.
- Added bundled Remilia fonts and broad X/Twitter reskin controls.
- Added PFP shape, media shape, button, sidebar, notification, and feed-refresh visual/sound controls.
- Added RemiStats box and poke placement controls, RemiNet Chat overlay integration, and richer Maxxer visual intensity controls.
- Added RemiNet poke sound and refreshed Beetol, RemiStats, RemiNet Chat, and Maxxer styling.
- Clarified RemiliaNET 2FA browser-session retry documentation.

## 0.1.3

See [milXdy 0.1.3 release notes](docs/RELEASE_NOTES_0.1.3.md).

Highlights:

- Added guided in-place update controls in the Suite tab so beta testers can download, copy safe update steps, and reload the extension without losing local settings.
- Added the optional RemiNet Chat sidebar on X home timelines, including RemiliaNET login reuse, reactions, pokes, attachments, media previews, and a minimized mode.
- Added incoming RemiNet poke indicators sourced from recent RemiliaNET notifications.
- Added a short RemiNet poke sound effect that follows the RemiStats sound setting.
- Reorganized the popup into clearer tab sections with grouped settings for Suite, Wiki Links, Read Aloud, RemiNet, Milady Maxxer, and Health.
- Improved RemiNet poke cooldown handling by checking profile eligibility before users click poke, then hydrating matching poke buttons with live cooldown state.
- Cleaned up Beetol panel cooldown display so hunt/catch readiness is easier to read.
- Expanded RemiNet/Beetol documentation around persistent login, 2FA SSO retry, cookies, and update-safe storage.
- Reworked public docs into a navigable docs index with separate install/update, user guide, troubleshooting, privacy, roadmap, and contributing pages.

## 0.1.2

See [milXdy 0.1.2 release notes](docs/RELEASE_NOTES_0.1.2.md).

Highlights:

- Beetol integration and RemiNet login persistence.
- Remilia Wiki Grok workflows and draggable new-page shortcut.
- RemiStats poke cooldown and diagnostics improvements.
- Post-reading OCR/custom TTS documentation.
- Health bug reporting with optional LLM assistance.
- Expanded user documentation.
