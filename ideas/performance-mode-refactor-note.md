# Performance Mode Refactor Note

This note supplements `ideas/app-platform-refactor-handoff.md` and `ideas/pre-refactor-0.1.5-state.md`. It focuses on speeding up X/Twitter page load and keeping milXdy scalable as a side-rail app platform.

## Design Philosophy

milXdy should separate two user choices that are currently blended together:

- **Appearance intensity**: how much milXdy visually changes X.
- **Performance mode**: how aggressively milXdy spends CPU, network, storage, workers, and DOM work to enhance X.

The existing Minimal / Medium / Max appearance profiles should remain about visual transformation and ambient behavior. A new performance setting should independently control runtime eagerness.

Implementation simplicity is not the constraint. The right long-term architecture is worth the work. The platform should be strong enough that future first-party and third-party apps cannot casually degrade X page load.

## Proposed User-Facing Performance Modes

### Fast

Prioritize X responsiveness.

- Import only essential runtime code at page load.
- Process only visible or near-visible surfaces.
- Do not proactively enrich offscreen timeline items.
- Load heavy dock apps only when opened or invoked.
- Defer or disable ONNX/model inference unless the user explicitly opens/uses the relevant feature.
- Batch RemiStats/profile/poke lookups with strict limits.
- Avoid periodic safety scans except rare route recovery.
- Use small idle budgets and low network concurrency.

### Balanced

Default mode.

- Process visible and near-viewport surfaces.
- Batch enrichment with moderate idle budgets.
- Register dock metadata cheaply; import full app bundles on open or when their surface behavior is needed.
- Allow limited route/profile recovery scans.
- Keep user-visible enhancements timely without blocking X page load.

### Full

Favor richer enhancement over minimum resource use.

- Larger idle budgets.
- More eager enrichment after the page settles.
- Preload likely-needed app code after initial X load is quiet.
- Process more offscreen timeline items.
- Allow richer Maxxer, RemiStats, Wiki, and profile-banner behavior to appear sooner.
- Still forbid independent broad scanners and unbounded intervals.

### Developer / Diagnostics

For testing and performance work.

- Enables scanner/runtime/app timing diagnostics.
- Records queue depth, cache hit/miss counts, skipped surfaces, network batch sizes, worker/model timings, and long tasks.
- Can expose stricter warnings when apps create broad observers, intervals, or unbudgeted work.
- Not intended as the normal user default.

## Runtime Rule

Performance mode must tune the shared runtime, not feature-specific ad hoc behavior.

Apps should declare cost and surface requirements. The runtime should enforce budgets, scheduling, lazy imports, batching, and visibility rules.

Example manifest shape:

```ts
type AppCostProfile = {
  startup: "cheap" | "moderate" | "heavy";
  perSurface: "cheap" | "moderate" | "heavy";
  network: "none" | "batched" | "eager";
  worker: "none" | "optional" | "heavy";
  domWrite: "small" | "moderate" | "large";
};
```

Runtime decisions should include:

- whether to import the app during initial boot
- whether offscreen surfaces are delivered
- idle budget per frame
- batch size and network concurrency
- whether workers/models may preload
- whether safety rescans run
- how much background enrichment is allowed
- whether dock apps hydrate fully or stay metadata-only

This also becomes the review model for future GitHub app-store packages.

## Twelve Refactor Priorities For Speed

### 1. Make the bootstrap tiny

`content.js` should only:

- initialize the shared runtime
- apply essential root CSS/runtime state
- register cheap app metadata
- decide what to lazy-load

Anything heavy, optional, visual, audio, OCR, ONNX, Music, Chat, Wiki matching, Tweet PNG rendering, or profile enrichment should not parse or initialize during initial X page load unless the selected performance mode allows it.

### 2. Build one scanner with richer records

The shared scanner should extract reusable records once:

- `TweetRecord`
- `UserRecord`
- `ProfileRecord`
- `NotificationRecord`
- `DirectMessageRecord`
- `RouteRecord`

Records should include handles, avatar URLs, text containers, status URLs, media, action rows, quote tweet references, timestamps, and stable cache keys where available.

