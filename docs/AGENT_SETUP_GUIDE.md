# milXdy Agent Setup Guide

Use this guide when a user asks an assistant or browser automation agent to install, verify, update, or migrate milXdy. The agent should walk the user through the process and stop at each point where browser UI or a file picker requires user action.

## Goals

The setup is complete when:

- Dependencies install successfully.
- `npm run typecheck` passes.
- `npm run build` passes.
- Chromium loads the `dist` folder as an unpacked extension.
- The milXdy popup opens.
- An X/Twitter tab loads the content bootstrap.
- The desired feature toggles are configured.
- Legacy Miladymaxxer statistics are imported, if requested.

## Repository Checks

From the repository root, run:

```powershell
Get-Location
Get-ChildItem package.json, public\manifest.json, scripts\build.mjs
npm --version
node --version
```

Expected:

- Current directory is the milXdy repository.
- `package.json`, `public/manifest.json`, and `scripts/build.mjs` exist.
- Node and npm are available.

If Node is missing, pause and ask the user to install Node.js 20 or newer.

## Build Checks

Run:

```powershell
npm install
npm run typecheck
npm run build
```

Expected:

- `typecheck` exits successfully.
- `build` exits successfully.
- `dist\manifest.json`, `dist\content.js`, `dist\background.js`, `dist\popup.js`, and `dist\worker.js` exist.

Verify:

```powershell
Get-ChildItem dist\manifest.json, dist\content.js, dist\background.js, dist\popup.js, dist\worker.js
```

If build fails, inspect the first TypeScript or esbuild error and fix that before continuing. Do not ask the user to load a stale `dist` build after a failed build.

## Browser Install Walkthrough

Ask the user to open Chromium and complete these steps:

1. Navigate to `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository `dist` folder.
5. Pin the extension if desired.

Checks to ask the user to confirm:

- The extension card name is `milXdy`.
- No red error card appears.
- The extension popup opens when clicking the toolbar icon.

If the extension was already installed:

1. Go to `chrome://extensions`.
2. Press the reload button on the milXdy card.
3. Refresh X/Twitter tabs.

## Update-Check Configuration

Before a beta release, inspect:

```powershell
Select-String -Path src\shared\updateCheck.ts -Pattern GITHUB_RELEASES_API_URL
```

Confirm it points at the public beta repository:

```ts
export const GITHUB_RELEASES_API_URL = "https://api.github.com/repos/bonklek/milXdy/releases/latest";
```

After changing it, rerun:

```powershell
npm run typecheck
npm run build
```

The user-facing check is in the popup **Suite** tab. It should show current status and a refresh button.

## X/Twitter Runtime Check

Ask the user to open or refresh:

- `https://x.com`
- or `https://twitter.com`

Then ask them to open the milXdy popup and check:

- **Suite**: diagnostics can be toggled.
- **Diag**: loaded bundles eventually lists enabled feature bundles after visiting X/Twitter.
- **Maxxer**: mode is not `Off` if they want Maxxer.
- **RemiStats**: badges are enabled if they want RemiStats.

For a deeper check, ask the user to enable **Suite > Performance diagnostics**, refresh X/Twitter, scroll briefly, then open **Diag** and confirm counters change.

## Recommended First-Time Settings

For most beta users:

- Suite: diagnostics off unless debugging.
- Wiki: links on, previews on.
- Reader: controls on, Browser Web Speech unless the user has a local TTS service, OCR off unless needed.
- RemiStats: badges on, tooltips on, sounds by preference.
- Maxxer: mode `Milady effects`, sounds by preference, level badge on, RemiStats beetle users on.
- beXtol: leave off unless the user intends to use the hunter panel.

If performance is poor:

- Disable Reader OCR.
- Disable Wiki previews.
- Disable RemiStats tooltips.
- Set Maxxer to `Off` to isolate whether detection is the cause.
- Enable diagnostics, reproduce briefly, then collect `Diag` values.

## Custom TTS Setup Check

Use this only if the user wants Postreader to call a local TTS service.

Ask the user for the local endpoint URL, usually similar to:

```text
http://localhost:8787/speak
```

Then guide them:

