# milXdy App SDK Reference

milXdy App SDK 0.2.3 is a production platform for building reviewed apps into
custom Chromium distributions of milXdy. Apps declare their lifecycle,
surfaces, settings, storage, assets, permissions, privacy effects, performance
cost, background messages, and dock behavior through a versioned manifest.

The shared runtime supplies X/Twitter route and surface delivery, scheduling,
cancellation, diagnostics, guarded storage and assets, app-scoped messaging,
Apps & Features integration, side-rail registration, and overlay UI patterns.
The deterministic composer accepts app folders and ZIP archives, enforces the
package trust contract, and produces a reviewable unpacked extension build.
The local Add-on Manager adds the supported user workflow around that composer:
catalog selection files or manually supplied ZIPs, pinned download verification,
transactional package placement, a stable build folder, and durable status for
Apps & Features.

Start with the [SDK starter kit](../sdk/README.md), then use this guide as the
authoritative manifest, runtime, composition, and security reference. The
[App Platform Support Contract](APP_PLATFORM_PRODUCTION_READINESS.md) defines
the supported distribution, security, compatibility, and versioning contract.

## Platform Model

First-party and external packages share the same app concepts: versioned
metadata, runtime-owned lifecycle hooks, declared capabilities, generated
settings ownership, and shared platform services. First-party apps ship with
milXdy; external packages are reviewed and composed into deterministic custom
builds.

There are three distinct entry points:

- **Catalog selection:** the catalog exports one `.milxdy-selection.json` that
  pins package IDs, HTTPS ZIP URLs, filenames, SHA-256 hashes, and review
  identities. `addons:prepare` downloads and validates that exact set;
  `addons:apply` builds it after the required trust acknowledgements.
- **Manual local packages:** users place trusted ZIPs in
  `local-addons/manual/`, inspect them with `addons:status`, and build with
  `addons:rebuild`.
- **Author inspection:** `verify:local-app-package`, `compose:local-apps`, and
  `build:local-apps:chromium` expose the lower-level validator and composer for
  package development and repository verification.

An App SDK package owns its feature code and UI. milXdy owns shared page
scanning, route detection, scheduling, network policy, app chrome, lifecycle,
diagnostics, and package trust enforcement. This division prevents every app
from installing a competing observer, poller, scanner, animation system, or
network queue.

## App Manifest

Each first-party app declares static platform, package, and Hub metadata in `src/platform/app-sdk/first-party-apps.json`. Runtime-only enablement adapters live in `src/platform/app-sdk/first-party-registry.ts` because they need browser storage reads, but build outputs, content entries, costs, surfaces, dock metadata, permissions, app-card metadata, privacy notes, and background service declarations come from the shared JSON registry.

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
- `lifecycle` metadata with `mode: "runtime"` for normal runtime-owned apps or `mode: "invoked"` for user-action-only tools that should not export `boot()`
- `siteScopes` metadata for site-specific host, route, surface, and integration-mode declarations across X/Twitter, RemiliaNET, Remilia Wiki, Miladychan, and other reviewed hosts
- `packageKind` as `app`, `feature`, or `theme` so Apps & Features and the composer can group install, settings, and review flows without inferring intent from the ID
- `dock` metadata for apps that appear in the shared overlay dock
- `chrome` metadata for app-window style compatibility: native style, supported shared presets, and notes about app-specific chrome constraints
- `settings` metadata for user-configurable storage-backed controls
- `background.messageTypes` and `background.services`
- `permissions.hosts` for URL allowlist documentation

`src/platform/app-sdk/first-party-apps.json` is the source of truth for first-party package metadata. `src/platform/app-sdk/first-party-registry.ts` adapts that static registry into runtime manifests by adding storage-backed `isEnabled()` functions, and `scripts/build/build-extension.mjs` consumes the same JSON for bundle entries, copied assets, CSS, web-accessible files, and required outputs.

Lifecycle metadata distinguishes runtime-owned packages from user-invoked tools:

- `mode: "runtime"` means the shared content runtime owns imports, `boot()`, route/surface delivery, dock open/close, disable, dispose, abort signals, and diagnostics.
- `mode: "invoked"` means the package is loaded only from a declared user action. It should use `loadTriggers: ["userAction"]`, avoid runtime delivery `surfaces`, declare `invokedBy: "userAction"` plus the platform load `reason`, and should not add a fake `boot()` export.

Site scopes describe where an app integrates with a host site without overloading broad surface names. A scope declares `site`, host permission-style `hosts`, an `integration` mode, relevant `surfaces`, optional `routes` with `exact` or `prefix` path matching, and optional `presentation` such as `sideRailOverlay`, `hostRouteOverlay`, or `userAction`.

Supported site IDs are currently `x`, `remiliaNet`, `remiliaWiki`, and `miladychan`. Supported integration modes are:

- `contentScript` for the main shared content runtime on declared host matches
- `backgroundService` for routed background fetch, auth, WebSocket, or privileged service work without page injection
- `embeddedFrame` for behavior inside a validated embedded frame, such as the Wiki sidebar frame
- `overlayApp` for a local overlay surface whose host relationship is user-initiated or service-backed rather than injected

The shared content runtime operates on X/Twitter. RemiliaNET, Remilia Wiki, and Miladychan declarations describe background-service, embedded-frame, or overlay integrations. Route-aware packages that claim X direct-message behavior must declare the `/messages`, `/messages/...`, `/i/chat`, and `/i/chat/...` patterns they support.

## Settings Schema

Apps, features, and theme packages declare user-configurable settings in the manifest `settings` array. Apps & Features uses this schema to discover where a setting lives, how it resets, and whether presets may change it without hard-coding every control.

Each setting entry should include:

- `id`: stable dotted identifier, usually `<appId>.<settingName>` or a global namespace such as `appearance.appWindowStyle`
- `label` and optional `description`: public copy for settings search, Apps & Features details, import previews, and generated controls
- `scope`: `global`, `app`, or `feature`
- `location`: `appearance`, `appsAndFeatures`, `appSurface`, or `advanced`
- optional `role`: `preference`, `enablement`, `open`, or `reset`; omitted means a normal detailed preference
- `storage`: `area` (`local` or `sync`), `key`, and optional object `property`
- `defaultValue`: the value restored by a normal default reset when known
- `control.type`: `toggle`, `select`, `segmented`, `slider`, `number`, `text`, `textarea`, `action`, or `status`; select-like controls should include static `options` or `dynamicOptions`
- `reset.behavior`: `removeKey`, `restoreDefault`, `restoreAppDefault`, or `custom`
- optional `presets`: `visual`, `audio`, `performance`, `firstRun`, or `profilePack`
- optional `presetBehavior.overwriteWarning` and `presetBehavior.saveAsCustom` for settings whose current value can be replaced by an imported preset or profile pack
- optional `advanced` and `requires` fields for controls that should stay out of default flows or depend on a capability such as an authenticated session

