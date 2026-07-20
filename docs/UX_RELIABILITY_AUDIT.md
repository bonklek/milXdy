# milXdy UX And Feature Reliability Audit

Status: audit complete; all 43 recorded findings received 0.2.3 code-level remediation, and the non-live release gate passes. Authenticated/live and Firefox-runtime limitations remain explicit below.  
Audit branch/HEAD at start: `chore/scanner-rewrite-evidence` / `baa3c387d9e05d9fddd981c5c6925b795af4f212`  
Code baseline at start: package `0.2.2-hotfix.1`, extension `0.2.2.1`  
Audit rule: preserve the pre-existing dirty worktree; do not modify product code, commit, push, or open issues.

> Remediation note (2026-07-09): the audit itself followed the non-modification rule above. A subsequent 0.2.3 implementation pass on `fix/0.2.3-ux-reliability` applied the recorded fix directions across the runtime and first-party apps. Passing automated gates does not replace the manual/authenticated scenarios listed under **Unverified Or Environment-Dependent Areas**.

## Purpose And Evidence Standard

This report traces the current implementation against the documented user experience and records only findings supported by code, automated checks, or live behavior. Passing structural verifiers is not treated as proof of browser-runtime behavior. Each finding includes user impact, evidence, reproduction conditions, root-cause direction, a fix direction, and a regression-test recommendation.

Severity is recorded as:

- **P0**: data/security loss or broadly unusable critical flow.
- **P1**: major feature failure, persistent incorrect state, or serious accessibility barrier.
- **P2**: meaningful reliability or UX failure with a workaround.
- **P3**: localized friction, misleading copy, or maintainability/test risk with plausible user impact.

Confidence is **confirmed**, **high**, **medium**, or **hypothesis**. Hypotheses stay outside the prioritized confirmed backlog until stronger evidence is gathered.

## Authoritative Baseline

The intended behavior is being reconciled from `README.md`, `docs/USER_GUIDE.md`, `docs/user-guides/`, `docs/APP_SDK.md`, `docs/ROADMAP.md`, `PLANNING.md`, `CHANGELOG.md`, `docs/TROUBLESHOOTING.md`, QA documents, `assets/extension/manifest.json`, and `src/platform/app-sdk/first-party-apps.json`.

The current architecture is a Manifest V3 extension whose main runtime injects on X/Twitter. A registry of 12 first-party packages drives lazy content entries, settings metadata, permissions/privacy disclosure, performance costs, background routes, and dock presentation. Shared platform layers own X surface scanning, SPA route/visibility tracking, scheduling, lifecycle/disposal, background routing, authentication, diagnostics, overlay layout, app chrome, and settings/profile packs.

### Initial Automated Baseline — 2026-07-09

The repository's `npm` launcher was not available on `PATH`, so the same underlying Node entry points were invoked directly. All commands below were non-destructive.

| Check | Result | Evidence summary |
| --- | --- | --- |
| Strict TypeScript | Pass | `node node_modules/typescript/bin/tsc --noEmit` |
| Platform verifier | Pass | `node scripts/verify/platform.mjs` |
| App SDK compliance | Pass with 2 documented warnings | 12 apps checked; warnings cover the intentionally internal RemiNet Chat socket bridge and Wiki iframe bridge |
| Internal messaging bridges | Pass | `node scripts/verify/internal-messaging-bridges.mjs` |
| Settings mirrors | Pass | 22 generated feature settings, 7 enablement settings, and 1 app-surface popup mirror checked |
| URL allowlists | Pass | `node scripts/verify/url-allowlist.mjs` |
| Post-reading full-quote privacy | Pass | `node scripts/verify/post-reading-full-quote-privacy.mjs` |
| Post-reading hyperlink offsets | Pass | `node scripts/verify/post-reading-hyperlink-offsets.mjs` |
| Update-check unit tests | Pass | 1 file, 5 tests |

These checks establish syntax and selected structural invariants only. Live lifecycle, accessibility, browser API, service-worker suspension, external-service, and recovery behavior remain to be proven.

### Final Verification Rerun — 2026-07-09

The complete initial baseline was rerun after all static traces and report edits. Every baseline check passed with the same counts: 12 App SDK packages and 2 intentional bridge warnings; 22 generated, 7 enablement, and 1 app-surface settings checks; and 1 update test file with 5 tests. Additional non-destructive evidence also passed:

| Check | Result | Evidence summary |
| --- | --- | --- |
| Music build verifier | Pass | `node scripts/verify/music-build.mjs` |
| RemiStats tooltip escaping | Pass | `node scripts/verify/remistats-tooltip-escaping.mjs` |
| Current and historical app smoke | Pass | `node scripts/smoke/app-smoke.mjs` |
| Chromium production build | Pass | `node scripts/build/build-extension.mjs --target=chromium` |
| Firefox production build | Pass | `node scripts/build/build-extension.mjs --target=firefox` |
| Firefox lint | Pass with warnings | 0 errors, 0 notices, 31 generated-code/vendor heuristic warnings (dynamic import/eval/innerHTML); warnings require contextual review and are not treated as confirmed defects |
| Current release contract | Pass | extension 0.2.2.1, package 0.2.2-hotfix.1, App SDK 0.2.2 |

The built popup was rendered through a localhost-only Chromium target and its accessibility tree inspected. Live X navigation reached the unauthenticated sign-in surface, so no authenticated X behavior is claimed.

## Architecture And User-Flow Map

| Layer | Primary implementation | Reliability responsibilities |
| --- | --- | --- |
| Extension boot | `src/extension/content/index.ts`, `src/extension/background/index.ts` | correct host/frame boot, startup/install defaults, MV3 restart recovery |
| App registry/SDK | `src/platform/app-sdk/` | metadata truth, enablement adapters, lifecycle and settings contracts |
| Shared content runtime | `src/platform/runtime/content-runtime.ts` | lazy import, enable/disable, routes, surface queues, abort/dispose, diagnostics |
| X scanner | `src/platform/scanner/twitter-scanner.ts` | virtualized DOM discovery, deduplication, visibility budgets, route rescans |
| Background platform | `src/platform/background/`, `src/platform/auth/`, `src/extension/background/index.ts` | validated senders, allowlisted fetches, concurrency, auth/session, service-worker recovery |
| Popup/settings | `src/extension/popup/index.ts`, `src/platform/settings/` | first run, presets, mirrored storage, import/export/reset, update and Health states |
| Overlay platform | `src/platform/overlay/` | rail registration/pinning, geometry, drag/resize/snap, focus and cleanup |
| First-party packages | `src/apps/` | feature behavior, app-specific storage/network/UI, graceful failure |

## Registered Package Coverage Matrix

Coverage states: **not started**, **static traced**, **automated evidence**, **live partial**, **live complete**, or **blocked/unavailable**.

| Package | Kind | Principal user flow | Static | Automated | Live Chromium | Live Firefox | Failure/recovery |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Root Visual Enhancements | feature | X appearance, notification state, sounds | static traced | not started | not started | not started | not started |
| Tweet PNG | feature/invoked | post action -> local preview/render -> save/share | static traced | not started | not started | not started | not started |
| Composer Tools | feature | X composer `--` -> em dash | static traced | not started | not started | not started | not started |
| Remilia Wiki Hyperlinks | feature | visible X text -> local matches -> hover preview | static traced | not started | not started | not started | static traced |
| Remilia Wiki Sidebar | app | rail/link/context action -> validated embedded Wiki | static traced | partial | not started | not started | static traced |
| Post-reading | app | X/Wiki text -> speech/OCR/highlighting/player | static traced | partial | not started | not started | static traced |
| RemiStats | feature | visible identities -> badges/tooltips/pokes | static traced | not started | not started | not started | static traced |
| Milady Maxxer | app | visible avatars/identity -> local inference/effects/XP | static traced | not started | not started | not started | static traced |
| Beetol | app | RemiliaNET session -> hunt panel/actions/cooldowns | static traced | not started | not started | not started | static traced |
| RemiNet Chat | app | RemiliaNET session -> history/socket/reactions/uploads | static traced | not started | not started | not started | static traced |
| Miladychan Portal | app | public board JSON -> board/thread/media reader | static traced | not started | not started | not started | static traced |
| Music | app | folder permission -> index/playlists/enrichment/radio | static traced | not started | not started | blocked/unavailable | static traced |

## Platform And Cross-Cutting Coverage Matrix

| Area | Static | Automated | Live/failure evidence |
| --- | --- | --- | --- |
| Bootstrap and manifest host/frame behavior | static traced | partial | unavailable without loaded extension |
| Lazy loading and lifecycle | static traced | partial | not started |
| X SPA routes and scanner delivery | static traced | partial | not started |
| Performance modes and diagnostics | static traced | partial | not started |
| Apps & Features and first-run presets | static traced | partial | live partial (built popup rendered locally; extension APIs unavailable) |
| Settings mirrors/migrations/profile packs | static traced | partial | not started |
| Rail, layout, drag/resize/snap/restore | static traced | partial | not started |
| Background routing/network budgets | static traced | partial | not started |
| RemiliaNET auth/session recovery | static traced | partial | unavailable without authenticated session |
| Chromium/Firefox parity | static traced | Chromium/Firefox builds + Firefox lint | Chromium popup partial; Firefox runtime unavailable |
| Accessibility and reduced-motion behavior | static traced | not started | live partial (popup accessibility tree and narrow viewport) |
| Offline/timeout/malformed/storage failure | static traced | partial | live injection unavailable; confirmed code-path findings recorded |

### Behavior Dimension Matrix

