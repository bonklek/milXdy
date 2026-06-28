# Privacy And Permissions

milXdy is a beta unpacked extension. Its permissions should remain explainable and limited to real runtime needs.

## Network Calls

- GitHub update checks call `https://api.github.com`.
- RemiStats calls `https://api.remistats.net` for public reputation data.
- RemiNet identity cache may call `https://ethereum.publicnode.com` to resolve the current owner of a verified PFP NFT.
- Remilia Wiki previews and the docked Wiki sidebar call `https://wiki.remilia.org`.
- Grok wiki prompts are pasted into X's native Grok interface from the current X/Twitter page.
- Beetol Game, RemiNet pokes, and RemiNet Chat call `https://www.remilia.net`.
- RemiNet Chat live updates use `wss://www.remilia.net` when the chat setting is enabled.
- Miladychan Portal fetches public board and thread JSON from `https://boards.miladychan.org` when opened or refreshed.
- Music enrichment calls `https://musicbrainz.org` when MusicBrainz lookup is used and `https://api.acoustid.org` only when the user provides an AcoustID key and starts enrichment.
- Post-reading OCR and Maxxer avatar inference run locally in the extension context.

## RemiNet And Beetol Login

- milXdy uses the user's RemiliaNET browser session for connector login. Direct username/password login is no longer supported by RemiliaNET for this extension path.
- milXdy may silently renew a short-lived RemiliaNET access token through the site's existing Keycloak/OIDC browser session. It does not ask users to copy Keycloak cookies and does not store Keycloak SSO cookies.
- RemiNet login state stores only connector-local state and the short-lived RemiliaNET access token in Chrome extension local storage. Rotating OIDC refresh tokens are kept in extension background memory when available and are not intentionally persisted.
- Login state should persist across browser restarts, extension reloads, and ordinary updates that keep the same extension identity.
- Browser-session SSO depends on RemiliaNET cookies in the user's browser profile.

## Cookies Permission

The RemiNet connector uses the browser `cookies` permission only for RemiliaNET requests that require the user's RemiliaNET session.

## Incoming Poke Flags

The incoming "poked you!" flag reads recent RemiliaNET notifications through the same connector login. It is based on notification sender handles with timestamps inside the active poke window, not all-time poke history.

## RemiNet Chat

RemiNet Chat is off by default. When enabled, it fetches recent chat messages, opens a RemiliaNET WebSocket, fetches RemiliaNET-hosted media for previews, and uploads attachments only after the user selects a file in the chat composer.

## Miladychan Portal

Miladychan Portal is a docked reader for public Miladychan board, thread, post, and media metadata. It does not post to Miladychan. Links and media open the native Miladychan site when users want the full upstream surface.

## Music

Music indexes only local folders the user chooses through the browser folder picker. Indexed metadata, playlists, radio sessions, ISRC candidates, folder handles, and enrichment settings are stored locally in extension storage or IndexedDB. Playlist and radio QR exports contain metadata such as title, artist, ISRC, playlist name, and start time; they do not include audio files.

MusicBrainz lookup sends track metadata needed for candidate search. AcoustID lookup is disabled unless the user provides a client key; when enabled, milXdy may send audio fingerprints or metadata to AcoustID for matching.

## Local Persistence

Settings and login state persist only while Chrome keeps the same extension identity. Removing the extension, loading a different unpacked folder, clearing extension storage, or browser profile cleanup can reset local state.

## RemiliaNET Client Support

Accounts should use **Open RemiliaNET** and **Retry session**. After the user starts login from remilia.net and finishes any 2FA step in the browser tab, milXdy checks that browser session and may reuse or silently renew the RemiliaNET `authToken` cookie for Beetol, RemiStats pokes, and RemiNet Chat connector requests. Full 2FA-native extension login depends on RemiliaNET supporting milXdy as an approved client.

The popup **Log out** action disconnects milXdy's connector auth state and prevents automatic browser-session reuse until the user clicks **Retry session** again. It does not necessarily sign the user out of remilia.net in the browser.
