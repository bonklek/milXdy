# Install And Update

milXdy is currently distributed as a GitHub beta for local Chromium testing. It is not packaged through the Chrome Web Store.

## Install From A GitHub Release

1. Download the latest unpacked release archive from GitHub Releases.
2. Unzip it into a permanent folder. Do not install from Downloads if you clean that folder often.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the unzipped extension folder.
6. Refresh X/Twitter tabs.

## Install From Source

Prerequisites:

- Node.js 20 or newer is recommended.
- Chrome, Brave, Edge, or another Chromium browser.
- Git, if cloning directly.

```powershell
git clone https://github.com/bonklek/milXdy.git
cd milXdy
npm install
npm run build
```

Then load the generated `dist/chromium` folder as an unpacked extension from `chrome://extensions`.

## Safe Manual Updates

Manual installs do not auto-update by themselves. The Suite tab checks the latest GitHub prerelease and shows an update notice when the release tag is newer than the installed manifest version.

When an update is available:

1. Click **Download** in the Suite tab, or download the latest release archive from GitHub.
2. Replace files in the same existing milXdy extension folder.
3. Do not remove milXdy from `chrome://extensions`.
4. Do not load a fresh folder as a second unpacked extension.
5. Click **Reload** in the milXdy popup or reload the existing extension card.
6. Refresh open X/Twitter tabs.

Keeping the same loaded folder preserves Chrome extension storage, including settings, Maxxer stats, diagnostics, and RemiNet/Beetol login state. Removing the extension, loading a different folder, or clearing extension storage can reset local data.

## Source Updates

For source installs:

```powershell
git pull
npm install
npm run build
```

Then reload the same existing milXdy extension card that points to the same `dist/chromium` folder.

