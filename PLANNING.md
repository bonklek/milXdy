# milXdy Browser Integration Planning

## Purpose

This project consolidates several related browser extensions into one coherent MV3 extension with a single install pipeline and multiple feature-specific settings surfaces.

Initial inputs:

- Local: `remilia-wiki-hyperlink`
- Local: `tweet-reader` / `postreader`
- Remote: `erc1337-Coffee/remistats_extension`
- Remote: `remiliacorp/miladymaxxer`
- Local: `beXtol-hunter`

The current target is a GitHub-distributed beta for testers, not Chrome Web Store submission. Store-review constraints are therefore secondary, but user trust, install clarity, permissions hygiene, and predictable update behavior still matter.

## Product Direction

The combined extension should feel like one installed package with modular feature ownership:

- One manifest.
- One build and packaging pipeline.
- One top-level popup/options shell.
- Separate settings views for each feature.
- Shared infrastructure for X/Twitter page scanning, storage, feature toggles, logging, and asset resolution.

Do not merge the extensions by simply concatenating content scripts. The internal architecture should preserve feature boundaries while reducing duplicated browser work.

## Performance Is A Primary Goal

Avoiding browser slowdown is one of the main reasons to consolidate. All included extensions currently target X/Twitter and may scan timelines, watch DOM mutations, inject UI, attach event listeners, or process avatars. If each feature keeps an independent scanner, the combined extension could be slower than installing the extensions separately.

The integration should treat performance as a design constraint:

- Prefer one shared X/Twitter DOM scanner/orchestrator.
- Normalize discovered entities such as posts, profiles, user cells, handles, avatars, like buttons, and thread contexts.
- Let features subscribe to normalized page events instead of each feature running its own full-page `MutationObserver`.
- Deduplicate expensive operations like handle extraction, avatar URL lookup, post text extraction, and timeline traversal.
- Batch DOM reads and writes where possible.
- Avoid repeated work during X/Twitter SPA route changes.
- Track processed nodes with stable feature-specific markers or shared metadata.
- Keep OCR, ONNX inference, API fetches, and other heavy work gated by feature settings and visibility.

The future agent should add lightweight performance instrumentation early, even if it is only development-only counters/timers at first.

## Likely Slowdown Sources By Package

### Shared X/Twitter DOM Scanning

This is the largest cross-package slowdown risk. The local Remilia Wiki and Postreader extensions both use a page-wide `MutationObserver`, debounce updates, and periodically rescan all visible or mounted tweets. Miladymaxxer also rescans tweets, notifications, user cells, direct messages, and profiles. RemiStats scans tweets, user cells, profile headers, and group chat avatars.

If integrated naively, the combined extension could run four independent observers and three or four recurring full-document `querySelectorAll` passes. The beta should instead use one shared scanner that owns mutation observation, route-change detection, and periodic health rescans.

Recommended shared scanner behavior:

- Observe `document.body` once.
- Collect added nodes into a pending set.
- Resolve affected surfaces from the added nodes: tweet, user cell, notification, direct message, profile header, group chat avatar.
- Process only pending surfaces first.
- Run a slower safety rescan for visible/mounted surfaces, not every feature's own rescan.
- Expose normalized records to feature modules:
  - `PostRecord`
  - `UserCellRecord`
  - `ProfileRecord`
  - `NotificationRecord`
  - `DirectMessageRecord`
- Include shared extracted fields where possible: handle, display name, tweet text containers, avatar URL, status URL, quote tweet container, action row.

### Remilia Wiki Hyperlink

Primary costs:

- Walking tweet text nodes.
- Running wiki matching against text.
- Replacing text nodes with link fragments.
- Preview fetches on hover.

Current local code is already reasonably defensive: it tracks processed text containers by signature, caps links per post, debounces mutation handling, and caches previews. The integration should preserve those constraints.

Risks after integration:

- Re-linking text that another feature has modified.
- Running matcher on every global rescan even when tweet text is unchanged.
- Preview network/cache work competing with RemiStats fetches.

