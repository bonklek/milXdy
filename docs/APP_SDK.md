# milXdy App SDK

milXdy first-party features now run through a shared app platform instead of each feature owning its own bootstrap path. The current SDK is intentionally local-first: built-in apps use the same manifest concepts future external packages should use, while external package loading, remote install/update UX, and a stable third-party API remain future work. Local app packages are privileged, reviewed custom-build inputs; they are not sandboxed runtime plugins.

## Prepared SDK Status

`0.2.0` shipped the first app-platform preview. `0.2.1` polished that platform for public beta distribution. `0.2.2` established the prepared local-first contract, and `0.2.3` hardens reviewed package composition, tamper detection, trust acknowledgements, and generated custom builds. The supported near-term product boundary and production exit criteria live in [App Platform Production Readiness](APP_PLATFORM_PRODUCTION_READINESS.md); version compatibility and deprecation rules live in [App SDK Compatibility](APP_SDK_COMPATIBILITY.md).

This is still not the final remote community app system. Treat the APIs here as the current internal contract and public design direction, not a finalized third-party compatibility promise.

The long-term goal is a complete composable app/mod system where default apps and community apps can live as packages in an apps folder. In that model, an app should declare its surfaces, permissions, assets, dock behavior, performance cost, privacy notes, and lifecycle hooks through a manifest instead of wiring itself directly into the extension root.

That final shape needs more refactoring before it can be safe and efficient. Most milXdy apps touch the same expensive X/Twitter substrate: timeline scanning, user/profile detection, route changes, media surfaces, visual effects, background fetches, and overlay panels. The platform needs those systems to stay shared so every app does not bring its own observer, poller, scanner, animation layer, or network queue. Until that extraction is complete, first-party apps remain bundled in the extension while the registry, lifecycle, Apps & Features, and rail establish the contract future packages should target.

Developers can use this document to plan app ideas now, especially around manifests, declared surfaces, load triggers, performance cost, Apps & Features disclosure, settings schema, diagnostics, and docked UI behavior.

For `0.2.2`, SDK preparation should focus on:

- first-party app package boundaries and folder conventions
- lifecycle hook stability
- manifest metadata completeness
- shared runtime/scanner usage instead of app-owned duplicate observers
- settings/preset participation
- dock/window behavior expected from app surfaces
- diagnostics that can prove app runtime cost and scanner decisions

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
- `siteScopes` metadata for site-specific host, route, surface, and integration-mode declarations across X/Twitter, RemiliaNET, Remilia Wiki, Miladychan, and future reviewed sites
- `packageKind` as `app`, `feature`, or `theme` so future package hosts can group install, settings, and review flows without inferring intent from the ID
- `dock` metadata for apps that appear in the shared overlay dock
- `chrome` metadata for app-window style compatibility: native style, supported shared presets, and notes about app-specific chrome constraints
- `settings` metadata for user-configurable storage-backed controls
- `background.messageTypes` and `background.services`
- `permissions.hosts` for URL allowlist documentation

`src/platform/app-sdk/first-party-apps.json` is the source of truth for first-party package metadata. `src/platform/app-sdk/first-party-registry.ts` adapts that static registry into runtime manifests by adding storage-backed `isEnabled()` functions, and `scripts/build/build-extension.mjs` consumes the same JSON for bundle entries, copied assets, CSS, web-accessible files, and required outputs.

Lifecycle metadata is intentionally small while the SDK remains local-first. Runtime-owned packages may omit `lifecycle` today, but packages that rely on unusual loading behavior should be explicit:

- `mode: "runtime"` means the shared content runtime owns imports, `boot()`, route/surface delivery, dock open/close, disable, dispose, abort signals, and diagnostics.
- `mode: "invoked"` means the package is loaded only from a declared user action. It should use `loadTriggers: ["userAction"]`, avoid runtime delivery `surfaces`, declare `invokedBy: "userAction"` plus the platform load `reason`, and should not add a fake `boot()` export.

Site scopes describe where an app integrates with a host site without overloading broad surface names. A scope declares `site`, host permission-style `hosts`, an `integration` mode, relevant `surfaces`, optional `routes` with `exact` or `prefix` path matching, and optional `presentation` such as `sideRailOverlay`, `hostRouteOverlay`, or `userAction`.

Supported site IDs are currently `x`, `remiliaNet`, `remiliaWiki`, and `miladychan`. Supported integration modes are:

- `contentScript` for the main shared content runtime on declared host matches
- `backgroundService` for routed background fetch, auth, WebSocket, or privileged service work without page injection
- `embeddedFrame` for behavior inside a validated embedded frame, such as the Wiki sidebar frame
- `overlayApp` for a local overlay surface whose host relationship is user-initiated or service-backed rather than injected

