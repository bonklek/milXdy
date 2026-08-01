# Add-ons Catalog

The static source for the milXdy Add-ons Catalog lives in
[`catalog/`](../../catalog/). The canonical hosted location is
`https://bonklek.github.io/milXdy/addons/`; the checked-in page remains useful
offline and is the source of truth for its metadata. It provides the three current
package records — Pets Maker, Composer Kit, and Share Kit — with per-package disclosures,
explicit selection controls, a combined review, and the supported Chromium
custom-build workflow. BOORU and Meme Maker are Composer Kit capabilities, not
standalone catalog entries.

The page follows the checked-in
[Contributor UI Style Guide](CONTRIBUTOR_UI_STYLE_GUIDE.md): compact utility
panels, crisp bordered controls, stable geometry, readable light/dark states,
and no landing-page hero treatment.

The catalog is a preview. Pets Maker is the first catalog-installed selectable
app and remains disabled after installation until the user enables it in
**Apps & Features**. Share Kit is also selectable as a reviewed first-party
replacement. Their source, versions, exact hashes, policies, and trusted reviews
are checked in. Composer Kit remains **Under review**: it is active in
cumulative QA, but its source and trusted catalog hash are not yet committed to
an allowlisted catalog artifact path. An under-review record is documentation,
not an artifact or implied installation.

## Security and distribution boundary

The first catalog has no remote package artifacts:

- the page never downloads a package ZIP, script, module, or executable payload;
- the page never sends package bytes or build commands to the extension;
- the selection file contains only catalog identity/revision, build target,
  recipe ID, and sorted package IDs, versions, and package SHA-256 values;
- `addons:prepare` resolves those identities only against allowlisted checked-in
  maintainer or reviewed first-party replacement paths in the same source
  checkout;
- the local composer remains authoritative for package identity, SDK
  compatibility, file hashes, permissions, conflicts, lifecycle, and trust
  acknowledgements;
- package code becomes privileged extension code only after a local custom
  build. It is not sandboxed, hot-loaded, or installed into a running extension.

Manual user-supplied packages under `local-addons/manual/` remain a separate
advanced-user input. A maintainer catalog selection never names or fetches
those files.

## User workflow

1. Review the records and explicitly select any compatible package subset.
   Selecting none is a valid baseline selection and removes all
   catalog-managed packages on the next Prepare.
2. Read the combined capability, host, optional-permission, privileged-surface,
   site-scope, remote-service, storage, privacy, and acknowledgement summary.
   Missing dependencies and conflicts disable selection-file creation with a
   concrete error; dependencies are never silently added.
3. Download `.milxdy-selection.json`. For an identical catalog revision and
   package subset, its bytes are deterministic.
4. In the matching milXdy source checkout, run:

   ```powershell
   npm run addons:prepare -- --selection=path\to\.milxdy-selection.json
   ```

5. Prepare re-resolves the exact catalog revision, checks the Chromium recipe,
   verifies package identities/versions/hashes and the trusted-review registry,
   copies only the selected checked-in package roots to a transactional staging
   directory, and runs the existing composer in review mode. It does not build
   or execute the packages.
6. Review `tmp/local-addon-manager/composition/composition-report.json` and the
   acknowledgement list printed by Prepare. Then run:

   ```powershell
   npm run addons:apply -- --acknowledge-package-consent --acknowledge-first-party-replacement
   ```

   Use only the flags Prepare actually requests.
7. Apply rebuilds `dist/chromium-local-apps/` and promotes it only after
   validation and compilation pass. Load that folder once from
   `chrome://extensions`; for later updates, keep the same extension card and
   click **Reload**.

This flow is Chromium-only. Firefox release builds and ordinary release builds
are unchanged when no catalog selection is applied.

## Dependency and conflict policy

`catalog/data/catalog.json` declares exact package dependencies and explicit
package conflicts. Both the page and the local manager enforce them:

- every dependency must be selected explicitly at the catalog-pinned version;
- unknown, unavailable, stale, or hash-mismatched packages fail closed;
- either side of a declared conflict makes the combination invalid;
- the package composer still performs its deeper duplicate-ID, background
  route/service, storage ownership, site-route, built-in identity, SDK,
  permission, and artifact conflict checks;
- a browser-side green summary never overrides a local composer rejection.

## Rollback and recovery

The stable custom build and selected catalog package set each use a write-ahead
promotion journal:

- `local-addons/.state/catalog-promotion.json` protects
  `local-addons/catalog/`;
- `local-addons/.state/build-promotion.json` protects
  `dist/chromium-local-apps/`;
- backups are restored automatically when the manager starts after an
  interrupted promotion;
- failed validation or compilation leaves the previous stable custom build
  untouched;
- the selection lock at `local-addons/.state/selection-lock.json` records
  catalog revision, build recipe, selection hash, package identities, package
  hashes, artifact paths, and trusted-review results.

To remove catalog-managed packages, prepare and apply an explicit empty
selection. To abandon a failed candidate before Apply, keep using the previous
stable output; do not delete or replace its folder manually. If Chrome is
running a newer failed experiment, reload the preserved stable folder on the
same unpacked-extension card.

## Maintaining inventory

`catalog/data/catalog.json` is the single source of truth for both the index and
detail pages. Every package record includes:

- stable package ID, name, icon, description, kind, version, and SDK range;
- repository/path provenance and owning issues;
- review and availability state;
- local artifact path, exact package SHA-256, and recipe when a candidate exists;
- capabilities, permissions, privileged surfaces, site scope, remote services,
  storage, privacy, dependencies, conflicts, replacement policy, and blockers.

A record may be `published` only when it has an approved review, a real version,
a checked-in `maintainer-source` artifact under an allowlisted root, an exact
package hash, a trusted-review registry match, and successful cumulative QA.
Never add placeholder hashes, review dates, permissions, or feature claims.

The package-boundary evidence for the initial records is in
[Initial maintainer inventory](ADD_ONS_CATALOG_INVENTORY.md). Contributor
submissions continue to use
[Add-on catalog submissions](ADD_ON_CATALOG_SUBMISSIONS.md); that process does
not turn external work into a first-party local artifact.

Run the focused checks after catalog changes:

```powershell
npm.cmd run build:share-kit-package
npm.cmd run build:pets-maker-package
npm.cmd run verify:pages-catalog
npm.cmd run verify:local-addon-selection
npm.cmd run verify:local-addon-selection-workflow
```

For a local page preview:

```powershell
npm.cmd run build:pages-catalog
python -m http.server 8765 --bind 127.0.0.1 --directory tmp/pages-catalog-site
```

Then open `http://127.0.0.1:8765/`.

## Publishing later

`.github/workflows/pages-catalog.yml` is intentionally manual-only. It has no
push, pull-request, release, or schedule trigger. A maintainer must explicitly
approve the inventory state and dispatch **Deploy Add-ons Catalog to Pages**.

Do not dispatch that workflow merely to validate a change. Publishing, changing
GitHub Pages settings, and confirming the public URL remain separate maintainer
actions.
