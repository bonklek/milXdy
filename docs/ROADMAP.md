# milXdy Roadmap

This roadmap is a public planning guide for beta work. It is intentionally not a promise of exact scope or dates. Items can move between releases as testing, API limits, X/Twitter UI changes, and RemiliaNET constraints become clearer.

## Versioning Rule

- `0.1.x` releases were early integrated-extension beta releases.
- `0.2.x` releases are platform beta releases. They can change architecture, app surfaces, packaging expectations, and public product framing without implying final product stability.

## Most Recent Release

For older shipped details, see the descending [changelog](../CHANGELOG.md).

## Released: 0.2.1 - The Polish Patch

Theme: bug fixes, cooldown correctness, layout polish, and immediate usability repairs.

- Release update flow.
  - uses the latest normal GitHub release for the normal update channel
  - prefers the matching browser archive
  - keeps safe in-place update instructions visible and adds optional update assistant handoff
- App platform polish.
  - preserves app availability across setup choices and build profiles
  - improves Apps Hub enable/disable affordance contrast and expanded-card controls
  - reduces runtime lag with shared scanner and cached RemiStats behavior
  - keeps release smoke checks aligned with active package/manifest versions
- RemiStats, RemiNet, and Beetol cooldown correctness.
  - keeps poke cooldown state synchronized across visible copies of the same user
  - sanitizes RemiStats score/beetle metrics and Remilia profile handles before rendering badge state or links
  - restores cooldown fallback state after refresh
  - preserves Beetol hunt cooldown/exhausted state and restores ready charges when no cooldown remains
- Post-reading polish.
  - keeps feed highlights synced when hyperlinks are skipped
  - ports smoother estimated highlighting to main-feed playback
  - adds compact language/gender voice filters
  - adds a stop control for voice-highlight testing and tightens runtime lag handling around highlight work
  - removes the extra bottom strip under the player/settings surface
- Music and panel polish.
  - remembers player layout state
  - caps compact-mode height and allows narrower width resizing
  - fixes full-player volume control overflow
- RemiNet Chat and visual polish.
  - adds older-message loading from chat history
  - keeps media preview close controls reachable
  - restores notification tinting, orphan-reply connector hints, and faster notification hover cards

## Previous Release

## Released: 0.2.0 - The Platform Update

Theme: app platform refactor, side-rail apps, performance modes, and new first-party app surfaces.

- First-party app platform.
  - moved feature loading onto a shared app registry and lifecycle contract
  - made build entries, copied assets, host permissions, dock metadata, and runtime cost metadata registry-driven
  - documented the local-first app SDK and future GitHub app-package path
  - presented this as the first platform/mod-system pass, not the completed external app layer
  - gave developers enough manifest, lifecycle, surface, and Hub vocabulary to begin designing future milXdy apps
- Shared runtime and performance modes.
  - shrank the root content bootstrap
  - added one shared scanner, route service, lifecycle owner, and idle scheduler
  - separated Appearance intensity from Performance mode: Fast, Balanced, Full, and Developer
  - kept disabled or unopened heavy apps lazy wherever possible
- Shared overlay dock and app panels.
  - gave dockable apps one shared side-rail, frame, drag/resize behavior, theme resolution, and panel persistence model
  - moved RemiNet Chat, Post-reading, Beetol, Miladychan, Music, and Maxxer-style panels toward a consistent app shell
- Background service consolidation.
  - centralized background message routing and strict fetch allowlists
  - kept RemiStats, RemiliaNET, Miladychan, music, image proxy, and upload-style services on typed message paths
- Miladychan Portal.
  - added a docked Miladychan board/thread browser and portal surface
  - kept the native Miladychan site primary and preserved pseudonymous board culture
  - left deeper board/deck/radio expansion as future follow-up
- Music MVP and local radio foundation.
  - added a docked local music app with library/playlists/radio groundwork
  - supported local-first ISRC enrichment with MusicBrainz lookup and manual review
  - kept lifestyle radio/stations as a future expansion rather than a basic player-only vision
