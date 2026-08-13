# Remilia API Migration QA

This matrix is the manual acceptance contract for the 0.2.5 Remilia migration.
The machine-readable results live in
[`docs/evidence/remilia-api-migration/qa-results.json`](../evidence/remilia-api-migration/qa-results.json).
A successful build, lint run, or archive scan does not change a manual row to
pass. Record only observed results from the exact integrated candidate.

## Evidence Rules

- Record browser/version, extension build identity, source commit, UTC time,
  tester, and a redacted note for every run.
- Never record handles, messages, tokens, callback codes, notification bodies,
  private media, local paths, cookies, or account identifiers.
- Chromium evidence uses the one cumulative QA extension after **Running** and
  **On disk** identities match.
- Firefox evidence uses the packaged Firefox candidate loaded from the exact
  same source commit. Temporary-add-on restart behavior must be described rather
  than mistaken for extension credential loss.
- Use `blocked` only for a confirmed upstream/browser limitation with a linked
  public disposition. `pending` and `blocked` do not satisfy live acceptance.

## Complete Browser Matrix

| ID | Behavior | Chromium | Firefox | Required observation |
| --- | --- | --- | --- | --- |
| `migration-prompt` | Existing browser-session installation | Required | Required | One-time prompt; no silent connection; legacy auth removed; unrelated settings preserved |
| `connect-pkce` | Connect and callback validation | Required | Required | Visible Remilia consent; exact callback; success returns connected identity; cancel/deny stays disconnected |
| `connect-fail-closed` | State, redirect, code, timeout, and concurrent-login failures | Required | Required | Mismatch/replay/timeout fails closed without credential or log leakage |
| `scope-status` | Granted and missing abilities | Required | Required | Granted scopes are understandable; missing scope is distinct and reconnectable |
| `disconnect-revoke` | Disconnect, local revoke, remote failure | Required | Required | Credentials clear; unrelated settings remain; no cookie-auth rollback |
| `restart-refresh` | Worker/browser restart and token rotation | Required | Required | Grant refreshes in trusted host or returns explicit reconnect state; no hidden tab |
| `public-profile` | Public profile read | Required | Required | Tokenless profile succeeds; unknown profile is a bounded not-found result |
| `connected-profile` | Connected `/me` profile | Required | Required | Own profile loads with no credential exposed outside background |
| `directory-resolution` | Remilia, X, GitHub, Discord resolution and batching | Required | Required | 1/50/>50 inputs, misses, duplicates, handle changes, cache expiry are deterministic |
| `stats` | Account statistics | Required | Required | Stats load with granted scope; missing scope/offline/expired states remain distinct |
| `notifications` | Notification paging and incoming poke state | Required | Required | Paging/deduplication stable; only local read state persists; private payload absent from diagnostics |
| `poke-cooldown` | Poke success and cooldown | Required | Required | API response controls cooldown/`next_allowed_at`; no assumed fixed local duration |
| `beetle-reads` | Beetle state and cards | Required | Required | Ready, cooldown, exhausted, and partial responses normalize without invented values |
| `beetle-legacy-actions` | Hunt/craft/trophy/action adapters | Required | Required | UI labels legacy failure separately; official reads still work when adapter is unavailable |
| `chat-history-post` | REST history, older paging, replies, edits, media metadata, text post | Required | Required | Ordering/deduplication correct; 8,192-byte and two-second limits enforced |
| `chat-reconnect` | Visibility polling, offline, restart | Required | Required | Polls never overlap; reconnect/restart restores REST source of truth |
| `chat-legacy-realtime` | WebSocket disabled/failing | Required | Required | REST history and text posting continue; socket is acceleration only |
| `chat-legacy-media` | Media upload/confirm failure | Required | Required | No unconfirmed message/media send; error/log contains no path, token, or private body |
| `post-factory-isolation` | Reviewed package capability use | Required | Required | Approved broker operation works; package cannot obtain token/cookie/raw authenticated fetch |
| `error-separation` | 401, 403 scope, 403 user, 429 cooldown/rate, offline | Required | Required | Each state has distinct accessible UI and redacted diagnostics |
| `keyboard-screen-reader` | Connection and migration UI accessibility | Required | Required | Keyboard order, focus, names, live status, dark/forced color behavior remain usable |

## Automated And Artifact Evidence

Before the manual matrix can be finalized, run from the integrated candidate:

```powershell
npm.cmd ci
npm.cmd run verify:release:gates
npm.cmd run verify:remilia-migration:live
```

The release gate builds Chromium and Firefox, runs Firefox lint and shared
contracts, packages both deterministic archives, scans extracted archive
contents for credential and machine-specific leakage, verifies checksums, and
repackages twice to prove reproducibility. Preserve command output with the
release record; do not commit local paths or private browser data.
