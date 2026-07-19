# TEMP: Music Player Implementation Plan

Delete this document once the music player, local library, ISRC playlist, QR/radio, and related integration steps are complete or migrated into permanent docs/issues.

## Goal

Add a local-first music player to milXdy that lives in the existing overlay dock/app rail. The first usable version should let a user grant access to local music folders, index tracks, play them from the rail panel, build playlists, and preserve enough metadata to support ISRC-based sharing later.

The product direction is local ownership first: audio stays on the user's machine, playlists are lightweight metadata, and social sharing is based on portable identifiers rather than copied audio.

After the Miladychan master-plan review, radio should be treated as a first-class lifestyle feature rather than only a timestamped playlist share. The long-term target is local-first, album-forward station programming inspired by the Miladychan radio design: stations contain timed blocks, blocks contain full records/albums, and listeners can join the same schedule from their own local libraries.

## Existing Surface To Reuse

Use the existing overlay dock system:

- `src/shared/overlayDock.ts` owns the side rail, order, side switching, badges, and dock settings.
- `src/shared/overlayAppFrame.ts` registers an app in the rail and applies left/right offset.
- `src/features/miladychanSpotlight/content.ts` is the closest model for a dock app with a resizable panel, header actions, persistent width/height/top settings, theme handling, and background fetch support.

The music player should register as its own dock item, probably `id: "music"` with a music-note icon or bundled bitmap asset.

## Implementation Phases

### Phase 1: Rail App Shell

Add a new feature module:

- `src/features/music/content.ts`
- `src/features/music/content.css`
- optional `src/features/music/background.ts` if metadata lookup or cross-origin fetches need the extension service worker
- optional shared files under `src/features/music/shared/`

Wire it into:

- `src/content.ts` feature list
- build script feature entries
- `public/manifest.json` web accessible resources
- popup setting for enabling/disabling the music app if needed

Expected user flow:

1. User opens X/Twitter.
2. milXdy side rail appears.
3. User clicks the Music rail icon.
4. Music panel opens beside the rail.
5. If no library exists, panel shows the setup state.

Interface shell:

- Header: `Music`, current state text, close/minimize button, refresh/rescan button.
- Body tabs: `Library`, `Playlists`, `Radio`, `Settings`.
- Footer/miniplayer: previous, play/pause, next, seek bar, current track title, volume.
- Resizable panel using the same pattern as Miladychan Spotlight.

### Phase 2: Local Folder Permission And Library Index

Add a setup flow using browser file/directory access.

Expected user flow:

1. User opens Music for the first time.
2. Panel shows `Add music folder`.
3. User selects one or more local folders.
4. Extension scans supported audio files.
5. Library view fills with tracks.
6. User can play tracks immediately.

Supported files for first pass:

- `.mp3`
- `.flac`
- `.m4a`
- `.ogg`
- `.wav`

Storage model:

- Use IndexedDB for library index and playlist data.
- Store file handles where supported.
- Store derived metadata separately from file handles.
- Store lightweight app settings in `chrome.storage.local`.

Track record shape:

```ts
type MusicTrack = {
  id: string;
  source: "local";
  fileName: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number | null;
  isrc: string | null;
  fileHandleKey: string;
  folderId: string;
  lastIndexedAt: number;
  unavailable?: boolean;
};
```

Indexing behavior:

- Scan only after explicit user action.
- Show progress: folders scanned, files found, tracks indexed.
- Allow cancellation.
- Do not run continuous background scans.
- Add `Rescan` and `Repair missing files` actions.

### Phase 3: Metadata Extraction And Automated ISRC Enrichment

Add client-side audio metadata parsing plus an intelligent enrichment pipeline. Assume most local files will not have embedded ISRC tags.

Expected user flow:

1. User indexes folder.
2. Extension extracts title/artist/album/duration where available.
3. Extension extracts embedded ISRC when present.
4. Extension queues tracks without ISRC for enrichment.
5. User sees enrichment progress and confidence status.
6. High-confidence matches are accepted automatically if the user enables that setting.
7. Medium/low-confidence matches go to a review queue.
8. Tracks without ISRC remain playable and can be manually matched later.

Metadata priority:

1. Embedded tags.
2. Filename/folder parsing fallback.
3. Acoustic fingerprint lookup.
4. MusicBrainz recording/release lookup.
5. Spotify or other catalog lookup by matched metadata.
6. Manual edit in the track details panel.

Automated enrichment pipeline:

```text
local file
  -> parse embedded tags
  -> compute duration
  -> compute audio fingerprint when needed
  -> AcoustID lookup
  -> MusicBrainz recording candidates
  -> candidate ISRCs
  -> optional Spotify/catalog confirmation
  -> confidence score
  -> accept or review
```

Fingerprinting:

- Use Chromaprint-compatible fingerprinting where practical.
- Prefer client-side/WASM fingerprint generation if browser performance is acceptable.
- If browser fingerprinting is too heavy for large libraries, allow a later companion-helper path while keeping the extension UI and library index unchanged.
- Store fingerprints or fingerprint hashes only when needed for re-checking; do not recompute on every app open.
- Do not confuse the local fingerprint with the AcoustID. The extension can generate a Chromaprint-style fingerprint from the audio, but the AcoustID identifier is returned by the AcoustID lookup service when that fingerprint matches its database.

Researched implementation stance:

- Embedded ISRC tags are a fast path only. Do not assume Nicotine/Soulseek/downloaded local files will have usable TSRC or equivalent tags.
- The browser extension can generate Chromaprint-compatible fingerprints with a local WASM module when the browser can decode the audio codec.
- AcoustID lookup requires a client key plus duration and fingerprint; store the user-provided client key locally in extension storage.
- Use POST for AcoustID lookup because compressed fingerprints can be too long for a safe GET URL.
- AcoustID results should be treated as recording candidates. Pull ISRC evidence from linked MusicBrainz recordings, then score the result by AcoustID score, title agreement, and duration delta.
- MusicBrainz requires a clear User-Agent and conservative request pacing. Keep the queue at one network lookup lane and at least one second between MusicBrainz requests.
- If browser decoding or AcoustID lookup fails, fall back to MusicBrainz title/artist/album/duration search and keep the track playable.
- Store the fingerprint hash, AcoustID ID, MusicBrainz recording ID, ISRC candidate list, confidence, and retry window as evidence. Do not write tags back into the user's audio files.

Large-library behavior:

- Expect thousands of local songs.
- Enrichment must be incremental, resumable, and cancelable.
- Index playable library rows first, then enrich ISRCs in the background queue.
- Only fingerprint tracks that lack a trusted embedded ISRC or prior accepted match.
- Process fingerprints with bounded concurrency, starting with one active fingerprint job.
- Pause or slow enrichment while playback is active if CPU or disk load is noticeable.
- Persist per-track enrichment state so the queue can resume after browser restart.
- Cache negative results with a retry window rather than re-querying unresolved tracks every scan.
- Batch UI updates so thousands of enrichment state changes do not thrash the panel.

Enrichment state:

```ts
type IsrcEnrichmentState = {
  status: "pending" | "fingerprinting" | "lookup" | "review" | "matched" | "unresolved" | "error";
  attempts: number;
  lastAttemptAt: number | null;
  nextRetryAt: number | null;
  fingerprintHash?: string;
  acoustId?: string;
  candidates: IsrcCandidate[];
  error?: string;
};
```

AcoustID:

- AcoustID lookup accepts a Chromaprint fingerprint plus duration and can return linked MusicBrainz metadata.
- Use it to identify files even when filenames and tags are poor.
- Rate limit requests and queue them visibly.
- Store AcoustID IDs and matched MusicBrainz recording IDs as enrichment evidence.
- The client key is an optional user setting. Without it, the enrichment queue still performs embedded-tag and MusicBrainz metadata fallback, but it skips acoustic lookup.

MusicBrainz:

- Use MusicBrainz recording data as the main open metadata source.
- Pull ISRCs from matched recordings when available.
- Use artist/title/album/duration searches as a fallback when fingerprinting is unavailable.
- Respect MusicBrainz API identification and rate limits; queue lookups rather than firing a large library scan at once.

Spotify/catalog confirmation:

- Spotify track objects expose `external_ids.isrc`; use this as a confirmation or fallback when the user has enabled catalog lookup.
- Search by artist/title/album/duration or by MusicBrainz-derived metadata.
- Do not treat Spotify as the only source of truth. Use it to strengthen or challenge a candidate.

Confidence model:

```ts
type IsrcCandidate = {
  isrc: string;
  confidence: number;
  sources: Array<"embedded" | "acoustid" | "musicbrainz" | "spotify" | "manual">;
  musicBrainzRecordingId?: string;
  acoustId?: string;
  spotifyTrackId?: string;
  title?: string;
  artist?: string;
  album?: string;
  durationDeltaMs?: number;
};
```