- Public docs and onboarding posture.
  - updated public docs around the platform model, app SDK, performance modes, and Firefox/Chromium install paths
  - kept screenshot/readme/onboarding work scoped to what is accurate for the platform release

## Coming Platform Direction: Composable App/Mod System

Theme: turn bundled first-party features into efficient composable apps and open a path for community-built milXdy apps.

The long-term platform goal is a complete mod system where default apps and future community apps can live as packages in an apps folder. Each app should declare its manifest, surfaces, permissions, assets, dock behavior, Performance-mode cost, privacy notes, background services, and lifecycle hooks, then compose with the shared milXdy runtime instead of patching the extension root directly.

This will take more refactoring than a simple folder move. Many apps need the same expensive substrate: X/Twitter timeline scanning, profile/user detection, route handling, media detection, shared visual effects, overlay panels, storage, background fetches, and diagnostics. Those systems need to remain shared so apps can be powerful without multiplying observers, network queues, DOM writes, and visual-effect layers.

Near-term platform work after `0.2.0` should therefore focus on:

- extracting default apps behind cleaner package boundaries while keeping shared scanners and effects centralized
- defining the apps folder layout and package manifest shape
- stabilizing lifecycle hooks for app boot, enable, disable, route changes, surface delivery, overlay open/close, and dispose
- expanding the app runtime beyond X/Twitter so site-aware apps can run on RemiliaNET, Miladychan, Remilia Wiki, and other related hosts with explicit permissions and privacy disclosure
- adding review rules for host permissions, background services, storage keys, privacy labels, and performance cost
- keeping Apps Hub disclosure tied to manifest metadata so users understand what each app loads, stores, and fetches
- deciding how community apps are installed, updated, verified, disabled, and removed

Developers can begin designing against the `0.2.0` concepts now, but external install support and stable third-party compatibility are still future work.

## Shipped: 0.2.2 - Prepared App SDK Update

Theme: make first-party apps easier to understand, configure, package, and maintain by cleaning up Apps and Features IA, settings schema, presets, app metadata, diagnostics, local package groundwork, filesystem layout, and first-party lifecycle compliance.

- Clean up Apps and Features management.
  - move app and feature settings into a clearer left-menu information architecture
  - define settings schema, preset participation, storage compatibility, and reset behavior
  - keep app cards, enablement, privacy notes, costs, and storage disclosures registry-driven
- Make first-party apps comply with the current platform contract.
  - clarify boot, enable, disable, route-change, surface-delivery, overlay open/close, and dispose behavior for bundled apps
  - keep shared scanners, route handling, visual effects, storage, and background fetches centralized instead of duplicated inside each app
- Add SDK-ready diagnostics.
  - compare Max against lighter setup choices with long-task, frame-gap, FPS, and feature timing data
  - make performance reports usable without opening DevTools
  - base any deeper scanner rewrite on measured app/runtime data rather than assumption
- Standardize app presentation controls.
  - define app chrome style presets, per-app overrides, root visual controls, and profile-pack participation
  - document contributor-facing UI style for classic app surfaces
- Prepare reviewed local package and custom-build groundwork.
  - define the local package manifest schema and checked example package shapes
  - add composer, verifier, trust-gate, and custom Chromium build workflows for reviewed local package inputs
  - keep marketplace discovery, package signatures, and polished normal-user package installation out of this release

## Planned: 0.2.3 - App Runtime And Distribution Prep (Target: 2026-07-26)

Theme: continue the app-platform split after Apps and Features cleanup by hardening runtime behavior, local package follow-through, and distribution groundwork.

- Harden app runtime behavior beyond the first Apps and Features pass.
  - expand app runtime expectations across RemiliaNET, Miladychan, Remilia Wiki, and related hosts where permissions and privacy disclosure are explicit
  - keep site-aware app behavior tied to manifest metadata, lifecycle hooks, background services, and shared diagnostics
  - keep RemiNet Chat enablement owned by Apps & Features instead of duplicating app switches in the extension popup
  - stabilize lazy RemiStats poke placement, tweet-header space allocation, and Music embedded-artwork recovery