| Dimension | States/routes covered | Evidence | Remaining live limitation |
| --- | --- | --- | --- |
| X routes | Home, profile, post detail, Notifications, Messages/DMs, search, X Articles, composer surfaces, route transitions | scanner selectors, route handlers, per-app surface handlers, recovery timers, DOM ownership checks statically traced | X browser session was signed out; authenticated/virtualized DOM behavior unavailable |
| Performance modes | Fast, Balanced, Full, Developer | scanner/scheduler/runtime policies and per-app budgets traced; platform verifier passed | no comparable live feed/FPS/long-task capture |
| Feature lifecycle | lazy import, boot, enable, disable, route/surface, dock open/close, abort, dispose, re-enable | all 12 package entry points plus shared runtime traced; lifecycle defects have concrete state sequences | extension was not installed into the audit browser, so repeated live cycles unavailable |
| Authentication | explicitly disconnected, no session, stored/cookie token, refresh/silent SSO, browser-session adoption, 401/403 renewal | shared Remilia auth plus Beetol/Chat background callers traced; sender checks passed | no RemiliaNET account/session, 2FA, expiry, or suspension test |
| Network failures | offline/reject, hung request, 401/403, 404, 429/5xx, malformed/oversize response, late response | background/content queues and each remote app's error branches traced; allowlist and privacy checks passed | no controlled upstream fault injector/live service contract |
| Browser targets | Chromium MV3 and Firefox build target | both production builds passed; Firefox lint 0 errors; browser-specific APIs traced | only unauthenticated Chromium popup/X sign-in rendered; Firefox runtime and File System Access comparison unavailable |
| Accessibility | keyboard semantics, focus lifecycle, live regions, reduced motion, drag/reorder, narrow layout | source trace plus rendered popup accessibility tree/narrow viewport | no screen reader, OS reduced-motion, zoom, or full extension UI runtime |
| Persistence/restart | sync/local settings, IndexedDB, cooldowns, geometry, caches, MV3 worker/port state | storage schemas/migrations/reset paths and restart-sensitive code traced; mirror checks passed | browser restart, extension reload, quota/permission faults not live-injected |

## Prioritized Findings

### UXREL-RUNTIME-001 — A failing app lifecycle hook can abort global runtime cleanup

- **Area:** shared content runtime lifecycle
- **Severity/confidence:** P1 / high
- **User impact:** During runtime disposal (including extension-context teardown paths), one app whose `disable()` or `dispose()` rejects can prevent the shared runtime from disposing every registered app disposable, clearing lifecycle maps, and canceling queued background work. The page can retain listeners, observers, timers, detached UI, and queued requests until navigation/reload.
- **Evidence:** `src/platform/runtime/content-runtime.ts:502-533`. The `Promise.all(...)` at lines 522-525 is not inside a `try/finally`; cleanup at lines 526-532 is skipped if any lifecycle promise rejects. Within each mapping, `dispose()` is also skipped when `disable()` rejects.
- **Reproduction:** Load at least two runtime apps, make one lifecycle hook reject, and call `ContentRuntime.dispose()`. Assert that the returned promise rejects before `appDisposables.clear()`, `loaded.clear()`, and `cancelNetworkQueue()` execute.
- **Likely root cause:** Lifecycle hooks were treated as infallible during teardown.
- **Fix direction:** Isolate every hook with all-settled/error capture and put invariant cleanup in `finally`. Record the failing app/hook without allowing it to block other cleanup.
- **Regression test:** Unit-test synchronous throws and asynchronous rejections from both `disable()` and `dispose()`, proving all other hooks and all invariant cleanup execute exactly once.
- **Scope:** shared local runtime; cross-app.

### UXREL-RUNTIME-002 — A rejected surface handler can strand the rest of that app's delivery queue

- **Area:** shared X surface delivery
- **Severity/confidence:** P2 / high
- **User impact:** If an app's `onSurface()` throws or rejects for one X node, remaining queued tweets/users/notifications for that app are not rescheduled. The feature can silently stop appearing on later visible surfaces until another delivery happens to restart the queue, while also producing an unhandled rejection.
- **Evidence:** `src/platform/runtime/content-runtime.ts:924-955`. The per-delivery await at lines 940-944 can reject; the outer `finally` records metrics, but rescheduling/deletion at lines 953-954 is after the throwing block and is skipped. The caller at lines 918-921 launches the async drain with `void` and no rejection handler.
- **Reproduction:** Queue more than one delivery, make the first `onSurface()` reject, and verify the remaining queue depth stays nonzero with no scheduled drain.
- **Likely root cause:** Timing was protected with `finally`, but queue progress and error isolation were not.
- **Fix direction:** Catch errors per delivery, record app/surface diagnostics, continue or explicitly retry according to policy, and put queue rescheduling/deletion in invariant cleanup.
- **Regression test:** Reject the first item in a multi-item batch and prove later items run, the queue drains, and the failure is recorded without an unhandled rejection.
- **Scope:** shared local runtime; X DOM apps.

### UXREL-RUNTIME-003 — A thrown idle task can pause already-queued shared work

- **Area:** shared performance scheduler
- **Severity/confidence:** P2 / high
- **User impact:** A synchronous exception in an idle callback exits the shared drain before it schedules another drain. Tasks already behind it remain queued until some future call happens to enqueue additional work, and the exception escapes as an uncaught browser callback error.
- **Evidence:** `src/platform/runtime/content-runtime.ts:3273-3305`. `task.callback()` is protected only by `finally`; there is no `catch`, and `scheduleDrain()` at line 3304 is skipped when the callback throws.
- **Reproduction:** Enqueue two idle callbacks; make the first throw. Run the scheduled drain and verify the second stays queued and does not run without another enqueue.
- **Likely root cause:** Scheduler statistics were made exception-safe, but queue progress was not.
- **Fix direction:** Catch/report each task error and guarantee subsequent scheduling in `finally`; consider associating scheduled tasks with an app ID for diagnostics and isolation.
- **Regression test:** Cover thrown callbacks, canceled callbacks, disposal during drain, and a mixed queue that must continue in order.
- **Scope:** shared local runtime; cross-app.

### UXREL-BOOT-001 — A document-start timing race can leave the shared scanner uninstalled

- **Area:** content bootstrap and shared scanner
- **Severity/confidence:** P1 / high
- **User impact:** The manifest injects `content.js` at `document_start`. If the runtime reaches scanner subscription before `document.body` exists, `ensureScanner()` returns without attaching an observer. The initial full scan runs against the incomplete document, and there is no DOM-ready listener or retry dedicated to installing the observer. In that race, all scanner-delivered features can remain absent for the page lifetime.
- **Evidence:** `assets/extension/manifest.json:36-41` specifies `document_start`. `src/platform/scanner/twitter-scanner.ts:98-111` calls `ensureScanner()` and schedules a scan, but `ensureScanner()` returns on missing body at lines 166-173. No scanner code registers `DOMContentLoaded` or otherwise retries specifically when the body becomes available. Existing static verifiers only assert ownership/subscription strings.
- **Reproduction:** Run the content entry in a document-start harness where storage promises resolve before body creation; create the body afterward without calling another exported scanner method and assert no observer/surface delivery appears.
- **Likely root cause:** Normal X/storage timing usually masks a missing explicit DOM-readiness contract.
- **Fix direction:** Make scanner startup wait for/observe document body creation, or observe `documentElement` until body exists, with idempotent cancellation when no subscribers remain.
- **Regression test:** Deterministic early-document tests for subscribe-before-body, unsubscribe-before-body, body replacement, normal body-present startup, and exactly one observer.
- **Scope:** Chromium/Firefox content bootstrap; cross-app.

### UXREL-BOOT-002 — Bootstrap rejection has no suite-level failure state or recovery

- **Area:** content bootstrap and Health diagnostics
- **Severity/confidence:** P2 / high
- **User impact:** Any rejection from initial visual-state storage, benchmark setup, runtime metadata, or startup app boot rejects `bootFeatures()` as an unhandled promise. Remaining initialization stops, but users receive no page-level recovery affordance and Health may never receive a bootstrap-failed record.
- **Evidence:** `src/extension/content/index.ts:8-13` launches and awaits the entire chain with `void bootFeatures()` and no catch/finally. `setupRootVisualState()` performs an uncaught storage read at `src/platform/visuals/root-visual-state.ts:36-55`; runtime boot awaits several storage and app operations.
- **Reproduction:** Reject one initial storage read or startup app boot and inspect unhandled rejection, loaded modules, rail state, and diagnostics.
- **Likely root cause:** Startup components were assumed to be independently reliable while composed into a single serial promise.
- **Fix direction:** Add a top-level bootstrap boundary that records stage/error, contains optional-stage failures, and presents a reload/diagnostic path without pretending partially booted features are healthy.
- **Regression test:** Fault-inject every awaited bootstrap stage and assert defined containment, cleanup, diagnostics, and retry/reload behavior.
- **Scope:** cross-app local bootstrap; extension invalidation/reload.

### UXREL-DIAG-001 — Resetting diagnostics falsely reports that the active scanner observer is gone

- **Area:** scanner diagnostics
- **Severity/confidence:** P3 / confirmed
- **User impact:** Health/performance evidence can claim `activeObserverCount: 0` even while the shared MutationObserver remains attached. This undermines the stated goal of using diagnostics to detect duplicate observers or prove scanner behavior.
- **Evidence:** `src/platform/scanner/twitter-scanner.ts:117-125` resets from `createScannerCounters()` but restores only budgets/surface counts, while observer attachment and detachment set `activeObserverCount` at lines 166-203. Runtime boot calls the reset before scanner configuration at `src/platform/runtime/content-runtime.ts:314-325`; any later diagnostic reset while subscribed has the same mismatch.
- **Reproduction:** Subscribe a scanner listener, confirm the observer is active, call `resetTwitterScannerCounters()`, and inspect `getTwitterScannerCounters().activeObserverCount`.
- **Likely root cause:** The observer-count field was added without preserving live resource state during counter reset.
- **Fix direction:** Derive resource gauges from actual state (`observer ? 1 : 0`) rather than treating them as resettable counters.
- **Regression test:** Assert the gauge across reset while stopped, reset while active, subscribe/unsubscribe, and scanner restart.
- **Scope:** local diagnostics.

### UXREL-SETTINGS-001 — One-click “Reset app settings” can silently delete user-authored lists

- **Area:** Apps & Features reset UX and storage ownership
- **Severity/confidence:** P1 / confirmed
- **User impact:** Clicking the generic `Reset` button can permanently remove data that users authored, without a confirmation, preview, or undo. In particular, Wiki local aliases and denied terms and Maxxer whitelist/manual-Milady handle lists are declared as package storage but are not represented by resettable setting definitions, so the reset planner removes their entire keys.
- **Evidence:** The unqualified button and immediate action are at `src/platform/runtime/content-runtime.ts:1963-1969`. Unrepresented package storage keys are removed wholesale at lines 2522-2595. `src/platform/app-sdk/first-party-apps.json` declares `remiliaWikiHyperlink.localAliases`, `remiliaWikiHyperlink.denyTerms`, `whitelistHandles`, and `miladyListHandles` as owned storage; their settings arrays do not define reset behavior for those user-authored collections. `docs/SETTINGS_MIGRATION_AUDIT.md` explicitly describes Maxxer handles as user-authored lists requiring explicit export scope.
- **Reproduction:** Add a Wiki alias/deny term or Maxxer handle, open Apps & Features, expand the package, click `Reset`, and inspect storage.
- **Likely root cause:** Package-owned storage was treated as disposable settings state without distinguishing preferences, caches, credentials, and user content.
- **Fix direction:** Add storage-data classifications and package-specific reset previews. Require explicit confirmation for user content, state exactly what will be removed, and preferably offer separate “reset preferences” and “clear app data” actions.
- **Regression test:** Seed every owned key by classification and assert ordinary settings reset preserves user-authored content, auth/secrets, and unrelated shared keys.
- **Scope:** local UX/data preservation; multiple apps.

