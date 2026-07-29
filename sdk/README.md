# milXdy App SDK Starter Kit

This directory is the standalone author kit for milXdy App SDK 0.2.3.

The supported distribution path uses the local Add-on Manager to validate and
compose reviewed packages into a stable custom Chromium build. Package
JavaScript runs through the generated extension content runtime under the
declared App SDK contract.

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
- [`AI_AUTHORING.md`](AI_AUTHORING.md): a reusable prompt that keeps AI-assisted
  package drafts inside the public SDK, disclosure, consent, and review contract.
- `../docs/schemas/local-app-package.schema.json`: JSON Schema for
  `milxdy.app.json` authoring.
- `../docs/sdk/APP_SDK.md`: full manifest, composition, privacy, and runtime guide.
- `../docs/sdk/APP_PLATFORM_PRODUCTION_READINESS.md`: platform guarantees,
  security, compatibility, versioning, and the supported distribution contract.
- `../docs/sdk/LOCAL_ADDONS.md`: the managed manual and catalog installation,
  rebuild, and Chrome reload workflow.
- `../docs/contributors/ADD_ONS_CATALOG.md`: catalog selection format, publication gates,
  preview, and maintenance contract.

## Try The Template

From the repository root:

```powershell
pnpm.cmd run verify:local-app-package -- --package=sdk/templates/basic-feature --allow-local-review --acknowledge-package-consent
pnpm.cmd run verify:local-app-package -- --package=sdk/templates/docked-app --allow-local-review --acknowledge-package-consent
pnpm.cmd run verify:app-sdk-harness
```

These commands validate the templates and public lifecycle contract without
changing the installed extension build.

## Test A Package In Chromium

Create a ZIP whose root contains `milxdy.app.json`, place it in
`local-addons/manual/`, and run:

```powershell
npm run addons:status
npm run addons:rebuild -- --allow-local-review --acknowledge-package-consent
```

Read the capability and trust summary before supplying its requested
acknowledgements. Load `dist/chromium-local-apps/` once from
`chrome://extensions`. On later rebuilds, click **Reload** on the existing
extension card and refresh X/Twitter. Apps & Features displays the loaded
package IDs, deterministic composition fingerprint, and reload status.

For lower-level author inspection of one package without using the managed
folders:

```powershell
pnpm.cmd run build:local-apps:chromium -- --package=sdk/templates/basic-feature --allow-local-review --acknowledge-package-consent
```

For a reviewed external author package that needs the release's single Chrome QA
extension, give its folder or ZIP to the active QA host rather than copying it
into core source. The maintainer flow is documented in
[Developer QA reload](../docs/contributors/DEVELOPER_QA_RELOAD.md#reviewed-external-local-package-qa).

For a native-style composer-adjacent panel, use the documented
`composerAction` manifest field and `onComposerAction(context)` callback in
[the App SDK guide](../docs/sdk/APP_SDK.md#composer-actions). Do not call an
overlay app's `open()` lifecycle from a composer action.

That direct builder exercises the same composer but does not provide the local
manager's package placement, transaction recovery, or persistent status flow.

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
