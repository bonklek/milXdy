# milXdy 0.2.1 Release Notes

milXdy `0.2.1`, **The Polish Patch**, is a public beta update focused on the fixes found during 0.2.0 platform testing: update flow correctness, cooldown memory, layout polish, and immediate usability repairs.

Status: released. Automated release gates passed, release artifacts were verified, and live QA for the 0.2.1 release scope is complete.

## Highlights

### Update flow

- The update checker now targets the latest normal published GitHub release and ignores drafts/prereleases on the normal user update channel.
- The popup prefers the release archive matching the current browser target.
- Safe manual update steps were tightened around replacing files in the same loaded extension folder so settings, diagnostics, and RemiNet/Beetol login state are preserved.
- The update flow can hand the copied checklist to a configured LLM target for testers who want guided instructions in ChatGPT, Claude, Grok, or a custom assistant URL.

### App platform and performance polish

- Apps Hub setup choices now keep all first-party apps available and toggleable while applying the selected default pins and Performance mode.
- Expanded app cards expose the enable/disable control, and the selected-state color has stronger contrast.
- Runtime lag handling was improved through shared scanner behavior, performance budgets, and cached RemiStats work in Fast mode.
- Release packaging now keeps the public download choice to Chromium or Firefox while Lite, Balanced, and Full remain in-extension setup choices.
- The extension smoke verifier now follows the active package/manifest version and the 0.2.1 build-profile model where first-party apps stay available across profiles.

### RemiStats, RemiNet, and Beetol

- Poke cooldowns are restored more consistently after refresh and fall back to a 24-hour cooldown when RemiliaNET does not return an explicit value.
- When the same user appears multiple times on screen, visible poke buttons for that user update together after a successful poke.
- Optional tweet-like-on-poke can click X's Like button for the poked tweet after a successful RemiNet poke.
- Incoming poke flags moved out of the tweet action row to reduce action-button crowding.
- RemiStats badge rendering sanitizes score and beetle metrics and cleans Remilia profile handles before using them in badge state or profile links.
- Beetol Hunt now remembers cooldown/exhausted state across refreshes, restores ready charges when no cooldown remains, and keeps the hunt action clickable when it is visually exhausted but not cooling down.

### Post-reading

- Main-feed Post-reading playback gets the smoother estimated highlight behavior previously refined in the Wiki reader path.
- Hyperlink-skipping no longer drifts highlighting offsets.
- Voice selection now has compact language and gender filters, and voice testing respects the selected filter.
- Voice-highlight testing has a stop control, and runtime lag handling was tightened around smooth/estimated highlight work.
- The extra strip at the bottom of the Post-reading popout/control tab was removed so settings remain visible.

### Music

- Compact mode has a maximum height so it cannot be stretched into the full-player use case.
- The panel can be resized narrower, and layout state is remembered.
- Minimized controls were simplified.
- The full player volume slider no longer overflows below the panel.

### RemiNet Chat

- Scrolled chat history can load older messages in batches with a **Show more** control.
- Chat media preview behavior was hardened so the image viewer close button remains reachable.

### X/Twitter visual polish

- Notification cards regain visible tinting.
- Replies that appear mid-thread on a user's Replies tab get a clearer connector hint even when the parent tweet is not loaded.
- Profile hover-card delay was reduced on the X Notifications tab.

### Firefox and permissions

- Firefox builds remain part of the release matrix.
- X page CSP noise is classified separately from actionable extension-resource or RemiStats asset permission problems.
- RemiStats tooltip PFP loading documents the required `https://pfp.remilia.net/*` permission behavior.
- `esbuild` was updated to `0.28.1` while keeping release dependency overrides in place.

## GitHub Issue Coverage

The public `0.2.1` milestone tracks the release as **The Polish Patch - bug fixes, cooldown correctness, layout polish, and immediate usability repairs**.

- `#5` Show cooldown when poking an already-poked user: covered by cooldown fallback/restoration and synchronized visible poke-button state.
- `#7` Keep image viewer close button clickable when opening chat images: covered by RemiNet Chat media preview hardening.
- `#8` Classify and resolve Firefox CSP warnings for RemiStats/X assets: covered by Firefox warning classification and PFP permission docs.
- `#9` Restore visible unread notification tint on X Notifications tab: covered by notification tint polish.
- `#10` Remember music player layout state and simplify minimized controls: covered by Music sizing/layout/minimized control changes.
- `#11` Remove extra bottom strip under Post-reading player: covered by Post-reading layout polish.
- `#12` Reduce profile hover-card delay on X Notifications tab: covered by notification-surface hover-card tuning.
- `#13` Keep Post-reading highlights synced when hyperlinks are skipped: covered by hyperlink-offset verification.
- `#40` Preserve Beetle Hunt cooldown and timer after refresh: covered by Beetol cooldown/exhausted state persistence.
- `#69` Fix release update checker for normal GitHub releases: covered by update checker and normal-release documentation.

Close or update these GitHub issues after the public release is published and the release branch is transferred back cleanly.

## QA Status

Passed in the current release workspace:

- `pnpm run typecheck`
- `npm run verify:update-check`
- `npm run verify:post-reading:hyperlink-offsets`
- `npm run build:profiles`
- `npm run verify:platform`
- `npm run verify:app-smoke:020`
- `npm run verify:smoke:020`

Manual QA completed for this release scope:

- Chrome live testing on X/Twitter for notification tinting, reply connector hints, poke cooldown synchronization, Beetol cooldown memory, RemiNet Chat older-message loading, and Post-reading feed highlighting.
- Follow-up testing for the reported Post-reading smooth-highlight freeze after the runtime lag handling and voice-highlight stop-control changes.
- Firefox smoke testing for RemiStats tooltip PFPs, X CSP warning classification, core popup controls, and profile-build loading.

Release packaging, checksum verification, and reproducibility verification passed for the published 0.2.1 artifacts.

## Upgrade Notes

Use the same safe in-place update path as earlier unpacked beta releases: replace files inside the same loaded extension folder, reload the existing extension card, and refresh X/Twitter tabs. Do not remove and re-add the extension unless you intentionally want to reset local extension storage.