### UXREL-SETTINGS-002 — Generated controls handle failed writes inconsistently and can display unsaved values

- **Area:** Apps & Features generated settings
- **Severity/confidence:** P2 / confirmed
- **User impact:** Select, number, slider, and text controls optimistically keep a changed value when storage rejects; their write promises have no rejection handler. Toggle controls attempt to revert, but a storage helper returning `false` for an invalidated extension context is treated as success, so toggles can also display a value that was never saved. Users can believe a reliability/privacy setting changed when it did not.
- **Evidence:** `src/platform/runtime/content-runtime.ts:2110-2162` catches failures only for generated toggles. `writeManifestSettingValue()` at lines 2181-2193 ignores the boolean returned by `safeStorageSet()`. `safeLocalSet()` returns `false` after extension invalidation in `src/platform/background/extension-runtime.ts`, and the sync helper behaves the same at `src/platform/runtime/content-runtime.ts:2680-2688`.
- **Reproduction:** Force `chrome.storage.*.set` to reject or simulate extension-context invalidation, change each generated control type, and compare visible state with stored state/error feedback.
- **Likely root cause:** Generated controls do not share a transactional pending/success/error state model.
- **Fix direction:** Disable controls while saving, treat `false` as failure, restore the authoritative value on any failure, and expose an inline `role=status`/`role=alert` message.
- **Regression test:** Parameterize all generated control types over successful write, thrown write, invalidated-context false result, and rapid consecutive edits.
- **Scope:** local/cross-browser settings UX.

### UXREL-ONBOARD-001 — Popup “Full setup” bypasses its own performance blocks

- **Area:** onboarding, presets, performance modes
- **Severity/confidence:** P1 / confirmed
- **User impact:** When the current Performance mode is Fast, popup onboarding identifies several apps as blocked, excludes them from its adapter-based enable list, and tells the user they need a higher Performance setting—but then directly writes their enablement keys to `true`. Post-reading, Wiki, Maxxer, RemiNet Chat, and Music can therefore be enabled despite the displayed block, while Performance mode remains Fast. The resulting state contradicts both the message and the normal Apps & Features enablement policy and can load heavy dock/worker behavior the user was told was blocked.
- **Evidence:** Blocking is calculated at `src/extension/popup/index.ts:571-579` and `appsToEnable` excludes blocked apps at lines 473-482. The same operation directly writes Wiki, RemiNet Chat, Music, Post-reading, and Maxxer enablement at lines 492-537, without changing `PERFORMANCE_MODE_KEY`. The completion message at lines 558-560 says blocked apps need a higher setting. The shared runtime's storage observer at `src/platform/runtime/content-runtime.ts:582-603` accepts enablement changes without applying `appEnableBlockedByPerformance()`. The Apps & Features preset implementation instead converges enablement and writes the matching performance mode at lines 1489-1557.
- **Reproduction:** Set Performance to Fast, open/reopen popup onboarding, apply Full setup, and inspect the blocked apps' storage keys and Apps & Features state.
- **Likely root cause:** A legacy hard-coded “full start” path diverged from the registry-driven preset implementation.
- **Fix direction:** Route popup onboarding through the same registry-driven preset transaction as Apps & Features. Either switch to Full performance as documented or leave blocked apps disabled; never report them blocked while enabling them.
- **Regression test:** For Lite/Balanced/Full from every starting mode, assert exact app enablement, performance mode, rail pins, visual settings, and completion copy against the registry preset contract.
- **Scope:** local onboarding/settings; performance reliability.

### UXREL-NET-001 — Shared network queues have no request deadline or cancellation policy

- **Area:** background/content network scheduling and external-service recovery
- **Severity/confidence:** P1 / high
- **User impact:** A fetch that never settles can occupy one of the limited background network slots indefinitely. The corresponding content-side `sendMessage()` also remains active indefinitely, so enough stalled RemiStats, identity, Wiki, Music, Miladychan, or image requests can starve unrelated remote features behind both shared queues. Disabling an app cancels queued work but cannot abort work already active.
- **Evidence:** Background tasks at `src/platform/background/router.ts:82-115` have no timeout, AbortSignal, active-task cancellation, or age limit. Core fetches enter that queue through `budgetedFetch()` at `src/extension/background/index.ts:982-984`, and the fetch calls do not add a signal. The content-side queue at `src/platform/runtime/content-runtime.ts:545-571` and `3016-3070` likewise has no active-task deadline/abort; `cancelNetworkQueueForApp()` only removes entries still queued. Update, auth, Chat, Beetol, and other direct background fetches also lack consistent deadlines.
- **Reproduction:** Stub an allowlisted background fetch with a never-settling promise, fill network concurrency, then request a different app's background operation. Verify it remains queued indefinitely and app disable does not settle the active request.
- **Likely root cause:** Concurrency budgeting was implemented without a complementary timeout/cancellation contract.
- **Fix direction:** Define per-service deadlines, compose AbortSignals, abort active app-owned work on disable/dispose, return typed timeout errors, and expose oldest-active/oldest-queued age in diagnostics. Uploads may need a longer explicit policy than metadata fetches.
- **Regression test:** Use never-settling and slow fake fetches to prove deadline release, queued-task progress, app-disable cancellation, late-response suppression, and diagnostics.
- **Scope:** cross-app, upstream-dependent, MV3 background reliability.

### UXREL-CHAT-003 — Closing during socket authentication can create an orphan WebSocket

- **Area:** RemiNet Chat WebSocket lifecycle
- **Severity/confidence:** P2 / confirmed
- **User impact:** If the chat panel is closed, the feature disabled, or the tab hidden while background socket authentication is still pending, the Port disconnect closes only the socket that exists at that moment. When authentication later resolves, the stale connection attempt creates a new WebSocket even though its Port is already closed. Its event handlers ignore events, but nothing closes the new socket, leaving an unowned live connection in the service worker until suspension/process teardown.
- **Evidence:** Background `connectSocket()` checks `closed` only before awaiting `prepareSocketAuth()` at `src/apps/reminet-chat/background.ts:92-99`; it does not recheck after the await before assigning/creating `new WebSocket`. Port disconnect sets `closed = true` and calls `closeSocket()` at lines 141-145, but a pending attempt has not assigned its socket yet. Later open/message handlers return when `closed`, without closing `nextSocket`, at lines 102-111.
- **Reproduction:** Delay `prepareSocketAuth`, request Connect, then close/minimize/disable Chat before it resolves. Release auth and inspect WebSocket creation/network activity after the Port has disconnected.
- **Likely root cause:** Connection setup lacks a generation/AbortSignal across its async authentication boundary.
- **Fix direction:** Increment a connection generation and/or abort controller on close/disconnect; after every await, verify the Port is live and generation current. Immediately close any stale socket before returning.
- **Regression test:** Close, hide, route change, disable, Port disconnect, and repeated Connect during delayed auth; assert at most one owned socket and zero sockets after close.
- **Scope:** RemiNet Chat; MV3/background lifecycle and upstream reliability.

### UXREL-CHAT-004 — Loading old history discards the newest messages at the retention limit

- **Area:** RemiNet Chat pagination/history
- **Severity/confidence:** P2 / confirmed
- **User impact:** Once 300 messages are loaded, choosing Show more merges an older page and then keeps the oldest 300 entries, silently dropping the newest messages from the current view. Users exploring history can lose recent conversation context precisely when paging backward.
- **Evidence:** The cap is `MAX_MESSAGES = 300` at `src/apps/reminet-chat/content.ts:33`. Older history calls `sortAndTrimMessages("oldest")` at lines 1021-1057. That helper sorts chronologically and, for the `oldest` anchor, executes `slice(0, MAX_MESSAGES)` at lines 3048-3053, which preserves the oldest records and removes the newest. The computed `historyCount` is unused.
- **Reproduction:** Seed 300 sequential messages, load 30 older records, and compare IDs before/after; the latest 30 disappear.
- **Likely root cause:** Scroll anchoring and bounded retention were conflated; trimming chose the requested edge rather than preserving both navigation context and recent history.
- **Fix direction:** Use a paged/windowed history model with explicit loaded ranges, or keep a larger bounded store and virtualize rendering. At minimum communicate/window the dropped edge and restore recent history predictably when returning to bottom.
- **Regression test:** Multiple older pages while live messages arrive at, below, and above the cap; assert no silent loss of the current/newest range and stable scroll anchoring.
- **Scope:** RemiNet Chat; local pagination reliability.

### UXREL-CHAT-005 — Every live update replaces the message action DOM and drops keyboard focus

- **Area:** RemiNet Chat accessibility/live UI stability
- **Severity/confidence:** P2 / confirmed
- **User impact:** A keyboard user focused on Reply, React, Poke, Show more, or Retry loses focus whenever any message, reaction, recovery state, or local send-state render occurs. The entire messages subtree is recreated with `innerHTML`, so frequent live chat updates make actions difficult or impossible to operate reliably.
- **Evidence:** `render()` rebuilds `messages.innerHTML` for signed-out/loading states and the full grouped timeline at `src/apps/reminet-chat/content.ts:1548-1577`. Socket deliver/reaction/edit/delete handlers call `render()` at lines 1375-1402, as do reaction/poke/send and recovery transitions. No focused action key is captured/restored and nodes are not reconciled by message ID.
- **Reproduction:** Keyboard-focus a reaction or reply button, then receive a message/reaction or wait for a send/recovery render; inspect `document.activeElement` and attempt the next keyboard action.
- **Likely root cause:** String-template full rerendering was used for a live interactive timeline without focus preservation.
- **Fix direction:** Reconcile keyed message/group nodes in place, update only affected status/count elements, and preserve/restore a stable focus key when removal is unavoidable. Announce new messages in a separate controlled live region.
- **Regression test:** Focus each action while deliver/edit/delete/reaction/poke/pagination/recovery updates occur; assert focus remains on the same logical action or moves to a documented fallback.
- **Scope:** RemiNet Chat; local cross-browser accessibility.

### UXREL-CHAT-001 — The RemiNet media cap buffers the full response before enforcing the limit

