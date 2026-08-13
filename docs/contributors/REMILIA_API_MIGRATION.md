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

The extension background is the credential-owning host. It performs OIDC
discovery, PKCE authorization, code exchange, refresh rotation, logout/revoke,
scope checks, and authenticated API requests. Bearer tokens, refresh tokens,
authorization codes, PKCE verifiers, and OIDC state must not cross into page
DOM, content scripts, local packages, App SDK context, exported settings,
profile packs, diagnostics, or logs.

The official API client accepts only fixed API-v1 route classes. It injects the
bearer token in the trusted background, makes at most one refresh retry after an
authentication failure, preserves `insufficient_scope`, `requires_user`,
cooldown, and rate-limit errors as distinct outcomes, and rejects arbitrary
authenticated URLs.

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
| Connected profile | `GET /me` | User-delegated `openid` | API v1 |
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
| RemiNet WebSocket acceleration | API v1 documents REST history and posting, not realtime delivery | REST history/polling and text posting remain functional with the socket disabled | Remove when an official documented realtime API reaches parity and passes reconnect/restart QA |
| RemiNet media upload/confirm | API v1 documents media metadata on reads but not upload/confirm | Text/reply posting remains functional; failed upload sends no message or undisclosed media | Remove when an official documented upload flow covers validation, limits, consent, and confirmation |
| Beetle hunt, craft, trophy, and other actions | API v1 documents Beetle state/cards reads but not these actions | Official reads remain functional and identify legacy action failures separately | Remove each action when a documented API-v1 endpoint reaches behavior and cooldown parity |

Browser-session adoption, cookie mutation, hidden-tab refresh, and silent
session reuse are removed migration mechanisms, not retained legacy adapters.
No rollback switch may restore them.

## App SDK Capability Broker

Reviewed packages request typed Remilia capabilities from the host; they do not
receive OAuth primitives or authenticated fetch. The broker covers profile,
directory, stats, notifications, poke, Beetle, and chat operations exposed by
the installed host version.

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
