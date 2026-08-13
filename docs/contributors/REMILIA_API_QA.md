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
- Firefox is an intentional compatibility target, not an authenticated Remilia
  Login target in 0.2.5. Its keyless production profile has no identity client
  or registered callback. Evidence uses the packaged Firefox candidate from the
  exact same source commit and proves graceful `UNSUPPORTED` status, no retired
  fallback/leakage, and unaffected non-auth behavior.
- Use `blocked` only for a confirmed upstream/browser limitation with a linked
  public disposition. `pending` and `blocked` do not satisfy live acceptance.

## Complete Chromium Beta Matrix

| ID | Behavior | Chromium beta | Required observation |
| --- | --- | --- | --- |
| `migration-prompt` | Existing browser-session installation | Required | One-time prompt; explicit **Delete old login data** removes known legacy auth and ends disconnected; deletion does not connect; unrelated settings remain |
| `connect-pkce` | Connect and callback validation | Required | Visible Remilia consent; exact callback; success returns connected identity; cancel/deny stays disconnected |
| `connect-fail-closed` | State, redirect, code, timeout, and concurrent-login failures | Required | Mismatch/replay/timeout fails closed without credential or log leakage |
| `scope-status` | Granted and missing abilities | Required | Granted scopes are understandable; missing scope is distinct and reconnectable |
| `disconnect-revoke` | Disconnect, local revoke, remote failure | Required | Credentials clear; unrelated settings remain; no cookie-auth rollback |
| `restart-refresh` | Worker/browser restart and token rotation | Required | Worker suspension preserves session custody; full browser restart ends credentials and returns explicit reconnect state; no hidden tab/session fallback |
| `public-profile` | Public profile read | Required | Tokenless profile succeeds; unknown profile is a bounded not-found result |
| `connected-profile` | Connected `/me` profile | Required | Own profile loads with no credential exposed outside background |
| `directory-resolution` | Remilia, X, GitHub, Discord resolution and batching | Required | 1/50/>50 inputs, misses, duplicates, handle changes, cache expiry are deterministic |
| `stats` | Account statistics | Required | Stats load with granted scope; missing scope/offline/expired states remain distinct |
| `notifications` | Notification paging and incoming poke state | Required | One-based limit-50 paging stops by 100 pages; opaque dedupe ordering is stable; only ≤500 opaque read keys/90-day timestamps persist; private payload absent from storage/diagnostics |
| `poke-cooldown` | Poke success and cooldown | Required | Success invents no timer; `next_allowed_at`/`Retry-After` controls cooldown; prior unexpired deadline is visibly `offline-fallback` only after network/timeout |
| `beetle-reads` | Beetle state and cards | Required | Ready, cooldown, exhausted, and partial responses normalize without invented values |
| `beetle-legacy-actions` | Catch/hunt/claim/faucet/craft/trophy adapters | Required | UI labels legacy failure separately; official reads still work when an adapter is unavailable |
| `chat-history-post` | REST history, older paging, replies, edits, media metadata, text post | Required | Ordering/deduplication correct; 8,192-byte and two-second limits enforced |
| `chat-reconnect` | Visibility polling, offline, restart | Required | Polls never overlap; reconnect/restart restores REST source of truth |
| `chat-legacy-realtime` | WebSocket disabled/failing | Required | REST history and text posting continue; socket is acceleration only |
| `chat-legacy-media` | Media upload/confirm failure | Required | No unconfirmed message/media send; error/log contains no path, token, or private body |
| `post-factory-isolation` | Reviewed package capability use | Required | Public-profile declaration works; raw router has no production response; sender/document/package/grant mismatch fails; write requires active per-invocation gesture; recursive credential isolation and composer trust gates reject bypasses |
| `error-separation` | 401, 403 scope, 403 user, 429 cooldown/rate, offline | Required | Each state has distinct accessible UI and redacted diagnostics |
| `keyboard-screen-reader` | Connection and migration UI accessibility | Required | Keyboard order, focus, names, live status, dark/forced color behavior remain usable |

## Firefox Compatibility Matrix

| ID | Required observation |
| --- | --- |
| `firefox-no-client` | Manifest/profile is keyless and contains no Remilia Login identity permission, client JSON, or registered callback claim |
| `firefox-unsupported-ui` | Connection status is normalized `UNSUPPORTED`; neutral **Remilia connection is unavailable in Firefox** state explains the keyless build and hides consent plus all connection actions without an alert |
| `firefox-no-fallback` | No cookie/session adoption, hidden tab, legacy token restore, or silent website-session reuse occurs |
| `firefox-no-token-leakage` | Source, storage surfaces, logs, diagnostics, DOM/content/package messages, and packaged artifacts expose no credential or authorization material |
| `firefox-public-profile` | Tokenless official public profile behavior remains usable or fails as a bounded network result independent of authenticated login support |
| `firefox-non-auth` | Existing Firefox-supported non-auth apps and X/Twitter behavior still load; temporary add-on reload is not described as account reconnect |
| `firefox-build` | Firefox build, lint, manifest/data-collection checks, package checksums, reproducibility, and deterministic artifact scan pass from the integrated commit |

## Automated And Artifact Evidence

Before the manual matrix can be finalized, run from the integrated candidate:

```powershell
npm.cmd ci
npm.cmd run verify:release:gates
npm.cmd run verify:remilia-migration:live
```

The release gate builds Chromium beta and Firefox production, runs Firefox lint and shared
contracts, packages both deterministic archives, scans extracted archive
contents for credential and machine-specific leakage, verifies checksums, and
repackages twice to prove reproducibility. Preserve command output with the
release record; do not commit local paths or private browser data.
