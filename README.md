# milXdy

milXdy is a beta Manifest V3 browser extension for X/Twitter. It combines several Remilia-oriented tools into one unpacked-extension build, one settings popup, one content bootstrap, and one local install flow.

This project is intended for GitHub beta distribution and local Chromium testing. It is not currently packaged through the Chrome Web Store.

## Features

- **Remilia Wiki Links**: inline Remilia Wiki concept links, hover previews, Link Later, and Grok-assisted wiki drafting workflows.
- **Postreader**: read-aloud controls for X/Twitter posts with optional quote, link, image alt text, OCR, and custom local TTS support.
- **RemiNet Connector**: RemiStats badges, score/beetle/poke icons, RemiliaNET pokes, incoming poke indicators, optional RemiNet Chat, and tooltip/sound options.
- **Beetol Game**: Beetol hunter panel and RemiliaNET login shared with RemiNet actions.
- **Maxxer**: local avatar classification, Milady effects, tiered card themes, level badges, and legacy Miladymaxxer import.
- **Diag**: beta diagnostics and bug-report actions for GitHub or X.

## Quick Install

For release builds:

1. Download the latest release zip from [GitHub Releases](https://github.com/bonklek/milXdy/releases).
2. Unzip it into a permanent folder.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the unzipped extension folder.
6. Refresh X/Twitter tabs.

For source builds:

```powershell
git clone https://github.com/bonklek/milXdy.git
cd milXdy
npm install
npm run build
```

Then load the generated `dist` folder from `chrome://extensions`.

Important: keep the same loaded extension folder when updating. Removing the extension or loading a different folder can reset local settings, Maxxer stats, diagnostics, and RemiNet/Beetol login state.

## Documentation

- [Docs index](docs/INDEX.md)
- [Install and update](docs/INSTALL_AND_UPDATE.md)
- [User guide](docs/USER_GUIDE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Privacy and permissions](docs/PRIVACY_AND_PERMISSIONS.md)
- [Roadmap](docs/ROADMAP.md)
- [Contributing](docs/CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Development

```powershell
npm install
npm run typecheck
npm run build
```

Release history is in [CHANGELOG.md](CHANGELOG.md).

## Credits And Upstream Projects

milXdy integrates and adapts code, assets, behavior, or concepts from these upstream projects:

- **Miladymaxxer**: original repository `remiliacorp/miladymaxxer`.
- **RemiStats Extension**: original repository `erc1337-Coffee/remistats_extension`.

Other integrated or local feature areas include Remilia Wiki linking, Postreader/Tweet Reader, and Beetol Game. Preserve upstream license notices when publishing release archives or source snapshots.

## License

VPL for this repository unless otherwise noted. Upstream and bundled dependencies may carry their own license terms. See [LICENSE](LICENSE).
