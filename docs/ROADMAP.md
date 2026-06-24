# milXdy Roadmap

This roadmap is a public planning guide for beta work. It is intentionally not a promise of exact scope or dates. Items can move between releases as testing, API limits, X/Twitter UI changes, and RemiliaNET constraints become clearer.

## Versioning Rule

- `0.1.x` releases are incremental beta improvements inside the current unpacked-extension architecture.
- `0.2.0` is reserved for a larger product boundary: a major new surface, install/update model, auth model, storage migration, or compatibility expectation.

## Already Shipped Or Mostly Shipped

These ideas have already landed in the `0.1.x` beta line and should be maintained rather than planned as new roadmap items:

- Bug reporting from inside the extension through GitHub/X, with optional LLM-assisted report drafting.
- Link Later support for saved Remilia Wiki phrases, templated new pages, and existing-page section editing.
- Remilia Wiki Grok prompts for post-seeded, generic, and profile article workflows.
- RemiNet connector login persistence and RemiliaNET SSO retry.
- RemiStats poke cooldown display and local poke diagnostics.
- Guided in-place beta updater.
- Incoming RemiNet poke indicators.
- Optional RemiNet Chat sidebar on supported X/Twitter routes.

## Released: 0.1.3

Theme: update UX, beta polish, RemiNet activity surfaces, and public planning.

Shipped in this release:

- Guided updater in the Suite tab.
- Incoming RemiNet poke indicators.
- Optional RemiNet Chat sidebar.
- Public docs refactor and root changelog.
- GitHub Discussions launch for feedback, support, and release planning.

## Planned: 0.1.4

Theme: browser compatibility, RemiNet identity surfaces, and settings ergonomics.

- Firefox support investigation and beta compatibility:
  - audit MV3 API differences, including background service worker behavior, host permissions, downloads, notifications, cookies, and `chrome.*` compatibility
  - add a Firefox build/load checklist
  - document any Firefox-only limitations before advertising support
  - keep Chromium as the primary beta target until Firefox smoke tests pass
- Profile/default settings presets:
  - Max
  - Moderate
  - Min
  - clearly describe which features each preset enables
- Beetle Game trophy shelf on X profiles:
  - explore replacing or augmenting profile header areas with trophy shelf data
  - keep the feature optional and scoped
  - avoid layout shifts on X profile pages
- RemiNet-style visual polish:
  - CSS pass for max settings
  - more consistent RemiNet/Beetol/Maxxer styling
  - preserve readable, stable controls in the popup
- Remilia Wiki flow follow-up:
  - clarify the Link Later decision tree between new page and existing page
  - investigate whether wiki sign-in state can be detected or usefully surfaced without taking ownership of wiki auth

## Planned: 0.1.5

Theme: Maxxer recognition, minimization, and collection controls.

- Complete minimization of non-Milady profile pictures:
  - preserve users with RemiStats beetle stats
  - keep whitelist/manual-list overrides
  - make the effect reversible from settings
- Expand Miladymaxxer image detection:
  - include all recognized collections available to the local classifier/model pipeline
  - avoid expensive inference unless Maxxer is enabled
  - preserve bounded detection concurrency
- Advanced collection behavior menu:
  - choose which recognized collections are maxxed, minimized, or neutral
  - support tiered visual treatments such as gold, silver, or neutral
  - default profile: full Milady maxxing, lower tier or neutral treatment for other recognized collections

## Candidate: 0.1.6

Theme: external integrations and experiments that need validation before commitment.

- Postreader TTS side package:
  - document install instructions for a local TTS companion package
  - link to the external repo when ready
  - keep milXdy functional without the side package
  - decide whether this remains a Postreader companion or becomes its own package
- Screenshot to RemiNet from X share actions:
  - investigate whether RemiNet has a suitable upload/share endpoint
  - define privacy boundaries before shipping
  - avoid sending screenshots without explicit user action
- `$CULT` token cheer:
  - investigate public ENS/ETH address discovery from RemiliaNET/NFT ownership data
  - require explicit user action before any on-chain or address-linked behavior
  - treat as experimental until privacy and accuracy risks are clear

## Target: 0.2.0

Theme: a larger RemiNet social layer and more mature beta contract.

Candidate scope:

- Expanded RemiNet social layer:
  - build on the beta RemiNet Chat sidebar
  - improve route coverage, layout resilience, and performance budgets
  - define which RemiliaNET social actions belong in the sidebar versus account cards
- Miladychan discovery:
  - "trending on Miladychan" or similar community-signal surface
  - possible right-sidebar module for trending Miladychan posts
  - define data source, cache policy, and moderation/safety behavior
- Stronger update/storage model:
  - decide whether to stay with guided unpacked updates or move toward signed/self-hosted CRX updates
  - add backup/export/import for settings and stats if the install path changes
- Public beta stability line:
  - known-limits page
  - permission explainer
  - release-note template
  - clearer migration guidance between beta versions

## Backlog Without Version Commitment

- Chrome Web Store readiness, if distribution goals change.
- Optional registry of milXdy users, if a public lookup/sync service becomes worth the added infrastructure.
- Full MediaWiki auth integration, if Remilia Wiki supports a browser-extension-friendly flow.
- A separate companion updater app, if guided unpacked updates prove too confusing.
- A deeper shared scanner rewrite if performance data shows enabled features still duplicate too much DOM work.

## Planning Labels

Suggested GitHub labels:

- `bug`
- `feature`
- `docs`
- `ux`
- `security`
- `performance`
- `remilia-wiki`
- `reminet`
- `postreader`
- `maxxer`
- `beetol`
- `experimental`
- `blocked-upstream`

Suggested GitHub milestones:

- `0.1.3`
- `0.1.4`
- `0.1.5`
- `0.1.6`
- `0.2.0`
