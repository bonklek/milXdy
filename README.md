# milXdy

milXdy is a beta Manifest V3 browser extension for X/Twitter. It combines several Remilia-oriented tools into one unpacked-extension build, one settings popup, one content bootstrap, and one local install flow.

This project is intended for GitHub beta distribution and local Chromium testing. It is not currently packaged through the Chrome Web Store, so users install it manually from source or from a release archive.

## Credits And Upstream Projects

milXdy integrates and adapts code, assets, behavior, or concepts from these upstream projects:

- **Miladymaxxer**: original repository `remiliacorp/miladymaxxer`.
- **RemiStats Extension**: original repository `erc1337-Coffee/remistats_extension`.

The local source snapshots used during integration live under `_sources/` in development checkouts, but `_sources/` is intentionally ignored by Git and is not part of the distributed extension build. Preserve upstream license notices when publishing release archives or source snapshots.

Other integrated or local feature areas include Remilia Wiki linking, Postreader/Tweet Reader, and Beetol Game. See `LICENSE` and the original upstream repositories for license details that apply to bundled or adapted code.

## Included Features

### Suite

Shared extension controls and beta status:

- Update status for GitHub beta releases.
- Performance diagnostics toggle.
- Diagnostics counters under the `Diag` tab.

### Remilia Wiki Links

Adds inline links to known Remilia Wiki concepts inside X/Twitter posts.

- Optional hover previews.
- Link count and low-confidence link limits.
- Custom link color.
- Debug mode for matching behavior.

### Postreader

Adds read-aloud controls for X/Twitter posts.

- Web Speech playback controls.
- Optional quote, hyperlink, link preview, image alt text, and OCR reading.
- Image alt/OCR text is read before the post text that captions the image.
- Autoplay modes.
- Highlight modes.
- Keyboard shortcuts.
- Optional local/custom HTTP TTS endpoints, depending on the current build settings.

### RemiNet Connector

Shows RemiStats badges and RemiNet actions for X/Twitter accounts.

- Fetches public RemiStats data from `https://api.remistats.net`.
- Shows score badges on supported X/Twitter account surfaces.
- Score, beetle-count, and poke icons can be enabled independently. All three icons are on by default.
- Optional hover tooltips.
- Optional sound effects and sound volume control.
- Adds the Remilia Beetol Game hunter panel for signed-in `remilia.net` users.
- Poke buttons use the RemiNet connector login from settings, target the matched RemiStats username, shake while sending, and switch to a live cooldown timer when RemiliaNET returns one.
- Login/logout controls in the settings popup.
- Panel color and dark/light mode settings.
- Passwords are sent directly to `www.remilia.net` for login and are not stored by milXdy.

### Miladymaxxer / Maxxer

Runs local avatar classification and applies Milady-specific UI effects.

- Bundled ONNX classifier runs locally through ONNX Runtime Web.
- Supports normal Milady mode, debug mode, and off mode.
- Tracks matched accounts, caught accounts, post-like XP, and collected avatar sightings.
- Manual Milady list and whitelist controls.
- Optional RemiStats beetle-user bridge.
- Tiered card themes and level badges.
- Legacy Miladymaxxer statistics import.

## Install From Source

Prerequisites:

- Node.js 20 or newer is recommended.
- Chrome, Brave, Edge, or another Chromium browser.
- Git, if cloning the repository directly.

Install:

```powershell
git clone https://github.com/bonklek/milXdy.git
cd milXdy
npm install
npm run build
```

Load in Chromium:

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Choose **Load unpacked**.
4. Select the `dist` folder created by `npm run build`.
5. Pin the extension if you want quick access to the popup.
6. Open `https://x.com` or `https://twitter.com` and refresh existing tabs.

After rebuilding from source, return to `chrome://extensions`, press the reload button on the milXdy extension card, and refresh open X/Twitter tabs. Existing content scripts and injected CSS stay loaded in already-open pages until those tabs refresh.

Extension settings and Beetol Game token login are stored in Chrome extension storage and should survive reloads, browser restarts, rebuilds, and normal manual updates as long as the same unpacked extension install is reloaded from the same stable folder. Removing the extension, loading a different folder as a new unpacked extension, or clearing extension site data can clear that storage.

## Install From A GitHub Release

If a release archive is provided:

1. Download the latest unpacked release archive from GitHub Releases.
2. Unzip it into a permanent folder. Do not install from Downloads if you clean that folder often.
3. Open `chrome://extensions`.
4. Enable **Developer mode**.
5. Choose **Load unpacked** and select the unzipped extension folder.
6. Refresh X/Twitter tabs.

Manual installs do not auto-update. The Suite tab checks the latest GitHub release and shows an update notice when the release tag is newer than the installed manifest version. To update, download or rebuild the latest release and reload the unpacked extension.

For release-archive installs, keep the unzipped folder stable and replace its contents in place before pressing reload. Loading a freshly unzipped folder as a second unpacked extension can create a different extension identity and lose local settings or login tokens.

## Update Check Setup For Maintainers

Before a public beta release, set the GitHub repository endpoint in:

- `src/shared/updateCheck.ts`

The public beta endpoint should be:

```ts
export const GITHUB_RELEASES_API_URL = "https://api.github.com/repos/bonklek/milXdy/releases/latest";
```

Release tags should be semantic versions with an optional `v` prefix, such as `v0.1.2`. The manifest version in `public/manifest.json` is the installed version used for comparison.

## Settings Menu Walkthrough

Open the extension icon to access the settings popup. The same UI is also registered as the extension options page.

### Suite

- **Update status**: shows whether the installed build is current against the configured GitHub release endpoint. Use the refresh button to check immediately.
- **Performance diagnostics**: stores lightweight counters in local extension storage. Leave off for normal use; enable when reporting performance or detection issues.

### Wiki

- **Remilia Wiki links**: enables/disables automatic wiki concept linking.
- **Wiki previews**: fetches previews on hover.
- **Debug mode**: exposes additional matching diagnostics.
- **Max links per post**: caps wiki links per post.
- **Max low-confidence links**: limits weaker matches.
- **Link color**: controls inline wiki-link color.
- **Grok workflow**: chooses between **One-shot draft** and **Socratic research**. One-shot pastes a complete draft request. Socratic opens Grok's full conversation view, waits for Grok's initial response to settle, then sends staged Wikitool-inspired prompts for scouting, source discovery, article planning, and final clean MediaWiki drafting.
- **Link later**: stores selected phrases for a templated new wiki page or a new section on an existing page.
- **Create Wiki entry with Grok**: on X/Twitter, right-click a post, profile, or selection and choose **Use this post as a jumping off point**, **Create a generic article prompt**, or **Create a profile article prompt**. The extension opens the native Grok actions panel, seeds a Remilia Wiki research/drafting prompt, and shows a draggable Remilia Wiki shortcut for the inferred page title on the left side of the page. It avoids overlapping the Beetol hunter widget. Use the shortcut after vetting Grok's copy-pasteable MediaWiki output.
- Grok prompts ask for a separate commit-summary line and tell Grok to remove render artifacts such as `[](grok_render_citation_card_json=...)` from the MediaWiki block.

### Reader

- **Postreader controls**: adds read-aloud buttons to posts.
- **Speech speed / volume**: controls playback rate and output volume.
- **Auto voice / Voice URI**: uses a suitable installed voice automatically or targets a specific voice.
- **TTS engine**: uses browser Web Speech or a custom HTTP endpoint.
- **Custom endpoint**: local HTTP TTS endpoint used when `Custom HTTP endpoint` is selected.
- **Custom timing**: enables endpoint-provided word/character timing or treats custom audio as audio-only.
- **Autoplay next / Autoplay mode**: continues reading visible posts or autoscrolls.
- **Skip promoted posts**: avoids reading ads.
- **End ding**: plays a short cue after each post.
- **Include quote posts / Fetch full quotes / Full quote display**: controls quote-post reading and display.
- **Include hyperlinks / Image alt text / Image OCR / Link previews**: controls extra content included in spoken text. Image alt/OCR text is read before the parent caption text when present.
- **Expand show-more**: opens truncated posts before reading.
- **Active post highlight / Body highlight**: controls visual reading highlights.
- **Player position / Read button placement**: controls where reader controls appear.
- **Use handles**: reads handles instead of display names.
- **Keyboard shortcuts**: sets next/previous/play/skip controls. Next paragraph keeps paragraph-jump behavior; Skip OCR cancels pending OCR or skips active image text; Next post skips active image text to the parent caption before advancing posts.

### RemiNet Connector

