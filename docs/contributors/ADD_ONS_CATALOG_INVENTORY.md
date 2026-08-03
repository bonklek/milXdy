# Initial Maintainer Add-ons Inventory

This audit records the three current package boundaries for issue #181. BOORU,
Meme Maker, quick replies, and Drafts are capabilities within Composer Kit;
they are not separate add-ons. The catalog selection target is Chromium,
packages are composed at build time, and consequential composer or media
actions remain explicit.

## Pets Maker — package ID `pets-maker`

- Current package: the reviewed checked-in package at
  `packages/maintainer/pets-maker`.
- Current catalog status: `published`; the catalog pins version
  `0.1.0-pilot`, exact package hash, review identity, source path, and build
  recipe.
- Installation/activation: selection and composition make the app available
  but preserve `defaultEnabled: false`. The user must separately enable it in
  **Apps & Features** before the Pets rail control can appear.
- Kind/lifecycle: lazy runtime `app`, loaded only on explicit `dockOpen`, with
  package-owned DOM/listener cleanup on close, disable, abort, and dispose.
- Capabilities: read one explicitly selected transparent Maker PNG; collect the
  exact family, optional NFT number, trait IDs, lower-body, footwear, and palette
  choices; explicitly fetch public traits for a selected family and NFT number;
  preview a deterministic 1024x1024 composite; and download a validated two-file
  request ZIP.
- Settings/storage: only `milxdy.local.pets-maker.enabled`. Form state, files,
  preview pixels, traits, and generated ZIPs are not persisted.
- Permissions/services: adds `https://maker.remilia.org/*` for the explicit
  public metadata Fetch action; no optional permission, background service,
  browser-tab access, clipboard access, or raw runtime messaging.
- Privacy: selected files and form values remain in the open app and local ZIP.
  Fetch sends only the selected public family and NFT number; returned traits
  populate the form and are not cached. The selected PNG is never uploaded.
- Dependencies/conflicts: none. Pets Maker uses its own ID and does not replace
  a built-in app.
- Removal/rollback: an explicit catalog selection without `pets-maker` removes
  its package from the next custom build. Interrupted or failed preparation and
  build promotion restore the prior catalog/build directories.

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
  browse/search, reviewed Milady/Remilio/Bonkler/Kagami maker handoffs, and an
  explicit CHEESEWORLD link.
- Settings/storage: `milxdy.local.tweet-composer-kit.enabled` and up to 20
  phrases in `milxdy.local.tweet-composer-kit.customPhrases`.
- Site scope: X/Twitter composer and reply action surfaces. The package has no
  direct X DOM, tab, clipboard, cookie, authentication, or raw browser-message
  access.
- Remote scope: the host-owned adapters may contact
  `https://maker.remilia.org/*` and `https://remibooru.com/*` only after
  explicit package actions. Maker handoff sends reviewed caption fields only;
  Remibooru queries send bounded public facets, cursor, and page size.
- BOORU boundary: Remibooru metadata browsing, canonical-source links, an
  explicit host-owned thumbnail attachment action are Composer Kit capabilities
  owned by #17/#188. The package receives no original-media URL or bytes and
  keeps no media or source-link cache. Public contribution remains tracked for
  0.2.5 in #24 and is not a 0.2.4 catalog capability.
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
