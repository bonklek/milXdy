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
  - prefers the matching browser/profile archive
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
  - supported local-first ISRC enrichment with optional user-provided AcoustID key and MusicBrainz lookup
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

## Planned: 0.2.2 - Diagnostics And Windowing

Theme: performance measurement, scanner decisions, overlay positioning, and contributor UI guidance.

- Add repeatable Max visual profile diagnostics.
  - compare Max against lighter visual profiles with long-task, frame-gap, FPS, and feature timing data
  - make performance reports usable without opening DevTools
- Decide whether deeper scanner work is needed.
  - base shared scanner rewrite scope on diagnostics rather than assumption
  - identify affected app surfaces and measurable targets before committing to a rewrite
- Harden docked app window behavior.
  - audit snap guides, protected zones, restore behavior, and narrow-viewport recovery
  - keep controls inside app headers clickable and avoid accidental drags
- Document contributor-facing app UI style.
  - turn the classic utility-window direction into public guidance for future app surfaces

## Planned: 0.2.3 - RemiNet Sharing

Theme: make RemiNet feel more native inside X while keeping sharing explicit and reviewed.

- Chats-tab RemiNet pseudo chat.
  - add a pseudo chat entry to the X Chats tab with RemiNet chat pinned at the top
  - keep it visually distinct from native X DMs so users understand what surface they are using
  - reuse existing RemiNet Chat auth, background service, and docked chat handling where possible
- Direct Tweet PNG upload to RemiNet.
  - build on the local Tweet PNG exporter
  - require endpoint/API confirmation and browser-session auth behavior
  - require preview/review behavior before upload
  - never send or upload PNGs automatically

## Planned: 0.2.4 - Composer Kit

Theme: Milady posting, reply media, phrase helpers, and AI-assisted metadata normalization.

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

## Planned: 0.2.5 - Reader Voice

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

## Planned: 0.2.6 - Social Tuning

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

## Planned: 0.2.7 - Activity Arcade

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

## Planned: 0.2.8 - Identifier Media Layer

Theme: local-first radio plus books, podcasts, movies, TV, recipes, and identifier-first sharing research.

- Identifier-first social layer design.
  - define milXdy as a social layer for references, recommendations, collections, and discussion around works that already exist elsewhere
  - prioritize public identifiers, external links, and metadata instead of hosted copyrighted media
  - use Music/ISRC behavior as the first implemented example and generalize the model carefully
  - evaluate Miladychan domain boards as the shared posting/discovery substrate for media apps, so Music, Books, Movies/TV, Podcasts, and Recipes can fetch and cache relevant public board posts instead of each app requiring a separate social backend
  - add source archive and permanent-link research collections so users can preserve links through archive services or IPFS-style paths and turn source packs into zettelkasten, knowledge-book, or Remilia Wiki drafting inputs
- Music and board-inspired radio stations.
  - move beyond playlist start-time radio toward station, timed block, and album/record concepts
  - support local-first station schedules and QR/import sharing by metadata, ISRCs, and local matching hints rather than audio
  - connect board-inspired stations to a music-oriented Miladychan board if upstream data supports it, including followed/selected-user filtering where privacy and identity boundaries are clear
- Music discovery and fallback research.
  - add legitimate, user-authorized discovery and fallback paths for missing local music
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

## Planned: 0.2.9 - RemiCast Integration

Theme: concrete RemiCast entry point, embed/open behavior, privacy, and fallback handling.

- RemiCast integration.
  - add a RemiCast entry point in an appropriate milXdy surface
  - support opening or embedding RemiCast content where browser-extension constraints allow it
  - require explicit user action before loading external media or external service content
  - document any required permissions, remote-service behavior, and fallback handling

## Planned: 0.2.10 - Miladychan Live

Theme: deck, live-board, and board pulse expansion.

- Miladychan deck and advanced live-board expansion.
  - explore live board pulse, deck view, watchlists, multitrack navigation, and board/thread activity surfaces
  - preserve pseudonymous board expectations and avoid merging Miladychan identity with X/Twitter identity by default
  - define polling, caching, rate-limit, moderation/safety, and performance constraints before shipping live behavior

## Planned: 0.2.11 - User Registry

Theme: opt-in milXdy user badges, profile ownership proof, removal, privacy, and abuse controls.

- Optional milXdy user registry.
  - add opt-in profile badges for users who run milXdy
  - implement profile ownership proof before a profile can be listed
  - evaluate optional wallet identity linking with ENS and Gwei resolution as a separate opt-in layer, not a default registry requirement
  - support removal/unpublish behavior, privacy disclosure, and abuse controls

## Planned: 0.3.0 - The Front Door Update

Theme: redesigned onboarding, visual guides, videos, pictures, walkthroughs, and non-technical user setup.

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
- Chrome Web Store readiness, if distribution goals change.
  - document store policy blockers and package requirements before committing to store distribution
- Mobile extension mode research.
  - document what can realistically work in a mobile browser or app-like surface before advertising support

## Backlog Requiring Product Research

- Bookmark-based post tagging and collections.
  - build on X/Twitter's native bookmarks with a milXdy tag action near or around the bookmark button
  - let users create tags, apply existing tags, inspect saved labels, and browse tagged post collections later
  - make tagged collections exportable as structured context for source packs, reply drafting, media prompts, and user-controlled LLM/MCP workflows
  - preserve native bookmark behavior while keeping local tag storage, stale-post handling, and X DOM/API risks explicit
- User LLM and MCP integration.
  - design a user-configured bridge to local models, MCP servers, Claude/Codex-style tools, Grok/manual prompt flows, or other user-controlled assistants
  - export structured milXdy context for posts, generated images, reply composers, wiki/source packs, and app-package artifacts
  - package reusable prompt templates or skills with apps so workflows such as animating a Tweet PNG or preparing meme replies can run in the user's chosen assistant
  - keep returned drafts, media, and composer insertions user-reviewed before posting, saving, or uploading
- Post-reading audio library, RSS queues, and shareable verbal-media exports.
  - save reviewed long-form conversions into a local audio library with draft and completed states
  - ingest RSS feeds so long-form items can be queued, reviewed, and converted later
  - add Miladychan file-posting for generated audio/video with source title, context, and subtitles
  - convert readings into MP4 posts with a default contextual image, audio track, and matched subtitles
  - explore feed/podcast-like export and source-extractor plugins for additional long-form sites
- Twitch streaming embeds.
  - define a concrete user value, embed model, permissions, and privacy behavior before assigning to a release
- `$CULT` token cheer, on-chain tipping, and rotating receiving wallets.
  - keep as one consolidated wallet/social-value backlog concept until custody, wallet hygiene, opt-in, recovery, and abuse-control behavior are resolved