1. Open milXdy popup.
2. Go to **Reader**.
3. Set **TTS engine** to `Custom HTTP endpoint`.
4. Set **Custom endpoint** to the local service URL.
5. Set **Custom timing** to `Endpoint boundaries` only if the service returns boundary timing.
6. Start Postreader playback on a short post.

Expected endpoint request:

```json
{
  "text": "Text chunk to read",
  "rate": 1,
  "volume": 1,
  "voiceURI": null
}
```

Expected response must include either `audioUrl` or `audioBase64`. Optional `boundaries` entries should include `charIndex`, `charLength`, and `elapsedTime`.

## Legacy Miladymaxxer Statistics Migration

Use this only if the user previously used the original Miladymaxxer extension and wants to keep local stats.

### Export From Old Extension

Guide the user:

1. Keep the old Miladymaxxer extension installed.
2. Open `chrome://extensions`.
3. Enable **Developer mode**.
4. Find the old Miladymaxxer extension.
5. Click its **service worker**, **background page**, or **Inspect views** link.
6. In that extension DevTools console, run:

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

If the browser blocks the download, have them run:

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

Then save the printed JSON as `legacy-miladymaxxer-storage.json`.

### Validate The Export

The JSON should include at least one of these keys at the root or under `storage`:

- `stats`
- `matchedAccounts`
- `collectedAvatars`
- `accounts`
- `avatars`
- `detectionStats`

If none are present, the user probably inspected the wrong extension or the old extension has no stored stats.

### Import Into milXdy

Guide the user:

1. Open the milXdy popup.
2. Confirm **Maxxer** is enabled.
3. Open the Maxxer stats/accounts interface if the current build exposes it.
4. Choose **Import legacy stats**.
5. Select `legacy-miladymaxxer-storage.json`.
6. Confirm stats/accounts appear after import.
7. Refresh X/Twitter.

Expected merge behavior:

- Existing milXdy stats are preserved.
- Numeric counters keep the larger value.
- Account entries merge by normalized handle.
- Avatar entries merge by normalized avatar URL.

### Manual Import Fallback

Use this if the current build does not expose **Import legacy stats**.

Guide the user:

1. Open `chrome://extensions`.
2. Find the milXdy extension.
3. Click **service worker** or **Inspect views** for milXdy.
4. Open `legacy-miladymaxxer-storage.json` in a text editor.
5. Copy the full JSON.
6. In the milXdy extension DevTools console, paste this with the copied JSON assigned to `legacyPayload`:

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

Then ask the user to reopen the popup, check Maxxer state, and refresh X/Twitter.

## Feature Verification Checklist

Use the checks relevant to the user's enabled features.

### Wiki

- Open a post likely to contain Remilia Wiki concepts.
- Confirm inline links appear.
- Hover a link if previews are enabled.

### Reader

- Confirm read controls appear on posts.
- Start playback and confirm speech begins.
- Test pause/play and next/previous shortcuts if configured.

### RemiStats

- Confirm badges appear beside supported account surfaces.
- Hover a badge if tooltips are enabled.
- If badges do not appear, check network access to `https://api.remistats.net`.

### Maxxer

- Set mode to `Debug`.
- Refresh X/Twitter and scroll.
- Confirm debug markers or scores appear on processed account surfaces.
- Return to `Milady effects` after verification.

### beXtol

- Enable beXtol Hunter panel.
- Log in from the popup if needed.
- Confirm the panel mounts on X/Twitter.
- If 2FA is required, explain that this popup login flow does not support it.

## Troubleshooting Script

If the user reports "nothing works", collect:

```powershell
npm run typecheck
npm run build
Get-ChildItem dist
Get-Content public\manifest.json
```

Ask the user to check:

- Does `chrome://extensions` show milXdy loaded from the expected `dist` folder?
- Does the extension card show errors?
- Did they refresh X/Twitter after loading/reloading?
- Are desired features enabled in the popup?
- Does the **Diag** tab show loaded feature bundles after visiting X/Twitter?

## Handoff Summary Template

Use this summary when handing back to the user:

```text
Setup status:
- Dependencies:
- Typecheck:
- Build:
- Extension loaded:
- X/Twitter refreshed:
- Enabled features:
- Legacy stats imported:
- Remaining issue:
```
