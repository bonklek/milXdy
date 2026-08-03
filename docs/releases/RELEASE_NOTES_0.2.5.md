# milXdy 0.2.5 Release Notes

milXdy `0.2.5` is the **Reader Voice** candidate release. This document is an
initialization placeholder, not a statement that candidate features have
shipped or passed manual browser QA.

## Candidate direction

The proposed release theme is explicit, review-first listening for supported
long-form content. The exact feature boundary and acceptance criteria remain
subject to maintainer approval before implementation begins.

## Initialization state

- Package, extension, and App SDK declarations target `0.2.5`.
- Fresh Chromium and Firefox baseline artifacts must be generated from the
  version-alignment commit and verified by checksum and reproducibility checks.
- A dedicated 0.2.5 QA host and one persistent Chrome QA output must be created
  from that exact commit.
- A successful build is not manual QA. Browser acceptance requires matching
  Running and On-disk build identities plus maintainer-observed behavior.

## Scope boundary

Open milestone issues and work deferred from 0.2.4 remain candidates only.
Historical commits, archives, and QA evidence are not accepted into 0.2.5
without an explicit scope decision and deliberate integration.

## Known limitations

- milXdy remains an unpacked GitHub beta.
- No 0.2.5 feature behavior is represented as accepted at release
  initialization.
- Chromium and Firefox baseline packages demonstrate reproducible transport,
  not user-observed browser behavior.