- **Area:** RemiNet Chat media preview
- **Severity/confidence:** P1 / confirmed
- **User impact:** When an allowlisted media response omits or lies about `Content-Length`, the service worker reads the entire body into a Blob before checking the 8 MB limit. A very large response can cause high memory use or terminate the MV3 worker/tab before milXdy returns `MEDIA_TOO_LARGE`.
- **Evidence:** `src/apps/reminet-chat/background.ts:356-367` checks a declared length but then calls `response.blob()` and validates `blob.size` only afterward. The core image and Post-reading fetch paths already use capped stream readers (`src/extension/background/index.ts:946-979`; `src/apps/post-reading/background.ts:103-140`), demonstrating the available safer pattern.
- **Reproduction:** Serve a large chunked image/video without `Content-Length` from an otherwise allowlisted test endpoint or mocked fetch and observe bytes buffered before rejection.
- **Likely root cause:** The response-size limit was added around Blob conversion rather than at the stream boundary.
- **Fix direction:** Read the stream incrementally with early cancellation at 8 MB, then construct the Blob/data URL only from accepted bytes.
- **Regression test:** Cover absent, valid, malformed, understated, and oversized `Content-Length` plus chunked overflow; assert the reader cancels immediately over the cap.
- **Scope:** RemiNet Chat; upstream-dependent reliability and trust.

### UXREL-CHAT-002 — Allowed 100 MB videos are multiplied into several in-memory copies

- **Area:** RemiNet Chat attachment upload
- **Severity/confidence:** P1 / high
- **User impact:** Selecting a permitted 100 MB video converts it to a roughly 133 MB data URL in the content page, serializes that through extension messaging, decodes it to a binary string and Uint8Array in the service worker, then wraps it in Blob/File/FormData. The simultaneous copies can exhaust memory or disconnect the service worker, especially on lower-memory systems, even though the file is within the advertised limit.
- **Evidence:** The content limit and `FileReader.readAsDataURL()` path are at `src/apps/reminet-chat/content.ts:2617-2656`; the full data URL is sent at lines 2659-2671. Background limits allow 100 MB and decode through `atob`, `Uint8Array`, Blob, File, and FormData at `src/apps/reminet-chat/background.ts:17-21` and `270-350`.
- **Reproduction:** Attach progressively larger supported videos while recording content/service-worker memory and port stability; include a file near 100 MB.
- **Likely root cause:** Data URLs were convenient for runtime messaging but do not scale to the declared video limit.
- **Fix direction:** Reduce the supported cap until a streaming/chunked upload path exists, or transfer binary chunks without base64 and avoid duplicate Blob/File materialization. Show size/progress/cancel behavior explicitly.
- **Regression test:** Memory-bounded upload tests at representative sizes, cancellation, service-worker restart, and maximum-size rejection before reading/serialization.
- **Scope:** RemiNet Chat; Chromium/Firefox/MV3 memory reliability.

### UXREL-ROOT-001 — Dynamic “new posts” pills are never marked for their enabled styling

- **Area:** Root Visual Enhancements
- **Severity/confidence:** P2 / confirmed
- **User impact:** The configured Max/Medium new-posts pill styling normally does not apply, because the X “Show N posts” control is created after initial page load while milXdy scans for it only once during app boot.
- **Evidence:** `setupShowNewPostsMarkers()` is called once at `src/apps/root-visuals/content.ts:77` and only loops over controls currently in the document at lines 549-560. There are no other calls to `markShowNewPostsButton()`. The corresponding CSS requires `data-milxdy-show-new-posts="true"` at `src/platform/visuals/reskin-styles.ts:1560-1599`.
- **Reproduction:** Load Home without a new-posts pill, wait for X to insert “Show N posts,” and inspect the element for the required dataset marker/computed styles.
- **Likely root cause:** The feature predates shared scanner/route delivery and retained a one-time document query.
- **Fix direction:** Detect the pill through a bounded shared route/surface or targeted observer path and remove/update the marker if X reuses the node or changes its text.
- **Regression test:** Insert, update, remove, and reuse a mock new-posts control after boot and assert marker/style state follows it without a broad permanent observer.
- **Scope:** X DOM/upstream-sensitive local visual behavior.

### UXREL-TWEETPNG-001 — The documented review-before-copy flow is not used

- **Area:** Tweet PNG trust and export UX
- **Severity/confidence:** P1 / confirmed
- **User impact:** Documentation says users review the rendered image before saving or sharing and that nothing is sent automatically. In practice, choosing the X share-menu action renders and writes the PNG directly to the clipboard without showing the implemented preview. This removes the promised opportunity to catch incorrect identity, quote text, media, stats, or stale extraction before the image leaves the feature through the clipboard.
- **Evidence:** The share action calls the exported direct-copy function at `src/apps/root-visuals/content.ts:632-650` and `673-675`. That export renders and immediately calls the clipboard at `src/apps/tweet-png/content.ts:13-20`. A review function and modal exist at lines 73-80 and 780-818 but `openTweetPngReview()` has no call sites. `docs/user-guides/tweet-png.md` promises review before saving/sharing.
- **Reproduction:** Choose “Copy tweet as PNG” from an X post and observe that no review modal appears before clipboard write.
- **Likely root cause:** The menu integration was wired to an older direct-copy export while the later review surface remained unconnected.
- **Fix direction:** Make the invoked package expose a review/open action and require an explicit Copy/Download/Share choice from the modal. Keep direct copy only as a separately labelled advanced action if product policy wants it.
- **Regression test:** Assert no clipboard/download/share call occurs before an explicit review-modal action; cover close/cancel and render failures.
- **Scope:** local trust/UX; invoked feature.

### UXREL-TWEETPNG-002 — Missing clipboard support is reported as a successful copy

- **Area:** Tweet PNG cross-browser failure handling
- **Severity/confidence:** P1 / confirmed
- **User impact:** If image clipboard writing or `ClipboardItem` is unavailable, `copyTweetPng()` silently returns. Its caller then changes the menu label to “Copied PNG,” even though nothing reached the clipboard. This is particularly relevant to Firefox/API-policy differences.
- **Evidence:** `src/apps/tweet-png/content.ts:820-823` returns without error when the API is missing. `src/apps/root-visuals/content.ts:638-643` treats every resolved call as success and displays “Copied PNG.”
- **Reproduction:** Run with `navigator.clipboard` or `ClipboardItem` unavailable/denied, invoke Tweet PNG, and inspect the success label and clipboard.
- **Likely root cause:** Unsupported capability was modeled as a no-op rather than a typed failure/fallback.
- **Fix direction:** Reject with an actionable unsupported/permission error, keep the review open, and offer Download as the fallback. Announce the outcome accessibly.
- **Regression test:** Cover unsupported API, denied permission, rejected write, successful write, and Firefox-specific capability behavior.
- **Scope:** Tweet PNG; cross-browser/accessibility.

### UXREL-WIKI-001 — Wiki preview globals and an open preview survive feature disable

- **Area:** Remilia Wiki Hyperlinks lifecycle
- **Severity/confidence:** P2 / confirmed
- **User impact:** Disabling the Wiki-link feature removes inline links but does not close an already open preview or remove its global scroll, key, mouse, and focus listeners. The disabled feature can leave visible UI and continues intercepting page-wide events for the rest of the X tab's lifetime.
- **Evidence:** `installPreviewDismissHandlers()` installs anonymous/global listeners once at `src/apps/wiki-links/preview.ts:25-41` and exposes no disposer. Wiki boot calls it at `src/apps/wiki-links/content.ts:76-88`; disable/dispose at lines 151-169 clear links and package state but do not call `hidePreview()` or remove preview listeners.
- **Reproduction:** Focus/hover a linked term to open a preview, disable Wiki Hyperlinks from Apps & Features, and inspect the preview and registered global behavior.
- **Likely root cause:** Preview delegation was implemented as a page singleton outside the App SDK disposable contract.
- **Fix direction:** Return a disposable from preview installation, use named listener functions, close/cancel preview work on disable, and reinstall cleanly on re-enable.
- **Regression test:** Repeated enable/open-preview/disable/re-enable cycles proving zero visible preview and zero active feature listeners while disabled, without listener multiplication.
- **Scope:** local lifecycle/UX.

### UXREL-WIKI-002 — Keyboard focus closes the preview before its “Read” link can be reached

- **Area:** Remilia Wiki preview accessibility
- **Severity/confidence:** P1 / confirmed
- **User impact:** Keyboard users can focus a wiki term and trigger its preview, but pressing Tab immediately fires focusout on the term and synchronously removes the card. The interactive “Read on Remilia Wiki” link inside the element is therefore not keyboard reachable. The card is also declared as a tooltip despite containing an interactive link and is not associated with the source link.
- **Evidence:** Focus opens the preview at `src/apps/wiki-links/preview.ts:59-64`, while any focusout from the source link calls `hidePreview()` immediately at lines 66-68. The card contains an anchor but is assigned `role="tooltip"` at lines 212-256; no `aria-describedby`, focus-entry allowance, or card `focusout` handling exists.
- **Reproduction:** Focus an inline wiki link, wait for the preview, and press Tab toward “Read on Remilia Wiki.”
- **Likely root cause:** Mouse-hover tooltip behavior was extended with a focus trigger without redesigning the card as an interactive popover.
- **Fix direction:** Either make a non-interactive true tooltip and leave navigation on the source link, or implement an accessible popover/dialog pattern that keeps itself open while focus is within it and restores/dismisses predictably.
- **Regression test:** Keyboard and screen-reader sequences for open, source announcement, Tab into/out of the card, Escape, sidebar routing, and native modifier-click behavior.
- **Scope:** local accessibility.

### UXREL-WIKI-003 — Grok's multi-stage workflow cannot be canceled by feature disable or route change

- **Area:** Grok-assisted Wiki drafting lifecycle
- **Severity/confidence:** P1 / high
- **User impact:** Once the Socratic workflow starts, it can continue for several minutes, populating the Grok composer and programmatically submitting subsequent prompts even after Wiki Hyperlinks is disabled or the user navigates elsewhere. There is no visible cancel state tied to the feature lifecycle.
- **Evidence:** `runSocraticGrokWorkflow()` at `src/apps/wiki-links/content.ts:352-364` loops over four prompts and calls submission/wait helpers with up to 120-second cycles. The wait helpers at lines 815-918 use uncancelled polling timers and programmatic activation. Boot does not retain `context.signal`; disable/dispose at lines 151-169 do not cancel workflows. The one-shot 900 ms timeout at lines 195-205 is also not tracked.
- **Reproduction:** Start Socratic Wiki drafting, disable the feature or navigate during a response wait, and observe whether later prompts are still inserted/submitted.
- **Likely root cause:** The workflow predates abort-signal enforcement and runs as a detached `void` promise.
- **Fix direction:** Give every invocation its own AbortController composed with the app signal, expose Cancel, stop on route/context changes, and check the signal before every DOM read/write, clipboard operation, wait, and submit.
- **Regression test:** Cancel during initial delay, composer wait, response wait, between stages, feature disable, route change, and extension invalidation; assert no later synthetic input/click occurs.
- **Scope:** X/Grok upstream-sensitive local automation and trust.

