# milXdy Release Management Skill

Use this private workflow when preparing a milXdy beta release. The `ideas/` folder is gitignored, so these notes can be more operational and speculative than public docs.

## Inputs To Read

1. `ideas/running-ideas.md`
2. `ideas/releases/<version>.md`
3. `docs/ROADMAP.md`
4. `CHANGELOG.md`
5. `docs/USER_GUIDE.md`
6. `README.md`
7. `git log <previous-release>..HEAD`
8. `git diff --stat <previous-release>`
9. `git status --short`

If a release branch comes from another contributor, also read:

10. `git log main..FETCH_HEAD` or the contributor branch equivalent
11. `git diff --name-status main...FETCH_HEAD`
12. any PR description, issue thread, or handoff notes attached to the branch

## Release Boundaries

- Use `0.1.x` for incremental beta releases inside the current unpacked-extension architecture.
- Use `0.2.0` only when install/update, storage, auth, or the product surface changes substantially.
- If a feature is exploratory, label it `Investigating` until feasibility is confirmed.
- Do not advertise a feature publicly until it has either shipped or is intentionally listed in `docs/ROADMAP.md` as planned.

## Required Release Artifacts

For each release, produce:

- GitHub release title.
- GitHub release notes.
- Changelog entry.
- Patch notes for testers.
- X post draft under 280 characters.
- Optional X follow-up reply.
- Four screenshot instructions.
- Manual smoke-test checklist.
- Known limitations.
- Privacy/permission notes if permissions changed.

## GitHub Discussions

For `0.1.3`, enable GitHub Discussions as part of the public planning rollout.

Suggested categories:

- Announcements
- Ideas
- Bug reports
- Support
- Show and tell

Suggested first pinned discussion:

```text
milXdy beta planning

Use this discussion area for beta feedback, feature ideas, and release planning. For actionable bugs, use GitHub Issues or the in-extension Diag tab report flow.
```

Do not mark Discussions as the only bug-report path. Keep Issues for reproducible bugs.

## Changelog Structure

Use this shape:

```markdown
# milXdy <version>

## Highlights

## Added

## Changed

## Fixed

## Known limits

## Updating safely
```

Rules:

- Keep user-impact first.
- Mention any permission changes.
- Mention any storage/auth/update behavior changes.
- Do not include private speculation from `ideas/` unless it is part of the public roadmap.
- If a release includes an experimental feature, say what is experimental and how to turn it off.

## Patch Notes Structure

Patch notes should be shorter than the changelog:

```markdown
milXdy <version> beta patch notes

- What users will notice.
- What testers should try.
- Known issues.
- How to update without losing settings.
```

## X Post Structure

Main post:

- One sentence naming milXdy and the release.
- One sentence with the top 3-5 user-visible changes.
- Keep under 280 characters.

Follow-up reply:

- Link to GitHub release.
- Mention manual update path.
- Ask users to report bugs through Diag, Issues, or Discussions.

Avoid:

- promising hard dates
- saying "automatic updates" for unpacked builds
- claiming Firefox support before smoke tests pass
- mentioning private implementation risks from `ideas/`

## Four Screenshot Instructions

Every release should include four screenshot asks:

1. Settings or setup surface.
2. Primary new feature.
3. Secondary new feature.
4. Feedback, diagnostics, docs, or before/after proof.

Screenshot rules:

- Avoid local file paths, private bookmarks, DMs, notifications, account settings, and personal identifiers.
- Keep text readable.
- Prefer real feature output over decorative screens.
- Include alt-text guidance in the release note or X post draft.

## Pre-Release Checks

Run:

```powershell
npm.cmd run typecheck
npm.cmd run build
rg -n "jtbrennan|jamestbrennan|proton\.me|gho_|github_pat_|BEGIN (RSA|OPENSSH|PRIVATE)|client_secret|api_key|private_key|OWNER/REPO|<milXdy-repo-url>|C:\\Users|jt_br" README.md docs LICENSE package.json package-lock.json public scripts src -g "!src/features/wiki/wiki-index.generated.json"
```

Also check:

- `git status --short`
- `git config user.name`
- `git config user.email`
- `git remote -v`
- manifest version
- package version
- release zip asset name
- GitHub release is marked prerelease for beta versions

## Contributor Branch Handoff

When a user says another contributor has completed a release feature branch:

1. Fetch the branch without merging.
2. Compare it against current `main`.
3. Identify conflicts with local uncommitted work before attempting a merge.
4. Read changed manifests, build scripts, docs, and feature entry points first.
5. Run targeted tests/builds after merge, not before only.
6. Update release notes to describe shipped behavior, not planned behavior.
7. For browser compatibility work, verify both the original Chromium path and the new browser path.

For Firefox work specifically, confirm:

- manifest variant or compatibility strategy
- `chrome.*`/`browser.*` API handling
- background/service-worker behavior
- cookies and RemiNet auth behavior
- content-script injection on X/Twitter
- web accessible resources and dynamic imports
- OCR worker/WASM assets
- ONNX/model assets for Maxxer
- popup layout and settings persistence
- documented Firefox limitations

## Push Policy

Do not push unless the user explicitly says to push.

When approved:

1. Commit release changes.
2. Tag `v<version>`.
3. Push branch.
4. Push tag.
5. Build release zip from `dist`.
6. Create or update GitHub prerelease.
7. Confirm release asset and clean working tree.
