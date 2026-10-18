# Music User Guide

Music indexes local music, enriches ISRC metadata, manages playlists, and creates local radio sessions.

## Where To Find It

- Enable and pin **Music** from Apps & Features.
- Open **Music** from the side rail.
- Use Chromium for the full local folder workflow.

## Common Tasks

- Use **Library** to select local folders and rescan files.
- Use **Queue** to control playback order, shuffle, repeat, seek, and volume.
- Use **Playlists** to create, reorder, import, export, and QR-share metadata playlists.
- Use **Radio** to create or join metadata-based local sessions.
- Use **Settings** for local folders, ISRC enrichment, auto-match behavior, and an optional AcoustID client key.

## Notes

Playlist and radio QR payloads share metadata, not audio files. Adding folders and rescanning always stay local, even after you have used enrichment.

In Music **Settings**, choose **MusicBrainz** and/or **AcoustID** separately. MusicBrainz receives track title, artist, album and recording IDs. AcoustID receives audio fingerprint, duration and your client key; it requires both a saved key and its own selected checkbox. Saving a key never enables lookup. Click **Enrich**, review the selected recipients and data, then **Enrich selected services** to start up to 40 pending tracks. Cancel sends nothing.

Uncheck either service to stop the current batch. Pending requests are rejected and active requests are aborted; previously sent data cannot be recalled. Re-enabling requires another explicit Enrich action. Existing local tracks, playlists, candidates and saved keys remain intact. An older blanket enrichment grant does not select either service after upgrading; review your choices again.

The panel remembers layout state. Compact mode can resize narrower but has a capped height; use the full player when you want the larger controls.