Use `scope: global` only for settings that intentionally affect more than one app or surface, such as Appearance profile, app chrome style, app shadows, Performance mode, or side-rail layout. App-owned settings belong to `scope: app` even when the app is docked in the rail. Page-wide non-window features such as inline wiki linking or RemiStats badges use `scope: feature`.

Use `role` to distinguish app-card affordances from detailed preferences. App-owned settings in Apps & Features may declare `role: "enablement"`, `role: "open"`, or `role: "reset"` when the control belongs beside the card's enable/open/reset actions. Detailed app preferences remain `role: "preference"` or omit the field and live in an app surface, an explicit app settings surface, or a supported popup mirror. Legacy keys can still be enablement controls when real behavior uses them that way; Milady Maxxer `mode`, for example, is stored as a mode value but still carries app on/off behavior through `off` versus enabled modes.

Storage metadata must match the actual browser storage location. If the value is stored inside an object, declare the object key and the `property`; if the setting owns a whole key, omit `property`. Keep `storageKeys` at the app level as the reset and change-detection list, and use `settings` to describe the user-facing controls inside those keys.

Preset participation is opt-in per setting. Visual presets should only touch visible appearance values; audio presets should only touch playback, voice, sound, or notification-audio values; performance presets should only touch cost, scheduling, or fidelity settings; first-run presets should configure exact app enablement, rail participation, and the matching Performance mode; profile packs may include any declared non-sensitive setting that opts in. When applying a preset would replace a user's current value, the UI should warn, let the user cancel, and offer a save-as-custom path where the flow supports custom profiles.

Never mark authentication tokens, sessions, cookies, API keys, local absolute file paths, private cache payloads, or remote account data as preset/profile-pack participants. Local package manifests must not expose those values through generated settings controls at all, and novel packages must not claim built-in registry storage keys unless they are trusted first-party replacements. Sensitive values may appear in internal storage keys, but the settings schema should expose only safe controls and public reset behavior.

Apps & Features cards and generated settings surfaces use the same manifest schema instead of per-app switch statements.

Use `control.options` for select or segmented controls with stable, enumerable values. Use `control.dynamicOptions` when values come from a runtime provider such as browser/OS Web Speech voices; the manifest should name the provider, value field, label field, refresh event when relevant, and portability limits. Do not add placeholder static options for provider-owned values, and make profile-pack flows preview or fall back when a dynamic value is unavailable on another browser profile.

## Profile Packs

Profile packs are versioned shareable bundles for settings that are broader than one custom visual theme. The public schema is `kind: "milxdy.profilePack"` with `version: 1`, implemented in `src/platform/settings/profile-packs.ts`.

A pack may contain these top-level sections:

- `appearance`: the current reskin profile and a nested `milxdy.visualTheme` payload, preserving compatibility with the existing visual theme export/import/share format
- `performance`: Performance mode, currently stored at `milxdy.performance.mode`
- `apps`: declared app enablement values
- `rail`: declared side-rail pins and side preference
- `layout`: declared layout and app chrome override values

The first import/export UI supports `appearance` plus the non-visual `performance` section. Existing appearance theme JSON export/import and appearance share strings remain separate and continue to work; profile packs nest the visual theme rather than replacing that format.

The current UI writes only these keys during profile-pack import:

- `milxdy.settings.reskinProfile`
- `milxdy.settings.visualTheme`
- `milxdy.performance.mode`

Profile-pack sections may include declared app enablement, rail pins, rail side, layout, and app chrome override keys only when those settings opt into `profilePack`. They must exclude auth tokens, session cookies, API keys, private account data, local absolute file paths, large caches, and diagnostic payloads.

Import flows must preview the sections and changes before writing storage, allow cancel, and ignore unsupported or excluded classes. If a pack would replace customized settings, the UI should warn and preserve a save-as-custom path where the source flow supports custom profiles.

## Content Runtime

`src/platform/runtime/content-runtime.ts` owns content app lifecycle:

- one shared Twitter surface scanner
- SPA route and visibility detection
- lazy app import based on manifest enablement
- global Performance mode budgets independent of Appearance profiles
- stylesheet injection
- idle-scheduled surface forwarding for SDK-style modules
- runtime/app diagnostics under `milxdy.diagnostics.*`

Content app bundles are runtime-owned and should not self-boot. Apps export lifecycle hooks such as `boot`, `enable`, `disable`, `onRouteChange`, `onSurface`, and `dispose`; the runtime imports enabled apps and calls those hooks according to manifest triggers and the active Performance mode.

The root content entry should stay a tiny bootstrap. Shared page-wide visual state, including reskin dataset application, X theme detection, and sidebar icon color correction, lives in `src/platform/visuals/root-visual-state.ts`. New page-wide behavior should become a shared runtime service or a manifest app instead of being added directly to `src/extension/content/index.ts`.

Use `onSurface(surface)` for Twitter/X surfaces. The runtime performs visibility gating, import decisions, diagnostics, and idle scheduling before invoking the hook, so apps should not subscribe directly to the scanner or install broad page observers for routine surface work.

Use `context.requestSurfaceRescan()` after a user-visible setting change invalidates already-rendered surface decorations. The runtime coalesces the request through its shared scanner. External packages must not import scanner internals; `scheduleScan` remains only as a deprecated first-party compatibility alias while bundled apps migrate.

Use `context.storage.local` and `context.storage.sync` for app persistence. Each
area exposes `get`, `set`, `remove`, and `onChanged`, but only for keys declared
by the app manifest. Undeclared access fails before the browser storage API is
called, and change listeners receive only declared keys from their area.

Use `context.resolveAssetUrl(path)` for extension-packaged resources. Local
package assets are mapped into the package namespace. Built-in host assets are
available only when repo policy explicitly grants them to a reviewed
first-party replacement. Absolute URLs, traversal, and undeclared paths fail
closed.

Use `deliverySurfaces` when an app needs a surface kind to trigger import but does not need ongoing `onSurface()` calls for that kind. For example, Root Visuals can wake from tweet activity so user-action listeners are available, while receiving only notification surfaces for unread marking.

Use `context.scheduler` for routine delayed or idle work. The runtime backs it with one shared queue, applies the active Performance mode's per-frame idle budget, supports cancellation, and records `idleQueueDepth`, `idleQueueMaxDepth`, and `idleScheduler` diagnostics. App-owned `requestIdleCallback`, broad polling intervals, or unbounded scan queues should be reserved for feature-specific behavior that cannot be expressed through runtime surfaces.

Use `context.signal` to guard async startup, storage, network, worker, and indexing work. The runtime aborts this signal before calling an app's disable/dispose cleanup, so late continuations must check `signal.aborted` before mutating state, rendering UI, scheduling more work, or writing caches.

