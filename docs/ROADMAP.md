# milXdy Roadmap

This roadmap is a public planning guide for beta work. It is intentionally not a promise of exact scope or dates. Items can move between releases as testing, API limits, X/Twitter UI changes, and RemiliaNET constraints become clearer.

## Versioning Rule

- `0.1.x` releases were early integrated-extension beta releases.
- `0.2.x` releases are platform beta releases. They can change architecture, app surfaces, packaging expectations, and public product framing without implying final product stability.

## Most Recent Release

For older shipped details, see the descending [changelog](../CHANGELOG.md).

## Released: 0.2.0 - The Platform Update

Theme: app platform refactor, side-rail apps, performance modes, and new first-party app surfaces.

- First-party app platform. Labels: `architecture`, `performance`, `settings`, `distribution`.
  - moved feature loading onto a shared app registry and lifecycle contract
  - made build entries, copied assets, host permissions, dock metadata, and runtime cost metadata registry-driven
  - documented the local-first app SDK and future GitHub app-package path
  - presented this as the first platform/mod-system pass, not the completed external app layer
  - gave developers enough manifest, lifecycle, surface, and Hub vocabulary to begin designing future milXdy apps
- Shared runtime and performance modes. Labels: `architecture`, `performance`.
  - shrank the root content bootstrap
  - added one shared scanner, route service, lifecycle owner, and idle scheduler
  - separated Appearance intensity from Performance mode: Fast, Balanced, Full, and Developer
  - kept disabled or unopened heavy apps lazy wherever possible
- Shared overlay dock and app panels. Labels: `ux`, `architecture`.
  - gave dockable apps one shared side-rail, frame, drag/resize behavior, theme resolution, and panel persistence model
  - moved RemiNet Chat, Post-reading, Beetol, Miladychan, Music, and Maxxer-style panels toward a consistent app shell
- Background service consolidation. Labels: `architecture`, `security`.
  - centralized background message routing and strict fetch allowlists
  - kept RemiStats, RemiliaNET, Miladychan, music, image proxy, and upload-style services on typed message paths
- Miladychan Portal. Labels: `miladychan`, `ux`, `experimental`.
  - added a docked Miladychan board/thread browser and portal surface
  - kept the native Miladychan site primary and preserved pseudonymous board culture
  - left deeper board/deck/radio expansion as future follow-up
- Music MVP and local radio foundation. Labels: `music`, `integration`, `experimental`.
  - added a docked local music app with library/playlists/radio groundwork
  - supported local-first ISRC enrichment with optional user-provided AcoustID key and MusicBrainz lookup
  - kept lifestyle radio/stations as a future expansion rather than a basic player-only vision
- Public docs and onboarding posture. Labels: `docs`, `onboarding`, `ux`.
  - updated public docs around the platform model, app SDK, performance modes, and Firefox/Chromium install paths
  - kept screenshot/readme/onboarding work scoped to what is accurate for the platform release

## Released: 0.1.5

Theme: Firefox compatibility, RemiNet polish, screenshot sharing, and RemiNet/Beetle profile identity.

- Firefox package pipeline. Labels: `browser-compat`, `experimental`.
  - added repeatable Chromium and Firefox build targets
  - added Firefox manifest generation, Firefox linting, and Firefox QA documentation
  - manual Firefox smoke testing remains required before broad Firefox support claims
- RemiNet Chat polish. Labels: `reminet`, `chat`, `ux`.
  - added replies, reply previews, reply context rendering, and reply payload support
  - expanded reaction choices and reaction tooltips
  - added video attachment hydration and profile lookup caching
- RemiNet auth and poke polish. Labels: `reminet`, `beetol`, `ux`.
  - replaced direct username/password popup auth with browser-session RemiliaNET auth
  - added explicit disconnect/retry behavior
  - added outline poke controls, persisted poke cooldowns, gold incoming-poke styling, and Maxxer XP credit for successful pokes
- Beetol and profile identity. Labels: `beetol`, `identity`, `nft`, `ux`.
  - improved Beetol cooldown handling, hunt charge display, and ready/cooldown/exhausted states
  - added Beetle trophy shelf profile banners
  - added original, trophy shelf, and random Banners NFT profile banner cycling with lever artwork and spin sound
