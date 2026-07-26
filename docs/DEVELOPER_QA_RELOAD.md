# Developer QA reload loop

This tool is for maintainer-only Chromium QA. It does not change release packaging, store behavior, or the normal `npm run build:*` outputs.

## Stable unpacked folder

Build once:

```powershell
npm.cmd run qa:build
```

In Chrome, open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the absolute folder printed by the command. Its repository-relative location is always:

```text
dist/qa-chromium
```

Load that folder once and keep using the same extension card. Chrome storage is tied to that unpacked extension identity, so do not load a staging directory.

## Watch loop

```powershell
npm.cmd run qa:watch
```

The watcher waits 450 ms after the last source event, builds Chromium/full into a private staging directory, verifies it, and atomically promotes it to `dist/qa-chromium`. A compilation, validation, or promotion failure leaves the previous QA output untouched. If files change during compilation, the mixed build is discarded and a clean build is queued.

The QA-only background worker long-polls `127.0.0.1:7319`. After a successful promotion, it attempts to:

1. call `chrome.runtime.reload()` from the currently running QA worker;
2. let the newly loaded worker refresh all open `x.com` and `twitter.com` tabs.

This path uses extension APIs and the localhost permissions already present in milXdy. It does not use Codex's Browser sidebar, remote debugging, UI automation, or a separate Chrome profile.

Windows and Chrome may suspend a Manifest V3 worker or delay local resource pickup. Until the automatic path has passed real external-Chrome QA on the maintainer's machine, treat it as best-effort rather than guaranteed. The terminal reports only successful builds; it does not claim Chrome loaded them.

## Truthful build identity and one-action fallback

Every successful QA output contains `qa-build.json`. It records:

- the full Git commit and dirty state;
- a SHA-256 fingerprint of every tracked or unignored source file (including uncommitted and untracked files);
- build timestamp and unique build ID;
- target/profile, Node version, worktree, and stable output path.

The same object is compiled into the QA worker and popup helper. The popup's bright **DEVELOPER QA BUILD** panel asks the running background worker for its compiled identity, then compares that response with `qa-build.json` currently on disk. It does not assume that newly read popup files prove the worker reloaded. Chrome's extension card and toolbar title also say **milXdy QA**.

If automatic reload has not happened, the entire remaining action is:

> Open the milXdy QA popup and click **Load latest QA build + refresh X tabs**.

That button records the on-disk build expected after reload, calls the extension reload API, and lets the newly loaded worker refresh matching X/Twitter tabs. Reopen the popup to confirm **Running** and **On disk** show the same build ID and to see the X-tab refresh count.

If the popup itself cannot be opened, use Chrome's **Reload** button on the `milXdy QA` card; that Chrome recovery path cannot also refresh X tabs, so refresh those tabs manually afterward.

## Verification

```powershell
npm.cmd run qa:build
npm.cmd run verify:qa-reload
npm.cmd run typecheck
```

`verify:qa-reload` checks debounce behavior, coordinator mismatch signaling, QA artifact injection, and preservation of a sentinel last-known-good folder across a deliberately failed build. It does not launch or control external Chrome.

To stop watch mode, press `Ctrl+C`. The promoted `dist/qa-chromium` output remains available and is ignored by Git. Delete it manually only when Chrome is no longer using it.
