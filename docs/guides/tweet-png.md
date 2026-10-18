# Share Kit — Tweet PNG

Share Kit owns the reviewed local Tweet PNG workflow. The base milXdy client owns only the generic contextual post-action, lifecycle, storage, and package-review seams.

Share Kit is a selectable reviewed first-party replacement in the 0.2.5
Add-ons Catalog. Selecting it preserves the stable `tweetPng` identity; review
the replacement acknowledgement during the local Prepare/Apply workflow.

## Export a post

1. Open an X/Twitter post share menu and choose **Share as PNG**.
2. Review the rendered PNG. Video posts use the available thumbnail with a play icon overlay; the export never embeds or starts a video.
3. Use **Copy PNG** or **Download** from the top action row.

RemiNet PNG sharing is unavailable with the current API capabilities. Reconnecting or refreshing authorization cannot enable media upload or publishing. Download the reviewed PNG for manual sharing; **Visit RemiliaNET to share media** opens the native site without sending the image.

## Preview settings

Use **Settings** at the preview’s utility edge to customize this PNG. The entry moves to the right when the app rail is on the right. At wide sizes, settings and the preview sit side by side; narrow windows use a scrollable settings section above the preview. **Edit post text** and **Draw on PNG** expand their respective controls.

The settings include:

- background and font color, including Paper, Lavender, Night, and Contrast presets;
- whether post images are included;
- whether quoted-post text is included;
- whether quoted-post images are included;
- whether the default-on **milXdy** watermark appears in the lower-right pink margin.

Visible external links can render as themed link cards, and quoted-post context
remains part of the preview rather than being flattened into the main post.

The **Post text** editor is local to the open review. Select text (or place the
cursor in a word) to combine bold, italic, and strikethrough styles; select one
or more lines to toggle bullets. **Clear formatting** removes styles from the
selection, while **Reset text** restores the extracted post text and clears all
local formatting. The reviewed preview and annotation layer are composited into the PNG used by Copy,
Download, and user-initiated sharing; editor state is not saved to a profile or
sent back to X.
Post text, quoted-post text, and link-card titles use the exact-pinned Pretext
0.0.8 layout adapter for Unicode-aware local Canvas line breaking. This improves
CJK punctuation, Thai/Khmer and other no-space scripts, emoji/grapheme clusters,
and mixed bidirectional text without sending content to a layout service.

Choose a **Drawing tool** to add freehand strokes, lines, rectangles, ellipses,
arrows, translucent highlights, or annotation text. Choose the color and stroke
width; annotation text can be bold. The suggested palette derives locally from
already decoded avatar pixels when available, with an inspectable fallback.
You can override any suggested color. **Undo drawing**, **Redo drawing**, and
**Clear drawings** affect only this export. Focus the drawing canvas and use
arrow keys to move the last annotation, Shift+arrows to adjust its endpoint, or
Delete to remove it. Normalized drawing coordinates survive preview resizing;
in-memory drawings remain available when reopening the same visible post.
Closing an unfinished drawing retains it. Nothing is saved to a profile or
uploaded. Export actions wait for text and drawing updates to finish, and
**Copy PNG** confirms success with “Copied to clipboard”.

Settings changes affect the current PNG only. Independently show or hide display names and @handles, including those on quoted posts. Date, RemiStats, images, quoted text/images, tall-image fitting, border, palette, background, font color, and watermark are available inside Settings. The PNG keeps the existing fixed export resolution; fitting tall images changes media layout.

**Done** closes Settings, restores the full-width preview, and focuses **Copy PNG**. Escape closes Settings and returns focus to its entry point. Both keep the current export choices. **Restore saved defaults** discards temporary setting changes without changing edited text or drawings. **Save as defaults** explicitly saves the current settings for later exports, preserving unrelated Appearance settings. Closing the export discards unsaved settings. The identity settings are also represented in Apps & Features and visual/profile packs.

Hiding a name or handle changes rendered pixels, not the source record: milXdy retains the source identity internally for filenames and attribution. Filenames use the source handle, or `tweet` if unavailable. Avatars and post text may still identify the author, so these controls do not anonymize the post. All local PNG outputs use the exact reviewed image. Remote media upload remains unsupported; changing settings does not enable it.

## Upgrade, disable, downgrade, and rollback

- Share Kit intentionally retains the technical package ID `tweetPng` and the existing `tweetPng.*` setting IDs. A reviewed replacement shadows that ID, so old and new actions cannot both register.
- Upgrading reads the existing `milxdy.settings.reskinProfile` and `milxdy.settings.visualTheme` values. It does not reset or delete them.
- Disabling Share Kit removes its contextual action but preserves all visual/profile values.
- A build without the package shows Share Kit as unavailable and exposes no broken fallback action. Rebuild with the reviewed package to recover it.
- Downgrading to a legacy build restores that build's legacy exporter and reads the same retained visual/profile values. Legacy builds do not understand the newer Share Kit enablement or color controls.
- Rolling back the package composition removes the package action without deleting settings; restoring the reviewed package restores the action and saved values.

The package renders selected post content locally only after explicit user action. No PNG is sent automatically.
