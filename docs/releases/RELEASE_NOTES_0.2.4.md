# milXdy 0.2.4 Release Notes

Status: release candidate. These notes describe the integrated candidate and will be finalized before publication.

## Composer Kit

- Adds reviewed composer and reply actions, native Drafts routing, quick-reply helpers, Remibooru browsing, and explicit Remilia Maker handoffs through the App SDK package boundary.
- Keeps package actions user-initiated and preserves host-owned focus, dismissal, posting, media, and permission controls.

## Share Kit

- Moves Tweet PNG into the reviewed Share Kit package while preserving preview, copy, download, browser share, settings compatibility, and rollback behavior.
- Adds granular visual controls, a subtle optional milXdy watermark, and an explicit RemiNet Chat staging flow without automatic posting.

## Miladychan and RemiNet

- Adds explicit pseudonymous text posting to the Miladychan Portal with destination confirmation, failed-submit recovery, watched-thread feedback, and native-site fallback.
- Improves RemiNet Chat placement and recovery, Beetol interactions, media-viewer rail behavior, and authenticated session handling.

## Custom pets and add-ons

- Adds the optional Pets Maker package, versioned Maker export bundles, reusable family templates, deterministic validation, and resumable diagnostics.
- Adds maintainer catalog and local custom-build selection groundwork with reviewed package validation, consent, provenance, and rollback controls.

## Platform and reliability

- Extends the App SDK to 0.2.4 with reviewed external-package composition, sanitized QA provenance, package-owned panels, explicit host callbacks, and stronger lifecycle verification.
- Reduces legacy runtime code, decomposes side-rail ownership, contains individual app-card failures, keeps Remilia tokens out of local storage, and requires explicit first-run Hub invocation.

## Candidate limitations

- This candidate is not published yet. Final Chromium and Firefox archives, checksums, manual browser QA, and the exact shipped issue disposition remain release gates.
- Package features that depend on third-party authentication, CAPTCHA, or upstream availability retain an explicit native-site fallback.
