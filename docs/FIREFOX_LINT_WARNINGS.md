# Firefox Lint Warning Classification

Last checked against `dist/firefox` after `npm.cmd run build:firefox`.

Current expected status:

```text
errors:   0
warnings: 33
notices:  0
```

## Firefox Metadata Warning

- `MISSING_DATA_COLLECTION_PERMISSIONS` in `manifest.json`.

Mozilla now reports this as a warning. It supports `browser_specific_settings.gecko.data_collection_permissions`, but milXdy has optional browser-session and remote-service flows. Do not declare `required: ["none"]`. Pick the final Firefox data-collection categories only after the owner confirms the privacy language for RemiliaNET, RemiStats, Beetol, Miladychan, MusicBrainz, AcoustID, Ethereum RPC, local files, and diagnostics.

## Warnings

Bundled or generated dependency warnings:

- `DANGEROUS_EVAL` in `ocrHost.js`.
- `DANGEROUS_EVAL` in `ocr/worker.min.js` twice.
- `DANGEROUS_EVAL` in `ort/ort-wasm-simd-threaded.jsep.mjs`.
- `DANGEROUS_EVAL` in `worker.js`.

Expected platform/runtime warnings:

- `UNSAFE_VAR_ASSIGNMENT` for dynamic `import()` in `content.js`. The runtime imports extension-owned URLs produced from the app registry.
- `UNSAFE_VAR_ASSIGNMENT` for dynamic `import()` in `worker.js`. The Maxxer worker uses the packaged ONNX bootstrap path.

First-party `innerHTML` warnings to reduce over time:

- `wikiFrame.js`: 2.
- `popup.js`: 2.
- `features/beetol.js`: 2.
- `features/reminetChat.js`: 5.
- `features/remistats.js`: 4.
- `features/post-reading.js`: 6.
- `features/miladymaxxer.js`: 2.
- `features/wiki.js`: 1.
- `features/music.js`: 1.

These are existing UI-rendering patterns in bundled first-party code. Fix them when touching the owning UI, but do not block Firefox smoke on them while lint has zero errors.
