# Local App Package Samples

`dev-note/` is a novel third-party package sample. It does not shadow a built-in app ID, starts disabled, and becomes controllable through its manifest-declared Apps & Features enablement setting after composition.

For the author-facing declarations and copyable starter template, see
`sdk/README.md`. This example remains the smallest deterministic integration
fixture used by repository verification.

Verify it directly:

```powershell
pnpm.cmd run verify:local-app-package -- --package=examples/packages/local-dev/dev-note --allow-local-review --acknowledge-package-consent
```

The reviewed, disabled-by-default Pets Maker package now lives at
`packages/maintainer/pets-maker/` so the local catalog can pin and install its
exact source. It lazy-loads on `dockOpen`, owns the pet form and bundle contract
outside Composer Kit, and uses the VPL-compatible Remy preview as its rail icon.

```powershell
pnpm.cmd run build:pets-maker-package
pnpm.cmd run verify:local-app-package -- --package=packages/maintainer/pets-maker --acknowledge-package-consent
```
