# milXdy 0.2.5 Release Notes

**Candidate status:** This is candidate copy for milXdy `0.2.5` — **Speaking
Special**. It is not a published release or a download claim; the latest
published release is 0.2.4. The statements below describe candidate scope that
still requires the recorded release acceptance evidence.

## Download and compatibility

- Candidate Chromium archives use `milXdy-0.2.5-chromium.zip`, built from the
  authenticated Chromium beta profile with the registered Remilia Login
  callback.
- Candidate Firefox and Waterfox archives use `milXdy-0.2.5-firefox.zip`. That build
  remained intentionally keyless: authenticated Remilia features reported an
  unsupported state and did not fall back to cookies or a website session.
- milXdy remained an unpacked GitHub beta. Lite, Balanced, and Full remained
  setup choices inside the extension, not separate downloads.

Publish checksums only with the accepted release archives. Earlier candidate
hashes do not identify a build containing subsequent remediation changes.

See [Install and update](https://github.com/bonklek/milXdy/blob/main/docs/getting-started/INSTALL_AND_UPDATE.md)
for the browser-specific installation and safe-update steps.

## Official Remilia account connection

- Replaced browser-session adoption, cookie mutation, hidden-tab refresh, and
  silent session reuse with the official public Remilia Login client and OIDC
  Authorization Code with PKCE S256.
- Kept authorization codes, PKCE material, access and refresh tokens, and
  authenticated requests inside trusted extension background code. Content
  scripts, pages, local packages, exported settings, profile packs, and
  diagnostics received no credentials.
- Stored the connected identity, granted scopes, tokens, and expiry only in
  trusted `chrome.storage.session`. Worker suspension preserved the connection;
  ending the browser session or reloading the extension cleared it and required
  an explicit reconnect.
- Added a one-time migration prompt for existing installations. Legacy
  credentials were removed, ordinary settings remained, and the user stayed
  disconnected until choosing Connect.
- Added visible Connect, ability status, Reconnect, Disconnect, and local or
  remote revoke controls with distinct cancellation, expiry, missing-scope,
  rate-limit, cooldown, offline, and revocation states.

## Official API v1 coverage

- Moved public and connected profiles plus Remilia, X, GitHub, and Discord
  identifier resolution to official API-v1 services.
- Moved RemiStats, notifications, pokes, Beetle state and cards, global chat
  history, and global chat text and reply posting to typed, delegated API-v1
  operations.
- Treated service paging, cursors, posting limits, cooldowns, and
  `next_allowed_at` as authoritative. Local read and cooldown state remained a
  labeled offline presentation fallback.
- Added a scope-gated background API client with fixed route classes,
  timeout and abort handling, one refresh retry after the first 401, distinct
  403 and rate-limit behavior, redirect rejection, no-referrer requests, exact
  final-URL validation, and redacted diagnostics.

## Official and temporary legacy behavior

The candidate uses a temporary dual-auth holdover: milXdy connects through
Remilia Login for supported API features, while native Hunt, Claim, and Craft
continue on the visible RemiliaNET website under its separate sign-in.
Connecting or disconnecting milXdy does not establish or end that website
session. Settings place both paths under **RemiNet → Account access**, ahead
of the feature controls. New API endpoints are required to retire these native
website actions, not to use this documented holdover. Browser acceptance of
the existing paths remains required before publication.

- Made official REST history and text or reply posting RemiNet Chat's source of
  truth. The WebSocket remained a temporary acceleration adapter, and chat
  remained usable when it was unavailable.
- Kept media upload and confirmation in a separately typed temporary adapter
  until an official API can match its consent, validation, size-limit, and
  confirmation behavior.
- Made Beetle state and card reads official. Hunt, craft, trophy, and other
  undocumented actions remained labeled temporary adapters with explicit
  removal conditions.
- Removed retired website-session authentication as a fallback. Beetol used
  token-free status polling and directed disconnected users to the extension
  popup for Connect or Reconnect.

## Reader Voice and audio export

- Added native X Article extraction and read-aloud behavior while preserving
  the existing Post-reading review and highlighting model.
- The external Post-reading package defines DM read-aloud acceptance. The base
  reader does not claim DM conversation support. Where browser Web Speech is
  used, milXdy bypasses custom HTTP TTS; the selected browser voice may be local
  or remote, so this is not a guarantee that speech remains on-device.
- Added review-first long-form audio export in the external Post-reading
  package. Users could edit extracted text and metadata, select the configured
  local-loopback TTS path, cancel active work, download labeled audio format
  fallbacks, and keep a JSON sidecar with the source details.
- Hardened the built-in full-quote fallback with credential omission, redirect
  rejection, no-referrer requests, caller cancellation, HTTP status failure,
  and the existing response-text read.

## Share Kit and Post-Factory

- Added Unicode-aware post, quoted-post, and link-card layout with exact-pinned
  Pretext 0.0.8 and the same TwitterChirp fallback stack used for Canvas output.
- Added local rich-text editing with bullets, bold, italic, strikethrough,
  combined styles, clear and reset controls, keyboard shortcuts, accessible
  labels, and one reviewed blob shared by preview, copy, download, and RemiNet
  staging.
- Added explicit Remibooru contribution for a visible X-hosted image selected
  from the context menu. The host retained the image behind a one-use,
  short-lived opaque handle, while Post-Factory received only the handle and
  user-reviewed tags.
- Kept the public destination visible and retained Remibooru's native uploader
  as the fallback whenever browser verification, contributor access, format,
  size, or service availability prevented direct contribution.

## Multi-site runtime and package safety

- Added site-aware runtime declarations and fail-closed sender, frame, route,
  and host boundaries for X/Twitter, RemiliaNET, Remilia Wiki, and Miladychan
  surfaces without broadening X-only privileged operations.
- Added a host-owned Remilia capability broker for reviewed profile, directory,
  stats, notifications, poke, Beetle, and chat operations.
- Validated package identity, composition, declarations, user consent, scope,
  sender, route class, and input bounds before privileged work.
- Made brokered capabilities the sole production Remilia API path for content
  and packages. Packages received no OAuth controls, tokens, cookies, raw
  private responses, or authenticated arbitrary fetch.
- Added support for reviewed custom compositions containing Post-reading,
  Post-Factory, and Share Kit. These external packages are not included in the
  standard browser archives; package-specific features require a separately
  reviewed custom build.

## Remilia Maker pet import

- Completed the companion import adapter for Pets Maker exports and shipped it
  as a non-web-accessible user download in the extension.
- Added versioned Milady, Remilio, Bonkler, and Kagami motion-template
  selection with explicit registration, landmark, phase, loop, region,
  envelope, threshold, and sixteen-direction contracts.
- Added deterministic family QA, actionable diagnostics, privacy-preserving
  cache and resume behavior, interrupted-run recovery, and a reproducible
  packaged skill archive with duplicate and unsafe-path rejection.

See [Remilia Maker pet import](https://github.com/bonklek/milXdy/blob/main/docs/guides/remilia-maker-pet-import.md)
and [Custom Pet integrated QA](https://github.com/bonklek/milXdy/blob/main/docs/guides/custom-pet-integrated-qa.md)
for the local workflow and evidence boundary.

## Release integrity and privacy

- Added deterministic Chromium and Firefox archives, exact checksums, and
  reproducibility checks from a clean lockfile install.
- Added package provenance, consent, trust, composition, and sensitive-surface
  gates for the reviewed external packages.
- Added source and extracted-archive scans for credentials, private keys,
  machine-specific paths, retired session-login behavior, and unauthorized
  package or content-script auth routes.
- Updated account, installation, privacy, troubleshooting, RemiStats, Beetol,
  RemiNet Chat, contributor, App SDK, roadmap, and release documentation to
  match the shipped behavior.

## Outstanding candidate acceptance

- The current Pets Maker source and its catalog trust record disagree. Catalog
  Prepare/Apply rejects this candidate with `selection-package-mismatch`;
  reconcile the reviewed package and recorded hash before release.
- The 29 Chromium/Firefox migration cases have no recorded live acceptance for
  the final candidate. Automated tests do not establish account/browser acceptance.
- The bundled Chromaprint engine still requires completion of the provenance
  review described in `THIRD_PARTY_NOTICES.md`.

## Known boundaries

- milXdy remained an unpacked GitHub beta rather than a Chrome Web Store or
  Firefox Add-ons package.
- Firefox remained keyless for Remilia Login. Public and non-authenticated
  behavior remained available, but authenticated parity was not advertised.
- Temporary RemiNet realtime/media and Beetle action adapters remained only
  where the published API v1 did not provide an equivalent.
- Ending the browser session or reloading or disabling the extension cleared
  the Remilia connection; reconnecting remained explicit.

The public account guide is [Connect a Remilia account](https://github.com/bonklek/milXdy/blob/main/docs/getting-started/REMILIA_ACCOUNT.md).
The official-versus-temporary API contract is documented in
[Remilia API migration](https://github.com/bonklek/milXdy/blob/main/docs/contributors/REMILIA_API_MIGRATION.md).