Apps should not repeatedly rediscover these facts with their own `querySelectorAll` calls.

### 3. Replace polling with event-driven route and layout signals

Avoid permanent 500ms, 1s, or 2.5s loops.

Use:

- patched `history.pushState`
- patched `history.replaceState`
- `popstate`
- `hashchange`
- visibility changes
- scanner mutation batches
- explicit app/user events

Timers should be rare, bounded, and paused while hidden.

### 4. Visibility-gate expensive work

Run expensive app behavior only for visible or near-visible content unless performance mode says otherwise.

This includes:

- Milady/collection image detection
- RemiStats fetches
- Wiki matching
- Postreader button insertion
- profile banner work
- media hydration
- profile lookup enrichment

Offscreen timeline items should be queued, skipped, or delayed.

### 5. Centralize idle scheduling

Use one runtime-owned priority queue.

Suggested priority classes:

- immediate UI correctness
- visible surface app work
- near-viewport app work
- user-triggered actions
- background enrichment
- diagnostics

Process a bounded amount per idle frame. No app should own an unbounded queue or bypass runtime budgets for routine surface work.

### 6. Cache by stable keys

Use stable keys, not only WeakMaps, because X remounts DOM frequently.

Cache by:

- tweet ID/status URL
- handle
- normalized avatar URL
- profile route
- message ID
- settings signature
- app version or processing signature

Settings changes should invalidate affected caches intentionally.

### 7. Split DOM marking from enrichment

First pass should be cheap:

- mark surface as seen
- insert lightweight placeholder/button if needed
- attach stable data attributes

Later passes should handle:

- network fetch
- image/model detection
- profile enrichment
- media hydration
- expensive text matching

This keeps initial X render responsive.

### 8. Batch and dedupe network work globally

Create shared services for profile/user/enrichment data.

Likely services:

- `ProfileService`
- `RemiliaService`
- `RemiStatsService`
- `MediaProxyService`
- `MusicLookupService`

These services should dedupe requests across apps. RemiStats, RemiNet Chat, Beetol, and Maxxer should not each maintain isolated lookup behavior for overlapping profile/user data.

### 9. Move heavy optional apps behind user action

Music, Miladychan Spotlight, RemiNet Chat, Tweet PNG rendering, OCR, ONNX/model loading, and other heavy modules should not fully load just because X opened.

The dock can register cheap metadata first:

- id
- label
- icon
- enabled state
- badge placeholder

Full app code should load when:

- the user opens the app
- a relevant surface becomes visible and the app is enabled
- performance mode allows preload after idle

### 10. Prefer CSS state over DOM rewrites

For appearance profiles, set root data attributes and let CSS do as much as possible.

Avoid repeated walking of:

- header/sidebar
- entire timeline
- notification list
- all tweet/user cell nodes

Inline style mutation should be a fallback, not the primary reskin mechanism.

### 11. Reduce root `content.ts`

Root content should stop acting as a mega-feature.

Move these into runtime services or apps:

- Tweet PNG share action and rendering
- notification unread marking
- tweet header markers
- visual interaction sounds
- X theme detection
- reskin application
- feature boot/loading

Root content should coordinate, not implement feature behavior.

### 12. Measure the right things

Diagnostics should record:

- content bootstrap parse/init time
- app metadata registration time
- app full import/load time
- mutation count
- surfaces queued/emitted
- per-app surface processing time
- skipped cached surfaces
- idle queue depth
- network batch size and latency
- model/worker load and inference time
- long tasks over 50ms
- disabled app import avoidance

Performance work should be guided by these numbers, not guesses.

## Acceptance Criteria For This Layer

- X page load performs minimal work before first interactive use.
- Disabled apps do not import full bundles or initialize workers/assets.
- Dock metadata can appear without hydrating full app code.
- One runtime owns scanning, routing, scheduling, and performance budgets.
- Performance mode changes runtime behavior globally and predictably.
- Apps declare cost; the runtime enforces cost.
- Future app-store packages cannot create unbounded scanners, timers, or network work without review.
- Diagnostics make slow apps and queues visible.
