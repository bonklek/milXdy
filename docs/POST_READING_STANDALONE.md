# Post-reading Distribution Wrapper

Post-reading is a normal first-party milXdy app. Its canonical source lives in:

- `src/apps/post-reading`
- `assets/apps/post-reading`

The optional Chromium-only Post-reading package is a distribution wrapper around that app source, not a separate app implementation. The wrapper exists so Post-reading can still be QA'd as a focused unpacked extension while the main repo keeps one owner for content behavior, settings, OCR policy, popup controls, and assets.

Build the wrapper with:

```powershell
npm run build:post-reading
```

Then load `dist/post-reading-chromium` from `chrome://extensions`.

## Source Ownership

The distribution build reuses the integrated app implementation:

- content behavior: `src/apps/post-reading/content.ts`
- background fetch bridge: `src/apps/post-reading/background.ts`
- popup controls: `src/apps/post-reading/popup.ts`
- app assets: `assets/apps/post-reading`
- OCR host frame script: `src/extension/frames/ocr-host.ts`
- OCR host HTML: `assets/extension/frames/ocr.html`

Distribution-only glue lives under:

- `src/distributions/post-reading`
- `assets/distributions/post-reading`
- `scripts/build/build-post-reading-distribution.mjs`
- `scripts/verify/post-reading-distribution.mjs`

Distribution files may import from `src/apps/post-reading`. App source must not import from `src/distributions/post-reading`.

## Verification

Prefer the distribution-named verifier:

```powershell
npm run verify:post-reading:distribution
```

`verify:post-reading:standalone` remains as a compatibility alias for older release notes, habits, and CI references while the tree settles.

The wrapper verifier checks the Post-reading distribution contract, including shared app source ownership, OCR host wiring, release-gate coverage, and the build script paths.

## Scope

The distribution wrapper is scoped to X/Twitter Post-reading. Wiki sidebar read-aloud remains part of integrated milXdy because it depends on the shared Wiki sidebar app, validated wiki routing, and dock-attached sidebar reader slot.

Voice timing behavior stays shared: browser voices with stable speech boundaries get synced highlighting, unsupported voices use the estimated highlight fallback, and custom HTTP TTS endpoints can provide explicit timing boundaries for synced playback and seeking.

If Post-reading is ever split into its own repository, move or package these paths together:

- `src/apps/post-reading`
- `src/distributions/post-reading`
- `src/platform/app-sdk/app-platform.ts`
- `src/platform/background/router.ts`
- `src/platform/runtime/disposables.ts`
- `src/platform/background/extension-runtime.ts`
- `src/platform/overlay/app-frame.ts`
- `src/platform/overlay/dock.ts`
- `src/platform/diagnostics/performance-diagnostics.ts`
- `src/platform/settings/performance-mode.ts`
- `src/platform/scanner/twitter-scanner.ts`
- `assets/apps/post-reading`
- `assets/distributions/post-reading`
- `assets/extension/frames/ocr.html`
- `scripts/build/build-post-reading-distribution.mjs`
- `scripts/verify/post-reading-distribution.mjs`

The current extraction intentionally keeps source shared inside this repo first, so focused distribution QA can happen before any repository split.
