# Running Ideas

Use this file for unscheduled or release-assigned ideas that are not yet implemented. Remove shipped items after confirming against code/docs or a release diff.

## New Entries

Add newly captured unscheduled ideas here before assigning them to a release.

- Create a distinct milXdy logo.
  - Current builds are still borrowing the Remilia Wiki logo.

## Assigned Entries

### 0.2.0 - The Platform Update

- App platform refactor and first-party app registry.
  - Details: `ideas/app-platform-refactor-handoff.md`.
  - Public docs: `docs/APP_SDK.md`.
- Shared overlay dock and app frame.
- Performance mode split from appearance intensity.
  - Details: `ideas/performance-mode-refactor-note.md`.
- Miladychan Portal.
  - Details: `ideas/miladychan-master-plan-notes.md`.
- Music MVP and local radio foundation.
  - Details: `ideas/music-lifestyle-radio.md`.
- App-platform docs, install/update docs, and public product framing.

### 0.2.1 - RemiNet Placement And Maxxer Controls

- Add a pseudo chat to the X Chats tab with RemiNet chat pinned at the top.
- Expand Miladymaxxer image detection to all reliably recognized collections.
- Add an advanced menu for choosing which recognized collections are maxxed, minimized, or neutral.
- Complete minimization of non-Milady profile pictures.
  - Preserve users with RemiStats beetle stats.
  - Keep whitelist/manual-list overrides.
  - Make the effect reversible from settings.
- Add direct Tweet PNG upload to RemiNet.
  - Requires endpoint/API confirmation.
  - Requires preview/review behavior and privacy review.
  - Never upload automatically.

### 0.2.2 - Reply And Composer Media Tools

- Add a Miladybooru or Meme Depot reply picker.
  - Use an approved Milady image corpus.
  - If `https://memedepot.com/d/milady` remains the backing corpus, keep source reliability and attribution explicit.
- Add a local meme saver folder.
  - Add a local collection of reaction gifs and images near attachment/gif controls.
  - Gallery popup should support scrolling and search.
  - Add a `save to collection` button to uploaded reply images.
- Add a small outline Milady-head reply button next to reply.
  - Sends `milady` without interrupting flow.
  - Settings can change it to `remilio`.
  - Optional custom SVG upload for a custom reply action.
- Add a `Milady Maker` button to the tweet composer bottom bar.
  - Opens `https://maker.remilia.org/milady`.
  - Investigate whether drafted tweet text can be passed into the `TOP TEXT` field safely.

### 0.2.3 - Postreader Companion Voice

- TTS engine side package.
  - User can install it locally.
  - Instructions link to the other repo.
  - Maybe lives in a standalone postreader package.

### 0.2.4 - Identity And Registry Experiments

- Facelord Fixer classifier.
  - Detect whether an account has the real face and full name of a person.
  - Options: minimize/erase, Kagamify, or scramble.
  - Kagamify replaces the pfp with a Kagami and the name with Milady.
  - Scramble gives the default Twitter pfp plus a generated name.
- Optional registry of milXdy users.
  - Show as a badge on opted-in X profiles.
  - Requires a new API or static registry service for lookup/sync.
  - Requires ownership proof, privacy rules, removal flow, and abuse controls.

### 0.2.5 - Daily Milady Spin

- Add a slot-machine icon near the Milady/X icon that opens a Milady wheel.
  - One spin per day.
  - Gives or displays a random Milady-style result.
  - Include a view-on-Blur button.
  - Let users choose which collection their daily spins use.
  - Could model the mini game after `https://isabisabel.com/gacha/`.

### 0.2.6 - Lifestyle Radio

- Optional music player follow-through.
  - Details: `ideas/music-lifestyle-radio.md`.
  - Let users select one or more local folders as a library.
  - Support shuffle and playlists.
  - Treat playlist start-time radio as the MVP compatibility layer, not the final radio concept.
  - Long-term radio model should be station -> timed block -> full record/album, inspired by the Miladychan master plan.
  - Add personal stations generated from the user's own library, plus board-inspired stations for Miladychan surfaces.
  - Treat ISRC enrichment as first-class.
  - First lookup path: embedded tags, filename/manual hints, browser Chromaprint fingerprint, AcoustID lookup, MusicBrainz recording ISRC lookup.
  - AcoustID requires a client key; store it locally as an optional user setting rather than introducing a developer media backend.
  - Respect MusicBrainz rate limits with one-at-a-time queued lookup work.
  - Export/import playlists by ISRC metadata where possible, leaving unmatched local-only tracks as unresolved placeholders.
  - Add QR playlist sharing and start-time radio mode before any streaming fallback.

### 0.2.7 - Stats And Shareable Activity

- Stats and Leaderboards panel.
  - Unify Maxxer XP, pokes, Beetol actions, Postreader usage, RemiStats, and local diagnostics.
- Beetle Hunt share-to-X.
- Optional poke feed.

## Backlog

- Public screenshots and README visual guide.
- Fullscreen onboarding guide and tutorial for fresh installs.
- Customize the like button with a few presets that keep the normal faded-to-colorful click transition.
  - Defaults: joycat, thumbs up, heart eyes, star eyes, hamburger, tearing-up smile, salute.
- Unfollow suggestions.
  - In the following list, highlight light-red accounts without Milady pfps using Maxxer.
- Mobile extension mode that can be saved to the home screen and mimics the desktop browsing experience.
- RemiCast integration.
- Support Twitch streaming embeds.
- `$CULT` token cheer.
  - Investigate public ENS/ETH discovery only if there is a clear privacy-safe user value.
  - Require explicit opt-in before any wallet/address-linked behavior.
- On-chain tipping and rotating receiving wallets.
  - Details: `ideas/onchain-tipping-and-receiving-wallets.md`.
  - Requires strong privacy, opt-in, and withdrawal hygiene before any implementation.
- Miladychan deck and advanced live-board expansion.
  - Details: `ideas/miladychan-master-plan-notes.md`.
  - Future follow-up after the implemented Portal has real usage feedback.
