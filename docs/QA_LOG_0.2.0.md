# milXdy 0.2.0 QA Evidence Log

This log records concrete 0.2.0 release evidence. It complements the checklist in [QA_0.2.0.md](QA_0.2.0.md) and intentionally separates automated release readiness gates from optional live browser smoke-test status.

Status: release gates passing; live Chrome runtime smoke is optional manual QA and is not part of the 0.2.0 release readiness gate.

## Automated Gates

Last verified in this workspace:

- `npm run verify:release:gates:020`
- `npm run build:profiles`
- `npm run typecheck`
- `npm run verify:release:020`
- `npm run verify:app-smoke:020`
- `npm run verify:platform`
- `npm run verify:smoke:020`
- `npm run verify:url-allowlist`
- `npm run verify:music`
- `npm run lint:firefox`
- `npm run package:release`
- `npm run verify:release:checksums`

Additional 0.2.0 release asset evidence:

- `npm run verify:release:gates:020` passed after spawning the build subprocesses outside the default sandbox. It ran TypeScript, release contract verification, profile builds, platform verification, URL allowlist verification, Music build verification, Firefox lint, extension smoke, app smoke, release packaging, and checksum verification.
- Firefox lint was also run directly through the local `web-ext` dependency with the bundled Node runtime on PATH. Result: `0` errors, `33` warnings, `0` notices, matching [Firefox lint warning classification](FIREFOX_LINT_WARNINGS.md).
- Remilia Wiki rail icon is packaged from `public/wikiSidebar/remilia-sun.webp`.
- Generated Chromium and Firefox Balanced/Full builds expose `wikiSidebar/*` as a web-accessible resource for the shared dock icon path.
- Release archives and `release/milXdy-0.2.0-checksums.sha256` were regenerated after adding the Wiki sidebar icon asset.
- The Wiki sidebar frame and header now resolve the same packaged icon through `chrome.runtime.getURL("wikiSidebar/remilia-sun.webp")`.
- Apps Hub cards render registry-provided `dock.icon` assets through the shared runtime renderer instead of falling back to letter-only icons when an app supplies an icon.
- Release archives and `release/milXdy-0.2.0-checksums.sha256` were regenerated after wiring the Wiki sidebar header icon and Apps Hub card icon renderer.
- The shared overlay dock now exposes a reusable settings-action API, and the content runtime registers an **Add Apps** dock settings action that opens the Apps Hub.
- Generated Chromium and Firefox Lite/Balanced/Full content bundles include `setSettingsAction`, `Add Apps`, and `Open milXdy Apps Hub`; release archives and checksums were regenerated after this side-rail discovery update.
- Profile builds now keep full app metadata in the runtime registry while excluding unavailable app bundles and permissions from the generated extension package.
- Apps Hub marks apps excluded by the current build profile as unavailable, with no Enable, Pin, or Open controls, while diagnostics report `build:unavailable`.
- Fresh-install defaults for Apps Hub first-run state and RemiStats tooltip/sound defaults are centralized in `src/background.ts`; RemiStats no longer installs a duplicate `onInstalled` default seeder.
- Apps Hub cards now render registry-driven metadata chips for cost, rail support, privacy labels, and remote services so app disclosure stays reusable and tied to `src/shared/firstPartyApps.json`.
- Apps Hub cards now include a registry-driven Details toggle that expands behavior, performance, load trigger, data, permission, storage, and build-availability disclosure without importing the app bundle.
- Available Apps Hub cards with declared storage keys now expose a registry-driven Reset action that removes only the manifest local/sync keys, re-reads enablement, refreshes scanner/dock state, and records `hub.reset.<appId>` diagnostics without importing the app bundle solely for reset.
- Fresh installs now seed conservative first-run defaults before the Apps Hub opens: Music, Miladychan Portal, Beetol, RemiNet Chat, and Milady Maxxer are disabled unless the user enables them or chooses Full. `npm run verify:release:gates:020` passed after this install-default change and regenerated all profile archives/checksums.
- First-party enablement adapters now derive fallback state from registry `defaultEnabled` metadata instead of duplicating hard-coded defaults per app. `npm run verify:release:gates:020` passed after this registry-default refactor and regenerated all profile archives/checksums.
- Runtime diagnostics now expose registry-derived loaded heavy, worker-heavy, and network app lists. The popup Health panel and bug-report templates consume the shared runtime diagnostics and include build target/profile metadata.
- Music now includes permission recovery status, rescans with missing-file marking, duplicate display, richer playlist metadata matching, unresolved-track recovery, queue reorder, active radio-session state, and Firefox folder limitation messaging. `pnpm.cmd run verify:release:gates:020` passed with the Codex runtime Node path prepended and regenerated all profile archives/checksums.
- Release documentation now records the 0.2.0 platform-preview boundary, shared Wiki sidebar routing, shared Remilia auth, centralized install defaults, RemiStats tooltip hardening, dependency override pins, and release hygiene.
- Final read-aloud documentation now records the Wiki sidebar article routing, dock-attached Wiki reader, boundary highlight messages, optional Wiki auto-scroll, voice boundary support probing, estimated highlight fallback, custom HTTP TTS timing boundaries, and standalone Post-reading Chromium build scope.
- Final reproducibility documentation now records `scripts/verify-reproducible-release.mjs`, `npm run verify:release:reproducible`, and deterministic release archive verification as part of the 0.2.0 release gate story.