- Tweet PNG export. Labels: `reminet`, `security`, `experimental`.
  - added local PNG rendering from X/Twitter share actions
  - added clipboard, download, and share paths
  - added quote, media, date, RemiStats, border, and palette controls

## Coming Platform Direction: Composable App/Mod System

Theme: turn bundled first-party features into efficient composable apps and open a path for community-built milXdy apps.

The long-term platform goal is a complete mod system where default apps and future community apps can live as packages in an apps folder. Each app should declare its manifest, surfaces, permissions, assets, dock behavior, Performance-mode cost, privacy notes, background services, and lifecycle hooks, then compose with the shared milXdy runtime instead of patching the extension root directly.

This will take more refactoring than a simple folder move. Many apps need the same expensive substrate: X/Twitter timeline scanning, profile/user detection, route handling, media detection, shared visual effects, overlay panels, storage, background fetches, and diagnostics. Those systems need to remain shared so apps can be powerful without multiplying observers, network queues, DOM writes, and visual-effect layers.

Near-term platform work after `0.2.0` should therefore focus on:

- extracting default apps behind cleaner package boundaries while keeping shared scanners and effects centralized
- defining the apps folder layout and package manifest shape
- stabilizing lifecycle hooks for app boot, enable, disable, route changes, surface delivery, overlay open/close, and dispose
- adding review rules for host permissions, background services, storage keys, privacy labels, and performance cost
- keeping Apps Hub disclosure tied to manifest metadata so users understand what each app loads, stores, and fetches
- deciding how community apps are installed, updated, verified, disabled, and removed

Developers can begin designing against the `0.2.0` concepts now, but external install support and stable third-party compatibility are still future work.

## Planned: 0.2.1

Theme: RemiNet chat placement, expanded Maxxer collection controls, and direct RemiNet PNG sharing.

- Chats-tab RemiNet pseudo chat. Labels: `reminet`, `chat`, `ux`.
  - add a pseudo chat entry to the X Chats tab with RemiNet chat pinned at the top
  - keep it visually distinct from native X DMs so users understand what surface they are using
  - reuse existing RemiNet Chat auth, background service, and docked chat handling where possible
- Expanded Maxxer collection behavior. Labels: `maxxer`, `performance`, `settings`.
  - include recognized collections that the local classifier/model pipeline can support reliably
  - add an advanced behavior menu for maxxed, lower-tier, neutral, or minimized treatment
  - complete reversible non-Milady minimization without minimizing RemiStats beetle users
- Direct Tweet PNG upload to RemiNet. Labels: `reminet`, `security`, `experimental`.
  - build on the local Tweet PNG exporter
  - require endpoint/API confirmation and browser-session auth behavior
  - require preview/review behavior before upload
  - never send or upload PNGs automatically

## Planned: 0.2.2

Theme: reply and composer media tools.

- Miladybooru or Meme Depot reply picker. Labels: `meme-depot`, `miladybooru`, `ux`, `experimental`.
  - investigate a Tenor-like reply picker using an approved Milady image corpus
  - support search, scrollable gallery browsing, and clear user action before inserting media
  - define caching, attribution, and source reliability expectations before shipping
- Meme saver folder. Labels: `media`, `ux`.
  - add a local reaction image/gif collection near reply attachment controls
  - support save-to-collection for uploaded reply images
- Quick composer helpers. Labels: `composer`, `ux`.
  - add a small Milady-head reply action that can send `milady`, `remilio`, or a user-selected phrase
  - consider a Milady Maker composer button that opens Maker and passes draft text where technically possible

## Planned: 0.2.3

Theme: Post-reading companion voice experiments.

- Post-reading TTS side package. Labels: `post-reading`, `integration`, `experimental`.
  - document install instructions for a local TTS companion package
  - link to the external repo when ready
  - keep milXdy functional without the side package
  - decide whether this remains a Post-reading companion or becomes its own package

## Planned: 0.2.4