Runtime diagnostics derive loaded heavy, worker-heavy, and network app lists from registry cost metadata. Keep `cost` accurate: the popup Health panel and bug-report templates use these shared diagnostics to identify expensive loaded app bundles without hard-coded app lists.

First-party runtime manifests may provide `setEnabled(enabled)`. Apps & Features uses that hook to toggle app enablement through the app's existing storage setting without importing the app bundle. Apps without `setEnabled` are treated as core or informational entries and do not get an enable/disable button.

## Apps & Features IA

Enablement and rail visibility are separate platform state. An enabled app may process declared surfaces or load on user action, while a pinned app gets a side-rail button.

The content runtime owns the lightweight Apps & Features rail item and stores explicit rail choices in `milxdy.apps.railPinned`. If that key is absent, existing users keep the previous behavior: enabled dock apps remain visible on the rail. Once the user pins or unpins an app, the runtime treats the stored list as the source of truth.

The menu is organized by manifest `packageKind`:

- `app`: full app surfaces with a rail entry, pop-out, or major app window, such as Music, Post-reading, RemiNet Chat, Beetol, Miladychan, Wiki, and Maxxer
- `feature`: non-app modules that extend X/Twitter surfaces without their own app window, such as RemiStats, Tweet PNG, Composer Tools, injected controls, and page-level visual effects
- `theme`: texture, visual, or profile packages that appear as installable packages without pretending to be launchable apps

Full apps and features can share categories such as `reading`, `social`, `appearance`, `media`, or `game`, but category should not decide the IA section. Use `packageKind` for section placement and `hub.category` for filtering, chips, and search.

Manifest `hub.rail.supported` controls whether an app can be pinned. `hub.rail.defaultPinned` supplies the initial rail choice for first-run presets and package install flows; it is separate from current-user pin state. The shared dock enforces hidden item IDs globally, so feature bundles cannot bypass Hub pinning by registering their own app frame after lazy import.

Current first-party Apps & Features-managed enablement keys include Post-reading `enabled`, Composer Tools `milxdy.composerTools.enabled`, RemiStats `milxdy.remistats.enabled`, Beetol `milxdy.remistats.beetol.enabled`, RemiNet Chat `milxdy.reminetChat.enabled`, Miladychan Portal `milxdy.miladychan.enabled`, Music `milxdy.music.enabled`, Wiki links `remiliaWikiHyperlink.settings.enabled`, Wiki sidebar `remiliaWikiHyperlink.settings.sidebarEnabled` with fallback migration from the legacy Wiki links bit when unset, and Milady Maxxer `mode` as a legacy enablement/mode key.

Fresh installs set `milxdy.apps.firstRun.status` to `pending`, which lets the content runtime open Apps & Features once on X. The background install seeder keeps first-party apps enabled by default until the user chooses a setup. Choosing Lite, Balanced, or Full converges toggleable apps to the exact manifest `hub.presets` set, disables toggleable apps excluded from that preset, applies `hub.rail.defaultPinned`, and applies the matching Performance mode without importing app bundles just to change settings. Core entries without enablement toggles are preserved. The same setup choices remain available from the Apps & Features settings menu after first-run.

Release builds keep the full first-party app set, assets, and host permissions. Lite, Balanced, and Full are setup/preset choices inside milXdy; they must not make an app unavailable or remove its enable, pin, or open controls.

Apps & Features cards derive their compact metadata chips from the same registry fields: package kind, cost profile, rail support, privacy labels, remote services, chrome support, and settings schema. Keep those fields accurate when adding an app because they are both release documentation and user-facing runtime disclosure.

The card Details toggle is also registry-driven. It expands to show the app description, performance cost profile, load triggers, settings home, data notes, permission notes or hosts, storage notes or keys, diagnostics/runtime state, and build availability. Cards with declared storage keys also get a reset-settings action that restores declared setting defaults, resets object-backed settings by property, skips shared broad keys unless a setting explicitly owns the whole key, re-reads manifest enablement, updates dock/scanner state, and records `hub.reset.<appId>` diagnostics without importing the app bundle. Do not hard-code per-app disclosure copy or reset key lists when a registry field can describe it.

Global controls and presets stay in the top-right extension popup. Apps & Features owns app/feature enablement, launch/open actions, rail pinning, storage reset, permissions/privacy/data disclosure, diagnostics/status rows, and shortcuts into app-owned settings. App-owned settings in Apps & Features declare an enablement/open/reset role; detailed app preferences live in the app window or app settings surface. Feature settings use manifest-driven controls in Apps & Features.

## Performance Modes

Performance mode lives at `milxdy.performance.mode` and is separate from Minimal/Medium/Max appearance. The runtime supports:

- `fast`: visible-nearby surfaces only, no idle preload, low network concurrency, no periodic safety scans
- `balanced`: default, moderate visible margin, surface-driven imports, no periodic safety scans
- `full`: richer idle preload and larger surface budgets
- `developer`: diagnostics-oriented mode with long-task collection and larger budgets

Apps declare cost in their manifest. The runtime uses that metadata to decide whether to import at startup, wait for a visible surface, register only a metadata dock item, or idle-preload after X settles.

Fast mode favors avoiding extra selector walks over cross-remount dedupe: it uses element-level surface dedupe only, while Balanced/Full/Developer keep short-lived stable-key dedupe for remounted X nodes.

Use `userAction` plus `lifecycle.mode: "invoked"` for invoked-only bundles such as export/render tools. These packages are built and documented through the same registry as other apps, but the runtime does not preload them for route, surface, or idle work.

## Overlay Panels

Use `src/platform/overlay/dock.ts` and `src/platform/overlay/app-frame.ts` for dock registration. Use `src/platform/overlay/panel-base.ts` for shared panel behavior:

- X/theme-aware light/dark resolution
- viewport width, height, and top clamping
- drag and resize pointer handling
- persistence callbacks for panel geometry
- freeform app-window placement, local layout restore, rail protected zones, snap guides, and app-to-app guide edges for migrated overlay apps

Apps should own only their feature UI and state. Shared panel mechanics should stay in the platform layer.

Panel apps should use `observeOverlayPanelTheme()` and `resolveOverlayPanelTheme()` instead of each app wiring its own X theme or color-scheme observer. This keeps Music, Miladychan, RemiNet Chat, and Beetol aligned with the same root theme signal.

Use the shared overlay drag and resize helpers for movable app windows. Header buttons, links, form controls, and editable fields must stay clickable and should not accidentally start a drag; the shared drag helper ignores those interactive descendants by default. If an app intentionally uses an interactive-looking control as its drag handle, document that exception in code with `allowInteractiveDragTarget` so compliance audits can tell it apart from accidental bubbling.

