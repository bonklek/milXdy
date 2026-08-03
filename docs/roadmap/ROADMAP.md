# milXdy Roadmap

This roadmap is a public planning guide for beta work. It is intentionally not a promise of exact scope or dates. Items can move between releases as testing, API limits, X/Twitter UI changes, and RemiliaNET constraints become clearer.

## Versioning Rule

- `0.1.x` releases were early integrated-extension beta releases.
- `0.2.x` releases are platform beta releases. They can change architecture, app surfaces, packaging expectations, and public product framing without implying final product stability.

## Most Recent Release

`0.2.4` is the current release. See its [release notes](../releases/RELEASE_NOTES_0.2.4.md) and the descending [changelog](../../CHANGELOG.md) for shipped details.

## Coming Platform Direction: Composable App/Mod System

The long-term goal remains a reviewed composable app system where packages declare surfaces, permissions, assets, settings, privacy notes, performance cost, background services, and lifecycle hooks while sharing milXdy's scanners, schedulers, overlays, and network infrastructure. External installation and stable third-party compatibility remain future work.

## Released: 0.2.4 - Post-Factory

Theme: reviewed sharing, Milady posting, reply media, phrase helpers, maker integrations, optional custom pets, and a usable local add-on pipeline.

- Post-Factory ships quick replies, native X Drafts, bounded Remibooru browsing and attachment, and reviewed Maker/CHEESEWORLD handoffs.
- Share Kit ships reviewed local Tweet PNG controls, watermarking, link-card/quote handling, and deliberate RemiNet Chat staging without automatic send.
- Miladychan Portal ships explicit pseudonymous text posting, final destination confirmation, local failed-submit recovery, watched threads, and native fallback.
- Pets Maker becomes the first selectable maintainer-catalog add-on and remains disabled by default until enabled in Apps & Features.
- Pets Maker ships versioned Maker request bundles and a local Codex handoff.
- App SDK 0.2.4 ships reviewed external and multi-package composition, explicit host callbacks, catalog selection, transactional recovery, and sanitized provenance.
- RemiNet/Beetol, side-rail, visual, lifecycle, security, and documentation refinements complete the release.

## Planned: 0.2.5 - Reader Voice

- Add reviewed Remibooru contribution from Post-Factory (#24).
- Publish the rights-compatible App SDK visual-elements repository and author guide (#183).
- Complete the Maker pet-import adapter, reusable motion templates, envelope QA, and cache/resume (#192/#193).

Theme: Post-reading companion voice experiments and long-form audio export.

- Multi-site app runtime ([#74](https://github.com/bonklek/milXdy/issues/74)).
  - define site-aware app metadata, routes, surfaces, permissions, privacy notes, load triggers, and fallback behavior for RemiliaNET, Miladychan, Remilia Wiki, X/Twitter, and explicitly reviewed related hosts
  - keep X-only apps X-only, preserve least-privilege content-script matching, and decide whether each non-X host receives a full rail, a smaller launcher, or only declared feature modules
  - add cross-host QA without treating existing background host permissions as evidence that the full runtime already injects on those sites
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
- RemiNet friend affordances on X profiles.
  - show whether the viewed profile is already a RemiNet friend when the identity can be resolved
  - offer an explicit add-friend action only after RemiNet endpoint and browser-session behavior are confirmed
  - keep RemiNet friendship visually distinct from native X following and avoid automatic relationship changes

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
