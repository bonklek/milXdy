# milXdy Roadmap

This roadmap is a public planning guide for beta work. It is intentionally not a promise of exact scope or dates. Items can move between releases as testing, API limits, X/Twitter UI changes, and RemiliaNET constraints become clearer.

## Versioning Rule

- `0.1.x` releases are incremental beta improvements inside the current unpacked-extension architecture.
- `0.2.x` releases are larger beta feature lanes. They can add new surfaces, integrations, or compatibility expectations without implying final product stability.

## Already Shipped Or Mostly Shipped

These ideas have already landed in the `0.1.x` beta line and should be maintained rather than planned as new roadmap items:

- Bug reporting from inside the extension through GitHub/X, with optional LLM-assisted report drafting. Labels: `ux`, `docs`.
- Link Later support for saved Remilia Wiki phrases, templated new pages, and existing-page section editing. Labels: `remilia-wiki`, `ux`.
- Remilia Wiki Grok prompts for post-seeded, generic, and profile article workflows. Labels: `remilia-wiki`.
- RemiNet connector login persistence and RemiliaNET SSO retry. Labels: `reminet`, `security`.
- RemiStats poke cooldown display and local poke diagnostics. Labels: `reminet`, `ux`.
- Guided in-place beta updater. Labels: `ux`, `docs`.
- Incoming RemiNet poke indicators. Labels: `reminet`.
- Optional RemiNet Chat sidebar on supported X/Twitter routes. Labels: `reminet`, `experimental`.

## Released: 0.1.3

Theme: update UX, beta polish, RemiNet activity surfaces, and public planning.

Shipped in this release:

- Guided updater in the Suite tab. Labels: `ux`, `docs`.
- Incoming RemiNet poke indicators. Labels: `reminet`.
- Optional RemiNet Chat sidebar. Labels: `reminet`, `experimental`.
- Public docs refactor and root changelog. Labels: `docs`.
- GitHub Discussions launch for feedback, support, and release planning. Labels: `docs`, `ux`.

## Planned: 0.1.4

Name: The Aesthetic Update.

Theme: settings ergonomics, visual polish, and Remilia/Milady reskin controls.

- Profile/default settings presets. Labels: `settings`, `ux`.
  - Max: visually invasive Remilia/Milady reskin where X becomes mostly unrecognizable, with the highest Maxxer treatment intensity
  - Moderate: recognizable X layout with visible Remilia/Milady chrome, marked-surface styling, and balanced Maxxer treatments
  - Min: mostly original X appearance with restrained milXdy controls and lightweight Maxxer markers
  - clearly describe which features each preset enables
- RemiNet-style visual polish. Labels: `reminet`, `maxxer`, `ux`.
  - CSS pass for max settings, including broad X chrome reskin only in Max
  - refactor Miladymaxxer visual treatments around the Max/Moderate/Min preset model
  - more consistent RemiNet/Beetol/Maxxer styling
  - preserve readable, stable controls in the popup
- X chrome reskin surfaces. Labels: `ux`, `maxxer`, `reminet`.
  - apply Remilia/Milady styling to high-visibility X surfaces when Max or Moderate presets are active
  - keep route changes and right-column layout stable
  - avoid reskinning sensitive or confusing surfaces in Min mode
- Remilia font and visual asset pass. Labels: `ux`, `docs`.
  - bundle and apply approved Remilia-style fonts/assets where appropriate
  - keep bundled assets documented and license-compatible
  - preserve readable fallbacks if custom fonts fail to load
- RemiNet Chat visual integration. Labels: `reminet`, `chat`, `ux`.
  - make the chat sidebar feel visually consistent with the new aesthetic presets
  - keep controls legible in light/dark mode
  - avoid covering X controls or crowding the right rail
- Beetol and RemiStats polish. Labels: `beetol`, `reminet`, `ux`.
  - align Beetol panel, RemiStats badges, sounds, poke indicators, and cooldown states with the new aesthetic system
  - keep status/cooldown text clear at small sizes
- Remilia Wiki flow follow-up. Labels: `remilia-wiki`, `ux`.
  - clarify the Link Later decision tree between new page and existing page
  - keep current new-page and existing-page search flows as the fallback

## Planned: 0.1.5

Theme: Firefox compatibility, Maxxer recognition, screenshot sharing, and RemiNet/Beetle profile identity.

- Firefox support integration. Labels: `browser-compat`, `experimental`.
  - integrate the contributor Firefox compatibility branch
  - verify MV3 background behavior, host permissions, cookies, notifications, `chrome.*`/`browser.*` compatibility, web accessible resources, OCR/WASM, ONNX/model assets, and X/Twitter content scripts
  - document exact Firefox load instructions and known limitations
  - preserve Chromium behavior while adding Firefox compatibility
- Complete minimization of non-Milady profile pictures. Labels: `maxxer`, `performance`.
  - preserve users with RemiStats beetle stats
  - keep whitelist/manual-list overrides
  - make the effect reversible from settings
- Expand Miladymaxxer image detection. Labels: `maxxer`, `performance`.
  - include all recognized collections available to the local classifier/model pipeline
  - avoid expensive inference unless Maxxer is enabled
  - preserve bounded detection concurrency
- Advanced collection behavior menu. Labels: `maxxer`, `settings`, `ux`.
  - choose which recognized collections are maxxed, minimized, or neutral
  - support tiered visual treatments such as gold, silver, or neutral
  - default profile: full Milady maxxing, lower tier or neutral treatment for other recognized collections
