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
| Notifications | `GET /me/notifications` | `remilia:notifications.read` | API v1 |
| Beetle state and cards | `GET /me/beetle`, `GET /me/beetle/cards` | `remilia:beetle.read` | API v1 |
| Poke | `POST /users/{handle}/poke` | `remilia:pokes.write` | API v1 |
| Chat history | `GET /global-chat/messages` | `remilia:chat.read` | API v1 |
| Chat text/reply post | `POST /global-chat/messages` | `remilia:chat.write` | API v1 |
| Directory resolve/list | `POST /directory/resolve`, `GET /users` | `remilia:directory.read` | API v1 |

API-v1 cooldowns, cursors, paging, and `next_allowed_at` are authoritative.
Local cooldown or read-state data is only a labeled offline presentation
fallback and must never override a newer service response.

## Temporary Legacy Adapters

Legacy means “not present in the published API-v1 endpoint contract.” A legacy
adapter must be typed, separately named, independently disableable, origin and
sender validated, size/time bounded, redacted, and incapable of masquerading
as an API-v1 response.

| Adapter | Why retained | Required fallback | Removal condition |
| --- | --- | --- | --- |
| RemiNet WebSocket acceleration at `wss://www.remilia.net/api/ws` | API v1 documents REST history and posting, not realtime delivery | REST history/polling and text posting remain functional with the socket disabled; reconnect/worker restart requests official REST reconciliation | Remove only after an official scoped stream covers deliver/edit/delete/reaction, passes reconnect, worker-restart, payload, and privacy parity, then ships one release cycle with the legacy adapter disabled by default |
| RemiNet media upload/confirm at `https://www.remilia.net/media/upload/` and `https://www.remilia.net/media/upload/confirm` | API v1 documents media metadata on reads but not upload/confirm | Text/reply posting remains functional; failed upload sends no message or undisclosed media and preserves the pending attachment for retry | Remove after official scoped upload plus media-bearing post (or an explicit official unsupported declaration), type/size/timeout/retry/privacy/confirmation parity, and tests proving pending attachments survive failure with no callers of legacy upload, confirm, or media-socket submit |
| `catchBeetle`, `beetleHunt`, `claimUBC`, and `junkFaucet` actions | API v1 documents Beetle state/cards reads but not these user actions | Official state/cards remain functional and identify each legacy failure separately | Remove each adapter when API v1 documents an equivalent user-delegated operation and milXdy ships and live-verifies it |
| Beetle `craft` | API v1 does not document equivalent user-delegated crafting | Official state/cards remain functional; craft failures are typed and separate | Remove when API v1 documents equivalent user-delegated craft including per-recipe failures and parity QA passes |
| Public trophy shelf read | API v1 does not document a public shelf asset/read | Official state/cards remain functional; banner mode is independently removable | Remove when API v1 provides the documented public shelf asset/read, or remove banner mode if the legacy image endpoint retires |

Browser-session adoption, cookie mutation, hidden-tab refresh, and silent
session reuse are removed migration mechanisms, not retained legacy adapters.
No rollback switch may restore them.

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

Packages may receive normalized capability results and redacted error classes.
They may not request tokens, cookies, authorization headers, arbitrary URLs,
raw private responses, credential storage, login callbacks, or a generic
authenticated proxy. A package that lacks a declaration, grant, scope, or
recognized sender fails closed before a network request.

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
