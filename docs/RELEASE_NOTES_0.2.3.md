# milXdy 0.2.3 Release Notes

milXdy `0.2.3` is the reliability and accessibility follow-up to `0.2.2`. It incorporates the unpublished browser fixes that were briefly prepared as `0.2.2.1` and expands the release into a full cross-feature remediation pass.

Status: in development.

## Included Fixes

- Isolate shared runtime failures so one app cannot strand cleanup, surface delivery, or idle work for other apps.
- Make startup, network, storage, worker, speech, and local-file workflows cancelable and recoverable.
- Restore reversible feature teardown and last-user-intent behavior across Maxxer, Music, Post-reading, Chat, Wiki, and Miladychan.
- Improve keyboard, focus, reduced-motion, live-region, and screen-reader behavior across the popup and in-page app surfaces.
- Keep Beetol hunts responsive by returning the mutation result before a separate background state reconciliation.
- Recover RemiNet Chat from stalled authentication or WebSocket opening instead of leaving the composer permanently disconnected on Connecting.
- Keep connector logout authoritative over cached/in-flight Chat authentication and abort background fetches when their shared deadline expires.
- Group Root Visual controls by their actual X/app ownership while preserving existing visual-theme storage and profile-pack compatibility.
- Show when more pinned apps are available above or below the visible side rail.
- Keep rail settings compact and separate from the Apps & Features catalog, with one-row ordering controls and advanced app presets collapsed by default.
- Preserve responsive native Like animation while keeping lightweight Maxxer catch and level-up feedback.
- Remove two suspected reliability-audit lag contributors: replace mutation-driven main-column button rescans with a disabled-aware, capped visible-page check every five seconds, and replace the dock's root-level relational dialog selector with a static left-rail safe area.
- Show the final Beetle Hunt reward before the red Done state and normal persisted 90-minute cooldown.
- Open supported Wiki tabs, details, and collapsible sections before read-aloud highlights and scrolls their text.
- Show poke controls only for accounts with a confirmed RemiliaNET identity while retaining independent score and beetle badges.
- Make active Chat reaction counts visibly pressed, keep dark Chat pop-outs free of bright outer edges, and use darker Post/Reply buttons in the dark default preset.
- Match the Remilia Wiki read-aloud control to the square Wiki button treatment.
- Preserve the Firefox/Waterfox compatibility, target-specific update download, fullscreen DM media, and Tweet PNG rendering improvements prepared after `0.2.2`.

## Release Gate

The canonical non-live release gate passed on 2026-07-10 after the reliability and RemiliaNET recovery fixes were integrated. This includes strict TypeScript, Chromium and Firefox builds, platform and messaging contracts, local-package trust tests, Firefox lint classification, extension/app smoke, release packaging, checksums, and reproducibility.

This release is not ready for publication until manual authenticated X/RemiliaNET QA covers the changed runtime, Beetol Hunt, RemiNet Chat live connection and sending, Post-reading, Wiki, rail/settings, and representative feed/notification surfaces.

Expected release assets are `milXdy-0.2.3-chromium.zip` and `milXdy-0.2.3-firefox.zip`.
