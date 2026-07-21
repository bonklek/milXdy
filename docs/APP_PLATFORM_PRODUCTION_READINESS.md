# App Platform Production Readiness

This document is the release contract for making milXdy dependable enough for
independent apps to build upon. It separates the platform that can be supported
now from the runtime-installed marketplace that still requires a different
security and browser-distribution design.

## Supported Product Boundary

The first production App SDK target is the **reviewed custom-build platform**:

1. an app author ships a folder or ZIP containing a versioned
   `milxdy.app.json`, prebuilt JavaScript, and declared assets;
2. the local composer validates the complete selected package set and fails
   closed on unsafe, incompatible, conflicting, or unacknowledged inputs;
3. a developer or advanced user reviews the composition report;
4. the builder emits a deterministic unpacked Chromium extension containing
   the accepted packages;
5. Apps & Features owns package enablement, disclosure, reset, rail, and
   diagnostics behavior in that generated build.

This boundary is intentionally narrower than a conventional app store. The
current platform does not download and execute new JavaScript inside an
already-installed release extension. Local packages are privileged code in a
custom extension build and are not capability-isolated merely because the
static review scanner accepts them.

Runtime-installed packages, marketplace installation, and package-owned
background modules remain future products until a runtime membrane or sandbox,
browser-distribution policy, and complete install/update/remove lifecycle are
designed and tested.

## Production Definition Of Done

The reviewed custom-build platform may be called production-ready only when all
of these are true:

- **Stable contract:** the manifest schema, content module lifecycle, context
  facade, settings metadata, compatibility policy, and supported package kinds
  are versioned and documented.
- **External proof:** at least one non-trivial external app completes the
  package, composition, enable/disable, settings, messaging, update, and cleanup
  matrix without importing private milXdy source paths.
- **Representative starter kit:** authors have typed lifecycle declarations and
  working feature, docked-app, and capability-using examples.
- **Fail-closed composition:** malformed archives, unsafe paths, incompatible
  versions, storage/route/asset conflicts, undeclared privileges, package
  tampering, and untrusted first-party replacements fail before a build plan is
  emitted.
- **Bounded authority:** package code uses the SDK context and declared message
  namespaces. Direct runtime messaging stays blocked; any sensitive API
  exception is reviewed, explicit, and recorded.
- **Lifecycle ownership:** the generated extension can enable, disable, reset,
  and diagnose every novel package without importing it merely to change
  settings.
- **Automated coverage:** unit tests, SDK compliance, internal bridge checks,
  package fixtures, the novel-package integration test, and trust-gate cases
  pass in required CI.
- **Operational policy:** compatibility, support, review status, package
  checksums, vulnerability response, deprecation, and removal/revocation
  expectations are public.

Passing the composer does not satisfy the external proof requirement by itself.
The checked-in `dev-note` package is a contract fixture, not the production
reference app.

## Readiness Scorecard

| Area | Current state | Production exit |
| --- | --- | --- |
| First-party runtime | Strong | Keep all registry compliance and bounded-runtime checks green. |
| Manifest and composition | Strong advanced-user path | Keep schema, composer, builder, and tamper tests synchronized. |
| Public developer API | Preview | Publish supported declarations and validate them against runtime types. |
| External integration proof | Implemented and CI-enforced | Complete live behavior QA, then merge the paired Post-reading and milXdy PRs. |
| Background capability model | Metadata only for third parties | Expose named shared services or design reviewed build-time handler registration. |
| Runtime isolation | Not provided | Do not promise runtime installation until a membrane/sandbox exists. |
| Install/update/remove UX | Custom rebuild only | Document the rebuild lifecycle now; design in-product lifecycle separately. |
| Starter kit | Feature/docked templates, harness, UI tokens, overlay primitives, and author checklists | Keep examples and public UI assets synchronized in the production gate. |
| Reviewed marketplace | Design issue open | Publish a canonical, machine-readable reviewed catalog only after review policy is complete. |
| Multi-site runtime | X-first | Add per-site runtime/scanner implementation and QA before claiming general site support. |
| CI and repository governance | Partial | Require the SDK production suite and protect the public integration branch. |

