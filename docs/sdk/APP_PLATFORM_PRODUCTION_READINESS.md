# App Platform Support Contract

milXdy App SDK 0.2.4 is the supported platform for building reviewed apps into
custom Chromium distributions of milXdy. It gives app authors a versioned
manifest, typed lifecycle, declared capabilities, shared runtime services,
starter templates, deterministic packaging, and fail-closed trust checks.

## Supported Distribution Model

An app ships as a folder or ZIP containing:

- a versioned `milxdy.app.json` manifest;
- prebuilt JavaScript and declared styles;
- package-owned assets and web-accessible resources;
- explicit storage, host, service, privacy, and performance metadata.

The milXdy composer validates the complete selected package set, produces a
reviewable composition report, and generates a deterministic unpacked Chromium
build. Apps & Features provides package enablement, disclosure, reset, rail,
and diagnostics behavior in the generated extension.

The workflow is **Select → Materialize → Rebuild → Reload**. The catalog owns
explicit selection and combined disclosure. The checked-in local manager owns
catalog-revision resolution, allowlisted checked-in artifact materialization,
filesystem placement, and composition. The generated extension owns
loaded-build identity and reload confirmation. [Local Add-ons](LOCAL_ADDONS.md)
is the canonical procedure. Low-level composer commands remain available for
manual package authors and repository verification.

This is a custom-build SDK. Packages become part of the generated extension;
they are not downloaded into an already-installed browser extension. Package
JavaScript therefore receives extension content-script authority and must pass
milXdy's review and trust gates.

## Platform Guarantees

The App SDK provides:

- **Versioned contracts:** App SDK SemVer, manifest schema versioning, package
  versions, compatibility ranges, and documented migration rules.
- **Typed lifecycle:** `boot`, `enable`, `disable`, `onRouteChange`,
  `onSurface`, `open`, `close`, and `dispose` hooks owned by the shared runtime.
- **Bounded context:** declared-key storage, guarded asset URLs, app-scoped
  messaging, shared scheduling, cancellation, diagnostics, and surface rescans.
- **Shared X runtime:** route tracking, surface delivery, visibility-aware
  scheduling, performance budgets, app loading, and cleanup.
- **App surfaces:** Apps & Features metadata, side-rail registration, shared
  overlay patterns, settings ownership, reset behavior, and disclosure.
- **Deterministic composition:** folder and ZIP inputs, normalized package
  paths, generated registries, copied assets, merged permissions, package
  hashes, and reproducible build metadata.
- **Pinned local selection:** versioned selection files, exact catalog
  revisions, Chromium recipe IDs, package IDs/versions/hashes, allowlisted
  `packages/maintainer/` roots, symbolic-link rejection, and deterministic
  package-set materialization. Catalog selection never acquires remote code.
- **Transactional local builds:** exact catalog package-set replacement,
  recoverable promotion journals, a stable unpacked-extension target, and
  preservation of the last known-good output on failure.
- **Durable identity and status:** a new `buildInstanceId` for every successful
  rebuild, a deterministic `compositionFingerprint` for equivalent package
  sets, classified stage failures, and Apps & Features reload state.
- **Fail-closed trust:** incompatible versions, malformed archives, unsafe
  paths, undeclared privileges, storage or route conflicts, asset collisions,
  tampered plans, blocked review status, and unacknowledged sensitive surfaces
  stop before package code reaches a generated build.
- **Author tooling:** public TypeScript declarations, feature and docked-app
  templates, an in-memory lifecycle harness, UI tokens, overlay primitives,
  accessibility guidance, and asset-licensing guidance.

## Security Model

The composer treats every app package as privileged build input. Validation and
static scanning enforce the declared package contract and expose review data;
they do not claim to sandbox arbitrary JavaScript.

Direct package access to runtime messaging is blocked. Apps communicate through
`context.sendMessage()` using manifest-declared message namespaces. Package
storage and assets are limited to declared keys and paths. Host permissions,
remote services, background routes, data use, and consent requirements remain
visible in both package reports and Apps & Features.

Built-in app replacement requires repository-owned source and package hashes in
addition to explicit reviewer acknowledgement. Novel packages start disabled
when they request privileged capabilities or consent.