The current release still injects the main app runtime only on X/Twitter. RemiliaNET, Remilia Wiki, and Miladychan declarations describe background-service, embedded-frame, or overlay integrations unless a future manifest explicitly broadens content-script matches, permissions, privacy disclosure, and QA. Route-aware packages that claim X direct-message behavior must declare the `/messages`, `/messages/...`, `/i/chat`, and `/i/chat/...` patterns they support.

## Settings Schema

Apps, non-app features, and future theme packages declare user-configurable settings in the manifest `settings` array. The schema is intentionally descriptive first: current first-party UI can still use local bindings, while Apps & Features and future package hosts can discover where a setting lives, how it resets, and whether presets may change it without hard-coding every control.

For the current popup-to-Apps & Features migration map, including existing storage keys, owners, destinations, preset participation, and mirroring notes, see the [Settings Migration Audit](SETTINGS_MIGRATION_AUDIT.md).

Each setting entry should include:

- `id`: stable dotted identifier, usually `<appId>.<settingName>` or a global namespace such as `appearance.appWindowStyle`
- `label` and optional `description`: public copy that can appear in settings search, Apps & Features details, import previews, and future generated controls
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

Use `scope: global` only for settings that intentionally affect more than one app or surface, such as Appearance profile, app chrome style, app shadows, Performance mode, or future side-rail layout. App-owned settings belong to `scope: app` even when the app is docked in the rail. Page-wide non-window features such as inline wiki linking or RemiStats badges use `scope: feature`.

Use `role` to distinguish app-card affordances from detailed preferences. App-owned settings in Apps & Features may declare `role: "enablement"`, `role: "open"`, or `role: "reset"` when the control belongs beside the card's enable/open/reset actions. Detailed app preferences remain `role: "preference"` or omit the field and should live in an app surface, an explicit app settings surface, or a temporary popup mirror until migration is complete. Legacy keys can still be enablement controls when real behavior uses them that way; Milady Maxxer `mode`, for example, is stored as a mode value but still carries app on/off behavior through `off` versus enabled modes.

Storage metadata must match the actual browser storage location. If the value is stored inside an object, declare the object key and the `property`; if the setting owns a whole key, omit `property`. Keep `storageKeys` at the app level as the reset and change-detection list, and use `settings` to describe the user-facing controls inside those keys.

Preset participation is opt-in per setting. Visual presets should only touch visible appearance values; audio presets should only touch playback, voice, sound, or notification-audio values; performance presets should only touch cost, scheduling, or fidelity settings; first-run presets should configure exact app enablement, rail participation, and the matching Performance mode; profile packs may include any declared non-sensitive setting that opts in. When applying a preset would replace a user's current value, the UI should warn, let the user cancel, and offer a save-as-custom path where the flow supports custom profiles.

Never mark authentication tokens, sessions, cookies, API keys, local absolute file paths, private cache payloads, or remote account data as preset/profile-pack participants. Local package manifests must not expose those values through generated settings controls at all, and novel packages must not claim built-in registry storage keys unless they are trusted first-party replacements. Sensitive values may appear in internal storage keys, but the settings schema should expose only safe controls and public reset behavior.

Apps & Features cards use manifest settings metadata for details and search. A future generated settings renderer should build from the same schema instead of adding per-app switch statements.

Use `control.options` for select or segmented controls with stable, enumerable values. Use `control.dynamicOptions` when values come from a runtime provider such as browser/OS Web Speech voices; the manifest should name the provider, value field, label field, refresh event when relevant, and portability limits. Do not add placeholder static options for provider-owned values, and make profile-pack flows preview or fall back when a dynamic value is unavailable on another browser profile.

## Profile Packs

Profile packs are versioned shareable bundles for settings that are broader than one custom visual theme. The current public schema is `kind: "milxdy.profilePack"` with `version: 1`, implemented in `src/platform/settings/profile-packs.ts`.

A pack may contain these top-level sections:

- `appearance`: the current reskin profile and a nested `milxdy.visualTheme` payload, preserving compatibility with the existing visual theme export/import/share format
- `performance`: Performance mode, currently stored at `milxdy.performance.mode`
- `apps`: declared app enablement values, once export/import UI opts those settings in
- `rail`: declared side-rail pins and side preference, once export/import UI opts those settings in
- `layout`: declared layout and app chrome override values, once export/import UI opts those settings in

The first import/export UI supports `appearance` plus the non-visual `performance` section. Existing appearance theme JSON export/import and appearance share strings remain separate and continue to work; profile packs nest the visual theme rather than replacing that format.