Guidance:

- Run wiki matching only when a post text signature changes.
- Never scan inside other feature roots or generated controls.
- Keep strict link caps.
- Keep preview fetch lazy-on-hover with a hover delay.
- Store preview cache under the shared namespaced storage helper.

### Postreader

Primary costs:

- Full tweet extraction during scans.
- Tesseract OCR worker initialization.
- OCR image fetch and recognition.
- Speech boundary updates and word/smooth highlighting.
- Tokenizing tweet body DOM for highlights.

Important UX point: Postreader should do almost no heavy work until the user asks it to read a post. The timeline should only get lightweight read buttons.

Guidance:

- During scanning, only determine whether a read button should be attached.
- Do not initialize Tesseract during page load.
- Do not fetch image blobs or run OCR until the user explicitly starts reading a post with OCR enabled.
- Cache OCR results by normalized image URL.
- Allow OCR cancellation and make skip controls visible in the mini-player.
- Keep body highlighting limited to the active post.
- Avoid repeatedly restoring and retokenizing tweet HTML during normal timeline scrolling.

### RemiStats

Primary costs:

- Extracting handles from many tweet/user/profile/chat nodes.
- Network fetches to the RemiStats API.
- Badge and tooltip creation.
- One scroll listener per tooltip if kept as-is.
- Cleanup observers per badge if kept as-is.

The existing remote code already batches API calls and negative-caches missing users. Those are important and should be preserved. The weaker part is per-badge behavior: each badge creates its own tooltip, scroll listener, and cleanup observer. That is acceptable at small scale but can become expensive on long sessions.

Guidance:

- Use one tooltip manager for all RemiStats badges.
- Avoid per-badge global scroll listeners.
- Avoid per-badge cleanup `MutationObserver`; rely on event delegation and normal node garbage collection where possible.
- Preserve batched fetches.
- Preserve negative caching for unknown handles to avoid retry loops.
- Add a max in-flight request policy and a per-session cache.
- Consider only resolving RemiStats for visible or near-visible surfaces during the beta.

### Miladymaxxer

Primary costs:

- Avatar normalization and image loading.
- ONNX Runtime worker and model initialization.
- Avatar inference across tweets, quote tweets, user cells, notifications, direct messages, and profile pages.
- Rich DOM effects for cards, tiers, sounds, badges, and animations.
- Storage writes for stats, matched accounts, collected avatars, player XP, and catches.

This is the highest-risk feature for performance. It should be integrated last and should be treated as the stress test for the shared scanner, worker asset loading, caching, and storage batching.

Guidance:

- Keep ONNX/model initialization lazy until Miladymaxxer is enabled and a candidate avatar needs inference.
- Cache detection results by normalized avatar URL.
- Run inference through a queue with bounded concurrency. Start with concurrency `1`.
- Prioritize visible tweets and profile surfaces over offscreen content.
- Skip inference for allow-listed/manual-list handles where possible.
- Batch storage writes and avoid writing stats after every single tweet if many tweets are processed in one pass.
- Keep animations CSS-driven and avoid JavaScript animation loops except where strictly needed.
- Make sounds opt-in or cheap to initialize; avoid repeatedly attaching sound handlers to the same nodes.

### beXtol Hunter

Primary costs:

- A persistent hover panel mounted into X/Twitter.
- Two intervals: one timer render every second and one state refresh every 60 seconds.
- Background requests to `www.remilia.net` for OIDC token refresh, user state, and reward actions.

This feature is less DOM-scan-heavy than the other packages, but it still adds always-on timers to X/Twitter pages. It should remain cheap if it only updates its own root node and does not query the page repeatedly.

Guidance:

- Keep the panel self-contained under one root node.
- Keep all styling scoped to `bextol-*`.
- Do not add page-wide scans for this feature.
- Consider pausing the one-second render interval when the panel is not visible or when the document is hidden.
- Keep auth and action requests in the background worker.
- Make it clear in beta docs that 2FA is not supported by the current password-grant flow.

