# Contributing

## Branch Model

`main` is the shared integration branch. Open pull requests against `main` so contributors and agents can see the latest accepted work.

Public releases are cut from tagged commits and GitHub Releases. `main` may be ahead of the latest release. Do not treat the latest release tag as the development baseline unless you are preparing a hotfix for that release.

Use short-lived feature branches:

```text
main -> feature branch -> pull request -> main -> release tag
```

Use release branches only for stabilization or hotfixes, such as `release/0.2.2` or `maintenance/0.2.x`. Cherry-pick or merge accepted release fixes back to `main`.

## Agent Workflow

When using Codex or another agent for repository changes:

- start from a clean, updated `main`
- create a task branch before editing
- keep unrelated work out of the branch
- inspect local changes before committing
- commit coherent checkpoints with direct messages
- push the branch and open a pull request when the work is ready for review

Do not rewrite, reset, or delete user work unless the user explicitly approves the exact operation.

## Local Setup

Install dependencies with:

```powershell
npm ci
```

Useful local verification commands:

```powershell
npm run typecheck
npm run build:chromium
npm run build:firefox
npm run verify:update-check
npm run verify:url-allowlist
npm run verify:platform
npm run verify:smoke:020
npm run verify:app-smoke:020
```

For final release readiness, use the release gate documented in [docs/RELEASES.md](docs/RELEASES.md):

```powershell
npm run verify:release:gates:020
```