The current UI writes only these keys during profile-pack import:

- `milxdy.settings.reskinProfile`
- `milxdy.settings.visualTheme`
- `milxdy.performance.mode`

Future profile-pack sections may include declared app enablement, rail pins, rail side, layout, and app chrome override keys after those settings opt into `profilePack`. They must exclude auth tokens, session cookies, API keys, private account data, local absolute file paths, large caches, and diagnostic payloads. Settings should participate in profile packs only when their manifest entry includes `profilePack` in `presets`.

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
- `theme`: future texture, visual, or profile packages that should appear as installable packages without pretending to be launchable apps

Full apps and features can share categories such as `reading`, `social`, `appearance`, `media`, or `game`, but category should not decide the IA section. Use `packageKind` for section placement and `hub.category` for filtering, chips, and search.

Manifest `hub.rail.supported` controls whether an app can be pinned. `hub.rail.defaultPinned` is app-store metadata for first-run presets and future package install flows; it should not be confused with current-user pin state. The shared dock enforces hidden item IDs globally, so feature bundles cannot bypass Hub pinning by registering their own app frame after lazy import.

Current first-party Apps & Features-managed enablement keys include Post-reading `enabled`, Composer Tools `milxdy.composerTools.enabled`, RemiStats `milxdy.remistats.enabled`, Beetol `milxdy.remistats.beetol.enabled`, RemiNet Chat `milxdy.reminetChat.enabled`, Miladychan Portal `milxdy.miladychan.enabled`, Music `milxdy.music.enabled`, Wiki links `remiliaWikiHyperlink.settings.enabled`, Wiki sidebar `remiliaWikiHyperlink.settings.sidebarEnabled` with fallback migration from the legacy Wiki links bit when unset, and Milady Maxxer `mode` as a legacy enablement/mode key.

Fresh installs set `milxdy.apps.firstRun.status` to `pending`, which lets the content runtime open Apps & Features once on X. The background install seeder keeps first-party apps enabled by default until the user chooses a setup. Choosing Lite, Balanced, or Full converges toggleable apps to the exact manifest `hub.presets` set, disables toggleable apps excluded from that preset, applies `hub.rail.defaultPinned`, and applies the matching Performance mode without importing app bundles just to change settings. Core entries without enablement toggles are preserved. The same setup choices remain available from the Apps & Features settings menu after first-run.

Release builds keep the full first-party app set, assets, and host permissions. Lite, Balanced, and Full are setup/preset choices inside milXdy; they must not make an app unavailable or remove its enable, pin, or open controls.

Apps & Features cards derive their compact metadata chips from the same registry fields: package kind, cost profile, rail support, privacy labels, remote services, chrome support, and settings schema. Keep those fields accurate when adding an app because they are both release documentation and user-facing runtime disclosure.

The card Details toggle is also registry-driven. It expands to show the app description, performance cost profile, load triggers, settings home, data notes, permission notes or hosts, storage notes or keys, diagnostics/runtime state, and build availability. Cards with declared storage keys also get a reset-settings action that restores declared setting defaults, resets object-backed settings by property, skips shared broad keys unless a setting explicitly owns the whole key, re-reads manifest enablement, updates dock/scanner state, and records `hub.reset.<appId>` diagnostics without importing the app bundle. Do not hard-code per-app disclosure copy or reset key lists when a registry field can describe it.

Global controls and presets stay in the top-right extension popup. Apps & Features owns app/feature enablement, launch/open actions, rail pinning, storage reset, permissions/privacy/data disclosure, diagnostics/status rows, and shortcuts into app-owned settings. App-owned settings in Apps & Features must declare an enablement/open/reset role; detailed app preferences should live in the app window or app settings surface. Feature settings should surface directly in Apps & Features once generated setting controls are implemented.

Reserve a future package area inside Apps & Features for reviewed marketplace links and local package loading. Reviewed marketplace entries should be visually distinct from unreviewed local packages. Local loading should expose Load/Reload apps, validation status, incompatible-package messages, declared kind grouping, safe disable/remove/reset actions, and permission/data-use disclosure before enabling sensitive or remote-service packages.

Right-click settings shortcuts on rail app icons are a useful future affordance, but they should open the same app-owned settings surface described by the manifest rather than creating a second settings location.

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

Use the shared overlay drag and resize helpers for movable app windows. Header buttons, links, form controls, and editable fields must stay clickable and should not accidentally start a drag; the shared drag helper ignores those interactive descendants by default. If an app intentionally uses an interactive-looking control as its drag handle, document that exception in code with `allowInteractiveDragTarget` so future audits can tell it apart from accidental bubbling.