Package-authored and selection-authored review claims are not trust roots. A
catalog package is accepted as reviewed only when its ID, version, package
hash, reviewer, and review date match the checked-in trusted-review registry.
Otherwise the user must explicitly pass `--allow-local-review`. Prepare never
executes package code, and the extension never imports package code at runtime.

## Supported Capabilities

| Capability | Support |
| --- | --- |
| Reviewed folder or ZIP package | Supported |
| Catalog `.milxdy-selection.json` export | Supported; local-only schema pins catalog revision, recipe, package IDs, versions, and hashes |
| Remote catalog package download | Not supported |
| Checked-in maintainer artifact resolution | Supported below allowlisted package roots |
| Manual ZIP folder and validation-only status | Supported in `local-addons/manual/` |
| Deterministic Chromium custom build | Supported |
| Transactional stable output and recovery | Supported in `dist/chromium-local-apps/` |
| Composition fingerprint and reload detection | Supported in generated Apps & Features metadata |
| Feature and docked overlay packages | Supported |
| Manifest-generated enablement and reset | Supported |
| X route and surface lifecycle | Supported |
| Declared storage and asset access | Supported |
| App-scoped host background services | Supported |
| Shared scheduler, cancellation, and diagnostics | Supported |
| Public UI and accessibility kit | Supported |
| Runtime injection into an installed extension | Outside this distribution model |
| Package-owned background modules | Use host-provided declared services |
| General content runtime on arbitrary websites | X runtime only; other sites use declared host integrations |

## External Reference

Post-reading is the production reference app for App SDK 0.2.4. Its standalone
repository builds the same feature source as a milXdy package, targets the
public SDK declarations, uses declared storage and assets, and is pinned by
source commit and package hash. The cross-repository verification gate builds,
composes, and checks the complete integration.

See [Post-reading App SDK Reference](POST_READING_SDK_REFERENCE.md) for the
capability matrix and verification command.

## Verification Contract

The production verification suite covers:

- public declarations and starter TypeScript;
- lifecycle harness behavior;
- App SDK compliance and generated settings ownership;
- internal bridge restrictions;
- package fixtures and novel-package integration;
- folder and ZIP trust gates;
- catalog selection schema, deterministic serialization, and publication gates;
- managed prepare/apply, pinned local artifact resolution, explicit empty
  selection, transaction recovery, stable-output preservation, and reload
  identity;
- static catalog build and route validation;
- Post-reading cross-repository integration;
- Chromium and Firefox extension builds;
- platform, privacy, URL allowlist, smoke, checksum, and reproducibility gates.

Changes to the SDK contract, schema, composer, runtime context, starter kit, or
reference integration must keep this suite green.

## Versioning And Support

The repository release version, browser extension version, App SDK version,
package manifest version, app package version, and catalog selection schema
version are independent compatibility signals:

- `package.json.version` identifies the repository release.
- `package.json.extensionVersion` identifies the browser extension build.
- `package.json.appSdkVersion` identifies the public App SDK contract.
- `milxdy.app.json.manifestVersion` identifies the package document schema and
  is currently `1`.
- `milxdy.app.json.version` identifies the individual app package.
- `milxdy.app.json.sdk.minVersion` is the oldest supported App SDK.
- `milxdy.app.json.sdk.targetVersion` is the SDK used for package testing.
- `.milxdy-selection.json.schemaVersion` identifies the catalog-to-manager
  document and is currently `1`.

Before App SDK `1.0.0`, minor releases may introduce contract changes. Such a
change includes synchronized public declarations, schemas, templates,
verification, and migration notes. Starting with `1.0.0`, patch releases are
compatible fixes, minor releases add backward-compatible contract surface, and
major releases may require package migration.

The composer rejects packages whose minimum SDK is newer than the current SDK
and warns when the tested target differs. Additions use optional fields or
backward-compatible defaults. Deprecations remain documented for at least one
minor SDK release before removal after `1.0.0`. Breaking releases include a
migration guide and updated starter templates.

Storage changes declare migration and cleanup behavior. Message namespaces and
error envelopes are compatibility contracts. Package updates must not silently
orphan secrets, local paths, caches, or user data.

`compositionFingerprint` identifies the extension version, SDK version, build
target, and exact sorted package ID/version/hash tuples.
`buildInstanceId` identifies one successful managed build and supports Chrome
reload detection.
