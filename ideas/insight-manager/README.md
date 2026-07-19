# Insight Manager Notes

This ignored folder is the local knowledge base for the repo-wide insight manager role. It is agent-facing, not product-facing. Notes here can be edited freely without affecting tracked release docs.

## Purpose

- Keep repo-wide observations that cut across feature agents.
- Record coordination risks before they become merge or release problems.
- Maintain a delegation map for active agents.
- Preserve branch/release strategy decisions that are too provisional for tracked docs.

## Current Files

- `agent-roster.md`: active agent ownership map and delegation guidance.
- `mixed-branch-recovery-2026-06-23.md`: current branch scope problem and split strategy.
- `operating-principles.md`: how this repo should be coordinated across agents.

## Current Repo Read

The repo is a multi-feature MV3 Chromium extension. The highest-leverage management work is keeping shared integration surfaces stable:

- `public/manifest.json`
- `scripts/build.mjs`
- `src/content.ts`
- `src/background.ts`
- `src/popup.ts`
- `public/popup.html`
- `public/popup.css`
- shared runtime files under `src/shared/`

Most feature work eventually touches one or more of these files. Treat those files as coordination points, not ordinary feature-owned files.