## Delivery Sequence

### P0: Freeze The Reviewed Custom-Build Contract

- Keep `manifestVersion: 1` and App SDK SemVer independent from app package
  versions.
- Publish the supported content-module and runtime-context declarations in
  `sdk/types/`.
- Define compatibility, breaking-change, deprecation, and capability rules in
  `APP_SDK_COMPATIBILITY.md`.
- Keep the schema, TypeScript contract, composer validation, generated registry,
  and author documentation synchronized through deterministic verification.
- Correct documentation that still lists already-implemented validation or
  conflict checks as future blockers.

### P0: Prove A Real External App

Use standalone Post-reading as the release-blocking reference integration:

- no imports from `src/platform`, `src/apps`, or other private milXdy paths;
- a machine-readable milXdy/App SDK compatibility pair;
- repeatable package build and composition;
- enable/disable, launch, settings defaults and migrations, reset, and cleanup;
- declared content/background messaging with stable error envelopes;
- cancellation, timeout, offline, unavailable-capability, and version-mismatch
  coverage;
- Chromium and Firefox behavior documented even if the current composer output
  remains Chromium-only;
- an SDK gap report for every workaround.

### P0: Make Verification Non-Optional

Required CI must run:

- TypeScript and unit tests;
- Chromium and Firefox builds;
- platform and URL allowlist verification;
- App SDK compliance and settings-mirror verification;
- internal messaging-bridge verification;
- local package fixtures and the novel-package integration check;
- the full local package trust-gate suite;
- existing extension and app smoke tests.

### P1: Complete The Author Experience

- Keep the scaffoldable feature and docked-app templates in the production gate.
- Keep theme tokens, overlay primitives, accessibility expectations, and asset
  licensing guidance synchronized with the docked starter.
- Keep the package test harness aligned with lifecycle order, cancellation,
  declared storage/assets, scheduling, messaging, diagnostics, and cleanup;
  add message namespace enforcement when typed shared services land.
- Document the exact custom-build update/removal process and preservation or
  cleanup of package-owned storage.
- Clarify whether the repository license applies to independently authored app
  packages and provide a submission licensing checklist.

### P1: Define Capabilities Instead Of Private Imports

- Give supported services stable capability identifiers and typed request/result
  envelopes.
- Prefer shared services for fetch, storage, overlay, scanner, audio, and
  diagnostics work.
- Remove or permission internal cross-app loading from the eventual public
  context facade.
- Keep package-owned background code unsupported until registration, sender
  validation, quotas, cancellation, upgrades, and teardown are specified.

### P2: Reviewed Marketplace And Runtime Installation

- Define a canonical reviewed catalog with source URL, artifact URL, checksum,
  signing/provenance metadata, SDK range, permissions, review date, and status.
- Define update, rollback, deprecation, blocking, and revocation behavior.
- Add install consent and safe remove/reset flows.
- Only add runtime package execution after the sandbox/membrane and browser
  distribution model are proven. A store launcher alone is discovery UI, not
  package installation or a trust boundary.

## GitHub And Administrative Work

These tasks require repository administration rather than source changes:

- protect `main` and require the CI verification job;
- enable Dependabot security updates, secret scanning, and push protection where
  the repository plan supports them;
- resolve or document open App Runtime And Distribution Prep milestone issues;
- keep issue #18 as the external SDK release gate;
- complete the reviewed marketplace policy in issue #56 and starter kit scope in
  issue #70 before presenting the App Store as available;
- treat issue #74 as the gate for claiming a general multi-site content runtime.

## Release Decision

Until every P0 exit is complete, use **App SDK preview** or **reviewed local
package preview** in public copy. After every P0 exit is complete, the supported
claim may become **production-ready reviewed custom-build App SDK**. Reserve
**runtime app platform** or **App Store installation** for the later sandboxed
product.