## Performance Architecture Proposal

Use a shared content runtime with feature plugins.

Suggested shape:

```ts
type FeatureModule = {
  id: string;
  boot?(context: ContentRuntimeContext): Promise<void> | void;
  onPost?(post: PostRecord): Promise<void> | void;
  onUserCell?(cell: UserCellRecord): Promise<void> | void;
  onProfile?(profile: ProfileRecord): Promise<void> | void;
  onDirectMessage?(message: DirectMessageRecord): Promise<void> | void;
  onRouteChange?(route: RouteRecord): Promise<void> | void;
  teardown?(): Promise<void> | void;
};
```

The shared runtime should own:

- Mutation observation.
- SPA route detection.
- Periodic safety rescans.
- Visibility checks.
- Shared selector constants.
- Shared handle/avatar/text extraction.
- Feature enablement checks.
- Development performance counters.

Feature modules should own:

- Their feature-specific DOM injection.
- Their feature-specific settings.
- Their feature-specific cache and worker logic.
- Their feature-specific CSS namespace.

## Integration Efficiencies Already Applied

The consolidated beta now uses lazy content feature bootstrapping:

- Disabled features are not imported on page load.
- Feature CSS for RemiStats and beXtol is injected only when those features load.
- A feature that starts disabled can be imported later when toggled on.
- Features that already have internal disable behavior still handle off-state changes after loading.

Current lazy gates:

- Remilia Wiki: `remiliaWikiHyperlink.settings.enabled`
- Postreader: sync `enabled`
- RemiStats: sync `milxdy.remistats.enabled`
- Miladymaxxer: sync `mode !== "off"`
- beXtol Hunter: local `milxdy.bextol.enabled`

beXtol Hunter also skips its one-second render tick and 60-second refresh while disabled or while the document is hidden.

Remaining larger opportunity: replace the separate content-script observers and full-page scan loops in Wiki, Postreader, RemiStats, and Miladymaxxer with one shared scanner. Lazy boot avoids disabled-feature cost, but enabled features still run their own observers today.

Additional efficiency pass completed:

- Added a shared X/Twitter scanner service with one `MutationObserver`, one safety rescan interval, and normalized surface emissions.
- Migrated Remilia Wiki Hyperlink to shared tweet events.
- Migrated Postreader button insertion to shared tweet events.
- Replaced RemiStats per-badge tooltip elements, scroll listeners, and cleanup observers with one delegated tooltip manager.
- Added bounded Miladymaxxer avatar detection concurrency. Detection currently runs with one active image/model task at a time, while preserving the existing URL cache.
- Added diagnostics storage for shared scanner counters and Miladymaxxer detection queue stats when diagnostics are enabled.
- Added a formal `ContentFeatureModule` lifecycle contract in `src/shared/featureLifecycle.ts` for future feature rewrites.

Remaining scanner work:

- RemiStats now subscribes to shared `tweet`, `userCell`, and profile surfaces. Its group chat avatar path remains a focused route-gated side path.
- Miladymaxxer now routes `processTweet`, `processUserCell`, `processNotificationGroup`, `processDirectMessage`, and `processProfilePage` behind shared scanner events. It still keeps small route/effect refresh timers for logo, profile, and level badge state.
- True content bundle splitting is now implemented with a small classic `content.js` bootstrap that dynamically imports self-contained ESM feature bundles from extension URLs. Feature bundles are declared in `web_accessible_resources`, and the build script fails if the bootstrap absorbs obvious large feature implementation strings.

Settings storage migration is deferred. The preferred UX direction is a single popup menu with tabs organized by sub-extension, preserving each feature's settings surface while avoiding a giant cross-feature settings form.

Manual split-loader checks still needed:

- Load unpacked `dist`.
- Disable all features.
- Open X/Twitter and confirm only `content.js` loads initially.
- Enable each feature one at a time from the popup.
- Confirm the corresponding `features/*.js` bundle loads and the feature works.
- Confirm dynamic extension-URL imports keep access to `chrome.storage` and `chrome.runtime` in the target Chromium versions.

