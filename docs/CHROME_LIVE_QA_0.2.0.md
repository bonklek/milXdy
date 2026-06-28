# milXdy 0.2.0 Chrome Live QA Handoff

Use this validation guide when testing the rebuilt Chromium extension on a real X/Twitter tab. The automated release checks prove the build contents; this guide proves Chrome is actually running that build.

## Reload The 0.2.0 Build

1. Run `npm run build:chromium:full` or `npm run build:profiles`.
2. Open `chrome://extensions`.
3. Find the existing milXdy extension card.
4. Confirm the loaded folder points at this repository's `dist/chromium` folder.
5. Click **Reload** on that existing card. Do not remove the extension or load a second unpacked folder unless resetting storage is intentional.
6. Refresh every open X/Twitter tab.

If the extension card points at another folder, either rebuild that folder from the same commit or intentionally switch Chrome to `dist/chromium` and record that storage may reset.

## Runtime Probe

1. Run `npm run print:live-probe:020`.
2. Paste the emitted snippet into the X/Twitter page console.
3. Copy `window.__milxdy020LiveProbe` into [QA_LOG_0.2.0.md](QA_LOG_0.2.0.md).
4. Run `npm run verify:live-probe:020`.

Passing proof requires:

- `status: "passed"`
- `version: "0.2.0"`
- `buildTarget: "chromium"`
- `buildProfile` matches the loaded profile, usually `full` for `dist/chromium`
- `performanceMode` is one of `fast`, `balanced`, `full`, or `developer`
- `missingRequired` is empty
- `present.overlayDockRoot` is `true`

Blocked proof must include:

- the full `window.__milxdy020LiveProbe` object
- whether the extension card was reloaded
- whether the loaded folder was confirmed as `dist/chromium`
- any visible Chrome extension error from the milXdy card

## Follow-On Smoke

After the runtime probe passes:

- Open Apps and confirm `present.appHubRuntime` and `present.appHubRuntimeState` become `true` after rerunning the probe, and that the Apps Hub runtime summary matches the active Performance mode.
- Pin and open Wiki in a Balanced or Full build.
- Pin and open Miladychan Portal and load at least one board plus one thread.
- Pin and open Music in Chromium and confirm local folder handling reaches the folder picker or the expected browser limitation state.
- Keep promotional planning outside this public QA guide.
