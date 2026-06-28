# Post-reading Standalone

Post-reading can be built as an unpacked Chromium extension without the rest of milXdy:

```powershell
npm run build:post-reading
```

Load `dist/post-reading-chromium` from `chrome://extensions`.

The standalone build reuses the same implementation as the integrated app:

- content behavior: `src/features/post-reading/content.ts`
- background fetch bridge: `src/features/post-reading/background.ts`
- popup controls: `src/features/post-reading/popup.ts`
- OCR host: `src/features/post-reading/ocrHost.ts`

Standalone-only glue lives under `src/standalone/post-reading`. The build script writes a small manifest, copies the Post-reading assets, copies the Tesseract OCR runtime files, and bundles only the Post-reading entries.

The standalone build is scoped to X/Twitter Post-reading. Wiki sidebar read-aloud remains part of integrated milXdy because it depends on the shared Wiki sidebar app, validated wiki routing, and dock-attached sidebar reader slot.

Voice timing behavior stays shared: browser voices with stable speech boundaries get synced highlighting, unsupported voices use the estimated highlight fallback, and custom HTTP TTS endpoints can provide explicit timing boundaries for synced playback and seeking.

Before publishing this as its own GitHub repository, move or package these paths together:

- `src/features/post-reading`
- `src/shared/appPlatform.ts`
- `src/shared/backgroundRouter.ts`
- `src/shared/disposables.ts`
- `src/shared/extensionRuntime.ts`
- `src/shared/overlayAppFrame.ts`
- `src/shared/overlayDock.ts`
- `src/shared/performanceDiagnostics.ts`
- `src/shared/performanceMode.ts`
- `src/shared/twitterScanner.ts`
- `src/standalone/post-reading`
- `public/post-reading`
- `public/post-reading-standalone`
- `public/ocr.html`
- `scripts/build-post-reading.mjs`

The current extraction intentionally keeps source shared inside this repo first, so standalone QA can happen before repository splitting.