Overlay layout records live in `local:milxdy.overlayApps.layouts.v1`. They may store app IDs, pixel bounds, rail side, viewport size, snap metadata, and timestamps; they must not store page URLs, account identifiers, iframe contents, board/thread payloads, music library paths, auth state, or remote-service data. Keep legacy per-app width, height, and top keys readable during migration.

For public contributor-facing UI expectations, including classic utility-window styling, side-rail behavior, app headers, controls, and semantic theme variables, see the [Contributor UI Style Guide](CONTRIBUTOR_UI_STYLE_GUIDE.md).

## App Chrome Styles

App chrome style means the visual frame around an app surface: borders, bevels, shadows, title/header treatment, panel surfaces, and window controls. It is separate from X/Twitter content theme, Performance mode, and app-specific functional settings.

The global Appearance control stores `appWindowStyle` in `milxdy.settings.visualTheme`. Current global values are:

- `native`: use each app's authored default chrome
- `reminet`: apply the shared RemiNet-style retro internet chrome where supported
- `classic`: apply the shared late-90s classic bevel chrome where supported

Apps declare chrome compatibility in `src/platform/app-sdk/first-party-apps.json` with `chrome.nativeStyle`, `chrome.supportedStyles`, and optional `chrome.notes`. Native style names can identify app-authored examples such as `maxxer`, `reader`, `miladychan`, `music`, or `wiki`, while `supportedStyles` should include the shared styles the app can safely receive without losing its core affordances.

Per-app overrides build on that manifest metadata instead of creating app-local theme storage: one global default, an optional per-app override to a supported style, and `native` as the escape hatch that preserves the app's authored look.

## Background Services

`src/platform/background/router.ts` provides the typed central message router used by `src/extension/background/index.ts`. Message handlers must keep strict allowlists for network access and return stable `{ ok, status, error, data }`-style envelopes where possible.

App SDK `context.sendMessage()` calls are app-scoped. The content runtime extracts object message `type` values and only forwards messages covered by the sender app's manifest `background.messageTypes` entries. Entries may be exact types such as `wikiSidebar:openTab` or trailing wildcards such as `beetol:*`; shared routes such as `reminetIdentity:getProfile` must be declared by each sender that uses them.

Use `src/platform/browser/url-allowlist.ts` for background fetch URL policy checks. Service handlers should declare small rule sets near the service they protect, then call `parseAllowedUrl()` or `isAllowedUrl()` before any fetch that uses a URL supplied by content scripts, app UI, remote payloads, QR imports, or user-controlled metadata.

Shared services register through the router. Direct `safeRuntimeMessage`, `chrome.runtime.sendMessage`, and `chrome.runtime.connect` bridges are reserved for documented internal surfaces that cannot receive App SDK context, such as packaged frames or stateful streaming ports. These internal privileged bridges are not local package APIs and not sandbox boundaries: each bridge validates senders in its background handler and remains covered by compliance verification.

## Package Compliance Contract

Run `pnpm.cmd run verify:app-sdk-compliance` after changing app metadata, lifecycle exports, app entries, background routes, generated Apps & Features settings, or shared scanner/scheduler/overlay behavior. The verifier is deterministic and no-network. Run `pnpm.cmd run verify:internal-messaging-bridges` after changing an internal frame or port bridge so sender restrictions stay explicit.

First-party apps and feature packages should satisfy this checklist:

| Area | Requirement |
| --- | --- |
| Manifest metadata | `src/platform/app-sdk/first-party-apps.json` declares IDs, package kind, content entry, enablement storage, surfaces, cost, load triggers, Hub category, rail support, presets, storage/data/privacy notes, chrome compatibility, settings metadata, and background metadata where applicable. |
| Lifecycle exports | Content bundles export `boot()` when runtime-loaded, plus `onSurface()`, `onRouteChange()`, `open()`, `close()`, `disable()`, and `dispose()` when their declared surfaces require those hooks. Invoked-only tools declare `lifecycle.mode: "invoked"`, stay `userAction`-only, and do not add fake `boot()` hooks. |
| Site and route scopes | Packages that claim site-specific behavior declare `siteScopes` with site ID, host patterns, integration mode, surfaces, presentation, and supported route patterns. Direct-message route integrations on X must declare `/messages`, `/messages/...`, `/i/chat`, and `/i/chat/...` instead of relying on verifier inference. Non-X site scopes must distinguish background services and embedded frames from true content-script runtime loading. |
| No self-booting bundles | Runtime-loaded app bundles must not call `boot()` themselves. The shared runtime owns import timing, enablement, lifecycle calls, abort signals, and diagnostics. |
| Shared scanner and scheduler | X/Twitter surface work flows through the shared scanner and runtime delivery queue. Routine delays, idle work, and cancellation should use `context.scheduler`; app-owned observers, intervals, or idle callbacks need a narrow feature reason, explicit bounds, and cleanup. Short user-action observers may be accepted when scheduler-capped and disposable, while broad body-subtree observers remain platform debt. |
| Shared overlay chrome | Docked apps use the shared overlay frame/chrome/layout helpers and declare chrome compatibility instead of owning side-rail, drag, resize, pinning, or theme-detection primitives. |
| Background/router metadata | Background fetches and privileged work go through `backgroundRouter` and URL allowlists. Manifest `background.messageTypes`, `background.services`, `permissions.hosts`, permission notes, data notes, remote services, and privacy labels must describe the routed work. |
| Generated settings ownership | Apps & Features generated controls read manifest settings and shared storage helpers from the platform layer; the renderer must not import app bundles. App-owned detailed settings should stay in app surfaces unless they are enable/open/reset/disclosure controls. |
| Reset and storage safety | App-level `storageKeys` and setting-level `storage` metadata must match real storage. Reset must restore declared defaults, preserve unrelated properties inside shared object keys, and avoid exporting secrets, sessions, local file handles, caches, diagnostics payloads, or user queues through presets/profile packs. |
| Cost, privacy, and permissions | Cost metadata, remote-service notes, host permissions, local-storage notes, and privacy labels must stay accurate for Apps & Features details, Health diagnostics, and package review. |
| Diagnostics | The runtime records app load state, import avoidance, heavy/worker/network app lists, surface delivery, scheduler, network queue, storage reset, long-task, and layout-shift diagnostics from shared metadata rather than per-app hard-coded lists. |

First-party platform examples:

