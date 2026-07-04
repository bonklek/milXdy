# Local App Package Samples

`dev-note/` is a novel third-party package sample. It does not shadow a built-in app ID, starts disabled, and becomes controllable through its manifest-declared Apps & Features enablement setting after composition.

Verify it directly:

```powershell
pnpm.cmd run verify:local-app-package -- --package=examples/packages/local-dev/dev-note --allow-local-review --acknowledge-package-consent
```
