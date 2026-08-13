# milXdy 0.2.5 Release Notes

milXdy `0.2.5` is the **Speaking Special** candidate release. Candidate features
listed here are not represented as shipped until the integrated Chromium and
Firefox evidence matrix, release gates, and maintainer acceptance are complete.

## Official Remilia account connection

- Replaces browser-session adoption, cookie mutation, hidden-tab refresh, and
  silent session reuse with the official public Remilia Login client and OIDC
  Authorization Code with PKCE S256.
- Keeps authorization codes, PKCE material, access/refresh tokens, and
  authenticated requests inside trusted extension background code. Content
  scripts, pages, local packages, exported settings, profile packs, and
  diagnostics receive no credentials.
- Keeps tokens, expiry, connected identity, and scopes only in trusted
  `chrome.storage.session`: worker suspension is supported, while a full browser
  restart ends the connection and requires explicit reconnect without a
  cookie/session fallback.
- Gives existing installations a one-time migration prompt. Legacy credentials
  are removed, ordinary settings remain, and the user stays disconnected until
  choosing Connect.
- Adds explicit Connect, granted-ability status, Reconnect, Disconnect, and
  local/remote revoke behavior with distinct cancellation, expiry, missing
  scope, rate-limit, cooldown, offline, and revocation states.

## Official API v1 coverage

- Uses official API-v1 public and connected profiles plus directory resolution
  for Remilia, X, GitHub, and Discord identifiers.
- Uses delegated API-v1 stats, notifications, poke, Beetle state/cards, global
  chat history, and global chat text/reply posting.
- Treats service paging, cursors, posting limits, cooldowns, and
  `next_allowed_at` as authoritative. Local read/cooldown state is only a labeled
  offline presentation fallback.
- Adds a typed, scope-gated background API client with fixed route classes,
  timeout/abort behavior, one refresh retry, rate-limit separation, and redacted
  diagnostics.

## Official versus temporary legacy behavior

- Official REST history and text/reply posting are RemiNet Chat's source of
  truth. The WebSocket remains a temporary acceleration adapter, and chat must
  remain usable when it is disabled or unavailable.
- Media upload/confirm remains a separately typed temporary adapter until a
  documented official API reaches consent, validation, size-limit, and
  confirmation parity.
- Beetle state and card reads are official. Hunt, craft, trophy, and other
  undocumented actions remain separately labeled temporary adapters with
  explicit removal conditions.
- Retired browser-session authentication is not a legacy fallback and cannot be
  restored by rollback.

## Share Kit Unicode layout candidate

- Post, quoted-post, and link-card title wrapping uses exact-pinned Pretext
  0.0.8 after the existing font wait, with the same named TwitterChirp fallback
  stack used for final Canvas drawing.
- International fixtures cover CJK punctuation, Thai/Khmer no-space text,
  Arabic and mixed bidirectional text, combining marks, emoji/ZWJ sequences,
  hard breaks, repeated whitespace, and long URLs/hashtags/handles.
- The adapter remains local-only and user-invoked, preserves layout caps and
  ellipsis contracts, and exposes positioned formatted fragments consumed by
  the separately reviewable #222 editor/state/accessibility slice.
- Share Kit now consumes that formatted-fragment seam for local post-text
  editing: bullets, bold, italic, strikethrough, combined styles, clear/reset,
  keyboard and screen-reader controls all update the reviewed PNG used by Copy,
  Download, and user-initiated sharing without persisting editor state.

## App SDK and package safety

- Adds a host-owned Remilia capability broker for reviewed profile, directory,
  stats, notifications, poke, Beetle, and chat operations.
- Validates package identity, composition, declarations, user consent, scope,
  sender, route class, and input bounds before privileged work.
- Makes brokered capabilities the sole production Remilia API path for content
  and packages; the internal raw router is not an App SDK surface.
- Does not expose OAuth, tokens, cookies, raw private responses, or
  authenticated arbitrary fetch to Post-Factory or another package.

## Migration and release evidence

- Updates installation, account migration, privacy, troubleshooting, RemiStats,
  Beetol, RemiNet Chat, contributor, SDK, roadmap, and release documentation.
- Adds one complete Chromium/Firefox migration matrix covering account
  lifecycle, profiles, directory, stats, notifications, poke cooldown, Beetle,
  chat, restart/reconnect, accessibility, and Post-Factory isolation.
- Adds a static migration contract verifier, a strict live-evidence verifier,
  and a deterministic extracted-archive scan for credentials and
  machine-specific paths.
- Records complete authenticated behavior against the stable Chromium beta
  client. Firefox compatibility verifies its intentional keyless `UNSUPPORTED`
  connection state, absence of retired fallback/leakage, and unaffected
  public/non-auth behavior.
- Final release preparation builds both browsers, runs Firefox lint, packages
  deterministic archives, verifies checksums, and reproduces both archives from
  the same integrated source tree.

The public migration guide is available at
https://github.com/bonklek/milXdy/blob/main/docs/getting-started/REMILIA_ACCOUNT.md.
The contributor coverage and removal contract is available at
https://github.com/bonklek/milXdy/blob/main/docs/contributors/REMILIA_API_MIGRATION.md.

## Candidate limitations

- milXdy remains an unpacked GitHub beta.
- Temporary RemiNet realtime/media and Beetle-action adapters remain only where
  the published API v1 has no equivalent, with the removal conditions above.
- A successful automated gate or QA build proves transport and reproducibility,
  not user-observed browser behavior. Final acceptance requires the committed
  Chromium and Firefox results for the exact integrated candidate.