### UXREL-WIKI-004 — Grok completion CTA uses invalid nested interactive controls

- **Area:** Grok-assisted Wiki drafting accessibility
- **Severity/confidence:** P2 / confirmed
- **User impact:** The completion CTA is a `<button>` that contains a text `<input>` and a span with `role=button`. Interactive descendants inside a button are invalid; focus, click activation, and screen-reader semantics vary by browser. The close control has no tabindex or keyboard handler, so it is not keyboard operable.
- **Evidence:** The root button is created at `src/apps/wiki-links/content.ts:440-446`; the input is appended at lines 500-536; the close span is assigned only `role=button`, pointer/click handlers, and no tabindex/keydown at lines 537-568.
- **Reproduction:** Navigate the CTA with keyboard/screen reader and attempt to edit the title, close the CTA, and activate its primary action independently.
- **Likely root cause:** A draggable card was modeled as one large button, then additional controls were inserted into it.
- **Fix direction:** Use a non-interactive region/dialog container with a real close `<button>`, labelled title input, and separate primary action button; give drag behavior a dedicated non-interactive handle.
- **Regression test:** DOM accessibility validation plus keyboard editing, close, primary activation, and drag-ignore behavior.
- **Scope:** local accessibility; cross-browser.

### UXREL-MUSIC-001 — Stopping a folder scan marks unvisited tracks missing and may continue other folders

- **Area:** Music local-library scan integrity
- **Severity/confidence:** P1 / confirmed
- **User impact:** Pressing Stop during a scan breaks directory enumeration with only a partial `seenPaths` set, but the scanner still treats that partial set as a complete inventory and marks every unvisited track in the folder unavailable. It then clears the shared cancel flag, so the outer multi-folder rescan can continue into subsequent folders despite the user's stop request.
- **Evidence:** `rescanFolders()` loops folders while checking `state.scanCancel` at `src/apps/music/content.ts:681-693`. `scanFolder()` resets the flag on entry, breaks enumeration on it at lines 695-729, but then unconditionally calls `markRemovedTracks(db, folder, seenPaths)` whenever lifecycle remains active at lines 730-739. It sets a “Scan stopped” status and immediately resets `state.scanCancel = false`, allowing the outer loop to proceed. `markRemovedTracks()` marks every path absent from the partial set unavailable at lines 3062-3074.
- **Reproduction:** Index a folder with many files, start a rescan, stop after a few entries, and compare `unavailable` flags for unvisited existing files. Repeat with two folders and observe whether the second begins.
- **Likely root cause:** Cancellation was checked in enumeration but not modeled as an incomplete-scan result before destructive reconciliation; one boolean serves both current-folder and whole-run cancellation.
- **Fix direction:** Use a run-scoped AbortController/result. Only reconcile removals and update `lastScannedAt=ready` after a fully completed walk; preserve prior availability on cancel/error. Keep the outer run canceled until it exits.
- **Regression test:** Cancel before permission, during nested walk, metadata parsing, DB write, between folders, and during removal reconciliation; assert no false missing flags and no later folder starts.
- **Scope:** Music; Chromium local-file data reliability.

### UXREL-MUSIC-002 — A stale track-selection request can start playback after a newer choice or disable

- **Area:** Music playback lifecycle/races
- **Severity/confidence:** P1 / confirmed
- **User impact:** Resolving a folder permission/file handle is asynchronous. If the user selects track A, then B, whichever source resolves last wins and overwrites the audio source and queue—even if it was the earlier click. If Music is disabled while permission is pending, the late continuation can create a new Audio object and begin playback after the feature was closed.
- **Evidence:** `playTrack()` at `src/apps/music/content.ts:1316-1343` has no lifecycle or request-generation checks before or after awaiting `resolveTrackAudioSource()`. It then mutates the shared audio URL, queue, current track, and calls `audio.play()`. `resolveTrackAudioSource()` awaits permission and file access at lines 1345-1366. Disable only pauses the Audio instance that exists at that moment at lines 298-306; pending playback construction is not abortable.
- **Reproduction:** Delay A's permission/file resolution, select A then B and resolve B first/A last. Separately disable Music while a permission request is pending, then grant it.
- **Likely root cause:** Playback selection has no latest-intent token or lifecycle AbortSignal across file-system prompts.
- **Fix direction:** Give each play request a monotonically increasing generation composed with the app lifecycle; after every await, discard/revoke stale sources. Disable/dispose must invalidate pending plays before pausing/clearing audio.
- **Regression test:** All A/B completion orders, denied/late permission, missing file, close versus disable, dispose/re-enable, and radio join races; assert last active user intent wins and disabled Music stays silent.
- **Scope:** Music; Chromium File System Access and local playback reliability.

### UXREL-MUSIC-003 — Radio synchronization changes with each participant's local matches

- **Area:** Music radio matching/synchronization
- **Severity/confidence:** P1 / confirmed
- **User impact:** Radio is described as a shared metadata playlist plus start time, but each participant removes locally unmatched or durationless tracks before computing total duration and position. Two people with different local libraries therefore calculate different cycle lengths/current tracks and do not actually join the same point in the session.
- **Evidence:** QR/radio payloads include ordered metadata and optional durations at `src/apps/music/content.ts:1666-1681`. `currentRadioPosition()` at lines 1799-1814 resolves each reference locally, filters out any track without a local match/duration, sums only the remaining local tracks, and applies `elapsed % total`. `joinRadio()` then queues only locally resolved IDs at lines 1817-1827.
- **Reproduction:** Join the same radio payload in two profiles where one lacks a middle track (or has a different parsed duration). Compare calculated label, offset, and current track at the same clock time.
- **Likely root cause:** Local playability filtering was applied before calculating the shared timeline rather than after choosing the shared slot.
- **Fix direction:** Define the radio timeline from payload order and shared duration metadata. Select the same slot/offset for everyone, then report “current track unavailable locally” or use an explicit skip policy that preserves a shared deterministic timeline/version.
- **Regression test:** Participants with all, some, duplicate, ambiguous, and zero matched tracks plus duration disagreements and clock offsets; assert identical shared slot calculation.
- **Scope:** Music radio; cross-device/product-contract reliability.

### UXREL-MUSIC-004 — One IndexedDB open failure poisons Music for the rest of the tab

- **Area:** Music storage startup/recovery
- **Severity/confidence:** P2 / confirmed
- **User impact:** If IndexedDB open fails once (blocked upgrade, transient browser storage failure, private-mode restriction), the rejected promise is cached forever. Every later Library action immediately receives the same rejection, including after closing/reopening Music, and initial load failures are launched without a catch or visible recovery state.
- **Evidence:** `dbPromise` is module-global at `src/apps/music/content.ts:259`. `openDb()` caches the promise and never resets it on `request.onerror` at lines 3403-3416. Boot/open invoke `void loadLibrary()` at lines 271-291; `loadLibrary()` awaits DB operations at lines 633-647 without error handling, so startup rejection is unhandled and no retry UI is set.
- **Reproduction:** Force the first `indexedDB.open` to error, restore IndexedDB, then reopen Music or perform a library action in the same tab.
- **Likely root cause:** Successful connection memoization also memoized transient failure, with no storage state machine.
- **Fix direction:** Clear the cached promise on rejection/versionchange/close, catch startup errors into a visible storage-recovery state, and offer Retry. Handle blocked upgrades and close stale connections explicitly.
- **Regression test:** Open error then success, blocked upgrade, versionchange, transaction abort/quota error, close/reopen, and disable during open; assert recovery without a tab reload.
- **Scope:** Music; cross-browser local storage reliability.

### UXREL-MILADYCHAN-001 — Out-of-order thread responses can replace the thread the user selected

- **Area:** Miladychan Portal navigation/request races
- **Severity/confidence:** P2 / confirmed
- **User impact:** Rapidly opening thread A and then thread B starts overlapping requests with no cancellation or request identity. If A resolves last, its payload overwrites `selectedThread`, so the panel shows A even though the user's last action selected B. An earlier request also clears the shared loading flag/error state while the newer request is still pending. The same shared-state race affects rapid board switches.
- **Evidence:** `openBoard()` writes global selection/loading state, awaits a request, and unconditionally clears `loadingThreads` at `src/apps/miladychan-portal/content.ts:387-416`. `openThread()` similarly sets `selectedThread`, awaits, then unconditionally assigns the response and clears `loadingThread` at lines 418-442. There is no AbortController, request generation, or check that `boardId/threadId` still matches current selection after the await. `fetchJson()` at lines 679-688 accepts no signal.
- **Reproduction:** Delay thread A, open A then B, resolve B first and A second; observe the final title/posts and loading state. Repeat with two uncached boards and one failing request.
- **Likely root cause:** View state and per-request state share booleans/selection fields without latest-request ownership.
- **Fix direction:** Give board and thread navigation separate generation IDs/AbortControllers, abort superseded work, and commit success/error/finally state only when the response still owns the current selection. Preserve cached data independently of active view state.
- **Regression test:** All A/B resolve and reject orderings, Back/Close/disable during fetch, refresh of the same thread, and stale board catalog completion; assert last user navigation always wins.
- **Scope:** Miladychan Portal; local/upstream-dependent navigation reliability.

### UXREL-BEETOL-001 — Non-auth server failures can cause Beetol actions to be submitted twice