Overlay layout records live in `local:milxdy.overlayApps.layouts.v1`. They may store app IDs, pixel bounds, rail side, viewport size, snap metadata, and timestamps; they must not store page URLs, account identifiers, iframe contents, board/thread payloads, music library paths, auth state, or remote-service data. Keep legacy per-app width, height, and top keys readable during migration.

For public contributor-facing UI expectations, including classic utility-window styling, side-rail behavior, app headers, controls, and semantic theme variables, see the [Contributor UI Style Guide](CONTRIBUTOR_UI_STYLE_GUIDE.md).

## App Chrome Styles

App chrome style means the visual frame around an app surface: borders, bevels, shadows, title/header treatment, panel surfaces, and window controls. It is separate from X/Twitter content theme, Performance mode, and app-specific functional settings.

The global Appearance control stores `appWindowStyle` in `milxdy.settings.visualTheme`. Current global values are:

- `native`: use each app's authored default chrome
- `reminet`: apply the shared RemiNet-style retro internet chrome where supported
- `classic`: apply the shared late-90s classic bevel chrome where supported

Apps declare chrome compatibility in `src/platform/app-sdk/first-party-apps.json` with `chrome.nativeStyle`, `chrome.supportedStyles`, and optional `chrome.notes`. Native style names can identify app-authored examples such as `maxxer`, `reader`, `miladychan`, `music`, or `wiki`, while `supportedStyles` should include the shared styles the app can safely receive without losing its core affordances.

Future per-app overrides should build on that manifest metadata instead of creating app-local theme storage. The intended model is: one global default, optional per-app override to a supported style, and `native` as the escape hatch that preserves the app's authored look.

## Background Services

`src/platform/background/router.ts` provides the typed central message router used by `src/extension/background/index.ts`. Message handlers must keep strict allowlists for network access and return stable `{ ok, status, error, data }`-style envelopes where possible.

App SDK `context.sendMessage()` calls are app-scoped. The content runtime extracts object message `type` values and only forwards messages covered by the sender app's manifest `background.messageTypes` entries. Entries may be exact types such as `wikiSidebar:openTab` or trailing wildcards such as `beetol:*`; shared routes such as `reminetIdentity:getProfile` must be declared by each sender that uses them.

Use `src/platform/browser/url-allowlist.ts` for background fetch URL policy checks. Service handlers should declare small rule sets near the service they protect, then call `parseAllowedUrl()` or `isAllowedUrl()` before any fetch that uses a URL supplied by content scripts, app UI, remote payloads, QR imports, or user-controlled metadata.

Feature-specific background modules can continue to register handlers during migration, but new shared services should be added through the router. Direct `safeRuntimeMessage`, `chrome.runtime.sendMessage`, and `chrome.runtime.connect` bridges are allowed only for documented internal surfaces that cannot receive App SDK context, such as packaged frames or stateful streaming ports. They are internal privileged bridges, not local package APIs and not sandbox boundaries; those bridges must add sender validation in background handlers and remain visible in compliance verification.

## First-Party Compliance Checklist

Run `pnpm.cmd run verify:app-sdk-compliance` after changing first-party app metadata, lifecycle exports, app entries, background routes, generated Apps & Features settings, or shared scanner/scheduler/overlay behavior. The verifier is deterministic and no-network; it freezes the objective parts of the current local-first contract while reporting current migration gaps as warnings. Run `pnpm.cmd run verify:internal-messaging-bridges` after touching the remaining internal frame or port bridges so their sender restrictions stay explicit.

First-party apps and feature packages should satisfy this checklist:

| Area | Current compliance target |
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
| Cost, privacy, and permissions | Cost metadata, remote-service notes, host permissions, local-storage notes, and privacy labels must stay accurate enough for Apps & Features details, Health diagnostics, and future package review. |
| Diagnostics | The runtime records app load state, import avoidance, heavy/worker/network app lists, surface delivery, scheduler, network queue, storage reset, long-task, and layout-shift diagnostics from shared metadata rather than per-app hard-coded lists. |

Current first-party status:

| Package | Status | Notes and follow-up prompts |
| --- | --- | --- |
| RemiNet Chat | Aligned with internal socket bridge | Uses shared dock chrome and App SDK routed background messages. Declares runtime lifecycle metadata and explicit X direct-message route scopes for side-rail overlay behavior on `/messages`, `/messages/...`, `/i/chat`, and `/i/chat/...`. The WebSocket stream runs in an already-open RemiliaNET page and crosses two stateful `runtime.connect` ports; the background validates same-extension top-frame X/Twitter and RemiliaNET senders before relaying commands or frames. |
| Beetol | Aligned | Uses shared dock frame, background router metadata, and App SDK routed messaging. Legacy direct runtime-message fallback has been removed from the app surface path. |
| Miladychan Portal | Aligned | Uses shared overlay chrome, route through background router, and declares remote-service/privacy metadata. Keep public board fetches on allowlisted routes. |
| Music | Aligned | Uses shared overlay chrome, App SDK routed background messaging, and local-file plus remote enrichment disclosure. Local folder and API-key-adjacent settings must remain out of profile packs unless explicitly safe. |
| Remilia Wiki hyperlinks | Mostly aligned | Inline feature uses shared surface delivery. Feature preferences, including previews and draft workflow mode, are generated in Apps & Features while popup controls remain storage-compatible mirrors. |
| Remilia Wiki sidebar | Aligned with internal iframe bridge | Uses shared overlay chrome and declares its wiki sidebar background routes. Frame-local observers and frame-to-background messages are sidebar-frame implementation details; background handlers validate same-extension non-top wiki frame senders before forwarding navigation, history, open-tab, or read-aloud messages. |
| Post-reading | Mostly aligned with internal OCR frame bridge | Uses shared scanner delivery, overlay player chrome, App SDK routed full-quote fetches, and background fetch router. The packaged OCR frame may request image blobs through a direct helper message, but the background handler restricts that route to the packaged `ocr.html` sender, and the web-accessible OCR frame only accepts parent requests from allowed X/Twitter/wiki origins after a content-issued frame authentication token is initialized. Voice selection declares dynamic Web Speech options, so generated settings and profile-pack flows should treat saved voice URIs as browser-profile dependent. |
| RemiStats and Pokes | Transitional | Runtime uses shared surface delivery and background router. Some generated settings write local keys that are not yet listed in `storageKeys.local`; align reset/storage metadata before hiding old popup mirrors. |
| Milady Maxxer | Mostly aligned, heavy app | Uses shared scanner delivery, overlay chrome, worker/output metadata, and App SDK routed background work. Keep heavy model, remote identity, and cache disclosures explicit; app-owned settings should stay in app surfaces except enablement. |
| Tweet PNG | Invoked-only | Declares `lifecycle.mode: "invoked"` and remains a local `userAction` package loaded by Root Visuals from the X share-menu action. If it becomes a runtime app, change the lifecycle mode, add real lifecycle exports, and keep PNG rendering local and user initiated. |
| Composer Tools | Aligned lightweight feature | Runtime-loaded local-only feature with a metadata-backed Apps & Features enablement toggle. Its document input listeners are scoped to supported X/Twitter post composers and cleaned up through runtime disposables. |
| Root Visuals | Core feature with bounded page-chrome observers | Uses shared runtime scheduling and `deliverySurfaces: ["notification"]`. Theme watching is attribute-only on document theme roots, the home-logo observer attaches only to discovered header/h1 page-chrome roots with route/boot retries for late X SPA rendering, and the click-triggered Tweet PNG share-menu observer is scheduler-capped and cleaned up. A fuller shared page-chrome scanner/service remains deferred to #39/#90/#64. |

Known schema and runtime limitations:

- Lifecycle and site support now has manifest metadata for invoked-only tools, X direct-message routes, and current RemiliaNET, Wiki, and Miladychan service/frame integrations. The shared runtime remains X-content-script-first; do not silently assume every non-X site scope is backed by the Twitter/X scanner or a content-script app runtime.
- Background route metadata is checked against shared router registrations, with first-party app message patterns declared in the registry.
- App-owned scheduler/timer fallbacks should become app-specific follow-up work, not hidden verifier exceptions.
- App-owned settings in Apps & Features are acceptable for enable/open/reset controls, but detailed app settings should move to app surfaces or explicit app settings surfaces.

## Local Apps-Folder Package Shape

External package loading is not implemented yet inside an already-loaded store extension. The current local path is reviewed custom-build composition: a package is composed into a new unpacked Chromium build, reviewed by the developer, and then loaded as that custom build. The package contract below must stay compatible with the first-party registry and the runtime contract described above.

Expected install shape:

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

A copied folder or zip should have one package root and one required `milxdy.app.json` at that root. Normal users should not need to edit source files, build config, extension manifests, or registry JSON to try a future local package; the package should ship prebuilt bundles and declared assets. A future Load/Reload apps action should discover packages, validate them, show compatible/incompatible status, and keep malformed packages disabled with visible errors.

`milxdy.app.json` should use manifest version `1` and map onto `MilxdyLocalAppPackageManifestV1` in `src/platform/app-sdk/app-platform.ts`. Required fields:

- `manifestVersion: 1`
- `id`, `name`, `version`, `description`
- `packageKind`: `app`, `feature`, or `theme`; texture/resource packs should use `theme` until a separate package kind is justified by runtime behavior
- `sdk.minVersion` and optional `sdk.targetVersion`
- `contentEntry` for the prebuilt executable `.js` or `.mjs` content bundle, plus optional `css`
- `defaultEnabled`, `storageKeys`, `settings`, `surfaces`, `cost`, and `loadTriggers`
- `hub` metadata for category, descriptions, rail support/default pinning, presets, disclosure notes, remote services, local storage notes, and privacy labels
- `package.assets` and `package.webAccessibleAssets` for icons, media, workers, WASM, HTML helpers, and other files the platform may copy or expose
- `lifecycle`, `siteScopes`, `dock`, `chrome`, `permissions`, and `background` when the package uses those capabilities
- `privacy` with permission notes, data notes, local-storage notes, privacy labels, optional remote services, and whether sensitive consent is required before enabling

Package paths are package-root-relative, must not be absolute, and must not contain `..` traversal segments. Host access belongs in `permissions.hosts` and matching `siteScopes.hosts`; hidden remote services, undeclared WebSocket endpoints, and broad optional host permissions are not valid local-package defaults.

First-party build-only registry fields do not belong in `milxdy.app.json`. Keep `entryName`, `entryPoint`, CSS `source`/`target`/`targetDir`, `requiredOutputs`, and other source-build wiring inside `src/platform/app-sdk/first-party-apps.json` and `scripts/build/build-extension.mjs`. Local packages should reference the built files they contain, not the source files used to create them. The local composer copies package files as-is and does not transpile TypeScript or JSX, so `contentEntry` must point at an executable `.js` or `.mjs` module.

Novel local package IDs become Apps & Features controllable when they declare a storage-backed setting with `role: "enablement"`, `control.type: "toggle"`, `location: "appsAndFeatures"`, and a `storage` target listed in `storageKeys.local` or `storageKeys.sync`. The generated custom-build registry keeps first-party adapters for built-in IDs, but unknown local IDs use this generic enablement adapter. Use `defaultEnabled: false` for new third-party packages unless the package is intentionally always-on and has no privileged consent surface; packages that request host permissions, optional permissions, remote services, background capability, or `privacy.consentRequired: true` must start disabled, and their enablement setting must not declare `defaultValue: true`. At runtime, empty storage falls back to the app manifest's `defaultEnabled` value, not the setting default.

Package-kind rules:

- `app` packages may declare a dock entry, overlay app surface, app-owned settings surface, background services, and route/site scopes. They should use shared overlay chrome and rail metadata instead of registering app-local docks or window managers.
- `feature` packages may declare scanner-delivered surfaces, generated Apps & Features controls, background routes, and user-action tools. They must not declare dock metadata or pretend to be rail apps.
- `theme` packages are for visual, texture, icon, chrome, or preset resources. They should not declare content-script surfaces, host permissions, background services, or remote services unless a later platform pass adds explicit theme runtime support and review rules.

### Empty Folder To Custom Build

Use the checked-in novel sample as the smallest third-party package shape:

```powershell
mkdir local-app-packages
copy-item -Recurse examples/packages/local-dev/dev-note local-app-packages/dev-note
pnpm.cmd run verify:local-app-package -- --package=local-app-packages/dev-note --allow-local-review --acknowledge-package-consent
pnpm.cmd run build:local-apps:chromium -- --package=local-app-packages/dev-note --allow-local-review --acknowledge-package-consent
```

Expected generated artifacts:

- `tmp/local-app-composition/composition-report.json` with accepted/rejected packages, trust decisions, consent acknowledgements, payload scan findings, settings/storage metadata, and background handler status
- `tmp/local-app-composition/build-plan.json` with generated app registry metadata, copied package file targets, host permissions, web-accessible resources, and diagnostics
- `tmp/local-app-composition/apps.generated.json` containing the generated registry row with `localPackage` metadata and no first-party build-only fields
- `dist/chromium-local-apps/local-apps/<package-id>/...` containing copied declared package files
- `dist/chromium-local-apps/local-app-composition.json` preserving package source, review, diagnostics, privacy, and settings metadata for inspection

`docs/local-app-package.schema.json` is the authoring schema for `milxdy.app.json`. It includes the supported enum values for package kind, lifecycle mode, surfaces, site scopes, settings locations, controls, reset behavior, presets, privacy labels, cost classes, asset kinds, review status, and current background metadata.

### Starter Templates And Author Harness