Theme: optional identity and registry experiments.

- Facelord Fixer classifier. Labels: `maxxer`, `privacy`, `experimental`.
  - detect accounts using a real face and full name
  - offer reversible handling modes such as minimize/erase, Kagamify, or scramble
  - require careful false-positive handling because this can affect real-person identity presentation
- Optional milXdy user registry. Labels: `identity`, `reminet`, `security`, `experimental`.
  - explore opt-in profile badges for users who run milXdy
  - likely requires a lightweight lookup/sync service and profile ownership proof
  - needs clear privacy, opt-in, removal, and abuse-control rules before public release

## Planned: 0.2.5

Theme: daily Milady spin.

- Milady wheel daily spin. Labels: `identity`, `nft`, `ux`, `experimental`.
  - add a slot-machine icon near the Milady/X icon that opens a Milady wheel
  - allow one spin per day
  - award or display a random Milady-style result with a view-on-Blur action
  - let users choose which collection their daily spins use
  - investigate whether this is purely local or requires infrastructure

## Planned: 0.2.6

Theme: lifestyle radio.

- Personal and board-inspired radio stations. Labels: `music`, `miladychan`, `experimental`.
  - move beyond playlist start-time radio toward station, timed block, and album/record concepts
  - support local-first station schedules and QR/import sharing by metadata rather than audio
  - connect future board-inspired stations to Miladychan surfaces if upstream data supports it

## Planned: 0.2.7

Theme: stats, leaderboards, and shareable activity.

- Stats and leaderboards panel. Labels: `stats`, `beetol`, `reminet`, `post-reading`, `experimental`.
  - unify Maxxer XP, pokes, Beetol actions, Post-reading usage, RemiStats, and local diagnostics where useful
  - avoid turning metrics into simple farm loops
- Beetle Hunt share-to-X. Labels: `beetol`, `sharing`, `ux`.
  - add explicit user-initiated sharing for Beetle Hunt results or milestones
- Optional poke feed. Labels: `reminet`, `ux`, `experimental`.
  - investigate a lightweight history/feed for poke activity if RemiNet data supports it

## Backlog Without Version Commitment

- Public screenshots and README visual guide. Labels: `docs`, `ux`.
- Fullscreen onboarding guide and tutorial for fresh installs. Labels: `onboarding`, `ux`, `docs`.
- Chrome Web Store readiness, if distribution goals change. Labels: `distribution`, `blocked-upstream`.
- Mobile extension mode. Labels: `mobile`, `ux`, `experimental`.
- Like button presets. Labels: `ux`, `experimental`.
- Unfollow suggestions using Maxxer signals. Labels: `maxxer`, `ux`, `experimental`.
- RemiCast integration. Labels: `integration`, `experimental`.
- Twitch streaming embeds. Labels: `integration`, `media`, `experimental`.
- `$CULT` token cheer. Labels: `experimental`, `security`.
- On-chain tipping and rotating receiving wallets. Labels: `identity`, `privacy`, `security`, `experimental`.
- Miladychan deck and advanced live-board expansion. Labels: `miladychan`, `architecture`, `experimental`.
- A deeper shared scanner rewrite if performance data shows enabled features still duplicate too much DOM work. Labels: `performance`, `architecture`.

## Planning Labels

Suggested GitHub labels:

- `bug`
- `feature`
- `docs`
- `ux`
- `security`
- `performance`
- `architecture`
- `settings`
- `browser-compat`
- `distribution`
- `integration`
- `identity`
- `privacy`
- `mobile`
- `chat`
- `nft`
- `onboarding`
- `audio`
- `music`
- `media`
- `composer`
- `stats`
- `sharing`
- `remilia-wiki`
- `reminet`
- `post-reading`
- `maxxer`
- `beetol`
- `miladychan`
- `meme-depot`
- `miladybooru`
- `experimental`
- `blocked-upstream`

Suggested GitHub milestones:

- `0.2.0`
- `0.2.1`
- `0.2.2`
- `0.2.3`
- `0.2.4`
- `0.2.5`
- `0.2.6`
- `0.2.7`