- Continue local app-package and distribution follow-through.
  - evaluate package signatures, marketplace discovery, normal-user install/update UI, and starter-kit polish after the 0.2.2 reviewed custom-build groundwork
  - keep marketplace, submission, and browser-distribution prep separate from the shipped 0.2.2 scope
- RemiNet and remilia.net correctness/accessibility follow-through.
  - show Poke actions only for profiles confirmed to have a usable RemiNet identity, with bounded lookup and clear pending/failure behavior
  - add a dedicated reduced-motion option for remilia.net Beetle Hunt without changing the separate X/Twitter Beetol Hunt feature
- Keep the former RemiNet Sharing work in Composer Kit.
  - the X Messages RemiNet pseudo chat entry shipped in 0.2.0
  - direct Tweet PNG upload to RemiNet and granular Tweet PNG metadata controls now belong with 0.2.4 reviewed sharing/composer media work

## Planned: 0.2.4 - Composer Kit (Target: 2026-08-02)

Theme: reviewed sharing, Milady posting, reply media, phrase helpers, maker/meme-designer integrations, and AI-assisted metadata normalization.

- Tweet PNG and RemiNet sharing.
  - add granular Tweet PNG metadata and styling settings so users can choose which identity, date, source, RemiStats, and border details appear before copy, download, browser share, or upload
  - support direct Tweet PNG upload to RemiNet only after endpoint/API and browser-session auth behavior are confirmed
  - require preview/review behavior before upload and never send or upload PNGs automatically
- Miladychan posting from the portal.
  - let users create posts on Miladychan from inside milXdy instead of only browsing and opening the native site
  - preserve pseudonymous board expectations and make posting destination/board/thread state explicit
  - handle auth/session, validation, upload/media, captcha/upstream constraints, drafts, and failure states clearly
- Miladybooru or Meme Depot reply picker.
  - investigate a Tenor-like reply picker using an approved Milady image corpus
  - include CHEESEWORLD booru/gallery feasibility in the same reply-media picker research
  - support search, scrollable gallery browsing, and clear user action before inserting media
  - define caching, attribution, and source reliability expectations before shipping
- Composer meme designer and maker integrations.
  - integrate CULT, INC. #CHEESEWORLD generator/meme maker as a composer-adjacent reaction-media path
  - define how Milady Maker, Remilia/Remilio maker surfaces, Bonkler Maker, and related generators open, embed, or receive composer context
  - keep generated/selected media user-reviewed before inserting, saving, or posting
- Meme saver folder.
  - add a local reaction image/gif collection near reply attachment controls
  - support save-to-collection for uploaded reply images
- Quick composer helpers.
  - add a small Milady-head reply action that can send `milady`, `remilio`, or a user-selected phrase
  - route Maker-style buttons through the broader composer meme designer where technically possible
- Grok-assisted posting and metadata normalization.
  - design an optional editing flow that standardizes formatting, metadata, identifiers, links, and readability
  - preserve the user's voice and require final review before publishing
  - avoid automatic posting or invisible metadata changes
- Reviewed context and prompt-pack export.
  - let users inspect and export versioned post/thread, Tweet PNG, reply-composer, and source-pack context
  - let reviewed app packages declare bounded prompt templates or skills for manual use in the user's chosen assistant
  - exclude private/session data and never send, insert, upload, save, or post returned content automatically

## Planned: 0.2.5 - Reader Voice (Target: 2026-08-09)

Theme: Post-reading companion voice experiments and long-form audio export.

- Post-reading TTS side package.
  - document install instructions for a local TTS companion package
  - link to the external repo when ready
  - keep milXdy functional without the side package
  - decide whether this remains a Post-reading companion or becomes its own package
- Long-form Post-reading audio export.
  - let users invoke Post-reading on wiki articles, X articles/long posts, Substack, Medium, blogs, RSS item pages, and other long-form pages
  - use hard-coded extractors for known sources first, with a generic readable-text fallback for unrecognized pages
  - open extracted text in a review editor before generation
  - export through the selected TTS path, preferring MP3 or M4A when the backend can return those formats
  - keep source metadata with the generated audio result
