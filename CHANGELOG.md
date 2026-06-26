# Changelog

## 0.1.5

Status: release candidate.

Highlights:

- Added a unified **Audio** tab that groups Postreader voice/playback settings, RemiStats sounds, Milady Maxxer sounds, and visual interaction sounds.
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
- Added feature timing diagnostics for RemiStats, Miladymaxxer, Postreader, and Wiki processing when performance diagnostics are enabled.
- Added repeatable Chromium and Firefox build targets, with Firefox manifest generation and QA linting inspired by the contributor work in bonklek/milXdy#4.
- Moved Health/reporting into the Main popup tab and compressed popup navigation to Main, Wiki Links, Audio, RemiNet, and Milady Maxxer.
- Changed Postreader button placement to prefer the action row instead of tweet header controls.
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
- Postreader OCR/custom TTS documentation.
- Diag bug reporting with optional LLM assistance.
- Expanded user documentation.
