# milXdy 0.1.4 Release Notes

milXdy `0.1.4`, **The Aesthetic Update**, focuses on visual presets, custom themes, Remilia-style assets, and polish across RemiNet, Beetol, RemiNet Chat, and Maxxer.

## Highlights

- Added an **Appearance** tab for visual presets and theme controls.
- Added **Max**, **Medium**, **Minimal**, and **Custom** visual modes.
- Added saved custom themes, JSON import/export, and compact share strings.
- Added bundled Remilia font assets and X/Twitter reskin controls.
- Added PFP shape, media shape, button, sidebar, notification, feed-refresh, RemiStats, poke placement, RemiNet Chat overlay, and Maxxer visual controls.
- Added a short RemiNet poke sound that follows RemiStats sound settings.

## Added

### Appearance and themes

- Appearance settings search.
- Custom theme editor with theme base, layout/shape, interaction, RemiNet surface, and Maxxer visual sections.
- Theme save/delete controls.
- Theme JSON export/import.
- Copy/paste share strings for visual themes.
- Automatic X/Twitter tab refresh after applying visual theme changes.

### Visual presets

- **Max**: strongest Remilia/Milady reskin and Maxxer treatment.
- **Medium**: balanced Remilia/Milady styling while keeping X recognizable.
- **Minimal**: mostly original X appearance with restrained milXdy markers.

### X/Twitter reskin controls

- Remilia font selection for tweet text and UI chrome.
- Green page fade.
- Square media controls.
- Quote/media gap control.
- PFP shape controls for feed, notifications, and chat surfaces.
- Click-style post button behavior and optional post sound.
- Sidebar bevel and optional sidebar sound.
- Feed-refresh pill styling and optional sound.
- Unread notification tint.

### RemiNet, Beetol, and Maxxer polish

- RemiStats backing box toggle.
- Poke placement control.
- RemiNet Chat overlay toggle from Appearance.
- Maxxer intensity, separator, and shimmer controls.
- Milady-only mode.
- Disable self tracking option.
- RemiNet poke sound.
- Visual refresh for RemiNet Chat, RemiStats, Beetol, and Maxxer surfaces.

## Changed

- The old Milady Maxxer popup tab is now the broader **Appearance** tab.
- The build now copies bundled Remilia font assets into release output.
- The manifest now exposes `remilia-fonts/*` as web-accessible resources.
- The extension now requests `tabs` permission so the Appearance tab can refresh open X/Twitter tabs after theme changes.
- RemiliaNET 2FA retry docs now more clearly explain the browser-session fallback.

## Known Limits

- The visual reskin depends on X/Twitter DOM structure and may need maintenance after X layout changes.
- Custom themes are local extension data. Removing the unpacked extension or loading a different folder can reset them.
- Firefox support is not part of `0.1.4`; it is planned for a later release after branch integration and smoke testing.

## Updating Safely

Keep the same unpacked extension folder when updating. Replace files in place, reload the existing extension card, and refresh X/Twitter tabs.
