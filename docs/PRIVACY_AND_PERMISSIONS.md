# Privacy And Permissions

milXdy is a beta unpacked extension. Its permissions should remain explainable and limited to real runtime needs.

## Network Calls

- GitHub update checks call `https://api.github.com`.
- RemiStats calls `https://api.remistats.net` for public reputation data.
- RemiStats tooltip profile images load from `https://pfp.remilia.net` when a verified PFP has a displayable image.
- RemiStats profile banner cycling requests image-only NFT banner files from `https://miladymaker.net/banners/nft/...` through the background image fetch allowlist. These banner requests are proxied without account credentials or cookies.
- RemiNet identity cache may call `https://ethereum.publicnode.com` to resolve the current owner of a verified PFP NFT.
- Remilia Wiki previews and the docked Wiki sidebar call `https://wiki.remilia.org` and `https://remilia.wiki`.
- Grok wiki prompts are pasted into X's native Grok interface from the current X/Twitter page.
- Beetol Game, RemiNet pokes, and RemiNet Chat call `https://www.remilia.net`; RemiNet Chat may also load allowlisted avatars from `https://pfp.remilia.net`.
- RemiNet Chat live updates use `wss://www.remilia.net` when the chat setting is enabled.
- Miladychan Portal fetches public board and thread JSON from `https://boards.miladychan.org` when opened or refreshed.
- Music enrichment calls `https://musicbrainz.org` when MusicBrainz lookup is used and `https://api.acoustid.org` only when the user provides an AcoustID key and starts enrichment.
- Post-reading OCR and Maxxer avatar inference run locally in the extension context. When Post-reading OCR needs to read an attached X/Twitter image, it accepts only `https://pbs.twimg.com/media/...` URLs and fetches them without cookies.
- Post-reading full-quote fetching is off by default. When enabled, it uses public X/Twitter embed (`publish.twitter.com`), syndication (`cdn.syndication.twimg.com`), or tweet HTML fallbacks without browser cookies, CSRF/session material, or site authorization tokens.
- Post-reading custom HTTP TTS is optional and local-only. When selected, milXdy sends the text being read plus speed, volume, and voice metadata only to a loopback endpoint such as `http://localhost`, `http://127.0.0.1`, or `http://[::1]`; remote custom TTS endpoints and returned remote audio URLs are rejected.

## Site Runtime Scope

The main milXdy content runtime currently runs on X/Twitter pages. RemiliaNET, Remilia Wiki, and Miladychan host permissions support declared background services, validated embedded Wiki frames, user-opened overlay apps, and web-accessible assets; they do not by themselves mean the full app runtime injects into those sites.

A separate minimal bridge runs only on
`https://bonklek.github.io/milXdy/*`. It accepts the catalog's explicit folder
or rebuild navigation request, independently validates that exact origin and
path in the background, and opens milXdy's Add-ons settings tab. It does not
read page content, accept package bytes or build commands, or run the main
X/Twitter content runtime on the catalog.

## Local-Only Composer Helpers

Composer Tools runs inside the existing X/Twitter content runtime and reads only the active post composer text around the caret to convert typed double dashes into em dashes. It does not add host permissions, network calls, background messages, or remote services, and it ignores DMs, search fields, native inputs, and textareas.

## Firefox Data Collection Manifest

Firefox builds declare required data collection categories for the documented
flows that can send data outside the extension or local browser:
authentication/session information, personal communications, personally
identifying information, website activity, and website content. These categories
cover RemiliaNET session reuse, RemiNet Chat messages and attachments,
public/profile identity lookups, selected X/Twitter context, and requested media
or metadata sent to the remote services listed above. milXdy should not declare
`required: ["none"]` while those flows exist.

## Future Local App Packages

Future local app packages must declare host permissions, background message capabilities, background services, remote APIs, browser-session use, local-file access, workers, WASM, storage keys, and retention notes before the platform enables them. Local packages are privileged reviewed custom-build inputs, not sandboxed runtime plugins. A package copied into an `apps/` folder should stay disabled until validation and any required permission/data-use consent succeeds. Reviewed catalog entries and unreviewed local packages should remain visually distinct when package loading exists.

