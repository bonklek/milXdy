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
- Official Remilia profile, directory, stats, notifications, poke, Beetle, and
  global-chat operations call fixed routes under
  `https://www.remilia.net/api/v1`. RemiNet Chat may also load allowlisted
  avatars from `https://pfp.remilia.net`.
- RemiNet Chat live updates may use the temporary legacy
  `wss://www.remilia.net` adapter when chat is enabled. Official REST history
  and text posting continue when that adapter is unavailable.
- Miladychan Portal fetches public board and thread JSON from `https://boards.miladychan.org` when opened or refreshed.
- Post-Factory queries public reaction metadata through `https://remibooru.com`; reviewed Maker handoffs open `https://maker.remilia.org` only after a declared user action.
- Pets Maker contacts `https://maker.remilia.org` only after the user clicks **Fetch**; it sends the selected public Maker family and NFT number and receives public trait metadata.
- Music enrichment calls `https://musicbrainz.org` when MusicBrainz lookup is used and `https://api.acoustid.org` only when the user provides an AcoustID key and starts enrichment.
- Post-reading OCR and Maxxer avatar inference run locally in the extension context. When Post-reading OCR needs to read an attached X/Twitter image, it accepts only `https://pbs.twimg.com/media/...` URLs and fetches them without cookies.
- Post-reading full-quote fetching is off by default. When enabled, it uses public X/Twitter embed (`publish.twitter.com`), syndication (`cdn.syndication.twimg.com`), or tweet HTML fallbacks without browser cookies, CSRF/session material, or site authorization tokens. The direct public-HTML fallback omits credentials, rejects redirects, sends no referrer, honors cancellation, rejects non-success HTTP status, and reads only the returned text.
- Post-reading custom HTTP TTS is optional and local-only. When selected, milXdy sends the text being read plus speed, volume, and voice metadata only to a loopback endpoint such as `http://localhost`, `http://127.0.0.1`, or `http://[::1]`; remote custom TTS endpoints and returned remote audio URLs are rejected.
- Direct-message read-aloud is a stricter local boundary: it always uses the
  browser's Web Speech engine, even when custom HTTP TTS is selected. DM text is
  excluded from custom TTS, audio export, OCR, full-quote retrieval, background
  routes, diagnostics, and persistent storage. Only metadata-only diagnostics
  are allowed; message references are transient and stop, completion,
  navigation, disable, disposal, and uninstall clear the active conversation
  state.

## Site Runtime Scope

milXdy injects its shared runtime only on these reviewed HTTPS hosts:

- `x.com` and `twitter.com`: full side rail, Apps & Features, X route service, and the shared Twitter surface scanner.
- `www.remilia.net`: a filtered launcher for RemiNet Chat and Beetol. The
  temporary socket bridge remains separately validated; it does not adopt the
  website session or provide Remilia authentication.

Beetol reads only token-free connection status in content code. When an
official account connection is required, it passively tells the user to open
the milXdy extension popup and choose **Remilia connection →
Connect/Reconnect**. It cannot open a login/session tab, disconnect the account,
or call retired logout/session-status routes. Legacy Beetle action requests
stay in trusted background code, retry only after the first HTTP 401 (never
403), do not clear the connection on action failure, omit browser credentials,
reject redirects, send no referrer, and reject a changed final response URL.
- `remilia.wiki` and `wiki.remilia.org`: a feature-only runtime for direct Post-reading article controls and route handling; the existing validated embedded-Wiki bridge remains separate.
- `boards.miladychan.org`: a filtered Miladychan Portal launcher. Public JSON and explicit text-only posting still use the fixed background allowlist with credentials omitted.

X-only apps are absent from non-X launchers and are never imported there. Host permissions for background services or embedded frames do not opt an app into top-level injection. Unlisted related hosts receive no milXdy content runtime until their exact origin, app metadata, privacy disclosure, fallback, and permissions are reviewed.

A separate minimal bridge runs only on
`https://bonklek.github.io/milXdy/*`. It accepts the catalog's explicit folder
or rebuild navigation request, independently validates that exact origin and
path in the background, and opens milXdy's Add-ons settings tab. It does not
read page content, accept package bytes or build commands, or run the main
X/Twitter content runtime on the catalog.

## Local-Only Composer Helpers

Composer Tools runs inside the existing X/Twitter content runtime and reads only the active supported post or DM composer text around the caret to convert typed double dashes into em dashes. It does not add host permissions, network calls, background messages, or remote services, and it ignores search fields and unrelated native inputs/textareas.

## Firefox Data Collection Manifest

Firefox builds declare required data collection categories for the documented
flows that can send data outside the extension or local browser:
authentication/session information, personal communications, personally
identifying information, website activity, and website content. These categories
cover Remilia Login credentials, RemiNet Chat messages and attachments,
public/profile identity lookups, selected X/Twitter context, and requested media
or metadata sent to the remote services listed above. milXdy should not declare
`required: ["none"]` while those flows exist.

## Future Local App Packages (Now Available)

