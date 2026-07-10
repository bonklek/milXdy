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
- Preserve the Firefox/Waterfox compatibility, target-specific update download, fullscreen DM media, and Tweet PNG rendering improvements prepared after `0.2.2`.

## Release Gate

The canonical non-live release gate passed on 2026-07-10 after the reliability and RemiliaNET recovery fixes were integrated. This includes strict TypeScript, Chromium and Firefox builds, platform and messaging contracts, local-package trust tests, Firefox lint classification, extension/app smoke, release packaging, checksums, and reproducibility.

This release is not ready for publication until manual authenticated X/RemiliaNET QA covers the changed runtime, Beetol Hunt, RemiNet Chat live connection and sending, Post-reading, Wiki, rail/settings, and representative feed/notification surfaces.

Expected release assets are `milXdy-0.2.3-chromium.zip` and `milXdy-0.2.3-firefox.zip`.
