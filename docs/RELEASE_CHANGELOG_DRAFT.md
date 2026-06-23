# milXdy 0.1.2 Changelog

Changes since `b8737fbc4a2bb2b56a2113e113a448c93cb75dda`.

This changelog covers the `0.1.2` beta release.

## Highlights

- Integrated Beetol Game as the renamed successor to the previous bextol-hunter code path.
- Added a fuller RemiNet connector login flow with persisted tokens, RemiliaNET SSO retry, cookie-backed API compatibility, and local poke diagnostics.
- Expanded RemiStats badges with independent score/beetle/poke icons, profile badge grouping, poke animation, and live cooldown display.
- Added Remilia Wiki Grok workflows, including post-seeded, generic, and profile prompts plus one-shot and Socratic research modes.
- Added a draggable Remilia Wiki new-page shortcut after Grok prompting.
- Added Postreader OCR host support and richer read-aloud handling for image text, quotes, link previews, and custom TTS.
- Added bug reporting from the Diag tab through GitHub or X, with optional LLM-assisted report drafting.
- Added user-facing documentation, setup guidance, and a change inventory for future release audits.

## Added

### Remilia Wiki

- Context-menu submenu for **Create Wiki entry with Grok**:
  - **Use this post as a jumping off point**
  - **Create a generic article prompt**
  - **Create a profile article prompt**
- **Grok workflow** setting:
  - **One-shot draft** sends a single complete Remilia Wiki research/drafting prompt.
  - **Socratic research** opens Grok's conversation view and sends staged prompts for scouting, source discovery, article planning, and clean MediaWiki drafting.
- Remilia Wiki prompt rules for:
  - commit-summary lines
  - inline citation templates
  - `mediawiki` fenced output
  - profile notability checks
  - Grok render-artifact cleanup
  - Remilia Wiki internal links and style
- Draggable Remilia Wiki new-page shortcut after Grok prompting.
- New-page shortcut opens `https://wiki.remilia.org/index.php` with the configured preload template.
- Shortcut snapping and overlap avoidance with the Beetol hunter widget.
- Wiki helper AI pack files under `public/wiki-helper/`.

### RemiNet Connector And Beetol Game

- Beetol Game feature bundle under `src/features/beetol/` and `public/beetol/`.
- Migration from legacy `bextol.*` token keys to `beetol.*` token keys.
- RemiliaNET login using **Username or email**.
- Access and refresh token persistence in Chrome extension local storage.
- Refresh-token recovery when checking auth status.
- RemiliaNET SSO flow:
  - **Open RemiliaNET SSO**
  - **Retry session**
- RemiliaNET cookie compatibility:
  - requests browser `cookies` permission
  - sets short-lived `authToken` cookie from the stored access token before API calls
  - clears the cookie on logout
- Auth verification with `/api/profile/whoami`.
- Last poke diagnostic in the RemiNet connector settings panel.
- Poke result verification and fallback retry behavior.
- Poke cooldown parsing from multiple RemiliaNET response shapes.
- 24-hour cooldown fallback when RemiliaNET accepts a poke without returning an explicit cooldown.

### RemiStats

- Independent RemiStats score, beetle-count, and poke icon toggles.
- Profile badge grouping so score badges and poke actions stay together.
- Poke-button shake animation while sending.
- Live cooldown pill after pokes.
- Better handling when a poke is rejected with an existing cooldown.
- Cleaner removal of profile badge groups when RemiStats is disabled.

### Postreader

- OCR host page at `public/ocr.html`.
- Built output for `dist/ocr.html` and `dist/ocrHost.js`.
- Improved image OCR and image-alt reading order so image text is read before parent caption text.
- Skip behavior for active OCR/image text.
- Custom HTTP TTS endpoint documentation.
- Custom endpoint timing support for synced highlighting when boundaries are returned.

### Maxxer

- Optional RemiStats beetle-user bridge, enabled by default, so accounts with RemiStats beetle stats can count as Maxxer-worthy.
- Full settings surface for mode, sounds, level badge, card themes, whitelist handles, manual Milady handles, and legacy import.

### Diagnostics And Feedback

- Diag tab bug-report actions:
  - **Report via GitHub**
  - **Report via X**
  - optional **LLM assisted** prompt copying
- GitHub issue prefill for bug reports.
- X bug-report reply prefill to the collector post.
- Local notification when the LLM-assisted bug prompt is copied.
- Expanded diagnostic/status documentation.

### Documentation

- Full VPL text in `LICENSE` and README license section.
- `docs/USER_GUIDE.md` for user workflows.
- `docs/CHANGE_INVENTORY.md` for release documentation audits.
- Updated `docs/AGENT_SETUP_GUIDE.md` with feature verification steps.
- README updates for install/update persistence, privacy notes, RemiNet cookies permission, Grok workflows, bug reporting, and troubleshooting.

## Changed

- Renamed bextol-hunter paths and assets to Beetol naming.
- Switched the release update endpoint to `bonklek/milXdy`.
- Consolidated extension settings into tabbed popup panels.
- Improved popup auth status styling and explanatory copy.
- Reworked feedback reporting from separate bug/feature buttons into bug-focused GitHub/X destinations with optional LLM assistance.
- Kept feature bundles lazy-loaded so disabled feature code is not parsed on initial page load.

## Fixed

- Reduced risk of losing Beetol login state after extension reloads by checking and refreshing persisted refresh tokens.
- Improved RemiliaNET 2FA handling by documenting the password-flow limit and adding SSO/session retry.
- Improved poke UX when RemiliaNET reports cooldowns or rejects duplicate pokes.
- Added generated-output checks for OCR assets.
- Added privacy/security documentation for local tokens, cookies, network calls, and extension storage persistence.

## Known Limits

- Manual GitHub release installs do not auto-update; users must replace files and reload the unpacked extension.
- Loading a different unpacked folder can create a different extension identity and reset local settings/tokens.
- RemiliaNET 2FA cannot complete through the password-grant popup flow. SSO retry only works if RemiliaNET allows the relevant APIs through browser-session cookies.
- Grok workflows depend on X/Grok DOM labels and may need updates if X changes its UI.
- OCR is local and can miss stylized, low-resolution, or low-contrast image text.

## Release Checklist

- Confirm final release version in `public/manifest.json`: `0.1.2`.
- Run `npm.cmd run typecheck`.
- Run `npm.cmd run build`.
- Load `dist` as unpacked extension and smoke test the four screenshot workflows.
- Check `git status --short`.
- Re-run a PII/secret scan before publishing.
- Commit locally, then wait for explicit approval before pushing.
