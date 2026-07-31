# Initial Maintainer Add-ons Inventory

This audit records the package boundary for issue #181 without absorbing feature
implementation owned by #17, #79, or #188. The catalog selection target is
Chromium, packages are composed at build time, and all consequential composer
or media actions remain explicit.

## BOORU — proposed ID `booru`

- Existing source: issue #17 owns the Remibooru reaction-media discovery,
  attribution, pagination, link-first cache, and unavailable-source behavior.
  Issue #188 currently places that capability inside the single Composer Kit
  package.
- Current status: `unavailable`; there is no package root, version, hash, or
  approved integrated QA result.
- Proposed kind/lifecycle: user-action feature inside Composer Kit, not a
  separate rail app. Remote behavior must start disabled until its reviewed
  consent model allows it.
- Proposed site/remote scope: X post and reply composer-adjacent UI;
  `https://remibooru.com/*` for explicit public facet/cursor queries and
  thumbnail metadata. No X session, cookie, account, draft, or authentication
  data may be sent.
- Proposed storage: no grant from #181. The removable link/metadata cache,
  tags, dead-link pruning, and reset contract remain with #17.
- Proposed assets/messages: package icon and picker UI assets; any background
  message types must be package-owned and declared by #17/#188. No
  web-accessible asset is approved here.
- Core boundary: package validation, safe background routing, Apps & Features,
  and explicit host-mediated handoffs remain core. Search/browse behavior,
  result rendering, attribution, and media choices remain package-owned.
- Migration/conflicts: no built-in ID is replaced. A future artifact must use
  the Composer Kit package decision from #188 or update this proposed ID before
  publication; #181 does not create a competing standalone package.

## Tweet Composer — stable replacement ID `composerTools`

- Existing source: `src/apps/composer-tools/content.ts`; the candidate bundles
  it through `packages/maintainer/composerTools/src/content.ts` without behavior
  changes.
- Current status: reviewed package candidate, `under-review` for publication
  until cumulative manual QA passes.
- Kind/lifecycle: runtime `feature`, startup-triggered, local-only.
- Settings/storage: `composerTools.enabled` in Apps & Features owns
  `local:milxdy.composerTools.enabled`. Enable, disable, reset, and lifecycle
  disposal preserve existing behavior and user state.
- Site scope: active X/Twitter post and reply composer textboxes. DMs, search
  boxes, `input`, and `textarea` elements are explicitly excluded.
- Permissions/services/assets: no new host or optional permission, no remote
  service, no background message, no package asset, and no web-accessible
  resource. The content entry is privileged extension code and therefore
  requires package consent.
- User action: the helper reacts only to typed dash input. It never posts,
  uploads, opens a remote page, or transmits composer text.
- Core boundary: the shared content runtime, Apps & Features, settings storage,
  and lifecycle delivery stay core; only the existing typing helper payload is
  supplied by the package.
- Migration/conflicts: intentionally replaces the built-in `composerTools` ID
  so only one implementation is present. The repo-owned replacement policy pins
  the exact package hash and requires
  `--acknowledge-first-party-replacement`. The composer preserves the stable
  registry identity and rejects any second `composerTools` package.
- Recovery: an explicit empty catalog selection returns the build to the
  built-in implementation while preserving the same enablement key.

## Meme Maker — proposed ID `memeMaker`

- Existing source: issue #79 owns maker destinations, package UX, generator
  behavior, attribution, and explicit media review. Generic bounded
  external-handoff infrastructure exists, but no reviewed maker package exists.
  Issue #188 currently places this capability inside Composer Kit.
- Current status: `unavailable`; there is no package root, approved destination
  list, version, hash, or integrated QA result.
- Proposed kind/lifecycle: user-action feature inside Composer Kit. No automatic
  rail item and no background start.
- Proposed site/remote scope: an explicit composer-adjacent control may open a
  declared HTTPS maker origin. No origin or host-permission expansion is
  approved by #181.
- Proposed storage: none. Captions, generated media, source-page data, and
  account state may not be stored unless #79 declares and reviews exact keys.
- Proposed assets/messages: package-owned controls/icons and declared external
  handoffs; no background message or web-accessible asset is approved here.
- Core boundary: the host may provide the generic explicit external-open and
  bounded caption adapter. Maker selection, captions, destination behavior,
  generated-media review, and attribution remain package-owned.
- Migration/conflicts: no built-in ID is replaced. A future artifact must follow
  the Composer Kit package decision from #188 rather than silently adding a
  second maker package or permission set.

## Release and QA gates

Before a record changes to `published`:

1. The owning feature issue supplies a reviewed package root and exact metadata.
2. The deterministic package build reproduces its catalog hash.
3. Catalog and local selection verification pass, including missing dependency,
   conflict, stale revision, checksum mismatch, missing artifact, and denied
   acknowledgement fixtures.
4. The selected commit is staged into the one cumulative 0.2.4 QA host after
   overlap preflight.
5. Running and On-disk QA IDs match on the one persistent extension.
6. Maintainer QA verifies enable/disable/reset, disclosure accuracy, failure
   recovery, and no automatic posting/upload/account mutation.
7. A focused follow-up commit changes availability and trusted review metadata;
   publication, push, PR, merge, and Pages deployment remain separate approvals.
