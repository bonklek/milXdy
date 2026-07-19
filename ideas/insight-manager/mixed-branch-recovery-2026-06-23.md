# Mixed Branch Recovery - 2026-06-23

## Situation

The current working tree is on `codex/reminet-chat-sidebar`, but the branch is carrying work from more than one feature/workflow. This means the branch name is no longer a reliable description of the diff. Treat this checkout as a mixed integration branch until the changes are split or intentionally accepted as one integration batch.

Current base observed:

- `HEAD`: `ed4b0c0 Prepare beta release 0.1.2`
- `HEAD` is also `main`, `origin/main`, and tag `v0.1.2`
- Current branch: `codex/reminet-chat-sidebar`
- Verification already run with `npm.cmd run typecheck` and `npm.cmd run build`; both passed.

Important Windows note: plain `npm run ...` failed because PowerShell blocks `npm.ps1` under the current execution policy. Use `npm.cmd run typecheck` and `npm.cmd run build`.

## Mixed Work In The Current Branch

Tracked modified files:

- `README.md`
- `docs/AGENT_SETUP_GUIDE.md`
- `docs/CHANGE_INVENTORY.md`
- `docs/USER_GUIDE.md`
- `public/manifest.json`
- `public/popup.css`
- `public/popup.html`
- `scripts/build.mjs`
- `src/background.ts`
- `src/content.ts`
- `src/features/beetol/background.js`
- `src/features/remistats/content.js`
- `src/features/remistats/remistats.css`
- `src/popup.ts`
- `src/shared/updateCheck.ts`

Untracked files/directories:

- `docs/ROADMAP.md`
- `src/entries/reminetChatContent.ts`
- `src/features/reminetChat/`

The changed areas appear to include at least:

- RemiNet chat/sidebar feature.
- Popup/settings surface changes.
- Manifest/build changes for the new feature bundle and permissions/resources.
- RemiNet/Beetol auth and poke-related behavior.
- RemiStats UI/styling behavior.
- Guided updater/update-check behavior.
- User and agent documentation updates.
- Public roadmap addition.

## Primary Risk

Multiple agents may assume the branch belongs only to RemiNet chat and accidentally overwrite, revert, or entangle other feature work. This is the main immediate repository risk, not build correctness.

The practical problem is that files like `src/background.ts`, `src/content.ts`, `src/popup.ts`, `public/popup.html`, `public/popup.css`, and `scripts/build.mjs` are shared integration files. Several features naturally touch them, so branch splitting must be done carefully.

## Recommended Recovery Plan

1. Freeze broad edits on `codex/reminet-chat-sidebar` until a split decision is made.
2. Create a safety branch or patch snapshot before any extraction:
   - `git branch codex/mixed-integration-safety-2026-06-23`
   - optional: `git diff > ideas/insight-manager/mixed-integration-2026-06-23.patch`
3. Decide whether this is one integration PR or several smaller PRs.
4. If splitting, split by user-facing release slice rather than by file:
   - RemiNet chat/sidebar slice.
   - Guided updater/update-check slice.
   - RemiNet auth/poke/Beetol persistence slice.
   - Popup visual/ergonomics slice, if separable.
   - Docs/roadmap slice.
5. For each extracted branch, verify:
   - `npm.cmd run typecheck`
   - `npm.cmd run build`
   - load `dist` as unpacked extension if runtime behavior changed.

## Suggested Branch Breakdown

### `codex/reminet-chat-sidebar`

Keep only:

- `src/features/reminetChat/`
- `src/entries/reminetChatContent.ts`
- `src/content.ts` feature gate addition.
- `src/background.ts` import addition.
- `scripts/build.mjs` bundle/style copy addition.
- `public/manifest.json` web accessible resources or host permission changes specifically required by chat.
- Popup toggle for `milxdy.reminetChat.enabled`.
- Minimal docs describing the chat feature.

Watch shared files carefully because chat likely overlaps with popup and RemiNet auth behavior.

### `codex/guided-updater-polish`

Likely files:

- `src/shared/updateCheck.ts`
- `src/background.ts`
- `src/popup.ts`
- `public/popup.html`
- `public/popup.css`
- README/user/agent docs that explain update flow.

Keep this separate if the updater can ship without chat.

### `codex/reminet-auth-poke-persistence`

Likely files:

- `src/features/beetol/background.js`
- `src/features/remistats/content.js`
- `src/features/remistats/remistats.css`
- `public/manifest.json` if cookie permission or RemiliaNET host changes are part of this slice.
- `src/popup.ts` and popup HTML/CSS where session status or diagnostics are surfaced.
- Docs explaining cookies, tokens, SSO retry, and poke cooldowns.

This slice has higher trust/security sensitivity because it touches cookies and RemiliaNET auth.

### `codex/docs-roadmap`

Likely files:

- `docs/ROADMAP.md`
- `docs/CHANGE_INVENTORY.md`
- Release idea files under `ideas/` if they remain local-only.

This can be kept local if it is for agents only, or promoted to tracked docs if it should be public.

## Guidance For Agents

- Do not assume uncommitted changes are yours.
- Do not use `git reset --hard`, `git checkout --`, or broad restore commands.
- Before editing shared integration files, inspect the existing diff.
- Prefer narrowly scoped patches.
- After changing shared extension plumbing, run typecheck and build.
- If working on a feature branch, explicitly state which slice you are preserving and which touched files are intentionally out of scope.
- If extracting changes, use patch/staging discipline rather than trying to mentally separate everything at commit time.

## Current Concern Ranking

1. Branch scope confusion causing accidental reverts or bundled unrelated PRs.
2. Shared popup/build/manifest files becoming merge-conflict magnets.
3. Auth/cookie changes shipping without a clear privacy explanation and manual runtime smoke test.
4. RemiNet chat adding its own `MutationObserver` and WebSocket behavior outside the shared scanner/performance story.
5. Docs drifting ahead of what is actually validated in an unpacked extension.
