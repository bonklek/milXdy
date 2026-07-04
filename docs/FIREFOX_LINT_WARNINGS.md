# Firefox Lint Warning Classification

Last checked against `dist/firefox` after `npm.cmd run build:firefox`.

Current expected status:

```text
errors:   0
warnings: 31
notices:  0
```

## Mozilla Data-Collection Warning

`MISSING_DATA_COLLECTION_PERMISSIONS` is no longer expected. Firefox builds
declare `browser_specific_settings.gecko.data_collection_permissions` for the
documented browser-session, remote-service, and site-content flows. The
`lint:firefox` verifier fails if Mozilla's missing-data-collection warning
reappears.

The generated Firefox manifest declares required data collection for
authentication/session information, personal communications, personally
identifying information, website activity, and website content. This is
intentionally conservative for the current package because features can fetch or
transmit RemiliaNET session state, RemiNet Chat messages and attachments,
public/profile identity data, selected X/Twitter context, and requested media or
metadata to documented remote services.

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
- `popup.js`: 3.
- `features/beetol.js`: 2.
- `features/reminetChat.js`: 5.
- `features/remistats.js`: 4.
- `features/post-reading.js`: 4.
- `features/miladymaxxer.js`: 2.
- `features/wiki.js`: 1.
- `features/music.js`: 1.

These are existing UI-rendering patterns in bundled first-party code. Fix them when touching the owning UI, but do not block Firefox smoke on them while lint has zero errors.