- **Area:** Beetol authenticated action reliability
- **Severity/confidence:** P1 / confirmed
- **User impact:** A POST action that returns a non-auth failure such as HTTP 429 or 500 is automatically submitted again through the browser-session path. If the upstream service performed the mutation but failed while producing its response, users can consume charges or receive/convert inventory twice even though they clicked once. Rate-limited requests are also retried immediately instead of respecting backoff.
- **Evidence:** `remiliaAuthedFetch()` at `src/apps/beetol/background.js:155-163` calls `remiliaFetch()` first, then retries through `remiliaSessionFetch()` whenever the result is not `authRequired`—which includes all non-401/403 HTTP failures. `runAction()` uses this helper for the non-idempotent POST at lines 176-209, and `crunchJunk()` uses it repeatedly for mutations at lines 226-261. The helper does not limit fallback to safe methods or explicit authentication failures and supplies no idempotency key.
- **Reproduction:** Stub the first action POST to mutate state and return 500/429, then allow the session fallback to return 200. Count POSTs and resulting inventory/cooldown changes for one UI click.
- **Likely root cause:** A session fallback intended for authentication compatibility was generalized across all failure statuses and methods.
- **Fix direction:** Retry a mutation only after a definitive auth failure and successful credential renewal, or require an upstream idempotency key/action nonce. Never immediately replay 429/5xx POSTs; return a clear uncertain-outcome state and reconcile with a GET before enabling another action.
- **Regression test:** Matrix GET/POST against 401, 403, 409, 429, 500, network loss after send, malformed response, and successful renewal; assert at most one mutation unless an idempotency token proves replay safe.
- **Scope:** Beetol/RemiliaNET; upstream-dependent data reliability and trust.

### UXREL-BEETOL-002 — Rejected requests leave the game panel permanently busy

- **Area:** Beetol UI failure recovery
- **Severity/confidence:** P2 / confirmed
- **User impact:** If extension messaging rejects—for example during extension reload, MV3 worker restart, or a runtime bridge error—auth check, refresh, game action, and Crunch All Junk promises escape without restoring `state.loading`. The panel remains disabled/spinning and provides no retry feedback until it is remounted.
- **Evidence:** `checkAuthStatus()`, `refreshState()`, `runAction()`, and `crunchJunk()` set `state.loading = true`, await `send()`, and only clear loading on the resolved path at `src/apps/beetol/content.js:726-891`; none use `try/catch/finally`. The click callers at lines 896-926 invoke these async functions without catches. Initial `chrome.storage.local.get(...).then(...)` at lines 1131-1150 likewise has no rejection UI.
- **Reproduction:** Make the App SDK `sendMessage` reject during each operation, then inspect button disabled state, status copy, unhandled rejection, and whether Retry/Refresh can recover.
- **Likely root cause:** Message results were modeled as resolved error objects, while transport-level rejection was not included in the UI state machine.
- **Fix direction:** Centralize operations in a `try/catch/finally` wrapper that always clears loading, suppresses stale generations, distinguishes timeout/reload/offline/auth errors, and keeps Retry available.
- **Regression test:** Reject and abort every operation phase, including dispose during flight and late resolve; assert loading clears, one actionable error is announced, and the next attempt works.
- **Scope:** Beetol; local MV3/extension-lifecycle reliability.

### UXREL-BEETOL-003 — The whole Beetol panel is a one-second live region

- **Area:** Beetol screen-reader accessibility
- **Severity/confidence:** P2 / confirmed
- **User impact:** The entire interactive shell, including action buttons and countdowns, is marked `aria-live="polite"` and rerendered every second. Screen readers may repeatedly announce changing timers or treat rebuilt controls as live-region updates, making the panel noisy and difficult to navigate.
- **Evidence:** The shell receives `aria-live="polite"` in the markup at `src/apps/beetol/content.js:112-143`. `render()` replaces the action button subtree with `innerHTML` at lines 652-715. A repeating task calls `render()` every 1,000 ms at lines 1075-1078.
- **Reproduction:** Open signed-in Beetol with an active cooldown using a screen reader, focus an action, and wait through several countdown ticks; observe announcements and focus stability as the subtree is rebuilt.
- **Likely root cause:** A broad live region was used for status feedback while countdown rendering shares the same container.
- **Fix direction:** Remove live-region semantics from the shell, keep stable button nodes, and use a dedicated concise status element (`role=status`/polite) for action outcomes. Do not announce every countdown second; announce meaningful readiness transitions.
- **Regression test:** Screen-reader/DOM test proving stable focus across ticks, no repeated timer announcements, and one announcement for action success, failure, session expiry, and cooldown completion.
- **Scope:** Beetol; local cross-browser accessibility.

### UXREL-MAXXER-001 — Disabling Maxxer can leave filtered posts permanently hidden

- **Area:** Milady Maxxer reversible filtering/lifecycle
- **Severity/confidence:** P1 / confirmed
- **User impact:** When “Hide non-Milady or Beetle posts” (or the shared Milady-only visual mode) sets a post's inline `display` to `none`, disabling or disposing Maxxer removes its data attributes but does not restore the inline style. The native X posts remain absent until another specialized surface-clear path happens to process them or the page reloads. The implemented “Milady post hidden / Show” placeholder is never called, so users also have no per-post recovery while filtering is active.
- **Evidence:** Nonmatches are hidden directly at `src/apps/milady-maxxer/effects.ts:593-601`. `clearEffects()` correctly restores `tweet.style.display` at lines 168-173, and `clearTweetMaxxerState()` calls it at `src/apps/milady-maxxer/content.ts:1289-1293`. But app disable calls `disableMaxxerRuntime()` at lines 380-385; its tracked-element loop at lines 1338-1355 calls only `clearElementMaxxerState()`, which deletes datasets but never invokes `clearEffects()` or restores display. `applyHiddenState()` at `effects.ts:438-466` creates a recovery placeholder but has no call sites.
- **Reproduction:** Enable Milady mode plus hide-nonmatching posts, allow a nonmatch to become `style="display: none"`, then disable Maxxer from Apps & Features. Inspect the post's inline display and attempt to reveal it without reloading.
- **Likely root cause:** Bulk teardown uses a generic attribute cleanup instead of surface-specific reversible-effect cleanup, while two filtering implementations diverged.
- **Fix direction:** Route every tracked tweet through `clearTweetMaxxerState()` during disable/dispose and use one hiding primitive that always provides an accessible Show control. Ensure settings changes restore all existing nodes before rescanning.
- **Regression test:** Apply each mode/filter to matched, nonmatched, reply-context, quoted, and virtualized/reused posts; disable, switch mode, and dispose; assert native visibility/styles and DOM are fully restored.
- **Scope:** Milady Maxxer; local reliability and accessibility.

### UXREL-MAXXER-002 — One worker failure can stall all avatar inference for the rest of the tab

- **Area:** Milady Maxxer classifier failure/recovery
- **Severity/confidence:** P1 / confirmed
- **User impact:** If the ONNX worker errors, terminates, or never replies to one request, that detection never settles. Because inference concurrency is one, `activeDetections` remains occupied and every later avatar queues forever. Worker/model initialization failures are cached as rejected promises, while per-avatar failures are cached as permanent nonmatches, so transient extension/resource failures have no retry path short of a new tab.
- **Evidence:** `src/apps/milady-maxxer/detection.ts:39-47` holds module-lifetime cache, model promise, worker promise, pending requests, and a single-active queue. Queue advancement occurs only in the task promise's `finally` at lines 123-139. `scoreWithOnnx()` at lines 213-231 installs pending resolvers without a timeout or abort. `getWorker()` handles only `message`, with no `error`/`messageerror`/termination recovery at lines 173-208. `modelMetadataPromise` and `workerPromise` are never reset after rejection, and `detectAvatar()` caches the task before `detectAvatarUncached()` converts any error into an `err` nonmatch at lines 53-115. Dispose does not terminate/reset classifier state.
- **Reproduction:** Make the worker omit one response or dispatch an error, then enqueue several avatars. Observe one active detection and a growing queue indefinitely. Separately fail model/worker initialization once, restore the resource, and retry in the same tab.
- **Likely root cause:** The inference worker was treated as an infallible process and cached promises were given no failure-aware lifecycle.
- **Fix direction:** Add per-request deadlines and app AbortSignals; reject all pending requests on worker error, terminate/reset the worker, clear rejected model/worker/avatar promises, and allow bounded retry/backoff. Expose worker generation, oldest request age, failures, and queue drops in diagnostics.
- **Regression test:** Worker init error, runtime error, messageerror, missing reply, malformed reply, disable during active/queued work, successful retry, and cache-after-transient-failure tests; assert the queue always drains or fails promptly.
- **Scope:** Milady Maxxer local model; cross-browser worker reliability.

### UXREL-REMISTATS-001 — Expired score-cache entries are never evicted

- **Area:** RemiStats long-session memory/performance
- **Severity/confidence:** P2 / confirmed
- **User impact:** Every distinct X handle encountered is retained in `scoreCache` for the lifetime of the tab, including successful profiles and negative “not found” results. Entries stop being used after five minutes but remain stored. Scrolling large feeds/search/user lists over a long session therefore grows the cache monotonically and keeps full profile payloads alive.
- **Evidence:** The module-global unbounded map is created at `src/apps/remistats/content.js:43`. `processBatch()` adds positive, alternate-normalized, and negative entries at lines 357-395. `fetchUserScore()` checks age but does not delete stale entries at lines 437-444. Neither `disable()` nor `dispose()` at lines 2802-2837 clears or bounds `scoreCache`; the trophy cache separately has an explicit limit, showing bounded-cache intent elsewhere.
- **Reproduction:** Feed thousands of unique handles through `fetchUserScore`, advance beyond `CONFIG.cacheTimeout`, revisit or disable/re-enable, and inspect `scoreCache.size` and retained payloads.
- **Likely root cause:** TTL was implemented as read freshness rather than eviction, and no maximum-size policy was added.
- **Fix direction:** Use a bounded TTL/LRU cache, delete expired entries on lookup, periodically prune under idle budget, and clear it on full dispose if preserving it is not necessary. Expose cache size/hit/miss/eviction diagnostics.
- **Regression test:** Insert beyond the limit, advance fake time, and assert stale and least-recent entries are evicted while negative caching still prevents retry storms inside its TTL.
- **Scope:** RemiStats; local long-session performance.

### UXREL-REMISTATS-002 — Score badges act as links but are not keyboard-operable links

- **Area:** RemiStats accessibility and discoverability
- **Severity/confidence:** P2 / confirmed
- **User impact:** Pointer users can click a score badge to open the associated Remilia profile and hover it for a detailed tooltip. Keyboard and screen-reader users cannot focus or activate that profile action and receive no semantic indication that the badge is interactive; its metrics are primarily exposed through a mouse-hover surface.
- **Evidence:** `createScoreBadge()` creates a plain `<div>` at `src/apps/remistats/content.js:982-989` and stores a target URL in its dataset around lines 1050-1085, without `tabindex`, link/button role, or accessible name. Delegated behavior listens only to mouseover/mouseout/click at lines 1099-1174; the click path calls `window.open()` and there is no focus/keydown equivalent.
- **Reproduction:** Tab through a post/profile containing a RemiStats badge and attempt to open its profile or display its details using Enter/Space and a screen reader.
- **Likely root cause:** Delegated pointer behavior was added to a visual metric container without choosing a native interactive element.
- **Fix direction:** Make the profile action a real anchor with a meaningful accessible name and keep independent poke buttons outside it; provide focus-triggered, screen-reader-readable detail disclosure rather than hover-only HTML.
- **Regression test:** Keyboard/screen-reader tests for focus, announced score/beetles/profile destination, Enter activation, tooltip/detail disclosure, and nested poke separation.
- **Scope:** RemiStats; local cross-browser accessibility.