- X direct-message Read Aloud.
  - read an explicitly opened conversation in chronological order while distinguishing incoming and outgoing messages
  - exclude conversation-list previews, composer text, controls, timestamps, and unrelated page chrome
  - keep private DM text within the user-selected TTS path and reset safely when conversations change

## Planned: 0.2.6 - Social Tuning (Target: 2026-08-16)

Theme: Maxxer collection behavior, classifier research, like-button presets, follow suggestions, and X graph discovery.

- Expanded Maxxer collection behavior.
  - include recognized collections that the local classifier/model pipeline can support reliably
  - add an advanced behavior menu for maxxed, lower-tier, neutral, or minimized treatment
  - complete reversible non-Milady minimization without minimizing RemiStats beetle users
- Facelord Fixer classifier.
  - add an opt-in setting for accounts that appear to use a real face and full name
  - offer reversible handling modes such as minimize/erase, Kagamify, or scramble
  - provide manual recovery for false positives because this can affect real-person identity presentation
- Like and follow-signal controls.
  - customize the like button with emoji-style presets such as joycat, thumbs up, heart eyes, star eyes, hamburger, tearing-up smile, or salute
  - preserve the normal faded-to-colorful like-button click transition
  - investigate unfollow suggestions using Maxxer signals
- X follow graph discovery.
  - use X/Twitter's existing follow graph to bootstrap friend discovery and recommendations
  - keep graph-derived behavior opt-in, explainable, and privacy-conscious
  - distinguish local-only possibilities from anything requiring an external service
- RemiNet friend affordances on X profiles.
  - show whether the viewed profile is already a RemiNet friend when the identity can be resolved
  - offer an explicit add-friend action only after RemiNet endpoint and browser-session behavior are confirmed
  - keep RemiNet friendship visually distinct from native X following and avoid automatic relationship changes
- Local usage awareness and engagement-reduction presets.
  - add opt-in local session/activity statistics and configurable gentle nudges
  - support reversible grayscale, media-reduction, and lower-intensity presentation choices without collecting private content
  - respect reduced-motion, Performance mode, dismissal, snooze, reset, and disable behavior

## Planned: 0.2.7 - Activity Arcade (Target: 2026-08-23)

Theme: daily rituals, poke feed, stats, leaderboards, and Beetle sharing.

- Milady wheel daily spin.
  - add a slot-machine icon near the Milady/X icon that opens a Milady wheel
  - allow one spin per day
  - award or display a random Milady-style result with a view-on-Blur action
  - let users choose which collection their daily spins use
- Stats and leaderboards panel.
  - unify Maxxer XP, pokes, Beetol actions, Post-reading usage, RemiStats, and local diagnostics where useful
  - avoid turning metrics into simple farm loops
- Beetle Hunt share-to-X.
  - add explicit user-initiated sharing for Beetle Hunt results or milestones
- Optional poke feed.
  - implement a lightweight history/feed for poke activity using available RemiNet data
- Optional relationship activity history.
  - show outgoing/incoming poke timing and exact or first-observed follow timing only where evidence exists
  - keep stable-account records local, bounded, resettable, and clearly labeled when a date is first observed rather than historically exact

## Planned: 0.2.8 - Identifier Media Layer (Target: 2026-08-30)

Theme: local-first radio plus books, podcasts, movies, TV, recipes, and identifier-first sharing research.

- Identifier-first social layer design.
  - define milXdy as a social layer for references, recommendations, collections, and discussion around works that already exist elsewhere
  - prioritize public identifiers, external links, and metadata instead of hosted copyrighted media
  - use Music/ISRC behavior as the first implemented example and generalize the model carefully
  - evaluate Miladychan domain boards as the shared posting/discovery substrate for media apps, so Music, Books, Movies/TV, Podcasts, and Recipes can fetch and cache relevant public board posts instead of each app requiring a separate social backend
  - add source archive and permanent-link research collections so users can preserve links through archive services or IPFS-style paths and turn source packs into zettelkasten, knowledge-book, or Remilia Wiki drafting inputs