## Live Probe Tooling

Use [CHROME_LIVE_QA_0.2.0.md](CHROME_LIVE_QA_0.2.0.md) for live browser validation. Run `npm run print:live-probe:020` to print the browser-console probe from `scripts/live-smoke-probe-020.js`, then paste the resulting `window.__milxdy020LiveProbe` object into this log when the live smoke is rerun.

Optional live gate: run `npm run verify:live-probe:020` after updating this log if live Chrome evidence is being collected. It is expected to fail while the latest probe has `status: "blocked"`.

Current final live gate result:

```text
Error: live probe status must be passed; got "blocked"
```

## Release Artifacts

Generated release archives:

- `release/milXdy-0.2.0-chromium-lite.zip`
- `release/milXdy-0.2.0-chromium-balanced.zip`
- `release/milXdy-0.2.0-chromium-full.zip`
- `release/milXdy-0.2.0-firefox-lite.zip`
- `release/milXdy-0.2.0-firefox-balanced.zip`
- `release/milXdy-0.2.0-firefox-full.zip`
- `release/milXdy-0.2.0-checksums.sha256`

## Release Hygiene Evidence

- Release archives were generated from the checked-in profile build scripts and verified through checksum and reproducibility checks.
- Local browser caches and machine-specific test output were excluded from source control and release archives.
- Secret-bearing files remain ignored while `.env.example` stays available for documented configuration examples.
- Public maintenance hardening is present in the release: Post-reading fetch allowlists, removed X GraphQL bearer fallback, RemiStats tooltip escaping, encoded RemiStats PFP URL segments, dependency security overrides, and the final `esbuild` security update.

## Live Chrome Probe

Chrome session: existing X/Twitter tab at `https://x.com/home`.

Result: blocked by missing loaded 0.2.0 runtime.

Latest structured probe: `2026-06-28T00:27:54.984Z`.

```json
{
  "buildProfile": null,
  "buildTarget": null,
  "checkedAt": "2026-06-28T00:27:54.984Z",
  "counts": {
    "appHubPanel": 0,
    "appHubRuntime": 0,
    "appHubRuntimeState": 0,
    "overlayDockRoot": 0,
    "wikiSidebarRoot": 0
  },
  "extensionResourceOrigins": [],
  "missingRequired": [
    "overlayDockRoot",
    "performanceMode",
    "version",
    "buildProfile",
    "buildTarget"
  ],
  "performanceMode": null,
  "present": {
    "appHubPanel": false,
    "appHubRuntime": false,
    "appHubRuntimeState": false,
    "overlayDockRoot": false,
    "wikiSidebarRoot": false
  },
  "remediation": "Reload the unpacked 0.2.0 build, refresh X/Twitter, then rerun this probe.",
  "status": "blocked",
  "styleNodes": [
    {
      "href": null,
      "id": "milxdy-reskin-profile-style",
      "tag": "style"
    }
  ],
  "title": "X",
  "url": "https://x.com/home",
  "version": null
}
```

Extension management check: direct navigation to `chrome://extensions/` was blocked by Chrome browser automation URL policy, so the loaded unpacked folder could not be confirmed or reloaded by automation. Do not bypass that policy; reload the unpacked `dist/chromium` 0.2.0 build through Chrome extension management, refresh X/Twitter, then rerun `npm run print:live-probe:020`.

Extension manifest check: direct navigation to `chrome-extension://plhdpecfdcpnoofdhpgpkdankdbijkbh/manifest.json` was blocked by Chrome browser automation URL policy in an earlier attempt, so no manifest/version claim is recorded from Chrome.

Observed after tab claim and reload:

- `#milxdy-overlay-dock-root`: missing
- `#milxdy-app-hub-panel`: missing
- `#milxdy-wiki-sidebar-root`: missing
- `.milxdy-app-hub-runtime`: missing
- `.milxdy-app-hub-runtime-state`: missing
- `document.documentElement.dataset.milxdyPerformanceMode`: missing

Existing milXdy artifacts were limited to older/static style nodes:

- `#milxdy-reskin-profile-style`

Interpretation: after refreshing X/Twitter, Chrome still did not inject the rebuilt 0.2.0 shared runtime. Live smoke coverage for Apps Hub, overlay dock, rail pinning, Performance mode DOM state, and Wiki sidebar must be rerun after loading or reloading the unpacked 0.2.0 build in Chrome and refreshing X/Twitter.
