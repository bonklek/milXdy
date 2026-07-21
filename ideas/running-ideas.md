# Running Ideas

Use this file for unscheduled or release-assigned ideas that are not yet implemented. Remove shipped items after confirming against code/docs or a release diff.

## New Entries

Add newly captured unscheduled ideas here before assigning them to a release.

## Assigned Entries

### 0.2.3 - App Runtime And Distribution Prep

- Gate the Poke action on confirmed RemiNet eligibility; issue #88.
- Add a remilia.net Beetle Hunt reduced-motion option; issue #134.

### 0.2.5 - Reader Voice

- Support Read Aloud on X direct-message conversations; issue #135.
- Restore Read Aloud on X native articles; issue #170.
- Expand reviewed Post-reading to Wikipedia and Substack, with editable popout text and documented local/ElevenLabs TTS setup; follow-up scope required.

### 0.2.6 - Social Tuning

- Add an opt-in local usage monitor, gentle nudges, and reversible engagement-reduction presets; issue #87.
- Add Miladychan deck, live-board, watchlist, and board-pulse expansion; issue #38.
- Support derivative Maxxer collections where the local classifier can do so reliably; issue #15 follow-up.

### 0.2.7 - Activity Arcade

- Add optional local relationship activity history for pokes and exact/first-observed follow timing; issue #131.
- Record RemiNet Poke stats in Milady Maxxer; issue #72.
- Add a Banners daily deck tracker to Milady Maxxer; issue #114.
- Add optional animated, audible RemiNet Poke notifications on X; issue #176.

### 0.2.8 - Identifier Media Layer

- Add bookmark-based post tags, local collections, source-pack handoff, and reviewed context export; issue #78.
- Design the identifier-first social layer for stable references, recommendations, collections, and discussion; issue #45.
- Add source archiving, permanent-link collections, and reviewed research-source packs; issue #75.
- Add a reviewed RemiCast open/embed integration; issue #34.
- Start Twitch support with lightweight cards and an explicit `Open on Twitch` handoff; evaluate embedding only under explicit opt-in, privacy, autoplay, and performance gates; issue #35.
- Evaluate whether a Twitch embed is supportable under explicit opt-in, privacy, autoplay, and performance gates; issue #35 follow-up.

### 0.2.9 - Front Door & Platform Reach

- Public screenshots and README visual guide; issue #28.
- Fullscreen onboarding guide and tutorial; issue #29.
- Chrome Web Store readiness research; issue #30.
- Safari desktop WebExtension support; issue #91.
- Firefox Android and iOS/iPadOS Safari mobile feasibility plan; issue #93.
- Small square logo and themed X favicon refresh; issue #104.

### 0.3.x - Onchain Integration

- Public planning and dependency map: `docs/ONCHAIN_ROADMAP.md`.
- `0.3.0`: browser-extension wallet connection, onchain app capabilities, RPC safety, and transaction review/recovery.
- `0.3.1`: Blobcast / read-only Radio Free Ethereum playback and content-addressed sources.
- `0.3.2`: Paraclete compatibility, optional AA gossip, scoped ERC-4337 adapters, registered friend-activity research, and a jointly scoped IP-privacy/optional-features evaluation with Tim Clancy.
- `0.3.3`: `$CULT` cheers, tipping, receiving-address proofs, rotation research, and separately gated private/shielded-transfer research.
- `0.3.4`: BlobMail key transparency, testnet inbox/composer, delivery evidence, and local recovery.
- `0.3.5`: optional Banners/daily-collection NFT context and read-only Bonklet integration.
- `0.3.6`: advanced RFE publishing, portable station apps, rights research, and reviewed IPFS publication.
- `0.3.7`: signed observation records, bounded metadata gossip, passive public-metadata adapters, a shared local index, X `Account based in` region filtering, relationship-status research, and opt-in milXdy registry records.

### Exploratory 0.4.x - Research Directions

- Personal Workspace research: sticky-note canvas, durable local state, recovery, accessibility, reviewed portability, agent-produced bookmark/article podcasts, passive local X-account dossiers, and user-directed desktop-LLM-client/Exocore research; issues #97, #162-#164, and #171, with follow-up scope required.
- Remilia Gotcha research: a local-first collector game where bounded X avatar encounters feed a local ledger, currency/reveal queue, packs, cards, duplicate progression, and collection completion. This is separate from `0.3.5`'s read-only onchain collection context. Begin from the standalone `milady-gacha` prototype; any milXdy integration would reuse existing scanner/classifier/app-runtime pieces only after the core loop is proven fun and appropriately bounded.
- Remilia Gotcha is not an NFT gallery, wallet-ownership feature, marketplace, or real-money gacha. Public leaderboards remain undecided research, not a commitment. Exact collection/token identification, metadata sourcing, licensing, classifier quality, local save/export, and performance remain research gates.
- These are design/prototype containers, not a committed `0.4.0`/`0.4.1` sequence. Any direction may be reduced, deferred, combined, reordered, or replaced.

## Backlog

- Reviewed context and app prompt-pack export; issue #158. Keep this as product research until source-specific entry points, declared export recipes, the review surface, and manual copy/download outcomes are fully specified and tested. The provisional issue notes require field-level inspection/removal and exclude provider launch, direct upload, and automatic return paths.