- Bookmark tags and reusable collections.
  - supplement the native X bookmark action with local post tags, a tag manager, and stable storage/migration behavior
  - make selected tagged collections available to source packs and reviewed context export without hidden assistant calls
- Music and board-inspired radio stations.
  - move beyond playlist start-time radio toward station, timed block, and album/record concepts
  - support local-first station schedules and QR/import sharing by metadata, ISRCs, and local matching hints rather than audio
  - connect board-inspired stations to a music-oriented Miladychan board if upstream data supports it, including followed/selected-user filtering where privacy and identity boundaries are clear
- Music discovery and fallback research.
  - add legitimate, user-authorized discovery and fallback paths for missing local music
  - provide a lightweight public-domain/ad-free source path with preselected links or collections users can review before importing locally
  - keep local library playback as the baseline
  - avoid automatic file sharing, scraping, downloading, or transmitting audio files
- Books and reading.
  - add an EPUB reader as a future app surface
  - use Gutenberg.org as an initial public-domain source
  - support book discussions around ISBNs and external source links, including future books-board posts that can appear inside the Books app
- Podcasts.
  - add show and episode sharing with stable podcast identifiers, feed references, and external playback links
  - avoid hosting podcast audio by default
- Movies and TV.
  - add film, series, season, and episode sharing through identifiers such as IMDb or TMDb IDs
  - keep discussion centered on referenced works rather than hosted video, including future movie/TV-board posts that can appear inside the Movies/TV surface
- Recipes.
  - add recipe sharing with source attribution, external links, structured references, and user commentary
  - distinguish original user recipes from externally sourced recipes

## Planned: 0.2.9 - Live Media Integrations (Target: 2026-09-06)

Theme: explicit, privacy-preserving entry points for RemiCast and Twitch, with stable fallback handling and no implicit external media loading.

- RemiCast integration.
  - add a RemiCast entry point in an appropriate milXdy surface
  - support opening or embedding RemiCast content where browser-extension constraints allow it
  - require explicit user action before loading external media or external service content
  - document any required permissions, remote-service behavior, and fallback handling
- Twitch live-media cards.
  - recognize explicit Twitch channel, stream, video, and clip links where milXdy already presents supported media
  - show a compact card using information already present on the page or safely derivable from the URL
  - provide an explicit `Open on Twitch` handoff without prefetching, autoplay, embeds, authentication, or API credentials
  - preserve the original link as the fallback for unsupported or malformed URLs

## Planned: 0.2.10 - Miladychan Live (Target: 2026-09-13)

Theme: deck, live-board, and board pulse expansion.

- Miladychan deck and advanced live-board expansion.
  - explore live board pulse, deck view, watchlists, multitrack navigation, and board/thread activity surfaces
  - preserve pseudonymous board expectations and avoid merging Miladychan identity with X/Twitter identity by default
  - define polling, caching, rate-limit, moderation/safety, and performance constraints before shipping live behavior

## Planned: 0.2.11 - User Registry (Target: 2026-09-20)

Theme: opt-in milXdy user badges, profile ownership proof, removal, privacy, and abuse controls.

- Optional milXdy user registry.
  - add opt-in profile badges for users who run milXdy
  - implement profile ownership proof before a profile can be listed
  - keep wallet identity out of the registry baseline; optional wallet, ENS, and Gwei linking begins in the 0.3.x onchain foundation
  - support removal/unpublish behavior, privacy disclosure, and abuse controls

## Planned: 0.2.12 - Front Door & Platform Reach (Target: 2026-09-27)

Theme: redesigned onboarding, visual guides, Safari desktop support, distribution research, mobile feasibility, and non-technical user setup.

- Public screenshots and README visual guide.
  - add public-safe screenshots for the major user-facing surfaces
  - explain the extension visually before a user installs it
  - keep screenshots free of private handles, notifications, local paths, DMs, auth state, wallet/account identifiers, and personal media
