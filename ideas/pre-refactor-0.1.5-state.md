# Pre-Refactor 0.1.5 State

This note captures the architecture and feature state after the `0.1.5` update and before the app-platform refactor. It is not a new release note. It exists so the refactor agent can preserve the shipped 0.1.5 behavior while cleaning up the runtime.

## 0.1.5 Feature Surface Added Or Expanded

The `0.1.5` cycle significantly increased the number of active feature surfaces inside the extension:

- Unified popup **Audio** controls for Postreader, RemiStats, Milady Maxxer, and visual interaction sounds.
- RemiNet Chat replies, reply previews, reply context, richer reactions, video hydration, and profile lookup caching.
- Browser-session RemiliaNET auth with explicit disconnect/retry behavior.
- X-native RemiStats poke controls, persisted poke cooldowns, gold incoming-poke styling, and Milady Maxxer XP credit for successful pokes.
- Beetol cooldown persistence, hunt-charge display, and clearer ready/cooldown/exhausted states.
- Beetle trophy shelf profile banners and profile banner cycling between original, trophy shelf, and random Banners NFT modes.
- Tweet PNG export from X/Twitter share actions with local rendering, clipboard/download/share, media, quotes, dates, RemiStats values, and appearance controls.
- Repeatable Chromium and Firefox build targets, Firefox manifest generation, Firefox linting, and Firefox QA docs.
- Shared X/Twitter scanner improvements, scanner diagnostics, and feature timing diagnostics.

These changes are useful and should be preserved. The refactor should treat them as current product behavior, not as experimental code to remove.

## Runtime Shape Before Refactor

The project now has a partial shared layer:

- `src/shared/twitterScanner.ts` emits Twitter/X surfaces and writes scanner diagnostics.
- `src/shared/performanceDiagnostics.ts` records feature timings.
- `src/shared/overlayDock.ts` and `src/shared/overlayAppFrame.ts` provide a shared side-rail foundation.
- `src/shared/extensionRuntime.ts` wraps local storage and runtime messaging after extension invalidation.
- `src/content.ts` lazy-loads feature bundles only when enabled.

However, much of the 0.1.5 work landed inside feature-specific scripts. The shared runtime is not yet strong enough to prevent duplicated scans, observers, timers, storage watchers, panel layout code, and background message code.

## Main Pre-Refactor Pressure Points

### Content bootstrap

`src/content.ts` is doing several jobs at once:

- feature enablement and lazy imports
- reskin profile application
- X theme detection
- notification unread markers
- tweet header markers
- Tweet PNG share-menu injection and rendering
- feature CSS injection
- loaded-feature diagnostics

This should become a small bootstrap over a shared content runtime and first-party app registry.

### Scanning and scheduling

0.1.5 improved shared scanning, but features still maintain their own local work loops:

- RemiStats still has full `querySelectorAll` passes and interval route/profile rescans.
- Milady Maxxer has its own visibility/idle queue and periodic profile/logo work.
- Beetol has a photo-viewer mutation observer, one-second render/update checks, and a one-minute state refresh.
- Overlay apps duplicate theme observers, resize listeners, layout work, and render scheduling.

The refactor should move general scanning, route detection, visibility gating, idle scheduling, and diagnostics into one content runtime.

### Overlay and side-rail apps

The side rail exists, but each overlay/panel app still owns too much repeated behavior:

- Music
- RemiNet Chat
- Miladychan Spotlight
- Beetol
- Milady Maxxer panel
- Postreader player

Repeated patterns include:

- side selection
- top/width/height persistence
- viewport clamping
- drag and resize handlers
- open/minimized state
- theme resolution
- dock badge/title updates
- render debounce behavior

These should move into a shared panel/dock app base that future app-store developers can inherit or compose.

### Background and network services

The background layer has several separate message handlers:

- root `src/background.ts`
- Beetol background
- RemiNet Chat background
- Postreader background
- Milady Maxxer background
- Wiki background

0.1.5 added or expanded several network bridges: RemiNet auth/session, chat history/media/profile, Beetol actions/pokes, RemiStats user lookup, Tweet PNG/Banners NFT image data URLs, MusicBrainz/AcoustID, and update checks.

The refactor should centralize message routing, typed request/response envelopes, strict URL allowlists, shared fetch helpers, data URL conversion, and Remilia auth/session helpers where behavior overlaps.

### Build and package shape

The Firefox/Chromium build pipeline from 0.1.5 is a good base, but it still hardcodes first-party feature entries and asset copies in `scripts/build.mjs`.

For the next platform direction, the build should be driven by app manifests or a first-party app registry. Built-in apps should compile through the same conceptual path that future GitHub app-store packages will use.

## Behavior To Preserve

The refactor must preserve:

- existing first-party app enablement defaults
- lazy loading of disabled or optional features
- current RemiNet browser-session auth behavior
- explicit disconnect/retry behavior
- persisted poke cooldowns
- Tweet PNG local-only render/review/copy/download/share behavior
- Firefox and Chromium build targets
- current diagnostics controls and outputs, improving them where useful
- current side-rail app availability and user-facing controls

## Refactor Bias

Treat `0.1.5` as the last feature-heavy beta before platform cleanup. The next work should bias toward:

- fewer observers
- fewer intervals
- less duplicated DOM scanning
- shared app lifecycle
- shared panel primitives
- typed background services
- manifest-driven packaging
- app SDK documentation

The goal is not only cleaner code. The goal is a faster extension that can support externally developed small apps without every app re-implementing the same scanner, panel, storage, theme, and background plumbing.
