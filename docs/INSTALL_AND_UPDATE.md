# Install And Update

milXdy is currently distributed as a GitHub beta for local browser testing. It is not packaged through the Chrome Web Store or Firefox Add-ons.

## Install From A GitHub Release

1. Download the latest unpacked release archive from GitHub Releases. Use `milXdy-<version>-chromium-full.zip`, `milXdy-<version>-chromium-balanced.zip`, or `milXdy-<version>-chromium-lite.zip` for Chrome, Brave, and Edge. Use the matching `firefox-full`, `firefox-balanced`, or `firefox-lite` zip for Firefox beta testing.
2. Unzip it into a permanent folder. Do not install from Downloads if you clean that folder often.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the unzipped extension folder.
6. Refresh X/Twitter tabs.

## Firefox Beta Install

Firefox support is packaged for beta testing, but it still needs manual smoke testing before being advertised as fully supported.

1. Download the latest `milXdy-<version>-firefox-full.zip`, `milXdy-<version>-firefox-balanced.zip`, or `milXdy-<version>-firefox-lite.zip` release archive.
2. Unzip it into a permanent folder.
3. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on**.
5. Select the unzipped `manifest.json`.
6. Refresh X/Twitter tabs.

See [Firefox QA](FIREFOX_QA.md) for the smoke-test checklist.

## Install From Source

Prerequisites:

- Node.js 20 or newer is recommended.
- Chrome, Brave, Edge, another Chromium browser, or Firefox for beta testing.
- Git, if cloning directly.

```powershell
git clone https://github.com/bonklek/milXdy.git
cd milXdy
npm install
npm run build:profiles
```

Then load `dist/chromium` from `chrome://extensions`, or load `dist/firefox/manifest.json` from `about:debugging#/runtime/this-firefox`. The same command also builds Lite and Balanced profile outputs under `dist/chromium-lite`, `dist/chromium-balanced`, `dist/firefox-lite`, and `dist/firefox-balanced`.

## Safe Manual Updates

Manual installs do not auto-update by themselves. The Suite tab checks the latest normal GitHub release and shows an update notice when the release tag is newer than the installed manifest version. Draft releases and prereleases are ignored on this normal update channel.

When an update is available:

1. Click **Download** in the Suite tab, or download the latest release archive from GitHub. The popup prefers the archive matching the installed browser target and build profile.
2. Optional: use **LLM** after copying **Steps** if you want the checklist opened in your configured assistant target. The steps are still copied to the clipboard so you can paste them manually if the site or desktop app blocks automatic paste.
3. Replace files in the same existing milXdy extension folder.
4. Do not remove milXdy from `chrome://extensions` or Firefox's temporary add-on list unless you are intentionally resetting the install.
5. Do not load a fresh folder as a second unpacked extension.
6. Click **Reload** in the milXdy popup or reload the existing extension card.
7. Refresh open X/Twitter tabs.

Keeping the same loaded folder preserves extension storage, including settings, Maxxer stats, diagnostics, and RemiNet/Beetol login state. Removing the extension, loading a different folder, or clearing extension storage can reset local data.

## Source Updates

For source installs:

```powershell
git pull
npm install
npm run build:profiles
```

Then reload the same existing milXdy extension card that points to `dist/chromium`, or reload the Firefox temporary add-on from `dist/firefox/manifest.json`.