- Fullscreen onboarding and user walkthroughs.
  - redesign first-run onboarding for non-technical users
  - let users skip onboarding and reopen it later
  - cover install, update, first-run setup, Apps Hub, side rail, Performance modes, enabling apps, bug reports, and common troubleshooting
  - include pictures/screenshots throughout the guide flow
  - include video walkthroughs or video-ready scripts/checklists
  - clearly separate required setup steps from optional advanced features
- Safari desktop support.
  - add a Safari Web Extension build, packaging path, compatibility layer, and desktop QA target
  - preserve the Chromium and Firefox variants while documenting Safari-specific limitations
- Chrome Web Store readiness, if distribution goals change.
  - document store policy blockers and package requirements before committing to store distribution
- Mobile extension mode research.
  - use #93 as the staged planning epic, with Firefox Android first and iOS/iPadOS Safari second
  - define a reduced mobile-safe profile, mobile UI primitives, platform evidence, follow-up implementation issues, docs, and QA gates before advertising support
- Small-format brand assets.
  - refresh the square milXdy mark and themed X favicon variants for 16px, 32px, 48px, extension, tab, README, and documentation surfaces

## Planned: 0.3.x - Onchain Integration

Theme: progress from shared wallet and chain safety into read-only Ethereum media, account-abstraction networking, reviewed social value, private blob mail, collection context, advanced publishing, and collective metadata.

- `0.3.0 - The Onchain Foundation` (target 2026-10-04): wallet identity, app capabilities, bounded RPC, transaction review, receipts, and recovery.
- `0.3.1 - Ethereum Media` (target 2026-10-11): verified read-only RFE playback, content-addressed sources, and optional NFT collection context.
- `0.3.2 - The Paraclete Network` (target 2026-10-18): optional browser AA gossip and scoped ERC-4337 adapters.
- `0.3.3 - Social Value` (target 2026-10-25): receiving-address proofs, reviewed `$CULT` cheers and tips, and address lifecycle research.
- `0.3.4 - BlobMail` (target 2026-11-01): testnet encrypted mail, key transparency, reviewed composition, delivery evidence, and bounded local storage.
- `0.3.5 - Onchain Collections` (target 2026-11-08): optional ownership context for Remilia Gotcha and Banners plus read-only Bonklet integration.
- `0.3.6 - Onchain Publishing` (target 2026-11-15): advanced RFE publishing, portable station apps, program-rights research, and reviewed IPFS publication.
- `0.3.7 - Collective Metadata` (target 2026-11-22): signed public observations, bounded post-Paraclete propagation, passive metadata adapters, and X `Account based in` region filtering.

See the [0.3.x onchain roadmap](ONCHAIN_ROADMAP.md) for the dependency map, release gates, project boundaries, and issue index.

## Exploratory: 0.4.x - Personal Computing Directions

`0.4.x` is conjectural and does not yet represent a committed release order, version split, or final architecture. Current research directions are:

- Personal Workspace concept; issues #97 and #162-#164.
  - explore a private sticky-note canvas, durable local state, accessible navigation, recovery, and reviewed portability
  - use the concept to test whether milXdy should host substantial personal state, not to promise a complete productivity suite
- Companion Bridge concept; issues #77 and #165-#168.
  - explore a separately installed local bridge for explicitly selected context and bounded returned artifacts
  - treat native messaging, MCP ownership, capability pairing, and browser coverage as current design hypotheses requiring prototypes and threat-model review
- Open sequencing questions.
  - either concept may be reduced, deferred, combined, reordered, or replaced after the `0.3.x` integration work and app-platform evidence
  - public/shared workspaces, autonomous assistants, ambient context access, and broad browser/filesystem/wallet authority are not implied

## Backlog Requiring Product Research

- Post-reading audio library, RSS queues, and shareable verbal-media exports.
  - save reviewed long-form conversions into a local audio library with draft and completed states
  - ingest RSS feeds so long-form items can be queued, reviewed, and converted later
  - add Miladychan file-posting for generated audio/video with source title, context, and subtitles
  - convert readings into MP4 posts with a default contextual image, audio track, and matched subtitles
  - explore feed/podcast-like export and source-extractor plugins for additional long-form sites
