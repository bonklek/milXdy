# Root Visual Enhancements User Guide

Root Visual Enhancements provides the baseline milXdy X/Twitter polish: visual profile choices, notification styling, sounds, and Tweet PNG entry points.

## Where To Find It

- Open the extension popup.
- Use **Main** for suite-level controls.
- Use **Appearance** for visual presets and theme intensity.

## Common Tasks

- Pick **Max**, **Medium**, or **Minimal** in Appearance to change the X/Twitter visual treatment.
- Use **Custom** to fine-tune the same theme after choosing a preset. Root X controls are grouped into page/typography, PFPs/media/cards, notifications, and navigation/actions.
- Reload open X/Twitter tabs after changing major visual settings.
- Use **Performance mode** separately from Appearance when you want to reduce background work.
- Leave **Performance diagnostics** off unless you are preparing a bug report.
- Notification tinting and reply/thread connector hints are part of the root X/Twitter visual treatment.
- App chrome, Tweet PNG, RemiStats/poke, and Maxxer controls in Appearance are mirrors that keep their current storage compatibility while app-owned settings continue moving to their own surfaces.

## Sharing Profiles

Saved visual themes and profile packs preserve the fine controls inside `milxdy.settings.visualTheme`. Profile packs include Appearance and Performance only; auth tokens, sessions, private account data, file paths, caches, and diagnostics are not exported or imported.

## Notes

Root Visual Enhancements reads the current X/Twitter page locally and uses stored appearance settings. It does not need a remote service for the core visual treatment.
