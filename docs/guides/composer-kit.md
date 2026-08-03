# Post-Factory

Post-Factory groups the 0.2.4 composer and reply tools into one add-on surface.
It does not add another side-rail app. In a build that includes Post-Factory,
enable it from **Apps & Features**, then use its controls beside X's composer or
Reply controls.

Post-Factory is present in the reviewed 0.2.4 package composition. Its public
Add-ons Catalog record remains **Under review**, so it cannot yet be selected by
the catalog's local Prepare/Apply workflow.

## Quick replies and Drafts

- Click the Post-Factory reply control below a post to open the compact quick-reply panel.
- **Send a reply** opens X's native reply composer without inserting or sending text.
- Clicking `milady`, `remilio`, or a saved custom phrase invokes that exact reviewed row. The host verifies the declared value before the configured quick-reply submission; it fails closed if the native composer does not contain exactly that value.
- Use the **D** composer action to open X's native Drafts. Post-Factory does not keep a separate local draft shelf and cannot inspect draft contents.
- Escape, clicking outside, or clicking the invoking control again closes the panel and returns focus through the host lifecycle.

## Remibooru reactions

Open the Remibooru picker from Post-Factory to browse recent posts, search tags,
select tag facets, and move through bounded result pages. Results show
Remibooru attribution and sanitized thumbnails. An explicit result click can
attach that returned thumbnail to the composer that opened the picker; it never
posts. Use the canonical-source action when you want to open the Remibooru post
instead.

Post-Factory does not receive original-media URLs or image bytes, and it does
not maintain a local media cache or saved-media collection.

## Maker handoffs

The Factory control offers reviewed Milady, Remilio, Bonkler, and Kagami Maker
handoffs plus the ordinary CHEESEWORLD link. Review Top and Bottom caption
fields before launching a Maker. The host may open the declared Maker in an
inactive tab and return a generated image for review, but Post-Factory does not
receive X draft text, inspect the Maker page, or post the result.

## Privacy and safety

- Post-Factory has no direct X DOM, browser-tab, clipboard, cookie, or raw extension-message access.
- Remibooru search sends only the explicit query/facets, bounded page size, and pagination cursor.
- Maker handoffs send only user-reviewed declared caption fields.
- Every composer, reply, attachment, and maker action begins with an explicit user control.

Publishing media to Remibooru is planned for 0.2.5 and is not part of the
0.2.4 Post-Factory surface.

See [Privacy and permissions](../getting-started/PRIVACY_AND_PERMISSIONS.md)
for the complete remote-service and storage summary.
