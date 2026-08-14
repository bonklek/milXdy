# Remilia API Migration Contract

milXdy 0.2.5 moves supported RemiliaNET behavior to the documented API v1 and
Remilia Login public-client flow. This document is the contributor source of
truth for official coverage, temporary legacy adapters, credential custody,
package restrictions, and removal conditions.

Official references:

- [Endpoints](https://docs.remilia.net/api/endpoints)
- [Scopes](https://docs.remilia.net/api/scopes)
- [Login quickstart](https://docs.remilia.net/guide/authentication)
- [API quickstart](https://docs.remilia.net/guide/getting-started)

## Trusted Host Boundary

The extension background is the credential-owning host. Access/refresh/ID
tokens, expiry, connected identity, and granted scopes live only in trusted
`chrome.storage.session`; token-free control, migration, and error metadata may
use local storage. It performs OIDC
discovery, PKCE authorization, code exchange, refresh rotation, logout/revoke,
scope checks, and authenticated API requests. Bearer tokens, refresh tokens,
authorization codes, PKCE verifiers, and OIDC state must not cross into page
DOM, content scripts, local packages, App SDK context, exported settings,
profile packs, diagnostics, or logs.

Auth status is privileged account metadata even when token-free. An
unauthorized sender must be rejected before status lookup and receive only a
generic bounded error—never connected identity, granted/missing scopes,
migration details, or other auth state.

OIDC discovery, token, JWKS, and revocation/logout HTTP requests are pinned to
their allowed endpoint classes, reject redirects, and send no referrer. A 3xx
response is a hard failure; authorization codes, refresh/revocation material,
or trust-bootstrap data must never follow a redirect.

The official API client accepts only fixed API-v1 route classes. It injects the
bearer token in the trusted background, makes at most one refresh retry after an
authentication failure, preserves `insufficient_scope`, `requires_user`,
cooldown, and rate-limit errors as distinct outcomes, and rejects arbitrary
authenticated URLs. Background-owned services may import the trusted client
singleton directly. Its raw runtime route is not a content-script, page, App
SDK, or local-package API.

Chromium beta owns the public Remilia Login client and stable callback identity.
The Firefox production profile is intentionally keyless and has no login client
or registered callback in 0.2.5. Firefox must return normalized `UNSUPPORTED`
without displaying auth actions or falling back to retired browser-session
mechanisms; tokenless public and unrelated non-auth behavior remain available.

## Official Coverage

All official paths are relative to `https://www.remilia.net/api/v1`.

| Capability | Official endpoint | Required grant | Source of truth |
| --- | --- | --- | --- |
| Public profile | `GET /users/{username}` | Public | API v1 |
| Connected profile | `GET /me` | Any user token (`openid` is protocol-only) | API v1 |
| Account statistics | `GET /me/stats` | `remilia:stats.read` | API v1 |
| Notifications | `GET /me/notifications?limit=50&page=N` | `remilia:notifications.read` | API v1 |
| Beetle state and cards | `GET /me/beetle`, `GET /me/beetle/cards` | `remilia:beetle.read` | API v1 |
| Poke | `POST /users/{handle}/poke` | `remilia:pokes.write` | API v1 |
| Chat history | `GET /global-chat/messages` | `remilia:chat.read` | API v1 |
| Chat text/reply post | `POST /global-chat/messages` | `remilia:chat.write` | API v1 |
| Directory resolve/list | `POST /directory/resolve`, `GET /users` | `remilia:directory.read` | API v1 |

API-v1 cooldowns, cursors, paging, and `next_allowed_at` are authoritative.
Local cooldown or read-state data is only a labeled offline presentation
fallback and must never override a newer service response.

Notification paging is one-based with `limit=50` and a hard 100-page bound;
non-advancing/excess pagination fails as `invalid_response`. Duplicate events
use opaque SHA-256 keys and deterministic newest-first ordering, with a
server-read duplicate winning. No notification body is persisted: local read
state is limited to 500 opaque keys with timestamps and 90-day retention.

Poke success does not invent a cooldown. Only a normalized
`429 poke_cooldown` deadline from `next_allowed_at` (preferred) or
`Retry-After` becomes authoritative. After network/timeout failure, an
unexpired prior authoritative deadline may disable the target only as a
visible `offline-fallback`; missing or expired state never fabricates history.

Directory resolution sends at most 50 identifiers per wire request while
preserving ordered logical results and deduplicating repeated inputs. Positive
results cache for six hours; explicit misses cache for 15 minutes, bounded to
600 entries per cache (300 public-profile misses). Transport failures, omitted
results, invalid payloads, and conflicting duplicates are never negative
cached. An authoritative handle rebind replaces stale identity association
without corrupting the former Remilia-handle record. Returned profile context
may include normalized `friendsDisplayed`, `viewerContext`, and `connections`;
raw service responses and viewer identifiers remain outside diagnostics.

## Temporary Legacy Adapters

Legacy means “not present in the published API-v1 endpoint contract.” A legacy
adapter must be typed, separately named, independently disableable, origin and
sender validated, size/time bounded, redacted, and incapable of masquerading
as an API-v1 response.

| Adapter | Why retained | Required fallback | Removal condition |
| --- | --- | --- | --- |
| RemiNet WebSocket acceleration at `wss://www.remilia.net/api/ws` | API v1 documents REST history and posting, not realtime delivery | REST history/polling and text posting remain functional with the socket disabled; reconnect/worker restart requests official REST reconciliation | Remove only after an official scoped stream covers deliver/edit/delete/reaction, passes reconnect, worker-restart, payload, and privacy parity, then ships one release cycle with the legacy adapter disabled by default |
| RemiNet media upload/confirm at `https://www.remilia.net/media/upload/` and `https://www.remilia.net/media/upload/confirm` | API v1 documents media metadata on reads but not upload/confirm | Background injects the delegated token; browser credentials are omitted; redirects are rejected with no referrer; text/reply posting remains functional; failed upload sends no message or undisclosed media and preserves the pending attachment for retry | Remove after official scoped upload plus media-bearing post (or an explicit official unsupported declaration), type/size/timeout/retry/privacy/confirmation parity, and tests proving pending attachments survive failure with no callers of legacy upload, confirm, or media-socket submit |
| `catchBeetle`, `beetleHunt`, `claimUBC`, and `junkFaucet` actions | API v1 documents Beetle state/cards reads but not these user actions | Official state/cards remain functional and identify each legacy failure separately | Remove each adapter when API v1 documents an equivalent user-delegated operation and milXdy ships and live-verifies it |
| Beetle `craft` | API v1 does not document equivalent user-delegated crafting | Official state/cards remain functional; craft failures are typed and separate | Remove when API v1 documents equivalent user-delegated craft including per-recipe failures and parity QA passes |
| Public trophy shelf read | API v1 does not document a public shelf asset/read | Official state/cards remain functional; banner mode is independently removable | Remove when API v1 provides the documented public shelf asset/read, or remove banner mode if the legacy image endpoint retires |
| Public RemiStats X badge/profile lookup at `https://api.remistats.net/user/{x-handle}` | Official delegated `/me/stats` describes only the token user, not arbitrary visible X accounts | Request is unauthenticated and separately labeled; no Remilia credential enters the request | Remove when an official documented public lookup covers equivalent arbitrary-user badge/profile data and parity QA passes, or retire the badge surface |

Beetol content receives only token-free `beetol:authStatus`. When disconnected,
it passively directs the user to open the milXdy extension popup and use
**Remilia connection → Connect/Reconnect**; it never opens RemiliaNET, adopts a
website session, or invokes disconnect/logout. Retired `beetol:logout`,
`beetol:sessionStatus`, and retry-session routes are not registered. Legacy
Beetle mutations retry at most once after the first HTTP 401, never refresh on
403, and never clear the trusted connection after an action failure. Their
fixed background fetches use `credentials: "omit"`, `redirect: "error"`, and
`referrerPolicy: "no-referrer"`, then require the final response URL to equal
the fixed requested endpoint.

Official API-v1 REST is the only chat history authority. The retired legacy
`/api/chats/1/messages` history handler and public socket-preparation runtime
message are not registered fallback routes. The retained socket carries only
validated, body-free reconciliation hints; it does not supply message history.
Inline media fetches use the same no-cookie/no-redirect/no-referrer boundary and
revalidate the final URL against the fixed media allowlist before accepting
bytes. Page context cannot widen the upload, confirmation, or media-read hosts.

Browser-session adoption, cookie mutation, hidden-tab refresh, and silent
session reuse are removed migration mechanisms, not retained legacy adapters.
No rollback switch may restore them.

Post-reading's optional direct public-HTML fallback is also credentialless. In
the host source and emitted bundle it preserves the exact fetch boundary:
`credentials: "omit"`, `redirect: "error"`, `referrerPolicy: "no-referrer"`,
the caller's abort signal, HTTP-status rejection, and the existing
`response.text()` read. The external sdk.4 package remains byte-unchanged and
fail-closed without runtime messaging.

Explicit `completeMigration` deletes the four known legacy token keys and ends
disconnected. Status reads do not silently delete or adopt credentials.

## App SDK Capability Broker

Reviewed packages request typed Remilia capabilities from the host; they do not
receive OAuth primitives or authenticated fetch. The broker covers profile,
directory, stats, notifications, poke, Beetle, and chat operations exposed by
the installed host version. It is the sole production Remilia API path for
content and package principals; those principals must not call
`remiliaApi:request` directly.

Every broker call must validate:

- same-extension sender and expected execution surface;
- package identity and installed composition identity;
- declared capability and data-use metadata;
- user consent/grant and the endpoint's delegated scope;
- fixed route class, normalized input, output bounds, and cancellation.

| Capability | Allowed operations | Exact delegated scopes | Consent |
| --- | --- | --- | --- |
| `remilia.profile.public` | `getUserProfile` | None | Enablement |
| `remilia.profile.me` | `getMe` | None | Enablement |
| `remilia.directory.read` | `resolveDirectory`, `listDirectoryUsers` | `remilia:directory.read` | Enablement |
| `remilia.stats.read` | `getMyStats` | `remilia:stats.read` | Enablement |
| `remilia.notifications.read` | `listMyNotifications` | `remilia:notifications.read` | Enablement |
| `remilia.pokes.write` | `pokeUser` | `remilia:pokes.write` | Per invocation with active user gesture |
| `remilia.beetle.read` | `getMyBeetle`, `getMyBeetleCards` | `remilia:beetle.read` | Enablement |
| `remilia.chat.read` | `listGlobalChatMessages` | `remilia:chat.read` | Enablement |
| `remilia.chat.write` | `postGlobalChatMessage` | `remilia:chat.write` | Per invocation with active user gesture |

Declarations contain an exact capability ID, operation subset, official scope
set, fixed consent mode, and bounded reason. Reviewed-local composition also
requires reviewed status, `privacy.consentRequired`, a remote-API label,
credential-isolation disclosure, and explicit package-consent acknowledgement.
Grants are opaque 32-hex values bound to sender document/tab, package,
composition identity, and declaration fingerprint; they expire within 12 hours
and are revoked on disable/dispose.

Production registration installs the capability broker over the shared client,
not the raw API router. Calls require the same extension, a top-frame numeric
tab, exact HTTPS X/Twitter origin, document binding where available, exact
grant/package/declaration/scope match, and an active gesture for per-invocation
writes. Raw routes/scopes/tokens and extra parameters fail closed.

Packages may receive normalized capability results and redacted error classes.
They may not request tokens, cookies, authorization headers, arbitrary URLs,
raw private responses, credential storage, login callbacks, or a generic
authenticated proxy. A package that lacks a declaration, grant, scope, or
recognized sender fails closed before a network request.

Broker-only errors are stable and bounded: `invalid_request`,
`unauthorized_sender`, `package_not_reviewed`, `consent_required`,
`package_not_granted`, `grant_revoked`, `capability_not_declared`,
`operation_not_declared`, `scope_mismatch`, `credential_isolation`, and
`client_unavailable`. Recursive isolation rejects access/refresh tokens,
Authorization/Bearer values, cookies/Set-Cookie, credentials, and client
secrets. Composer trust gates treat direct fetch/XHR/WebSocket/runtime
messaging and OAuth/token/cookie/credentialed-fetch material as unacknowledgeable
errors, not warnings a user can override.

## Change And Review Rules

- Update this table when official Remilia documentation adds, removes, or
  changes an endpoint or scope.
- Add fixtures for every documented success envelope and error class used by
  milXdy.
- Keep legacy adapter tests and privacy notes adjacent to their implementation.
- Run `npm.cmd run verify:remilia-migration` for static contracts and
  `npm.cmd run verify:remilia-migration:live` only when the committed browser
  evidence record is complete.
- Run the full release gate from the committed integrated release candidate;
  a task-worktree build or transient QA overlay is not release evidence.
