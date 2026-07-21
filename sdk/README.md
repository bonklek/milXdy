# milXdy App SDK Starter Kit

This directory contains the standalone author-facing portion of the milXdy App
SDK. It is repository source material and is not copied into normal browser
extension release archives.

The current supported developer path is a reviewed package composed into a
custom Chromium build. It is not a runtime plugin system: package JavaScript
runs with the generated extension content runtime, and acceptance by the static
scanner is not a sandbox guarantee.

## Contents

- `types/index.d.ts`: the supported content-app lifecycle and context facade for
  App SDK `0.2.3`.
- `templates/basic-feature/`: a minimal novel feature package with generated
  Apps & Features enablement, cancellation-safe lifecycle hooks, and local-only
  diagnostics.
- `templates/docked-app/`: a rail-capable overlay app using guarded assets,
  declared local storage, deterministic open/close hooks, and cleanup.
- `testing/app-harness.mjs`: an in-memory public-context harness for lifecycle,
  cancellation, scheduling, storage, assets, messaging, diagnostics, and
  disposables.
- `ui/theme.css` and `ui/overlay.css`: copyable semantic tokens and accessible,
  responsive overlay primitives used by the docked starter.
- `UI.md`, `ACCESSIBILITY.md`, and `ASSETS_AND_LICENSING.md`: the author-facing
  UI, interaction, review, and redistribution baseline.
- `../docs/local-app-package.schema.json`: JSON Schema for
  `milxdy.app.json` authoring.
- `../docs/APP_SDK.md`: full manifest, composition, privacy, and runtime guide.
- `../docs/APP_SDK_COMPATIBILITY.md`: version and compatibility policy.
- `../docs/APP_PLATFORM_PRODUCTION_READINESS.md`: supported product boundary and
  production exit criteria.

## Try The Template

From the repository root:

```powershell
pnpm.cmd run verify:local-app-package -- --package=sdk/templates/basic-feature --allow-local-review --acknowledge-package-consent
pnpm.cmd run verify:local-app-package -- --package=sdk/templates/docked-app --allow-local-review --acknowledge-package-consent
pnpm.cmd run verify:app-sdk-harness
pnpm.cmd run build:local-apps:chromium -- --package=sdk/templates/basic-feature --allow-local-review --acknowledge-package-consent
```

Load `dist/chromium-local-apps/` as an unpacked extension only after reviewing
the generated composition report and package hashes.

## Author Rules

- Ship prebuilt `.js` or `.mjs`; the composer does not transpile source.
- Start novel packages disabled and declare a generated enablement setting.
- Use `context.scheduler`, `context.signal`, `context.sendMessage`, and
  `context.recordDiagnostic` instead of private milXdy imports or direct runtime
  messaging.
- Namespace package storage and message types under the package ID.
- Declare every host, remote service, asset, storage key, and privacy effect.
- Do not declare package-owned background entries; they are unsupported in the
  current contract.
- Treat DOM nodes delivered in `onSurface` as short-lived SPA state.
- Register cleanup through `context.addDisposable` and check
  `context.signal.aborted` after asynchronous work.
- Exercise lifecycle and capability assumptions with `createAppHarness()` before
  composing a browser build; the harness fails closed on undeclared storage and
  asset access just like the public runtime facade.
- Copy the public UI CSS into the package instead of importing private overlay
  modules, then satisfy the accessibility and asset-license checklists.

The starter declaration intentionally omits internal runtime helpers such as
cross-app loading. If a template cannot implement a real app without a private
import, record it as an SDK gap instead of coupling the package to repository
internals.
