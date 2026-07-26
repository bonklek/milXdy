# App Platform Support Contract

milXdy App SDK 0.2.3 is the supported platform for building reviewed apps into
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

The supported local workflow has four explicit stages:

1. **Select:** the catalog exports one `.milxdy-selection.json` containing the
   exact package IDs, HTTPS ZIP URLs, filenames, SHA-256 hashes, and review
   identities.
2. **Place ZIPs:** `npm run addons:prepare` downloads from allowed GitHub hosts,
   verifies every pinned hash, validates the complete set, and transactionally
   places it in `local-addons/catalog/`. Users may instead put trusted ZIPs in
   `local-addons/manual/` and inspect them with `npm run addons:status`.
3. **Rebuild:** `npm run addons:apply` builds a prepared catalog selection;
   `npm run addons:rebuild` builds the manual set. Both preserve the previous
   working build if the operation fails.
4. **Reload:** the stable output remains `dist/chromium-local-apps/`. Load it
   once, then use Chrome's **Reload** action after each successful rebuild.

The catalog owns selection, the checked-in local manager owns downloads,
filesystem placement and composition, and the generated extension owns loaded
build identity and reload confirmation. The low-level composer commands remain
available for package authors and repository verification.

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
- **Pinned acquisition:** versioned selection files, exact HTTPS package URLs,
  allowed download hosts, manually validated redirects, streaming archive size
  limits, SHA-256 verification, and a content-addressed download cache.
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
catalog package is accepted as reviewed only when its ID, archive hash,
reviewer, and review date match the checked-in trusted-review registry.
Otherwise the user must explicitly pass `--allow-local-review`. Prepare never
executes package code, and the extension never imports a downloaded ZIP at
runtime.

## Supported Capabilities

| Capability | Support |
| --- | --- |
| Reviewed folder or ZIP package | Supported |
| Catalog `.milxdy-selection.json` export | Supported; published entries require pinned artifacts and trusted review metadata |
| Managed download, hash verification, and cache | Supported for checked-in GitHub hosts |
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

Post-reading is the production reference app for App SDK 0.2.3. Its standalone
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
- managed prepare/apply, pinned downloads, cache resume, transaction recovery,
  stable-output preservation, and reload identity;
- static catalog build and route validation;
- Post-reading cross-repository integration;
- Chromium and Firefox extension builds;
- platform, privacy, URL allowlist, smoke, checksum, and reproducibility gates.

Changes to the SDK contract, schema, composer, runtime context, starter kit, or
reference integration must keep this suite green.

## Versioning And Support

The compatibility policy defines App SDK SemVer, manifest versions,
deprecations, package ranges, and migration requirements. Supported SDK
contracts remain synchronized across public declarations, schemas, templates,
runtime types, and deterministic verification.

See [App SDK Compatibility Policy](APP_SDK_COMPATIBILITY.md).
