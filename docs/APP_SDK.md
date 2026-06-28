# milXdy App SDK

milXdy first-party features now run through a shared app platform instead of each feature owning its own bootstrap path. The current SDK is intentionally local-first: built-in apps use the same manifest concepts future external packages should use, while external package loading, remote install/update UX, and a stable third-party API remain future work.

## Developer Preview Status

`0.2.0` is an app-platform preview. It is meant to show the direction, document the vocabulary, and give developers enough structure to begin designing milXdy apps, but it is not the final mod system.

The long-term goal is a complete composable app/mod system where default apps and community apps can live as packages in an apps folder. In that model, an app should declare its surfaces, permissions, assets, dock behavior, performance cost, privacy notes, and lifecycle hooks through a manifest instead of wiring itself directly into the extension root.

That final shape needs more refactoring before it can be safe and efficient. Most milXdy apps touch the same expensive X/Twitter substrate: timeline scanning, user/profile detection, route changes, media surfaces, visual effects, background fetches, and overlay panels. The platform needs those systems to stay shared so every app does not bring its own observer, poller, scanner, animation layer, or network queue. Until that extraction is complete, first-party apps remain bundled in the extension while the registry, lifecycle, Apps Hub, and rail establish the contract future packages should target.

Developers can use this document to plan app ideas now, especially around manifests, declared surfaces, load triggers, performance cost, Hub disclosure, and docked UI behavior. Treat the APIs here as the current internal contract and the public design direction, not a finalized third-party compatibility promise.

## App Manifest

Each first-party app declares static platform, package, and Hub metadata in `src/shared/firstPartyApps.json`. Runtime-only enablement adapters live in `src/shared/firstPartyApps.ts` because they need browser storage reads, but build outputs, content entries, costs, surfaces, dock metadata, permissions, app-card metadata, privacy notes, and background service declarations come from the shared JSON registry.

Required fields:

- `id`, `name`, `version`, `description`
- `contentEntry` for the lazy-loaded content bundle
- `defaultEnabled` plus `storageKeys` used for enablement changes; adapters read `defaultEnabled` as the fallback when no stored user choice exists
- `surfaces` such as `tweet`, `userCell`, `profile`, `notification`, `directMessage`, `route`, or `overlayApp`
- `package` asset hints for build and app-store presentation
- `cost` for startup, per-surface, network, worker, and DOM-write expense
- `loadTriggers` such as `startup`, `surface`, `dockOpen`, `idle`, or `userAction`
- `hub` metadata for category, app-card text, preset membership, rail support/default pinning, permission notes, data notes, remote services, local storage notes, and privacy labels

Optional fields:

- `css` files injected before the content bundle loads
- `deliverySurfaces` to narrow which Twitter/X surface kinds call `onSurface()` when an app declares broader `surfaces` only for import timing
- `dock` metadata for apps that appear in the shared overlay dock
- `background.messageTypes` and `background.services`
- `permissions.hosts` for URL allowlist documentation

`src/shared/firstPartyApps.json` is the source of truth for first-party package metadata. `src/shared/firstPartyApps.ts` adapts that static registry into runtime manifests by adding storage-backed `isEnabled()` functions, and `scripts/build.mjs` consumes the same JSON for bundle entries, copied assets, CSS, web-accessible files, and required outputs.

## Content Runtime

`src/shared/contentRuntime.ts` owns content app lifecycle:

- one shared Twitter surface scanner
- SPA route and visibility detection
- lazy app import based on manifest enablement
- global Performance mode budgets independent of Appearance profiles
- stylesheet injection
- idle-scheduled surface forwarding for SDK-style modules
- runtime/app diagnostics under `milxdy.diagnostics.*`

Content app bundles are runtime-owned and should not self-boot. Apps export lifecycle hooks such as `boot`, `enable`, `disable`, `onRouteChange`, `onSurface`, and `dispose`; the runtime imports enabled apps and calls those hooks according to manifest triggers and the active Performance mode.

The root content entry should stay a tiny bootstrap. Shared page-wide visual state, including reskin dataset application, X theme detection, and sidebar icon color correction, lives in `src/shared/rootVisualState.ts`. New page-wide behavior should become a shared runtime service or a manifest app instead of being added directly to `src/content.ts`.

Use `onSurface(surface)` for Twitter/X surfaces. The runtime performs visibility gating, import decisions, diagnostics, and idle scheduling before invoking the hook, so apps should not subscribe directly to the scanner or install broad page observers for routine surface work.

Use `deliverySurfaces` when an app needs a surface kind to trigger import but does not need ongoing `onSurface()` calls for that kind. For example, Root Visuals can wake from tweet activity so user-action listeners are available, while receiving only notification surfaces for unread marking.

Use `context.scheduler` for routine delayed or idle work. The runtime backs it with one shared queue, applies the active Performance mode's per-frame idle budget, supports cancellation, and records `idleQueueDepth`, `idleQueueMaxDepth`, and `idleScheduler` diagnostics. App-owned `requestIdleCallback`, broad polling intervals, or unbounded scan queues should be reserved for feature-specific behavior that cannot be expressed through runtime surfaces.

Use `context.signal` to guard async startup, storage, network, worker, and indexing work. The runtime aborts this signal before calling an app's disable/dispose cleanup, so late continuations must check `signal.aborted` before mutating state, rendering UI, scheduling more work, or writing caches.

Runtime diagnostics derive loaded heavy, worker-heavy, and network app lists from registry cost metadata. Keep `cost` accurate: the popup Health panel and bug-report templates use these shared diagnostics to identify expensive loaded app bundles without hard-coded app lists.

First-party runtime manifests may provide `setEnabled(enabled)`. The Apps Hub uses that hook to toggle app enablement through the app's existing storage setting without importing the app bundle. Apps without `setEnabled` are treated as core or informational entries and do not get a Hub enable/disable button.