### UXREL-POST-001 — Switching between Wiki and tweet reading deadlocks the shared browser speech queue

- **Area:** Post-reading concurrent sessions
- **Severity/confidence:** P1 / confirmed
- **User impact:** The documented behavior says Wiki and tweet sessions pause each other. With the default Browser Web Speech engine, starting the other reader first pauses `window.speechSynthesis` globally, then queues the new utterance onto that same paused singleton. The newly requested reading can therefore remain silent. Stopping either controller also calls the global `cancel()`, which can terminate the other controller's utterance without updating that controller's state.
- **Evidence:** Tweet playback calls `pauseWikiReader()` before `speech.speak()` at `src/apps/post-reading/content.ts:644-665`; Wiki playback calls `pauseTweetReader()` before `wikiSpeech.speak()` at lines 703-711. Those helpers call each controller's pause path at lines 737-743. The Web Speech session maps pause/resume/stop directly to the page-global singleton at `src/apps/post-reading/ttsEngines.ts:102-106`. The two independent `SpeechController` instances are created at `src/apps/post-reading/content.ts:167-214`.
- **Reproduction:** Using Browser Web Speech, start a Wiki document, then activate reading on an X post (and repeat in the opposite direction). Observe whether the second utterance starts and whether each player state matches audible speech after Stop/Quit.
- **Likely root cause:** Two logical sessions were layered over a browser API whose pause and cancel operations are global, not utterance-scoped.
- **Fix direction:** Add one Post-reading speech-session coordinator. On a source switch, stop and snapshot the previous session before starting the new one, or explicitly cancel the shared queue and reconstruct only the selected session; synchronize UI state with that coordinator.
- **Regression test:** Fake the singleton Web Speech queue and cover tweet-to-Wiki, Wiki-to-tweet, pause/resume, Quit, completion, and rapid alternation. Assert exactly one audible/queued utterance and matching controller/player state.
- **Scope:** Post-reading; cross-browser Web Speech reliability.

### UXREL-POST-002 — Custom HTTP speech cannot be canceled while its request is pending

- **Area:** Post-reading local TTS lifecycle and failure recovery
- **Severity/confidence:** P1 / confirmed
- **User impact:** A slow or never-settling local TTS endpoint keeps its fetch active after the user presses Quit, disables Post-reading, changes route, or starts another item. No session object exists yet for `SpeechController.stop()` to stop, and there is no request deadline. A late response can still allocate/decode audio before the generation check discards the returned session.
- **Evidence:** `SpeechController.startCurrentChunk()` awaits `engine.speak()` and assigns `this.session` only after it resolves at `src/apps/post-reading/speech.ts:155-189`; `stopActiveSession()` can only stop an assigned session at lines 191-196. The custom engine creates its AbortController inside `speak()`, performs an unbounded fetch/JSON read at `src/apps/post-reading/ttsEngines.ts:127-143`, and exposes `abort.abort()` only in the session returned after `audio.play()` succeeds at lines 182-207.
- **Reproduction:** Configure Custom HTTP TTS to a loopback endpoint that accepts a POST but never responds. Start reading, then Quit/disable/start another post. Verify the request remains open and repeated reads create more pending requests.
- **Likely root cause:** Cancellation ownership is hidden inside the eventual `TtsSession`, leaving async session construction outside the controller lifecycle.
- **Fix direction:** Pass a controller-owned AbortSignal into `TtsEngine.speak`, compose it with a defined request/body/audio-start deadline, and abort pending construction on every generation change. Clean up any object URL/audio element on pre-session failure.
- **Regression test:** Never-settling fetch, slow JSON, rejected `audio.play()`, disable, Quit, source switch, and late response tests; assert prompt settlement and no playback/allocation after cancellation.
- **Scope:** Post-reading custom local service; lifecycle and upstream-dependent reliability.

### UXREL-POST-003 — A silent OCR-host startup failure permanently poisons retries in the tab

- **Area:** Post-reading OCR startup/recovery
- **Severity/confidence:** P2 / confirmed
- **User impact:** If the hidden OCR iframe neither sends its ready message nor emits an error, the first read reports a 15-second timeout. Later reads reuse the same permanently pending promise and time out forever; the host is never rebuilt. A 45-second recognition timeout also leaves that request's window message listener installed until a matching late response or abort.
- **Evidence:** `recognizeImageText()` wraps `ensureHostFrameReady()` in an external 15-second timeout at `src/apps/post-reading/ocr.ts:54`, while `ensureHostFrameReady()` returns any cached `hostReadyPromise` at lines 112-117 and only resets it from the iframe `error` handler at lines 123-127. Recognition cleanup is inside the inner message promise at lines 61-91, but the outer 45-second `withTimeout()` at line 59 does not invoke it.
- **Reproduction:** Suppress the iframe ready message without firing an error, attempt OCR twice, and observe the same frame/pending promise reused. Suppress a recognition result/error and inspect the message listener after 45 seconds.
- **Likely root cause:** Deadlines race promises without owning or cleaning up the underlying initialization/request resources.
- **Fix direction:** Make readiness timeout clear `hostReadyPromise`, remove/recreate the frame, and reject waiters. Give each request one finally-based cleanup path and send a cancel when its deadline fires.
- **Regression test:** Missing ready, iframe error, late ready, recognition timeout, late result, retry-after-failure, disable, and simultaneous waiters; assert a rebuilt host and zero stale listeners.
- **Scope:** Post-reading OCR; local extension-frame reliability.

### UXREL-POST-004 — Disposing Post-reading leaves both player trees mounted

- **Area:** Post-reading disable/re-enable lifecycle
- **Severity/confidence:** P2 / confirmed
- **User impact:** Every full dispose/re-enable cycle creates new tweet and Wiki `MiniPlayer` DOM trees while the prior hidden trees remain in the page with their control/listener closures. Long-lived X tabs accumulate extension UI and stale event interception surfaces even though only the newest instances are controlled.
- **Evidence:** Boot constructs two `MiniPlayer` instances at `src/apps/post-reading/content.ts:167-214`. Each constructor appends its root to `document.body` at `src/apps/post-reading/player.ts:67-224`, and the class has no dispose/remove method. `src/apps/post-reading/content.ts:362-371` closes players via `disable()` and removes only `appFrame`; it neither removes player roots nor clears player/controller references before a later boot.
- **Reproduction:** Enable Post-reading, force full app dispose, re-enable several times, then count `.post-reading-player` roots and inspect hidden controls/listeners.
- **Likely root cause:** Player close/minimize was reused as teardown even though it only animates/hides the root.
- **Fix direction:** Add an idempotent `MiniPlayer.dispose()` that aborts probes/animations, detaches from Wiki slots, removes the root, and clears references. Dispose both players/controllers explicitly.
- **Regression test:** Repeated boot/disable/dispose/re-enable cycles asserting exactly two live player roots while enabled and zero after dispose, with no stale speech/listener activity.
- **Scope:** Post-reading; local lifecycle/performance/accessibility reliability.

### UXREL-ACCESS-004 — Runtime mode select has no accessible name

- **Area:** popup accessibility
- **Severity/confidence:** P2 / confirmed (source + rendered browser evidence)
- **User impact:** Screen-reader users encounter an unnamed combobox for global Performance mode. The nearby visible “Runtime mode” text is a plain span and is not programmatically associated with the select, so the control's purpose must be inferred from region context.
- **Evidence:** `assets/extension/popup/popup.html:70-79` places “Runtime mode” in a `<span>` and the `#performanceMode` select has no enclosing label, `<label for>`, `aria-label`, or `aria-labelledby`. A rendered Chromium accessibility snapshot of `dist/popup.html` exposed the Global performance region followed by an unnamed `combobox`; the neighboring Preferred LLM select was correctly exposed as `combobox "Preferred LLM"`.
- **Reproduction:** Open the extension popup with a screen reader or inspect its accessibility tree, navigate to Global Performance, and focus the runtime-mode select.
- **Likely root cause:** The styled field pattern was reproduced without its semantic label wrapper.
- **Fix direction:** Wrap the text and select in a `<label class="field">` or add a stable label ID plus `aria-labelledby`; associate the Apply result with the control where useful.
- **Regression test:** Accessibility-tree assertion that every popup input/select has a nonempty accessible name, plus keyboard navigation through all tabs.
- **Scope:** popup; local cross-browser accessibility.

### UXREL-ACCESS-001 — Rail/app reordering is pointer-only

- **Area:** side rail and Apps & Features accessibility
- **Severity/confidence:** P2 / confirmed
- **User impact:** Keyboard-only and many assistive-technology users cannot reorder pinned apps or app stacking. Reordering requires a pointer long-press/drag on rail buttons or a pointerdown on an aria-hidden drag handle. The dock settings “Reorder” view renders static rows without move controls.
- **Evidence:** Pointer-only dock reordering is implemented at `src/platform/overlay/dock.ts:390-463`; settings rows at lines 483-548 contain no actionable reorder controls. The Apps & Features drag handle is `aria-hidden` and only registers `pointerdown` at `src/platform/runtime/content-runtime.ts:1903-1910` and uses window pointer events at lines 2269-2305.
- **Reproduction:** Navigate Apps & Features and dock settings using only Tab, Enter, Space, and arrow keys. Attempt to change app order without a pointing device.
- **Likely root cause:** Reordering was designed around direct manipulation without a keyboard interaction model.
- **Fix direction:** Provide labeled Move up/Move down controls (and optionally an ARIA sortable-list pattern with announcements) in dock settings; preserve focus after rerender.
- **Regression test:** Keyboard-only test that changes order, persists it, reloads, and verifies both rail order and stacking order.
- **Scope:** local accessibility.

### UXREL-ACCESS-002 — Dock reorder animation ignores reduced-motion preference