- Beetle Game trophy shelf on X profiles. Labels: `beetol`, `reminet`, `ux`.
  - explore replacing or augmenting profile header areas with trophy shelf data
  - keep the feature optional and scoped
  - avoid layout shifts on X profile pages
- Optional banner randomizer. Labels: `identity`, `nft`, `ux`, `experimental`.
  - pair with the trophy shelf/profile identity work
  - use owned or selected banner NFT items as profile/banner visual variants
  - keep it off by default
  - on click, open the corresponding Blur listing when available
- Screenshot to RemiNet from X share actions. Labels: `reminet`, `security`, `experimental`.
  - investigate whether RemiNet has a suitable upload/share endpoint
  - define privacy boundaries before shipping
  - require explicit user action and a review step before sending
  - avoid sending screenshots automatically
## Planned: 0.1.6

Theme: RemiNet chat placement.

- Chats-tab RemiNet pseudo chat. Labels: `reminet`, `chat`, `ux`.
  - add a pseudo chat entry to the Chats tab with RemiNet chat pinned at the top
  - keep it visually distinct from native X DMs so users understand what surface they are using
  - reuse existing RemiNet Chat auth and connection handling where possible

## Planned: 0.1.7

Theme: Meme Depot reply picker.

- Meme Depot reply picker. Labels: `meme-depot`, `ux`, `experimental`.
  - investigate a Tenor-like reply picker using `https://memedepot.com/d/milady` as a source
  - require clear user action before inserting media into an X reply
  - define caching, attribution, and source reliability expectations before shipping

## Target: 0.2.0

Name: The User Update.

Theme: public presentation and repo onboarding.

- Public screenshots and README visual guide. Labels: `docs`, `ux`.
  - add safe, non-personal screenshots for the popup, RemiNet surfaces, Wiki/Grok flow, Postreader, Maxxer, or Health reporting
  - keep screenshots free of private handles, notifications, local paths, bookmarks, DMs, and auth state
  - use stable filenames and alt text so GitHub readers can understand the extension at a glance
- Fullscreen onboarding guide and tutorial for fresh installs. Labels: `onboarding`, `ux`, `docs`.
  - show first-run users a guided introduction to major feature areas
  - explain safe update behavior, settings presets, privacy-sensitive integrations, and where to report bugs
  - keep the guide skippable and available later from the popup

## Target: 0.2.1

Theme: Miladychan discovery.

- Miladychan discovery. Labels: `miladychan`, `reminet`, `experimental`.
  - "trending on Miladychan" or similar community-signal surface
  - possible right-sidebar module for trending Miladychan posts
  - define data source, cache policy, and moderation/safety behavior

## Target: 0.2.3

Theme: Postreader TTS companion.

- Postreader TTS side package. Labels: `postreader`, `integration`, `experimental`.
  - document install instructions for a local TTS companion package
  - link to the external repo when ready
  - keep milXdy functional without the side package
  - decide whether this remains a Postreader companion or becomes its own package

## Target: 0.2.4

Theme: optional milXdy user registry.

- Facelord Fixer classifier. Labels: `maxxer`, `privacy`, `experimental`.
  - detect accounts using a real face and full name
  - offer reversible handling modes such as minimize/erase, Kagamify, or scramble
  - Kagamify would replace the profile picture/name presentation with Milady-flavored placeholders
  - require careful false-positive handling because this can affect real-person identity presentation
- Optional milXdy user registry. Labels: `identity`, `reminet`, `security`, `experimental`.
  - explore opt-in profile badges for users who run milXdy
  - likely requires a lightweight lookup/sync service and profile ownership proof
  - needs clear privacy, opt-in, removal, and abuse-control rules before public release
  - dependency: an API or static registry service for lookup/sync
  - dependency: profile ownership verification, likely through X account proof or RemiNet-linked identity
  - dependency: published privacy terms for opt-in data, retention, removal, and abuse handling

## Target: 0.2.5

Theme: daily Milady spin.

- Milady wheel daily spin. Labels: `identity`, `nft`, `ux`, `experimental`.
  - add a slot-machine icon near the Milady/X icon that opens a Milady wheel
  - allow one spin per day
  - award or display a random Milady-style result with a view-on-Blur action
  - let users choose which collection their daily spins use
  - investigate whether this is purely local or requires infrastructure

## Backlog Without Version Commitment

- Chrome Web Store readiness, if distribution goals change. Labels: `distribution`, `blocked-upstream`.
- Mobile extension mode. Labels: `mobile`, `ux`, `experimental`.
  - investigate a mode that can be saved to the home screen
  - mimic the desktop browsing experience where possible
  - identify which extension features can realistically work in a mobile browser/app-like surface
  - document limits before advertising this as mobile support
- `$CULT` token cheer. Labels: `experimental`, `security`.
  - investigate public ENS/ETH discovery only if there is a clear privacy-safe user value
  - require explicit opt-in before any wallet/address-linked behavior
  - do not expose or infer wallet identity in UI without user intent
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
- `remilia-wiki`
- `reminet`
- `postreader`
- `maxxer`
- `beetol`
- `miladychan`
- `meme-depot`
- `experimental`
- `blocked-upstream`

Suggested GitHub milestones:

- `0.1.3`
- `0.1.4`
- `0.1.5`
- `0.1.6`
- `0.1.7`
- `0.2.0`
- `0.2.1`
- `0.2.3`
- `0.2.4`
- `0.2.5`

