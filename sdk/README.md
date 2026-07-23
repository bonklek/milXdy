# milXdy App SDK Starter Kit

This directory is the standalone author kit for milXdy App SDK 0.2.3.

The supported distribution path composes a reviewed package into a custom
Chromium build. Package JavaScript runs through the generated extension content
runtime under the declared App SDK contract.

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
- `../docs/APP_PLATFORM_PRODUCTION_READINESS.md`: platform guarantees, security
  model, and supported distribution contract.

## Try The Template

From the repository root:

```powershell
pnpm.cmd run verify:local-app-package -- --package=sdk/templates/basic-feature --allow-local-review --acknowledge-package-consent
pnpm.cmd run verify:local-app-package -- --package=sdk/templates/docked-app --allow-local-review --acknowledge-package-consent
pnpm.cmd run verify:app-sdk-harness
pnpm.cmd run build:local-apps:chromium -- --package=sdk/templates/basic-feature --allow-local-review --acknowledge-package-consent
```

Review the generated composition report and package hashes, then load
`dist/chromium-local-apps/` as an unpacked extension.

## Author Rules

- Ship prebuilt `.js` or `.mjs`; the composer does not transpile source.
- Start novel packages disabled and declare a generated enablement setting.
- Use `context.scheduler`, `context.signal`, `context.sendMessage`, and
  `context.recordDiagnostic` instead of private milXdy imports or direct runtime
  messaging.
- Namespace package storage and message types under the package ID.
- Declare every host, remote service, asset, storage key, and privacy effect.
- Use host-provided declared services for background work.
- Treat DOM nodes delivered in `onSurface` as short-lived SPA state.
- Register cleanup through `context.addDisposable` and check
  `context.signal.aborted` after asynchronous work.
- Exercise lifecycle and capability assumptions with `createAppHarness()` before
  composing a browser build; the harness fails closed on undeclared storage and
  asset access just like the public runtime facade.
- Copy the public UI CSS into the package instead of importing private overlay
  modules, then satisfy the accessibility and asset-license checklists.

The starter declaration exposes the complete public context and omits private
runtime helpers such as cross-app loading. Apps stay portable by depending only
on the manifest and public SDK declarations.
