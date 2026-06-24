# milXdy 0.1.3 Release Notes

milXdy `0.1.3` is a public beta polish release focused on safer updates, clearer documentation, and RemiNet activity surfaces.

## New And Changed

### Guided beta updates

- Added Suite-tab update status controls for GitHub beta releases.
- Added **Download**, **Steps**, and **Reload** actions so testers can update the existing unpacked folder without removing the extension.
- Documented the safe update path for preserving settings, Maxxer stats, diagnostics, and RemiNet/Beetol login state.

### RemiNet Chat sidebar

- Added an optional **Show RemiliaNET chat on X home** setting.
- Mounts a right-sidebar RemiNet chat surface on supported X/Twitter routes when enabled.
- Reuses the existing RemiNet/Beetol auth state.
- Supports live chat, reactions, pokes, attachments, media previews, profile links, and minimized mode.
- Keeps the feature off by default while beta performance and auth behavior are validated.

### Incoming poke indicators

- Adds recent incoming RemiliaNET poke flags on X/Twitter accounts when connector auth is available.
- Uses notification sender handles inside the active poke window rather than treating old notifications as current pokes.
- Documents the limits of notification-based matching.

### Poke and Beetol status polish

- Checks RemiliaNET profile eligibility before users click a poke button, then applies returned cooldown state to matching poke buttons.
- Caches poke eligibility briefly so profile timelines do not repeatedly hit RemiliaNET for the same account.
- Cleans up Beetol panel readiness text so catch/hunt cooldowns show clearer **Ready**, **Both ready**, or next-cooldown states.

### Settings menu buildout

- Reworked the popup tabs into clearer user-facing sections: Overview, Wiki Links, Read Aloud, RemiNet, Milady Maxxer, and Health.
- Grouped settings inside each tab so prior extension controls remain visible without one long flat menu.
- Added clearer labels for Postreader voice/playback/content/interface/shortcut controls, RemiNet badge/icon/auth controls, and Milady Maxxer display/list controls.
- Added signed-in styling for the RemiNet auth session panel and hides stale poke diagnostics once auth is active.

### Documentation and release planning

- Reworked the README into a compact front door.
- Added a docs index and split public guidance into dedicated install/update, user guide, troubleshooting, privacy, roadmap, and contributing pages.
- Added a root changelog and release-specific notes.
- Updated the public roadmap so already-shipped features are no longer presented as future work.
- Opened GitHub Discussions for beta support, ideas, and release-planning feedback.

### RemiNet/Beetol auth clarity

- Clarified that the login field accepts **Username or email**.
- Documented RemiliaNET 2FA fallback through browser SSO and **Retry session**.
- Documented RemiNet/Beetol login persistence expectations across browser restarts, extension reloads, and ordinary in-place updates.
- Expanded the privacy notes for the browser `cookies` permission and RemiliaNET session behavior.

## Tester Notes

- Keep loading the same unpacked extension folder when updating.
- Do not remove and re-add the extension unless you intend to reset local extension storage.
- RemiNet Chat is opt-in from the popup and should be tested on X home timelines first.
- Use the Diag tab for bug reports and include enabled features, version, relevant console errors, and whether a refresh or extension reload changed the behavior.

## Verification

Release verification should include:

- `npm.cmd run typecheck`
- `npm.cmd run build`
- source/docs scan for personal identifiers, secrets, and stale placeholders
- manifest/package version check for `0.1.3`
- smoke test of popup settings, guided updater, RemiNet connector auth status, incoming poke indicators, and optional RemiNet Chat loading
