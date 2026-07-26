# Add-ons Catalog

The static onboarding source for the Pages root lives in [`pages/`](../pages/),
and the milXdy Add-ons Catalog source lives in [`catalog/`](../catalog/). The
build stages the onboarding walkthrough at `/` and the catalog at `/addons/`.
The catalog provides an index, a shared per-package
detail route, official and approved-external sections, security and browser
download disclosures, and the supported local custom-build workflow.

The page follows the checked-in [Contributor UI Style Guide](CONTRIBUTOR_UI_STYLE_GUIDE.md):
compact utility panels, crisp bordered controls, stable geometry, readable
light/dark states, and no landing-page hero treatment. Its visual source of
truth is the X-facing treatment in `src/platform/visuals/reskin-styles.ts` and
`src/platform/overlay/app-chrome.ts`: the Moderate profile's page background,
surface, secondary surface, border, Remilia blue, text, and dark-mode values,
plus the shared overlay's shallow highlight and bevel geometry. Images and
visual cues use square or near-square frames with slightly rounded corners.
The header uses the existing square beveled mark from `assets/brand/`.

The Pages root at <https://bonklek.github.io/milXdy/> is the project onboarding
site. The public catalog is linked from there and lives at
<https://bonklek.github.io/milXdy/addons/>. No
add-ons are published yet: both the official and approved-external inventories
are empty, and all download controls are disabled. It
does not claim runtime ZIP installation, and it does not allow a package into a
selection file until its record has a verified HTTPS ZIP URL, SHA-256 value,
approved review, and matching checked-in trusted-review entry.

## User Workflow

The catalog shows the supported Chromium journey without claiming that the
site can install an add-on:

1. Discover and select only records explicitly marked **Published**.
2. Put the verified package ZIPs in the source checkout's local add-ons folder.
3. Review the declared capabilities and consent requirements, then create a new
   local build in `dist/chromium-local-apps/` with the matching milXdy release's
   documented add-on tooling.
4. Load that output folder from `chrome://extensions` the first time. On later
   builds, keep the same folder, click **Reload** on the existing extension
   card, and refresh X/Twitter tabs.

No add-ons are published yet, so that journey cannot currently be started from
the catalog. This is not a runtime package manager: the site cannot place ZIPs,
run a build, modify the loaded extension, or reload Chrome. Local packages run
as privileged extension code after composition, so review, declarations, hash
verification, and explicit consent remain part of the security boundary.

## Maintaining Inventory

`catalog/data/catalog.json` is the single source of truth for both the index
and detail pages. Keep official packages under `official` and reviewed
third-party packages under `approved-external`; never represent an external
publisher as official.

Every package record must include its availability, publisher, review status,
capabilities, permissions, privacy notes, and download state. A Published
record additionally requires:

- a verified HTTPS ZIP URL
- its exact `.zip` filename
- a lowercase SHA-256 value calculated from that published ZIP
- an HTTPS source URL
- `review.status` set to `approved`, with the real reviewer and ISO review date

Do not add placeholder versions, hashes, screenshots, download URLs, review
dates, or feature claims. Use `planned` or `under-review` with `download: null`
until the real artifact and its review evidence exist.

The metadata shape is documented by
`catalog/data/catalog.schema.json`. Run the focused validator after changes:

```powershell
npm.cmd run verify:pages-catalog
```

The detail route is `catalog/add-ons/?id=<package-id>`. The index generates
these links from metadata, so package prose does not need to be duplicated in
HTML.

For a local preview, build the self-contained static directory and serve it:

```powershell
npm.cmd run build:pages-catalog
python -m http.server 8765 --bind 127.0.0.1 --directory tmp/pages-catalog-site
```

Then open `http://127.0.0.1:8765/` for onboarding or
`http://127.0.0.1:8765/addons/` for the catalog. The build copies only the two
checked-in brand images used by the site alongside the static sources;
generated preview output stays under the gitignored `tmp/` directory.

## Publishing

`.github/workflows/pages-catalog.yml` is intentionally manual-only. It has no
push, pull-request, release, or schedule trigger. A maintainer must first
configure the repository's Pages source for GitHub Actions, then explicitly
dispatch **Deploy milXdy Site to Pages** when publication is approved.

Do not dispatch that workflow merely to validate a change; use
`verify:pages-catalog` or normal CI instead. Publishing, changing GitHub Pages
settings, and confirming the final public URL remain separate maintainer
actions.