Use `sdk/templates/basic-feature/` for a route-driven feature and
`sdk/templates/docked-app/` for a rail-capable overlay app. Both start disabled,
declare their package-owned state and assets, and use only the public context.
The docked template also demonstrates `boot`/`open`/`close`/`disable`/`dispose`,
guarded asset URLs, and declared-key storage.

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
DOM or prove runtime isolation. Browser composition and the deferred pre-merge
QA checklist remain separate gates.

For app UI, copy `sdk/ui/theme.css` and `sdk/ui/overlay.css` into the package and
declare both files in manifest `css`. The docked starter demonstrates the
supported classes, semantic tokens, keyboard-close behavior, focus entry and
restoration, responsive geometry, reduced motion, and forced colors. See
`sdk/UI.md`, `sdk/ACCESSIBILITY.md`, and `sdk/ASSETS_AND_LICENSING.md` for the
review baseline. These public CSS files are package-owned copies at runtime;
apps must not import private helpers from `src/platform/overlay`.

### Package Fixtures

The first-party package-shape pilots live under `examples/packages/first-party-replacements/`. They are fixtures for built-in replacement and registry compatibility:

- `examples/packages/first-party-replacements/tweetPng/` converts the first-party Tweet PNG metadata into a package root with `milxdy.app.json`, a placeholder prebuilt `dist/content.js`, and a declared icon asset. It proves the invoked/user-action `feature` shape: `lifecycle.mode: "invoked"`, `loadTriggers: ["userAction"]`, X site scope metadata, Apps & Features settings metadata, local-only privacy notes, and no dock or runtime delivery surfaces.
- `examples/packages/first-party-replacements/wikiSidebar/` converts the first-party Wiki Sidebar metadata into a docked `app` package root with `milxdy.app.json`, placeholder prebuilt content/frame files, CSS, and a declared icon asset. It proves the overlay app shape: runtime lifecycle, `dock` and chrome metadata, embedded Wiki site scope, permission/privacy disclosure, background message metadata, and web-accessible assets.

Run `pnpm.cmd run verify:local-app-packages` to validate those pilot packages. The verifier checks manifest version, ID/folder alignment, SDK compatibility, package kind rules, safe package-relative paths, declared file existence, lifecycle exports, site scopes, settings storage metadata, permissions/privacy disclosure, package assets, and absence of first-party-only runtime/build fields such as `entryName`, `entryPoint`, `requiredOutputs`, `isEnabled`, and `setEnabled`.

These pilots advance #54 by proving the package root shape against real first-party metadata. They also give #101 concrete input examples for the local package composer.

Novel package verification is separate so third-party developers do not accidentally validate the checked-in first-party fixtures:

```powershell
pnpm.cmd run verify:local-app-package -- --package=path\to\package --allow-local-review --acknowledge-package-consent
pnpm.cmd run verify:local-app-package -- --packages-dir=path\to\packages --allow-local-review --acknowledge-package-consent
```

That command runs the composer against only the selected package source, then inspects the generated build plan. It rejects missing trust acknowledgements, invalid enum values, unsafe or missing paths, bad lifecycle exports, missing storage declarations, unsupported background fields, invalid review/consent status, leaked first-party build-only fields, and novel packages that cannot be controlled through generated Apps & Features enablement metadata.

### Local Package Composer And Builder

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

The package-set conflict model rejects duplicate local package IDs, incompatible SDK versions, unsafe or missing declared files, invalid background message patterns, duplicate or overlapping background message types/services, background capabilities without review disclosure and consent, storage-key ownership conflicts, host permissions without privacy notes, site/route conflicts, web-accessible asset and asset-ID collisions, invalid package-kind capabilities, sensitive profile-pack participation, blocked review status, unacknowledged local review, unacknowledged privileged/consent surfaces, and app chrome/theme override conflicts without deterministic precedence. Local packages whose ID matches a built-in app intentionally shadow that built-in app only inside the generated custom build plan; this keeps the pilot fixtures usable while still rejecting duplicate IDs within the selected local package set.

Review metadata is preserved in reports, generated app metadata, and `local-app-composition.json`. `review.status: "blocked"` is rejected, `review.status: "reviewed"` is treated as accepted metadata for ordinary local packages, and missing or `local` review status is rejected unless the developer passes `--allow-local-review`. Built-in app ID replacement is stricter: package-authored review metadata is not a trust root, so replacements must match the repo-owned root and package SHA-256 policy in `scripts/packages/local-app-first-party-replacements.json` in addition to `--acknowledge-first-party-replacement`. The checked-in first-party pilot fixtures under `examples/packages/first-party-replacements/<id>` are the only current allowed replacements. Reports separate accepted packages, rejected packages, required acknowledgements, trust/consent decisions, scanner findings, warnings, and errors. Reports and build plans include SHA-256 hashes for package archives, package file sets, and copied files so future signature and review tooling has a stable attachment point. If a selected package set is rejected, the composer may write `composition-report.json` but does not emit a build plan.

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

