# milXdy App SDK

milXdy App SDK 0.2.3 builds reviewed app packages into custom Chromium editions
of milXdy. Packages declare their features, lifecycle, settings, storage,
assets, permissions, privacy effects, and performance cost through a versioned
manifest. milXdy supplies the shared runtime, Apps & Features integration,
build tooling, and trust checks.

## Choose Your Path

### Use Add-ons

Follow [Local Add-ons](LOCAL_ADDONS.md) to place trusted ZIPs, inspect their
declared capabilities, build the stable custom extension, and reload it in
Chrome. A catalog selection uses the same workflow with pinned download URLs
and SHA-256 hashes.

### Build An Add-on

Start with the [SDK starter kit](../sdk/README.md). It includes two package
templates, public TypeScript declarations, a lifecycle test harness, UI
primitives, accessibility guidance, and package verification commands.

Use the [App SDK reference](APP_SDK.md) while implementing manifests, lifecycle
hooks, settings, storage, assets, messaging, surfaces, and package composition.

### Evaluate The Platform Contract

Read the [App Platform Support Contract](APP_PLATFORM_PRODUCTION_READINESS.md)
for the supported distribution model, security boundary, compatibility rules,
versioning, and verification guarantees.

## Distribution Model

App SDK packages are trusted build inputs. The local Add-on Manager validates
packages and composes them into `dist/chromium-local-apps/`. Users load that
folder once and reload the existing unpacked extension after successful
rebuilds.

milXdy does not inject ZIP JavaScript into a running extension. Validation and
static scanning support review, but do not turn package code into a sandboxed
capability environment.

The catalog is a selection surface. It produces a small
`.milxdy-selection.json`; the checked-in local manager owns downloads, hash
verification, filesystem placement, composition, and build promotion.
The 0.2.3 repository includes the catalog implementation with no published
package inventory. Catalog publication is a separate maintainer action and is
not required for the manual trusted-ZIP workflow.

## Current Support

- Chromium custom builds from reviewed folder or ZIP packages
- Manual packages and pinned catalog selections
- Apps, features, themes, and generated Apps & Features metadata
- Shared X/Twitter routes, surfaces, scheduling, cancellation, and diagnostics
- Declared storage, assets, host access, privacy, and host-provided services
- Stable output, transactional promotion, composition identity, and reload
  detection

Runtime package installation, automatic marketplace updates, arbitrary-site
content execution, and package-owned background modules are outside the App SDK
0.2.3 contract.

## Additional Resources

- [Local package manifest schema](local-app-package.schema.json)
- [Catalog selection schema](milxdy-selection.schema.json)
- [Post-reading production reference](POST_READING_SDK_REFERENCE.md)
- [Catalog maintenance and publishing](ADD_ONS_CATALOG.md)