## Suggested Performance Budgets For Beta

These are not hard production guarantees, but they give the integration agent concrete targets:

- Initial content script boot should avoid heavy worker/model/OCR initialization.
- Normal scroll/mutation processing should stay under roughly 8-12 ms per frame-sized batch on a mid-range machine.
- Long work should be chunked with `requestIdleCallback`, `setTimeout`, or an internal queue rather than blocking the main thread.
- Avatar inference should be queued, cached, and bounded to one active inference at a time until measured otherwise.
- OCR should never run without direct user action.
- Storage writes should be batched/debounced.
- Network requests should be batched or cached, with negative caching where applicable.
- Route changes should not duplicate UI or reattach listeners.

## UX Practices To Keep The Extension Feeling Fast

- Default to visible, incremental enhancement: show controls quickly, fill expensive badges/results later.
- Do not block post rendering while scores, OCR, or model classifications load.
- Use stable layout reservations for injected controls/badges where possible to avoid shifting X/Twitter content.
- Prefer one shared tooltip/popover layer over many independent floating elements.
- Give long-running work explicit status only when the user initiated it, such as OCR.
- Provide per-feature toggles so testers can isolate performance issues.
- Add a lightweight diagnostics panel showing enabled features, processed counts, cache hits, inference count, OCR count, and recent errors.

## Major Integration Risks

### Content Script Interference

All four extensions mutate or inspect the same X/Twitter DOM. Risks include:

- Duplicate mutation observers.
- One feature changing nodes another feature expects.
- Reprocessing the same timeline item after SPA navigation.
- Event listeners being attached multiple times.
- Feature UI elements becoming inputs to another feature's scanner.

Mitigation:

- Use a shared page coordinator for X/Twitter.
- Give each feature explicit lifecycle hooks: initialize, onPost, onProfile, onUserCell, onRouteChange, teardown.
- Make every DOM marker and injected class name feature-prefixed.
- Keep feature DOM additions recognizable to the shared scanner so they are ignored by default.

### CSS Collisions

RemiStats ships a global stylesheet, Miladymaxxer applies rich card styling, and the local TypeScript projects inject UI styles. Broad selectors or generic class names can break other features.

Mitigation:

- Prefix classes with a shared namespace such as `milxdy-`.
- Add feature namespaces such as `milxdy-wiki-*`, `milxdy-postreader-*`, `milxdy-remistats-*`, and `milxdy-maxxer-*`.
- Avoid global element selectors and broad X/Twitter selectors in injected CSS unless tightly scoped.
- Keep feature UI DOM under identifiable root nodes where practical.

### Storage Collisions And Migration

Each extension currently owns its own storage model. A merged extension can collide on generic keys like `settings`, `stats`, `enabled`, or feature-specific state. Existing beta users may also have data in legacy extension storage that does not automatically move to the new extension ID.

Mitigation:

- Namespace all new storage keys.
- Suggested shape:
  - `milxdy.features.wiki`
  - `milxdy.features.postreader`
  - `milxdy.features.remistats`
  - `milxdy.features.miladymaxxer`
  - `milxdy.shared`
- Define one shared storage helper with typed defaults and migrations.
- Decide explicitly whether legacy storage import is in scope for beta.

### Asset Path Breakage

Postreader and Miladymaxxer depend on non-trivial runtime assets.

Postreader currently needs Tesseract assets such as:

- `ocr/worker.min.js`
- `ocr/core/*`
- `ocr/lang/*`

Miladymaxxer currently needs ONNX/model assets such as:

- `worker.js`
- `ort/*`
- `generated/*`
- `models/*`
- `milady-logo.png`

Risks:

- `chrome.runtime.getURL(...)` references break after files move.
- Web accessible resource declarations miss required files.
- WASM loading fails because CSP or paths are wrong.
- Workers load but cannot find model/core files.

Mitigation:

