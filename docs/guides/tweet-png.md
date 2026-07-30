# Share Kit — Tweet PNG

Share Kit owns the reviewed local Tweet PNG workflow. The base milXdy client owns only the generic contextual post-action, lifecycle, storage, and package-review seams.

## Export a post

1. Open an X/Twitter post share menu and choose **Review with Share Kit**.
2. Review the rendered PNG. Video posts use the available thumbnail with a play icon overlay; the export never embeds or starts a video.
3. Use **Copy PNG** or **Download** from the top action row.

**Share** is deliberately disabled until a compatible live RemiNet client is present. Share Kit does not substitute browser share, upload through an undeclared endpoint, or transmit anything automatically.

## Preview settings

Use the settings-wheel button in the preview header to change:

- background and font color, including Paper, Lavender, Night, and Contrast presets;
- whether post images are included;
- whether quoted-post text is included;
- whether quoted-post images are included.

Changes update the preview and save as defaults. Existing date, RemiStats, border, palette, and tall-image settings remain available in Apps & Features and remain part of visual/profile packs.

## Upgrade, disable, downgrade, and rollback

- Share Kit intentionally retains the technical package ID `tweetPng` and the existing `tweetPng.*` setting IDs. A reviewed replacement shadows that ID, so old and new actions cannot both register.
- Upgrading reads the existing `milxdy.settings.reskinProfile` and `milxdy.settings.visualTheme` values. It does not reset or delete them.
- Disabling Share Kit removes its contextual action but preserves all visual/profile values.
- A build without the package shows Share Kit as unavailable and exposes no broken fallback action. Rebuild with the reviewed package to recover it.
- Downgrading to a legacy build restores that build's legacy exporter and reads the same retained visual/profile values. Legacy builds do not understand the newer Share Kit enablement or color controls.
- Rolling back the package composition removes the package action without deleting settings; restoring the reviewed package restores the action and saved values.

The package renders selected post content locally only after explicit user action. No PNG is sent automatically.
