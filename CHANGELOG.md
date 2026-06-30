# Changelog

## 0.2.1

Status: released.

See [milXdy 0.2.1 release notes](docs/RELEASE_NOTES_0.2.1.md).

Current release-gate state:

- `typecheck`, profile builds, update-check verification, Post-reading hyperlink-offset verification, extension smoke, app smoke, and platform checks passed in this workspace.
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
- Classified Firefox CSP/PFP behavior and kept Firefox profile builds in the release matrix.
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
