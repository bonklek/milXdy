# Post-reading App SDK Reference

Post-reading is the production external reference app for App SDK 0.2.5. Its
feature source, settings, standalone adapter, package manifest, compatibility
declaration, and acceptance matrix live in `bonklek/post-reading`. milXdy owns
the public SDK runtime, shared services, trust policy, pinned source commit and
package hash, and mirrors used to detect contract drift.

The current pair is Post-reading `0.2.0-sdk.7` at commit
`add0c55b5dfd07c664480cd9d56ca625658abdc7` with App SDK `0.2.5` and package
SHA-256 `b4fcb5563e954523ba0926dba1dbd39f0c6c1c6752edb9668ba9ccc9ccc2cffc`.

Run the complete cross-repository proof from this repository with:

```powershell
npm.cmd run verify:post-reading-sdk-reference
```

Set `POST_READING_REPO` when the checkout is not the sibling
`../post-reading-sdk`. The gate builds and verifies the external package, checks
its Git origin, exact commit, authoritative App SDK type compatibility,
compatibility mirror, and `milxdy.acceptance.json` mirror, stages it at the
policy-owned package root, composes it as the reviewed replacement for built-in
Post-reading, and emits a complete Chromium custom build. The staging directory
is removed after verification.

## Ownership and intentional differences

`bonklek/post-reading` owns the standalone browser bootstrap, popup, package
metadata, feature source used by the external SDK entrypoint, and standalone
storage/asset adapters. milXdy owns public SDK declarations and runtime,
surface delivery, lifecycle hosting, declared background routes, packaged OCR
resources, composition policy, immutable pins, and the browser-only fallback.

The repositories do not copy their complete reader trees. The standalone build
keeps its own browser integration, while the SDK package receives surfaces,
scheduling, cancellation, declared storage, guarded assets, messaging, and
diagnostics from milXdy. New built-in reader work reaches the external package
only through an explicit Post-reading package update and a new reviewed commit,
version pair, mirrored contracts, and pin.

## Capability matrix

| Capability | Status | Integration |
| --- | --- | --- |
| Lifecycle and surface delivery | Supported | Public `boot`, `onSurface`, `disable`, `dispose`, `open`, and `close` hooks. |
| Scheduler and cancellation | Supported | Uses the public scheduler, abort signal, and disposable registration. |
| Bounded surface rescan | Supported | Uses `context.requestSurfaceRescan()`; private scanner access is not exposed. |
| Background requests | Supported through host routes | Uses `context.sendMessage()` and the declared `post-reading:*` namespace. |
| Explicit page actions | Supported | A reviewed manifest entry receives only its declared sync keys after an HTTP/HTTPS active-tab context-menu invocation. |
| Diagnostics | Supported | Uses the public diagnostics callback. |
| Settings compatibility | Supported | The replacement retains declared built-in keys and defaults. |
| Storage facade | Supported | Uses declared-key `context.storage` areas; undeclared access fails before browser storage. |
| Asset URL facade | Supported | `context.resolveAssetUrl()` authorizes package paths and policy-granted host assets. |
| OCR and background handlers | Host service | Uses milXdy's declared OCR assets and typed Post-reading handlers. |
| Reader UI | App-owned surface | Uses its compact draggable floating player through the public lifecycle and host asset facade. |
| Distribution | Reviewed custom build | The verified package is incorporated into the generated extension. |
| Host runtime | X surfaces | Receives X route and surface delivery from the shared runtime. |

## Synchronization policy

Changes begin in `bonklek/post-reading`, where the standalone extension and SDK
package are built from the same feature source. When the target SDK changes,
run `pnpm sync:milxdy-sdk -- --milxdy-repo=<path> --package-version=<next>` in
that repository. Then run its typecheck, standalone build, package build, SDK
sync check, and package verifier. Mirror `milxdy.compatibility.json` and
`milxdy.acceptance.json` here, update the exact commit and package hash, and run
`verify:post-reading-sdk-reference` from milXdy. The gate typechecks against the
selected milXdy checkout rather than trusting the standalone fallback type file.

A source URL or commit mismatch, compatibility/acceptance drift, content hash
change, direct runtime messaging, undeclared privilege, missing lifecycle hook,
or composer/build failure blocks the integration. No undocumented file copying
is part of the process.

## Acceptance matrix

The machine-readable matrix is mirrored at
`sdk/references/post-reading.acceptance.json`. It covers one exact Chromium
candidate across install/connect, update and version mismatch, enable/disable,
post and X Article launch/navigation, settings persistence/reset/migration,
message boundaries, browser and custom TTS, offline/error/timeout/cancellation,
privacy/consent, theme/layout/accessibility, long-form audio export, and
uninstall/cleanup.

Automated verification proves the exact source, contracts, package contents,
trust policy, lifecycle exports, public SDK type compatibility, negative tamper
controls, composition, and complete Chromium output. Chromium QA must still
exercise each scenario's `manual` instruction against the matching build ID.

## Setup, privacy, and recovery

The supported connection path is a reviewed custom build. It does not inject a
package into an already-installed extension. Select the reviewed package,
compose/build, and reload the same unpacked extension. A version, commit, hash,
or contract mismatch fails before composition.

Browser Web Speech remains the default and works without the external package.
Reader settings stay in declared sync storage and voice-boundary results stay in
declared local storage. Public quote text reaches only the documented X sources
when full-quote enrichment is enabled. Text reaches a custom TTS endpoint only
after the user configures it and starts playback. Optional OCR processes the
selected image with packaged resources. No companion service, voice/model
download, OCR request, or page-text transmission starts silently.

If quote enrichment, OCR, or custom TTS is offline, unavailable, cancelled, or
times out, cancel the active operation and return to browser TTS. If the package
is missing, stopped, incompatible, disabled, or removed, rebuild without the
selection and reload the same extension. **Browser-only fallback** Post-reading
must remain available with compatible saved settings.

## App SDK gaps

No private milXdy source import is allowed and the package must compose with zero
sensitive package API findings. Two explicit host-service dependencies remain:
OCR files resolve through `context.resolveAssetUrl()`, and quote/background work
uses the declared `post-reading:*` routes through `context.sendMessage()`.
Runtime installation into an already-installed extension is outside the
supported distribution model; reviewed composition and reload are the public
path, not a hidden workaround.

## Verification availability

A version pin is a contract, not proof that the source is currently available.
The pinned source must exist on the configured GitHub origin and the complete
cross-repository gate must pass before treating this integration as release
accepted. If fetching the pin reports `not our ref`, preserve the gate failure
and the built-in browser-only fallback. Publishing the missing SDK source and
running the gate against that exact version is required; a standalone-only
repository HEAD is not a compatible substitute.