| Package | Integration | Notes |
| --- | --- | --- |
| RemiNet Chat | Aligned with internal socket bridge | Uses shared dock chrome and App SDK routed background messages. Declares runtime lifecycle metadata and explicit X direct-message route scopes for side-rail overlay behavior on `/messages`, `/messages/...`, `/i/chat`, and `/i/chat/...`. The WebSocket stream remains a stateful `runtime.connect` bridge between validated same-extension top-frame X/Twitter and RemiliaNET senders. |
| Beetol | Aligned | Uses shared dock frame, background router metadata, and App SDK routed messaging. Legacy direct runtime-message fallback has been removed from the app surface path. |
| Miladychan Portal | Aligned | Uses shared overlay chrome, route through background router, and declares remote-service/privacy metadata. Keep public board fetches on allowlisted routes. |
| Music | Aligned | Uses shared overlay chrome, App SDK routed background messaging, and local-file plus remote enrichment disclosure. Local folder and API-key-adjacent settings must remain out of profile packs unless explicitly safe. |
| Remilia Wiki hyperlinks | Shared surface feature | Inline delivery and manifest-generated Apps & Features preferences with storage-compatible popup mirrors. |
| Remilia Wiki sidebar | Aligned with internal iframe bridge | Uses shared overlay chrome and declares its wiki sidebar background routes. Frame-local observers and frame-to-background messages are sidebar-frame implementation details; background handlers validate same-extension non-top wiki frame senders before forwarding navigation, history, open-tab, or read-aloud messages. |
| Post-reading | Shared reader and OCR services | Uses shared scanner delivery, overlay player chrome, App SDK routed full-quote fetches, and the background fetch router. The packaged OCR frame accepts parent requests from allowed X/Twitter/wiki origins only when they carry a content-issued frame authentication token, and its background helper validates the packaged `ocr.html` sender. Voice selection declares dynamic Web Speech options, so saved voice URIs remain browser-profile dependent. |
| RemiStats and Pokes | Shared surface and background services | Uses shared surface delivery, routed background work, generated settings metadata, and declared storage ownership. |
| Milady Maxxer | Worker-heavy overlay app | Uses shared scanner delivery, overlay chrome, worker/output metadata, and App SDK routed background work with explicit model, remote identity, and cache disclosures. |
| Tweet PNG | Invoked-only | Declares `lifecycle.mode: "invoked"` and remains a local `userAction` package loaded by Root Visuals from the X share-menu action. If it becomes a runtime app, change the lifecycle mode, add real lifecycle exports, and keep PNG rendering local and user initiated. |
| Composer Tools | Aligned lightweight feature | Runtime-loaded local-only feature with a metadata-backed Apps & Features enablement toggle. Its document input listeners are scoped to supported X/Twitter post composers and cleaned up through runtime disposables. |
| Root Visuals | Core visual runtime feature | Uses shared runtime scheduling and `deliverySurfaces: ["notification"]`. Theme watching is attribute-only on document theme roots, the home-logo observer attaches only to discovered header/h1 page-chrome roots, and the click-triggered Tweet PNG share-menu observer is scheduler-capped and cleaned up. |

Platform boundaries:

- Lifecycle and site metadata covers invoked-only tools, X direct-message routes, and RemiliaNET, Wiki, and Miladychan service/frame integrations. The shared content runtime is X-specific; non-X scopes use their declared background, frame, or overlay integration.
- Background route metadata is checked against shared router registrations, with first-party app message patterns declared in the registry.
- Package work uses the shared scheduler unless a bounded, disposable app-specific mechanism is required.
- Apps & Features owns enable/open/reset controls and disclosure; detailed preferences belong to app surfaces.

## Local Apps-Folder Package Shape

The App SDK distribution path is reviewed custom-build composition: milXdy composes selected packages into a deterministic unpacked Chromium build and records the resulting trust, permission, asset, and package metadata for review.

Package shape:

```text
apps/
  <package-id>/
    milxdy.app.json
    dist/
      content.js
      content.css
    assets/
      icon.png
      preview.png
```

A folder or ZIP has one package root and one required `milxdy.app.json` at that root. Packages ship prebuilt bundles and declared assets; authors and users do not edit milXdy source files, build configuration, extension manifests, or registry JSON.

`milxdy.app.json` should use manifest version `1` and map onto `MilxdyLocalAppPackageManifestV1` in `src/platform/app-sdk/app-platform.ts`. Required fields:

- `manifestVersion: 1`
- `id`, `name`, `version`, `description`
- `packageKind`: `app`, `feature`, or `theme`; texture/resource packs should use `theme` until a separate package kind is justified by runtime behavior
- `sdk.minVersion` and optional `sdk.targetVersion`
- `contentEntry` for the prebuilt executable `.js` or `.mjs` content bundle, plus optional `css`
- `defaultEnabled`, `storageKeys`, `settings`, `surfaces`, `cost`, and `loadTriggers`
- `hub` metadata for category, descriptions, rail support/default pinning, presets, disclosure notes, remote services, local storage notes, and privacy labels
- `package.assets` and `package.webAccessibleAssets` for icons, media, workers, WASM, HTML helpers, and other shipping files the platform may copy or expose; reference material is not a shipping asset
- `lifecycle`, `siteScopes`, `dock`, `chrome`, `permissions`, and `background` when the package uses those capabilities
- `privacy` with permission notes, data notes, local-storage notes, privacy labels, optional remote services, and whether sensitive consent is required before enabling

Package paths are package-root-relative, must not be absolute, and must not contain `..` traversal segments. Host access belongs in `permissions.hosts` and matching `siteScopes.hosts`; hidden remote services, undeclared WebSocket endpoints, and broad optional host permissions are not valid local-package defaults.

The local-package validator is license-neutral: an asset declaration, hash, or
package claim does not establish VPL eligibility or any other rights approval.
The future official VPL catalog has a separate file-level provenance, evidence,
and human-review process. Packages vendor only their declared shipping exports;
they must not hot-load arbitrary remote assets at runtime. Keep reference URLs,
screenshots, and visual research out of package asset declarations unless the
actual file is deliberately shipped and its redistribution rights are documented.

First-party build-only registry fields do not belong in `milxdy.app.json`. Keep `entryName`, `entryPoint`, CSS `source`/`target`/`targetDir`, `requiredOutputs`, and other source-build wiring inside `src/platform/app-sdk/first-party-apps.json` and `scripts/build/build-extension.mjs`. Local packages should reference the built files they contain, not the source files used to create them. The local composer copies package files as-is and does not transpile TypeScript or JSX, so `contentEntry` must point at an executable `.js` or `.mjs` module.

Novel local package IDs become Apps & Features controllable when they declare a storage-backed setting with `role: "enablement"`, `control.type: "toggle"`, `location: "appsAndFeatures"`, and a `storage` target listed in `storageKeys.local` or `storageKeys.sync`. The generated custom-build registry keeps first-party adapters for built-in IDs, but unknown local IDs use this generic enablement adapter. Use `defaultEnabled: false` for new third-party packages unless the package is intentionally always-on and has no privileged consent surface; packages that request host permissions, optional permissions, remote services, background capability, or `privacy.consentRequired: true` must start disabled, and their enablement setting must not declare `defaultValue: true`. At runtime, empty storage falls back to the app manifest's `defaultEnabled` value, not the setting default.

