# Local App Package Pilots

These fixtures exercise the low-level first-party replacement and trust policy
documented in `docs/sdk/APP_SDK.md`.
They intentionally shadow built-in app IDs so registry compatibility and
replacement review gates stay covered.

Each folder represents the root of a copied or zipped package:

- `tweetPng/` proves an invoked, user-action `feature` package.
- `wikiSidebar/` proves a docked `app` package with embedded Wiki site scope,
  shared chrome metadata, permissions, privacy notes, and declared assets.

Run the deterministic pilot verifier with:

```powershell
pnpm.cmd run verify:local-app-packages
```

The verifier checks manifest shape, package-relative paths, declared files,
settings/storage metadata, package-kind capability rules, privacy and permission
disclosures, lifecycle/site scopes, and absence of first-party runtime/build
adapter fields. The separate composer below reasons about multiple valid
packages together and can feed a local Chromium custom build.

To dry-run a package set as one composition and write reviewable
machine-readable artifacts:

```powershell
pnpm.cmd run compose:local-apps -- --allow-local-review --acknowledge-package-consent --acknowledge-first-party-replacement
```

Local package composition fails closed by default. `review.status: "blocked"`
is always rejected, and missing or `local` review status requires
`--allow-local-review`. Packages that declare privileged build inputs such as
content entries, package assets, web-accessible files, host permissions, site
scopes, background message types, or consent-required privacy metadata require
`--acknowledge-package-consent`. You can select another folder or one-off
package sources with:

```powershell
pnpm.cmd run compose:local-apps -- --packages-dir=path\to\packages --allow-local-review --acknowledge-package-consent
pnpm.cmd run compose:local-apps -- --package=path\to\package-folder --allow-local-review --acknowledge-package-consent
pnpm.cmd run compose:local-apps -- --package=path\to\package.zip --allow-local-review --acknowledge-package-consent
```

The checked-in examples replace built-in app IDs, so composing this repository
folder or using the clean-checkout fallback requires
`--acknowledge-first-party-replacement`. Built-in replacement trust is rooted in
the repo-owned root and package SHA-256 policy in
`scripts/packages/local-app-first-party-replacements.json`, not in package-authored
`review.status`; copied, moved, changed, or zipped first-party-looking packages
are rejected unless a future external review/signature mechanism is added.
For a novel third-party package sample that does not replace a built-in ID, see
`examples/packages/local-dev/dev-note/` and `pnpm.cmd run verify:local-app-package`.

The generated artifacts live under `tmp/local-app-composition/`:

- `composition-report.json`
- `build-plan.json`
- `apps.generated.json`
- `manifest-permissions.generated.json`
- `web-accessible-assets.generated.json`

To exercise the direct author-level Chromium builder against these fixtures:

```powershell
pnpm.cmd run build:local-apps:chromium -- --allow-local-review --acknowledge-package-consent --acknowledge-first-party-replacement
```

That command validates and composes the selected folder packages, then emits an
unpacked custom extension at `dist/chromium-local-apps/`. Load that folder from
Chrome's extension developer mode. The same package selection flags can be
passed through the builder command:

```powershell
pnpm.cmd run build:local-apps:chromium -- --packages-dir=local-app-packages --allow-local-review --acknowledge-package-consent
```

Folder packages and zip archives are supported. Zip archives must contain one
package root with `milxdy.app.json` at the archive root. The composer rejects
absolute paths, `..` traversal, unsafe filenames, multiple manifests, missing
manifests, malformed JSON, blocked review status, unacknowledged local review,
unacknowledged privileged/consent surfaces, sensitive package API findings
without a reviewed exception, non-acknowledgeable runtime message/port API
findings, and files outside the package root before producing a build plan. It
scans declared text payloads for direct
`chrome.runtime.sendMessage`/`connect`, `browser.runtime.*`, broad privileged
extension APIs, common computed extension API access patterns, extension-origin
URL access, unsafe dynamic code, and remote script loading while skipping binary
assets. The scan is a conservative review gate, not runtime sandboxing or
capability enforcement; a clean scan only means no known scanner pattern
matched. File/archive SHA-256 hashes are included in generated reports and
build plans.

The supported user workflow wraps this composer with canonical manual and
catalog package folders, pinned catalog downloads, transactional promotion,
durable status, and a stable unpacked-extension target. See
[`docs/sdk/LOCAL_ADDONS.md`](../../../docs/sdk/LOCAL_ADDONS.md). Runtime ZIP injection,
automatic package updates, and remote marketplace installation remain outside
the App SDK 0.2.3 distribution model.
