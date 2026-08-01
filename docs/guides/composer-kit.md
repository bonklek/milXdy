# Composer Kit

Composer Kit groups the 0.2.4 composer and reply tools into one add-on surface.
It does not add another side-rail app. In a build that includes Composer Kit,
enable it from **Apps & Features**, then use its controls beside X's composer or
Reply controls.

Composer Kit is present in the reviewed 0.2.4 package composition. Its public
Add-ons Catalog record remains **Under review**, so it cannot yet be selected by
the catalog's local Prepare/Apply workflow.

## Quick replies and Drafts

- Click the Composer Kit reply control below a post to open the compact quick-reply panel.
- **Send a reply** opens X's native reply composer without inserting or sending text.
- Clicking `milady`, `remilio`, or a saved custom phrase invokes that exact reviewed row. The host verifies the declared value before the configured quick-reply submission; it fails closed if the native composer does not contain exactly that value.
- Use the **D** composer action to open X's native Drafts. Composer Kit does not keep a separate local draft shelf and cannot inspect draft contents.
- Escape, clicking outside, or clicking the invoking control again closes the panel and returns focus through the host lifecycle.

## Remibooru reactions

Open the Remibooru picker from Composer Kit to browse recent posts, search tags,
select tag facets, and move through bounded result pages. Results show
Remibooru attribution and sanitized thumbnails. An explicit result click can
attach that returned thumbnail to the composer that opened the picker; it never
posts. Use the canonical-source action when you want to open the Remibooru post
instead.

Composer Kit does not receive original-media URLs or image bytes, and it does
not maintain a local media cache or saved-media collection.

## Publish an image to Remibooru

Use the **Upload to Remibooru** context action on an eligible visible X-hosted
image. The panel shows the selected image type and dimensions, the public
Remibooru destination, and controls for up to 12 bounded tags.

1. Review the selected image and destination.
2. Add or remove tags. **Get tag ideas in Grok** opens a visible assistant prompt; it does not silently edit the tags.
3. Click **Publish to Remibooru**. That visible button is the final upload action.
4. On success, use **View on Remibooru** to open the canonical post.

There is no extra rights checkbox, ownership attestation, source-attribution
field, or narrative disclosure step. Nothing uploads before the visible Publish
action. If authentication, contributor access, CAPTCHA/anti-abuse behavior,
format limits, moderation, duplication, rate limits, or upstream availability
blocks the reviewed flow, use **Open native uploader**.

## Maker handoffs

The Factory control offers reviewed Milady, Remilio, Bonkler, and Kagami Maker
handoffs plus the ordinary CHEESEWORLD link. Review Top and Bottom caption
fields before launching a Maker. The host may open the declared Maker in an
inactive tab and return a generated image for review, but Composer Kit does not
receive X draft text, inspect the Maker page, or post the result.

## Privacy and safety

- Composer Kit has no direct X DOM, browser-tab, clipboard, cookie, or raw extension-message access.
- Remibooru search sends only the explicit query/facets, bounded page size, and pagination cursor.
- The contribution flow gives the package only an opaque, short-lived media handle and bounded tags; the host owns image bytes and Remibooru session use.
- Maker handoffs send only user-reviewed declared caption fields.
- Every composer, reply, attachment, contribution, and maker action begins with an explicit user control.

See [Privacy and permissions](../getting-started/PRIVACY_AND_PERMISSIONS.md)
for the complete remote-service and storage summary.
