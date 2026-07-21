# Post-reading App SDK Reference

Post-reading is the release-blocking external reference app for App SDK 0.2.3.
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

| Capability | Status | Current boundary |
| --- | --- | --- |
| Lifecycle and surface delivery | Supported | Public `boot`, `onSurface`, `disable`, `dispose`, `open`, and `close` hooks. |
| Scheduler and cancellation | Supported | Uses the public scheduler, abort signal, and disposable registration. |
| Bounded surface rescan | Supported | Uses `context.requestSurfaceRescan()`; private scanner access is not exposed. |
| Background requests | Supported through host routes | Uses `context.sendMessage()` and the declared `post-reading:*` namespace. |
| Diagnostics | Supported | Uses the public diagnostics callback. |
| Settings compatibility | Supported | The replacement is hash-pinned and explicitly trusted to retain built-in keys. |
| Storage facade | Supported | Uses declared-key `context.storage` areas; undeclared access fails before reaching browser storage. |
| Asset URL facade | Supported | `context.resolveAssetUrl()` authorizes package-owned paths and policy-granted host assets while rejecting unsafe or undeclared paths. |
| OCR and background handlers | Host-provided gap | The initial reference uses milXdy's existing OCR assets and handlers. Package-owned background registration remains unsupported. |
| Shared overlay/dock UI | Gap | Post-reading retains its own floating player until public primitives exist. |
| Runtime install/update/remove | Unsupported | Packages are incorporated into reviewed custom builds, not injected into an installed extension. |
| General non-X runtime | Unsupported | The current delivery runtime is X-first. |

## Synchronization Policy

Changes begin in `bonklek/post-reading`, where the standalone extension and SDK
package are built from the same feature source. A milXdy update must then copy
the compatibility JSON exactly, update the pinned package hash after review,
and pass both repositories' verification. A source URL mismatch, compatibility
drift, content hash change, direct runtime messaging, undeclared privilege, or
composer/build failure blocks the integration.

The reference package currently composes with zero sensitive package API
findings. Its remaining reviewed dependencies are host-provided OCR resources
and Post-reading background handlers, both declared in the compatibility
matrix rather than accessed through private imports.
