# Operating Principles For Multi-Agent Repo Work

## Repository Coordination Rules

1. Branch names must describe the shippable slice, not just the first feature touched.
2. Shared files require explicit coordination:
   - `public/manifest.json`
   - `scripts/build.mjs`
   - `src/content.ts`
   - `src/background.ts`
   - `src/popup.ts`
   - `public/popup.html`
   - `public/popup.css`
   - `src/shared/*`
3. No agent should broad-revert files it does not own.
4. Each agent should record handoff state before stopping:
   - branch/base
   - owned slice
   - files touched
   - shared files touched
   - validation run
   - known conflicts/dependencies
5. Prefer small, independently shippable release slices over "everything currently in the worktree."

## Recommended Validation Baseline

Use these commands on Windows:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Plain `npm run ...` can fail under PowerShell execution policy because `npm.ps1` is blocked.

Runtime validation is still required for extension behavior:

- Load `dist` as an unpacked Chromium extension.
- Refresh X/Twitter tabs after reload.
- Check popup opens.
- Check enabled feature bundle loads.
- Check disabled feature bundle does not load unnecessarily when lazy-loading matters.

## Release Strategy

Use the roadmap as a public planning surface only after behavior is real enough to defend. Use `ideas/` for unstable scope and tradeoffs.

Good release slices:

- A visible feature plus its setting, docs, and smoke test.
- A cross-cutting infrastructure change with measurable behavior and a rollback path.
- A docs/release-only update that accurately reflects already-working code.

Bad release slices:

- A branch named for one feature that also includes unrelated auth, updater, popup, and docs changes.
- A large popup rewrite mixed with runtime auth changes.
- Public docs claiming support before smoke tests pass.

## Current Architectural Bias

Keep pushing the repo toward:

- one content bootstrap
- lazy feature bundles
- shared X/Twitter scanner where feasible
- namespaced feature CSS
- namespaced storage keys for new work
- explicit feature toggles
- diagnostics that help isolate which feature caused a problem

Be cautious around:

- new page-wide `MutationObserver`s
- always-on intervals
- unbounded API calls
- unbatched storage writes
- auth/cookie changes without a user-facing explanation
- popup changes that make all feature agents edit the same block