Package-kind rules:

- `app` packages may declare a dock entry, overlay app surface, app-owned settings surface, background services, and route/site scopes. They should use shared overlay chrome and rail metadata instead of registering app-local docks or window managers.
- `feature` packages may declare scanner-delivered surfaces, generated Apps & Features controls, background routes, and user-action tools. They must not declare dock metadata or pretend to be rail apps.
- `theme` packages are for visual, texture, icon, chrome, or preset resources. They should not declare content-script surfaces, host permissions, background services, or remote services unless a later platform pass adds explicit theme runtime support and review rules.

### Composer actions

An app or feature can declare a `composerAction` only for a user-initiated,
composer-adjacent panel. It is not a rail action and must not call the package's
standalone `open()` lifecycle. The platform owns the trigger, anchor,
positioning, Escape/outside-click dismissal, and focus return; the package only
renders into the supplied panel. Every declared package stylesheet is loaded
into that panel's isolated shadow root before `onComposerAction()` runs. It does
not style the X document, and the runtime never loads undeclared package files.

```json
"composerAction": {
  "label": "Composer Kit",
  "presentation": "anchoredPanel"
}
```

Composer-action packages declare `"userAction"` in `loadTriggers` and export
`onComposerAction(context)`. `context` provides a platform-owned `panel`, a
`kind` of `post` or `reply`, an abort `signal`, `close()`, and
`openNativeDrafts()`. The latter opens X's own Drafts UI only after an explicit
package-control click; it does not expose draft contents, selection/caret
access, media handoff, upload, or posting capabilities. The host keeps the panel within the current viewport:
it opens below its action when that fits, flips above when that side has more
reachable room, and constrains only the host container when neither side can
fit the package content. It reevaluates placement on window, scroll, and
package-content size changes.

### Reply actions

An app or feature can declare `replyAction` to open its own reviewed local
panel after an explicit click on X's Reply control. The platform owns the X
control, below-control anchoring, scroll tracking, Escape/outside-click dismissal, focus
return, and the only native-composer operation. The package owns all visible
rows, labels, icons, and styling inside the isolated panel.

```json
"replyAction": {
  "templates": [
    { "id": "hello", "label": "Hello", "text": "Hello" },
    { "id": "custom", "label": "Custom", "storageKey": "example.customReply", "sendAfterInsert": true }
  ]
}
```

Each template has an ID and label and exactly one of `text` or `storageKey`.
The latter must be a package-declared local storage key and is omitted from
`context.templates` until it has a non-empty local value. `sendAfterInsert`
defaults to `false`; when a reviewed package explicitly sets it to `true`, the
host submits only after it has inserted and verified the exact user-selected
declared value. Reply-action packages
declare the `replyAction` surface, include `"userAction"` in `loadTriggers`,
and export `onReplyAction(context)`. The callback receives only the resolved
template IDs/labels plus `openNativeReply()` and `selectTemplate(id)`. The
latter accepts only a currently declared template ID, opens X's native reply
editor, types that local value, and submits only when its template explicitly
declares `sendAfterInsert`. Package code must not inspect
or mutate X's DOM, caret, composer content, media, or posting controls.

The package should render its own **Send a reply** row and invoke
`openNativeReply()`. It may render its own artwork for template rows and call
`selectTemplate(id)` only from an explicit user gesture. The platform does not
ship a generic quick-reply menu or iconography. Reply panels remain anchored
below their invoking Reply control as its post scrolls and leave the viewport
with that post when it scrolls away; they are not pinned to a viewport edge.
When the Reply control moves under X's sticky column header, its still-anchored
panel is hidden rather than drawn through the header.

### Package To Custom Build

`examples/packages/local-dev/dev-note/` is the smallest checked-in third-party
package. Use the [starter kit](../sdk/README.md) to build and validate a package,
then follow [Local Add-ons](LOCAL_ADDONS.md) to compose it into Chromium. A ZIP
contains one package root with `milxdy.app.json` at that root.

Expected managed artifacts:

- `tmp/local-addon-manager/status.json` with the workflow stage, build identity, package list, warnings, and classified failures
- `tmp/local-addon-manager/composition/composition-report.json` with accepted/rejected packages, trust decisions, consent acknowledgements, payload scan findings, settings/storage metadata, and background handler status
- `tmp/local-addon-manager/composition/build-plan.json` with generated app registry metadata, copied package file targets, host permissions, web-accessible resources, and diagnostics
- `tmp/local-addon-manager/composition/apps.generated.json` containing the generated registry rows with `localPackage` metadata and no first-party build-only fields
- `dist/chromium-local-apps/local-apps/<package-id>/...` containing copied declared package files
- `dist/chromium-local-apps/local-app-composition.json` preserving package source, review, diagnostics, privacy, and settings metadata for inspection

`docs/local-app-package.schema.json` is the authoring schema for `milxdy.app.json`. It includes the supported enum values for package kind, lifecycle mode, surfaces, site scopes, settings locations, controls, reset behavior, presets, privacy labels, cost classes, asset kinds, review status, and current background metadata.

### Starter Templates And Author Harness

Use `sdk/templates/basic-feature/` for a route-driven feature and
`sdk/templates/docked-app/` for a rail-capable overlay app. Both start disabled,
declare their package-owned state and assets, and use only the public context.
The docked template also demonstrates `boot`/`open`/`close`/`disable`/`dispose`,
guarded asset URLs, and declared-key storage.

For AI-assisted package drafting, use the reusable
[AI authoring prompt](../sdk/AI_AUTHORING.md). It constrains assistants to the
public SDK and keeps validation, consent, trust, licensing, privacy, and
maintainer review as required gates.

Before composing a browser build, import `createAppHarness` from
`sdk/testing/app-harness.mjs` in app-owned tests. It provides an in-memory public
context and records lifecycle calls, diagnostics, messages, and rescan requests.
It can flush or cancel scheduled work, abort the runtime signal, run registered
disposables, seed declared storage, and reject undeclared storage or assets.
The repository self-test is:

```powershell
pnpm.cmd run verify:app-sdk-harness
```

The harness validates public-contract behavior; it does not emulate the browser
DOM or prove runtime isolation. Browser composition and compatibility testing
remain separate responsibilities.

For app UI, copy `sdk/ui/theme.css` and `sdk/ui/overlay.css` into the package and
declare both files in manifest `css`. The docked starter demonstrates the
supported classes, semantic tokens, keyboard-close behavior, focus entry and
restoration, responsive geometry, reduced motion, and forced colors. See
`sdk/UI.md`, `sdk/ACCESSIBILITY.md`, and `sdk/ASSETS_AND_LICENSING.md` for the
review baseline. These public CSS files are package-owned copies at runtime;
apps must not import private helpers from `src/platform/overlay`.

