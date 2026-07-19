# Music Lifestyle Radio

Source context:

- `ideas/miladychan-master-plan-notes.md`
- `ideas/TEMP-music-player-implementation-plan.md`
- Archive source: https://archive.org/details/miladychan-master-plan/

## Why This Changes The Music Player Plan

The music player should not mature as only a local library utility with playlists. The Miladychan master plan frames radio as cultural infrastructure: a synchronized, album-forward sound layer that unifies the character of a board as the day progresses.

For milXdy, the adapted version is local-first lifestyle radio:

- The user's files stay local.
- Shared radio payloads carry timing and metadata, not audio.
- Stations can be personal, board-inspired, or eventually official board stations.
- The core unit should be the record/album, not the single track.
- Radio should support synchronous listening without requiring a media backend.

## Source Model

The master-plan radio model is:

- Station: the radio identity, one per board in the source design.
- Block: a themed time window within a station.
- Record: a full album/record selected inside a block.

Important constraints:

- Six four-hour blocks per day is the default shape.
- Blocks may be always eligible or limited to specific times.
- Records play through once begun.
- If a block has ended when the current record finishes, the station moves to a newly eligible block.
- Album-first programming is preferred over singles-style radio because it is more thematic, easier to curate, and less overhead.
- Board radio is meant to let posters listen in sync and create shared atmosphere.

## Product Interpretation

The existing radio-session idea is still useful, but should be treated as the MVP compatibility layer:

- `Start radio` on a playlist creates a synchronized one-off session.
- QR/import resolves tracks locally by ISRC and metadata.
- The current implementation can calculate current track and offset from a shared start time.

The target model should become:

- `Stations`: persistent schedules.
- `Blocks`: mood/time lanes inside a station.
- `Records`: albums or album-like groups.
- `Sessions`: one-off shared listening events.

## Station Types

Personal station:

- Generated from a user's local library.
- Uses folder/album/artist/manual tags as curation material.
- Can have blocks such as morning, work, gym, night, rave, sleep, or user-defined moods.

Board-inspired station:

- Local station mapped to a Miladychan board.
- Example mappings: `milady`, `remilio`, `kpop`, `a`, `v`, `ai`.
- Useful even before official upstream radio exists.

Official board station:

- If upstream Miladychan exposes station schedules, milXdy should treat those as canonical.
- milXdy can resolve official station records against the user's local library or optional streaming fallback.

Shared station:

- Exported/imported station schedule.
- Payload includes station, blocks, records, ISRCs, seed/timing, and a discovery URL.

## Implementation Direction

Near-term:

- Keep the current playlist radio mechanics.
- Rename planning language so `RadioSession` is explicitly "session" rather than the whole radio concept.
- Add album grouping to the library model or derived selectors.
- Add a `Station` planning type before building more radio UI.

Mid-term:

- Add a `Stations` subview under the Radio tab.
- Add station cards with current block, current record, match percentage, and join/share actions.
- Add simple block editor: name, time window, days, album list.
- Allow station generation from selected folders/albums.
- Support station QR export/import.

Long-term:

- Connect station state into Miladychan surfaces.
- Show current board station/block/record in Miladychan portal/deck views.
- Join official board radio locally if upstream exposes schedules.
- Use station blocks as a broader "show up now" pattern for Remilia events and time-windowed community activity.

## Design Constraints

- No autoplay from Miladychan browsing. Joining radio should be intentional.
- Prefer full albums. Fall back to track groups when album metadata is bad.
- Do not make a corporate recommendation feed. The feel should be curated, local, and personal.
- Do not require streaming accounts for core behavior.
- Do not upload or copy audio through milXdy.
- Surface missing records clearly without breaking the whole station.
- Use deterministic schedule selection so users can sync without a server.

## Open Questions

- Does upstream Miladychan currently expose any official radio/station schedule?
- Should personal stations use the user's local timezone only, or allow station-specific timezones?
- How much album metadata is good enough before we need manual record grouping?
- Should station blocks default to six four-hour windows or let users start with fewer named blocks?
- Should board-inspired station presets ship as templates, or be generated only from user-selected albums?