- Keep asset paths stable where possible.
- Centralize feature asset URL helpers.
- Verify OCR and ONNX paths in an unpacked-extension runtime, not just unit tests.
- Preserve required `web_accessible_resources`.
- Preserve `content_security_policy` requirements for WASM.

### Build Pipeline Mismatch

The source projects use different approaches:

- Remilia Wiki Hyperlink: TypeScript + custom esbuild script.
- Postreader: TypeScript + custom esbuild script + Tesseract asset copying.
- RemiStats: no build step; root JS/CSS/HTML loaded directly.
- Miladymaxxer: Vite/Solid popup plus esbuild content/background/worker builds and static ONNX assets.

Risks:

- The unified build omits static assets.
- The popup framework choice accidentally forces unrelated feature code into content scripts.
- Source maps or watch mode only work for some entries.
- Background service worker bundling changes runtime behavior.

Mitigation:

- Design the build around explicit entries: content coordinator, background worker, popup/options app, feature workers.
- Keep static asset copy rules declarative and feature-owned.
- Treat RemiStats as a conversion task from root JS/CSS into a feature module.
- Integrate Miladymaxxer last because it stresses the full pipeline.

### Manifest And Permissions

The combined manifest will need a union of permissions and hosts. Current likely needs include:

- `storage`
- `contextMenus`
- `notifications`
- `unlimitedStorage`
- X/Twitter host permissions
- `pbs.twimg.com`
- `wiki.remilia.org`
- RemiStats API access if fetches happen outside pages covered by host permissions

Because this is GitHub beta distribution, Chrome Web Store review is not the immediate blocker. Still, permissions should stay explainable in the README and install instructions.

Mitigation:

- Keep permissions to the true runtime minimum.
- Remove `activeTab` unless a converted feature demonstrably needs it.
- Document why each permission exists.
- Make feature toggles obvious so testers can disable modules independently.

### Popup And Settings Complexity

Each source extension currently owns its popup/options assumptions. A combined UI can become tangled quickly.

Mitigation:

- Build one settings shell with feature-specific pages or tabs.
- Each feature should own its own settings schema and UI component.
- Shared shell should provide enable/disable, status, diagnostics, and navigation.
- Avoid a single giant settings form.

## Suggested Integration Order

1. Create the shared MV3 extension shell, manifest, build script, popup/options frame, storage helper, and feature toggle registry.
2. Integrate Remilia Wiki Hyperlink first because it is local, TypeScript-based, and already has popup/options/background/content boundaries.
3. Integrate Postreader next to prove OCR asset copying, WASM CSP, and heavier static asset handling.
4. Integrate RemiStats after converting root JavaScript/CSS into namespaced feature modules.
5. Integrate Miladymaxxer last because it has the highest runtime complexity: ONNX inference, worker assets, rich DOM effects, notifications, XP state, and Solid popup code.

## Early Technical Decisions To Make

- Build system: whether to use a custom esbuild pipeline, Vite for UI plus esbuild for extension entries, or a single Vite-driven extension build.
- UI framework: whether the combined popup/options shell uses plain TypeScript DOM rendering, Solid, or another existing local approach.
- Shared scanner API: what normalized objects are emitted to feature modules.
- Storage schema: exact namespaced keys and migration policy.
- Asset layout: final `dist/` paths for OCR, ONNX, generated data, icons, and feature assets.
- Feature toggle model: whether disabled features load no code, run no hooks, or only suppress visible UI.

## Validation Checklist For The Integration Agent

- Build produces one loadable unpacked MV3 extension.
- Popup opens and exposes separate settings/status for each feature.
- Each feature can be independently enabled and disabled.
- X/Twitter timeline scanning does not create duplicate UI after route changes or infinite scroll.
- OCR assets load correctly when Postreader is enabled.
- ONNX/model assets load correctly when Miladymaxxer is enabled.
- RemiStats fetches are batched or cached and do not spam the API.
- Injected CSS does not leak across features.
- Storage keys are namespaced and typed.
- Browser performance is measured before and after enabling each feature.
- README explains GitHub beta installation, permissions, and known limitations.