- **Area:** side rail accessibility
- **Severity/confidence:** P3 / confirmed
- **User impact:** Entering reorder mode applies a continuous 150 ms alternating wiggle to rail items even for users who request reduced motion.
- **Evidence:** `src/platform/overlay/dock.ts:761` applies the infinite `milxdy-dock-wiggle` animation and the dock stylesheet has no `prefers-reduced-motion` override. Shared app-window open/close animation does include such an override in `src/platform/overlay/app-chrome.ts:65-70`, showing the expected project convention.
- **Reproduction:** Enable OS/browser reduced motion, enter rail reorder mode, and observe computed animation on dock items.
- **Likely root cause:** Dock animation predates or bypasses the shared app-chrome motion handling.
- **Fix direction:** Disable the wiggle under `@media (prefers-reduced-motion: reduce)` while keeping a static visual reorder indicator.
- **Regression test:** CSS/runtime assertion for `animation-name: none` in reduced-motion mode.
- **Scope:** local accessibility; cross-browser.

### UXREL-ACCESS-003 — Popup dialogs do not maintain modal keyboard focus

- **Area:** popup accessibility
- **Severity/confidence:** P2 / confirmed
- **User impact:** The Full Appearance warning moves initial focus and closes on Escape, but does not trap Tab or restore focus to the invoking control. The Wiki helper dialog does not move focus, close on Escape, trap focus, or restore it. Keyboard and screen-reader users can interact with controls behind an element marked `aria-modal=true` or lose their place after closing it.
- **Evidence:** Dialog markup is at `assets/extension/popup/popup.html:485-507`. Full Appearance handling at `src/extension/popup/index.ts:862-900` only focuses Proceed and handles Escape/backdrop. Wiki helper handling at lines 1583-1638 only toggles `hidden` and handles button/backdrop clicks.
- **Reproduction:** Open each dialog, use Shift+Tab/Tab beyond its first/last control, press Escape, and inspect focus after close.
- **Likely root cause:** Visual modal behavior was implemented without a shared dialog/focus utility.
- **Fix direction:** Use native `<dialog>` where feasible or add a shared focus trap, Escape handler, inert background, labelled status region, and focus restoration.
- **Regression test:** Automated keyboard sequence for initial focus, focus containment, Escape/backdrop/close-button behavior, and return focus.
- **Scope:** popup accessibility; cross-browser.

### UXREL-DOC-001 — Release planning sources contradict the current build

- **Area:** documentation, planning, contributor/release UX
- **Severity/confidence:** P3 / confirmed
- **User impact:** A contributor or audit agent following `PLANNING.md` is told that 0.2.1 is the current public baseline and 0.2.2 is next, while the checked-out product identifies as 0.2.2-hotfix.1/0.2.2.1 and the roadmap says 0.2.2 shipped. This can send fixes, QA, changelog entries, and issue milestones toward the wrong release assumptions.
- **Evidence:** `package.json:3-4`; `assets/extension/manifest.json:4`; `PLANNING.md:7`; `PLANNING.md:16`; `docs/ROADMAP.md:102`.
- **Reproduction:** Read the planning handoff as instructed by the repository, then compare it with package/manifest versions and the roadmap's shipped heading.
- **Likely root cause:** Release documentation was updated unevenly during the 0.2.2/hotfix work.
- **Fix direction:** Make one current-release source authoritative and update or explicitly archive the stale 0.2.1/next-0.2.2 planning handoff. Clarify whether 0.2.2.1 is a released baseline or only the current release candidate.
- **Regression test:** Extend release-current verification to assert that active planning/current-release statements agree with package, manifest, changelog, release notes, and roadmap status, while excluding historical headings.
- **Scope:** local documentation/release process.

## Test And Observability Gaps

- The conventional unit suite covers only update selection/version behavior (1 file, 5 tests). Most feature assurance comes from source/manifest verifiers and build smoke scripts.
- Browser-runtime proof remains unavailable for authenticated X virtualized DOM, lifecycle cleanup, overlay interaction, browser speech/filesystem APIs, MV3 suspension, and external-service recovery.
- No focused shared-runtime tests currently inject rejecting lifecycle hooks, surface handlers, or scheduler callbacks, despite those being cross-app failure boundaries.
- Reset verification checks schema/mirror structure but does not seed and protect user-content keys or validate confirmation/error UX.
- Network diagnostics record counts and latency only after completion; they do not expose active task age, queued task age, timeout count, or cancellation of active work.
- Chat attachment verification does not exercise memory behavior near the advertised maximum size or service-worker interruption during upload.
- No deterministic test harness exercises Web Speech's page-global pause/cancel semantics, Maxxer worker loss, Music File System Access/IndexedDB failures, or stale-request ordering in Music/Miladychan.
- Firefox lint's 31 generated-code/vendor warnings are not individually adjudicated by a source-aware allowlist, which makes regressions harder to distinguish from known bundler/library patterns.

## Unverified Or Environment-Dependent Areas

- Authenticated RemiliaNET, Beetol, poke, and RemiNet Chat behavior was unavailable because the audit browser had no RemiliaNET session; 2FA, token expiry, logout, reconnect-after-sleep, and live schema behavior remain unverified.
- Live X navigation reached the sign-in screen. Home, profile, post detail, Notifications, Messages, search, Articles, composers, virtualization, SPA transitions, and extension-reload behavior were therefore not live-tested.
- The extension was not installed in the in-app browser. The built popup was rendered locally, but extension storage/tabs/runtime APIs, content injection, service-worker suspension, and full popup interactions were unavailable.
- Full Music folder behavior requires user-granted Chromium File System Access and representative local media. No folder permission was requested; Firefox degradation requires a Firefox runtime run.
- Voice boundary behavior depends on browser/OS voices. No audible speech was initiated. OCR and local ONNX inference need representative assets and timing/failure injection.
- OS-level screen reader, reduced-motion, high zoom, and narrow X viewport interaction were not available. Popup accessibility-tree and narrow-viewport structure were checked in Chromium only.
- External Remilia, RemiStats, Miladychan, MusicBrainz, Wiki, Grok, and media endpoints were not fault-injected; source-level failure paths are recorded without asserting current upstream behavior.

## Prioritized Contributor Backlog

The 43 deduplicated findings comprise 19 P1, 21 P2, and 3 P3 items; no P0 was found. The ordering below groups implementation shape, not severity replacement—the individual finding remains authoritative.

### Quick wins

- `UXREL-TWEETPNG-002`: return an explicit unsupported/permission failure and offer Download instead of reporting a false copy.
- `UXREL-ACCESS-004`: label the Runtime mode select.
- `UXREL-ACCESS-002`: add a reduced-motion override for dock wiggle.
- `UXREL-DIAG-001`: preserve/recompute active observer count when resetting counters.
- `UXREL-DOC-001`: reconcile or archive stale `PLANNING.md` release statements and include them in release-current checks.
- `UXREL-SETTINGS-001`: add confirmation and separate factory settings from user-authored lists before any larger reset redesign.

### Medium-sized fixes

- Harden runtime isolation and startup: `UXREL-RUNTIME-001`, `UXREL-RUNTIME-002`, `UXREL-RUNTIME-003`, `UXREL-BOOT-001`, and `UXREL-BOOT-002`.
- Repair settings/onboarding state contracts: `UXREL-SETTINGS-002` and `UXREL-ONBOARD-001`.
- Make feature UI lifecycle/focus reversible: `UXREL-WIKI-001`, `UXREL-WIKI-002`, `UXREL-WIKI-004`, `UXREL-POST-004`, `UXREL-ACCESS-001`, `UXREL-ACCESS-003`, `UXREL-REMISTATS-002`, `UXREL-BEETOL-003`, and `UXREL-CHAT-005`.
- Fix bounded package recovery: `UXREL-ROOT-001`, `UXREL-MILADYCHAN-001`, `UXREL-CHAT-003`, `UXREL-CHAT-004`, `UXREL-POST-003`, `UXREL-MUSIC-004`, `UXREL-BEETOL-002`, and `UXREL-REMISTATS-001`.
- Restore Tweet PNG's promised review flow (`UXREL-TWEETPNG-001`) and stream-cap Chat media (`UXREL-CHAT-001`).

### Architectural follow-ups

- Add an owned deadline/cancellation contract to both network queues and app work (`UXREL-NET-001`), then apply it to local TTS (`UXREL-POST-002`), Chat socket setup (`UXREL-CHAT-003`), Grok workflow (`UXREL-WIKI-003`), and package request generations.
- Replace independent Web Speech controllers with one coordinated session model (`UXREL-POST-001`).
- Give Maxxer's classifier a restartable worker lifecycle, per-request deadlines, and failure-aware caching (`UXREL-MAXXER-002`).
- Make Music scanning transactional/cancel-safe and playback latest-intent-owned (`UXREL-MUSIC-001`, `UXREL-MUSIC-002`); define radio against a shared timeline contract (`UXREL-MUSIC-003`).
- Redesign large Chat attachment transfer to avoid base64/runtime-message amplification (`UXREL-CHAT-002`).
- Require idempotency/reconciliation for Beetol mutations before any retry (`UXREL-BEETOL-001`).
- Consolidate Maxxer filtering onto one accessible, fully reversible primitive (`UXREL-MAXXER-001`).

### Communicate rather than fix

- Keep Firefox's lack of full local-folder Music support explicit; do not imply parity with Chromium File System Access.
- Document that voice availability, boundary timing, autoplay permission, and codec support depend on browser/OS and can degrade to estimated highlighting or metadata-only matching.
- Document that authenticated RemiliaNET, Grok, Wiki, board, metadata, and media features depend on upstream schemas/availability; surface typed recovery states instead of promising uninterrupted service.
- Clarify that playlist/radio QR payloads contain metadata rather than audio and that local library matching can leave tracks unresolved.

## Completion Ledger

Complete for the available environment:

- all 12 registered first-party packages and shared platform layers were statically traced;
- documented happy paths, lifecycle/state ownership, primary failure branches, storage, network, UI response, cleanup, and recovery were mapped;
- 43 findings were deduplicated, severity-ranked, and written with evidence, reproduction, root cause, fix direction, regression test, and scope;
- the full initial baseline was rerun successfully and extended with builds, smoke, Music, escaping, Firefox lint, and release-current verification;
- Chromium popup accessibility received bounded rendered evidence; unauthenticated X state was observed;
- every unavailable authenticated, browser-specific, permission-gated, external-service, and assistive-technology scenario is listed above.

During the audit phase, no product source was modified, committed, pushed, or turned into issues; this report was the only audit-created artifact. The subsequent 0.2.3 remediation pass modified product code and release documentation on its dedicated fix branch, while preserving that audit baseline and evidence history.
