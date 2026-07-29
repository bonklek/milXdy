# milXdy 0.1.2 Release Notes

milXdy `0.1.2` expanded the beta with Beetol integration, RemiNet login improvements, richer RemiStats poke behavior, Remilia Wiki drafting helpers, and read-aloud/OCR polish.

## Highlights

- Added Beetol Game support inside the combined extension.
- Improved RemiNet login persistence and 2FA fallback through browser SSO retry.
- Added independent RemiStats score, beetle, and poke icon controls.
- Improved poke sending, cooldown display, and related diagnostics.
- Added Remilia Wiki Grok workflows, Link Later support, and a draggable new-page shortcut.
- Improved Post-reading OCR, image text ordering, quote handling, and custom TTS setup.
- Added Diag-tab bug reporting through GitHub or X, with optional LLM-assisted report drafting.
- Expanded user documentation for install, update, privacy, and troubleshooting.

## Known Limits

- Manual GitHub release installs do not auto-update; users must replace files and reload the unpacked extension.
- Loading a different unpacked folder can reset local settings and login state.
- RemiliaNET accounts with 2FA may need the browser SSO retry path.
- Grok workflows depend on X/Grok UI stability.
- OCR runs locally and can miss stylized, low-resolution, or low-contrast image text.

