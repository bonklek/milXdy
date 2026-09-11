# Install And Update

milXdy is currently distributed as a GitHub beta for local browser testing. It is not packaged through the Chrome Web Store or Firefox Add-ons.

## Install From A GitHub Release

For Chrome, Brave, or Edge, download `milXdy-0.2.5-chromium.zip`. This is the
authenticated Chromium beta profile: its pinned public manifest key preserves
extension ID `idlmhjcedjkmbkndigbiobfjadhlmgki` and the exact registered Remilia
callback `https://idlmhjcedjkmbkndigbiobfjadhlmgki.chromiumapp.org/remilia-oauth`.
The packaged public Login client ID is `tpa-milxdy`; it is an identifier, not a
secret, and no client secret or signing private key is included.
Firefox and Waterfox use `milXdy-0.2.5-firefox.zip`; that profile is keyless and
reports Remilia connection as unsupported while retaining non-auth behavior.

Lite, Balanced, and Full are setup choices inside milXdy, not separate install downloads.

1. Download the latest unpacked release archive from [GitHub Releases](https://github.com/bonklek/milXdy/releases). Use `milXdy-<version>-chromium.zip` for Chrome, Brave, and Edge, or `milXdy-<version>-firefox.zip` for Firefox or Waterfox 140 or newer beta testing.
2. Unzip it into a permanent folder. Do not install from Downloads if you clean that folder often.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the unzipped extension folder.
6. Refresh X/Twitter tabs.

Keep the Chromium archive on the same extension card. Loading a source
production build or maintainer QA build is not an equivalent beta identity and
cannot use the beta Remilia callback.

## Optional 0.2.5 add-ons

The normal release archive contains the base extension. The checked-in
[Add-ons Catalog](https://bonklek.github.io/milXdy/addons/) prepares a separate
Chromium custom build from reviewed local package sources:

- **Pets Maker** is the first selectable maintainer add-on and remains disabled after installation until enabled in **Apps & Features**.
- **Share Kit** is a selectable reviewed first-party replacement that preserves the existing Tweet PNG identity and settings.
- **Post-Factory** is documented as **Under review** and cannot yet be selected through the catalog Prepare/Apply workflow.

Follow [Local Add-ons](../sdk/LOCAL_ADDONS.md) from a matching 0.2.5 source
checkout. Load `dist/chromium-local-apps/` once and reload that same extension
card after later successful rebuilds. Do not load the custom build alongside the
normal build as a second extension.

## Firefox Beta Install

Firefox and Waterfox 140 or newer use the Firefox build. See [Firefox and Waterfox](../contributors/FIREFOX_QA.md) for installation notes and browser-specific limitations.

The 0.2.5 Firefox archive does not include Remilia Login. It must not offer a
cookie/session fallback; the popup reports the connection as intentionally
unsupported and leaves unrelated features available.

1. Download the latest `milXdy-<version>-firefox.zip` release archive.
2. Unzip it into a permanent folder.
3. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
4. Click **Load Temporary Add-on**.
5. Select the unzipped `manifest.json`.
6. Refresh X/Twitter tabs.

## Install From Source

Prerequisites:

- Node.js 24 and npm 11. The npm lockfile and `npm ci` define the supported build environment.
- Chrome, Brave, Edge, another Chromium browser, or Firefox/Waterfox 140 or newer for beta testing.
- Git, if cloning directly.

```powershell
git clone https://github.com/bonklek/milXdy.git
cd milXdy
npm ci
npm run build:profiles
```

For the release-equivalent authenticated Chromium beta profile, run
`npm run build:chromium -- --channel=beta` and load `dist/chromium-beta` from
`chrome://extensions`. The default `dist/chromium` source output is intentionally
keyless production and is not the Remilia Login beta client. Load
`dist/firefox/manifest.json` from Firefox or Waterfox 140 or newer's temporary
add-on screen for Firefox compatibility testing.

## Safe Manual Updates

Manual installs do not auto-update by themselves. The Suite tab checks the latest normal GitHub release and shows an update notice when the release tag is newer than the installed manifest version. Draft releases and prereleases are ignored on this normal update channel.

When an update is available:

1. Click **Download** in the Suite tab, or download the latest release archive from GitHub. The popup prefers the archive matching the installed browser target.
2. Optional: use **LLM** after copying **Steps** if you want the checklist opened in your configured assistant target. The steps are still copied to the clipboard so you can paste them manually if the site or desktop app blocks automatic paste.
3. Replace files in the same existing milXdy extension folder.
4. Do not remove milXdy from `chrome://extensions` or Firefox's temporary add-on list unless you are intentionally resetting the install.
5. Do not load a fresh folder as a second unpacked extension.
6. Click **Reload** in the milXdy popup or reload the existing extension card.
7. Refresh open X/Twitter tabs.

Keeping the same loaded folder preserves persistent extension storage, including
settings, Maxxer stats, and diagnostics. Remilia credentials use trusted session
storage and end when the extension reloads or updates, so reconnect from the
popup if needed. Removing the extension, loading a different folder, or
clearing extension storage can reset local data. After updating from 0.2.4 or
earlier, follow the one-time [Remilia account migration](REMILIA_ACCOUNT.md);
milXdy does not reuse the old browser-session connector.

## Source Updates

For source installs:

```powershell
git pull
npm ci
npm run build:profiles
```

Then reload the same existing milXdy extension card that points to
`dist/chromium-beta`, or reload the Firefox temporary add-on from
`dist/firefox/manifest.json`.
