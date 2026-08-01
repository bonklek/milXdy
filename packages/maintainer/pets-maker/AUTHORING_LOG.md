# Pets Maker package authoring log

## Ownership and separation

Pets Maker is a novel, optional App SDK package. Its app lifecycle, form,
deterministic compositing contract, styles, and icon live entirely under this
package. The core extension supplies only its existing public overlay-app
runtime. Composer Kit no longer imports or renders pet code.

## Remy rail icon provenance

- Source repository: maintainer-local read-only `remilia-pets` snapshot
- Source file: `previews/remy-idle.png`
- Source pet: `pets/remy/pet.json` (`id: remy`, sprite version 2)
- Source SHA-256: `90e54050cd9eb16c79c14428a56e47ccfa2a6717c8c8a26ed8cf862064eb20fb`
- Packaged path: `assets/remy.png`
- Modification: none; exact byte-for-byte copy
- License: repository-level Viral Public License, confirmed by `pets/remy/README.md`
- Attribution: Remy, from the reusable maintainer-local Remilia pet source

The source repository was treated as read-only and was not mutated.

## Maintainer catalog review

Issue #181 moved the unchanged package implementation from the local-pilot
tree into `packages/maintainer/pets-maker` and pinned its version, declared-file
hash, reviewed manifest, and build recipe in the checked-in catalog. The
generated `dist/content.js` is checked in with the package so a clean checkout
can reproduce and materialize the catalog selection without relying on an
untracked prior build.

Catalog installation preserves `defaultEnabled: false`. It does not pin the app
to the rail or open it. The user separately enables Pets Maker through
Apps & Features, and an explicit empty or different selection removes the
catalog-managed package on the next transactional Prepare/Apply cycle.