Local app packages must declare host permissions, background message
capabilities, background services, remote APIs, Remilia capabilities, local-file
access, workers, WASM, storage keys, and retention notes before the platform
enables them. Local packages are privileged reviewed custom-build inputs, not
sandboxed runtime plugins. Copied packages stay disabled until validation and
any required permission/data-use consent succeeds. Reviewed catalog entries and
unreviewed local packages remain visibly distinct.

Current custom local builds also fail closed at composition time. Missing or
local review status requires an explicit developer acknowledgement, privileged
package surfaces require a consent acknowledgement, and sensitive direct
extension API use requires a reviewed exception before a local build plan can be
emitted.

An approved external handoff is also explicit and one-time. When a user clicks
a declared maker control, milXdy may read the active X draft only for that
gesture, split it into the reviewed maker's caption fields, and open that maker
in an inactive tab. The package itself does not receive the draft, image bytes,
or remote-page access. A reviewed host adapter may return the generated PNG and
attach it to that same active X composer; this never posts on the user's behalf.
A changed destination, unavailable controls, invalid image, or missing consent
stops the transfer.

## Post-Factory and Remibooru

Post-Factory stores only its enablement state and up to 20 user-created quick
reply phrases of at most 280 characters. Its **D** control opens X's native
Drafts; the package neither reads nor stores X drafts.

An explicit Remibooru search sends bounded public query terms or facets,
pagination cursor, and page size to `https://remibooru.com`. On the explicit
Tags action, the host may derive up to five sanitized facet IDs from the visible
initiating composer and immediately discards the raw text. Post-Factory receives
sanitized result IDs, thumbnail URLs, canonical post URLs, display dimensions,
and visible attribution—not original-media URLs or raw service responses. A
result attaches only after an explicit click and never posts.

Maker handoffs send only user-reviewed declared caption fields to the selected
`maker.remilia.org` surface after an explicit control. Post-Factory cannot read
the Maker page or post generated media.

## Share Kit

Share Kit renders the explicitly selected X/Twitter post and visible media
locally. Copy, download, browser share, colors, included media, quote context,
watermark, and other preview choices remain local. **Share to RemiNet** stores
one pending local attachment and opens RemiNet Chat; the image is sent to
RemiliaNET only if the user subsequently presses Send in Chat.

## Pets Maker

Pets Maker is a selectable maintainer-catalog package but installs disabled by
default. After the user enables it, the package reads the transparent PNG chosen
through its visible file input and the family/trait/body choices entered in the
open form. An explicit **Fetch** sends only the selected public Maker family and
NFT number to `maker.remilia.org`; returned public traits populate the visible
form and are not cached. The package creates a local two-file ZIP and does not
upload the selected image, post, publish, or invoke Codex. Form state and
selected files are not persisted.

## Remilia Account And Credential Custody

- milXdy uses the official public Remilia Login client and OIDC Authorization
  Code with PKCE S256 in the Chromium beta profile. Login is visible and
  requires explicit user consent.
- The registered callback must match the installed beta identity exactly.
  Callback state, PKCE verifier/challenge, authorization code, access token,
  refresh token, and ID token are handled only by the trusted extension
  background.
- Credentials are not sent to X/Twitter pages, content scripts, the DOM, local
  packages, App SDK context, sync storage, exported settings, profile packs,
  diagnostics, or logs.
- Token-free connection status is still private account metadata. Rejected
  content/page/package senders receive only a generic authorization error; the
  background does not look up or return identity, scopes, migration state, or
  other connection details for them.
- Access, refresh, and ID tokens plus expiry, connected identity, and granted
  scopes live only in trusted-context `chrome.storage.session`. They survive an
  MV3 worker restart but end on extension reload or when the browser session
  ends. Token-free
  control/migration/error metadata alone may use local storage.
- A refresh response can rotate the refresh token. An expired or revoked grant
  returns to an explicit reconnect state; milXdy does not open a hidden tab or
  adopt an existing RemiliaNET web session.
- OIDC discovery, token, JWKS, and revoke/logout requests reject HTTP redirects
  and omit the referrer. Redirected authorization-code, refresh/revocation, or
  trust-bootstrap material is never followed to another location.
- Disconnect and revoke clear local credentials without deleting unrelated
  settings. Remote logout/revocation is best effort and is described separately
  from local credential deletion.
- Existing installations receive a one-time migration notice. Legacy connector
  credentials are deleted, and no migration or rollback path restores cookie
  mutation or silent session reuse.
- milXdy does not use the browser `cookies` permission for Remilia
  authentication. Any retained permission must have a separate documented
  consumer and security disposition.
- The Firefox profile is keyless and has no Remilia Login identity client or
  registered callback. It reports the connection as `UNSUPPORTED`, exposes no
  login actions, and does not restore a cookie/session fallback. Non-auth
  Firefox behavior remains independent of the connection boundary.

## Remilia Delegated Scopes

The connected account grants only named abilities approved for the public
client:

- `remilia:stats.read` reads the connected account's statistics.
- `remilia:notifications.read` reads the connected account's notifications.
- `remilia:pokes.write` sends an explicit user-attributed poke.
- `remilia:beetle.read` reads Beetle state and discovered cards.
- `remilia:chat.read` reads global chat history.
- `remilia:chat.write` posts user-reviewed text or replies to global chat.
- `remilia:directory.read` resolves and lists public directory identities.

