# Initial Maintainer Add-ons Inventory

This audit records the two current package boundaries for issue #181. BOORU,
Meme Maker, quick replies, and Drafts are capabilities within Composer Kit;
they are not separate add-ons. The catalog selection target is Chromium,
packages are composed at build time, and consequential composer or media
actions remain explicit.

## Composer Kit — package ID `tweet-composer-kit`

- Current package: the `Tweet Composer Kit 0.2.0-pilot` package exercised in
  cumulative QA by issue #188.
- Current catalog status: `under-review`. The package is maintainer-authored and
  present in QA, but its source root and exact package hash are not yet checked
  into an allowlisted catalog artifact path. The catalog must not make it
  selectable until those bytes and a trusted review record land together.
- Kind/lifecycle: runtime `app`, disabled by default, opened only from declared
  composer and reply actions.
- Capabilities: host-owned native Drafts, local quick-reply phrases, Remibooru
  browse/search, reviewed Milady/Remilio/Bonkler/Kagami maker handoffs, local
  Custom Pet request ZIP export, an explicit static-instruction clipboard
  action, and an explicit CHEESEWORLD link.
- Settings/storage: `milxdy.local.tweet-composer-kit.enabled` and up to 20
  phrases in `milxdy.local.tweet-composer-kit.customPhrases`.
- Site scope: X/Twitter composer and reply action surfaces. The package has no
  direct X DOM, tab, clipboard, cookie, authentication, or raw browser-message
  access.
- Remote scope: the host-owned adapters may contact
  `https://maker.remilia.org/*` and `https://remibooru.com/*` only after
  explicit package actions. Maker handoff sends reviewed caption fields only;
  Remibooru queries send bounded public facets, cursor, and page size only.
- Local file boundary: Custom Pet export reads only the PNG selected in its
  visible file control, combines explicit trait and rights choices locally,
  validates and downloads a two-file request ZIP, and never uploads, caches,
  posts, publishes, or infers missing rights or body choices. The optional
  clipboard control copies only its visible static handoff sentence.
- BOORU boundary: Remibooru metadata browsing, canonical-source links, and an
  explicit host-owned thumbnail attachment action are Composer Kit capabilities
  owned by #17/#188. The package receives no original-media URL or bytes, keeps
  no media or source-link cache, and cannot upload or post media.
- Meme Maker boundary: declared maker targets and caption/random-meme modes are
  Composer Kit capabilities owned by #79/#188. Generated media remains outside
  the package until the user reviews and acts on it.
- Core boundary: package validation, host callbacks, safe background adapters,
  Apps & Features, and permission enforcement stay in core. Composer Kit owns
  its panel, reply list, remote-query UI, and maker choices.
- Migration/conflicts: it uses a distinct package ID and does not replace the
  built-in `composerTools` typing helper.

## Share Kit — package ID `tweetPng`

- Current package: the reviewed checked-in package at
  `examples/packages/first-party-replacements/tweetPng`.
- Current catalog status: `published`; the catalog pins its version, exact
  package hash, review identity, and local source path.
- Kind/lifecycle: invoked `feature`, loaded only after the user chooses the
  declared contextual post action.
- Capabilities: locally review selected post text/media/quote/date/stats and
  visual options, then export the reviewed result as a PNG.
- Settings/storage: `milxdy.shareKit.enabled` plus existing
  `milxdy.settings.reskinProfile` and `milxdy.settings.visualTheme` properties.
- Site scope: only the X/Twitter post explicitly selected through the
  host-owned share action.
- Permissions/services: no host-permission expansion, optional permission,
  background service, or remote service. Package icons are declared and
  web-accessible for the package UI.
- User action: rendering and export are local. Share Kit never posts, uploads,
  attaches, or mutates an account.
- Core boundary: the host-owned contextual-action callback and Apps & Features
  registration remain core; Share Kit owns the review dialog and PNG renderer.
- Migration/conflicts: intentionally replaces the built-in `tweetPng` ID. The
  repository policy pins the exact package hash and requires explicit package
  consent and `--acknowledge-first-party-replacement`.
- Recovery: an explicit empty catalog selection returns the custom build to
  the built-in implementation while preserving existing settings.

## Release and QA gates

Before another record changes to `published`:

1. The package source exists under a checked-in allowlisted root.
2. The deterministic composer reproduces its catalog hash.
3. Catalog and local selection verification pass, including missing dependency,
   conflict, stale revision, checksum mismatch, missing artifact, and denied
   acknowledgement fixtures.
4. The selected commit is staged into the one cumulative QA host after overlap
   preflight without replacing another ticket's pending handoff.
5. Running and On-disk QA IDs match on the one persistent extension.
6. Maintainer QA verifies enable/disable/reset, disclosure accuracy, failure
   recovery, and no automatic posting/upload/account mutation.
7. Publication, push, PR, merge, and Pages deployment remain separate approvals.