## Apps Hub And Rail Pinning

Enablement and rail visibility are separate platform state. An enabled app may process declared surfaces or load on user action, while a pinned app gets a side-rail button.

The content runtime owns the lightweight Apps Hub rail item and stores explicit rail choices in `milxdy.apps.railPinned`. If that key is absent, existing users keep the previous behavior: enabled dock apps remain visible on the rail. Once the user pins or unpins an app, the runtime treats the stored list as the source of truth.

Manifest `hub.rail.supported` controls whether an app can be pinned. `hub.rail.defaultPinned` is app-store metadata for first-run presets and future package install flows; it should not be confused with current-user pin state. The shared dock enforces hidden item IDs globally, so feature bundles cannot bypass Hub pinning by registering their own app frame after lazy import.

Current first-party Hub-managed enablement keys include Post-reading `enabled`, RemiStats `milxdy.remistats.enabled`, Beetol `milxdy.remistats.beetol.enabled`, RemiNet Chat `milxdy.reminetChat.enabled`, Miladychan Portal `milxdy.miladychan.enabled`, Music `milxdy.music.enabled`, Wiki links/sidebar `remiliaWikiHyperlink.settings.enabled`, and Milady Maxxer `mode`.

Fresh installs set `milxdy.apps.firstRun.status` to `pending`, which lets the content runtime open the Apps Hub once on X. The background install seeder also writes conservative defaults for heavy full-profile apps so skipping first-run leaves Music, Miladychan Portal, Beetol, RemiNet Chat, and Milady Maxxer disabled until the user enables them or chooses Full. Choosing Lite, Balanced, or Full applies manifest `hub.presets`, `hub.rail.defaultPinned`, and the matching Performance mode without importing app bundles just to change settings.

Profile builds keep full app metadata in the runtime registry while excluding unavailable feature bundles, assets, and host permissions. Apps outside the current profile appear in Apps Hub as unavailable with a build-profile explanation; they do not expose Enable, Pin, or Open controls, and diagnostics mark them as unavailable rather than disabled-by-user.

Apps Hub cards derive their compact metadata chips from the same registry fields: cost profile, rail support, privacy labels, and remote services. Keep those fields accurate when adding an app because they are both release documentation and user-facing runtime disclosure.

The card Details toggle is also registry-driven. It expands to show the app description, performance cost profile, load triggers, data notes, permission notes or hosts, storage notes or keys, and build availability. Cards with declared storage keys also get a Hub reset-settings action that removes those local/sync keys, re-reads manifest enablement, updates dock/scanner state, and records `hub.reset.<appId>` diagnostics without importing the app bundle. Do not hard-code per-app disclosure copy or reset key lists in the Hub renderer when a registry field can describe it.

## Performance Modes

Performance mode lives at `milxdy.performance.mode` and is separate from Minimal/Medium/Max appearance. The runtime supports:

- `fast`: visible-nearby surfaces only, no idle preload, low network concurrency, no periodic safety scans
- `balanced`: default, moderate visible margin, surface-driven imports, no periodic safety scans
- `full`: richer idle preload and larger surface budgets
- `developer`: diagnostics-oriented mode with long-task collection and larger budgets

Apps declare cost in their manifest. The runtime uses that metadata to decide whether to import at startup, wait for a visible surface, register only a metadata dock item, or idle-preload after X settles.

Fast mode favors avoiding extra selector walks over cross-remount dedupe: it uses element-level surface dedupe only, while Balanced/Full/Developer keep short-lived stable-key dedupe for remounted X nodes.

Use `userAction` for invoked-only bundles such as export/render tools. These packages are built and documented through the same registry as other apps, but the runtime does not preload them for route, surface, or idle work.

## Overlay Panels

Use `src/shared/overlayDock.ts` and `src/shared/overlayAppFrame.ts` for dock registration. Use `src/shared/overlayPanelBase.ts` for shared panel behavior:

- X/theme-aware light/dark resolution
- viewport width, height, and top clamping
- drag and resize pointer handling
- persistence callbacks for panel geometry

Apps should own only their feature UI and state. Shared panel mechanics should stay in the platform layer.

Panel apps should use `observeOverlayPanelTheme()` and `resolveOverlayPanelTheme()` instead of each app wiring its own X theme or color-scheme observer. This keeps Music, Miladychan, RemiNet Chat, and Beetol aligned with the same root theme signal.

## Background Services

`src/shared/backgroundRouter.ts` provides the typed central message router used by `src/background.ts`. Message handlers must keep strict allowlists for network access and return stable `{ ok, status, error, data }`-style envelopes where possible.

Use `src/shared/urlAllowlist.ts` for background fetch URL policy checks. Service handlers should declare small rule sets near the service they protect, then call `parseAllowedUrl()` or `isAllowedUrl()` before any fetch that uses a URL supplied by content scripts, app UI, remote payloads, QR imports, or user-controlled metadata.

Feature-specific background modules can continue to register handlers during migration, but new shared services should be added through the router.

## Future GitHub App Store Path

A GitHub-hosted app package should map cleanly onto the manifest shape:

- `milxdy.app.json` with ID, display metadata, version, declared surfaces, permissions, background services, CSS, and assets
- Hub metadata with user-facing descriptions, preset membership, rail defaults, data/permission notes, and privacy labels
- a content entry bundle using the lifecycle hooks
- optional background handlers that declare message types and host allowlists
- no broad DOM observers or interval scans unless justified by the package review notes
- no host access beyond declared allowlists

Before remote packages are supported, the platform needs manifest signature/verification, install consent UI, update policy, package sandboxing rules, and review tooling for permissions and performance diagnostics.
