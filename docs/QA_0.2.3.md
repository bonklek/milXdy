# milXdy 0.2.3 QA Checklist

Use this checklist against the frozen `0.2.3` release candidate. Record the tested commit, browser versions, and any limitations before publication.

## Candidate

- [ ] Candidate commit recorded.
- [ ] `package.json`, `assets/extension/manifest.json`, and App SDK metadata all report `0.2.3`.
- [ ] Working tree is clean.
- [ ] Public candidate contains no `ideas/`, credentials, personal paths, browser caches, or machine-specific output.

## Automated Release Gate

- [ ] `npm.cmd ci`
- [ ] `npm.cmd audit --omit=dev` reports no shipped production dependency vulnerabilities.
- [ ] Full dev-tree audit findings are reviewed and classified before publication.
- [ ] `npm.cmd run verify:release:gates`
- [ ] Chromium and Firefox archives exist.
- [ ] SHA-256 checksum manifest exists and verifies.
- [ ] Reproducibility verification passes.

## Authenticated Chromium QA

- [ ] Load the unpacked `dist/chromium` build and confirm startup has no milXdy console errors.
- [ ] Exercise X Home, profile, post detail, Notifications, Messages, search, and route transitions.
- [ ] Confirm Apps & Features enable/disable, compact rail settings, ordering, pinning, overflow indicators, and restored layout.
- [ ] Exercise Fast, Balanced, and Full performance modes without stranded or duplicated app surfaces.
- [ ] Confirm Beetol Hunt shows the result promptly, preserves the final reward, then enters Done/cooldown state.
- [ ] Confirm RemiNet Chat authenticates, connects, loads history, sends, reacts, handles media, logs out, and reconnects after a timeout or stale session.
- [ ] Confirm RemiStats badges remain independent while poke controls appear only for confirmed RemiliaNET identities.
- [ ] Confirm X Like feedback remains responsive and optional poke-on-Like still follows user settings.
- [ ] Confirm Post-reading playback, highlighting, stop/minimize, OCR, X Articles, and long-text handling.
- [ ] Confirm Wiki read-aloud opens supported inactive tabs and collapsed sections before highlighting them.
- [ ] Confirm Maxxer and Root Visual controls apply and reverse cleanly.
- [ ] Confirm representative feed, notification, reply/thread, dark-mode, keyboard-focus, and reduced-motion behavior.
- [ ] Capture `window.__milxdy020LiveProbe` evidence.
- [ ] `npm.cmd run print:live-probe:020`
- [ ] `npm.cmd run verify:live-probe:020`

## Firefox And Waterfox QA

- [ ] `npm.cmd run typecheck`
- [ ] `npm.cmd run build:all`
- [ ] `npm.cmd run lint:firefox` has no errors; warnings are reviewed against `FIREFOX_LINT_WARNINGS.md`.
- [ ] Load `dist/firefox/manifest.json` as a temporary add-on in Firefox or Waterfox 140 or newer.
- [ ] Confirm popup tabs, settings persistence, X startup/routes, dynamic app imports, Wiki, Post-reading/OCR, RemiStats/pokes, RemiNet Chat, Beetol, Maxxer, browser-action badges, notifications, and context menus.
- [ ] Rerun Chromium smoke coverage after any shared compatibility fix.

## Publication

- [ ] Release notes and changelog say `released` only after the checks above pass.
- [ ] Roadmap lists `0.2.3` as the most recent released update and removes the previous released section.
- [ ] Final release commit is on `origin/main`.
- [ ] Tag `v0.2.3` points to that exact commit.
- [ ] GitHub Release is normal, not a prerelease.
- [ ] Upload `milXdy-0.2.3-chromium.zip`, `milXdy-0.2.3-firefox.zip`, and `milXdy-0.2.3-checksums.sha256`.
- [ ] The in-extension updater discovers the published release and selects the matching browser archive.