Current custom local builds also fail closed at composition time. Missing or
local review status requires an explicit developer acknowledgement, privileged
package surfaces require a consent acknowledgement, and sensitive direct
extension API use requires a reviewed exception before a local build plan can be
emitted.

## RemiNet And Beetol Login

- milXdy uses the user's RemiliaNET browser session for connector login. Direct username/password login is no longer supported by RemiliaNET for this extension path.
- milXdy may silently renew a short-lived RemiliaNET access token through the site's existing Keycloak/OIDC browser session. It does not ask users to copy Keycloak cookies and does not store Keycloak SSO cookies.
- If a RemiliaNET connector action fails because stored auth appears stale, milXdy may briefly open `https://www.remilia.net/` in an inactive tab, wait for the browser session to settle, close that tab, and retry the connector session check.
- RemiNet login state stores only connector-local state and the short-lived RemiliaNET access token in Chrome extension local storage. Rotating OIDC refresh tokens are kept in extension background memory when available and are not intentionally persisted.
- Login state should persist across browser restarts, extension reloads, and ordinary updates that keep the same extension identity.
- Browser-session SSO depends on RemiliaNET cookies in the user's browser profile.

## Cookies Permission

The RemiNet connector uses the browser `cookies` permission only for RemiliaNET requests that require the user's RemiliaNET session.

## Incoming Poke Flags

The incoming "poked you!" flag reads recent RemiliaNET notifications through the same connector login. It is based on notification sender handles with timestamps inside the active poke window, not all-time poke history.

## RemiNet Chat

RemiNet Chat is off by default. When enabled, it fetches recent chat messages, opens a RemiliaNET WebSocket, fetches allowlisted RemiliaNET media and pfp.remilia.net avatars for previews, and uploads attachments only after the user selects a file in the chat composer.

## RemiStats Images

RemiStats may show profile images from pfp.remilia.net in tooltips and Milady Maker NFT banner images from miladymaker.net/banners/nft on profile surfaces. These are image-only requests. Milady Maker banner fetches are routed through the extension background allowlist and do not include account credentials or cookies.

## Miladychan Portal

Miladychan Portal is a docked reader for public Miladychan board, thread, post, and media metadata over HTTPS. It does not use a Miladychan WebSocket and does not post to Miladychan. Links and media open the native Miladychan site when users want the full upstream surface.

## Music

Music indexes only local folders the user chooses through the browser folder picker. Indexed metadata, playlists, radio sessions, ISRC candidates, folder handles, and enrichment settings are stored locally in extension storage or IndexedDB. Playlist and radio QR exports contain metadata such as title, artist, ISRC, playlist name, and start time; they do not include audio files.

MusicBrainz lookup sends track metadata needed for candidate search. AcoustID lookup is disabled unless the user provides a client key; when enabled, milXdy may send audio fingerprints or metadata to AcoustID for matching.

## Local Persistence

Settings and login state persist only while Chrome keeps the same extension identity. Removing the extension, loading a different unpacked folder, clearing extension storage, or browser profile cleanup can reset local state.

The Add-ons settings tab stores a user-selected `local-app-packages` directory
handle in extension IndexedDB when the browser allows it. Scanning is
read-only and reports only top-level `.zip` filenames, sizes, and modification
dates in the settings UI. Folder access requires an explicit picker choice and
can be revoked through browser site or extension storage controls. ZIP contents
are not uploaded or passed through the public catalog bridge.

## RemiliaNET Client Support

Accounts should use **Open RemiliaNET** and **Retry session**. After the user starts login from remilia.net and finishes any 2FA step in the browser tab, milXdy checks that browser session and may reuse or silently renew the RemiliaNET `authToken` cookie for Beetol, RemiStats pokes, and RemiNet Chat connector requests. Full 2FA-native extension login depends on RemiliaNET supporting milXdy as an approved client.

The popup **Log out** action disconnects milXdy's connector auth state and prevents automatic browser-session reuse until the user clicks **Retry session** again. It does not necessarily sign the user out of remilia.net in the browser.
