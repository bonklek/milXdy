# Post-reading Distribution Wrapper

Post-reading is a normal first-party milXdy app. Its canonical source lives in:

- `src/apps/post-reading`
- `assets/apps/post-reading`

The optional Chromium-only Post-reading package is a distribution wrapper around that app source, not a separate app implementation. The wrapper supports a focused unpacked extension while the main repo keeps one owner for content behavior, settings, OCR policy, popup controls, and assets.

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

The current extraction intentionally keeps source shared inside this repo, avoiding a separate implementation for the focused distribution.

## External SDK package and compatibility

The focused distribution above is distinct from the separately versioned
`bonklek/post-reading` SDK replacement. See
[`POST_READING_SDK_REFERENCE.md`](../sdk/POST_READING_SDK_REFERENCE.md) for that
package's public SDK contracts, pinned version pair, composition, lifecycle
matrix, and synchronization policy. Built-in reader changes do not silently
update that external replacement. A supported external update requires a new
reviewed source commit and package hash and the cross-repository verifier.

The SDK reference gate must be reproducible from the published source URL. If
its pinned commit cannot be fetched, do not substitute the repository's current
HEAD or weaken the pin: retain the built-in browser reader and report the
external integration as unavailable until the exact source is published.

## Direct messages

On an open X conversation, select **Read visible messages aloud**, review the
snapshot, then select **Read with browser voice**. Browser speech is mandatory
for private conversations even when custom HTTP TTS is selected for public
posts. Browser voices may use local or remote browser-managed services. Review this
disclosure before starting. No message text is saved or sent to the configured
HTTP TTS export service.
Pause, resume, stop, speed, voice, and available text highlighting use the
existing player. Navigating away stops the reading. Only currently rendered
message bodies are included; opening review again captures messages loaded
later. Inbox previews, timestamps, reactions, and composer text are excluded.
Repeated virtualized entries are deduplicated by message identity. Distinct
messages with identical text remain distinct. Explicit incoming/outgoing
metadata provides speaker labels; otherwise separate `Message` labels preserve
boundaries without guessing a sender.

The conversation selector contract is conservative: `DmActivityViewport`,
`messageEntry`, and `messageText`. If X does not expose these containers, no
conversation control is shown. Live Chromium and Firefox checks are still
required to confirm current X rendering and direction metadata; fixture checks
alone do not prove that all conversation layouts are supported.