To build the current local composition as an unpacked Chromium extension:

```powershell
pnpm.cmd run build:local-apps:chromium -- --allow-local-review --acknowledge-package-consent --acknowledge-first-party-replacement
```

That one action reruns the composer through `scripts/build/build-local-apps.mjs` and then calls `scripts/build/build-extension.mjs --target=chromium --local-app-plan=tmp/local-app-composition/build-plan.json`. The same `--packages-dir`, `--package`, `--out-dir`, and `--plan-out` flags can be passed after `--` on the pnpm command. The output is `dist/chromium-local-apps/`. Selected package payloads are copied to deterministic `local-apps/<package-id>/...` paths, generated metadata is emitted as `local-app-composition.json`, host permissions and web-accessible resources are merged explicitly, and normal release builds continue to ignore local package source unless a local composition plan is passed.

On a clean checkout using the checked-in examples fallback, the first-party replacement acknowledgement is required because the examples intentionally shadow built-in app IDs.

This builder supports folder packages and zip archives. Marketplace discovery, full cryptographic signature enforcement, remote trust policy, and polished GUI install/update UX remain follow-up work before local app loading can ship to normal users.

Background declarations are metadata-only for third-party local packages in this release. `background.messageTypes` may declare the message types a content bundle is allowed to send through `context.sendMessage`, and those message types must live under the package's own namespace such as `dev-note:*`. The composer does not copy, import, or register package-owned background handlers. `background.services` and extra fields such as `background.entry` are rejected until a reviewed package-owned background-loader design exists.

Shared-service expectations:

- Content bundles export SDK lifecycle hooks and use `context.scheduler`, `context.signal`, `context.sendMessage`, `context.recordDiagnostic`, and shared scanner delivery instead of app-owned duplicate observers, direct runtime messaging, or unbounded polling.
- Overlay packages use `overlayDock`, `overlayAppFrame`, and `overlayPanelBase` behavior instead of custom drag/resize/layout primitives.
- Background work declares `background.messageTypes`, `background.services`, `permissions.hosts`, privacy notes, and URL allowlists before the router enables it.
- Settings use the manifest settings schema and storage metadata so Apps & Features, profile packs, reset, and future import/export previews can reason about them without importing the app bundle.
- Packages that declare non-X sites must distinguish `contentScript`, `backgroundService`, `embeddedFrame`, and `overlayApp` integrations; a host permission alone does not mean the full content runtime should inject there.

Completed safeguards for the reviewed custom-build path:

- deterministic manifest, archive, path, asset, lifecycle, settings, background-message, permission, privacy, and URL metadata validation
- fail-closed trust and consent acknowledgements for local review, privileged package surfaces, sensitive API exceptions, and first-party replacements
- package-set conflict handling for duplicate IDs, incompatible SDK versions, blocked packages, malformed zips, storage ownership, routes, background namespaces, assets, hosts, and theme/chrome precedence
- package and build-plan hashes plus builder-side tamper checks before copied code reaches a generated build
- static payload review gates that block direct runtime messaging and require reviewed acknowledgement for permitted non-runtime sensitive API exceptions

Remaining blockers before normal-user package loading or marketplace installation can ship:

- a complete install/update/rollback/remove UI with permission and data-retention consent, package-owned storage cleanup, incompatibility recovery, and revocation behavior
- a runtime membrane or sandbox with explicit CSP and capability rules; the static scanner is not isolation
- a supported package-owned background capability model or a sufficient set of typed shared services
- external reference-app evidence covering lifecycle, messaging, settings migration, failure recovery, compatibility, and cleanup without private imports
- required CI coverage for SDK compliance, internal bridges, package integration, and trust gates
- canonical review, signing/provenance, checksum, update, and blocking policy for marketplace listings

## Future GitHub App Store Path

A GitHub-hosted app package should map cleanly onto the same `milxdy.app.json` shape:

- manifest version, SDK compatibility, ID, display metadata, version, declared surfaces, permissions, background services, CSS, and assets
- Hub metadata with user-facing descriptions, preset membership, rail defaults, data/permission notes, and privacy labels
- a prebuilt content entry bundle using the lifecycle hooks
- optional background handlers that declare message types and host allowlists
- no broad DOM observers or interval scans unless justified by the package review notes
- no host access beyond declared allowlists

Before remote packages are supported, the platform needs manifest signature/verification, install consent UI, update policy that reuses or adapts the existing GitHub release updater where appropriate, package sandboxing rules, and review tooling for permissions and performance diagnostics.