### Package Fixtures

First-party replacement fixtures live under `examples/packages/first-party-replacements/`. They demonstrate built-in replacement and registry compatibility:

- `examples/packages/first-party-replacements/tweetPng/` converts the first-party Tweet PNG metadata into a package root with `milxdy.app.json`, a placeholder prebuilt `dist/content.js`, and a declared icon asset. It proves the invoked/user-action `feature` shape: `lifecycle.mode: "invoked"`, `loadTriggers: ["userAction"]`, X site scope metadata, Apps & Features settings metadata, local-only privacy notes, and no dock or runtime delivery surfaces.
- `examples/packages/first-party-replacements/wikiSidebar/` converts the first-party Wiki Sidebar metadata into a docked `app` package root with `milxdy.app.json`, placeholder prebuilt content/frame files, CSS, and a declared icon asset. It proves the overlay app shape: runtime lifecycle, `dock` and chrome metadata, embedded Wiki site scope, permission/privacy disclosure, background message metadata, and web-accessible assets.

Run `pnpm.cmd run verify:local-app-packages` to validate the fixtures. The verifier checks manifest version, ID/folder alignment, SDK compatibility, package kind rules, safe package-relative paths, declared file existence, lifecycle exports, site scopes, settings storage metadata, permissions/privacy disclosure, package assets, and absence of first-party-only runtime/build fields such as `entryName`, `entryPoint`, `requiredOutputs`, `isEnabled`, and `setEnabled`.

Novel package verification is separate so third-party developers do not accidentally validate the checked-in first-party fixtures:

```powershell
pnpm.cmd run verify:local-app-package -- --package=path\to\package --allow-local-review --acknowledge-package-consent
pnpm.cmd run verify:local-app-package -- --packages-dir=path\to\packages --allow-local-review --acknowledge-package-consent
```

That command runs the composer against only the selected package source, then inspects the generated build plan. It rejects missing trust acknowledgements, invalid enum values, unsafe or missing paths, bad lifecycle exports, missing storage declarations, unsupported background fields, invalid review/consent status, leaked first-party build-only fields, and novel packages that cannot be controlled through generated Apps & Features enablement metadata.

### Managed Catalog And Manual Workflows

The supported user procedure is documented once in
[Local Add-ons](LOCAL_ADDONS.md). It covers manual ZIPs, catalog selection
files, Prepare/Apply, trust acknowledgements, stable output, status, failure
recovery, and Chrome reload.

The manager uses the same package schema and composer described below. It adds
canonical `local-addons/manual/` and `local-addons/catalog/` inputs, pinned
catalog acquisition, transactional promotion to `dist/chromium-local-apps/`,
durable status, `buildInstanceId`, and `compositionFingerprint`.

The extension’s App Store launcher opens the canonical GitHub-hosted catalog
defined in `src/platform/app-sdk/addons-catalog.ts`. That configuration accepts
only the documented HTTPS catalog URL and its App SDK fallback; it is a
discovery link only and never installs packages or grants permissions. It opens
or focuses a normal browser tab, and its optional cue uses the shared Interface
sounds control in the extension Audio settings.

The catalog selection document is defined by
[`milxdy-selection.schema.json`](milxdy-selection.schema.json). Catalog review
claims become trusted only when their package ID, archive hash, reviewer, and
review date match the checked-in trusted-review registry.

### Low-Level Composer And Builder

The commands in this section are author and repository inspection tools. The
supported user drop folders are `local-addons/manual/` and
`local-addons/catalog/`; `local-app-packages/` remains a backward-compatible
low-level composer input.

The deterministic composer is implemented as:

```powershell
pnpm.cmd run compose:local-apps -- --allow-local-review --acknowledge-package-consent --acknowledge-first-party-replacement
```

By default, it discovers folders and `.zip` archives under `local-app-packages/` when that ignored local drop folder exists. If it does not exist, the command falls back to the checked-in fixtures under `examples/packages/first-party-replacements/` for repeatable repo verification. Advanced users can select sources explicitly:

```powershell
pnpm.cmd run compose:local-apps -- --packages-dir=path\to\packages --allow-local-review --acknowledge-package-consent
pnpm.cmd run compose:local-apps -- --package=path\to\package-folder --allow-local-review --acknowledge-package-consent
pnpm.cmd run compose:local-apps -- --package=path\to\package.zip --allow-local-review --acknowledge-package-consent
pnpm.cmd run compose:local-apps -- --out-dir=tmp\my-composition --plan-out=tmp\my-composition\build-plan.json --allow-local-review --acknowledge-package-consent
```

On a clean checkout, the checked-in example packages intentionally replace built-in app IDs, so the default fallback example set requires `--acknowledge-first-party-replacement`. Passing that acknowledgement is harmless for selected package sets that do not replace built-ins.

The composer fails closed by default. `review.status: "blocked"` is always
rejected. Missing or `local` review status requires `--allow-local-review`, and
packages that declare privileged build inputs require
`--acknowledge-package-consent` before any build plan is emitted. Privileged
inputs include content entries, CSS, package assets, web-accessible assets, host
or optional permissions, site scopes, background message types/services, and
privacy metadata with `consentRequired: true`.

The composer validates the selected package set, prints a human-readable dry run, and writes reviewable machine-readable output under `tmp/local-app-composition/` by default:

- `composition-report.json`
- `build-plan.json`
- `apps.generated.json`
- `manifest-permissions.generated.json`
- `web-accessible-assets.generated.json`

The composer summarizes discovered, accepted, rejected, and warned packages; SDK compatibility; permissions; web-accessible assets; content, CSS, frame, worker, WASM, and HTML asset declarations; background message routes and services; settings/storage participation; preset/profile-pack participation; privacy/consent requirements; and diagnostics labels.

Generated custom-build manifest resources automatically include every accepted local package `contentEntry`, because the content runtime imports those modules with `chrome.runtime.getURL(app.contentEntry)`. Declared package `webAccessibleAssets` remain explicit opt-ins for icons, frames, workers, media, and other extension-origin resources. The inspection artifact `local-app-composition.json` is copied into the custom build output but is not web-accessible.

The bundled Remilia Wiki assistant helper ZIP is packaged for the extension popup download flow only. It is intentionally not listed in `web_accessible_resources`, so host pages cannot fetch the helper prompt/material directly even though it remains visible to users who download the release archive.

Zip archives must contain exactly one package root with `milxdy.app.json` at the archive root. The composer rejects missing manifests, nested or multiple manifests, malformed JSON, encrypted entries, unsupported compression, absolute paths, `..` traversal, unsafe filenames, files outside the package root, oversized entries, and oversized archives before producing a plan. Zip entries are extracted only into ignored `tmp/local-app-composition/extracted/` working folders so the normal build can copy declared package files by path; no package code is executed during composition.

