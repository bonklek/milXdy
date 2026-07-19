# milXdy Refactor Loop: Return Criteria

This supersedes all older handoff notes. The agent is getting stuck reviewing old work. Stop reviewing architecture. Stop expanding the platform. The platform gate now exists and passes.

## Current Truth

`npm.cmd run verify:platform` passes. Therefore these are considered done unless a final smoke test exposes a concrete bug:

- app platform / registry / Hub metadata
- content runtime ownership
- scanner/runtime budget wiring
- Lite, Balanced, and Full profile build plumbing
- rail pin state model
- RemiNet background WebSocket
- Firefox dynamic import query-string fix
- ONNX blob worker bootstrap
- Firefox lint warning classification doc

Do not re-audit these by hand. If worried, run the verifier.

## Hard Stop Rule

Return when:

1. final automated gate passes, and
2. the three manual smoke areas below are checked or explicitly blocked.

Do not keep looping for cleanup, polish, release docs, version bumps, warning reduction, or speculative improvements.

## Final Automated Gate

Run exactly:

```powershell
npm.cmd run typecheck
npm.cmd run build:all
npm.cmd run build:chromium:lite
npm.cmd run build:chromium:balanced
npm.cmd run build:firefox:lite
npm.cmd run build:firefox:balanced
npm.cmd run verify:music
npm.cmd run verify:platform
npm.cmd run lint:firefox
```

Pass criteria:

- All commands exit 0.
- Firefox lint has 0 errors.
- Existing Firefox warnings/notices may remain if they match `docs/FIREFOX_LINT_WARNINGS.md`.

## Manual Smoke Only

Do not implement unless one of these fails.

### 1. Feed Scroll / Tweet Height

Check Fast and Balanced modes on X:

- Normal feed/post scrolling does not visibly lag from milXdy work.
- Tweets do not visibly resize after initial X render because of milXdy.
- Postreader/RemiStats/Root Visuals/Wiki/Maxxer controls do not overlap important X text or controls.

If this fails, fix only the specific app/slot causing the jump or overlap.

### 2. Hub / Presets / Rail

Check:

- Fresh install opens first-run Hub once.
- Skip persists.
- Lite, Balanced, Full presets update enabled apps, performance mode, and rail pins.
- Existing users without `milxdy.apps.railPinned` keep enabled dock apps visible.
- Pin/unpin is separate from enable/disable.
- Pinned app opens and lazy-loads.

If this fails, fix only the failing behavior. Do not redesign the Hub.

### 3. Firefox And Postreader

In Firefox:

- `dist/firefox/manifest.json` loads.
- Feature imports work.
- RemiNet Chat connects through the background socket.
- Maxxer ONNX worker starts.
- Postreader reads a post; OCR progresses past hidden-host loading.
- Beetol auth/session/actions/panel placement work.
- RemiStats badges/pokes/profile links/sounds work.

Postreader:

- Smooth fill highlight no longer causes severe FPS degradation.
- Fast/Balanced degrade smooth fill for long text/token-heavy posts.
- Quote scroll mode reads/highlights full quoted text when available.
- Quote fetch failure falls back to preview with status/diagnostic text.

## Allowed Fixes

Only these fixes are in scope now:

- A concrete failing automated gate.
- A concrete failing manual smoke item above.
- Visible mojibake in user-facing UI or comments touched during a scoped fix.
- A missing/incorrect note in `docs/FIREFOX_LINT_WARNINGS.md` if lint output changed.

## Out Of Scope

Do not do these in this loop:

- version bump
- final `0.2.0` release notes
- release announcement docs
- broader privacy rewrite
- new app-store work
- new app features
- panel redesigns
- further architecture consolidation
- first-party `innerHTML` warning cleanup unless it is directly inside a failing smoke path

## Return Report

Return with:

- command results
- feed scroll/tweet height smoke result
- Hub/preset/rail smoke result
- Firefox/Postreader smoke result
- any remaining release blocker

If a manual smoke cannot be performed because the environment lacks Firefox, a logged-in service, or an X test condition, state that blocker and return. Do not keep reviewing old material.