Public `GET /users/{username}` needs no token; connected `GET /me` needs a
user-delegated grant. Missing scope, requires-user, cooldown, rate-limit,
revoked/expired, and offline outcomes remain distinct in the UI and redacted
diagnostics.

Public profile and directory caches retain normalized identity results, not
bearer tokens or raw responses. Positive results expire after six hours;
explicit misses after 15 minutes. Caches are bounded to 600 entries each (300
public-profile misses). Network errors, omitted/invalid entries, and conflicting
duplicates are not stored as misses. Viewer/profile context exposed to features
is normalized; viewer identifiers and raw private responses are excluded from
diagnostics.

## Incoming Poke Flags

The incoming "poked you!" flag reads official Remilia notifications through the
same account connection. Notification response bodies are never persisted.
Local read state contains at most 500 opaque SHA-256 event keys with read
timestamps and 90-day retention; the former incoming-poke payload cache is
removed. Poke diagnostics store only operation, success, timestamp, bounded
status/category/code, and cooldown source—never target handle, URL, token,
header, or raw body.

## RemiNet Chat

RemiNet Chat is off by default. When enabled, official API-v1 REST history and
text/reply posting are the source of truth. A temporary legacy WebSocket adapter
at `wss://www.remilia.net/api/ws` can accelerate live updates, and a separately
typed temporary legacy adapter can upload/confirm media through fixed
`https://www.remilia.net/media/upload/` and `/media/upload/confirm` endpoints
after the user selects it. The trusted background supplies the delegated token;
browser cookies/credentials are omitted, redirects are rejected, and no
referrer is sent. Inline media follows the same boundary and its final URL is
revalidated against the media allowlist. REST history and text
posting must remain usable without the socket; an upload failure must not send
unconfirmed media or expose local paths, credentials, or private bodies, and
the pending attachment remains available for user-controlled retry.
The legacy `/api/chats/1/messages` history route and public socket-preparation
message are removed; the socket supplies body-free reconciliation hints only.

## RemiStats Images

RemiStats may show profile images from pfp.remilia.net in tooltips and Milady Maker NFT banner images from miladymaker.net/banners/nft on profile surfaces. These are image-only requests. Milady Maker banner fetches are routed through the extension background allowlist and do not include account credentials or cookies.

## Miladychan Portal

Miladychan Portal is a docked reader for public Miladychan board, thread, post, and media metadata over HTTPS. For an explicitly confirmed board or thread, it can submit a text-only post to the fixed native create-thread or create-reply endpoint with credentials omitted. The visible poster-name field defaults to the `milXdy` pseudonym and can be changed or cleared before submission; it is never derived from a Miladychan browser session, RemiNet login, cookies, tokens, wallet, X/Twitter, or extension identity. The portal does not upload media, saves failed posts plus user-selected watched-thread IDs/titles and local seen/latest post counts, and keeps native Miladychan links for CAPTCHA, session, media, unsupported-board, and full-board behavior. Watching does not poll, notify, sync, or make background requests; counts update only when the user opens or refreshes the Portal.

## Music

Music indexes only local folders the user chooses through the browser folder picker. Indexed metadata, playlists, radio sessions, ISRC candidates, folder handles, and enrichment settings are stored locally in extension storage or IndexedDB. Playlist and radio QR exports contain metadata such as title, artist, ISRC, playlist name, and start time; they do not include audio files.

MusicBrainz lookup sends track metadata needed for candidate search. AcoustID lookup is disabled unless the user provides a client key; when enabled, milXdy may send audio fingerprints or metadata to AcoustID for matching.

## Local Persistence

Settings persist while the browser keeps the same extension identity and local
storage. Remilia credentials and connected state are session-only and end with
the browser session. Removing the extension, loading a different unpacked
identity, clearing extension storage, or browser profile cleanup can reset
other local state.

The Add-ons settings tab stores a user-selected `local-app-packages` directory
handle in extension IndexedDB when the browser allows it. Scanning is
read-only and reports only top-level `.zip` filenames, sizes, and modification
dates in the settings UI. Folder access requires an explicit picker choice and
can be revoked through browser site or extension storage controls. ZIP contents
are not uploaded or passed through the public catalog bridge.

## Official And Legacy Remilia Coverage

Official API v1 covers public/connected profiles, stats, notifications, pokes,
Beetle state/cards, global chat REST history/text posting, and directory
resolution/listing. The only temporary legacy adapters are RemiNet realtime,
RemiNet media upload/confirm, and Beetle actions such as hunt, craft, and trophy
flows that have no documented API-v1 equivalent. Each adapter is separately
classified, bounded, redacted, independently disableable, and removed when an
official documented endpoint reaches parity. The unauthenticated public
`api.remistats.net/user/{x-handle}` badge/profile lookup is also separately
labeled legacy coverage because delegated `/me/stats` is connected-user-only;
it receives no Remilia credential. See the
[contributor migration contract](../contributors/REMILIA_API_MIGRATION.md).
