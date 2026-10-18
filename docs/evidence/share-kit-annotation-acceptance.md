# Share Kit local editor acceptance

The checked-in synthetic browser fixture can be rerun with
`node scripts/verify/share-kit-annotations-browser.mjs`. It uses installed
Chromium through the DevTools protocol, with a fresh disposable profile and no
extensions. Set `CHROME_PATH` to select another Chromium executable.

The fixture invokes the actual contextual post action and opens the production
review modal with synthetic local post/quote-independent content. It verifies:

- Freehand, line, rectangle, ellipse, arrow, translucent highlight, and bold
  annotation text placement in the native preview.
- Undo/redo, keyboard movement, clear, and close/reopen retention.
- A default palette derived from already decoded local avatar pixels and an
  explicit user override.
- Combined bold, italic, strikethrough, and bullet formatting on mixed Arabic,
  Latin, CJK, and emoji text.
- Immediate export blocking during debounced editor and annotation updates.
- Successful Copy PNG feedback.
- Exact RGBA pixel equality between the reviewed base image plus committed
  annotations and the copied PNG, including translucent highlights.
- Cancelling an unfinished stroke after keyboard adjustment of committed
  history excludes that stroke from the exported PNG during delayed decoding.

`src/apps/share-kit-annotations.test.ts` also verifies pure annotation history,
bounds-preserving adjustment, palette transparency/fallback, painter coverage,
and scaling. Existing rich-text and Pretext tests retain their broader Unicode,
formatting, whitespace, line-limit, and truncation contracts.

Chromium fixture verification passed with the Arial fallback on the review
host. The actual TwitterChirp font and Firefox runtime were unavailable. This
record does not certify the preferred-font or Firefox live acceptance criteria
in issue #224. Chromium and Firefox extension builds passed, but a successful
build does not substitute for live rendering checks.

Annotation drafts are held only in a WeakMap for the current visible post,
guarded by its original identity/text. They introduce no storage key, upload,
remote analysis, or automatic sharing. Copy and Download receive the same reviewed composite blob. RemiNet media upload/publishing remains unavailable; the export no longer offers authorization refresh as a way to enable it. Visual preferences retain their existing storage
behavior; local editor formatting and drawings are not saved as profile defaults.

Fresh catalog selections start with reviewed Share Kit and Post-Factory
selected. Explicit deselection and empty selections remain authoritative.
Post-Factory's existing maintainer-approved default-on policy now pins its
production source root under `packages/maintainer/tweet-composer-kit` and exact
package/manifest hashes. Only specifically named catalog staging suffixes can
inherit that policy; all checksum, review, package consent, capability, and
sensitive-API gates remain enforced. The Prepare/Apply verifier exercises the
combined default-on creation package selection and denied consent path.
