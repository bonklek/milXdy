# Share Kit — Tweet PNG

Share Kit owns the reviewed local Tweet PNG workflow. The base milXdy client owns only the generic contextual post-action, lifecycle, storage, and package-review seams.

Share Kit is a selectable reviewed first-party replacement in the 0.2.4
Add-ons Catalog. Selecting it preserves the stable `tweetPng` identity; review
the replacement acknowledgement during the local Prepare/Apply workflow.

## Export a post

1. Open an X/Twitter post share menu and choose **Share as PNG**.
2. Review the rendered PNG. Video posts use the available thumbnail with a play icon overlay; the export never embeds or starts a video.
3. Use **Copy PNG** or **Download** from the top action row.

When the RemiNet browser session is offline, **Reconnect** opens the fixed
RemiliaNET session page in an inactive tab and **Refresh** only retests that
session. Once connected, those controls are replaced by **Share to RemiNet**.
That action stages the reviewed PNG as a pending local attachment and opens the
existing RemiNet Chat rail app. The image is not uploaded until the user
explicitly presses Send in Chat.

## Preview settings

Use the settings-wheel button in the preview header to change:

- background and font color, including Paper, Lavender, Night, and Contrast presets;
- whether post images are included;
- whether quoted-post text is included;
- whether quoted-post images are included;
- whether the default-on **milXdy** watermark appears in the lower-right pink margin.

Visible external links can render as themed link cards, and quoted-post context
remains part of the preview rather than being flattened into the main post.

Changes update the preview and save as defaults. The watermark setting is preserved with visual/profile packs. Existing date, RemiStats, border, palette, and tall-image settings remain available in Apps & Features and remain part of visual/profile packs.

## Upgrade, disable, downgrade, and rollback

- Share Kit intentionally retains the technical package ID `tweetPng` and the existing `tweetPng.*` setting IDs. A reviewed replacement shadows that ID, so old and new actions cannot both register.
- Upgrading reads the existing `milxdy.settings.reskinProfile` and `milxdy.settings.visualTheme` values. It does not reset or delete them.
- Disabling Share Kit removes its contextual action but preserves all visual/profile values.
- A build without the package shows Share Kit as unavailable and exposes no broken fallback action. Rebuild with the reviewed package to recover it.
- Downgrading to a legacy build restores that build's legacy exporter and reads the same retained visual/profile values. Legacy builds do not understand the newer Share Kit enablement or color controls.
- Rolling back the package composition removes the package action without deleting settings; restoring the reviewed package restores the action and saved values.

The package renders selected post content locally only after explicit user action. No PNG is sent automatically.
