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

## Worktree handoff MVP

The handoff commands let an implementation worktree provide one uncommitted tracked diff to a separate QA host without creating a feature commit or switching the Chrome extension to another unpacked folder.

From the implementation worktree:

```powershell
npm.cmd run qa:submit
```

The command records `HEAD` as the handoff base and captures staged and unstaged changes to tracked paths as a full-index binary patch. A staged new file is included; an untracked file is rejected with an exact path because this MVP deliberately does not package untracked content. Use `git add <path>` for an intended new file; no commit is required.

The single pending handoff lives under `milxdy-qa-handoff` in the repository's common local Git directory. Every worktree for the repository can see it, but it cannot be committed. A second submission stops rather than replacing the first; use `npm.cmd run qa:submit -- --replace` only when intentionally superseding that pending handoff.

On the QA host, stop `qa:watch`, then run:

```powershell
npm.cmd run qa:apply-next
```

`qa:apply-next` requires the submitted base to be an ancestor of the QA host's `HEAD`. For every changed path, it also requires the QA host content to match the exact blob from the submitted base. It reports the first stale or overlapping file and stops; it does not merge, reorder, or resolve anything.

For a clean handoff, the command temporarily applies the patch, invokes the existing one-shot `qa:build` implementation, and restores the QA host source afterward. The generated QA output remains in place for Chrome and its `qa-build.json` describes the temporarily composed source that was actually built. If apply or build fails, the prior QA output is preserved, the QA host source is restored, and the handoff remains pending for inspection or replacement.

Check the one-slot state with:

```powershell
npm.cmd run qa:status
```

After a successful build, use the popup reload fallback described below. Restart `qa:watch` only for subsequent edits made directly in the QA host; stop it again before another `qa:apply-next`.

This is intentionally a single-handoff MVP. It has no multi-item queue, automatic conflict resolution, hidden branch integration, durable scheduler, or generalized rollback manager. Later tooling may add an explicit reviewed queue and richer rollback history if the workflow demonstrates that need.

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
npm.cmd run verify:qa-handoff
npm.cmd run typecheck
```

`verify:qa-reload` checks debounce behavior, coordinator mismatch signaling, QA artifact injection, and preservation of a sentinel last-known-good folder across a deliberately failed build. It does not launch or control external Chrome.

`verify:qa-handoff` checks tracked-diff capture, shared pending status, clean application and source restoration, exact overlap rejection, build-failure restoration, and rejection of untracked files. It uses temporary Git worktrees and does not build or control external Chrome.

To stop watch mode, press `Ctrl+C`. The promoted `dist/qa-chromium` output remains available and is ignored by Git. Delete it manually only when Chrome is no longer using it.
