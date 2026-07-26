# Add-ons Catalog

The static source for the future milXdy Add-ons Catalog lives in
[`catalog/`](../catalog/). It provides a catalog index, a shared per-package
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

The catalog is currently a preview with no published package inventory. It
does not claim runtime ZIP installation, and it does not expose download links
until a package record has a verified HTTPS ZIP URL and SHA-256 value.

## User Workflow

The catalog documents the current Chromium workflow:

1. Download a package ZIP that is explicitly marked **Published**.
2. Copy the unchanged ZIP into `local-app-packages/` at the root of a milXdy
   source checkout. This folder is intentionally gitignored.
3. Install repository dependencies, then run:

   ```powershell
   pnpm.cmd run build:local-apps:chromium -- --packages-dir=local-app-packages --allow-local-review --acknowledge-package-consent
   ```

4. Read the generated composition plan and any additional acknowledgement
   required by the trust gates. The build output is
   `dist/chromium-local-apps/`.
5. Load that output folder from `chrome://extensions` the first time. On later
   builds, keep the same folder, click **Reload** on the existing extension
   card, and refresh X/Twitter tabs.

This is not a runtime package manager. The site cannot extract or move ZIPs,
run the composer, modify the loaded extension, or reload Chrome. Local packages
run as privileged extension code after composition, so review, declarations,
and explicit consent remain part of the security boundary.

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

Then open `http://127.0.0.1:8765/`. The build copies only the two checked-in
brand images used by the site alongside the catalog source; generated preview
output stays under the gitignored `tmp/` directory.

## Publishing Later

`.github/workflows/pages-catalog.yml` is intentionally manual-only. It has no
push, pull-request, release, or schedule trigger. A maintainer must first
configure the repository's Pages source for GitHub Actions, then explicitly
dispatch **Deploy Add-ons Catalog to Pages** when publication is approved.

Do not dispatch that workflow merely to validate a change; use
`verify:pages-catalog` or normal CI instead. Publishing, changing GitHub Pages
settings, and confirming the final public URL remain separate maintainer
actions.
