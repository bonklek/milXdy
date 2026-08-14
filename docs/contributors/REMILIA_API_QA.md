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
| `connect-fail-closed` | State, redirect, code, timeout, and concurrent-login failures | Required | Mismatch/replay/timeout fails closed; OIDC discovery/token/JWKS/revoke HTTP redirects are rejected with no referrer or credential/log leakage |
| `scope-status` | Granted and missing abilities | Required | Granted scopes are understandable; missing scope is distinct and reconnectable |
| `disconnect-revoke` | Disconnect, local revoke, remote failure | Required | Credentials clear; unrelated settings remain; no cookie-auth rollback |
| `restart-refresh` | Popup reopen, worker restart, extension reload, browser-session end, and token rotation | Required | Popup reopen and MV3 worker restart within the same browser session preserve custody; extension reload and full browser-session end expose no credential/identity and return expired/disconnected with explicit Reconnect while durable migration completion prevents a legacy prompt; no silent reconnect or retired fallback |
| `public-profile` | Public profile read | Required | Tokenless profile succeeds; unknown profile is a bounded not-found result |
| `connected-profile` | Connected `/me` profile | Required | Own profile loads with no credential exposed outside background |
| `directory-resolution` | Remilia, X, GitHub, Discord resolution and batching | Required | Ordered 1/50/>50 inputs use ≤50 wire batches; repeats dedupe; positive 6h/explicit-miss 15m caches respect 600/300 bounds; transport/omitted/invalid/conflicting results are not negative cached; authoritative handle rebind is safe |
| `stats` | Account statistics | Required | Stats load with granted scope; missing scope/offline/expired states remain distinct |
| `notifications` | Notification paging and incoming poke state | Required | One-based limit-50 paging stops by 100 pages; opaque dedupe ordering is stable; only ≤500 opaque read keys/90-day timestamps persist; private payload absent from storage/diagnostics |
| `poke-cooldown` | Poke success and cooldown | Required | Success invents no timer; `next_allowed_at`/`Retry-After` controls cooldown; prior unexpired deadline is visibly `offline-fallback` only after network/timeout |
| `beetle-reads` | Beetle state and cards | Required | Ready, cooldown, exhausted, and partial responses normalize without invented values |
| `beetle-legacy-actions` | Catch/hunt/claim/faucet/craft/trophy adapters | Required | UI labels legacy failure separately; official reads still work when an adapter is unavailable |
| `chat-history-post` | REST history, older paging, replies, edits, media metadata, text post | Required | Ordering/deduplication correct; 8,192-byte and two-second limits enforced |
| `chat-reconnect` | Visibility polling, offline, restart | Required | Polls never overlap; reconnect/restart restores REST source of truth |
| `chat-legacy-realtime` | WebSocket disabled/failing | Required | REST history and text posting continue; no legacy `/api/chats/1/messages`/public socket-preparation handler is registered; socket emits body-free reconciliation hints only |
| `chat-legacy-media` | Media upload/confirm failure | Required | Background-only delegated token; browser credentials omitted; upload/confirm/inline-media redirects rejected with no referrer and final URL revalidated; no unconfirmed send; error/log contains no path, token, or private body |
| `post-factory-isolation` | Reviewed package capability use | Required | Public-profile declaration works; raw router has no production response; sender/document/package/grant mismatch fails; write requires active per-invocation gesture; recursive credential isolation and composer trust gates reject bypasses |
| `error-separation` | 401, 403 scope, 403 user, 429 cooldown/rate, offline, unauthorized sender | Required | Authorized UI states remain distinct; unauthorized content/page/package caller gets generic rejection with no status lookup, identity, scopes, or migration data; diagnostics stay redacted |
| `keyboard-screen-reader` | Connection and migration UI accessibility | Required | Keyboard order, focus, names, live status, dark/forced color behavior remain usable |
| `dm-read-aloud-privacy` | Direct-message Reader Voice custody and cleanup | Required | Uses browser-local Web Speech only; no DM text reaches custom TTS/audio export/OCR/full-quote/background/diagnostic/storage paths; stop, completion, navigation, disable, disposal, and uninstall clear transient conversation state |

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

## Candidate Lineage And Immutable Inputs

This record binds the 0.2.5 evidence to public release base
`22262bfb3ca49ee39f9d839658aefd1e54d1101f` and final pre-documentation
security parent `a7b3caedf5d7f94d3a4fb8af45e0f6185a687e9f`. It does not convert an
automated result into live acceptance.

The final audited runtime parent is
`0b2376e66ac3a8f302ca71831dc871052165ae58`: Beetol's official-auth boundary
mapped first at `7d1495b9302a24b7461e70568b1a21a5e0a88833`, followed by the host-only
Post-reading direct-fetch hardening. All 29 browser rows remain pending until
the exact packaged candidate is observed; strict-live verification continues
to fail closed while `sourceCommit` and browser/build evidence are null.