Suggested confidence rules:

- `1.00`: embedded ISRC or user-confirmed manual ISRC.
- `0.92-0.98`: AcoustID fingerprint maps to a MusicBrainz recording with one clear ISRC and duration match.
- `0.85-0.94`: MusicBrainz and Spotify agree on the same ISRC.
- `0.70-0.84`: metadata-only match with strong title/artist/duration agreement.
- below `0.70`: keep in review queue, do not auto-apply.

ISRC behavior:

- Treat ISRC as the preferred portable identifier, not a required field.
- Store confidence/source for every ISRC match.
- Let users clear or correct incorrect matches.
- Keep enrichment non-destructive by default. Do not rewrite the user's audio file tags unless a future explicit tag-writing feature is added.

Review queue interface:

- grouped by confidence: high, needs review, unresolved
- side-by-side local metadata and candidate metadata
- source badges: embedded, fingerprint, MusicBrainz, Spotify, manual
- accept, reject, search again, edit manually
- bulk accept only for high-confidence matches
- filter by unresolved playlist blockers

Track details interface:

- title
- artist
- album
- duration
- ISRC
- source/confidence
- AcoustID / MusicBrainz / Spotify evidence when present
- edit metadata button
- locate file button

Research references:

- MusicBrainz API: `https://musicbrainz.org/doc/MusicBrainz_API`
- MusicBrainz ISRC notes: `https://musicbrainz.org/doc/ISRC`
- MusicBrainz rate limiting and user-agent requirements: `https://musicbrainz.org/doc/MusicBrainz_API`
- AcoustID web service: `https://acoustid.org/webservice`
- MusicBrainz AcoustID notes: `https://musicbrainz.org/doc/AcoustID`
- Spotify track metadata and `external_ids.isrc`: `https://developer.spotify.com/documentation/web-api/reference/get-track`
- Spotify search API: `https://developer.spotify.com/documentation/web-api/reference/search`

### Phase 4: Playback And Queue

Build the actual player.

Expected user flow:

1. User clicks a track in Library.
2. Track starts playing.
3. Miniplayer appears at bottom of the panel.
4. User can queue, shuffle, repeat, and seek.
5. Closing the panel keeps playback going if the rail app stays active.

Playback state:

```ts
type PlaybackState = {
  queueTrackIds: string[];
  currentIndex: number;
  currentTimeMs: number;
  playing: boolean;
  repeatMode: "off" | "one" | "all";
  shuffle: boolean;
  volume: number;
};
```

Interface details:

- Library list with compact rows: title, artist, album, duration, ISRC marker.
- Search box for title/artist/album.
- Sort controls: recently added, artist, album, title.
- Queue drawer or tab.
- Playback controls use icons, not text labels.
- Tooltips identify icon buttons.

### Phase 5: Local Playlists

Add playlist creation and editing.

Expected user flow:

1. User selects tracks.
2. User creates playlist.
3. User reorders tracks.
4. User plays playlist.
5. User exports playlist metadata.

Playlist shape:

```ts
type MusicPlaylist = {
  id: string;
  name: string;
  description: string;
  trackRefs: Array<{
    localTrackId?: string;
    isrc?: string;
    title?: string;
    artist?: string;
  }>;
  createdAt: number;
  updatedAt: number;
};
```

Rules:

- Do not duplicate audio.
- Playlist entries should survive local file moves if ISRC or metadata matching can reconnect them.
- Playlists can contain unmatched local-only tracks, but exported social playlists should mark missing ISRCs clearly.

### Phase 6: Portable Playlist Import And Export

Add JSON playlist import/export.

Expected user flow:

1. User exports a playlist.
2. Extension creates a compact JSON payload.
3. Another user imports it.
4. Their extension matches ISRCs against their local library.
5. Missing tracks are shown as unresolved.

Payload shape:

```json
{
  "v": 1,
  "app": "milxdy",
  "kind": "playlist",
  "name": "playlist name",
  "tracks": [
    { "isrc": "USRC12345678", "title": "Track", "artist": "Artist" }
  ]
}
```

Import UI:

- matched locally
- unresolved
- duplicate candidates
- add matched tracks to new playlist
- leave unresolved entries in playlist as placeholders

### Phase 7: QR Playlist Sharing

Add QR generation and scanning for playlist payloads.

Expected user flow, export:

1. User opens a playlist.
2. User chooses `Share QR`.
3. Extension generates a styled QR image with playlist payload and repo/discovery URL.
4. User copies/downloads the QR image.
5. Optional: user opens X composer and attaches the QR manually or through a review flow.

Expected user flow, import:

1. Extension sees an image in a tweet or Miladychan post.
2. User chooses `Scan playlist QR`.
3. Extension decodes QR client-side.
4. Extension previews playlist.
5. User imports matched tracks.

QR constraints:

- Keep payload compact.
- Include a normal URL so external scanners show a useful install/discovery destination.
- For long playlists, support compressed payloads or split/share-file fallback.
- Do not auto-import from images without user confirmation.

### Phase 8: Radio Mode

Add synchronized listening based on a shared start time. This remains the first implementation step, but it should be designed as the compatibility layer for lifestyle radio, not the final shape of the feature.

Miladychan master-plan radio model:

- The source design is an algorithmic, album-by-album radio prepared for each board.
- It rejects singles-style web radio in favor of full records/albums because albums make transitions more thematic, reduce curation overhead, and give curators more freedom.
- Radio has three layers: station, block, record.
- A station plays six four-hour blocks per day.
- Each block has a playlist of records.
- Each record is played in full once it begins.
- When the current record finishes, if the block window is over, a new eligible block is selected.
- Blocks can be always eligible or limited to specific times of day.
- Each Miladychan board can have one curated station that posters listen to in sync, unifying board character as the day progresses.
- The personal adaptation is "lifestyle radio for every Remilian" generated from the user's own library.

Revised product target:

- Keep playlist radio as the MVP because it is already simple, local-first, and QR-shareable.
- Promote "station" to the main radio mental model over time.
- A station is a named schedule, not just a playlist.
- A block is a time-scoped mood/theme/programming lane.
- A record is preferably an album or album segment, not an individual loose track.
- Track-level playlists remain useful for compatibility, but lifestyle radio should prefer album continuity whenever metadata allows.

Expected creator flow:

1. User opens a playlist.
2. User chooses `Start radio`.
3. User selects start time.
4. Extension creates radio payload with playlist IDs/ISRCs and start timestamp.
5. User shares QR or text payload.

Expected listener flow:

1. User imports radio payload.
2. Extension matches tracks locally.
3. Extension shows readiness: matched, missing, current track at start time.
4. At or after start time, extension calculates current track and offset from the shared clock.
5. User joins playback at the computed position.

Radio rules:

- Use local system time first.
- Allow manual resync.
- Show drift/offset controls.
- Missing tracks should be skipped with clear status.
- No server required for baseline radio mode.

Lifestyle station data model target:

```ts
type RadioStation = {
  id: string;
  name: string;
  source: "personal" | "board" | "shared";
  boardId?: string;
  timezone: string;
  blocks: RadioBlock[];
  createdAt: number;
  updatedAt: number;
};

type RadioBlock = {
  id: string;
  name: string;
  startMinute?: number;
  endMinute?: number;
  days?: number[];
  recordRefs: RadioRecordRef[];
  selection: "ordered" | "shuffle-records" | "weighted";
};

type RadioRecordRef = {
  kind: "album" | "playlist" | "trackGroup";
  title: string;
  artist?: string;
  album?: string;
  isrcs: string[];
  localTrackIds?: string[];
};
```

Scheduling behavior:

- For playlist radio MVP, current position can continue to be `elapsed % playlistDuration`.
- For station radio, compute the active block from local time and station timezone.
- Within a block, choose records deterministically from the station seed, date, block id, and completed record count so different clients can converge without a server.
- Once a record begins, let it play through even if the block boundary passes.
- After a record finishes, if the current block is no longer eligible, select from the newly active block.
- Missing local records should be skipped deterministically and surfaced as unresolved station gaps.

Personal lifestyle generation:

- Generate personal stations from the user's own library using album, artist, genre/folder, date-added, and manual tags.
- Start with user-authored blocks such as morning, work, night, rave, gym, calm, or board-specific moods.
- Later, infer blocks from listening patterns and folders without making the UI feel like a corporate recommendation engine.
- Prefer full albums for station records. Fall back to track groups when album metadata is incomplete.
- Preserve local ownership: station payloads share metadata/ISRCs/timing, not audio files.

Miladychan integration:

- Board radio should be linked from Miladychan surfaces as a cultural companion, not just another music tab.
- If upstream Miladychan exposes official board radio, milXdy should treat it as canonical and join/resolve locally where possible.
- If upstream does not expose radio yet, milXdy can prototype local "board-inspired" stations mapped to boards like `milady`, `remilio`, `kpop`, `a`, `v`, and `ai`.
- A Miladychan thread or board view should be able to show the current station/block/record with an explicit join action.
- Do not autoplay board radio from browsing Miladychan. Joining should be intentional.

UI implications:

- Radio tab should eventually separate `Sessions` from `Stations`.
- Station cards should show current block, current record, next eligible block, match percentage, and join/share actions.
- Block editor should be compact: block name, time window, eligible days, and record list.
- Record list should use album rows where possible, with track rows nested only when needed.
- QR/export should support both one-off session payloads and station schedule payloads.

### Phase 9: Streaming Fallback

Add optional streaming-platform fallback for unresolved tracks.

Expected user flow:

1. User imports a playlist with missing local tracks.
2. Extension offers streaming fallback setup.
3. User connects their own streaming account if supported.
4. Extension resolves ISRCs to platform tracks.
5. User opens or plays the platform version according to allowed API behavior.

Requirements:

- User-owned auth only.
- No developer-owned media backend.
- Keep fallback optional.
- Preserve local-file playback as the primary path.

### Phase 10: Soulseek And Friend Whitelist

Add Soulseek-powered sharing as a dedicated integration path.

Expected user flow:

1. User opens Music settings.
2. User connects/configures Soulseek integration.
3. User chooses friends from the local whitelist.
4. User grants access to selected playlists or folders.
5. Whitelisted friends can request/access allowed files through the integration.

Rules:

- Default closed/private.
- Per-friend explicit permission.
- Per-playlist or per-folder access grants.
- Visible status for active sharing.
- Easy revoke button.
- No implicit public file sharing.

Friend whitelist data:

```ts
type MusicFriend = {
  id: string;
  label: string;
  source: "manual" | "reminet" | "wallet" | "import";
  permissions: {
    soulseekAccess: boolean;
    radioInvites: boolean;
    playlistSharing: boolean;
  };
};
```

### Phase 11: Miladychan And X Discovery

Connect playlists, one-off radio sessions, and station schedules to existing social surfaces.

Expected X flow:

1. User shares a playlist QR in a tweet.
2. milXdy can scan the image after explicit user action.
3. User imports a playlist, joins a one-off session, or imports a station schedule.

Expected Miladychan flow:

1. User posts QR, playlist payload, radio-session payload, or station payload in a relevant thread.
2. Music panel can surface active radio/station posts from Miladychan discovery.
3. Miladychan portal can show the current board-inspired or official station when available.
4. User previews before import/join.

Expected board-radio flow:

1. User opens a Miladychan board in milXdy.
2. Board header shows current station/block/record if a station mapping exists.
3. User chooses `Join radio`.
4. Music panel resolves the current record against local files or optional fallback.
5. Playback joins the computed station position.

Implementation notes:

- Reuse Miladychan fetch helpers where appropriate.
- Keep discovery manual-refresh first.
- Do not auto-download audio from posts.
- Do not autoplay station audio merely because a board is open.
- Treat official upstream board radio as canonical if it exists; otherwise local board-inspired stations are clearly labeled as milXdy-local.

## Settings Needed

Add a Music settings section, either in the Music panel or popup:

- enable Music rail app
- manage music folders
- rescan library
- clear library index
- default volume
- keep playing when panel closes
- QR scan/import confirmation settings
- streaming fallback connections
- Soulseek integration status
- friend whitelist management

## Background And Permissions

Likely permission/manifest changes:

- file/directory access UX relies on browser APIs and user gestures.
- cross-origin metadata lookup may need service-worker fetch plumbing.
- QR generation/scanning can run locally in the feature bundle.
- streaming integrations may require OAuth redirect handling later.

Keep permission prompts staged. Do not request new broad permissions until a phase needs them.

## Acceptance Checklist

- Music appears as a rail app.
- Panel opens/closes from the rail and respects left/right dock position.
- User can add a local folder.
- Library indexes supported audio files.
- User can play local tracks.
- User can search and sort library.
- User can create, edit, and play playlists.
- ISRC is extracted or manually editable.
- Playlist export/import works without copying audio.
- QR export/import works with confirmation.
- Radio mode computes current track/offset from a start timestamp.
- Streaming fallback is optional and does not block local playback.
- Soulseek access is explicit, friend-scoped, and revocable.
- No audio or listening status is shared without direct user action.