The package-set conflict model rejects duplicate local package IDs, incompatible SDK versions, unsafe or missing declared files, invalid background message patterns, duplicate or overlapping background message types/services, background capabilities without review disclosure and consent, storage-key ownership conflicts, host permissions without privacy notes, site/route conflicts, web-accessible asset and asset-ID collisions, invalid package-kind capabilities, sensitive profile-pack participation, blocked review status, unacknowledged local review, unacknowledged privileged/consent surfaces, and app chrome/theme override conflicts without deterministic precedence. Local packages whose ID matches a built-in app intentionally shadow that built-in app only inside the generated custom build plan; this keeps the replacement fixtures usable while still rejecting duplicate IDs within the selected local package set.

Review metadata is preserved in reports, generated app metadata, and `local-app-composition.json`. `review.status: "blocked"` is rejected, `review.status: "reviewed"` is treated as accepted metadata for ordinary local packages, and missing or `local` review status is rejected unless the developer passes `--allow-local-review`. Built-in app ID replacement is stricter: package-authored review metadata is not a trust root, so replacements must match the repo-owned root and package SHA-256 policy in `scripts/packages/local-app-first-party-replacements.json` in addition to `--acknowledge-first-party-replacement`. The checked-in first-party replacement fixtures under `examples/packages/first-party-replacements/<id>` are the allowed replacements. Reports separate accepted packages, rejected packages, required acknowledgements, trust/consent decisions, scanner findings, warnings, and errors. Reports and build plans include SHA-256 hashes for package archives, package file sets, and copied files as a stable attachment point for provenance and review tooling. If a selected package set is rejected, the composer may write `composition-report.json` but does not emit a build plan.

The composer statically scans declared text payloads while skipping binary
assets. It flags direct `chrome.runtime.sendMessage`/`connect`,
`browser.runtime.*`, broad privileged `chrome.*` or `browser.*` APIs,
common computed extension API access patterns, extension-origin URL access,
unsafe `eval`/`new Function`, and remote script loading. Sensitive findings
require `review.status: "reviewed"` plus `--allow-sensitive-package-apis`;
without that reviewed exception the package stays rejected. Runtime
message/port findings are stricter: direct or computed
`chrome.runtime.sendMessage`, `browser.runtime.sendMessage`, and
`runtime.connect` access cannot be authorized by that flag because local
packages must use `context.sendMessage()` and declared
`background.messageTypes`.

This scan is a conservative review gate, not runtime isolation. Local packages
are still privileged code inside a custom extension build, so a clean scan only
means no known scanner pattern matched; it does not prove package code cannot
reach extension APIs. Do not market local packages as capability-isolated until
package execution moves behind a runtime membrane or sandbox that exposes only
the SDK facade.

To build a selected package set directly as an unpacked Chromium extension:

```powershell
pnpm.cmd run build:local-apps:chromium -- --allow-local-review --acknowledge-package-consent --acknowledge-first-party-replacement
```

That low-level action reruns the composer through `scripts/build/build-local-apps.mjs` and then calls `scripts/build/build-extension.mjs --target=chromium --local-app-plan=tmp/local-app-composition/build-plan.json`. The same `--packages-dir`, `--package`, `--out-dir`, and `--plan-out` flags can be passed after `--` on the pnpm command. The output is `dist/chromium-local-apps/`. Selected package payloads are copied to deterministic `local-apps/<package-id>/...` paths, generated metadata is emitted as `local-app-composition.json`, host permissions and web-accessible resources are merged explicitly, and normal release builds continue to ignore local package source unless a local composition plan is passed. The Add-on Manager is the user-facing wrapper that adds canonical folders, transaction recovery, persistent status, and Prepare/Apply.

On a clean checkout using the checked-in examples fallback, the first-party replacement acknowledgement is required because the examples intentionally shadow built-in app IDs.

The builder supports folder packages and ZIP archives. It produces an unpacked Chromium distribution for developer review and local installation.

Background declarations are metadata-only for third-party local packages in this release. `background.messageTypes` may declare the message types a content bundle is allowed to send through `context.sendMessage`, and those message types must live under the package's own namespace such as `dev-note:*`. The composer does not copy, import, or register package-owned background handlers. `background.services` and extra fields such as `background.entry` are rejected until a reviewed package-owned background-loader design exists.

Shared-service expectations:

- Content bundles export SDK lifecycle hooks and use `context.scheduler`, `context.signal`, `context.sendMessage`, `context.recordDiagnostic`, and shared scanner delivery instead of app-owned duplicate observers, direct runtime messaging, or unbounded polling.
- Overlay packages use `overlayDock`, `overlayAppFrame`, and `overlayPanelBase` behavior instead of custom drag/resize/layout primitives.
- Background work declares `background.messageTypes`, `background.services`, `permissions.hosts`, privacy notes, and URL allowlists before the router enables it.
- Settings use the manifest settings schema and storage metadata so Apps & Features, profile packs, reset, and import/export flows can reason about them without importing the app bundle.
- Packages that declare non-X sites must distinguish `contentScript`, `backgroundService`, `embeddedFrame`, and `overlayApp` integrations; a host permission alone does not mean the full content runtime should inject there.

Security and trust safeguards:

- deterministic manifest, archive, path, asset, lifecycle, settings, background-message, permission, privacy, and URL metadata validation
- fail-closed trust and consent acknowledgements for local review, privileged package surfaces, sensitive API exceptions, and first-party replacements
- package-set conflict handling for duplicate IDs, incompatible SDK versions, blocked packages, malformed zips, storage ownership, routes, background namespaces, assets, hosts, and theme/chrome precedence
- package and build-plan hashes plus builder-side tamper checks before copied code reaches a generated build
- static payload review gates that block direct runtime messaging and require reviewed acknowledgement for permitted non-runtime sensitive API exceptions

## Distribution Boundary

App SDK 0.2.3 packages are incorporated into reviewed custom builds. The SDK
does not inject new JavaScript into an already-installed extension, and its
static review scanner is not described as a JavaScript sandbox. Package-owned
background modules use host-provided typed services and declared message
routes. These boundaries keep the supported platform precise without limiting
what authors can build through the public lifecycle, storage, asset, messaging,
surface, overlay, settings, and diagnostic APIs.

For the stable end-user ZIP folder, rebuild, and Chrome reload workflow, see
[Local Add-ons](LOCAL_ADDONS.md).
For the current GitHub-based maintainer submission and catalog-review process, see [Submit a milXdy Add-on for Catalog Consideration](ADD_ON_CATALOG_SUBMISSIONS.md). It describes the required review materials and outcomes without changing the local package contract or creating a package registry, signing guarantee, or automated publishing system.
