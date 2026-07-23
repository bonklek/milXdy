# Post-reading App SDK Reference

Post-reading is the production external reference app for App SDK 0.2.3.
Its feature source, settings, standalone adapter, package manifest, and
compatibility declaration live in `bonklek/post-reading`. milXdy owns the public
SDK runtime, shared services, trust policy, pinned source commit and package hash, and the mirror
of the compatibility declaration used to detect drift.

Run the complete cross-repository proof from this repository with:

```powershell
pnpm.cmd run verify:post-reading-sdk-reference
```

Set `POST_READING_REPO` when the checkout is not the sibling
`../post-reading-sdk`. The gate builds and verifies the external package, checks
its Git origin, exact commit, and compatibility mirror, stages it at the policy-owned package
root, composes it as the reviewed replacement for built-in Post-reading, and
emits a complete Chromium custom build. The staging directory is removed after
verification.

## Capability Matrix

| Capability | Status | Integration |
| --- | --- | --- |
| Lifecycle and surface delivery | Supported | Public `boot`, `onSurface`, `disable`, `dispose`, `open`, and `close` hooks. |
| Scheduler and cancellation | Supported | Uses the public scheduler, abort signal, and disposable registration. |
| Bounded surface rescan | Supported | Uses `context.requestSurfaceRescan()`; private scanner access is not exposed. |
| Background requests | Supported through host routes | Uses `context.sendMessage()` and the declared `post-reading:*` namespace. |
| Diagnostics | Supported | Uses the public diagnostics callback. |
| Settings compatibility | Supported | The replacement is hash-pinned and explicitly trusted to retain built-in keys. |
| Storage facade | Supported | Uses declared-key `context.storage` areas; undeclared access fails before reaching browser storage. |
| Asset URL facade | Supported | `context.resolveAssetUrl()` authorizes package-owned paths and policy-granted host assets while rejecting unsafe or undeclared paths. |
| OCR and background handlers | Host service | Uses milXdy's declared OCR assets and typed Post-reading handlers. |
| Reader UI | App-owned surface | Uses its own floating player through the public lifecycle and asset facade. |
| Distribution | Reviewed custom build | The verified package is incorporated into the generated extension. |
| Host runtime | X surfaces | Receives X route and surface delivery from the shared runtime. |

## Synchronization Policy

Changes begin in `bonklek/post-reading`, where the standalone extension and SDK
package are built from the same feature source. A milXdy update must then copy
the compatibility JSON exactly, update the pinned package hash after review,
and pass both repositories' verification. A source URL mismatch, compatibility
drift, content hash change, direct runtime messaging, undeclared privilege, or
composer/build failure blocks the integration.

The reference package composes with zero sensitive package API findings. Its
host-provided OCR resources and Post-reading background handlers are declared
in the compatibility matrix and accessed through public SDK capabilities.
