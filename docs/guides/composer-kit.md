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
- **reply** opens X's native reply composer without inserting or sending text.
- **milady**, **remilio**, and saved Custom phrases only type the selected text by default. Review and submit it with X’s normal controls.
- To enable immediate sending, open **Apps & Features → Post-Factory** and separately enable **Insert and send** for the desired template. The Custom toggle covers all saved Custom phrases. Turn the setting off to return to type-only.
- The host inserts at most once and sends at most once only after verifying the exact selected text in the newly opened reply dialog. Existing drafts or other open reply composers are left untouched; a changed phrase, revoked consent, or mismatch prevents sending. Quick replies never automatically Like a post.
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

milXdy 0.2.5 added an explicit **Publish to Remibooru** flow for a visible
X-hosted image selected from the context menu. The host keeps the selected
image behind a one-use, short-lived opaque handle; Post-Factory receives no
image URL or bytes. Review the public destination and tags before publishing.
If Remibooru requires browser verification or rejects direct contribution, use
the native uploader fallback instead; milXdy does not bypass verification.

See [Privacy and permissions](../getting-started/PRIVACY_AND_PERMISSIONS.md)
for the complete remote-service and storage summary.