| Shipped source slice | Cumulative public release ancestry |
| --- | --- |
| #24 Post-Factory/Remibooru and initial Post-reading fallback | `7cf7d19a28760acdee757f6ac6f4a968e2bdde71`â†’`f05cf3c963831d55b58910f9f19cec72144f8d8a`â†’`a1a3733d08a5605868f8e74212cee5696020e03c` |
| #226 Chromium beta identity | `d1ed538eea93ebe8326b051ae45bd48b3dfb430a` |
| #227 authentication / #228 API client / #235 connection UI | `467347da7397dfc73d13698928fcc597dba1857d` / `7d5210c20a42dfa7e7ccc1c1a12f7b3133d8fc05` / `bb8afcca74ba99e0e4eed3b5f674895d3ac3d8ea` |
| #231 Beetle reads / #230 RemiStats | `4cf5e230aa16658def35d73216a2bfe72c071f2c` / `6fe7e86103d7e013948f88a7de982deefbaf8d92`â†’`663bdac86a77d69a13be146ec744097bae074fcc`â†’`24411b1fd62b81f4005e2bf0377d42d1b90e8da3` |
| #234 capability broker | `601051b91ab5829470619a682e382e3c0c580dbd`â†’`a856e58afb1d78d2a6363fb6043a96d6295800bb`â†’`57a1d0ecca4199d704aae8f54d69652e9828dfa0` |
| #18/#76/#135 Post-reading page action, audio, article, and DM chain | `4cadbe53ddd0a175dabc41e3183857c95b36a736`â†’`f7bcf16444845ca7dbb51a9e660f06ecaaf5abc1`â†’`5c77b03869fed7e1031f889c433b915e4d6bba5b` |
| #232 official Chat REST / #233 legacy adapters | `e90783e04b8e54a917d04bc41e243320e4fd18df` / `298f298f51394233c3130561d4da45b19c19e4f9`â†’`c137252ba94ff750a1e1024a8962387c86ad512a` |
| #229 directory/profile / #74 multi-site runtime | `e26e7a5e2fec3a242cda1a50c8e0769dc6e9160c`â†’`e2db4b9717e53e9f2ad9a2287196eaeff97e8a35` / `6b1f20dc8e6a668630f4f6d766d5e8433af8db2a` |
| #224/#222 Share Kit | `ae87dd92eaf50761d17ac606b09ce03b514e976b`â†’`6d85dd3909ad67f2b1828f03dc10f645b50c0c60` |
| #192/#193 pet pipeline | `3ce160ac7bbe2e18955fbceabd4655773c4b56ef`â†’`55491b9551f3831bdc6544741470b99eb19c2850` |
| #236 remediation and approved reproducibility follow-up | `f6f679fb5150383989815af1981b60c068020681`â†’`cbf7ded56390db36cf85a69bd32a357ff04bf1c2`â†’`7dcb6e9e9637be2d573c0fae434c293c77e78a2b`â†’`a7b3caedf5d7f94d3a4fb8af45e0f6185a687e9f` |

| #231 final Beetol auth/transport cleanup | `7d1495b9302a24b7461e70568b1a21a5e0a88833` |
| #18 host-only full-quote transport hardening | `0b2376e66ac3a8f302ca71831dc871052165ae58` |

All entries are cumulative public release ancestry; no private-history tree is
imported. Public changelog, roadmap, and prior release notes remain as the
intentional public-history exception. That exception never permits private
branches, worktree paths, credentials, account identifiers, messages, private
media, or private QA evidence in source, archives, screenshots, or release
copy.

| Immutable candidate evidence | SHA-256 |
| --- | --- |
| Share Kit source content | `f3ae5b0f48e32c5b807168c8f57319c4892925c3b62ab218e4a345ab6ed8c2e0` |
| Share Kit generated content | `1e4c9cae7551252c264addb5439f5be157d6e1aa56adc94faa5be33a86102245` |
| Share Kit package/content | `3e014f073d7d10c86392e901af6c1e262bbaf3a77d8e0416fd57a9d0105197e9` |
| Share Kit manifest | `8bff62a878e857dc1cfd25e80a292fd7790d0d41fc2236d033a51596868d86ed` |
| Three-package composition | `a6f64ffa2dd14ef460e591cbfaba129be69216c25e02a9c372fadb552a6976a8` |
| Post-reading external sdk.4 package | `01ca79910d26266ca4b89681ea5998da454c140aa7e4e776ae008123bb2b9fa3` |
| Post-Factory package/content | `99b316f54c2fb350f3a02dd5bea21b797b2f280afe6f6db2c1826ee54a8a8985` |
| Final combined pet skill ZIP | `9e4f54212af30502be6156c0cb3204f5d4e19bddb1b4d1078ac437c760e2c915` |
| Reproducible Chromium archive | `08012dad1de7dff08f96077c83bdb41b48a83843a78f611e2ebb96b9c19a1768` |
| Reproducible Firefox archive | `8f6371c43cd717d85872e63c8143a6fce5e603d1ca429d70195c84e82593db1a` |
| Deterministic Remilia migration artifact report | `3ce5a5461abc4746093e0da763f785d7ba5228540f094f77ecfa028fc1baa725` |

The composition result is three accepted, zero rejected, and zero sensitive.
The final combined pet ZIP contains 15 deterministic entries with no duplicate
or unsafe path and supersedes the earlier #192-only SHA
`179cd2149e12f005704bde402ba1a39b958fac3bc197df81a7b47cc46d25228a`.
The archive and report values above are the canonical results from mapped
cumulative candidate `4fb90c22cde835d218c0510f17aba53e9430dcb2`; the package and
composition identities remain unchanged. Earlier source-worktree-only evidence
(`33afd55be0baaf9747833281de6c92e01100a07d0f817f83e1f7e2b2f28fad21`,
`82ac3b4adb8f976976aeb64d6aaf947595d81df052a4e0f10536a86fb1533b62`, and
`d3b329993318c9e164869d213f628a4294bfffb2a21dcdbd33ff96ca2e52d910`) is
superseded. QA verified that the source-worktree difference is confined to
`.pnpm` versus canonical `node_modules` module labels in the emitted music,
OCR host, and worker bundles; normalized bytes are identical, which proves
runtime equivalence but not ZIP/report identity. QA must reproduce the mapped
identities after this documentation/gate-only follow-up; none of these automated
results constitutes live browser acceptance.