- **RemiNet connector badges**: enables/disables score badges.
- **Tooltips**: shows detailed RemiStats information on hover.
- **Sounds**: enables/disables RemiStats sound effects.
- **Sound volume**: controls RemiStats effect volume.
- **RemiNet connector icons**: enables/disables the score, beetle-count, and poke icon controls as a group.
- **Score icon / Beetle icon / Poke icon**: controls the three badge/action icons individually. Each is enabled by default.
- **Show Beetol hunt panel**: mounts the hover panel on X/Twitter and uses the same login as RemiNet pokes.
- **Session status**: shows whether the extension is signed in to `remilia.net`.
- **Login form**: signs in through the remilia.net password flow. Use **Username or email** plus password.
- **Open RemiliaNET SSO**: opens the normal RemiliaNET login page for accounts that require 2FA.
- **Retry session**: checks whether the browser RemiliaNET session can be used by the extension after SSO login.
- **Beetol color / Beetol mode**: controls the hunter panel style.

### Maxxer

- **Mode**:
  - `Milady effects`: applies normal match effects.
  - `Debug`: shows detection markers and scores.
  - `Off`: disables Maxxer behavior.
- **Sounds**: enables Maxxer interaction sounds.
- **Level badge**: shows account/player level indicators.
- **RemiStats beetle users**: treats accounts with RemiStats beetle stats as Maxxer matches.
- **Card theme**:
  - `Full`: all tier styling.
  - `No premium`: reduced premium tier styling.
  - `Silver only`: minimal silver styling.
  - `Off`: disables card theme styling.
- **Whitelist handles**: accounts exempted from normal scoring/XP behavior.
- **Manual Milady handles**: accounts forced into the Milady list even when detection would not match them.

### Diag

Shows beta counters for:

- Loaded feature bundles.
- Current Maxxer mode.
- Maxxer matches.
- Avatar checks and cache hits.
- Shared scanner activity.
- Detection queue state.
- Wiki link counts.

The Diag tab also includes beta feedback actions:

- **Report via GitHub** opens a prefilled bug issue.
- **Report via X** opens a short bug-report reply to the public feedback post.
- **LLM assisted** copies a Socratic bug-report prompt, opens the selected destination, and shows a notification. Paste the prompt into a chat model, answer its questions, then use the final report text in GitHub or X.

## Import Legacy Miladymaxxer Statistics

milXdy can import a JSON export from the original Miladymaxxer storage model. The importer accepts these keys at the JSON root or under a `storage` object:

- `stats`
- `matchedAccounts`
- `collectedAvatars`
- `accounts`
- `avatars`
- `detectionStats`

The import merges data with the current milXdy data. It does not erase existing milXdy stats.

### Export From The Old Miladymaxxer Extension

1. Keep the old Miladymaxxer extension installed.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Find the old Miladymaxxer extension.
5. Click **service worker**, **background page**, or **Inspect views**, depending on the browser.
6. In the DevTools console for that extension, run:

```js
chrome.storage.local.get(null, (local) => {
  chrome.storage.sync.get(null, (sync) => {
    const payload = {
      exportedAt: new Date().toISOString(),
      source: "legacy-miladymaxxer",
      storage: {
        ...local,
        ...sync,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "legacy-miladymaxxer-storage.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
});
```

If the download is blocked from the service worker console, run this fallback and copy the printed JSON into a local `.json` file:

```js
chrome.storage.local.get(null, (local) => {
  chrome.storage.sync.get(null, (sync) => {
    console.log(JSON.stringify({
      exportedAt: new Date().toISOString(),
      source: "legacy-miladymaxxer",
      storage: { ...local, ...sync },
    }, null, 2));
  });
});
```

### Import Into milXdy

1. Open the milXdy extension popup.
2. Go to **Maxxer** and confirm Maxxer is enabled.
3. If your build exposes the dedicated Maxxer stats/accounts view, open **Stats**.
4. Choose **Import legacy stats**.
5. Select the JSON file exported from the old Miladymaxxer extension.
6. Reopen the Maxxer stats/accounts view and verify counts and accounts appear.
7. Refresh X/Twitter tabs.

### Manual Import Fallback

Use this if your build does not expose the **Import legacy stats** button.

1. Open `chrome://extensions`.
2. Find the milXdy extension.
3. Click **service worker** or **Inspect views** for milXdy.
4. Open the exported `legacy-miladymaxxer-storage.json` in a text editor.
5. Copy the full JSON.
6. In the milXdy extension DevTools console, run this with the copied JSON assigned to `legacyPayload`:

```js
const legacyPayload = /* paste legacy JSON here */;
const source = legacyPayload.storage || legacyPayload;
const localKeys = {};
for (const key of ["stats", "matchedAccounts", "collectedAvatars", "playerStats"]) {
  if (source[key]) localKeys[key] = source[key];
}
const syncKeys = {};
for (const key of ["mode", "whitelistHandles", "miladyListHandles", "soundEnabled", "showLevelBadge", "cardTheme"]) {
  if (source[key] !== undefined) syncKeys[key] = source[key];
}
chrome.storage.local.set(localKeys, () => {
  chrome.storage.sync.set(syncKeys, () => {
    console.log("Legacy Miladymaxxer data imported into milXdy.");
  });
});
```

Then reopen the milXdy popup and refresh X/Twitter tabs.

If the imported file appears to do nothing, confirm the JSON includes at least one of `stats`, `matchedAccounts`, or `collectedAvatars` at the root or inside `storage`.

## General Usage Guidelines

- Refresh X/Twitter tabs after installing, updating, or changing major feature toggles.
- Keep only the features you actively use enabled during beta testing.
- Enable diagnostics only while debugging or preparing a report.
- Use Maxxer debug mode when checking whether avatar detection is working.
- Use RemiStats tooltips sparingly on long sessions if you are investigating performance.
- Do not delete the folder used for **Load unpacked**. Chromium needs that folder to remain in place.
- When manually updating, reload the extension from `chrome://extensions` and refresh X/Twitter tabs.

## Privacy And Network Notes

- The extension runs only on the hosts listed in `public/manifest.json`.
- GitHub update checks call `https://api.github.com` when configured.
- RemiStats calls `https://api.remistats.net` for public reputation data.
- Remilia Wiki previews call `https://wiki.remilia.org`.
- Grok wiki prompts are pasted into X's native Grok interface from the current X/Twitter page. The extension also opens `https://wiki.remilia.org/index.php` when the post-Grok new-page shortcut is clicked.
- Beetol Game login and actions call `https://www.remilia.net`.
- Postreader OCR and Miladymaxxer avatar inference run locally in the extension context.
- Beetol Game access and refresh tokens are stored in local Chrome extension storage under namespaced keys.
- Stored Beetol Game tokens persist across extension service-worker restarts, browser restarts, extension reloads, and ordinary updates that keep the same extension identity. The extension refreshes access tokens from the stored refresh token when possible.
- Passwords entered in the Beetol Game login form are not stored by milXdy.
- Browser-session SSO depends on RemiliaNET cookies in the user's browser profile. Those cookies are controlled by the browser and RemiliaNET, not by milXdy, and may expire independently of extension storage.
- RemiNet connector actions mirror RemiliaNET's own client by setting the short-lived `authToken` cookie from the RemiNet connector access token before API calls, then sending requests with cookies included. This is why the extension requests the browser `cookies` permission.
- Accounts with RemiliaNET 2FA cannot complete the password-grant popup login. Use **Open RemiliaNET SSO**, finish login in the RemiliaNET tab, then return and use **Retry session**. If RemiliaNET does not allow its beetle APIs through browser session cookies, those accounts will need a future OAuth authorization-code/PKCE integration from RemiliaNET rather than the password flow.
- The popup may show the last RemiNet poke diagnostic in the RemiNet connector tab. It is stored locally and is intended for beta debugging.

## Development

Install and verify:

```powershell
npm install
npm run typecheck
npm run build
```

Watch mode:

```powershell
npm run dev
```

The build emits:

- `dist/content.js`
- `dist/background.js`
- `dist/popup.js`
- `dist/features/wiki.js`
- `dist/features/postreader.js`
- `dist/features/remistats.js`
- `dist/features/miladymaxxer.js`
- `dist/features/beetol.js`
- `dist/worker.js`
- `dist/ocr.html`
- `dist/ocrHost.js`

Disabled feature bundles should not be downloaded or parsed on initial page load. The build script includes smoke checks to keep large feature implementation strings out of the bootstrap.

## Agent-Guided Setup

For users who want another coding/browser agent to walk through setup, use:

- `docs/AGENT_SETUP_GUIDE.md`

That guide gives an agent exact commands, browser checks, migration steps, and completion criteria.

For a user-focused walkthrough, use:

- `docs/USER_GUIDE.md`

For maintainers reviewing whether feature changes are documented, use:

- `docs/CHANGE_INVENTORY.md`

## Troubleshooting

- **Extension does not appear**: make sure `npm run build` completed and that you selected `dist`, not the repository root.
- **Changes did not apply**: reload the extension on `chrome://extensions`, then refresh X/Twitter tabs.
- **Update status fails**: confirm `src/shared/updateCheck.ts` points to a real public GitHub repository with releases.
- **RemiNet connector badges missing**: confirm RemiNet connector badges are enabled and `https://api.remistats.net` is reachable.
- **Poke icon missing**: confirm **RemiNet connector icons** and **Poke icon** are enabled, reload the extension from `chrome://extensions`, then refresh the affected X/Twitter tab.
- **Maxxer seems inactive**: set mode to `Debug`, refresh X/Twitter, and check the `Diag` tab for loaded bundles and detection queue state.
- **Legacy stats import failed**: validate the JSON file and confirm it contains legacy Miladymaxxer storage keys.
- **Postreader OCR stuck at 5%**: rebuild and reload the unpacked extension, then confirm `dist/ocr.html` and `dist/ocrHost.js` exist. The 5% stage means the hidden OCR host page is loading.
- **Postreader OCR is intermittent**: OCR runs locally through Tesseract and can miss stylized, low-resolution, or low-contrast image text. The reader reports whether OCR found characters before playback starts.

## Postreader Custom TTS

Postreader can use the built-in browser Web Speech engine or a user-provided HTTP TTS endpoint. Configure this under the Reader settings:

- **TTS engine**: choose `Browser Web Speech` or `Custom HTTP endpoint`.
- **Custom endpoint**: URL such as `http://localhost:8787/speak`.
- **Custom timing**: choose endpoint boundaries for synced highlighting or audio-only mode.

Custom HTTP is intended for users who want to bring their own local TTS bridge, such as Piper, Kokoro, a native app, or another engine. milXdy does not ship those integrations; it sends text chunks to the configured endpoint and plays the audio response.

The custom endpoint receives `POST` JSON:

```json
{
  "text": "Text chunk to read",
  "rate": 1,
  "volume": 1,
  "voiceURI": null
}
```

It should return either an `audioUrl` or base64 audio. `audioUrl` may point to the same local service:

```json
{
  "audioUrl": "http://localhost:8787/audio/abc.mp3",
  "boundaries": [
    { "charIndex": 0, "charLength": 4, "elapsedTime": 0.05 }
  ]
}
```

For base64 audio, return `audioBase64` and optionally `audioContentType`:

```json
{
  "audioBase64": "SUQz...",
  "audioContentType": "audio/mpeg"
}
```

Timing rules:

- `boundaries` are optional. Without them, custom TTS is audio-only.
- `charIndex` and `charLength` are relative to the exact `text` chunk in the request, not the whole post.
- `elapsedTime` is seconds from the start of the returned audio.
- Word/smooth body highlighting is synced only when custom timing is set to endpoint boundaries and at least one valid boundary is returned.
- Active-post highlighting still works for audio-only custom engines.

Local service notes:

- The manifest allows custom endpoints on `http://localhost/*` and `http://127.0.0.1/*`.
- The endpoint must accept `POST` JSON.
- If the service returns an `audioUrl`, that URL must be reachable by the extension and should provide a browser-playable audio type such as MP3, WAV, OGG, or WebM.
- If CORS is enforced by the local service, allow the extension origin or use permissive local development headers.

## License

VPL for this repository unless otherwise noted. Upstream and bundled dependencies may carry their own license terms; preserve attribution and notices for Miladymaxxer, RemiStats Extension, and other integrated source material.

```text
VIRAL PUBLIC LICENSE
Copyleft (ɔ) All Rights Reversed

This WORK is hereby relinquished of all associated ownership, attribution and copy rights, and redistribution or use of any kind, with or without modification, is permitted without restriction subject to the following conditions:

1. Redistributions of this WORK, or ANY work that makes use of ANY of the contents of this WORK by ANY kind of copying, dependency, linkage, or ANY other possible form of DERIVATION or COMBINATION, must retain the ENTIRETY of this license.
2. No further restrictions of ANY kind may be applied.

Fully permissive, viral software license. The VPL is designed to achieve and extend the GPL's strong copyleft without the burden of its obligations and restrictions. The VPL's sole restriction is its own viral continuity, allowing it to effectively and permanently infect any work it touches with absolute permissiveness.
```
