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

## Share Kit Unicode layout candidate

- Post, quoted-post, and link-card title wrapping uses exact-pinned Pretext
  0.0.8 after the existing font wait, with the same named TwitterChirp fallback
  stack used for final Canvas drawing.
- International fixtures cover CJK punctuation, Thai/Khmer no-space text,
  Arabic and mixed bidirectional text, combining marks, emoji/ZWJ sequences,
  hard breaks, repeated whitespace, and long URLs/hashtags/handles.
- The adapter remains local-only and user-invoked, preserves layout caps and
  ellipsis contracts, and exposes positioned formatted fragments consumed by
  the separately reviewable #222 editor/state/accessibility slice.
- Share Kit now consumes that formatted-fragment seam for local post-text
  editing: bullets, bold, italic, strikethrough, combined styles, clear/reset,
  keyboard and screen-reader controls all update the reviewed PNG used by Copy,
  Download, and user-initiated sharing without persisting editor state.

## Known limitations

- milXdy remains an unpacked GitHub beta.
- No 0.2.5 feature behavior is represented as accepted at release
  initialization.
- Chromium and Firefox baseline packages demonstrate reproducible transport,
  not user-observed browser behavior.
