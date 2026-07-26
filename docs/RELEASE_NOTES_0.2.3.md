# milXdy 0.2.3 Release Notes

milXdy `0.2.3` is the reliability and accessibility follow-up to `0.2.2`. It brings a broad set of recovery, performance, and interface improvements across the extension.

## Included Fixes

- Isolate shared runtime failures so one app cannot strand cleanup, surface delivery, or idle work for other apps.
- Make startup, network, storage, worker, speech, and local-file workflows cancelable and recoverable.
- Restore reversible feature teardown and last-user-intent behavior across Maxxer, Music, Post-reading, Chat, Wiki, and Miladychan.
- Improve keyboard, focus, reduced-motion, live-region, and screen-reader behavior across the popup and in-page app surfaces.
- Keep Beetol hunts responsive by returning the mutation result before a separate background state reconciliation.
- Keep fast RemiliaNET Hunt available through all three charges, immediately darken resolved Claim and exhausted Hunt controls, and refresh the fast-result display from current Beetle state.
- Recover RemiNet Chat from stalled authentication or WebSocket opening instead of leaving the composer permanently disconnected on Connecting.
- Keep connector logout authoritative over cached/in-flight Chat authentication and abort background fetches when their shared deadline expires.
- Group Root Visual controls by their actual X/app ownership while preserving existing visual-theme storage and profile-pack compatibility.
- Show when more pinned apps are available above or below the visible side rail.
- Keep rail settings compact and separate from the Apps & Features catalog, with one-row ordering controls and advanced app presets collapsed by default.
- Preserve responsive native Like animation while keeping lightweight Maxxer catch and level-up feedback.
- Reduce unnecessary work during browsing by using a bounded visible-page check for controls and a stable left-rail safe area for the dock.
- Show the final Beetle Hunt reward before the red Done state and normal persisted 90-minute cooldown.
- Open supported Wiki tabs, details, and collapsible sections before read-aloud highlights and scrolls their text.
- Show poke controls only for accounts with a confirmed RemiliaNET identity while retaining independent score and beetle badges.
- Make active Chat reaction counts visibly pressed, keep dark Chat pop-outs free of bright outer edges, and use darker Post/Reply buttons in the dark default preset.
- Match the Remilia Wiki read-aloud control to the square Wiki button treatment.
- Include Firefox/Waterfox compatibility, target-specific update downloads, fullscreen DM media, and Tweet PNG rendering improvements introduced after `0.2.2`.
- Localize the browser-provided extension name and description in Russian, falling back to English elsewhere. The in-app interface remains English in this release.
- Add an Appearance toggle for hiding X's dot-style hidden-message-request indicator without suppressing numbered unread badges.
- Add the opt-in Link Browser app: Alt-click a link on X/Twitter to inspect it in a docked, sandboxed reader panel while normal links keep their native behavior.

## What This Means

- Apps recover more gracefully from failed, canceled, or stale work.
- Settings, startup, scanning, speech, and local-file actions are more dependable.
- Chat, reading, music, Wiki, visual, and game surfaces clean up predictably when you switch pages or turn them off.
- Keyboard navigation, focus behavior, motion preferences, and screen-reader support are improved throughout the extension.
- Everyday browsing work is kept lighter, especially around interactive X surfaces.
