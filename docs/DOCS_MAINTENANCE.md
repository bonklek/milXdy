# Documentation Maintenance

milXdy has several docs that intentionally overlap at the edges. Keep each doc focused on its source-of-truth role so release history, roadmap planning, user guidance, and contributor coordination do not drift.

## Source Of Truth

- `docs/ROADMAP.md`: current release baseline plus future product direction. It should not archive old releases, list GitHub labels, or list suggested milestones.
- `CHANGELOG.md`: historical release summary in descending version order.
- `docs/RELEASE_NOTES_*.md`: detailed shipped scope for one release.
- `docs/RELEASES.md`: maintainer release mechanics, build gates, archive expectations, and GitHub release policy.
- `docs/QA_*.md` and QA logs: release validation checklists and evidence.
- `docs/USER_GUIDE.md` and `docs/user-guides/*`: user-facing behavior for shipped features.
- `docs/APP_SDK.md`: app/platform developer contract and future app-package shape.
- GitHub Issues: concrete bugs, enhancements, and contributor tasks.
- GitHub Milestones: target-version grouping for issues.
- GitHub Projects: triage/status board for issues.
- GitHub Labels: filtering taxonomy for issues and PRs.

## Update Rules

When a feature ships:

- Add or update release notes for that version.
- Add a concise changelog entry.
- Update user-facing guides for the shipped behavior.
- Remove or rewrite roadmap text that still describes the feature as future work.
- Create or update follow-up issues for anything intentionally left incomplete.

When release status changes:

- Verify GitHub Releases first.
- Update `CHANGELOG.md`.
- Update or add the matching `docs/RELEASE_NOTES_*.md`.
- Update `docs/INDEX.md` if a new release notes file is added.
- Update `docs/RELEASES.md` only if release policy or mechanics changed.

When labels, milestones, or project boards change:

- Update GitHub directly.
- Do not add label or milestone registries to the roadmap.
- Mention labels in individual GitHub issues where they help triage.

When a feature or app is renamed:

- Search docs and visible UI copy for the old name.
- Preserve internal code identifiers unless the code migration is part of the task.
- Update GitHub labels only if the label taxonomy changed.

When creating contributor work:

- Use GitHub Issues for actionable tasks.
- Use the roadmap for product direction and sequencing, not task ownership.
- Keep issue descriptions specific enough to verify.

When editing roadmap or GitHub Issues:

- Check both sides before changing either one.
- Every actionable roadmap item should have a matching GitHub issue unless it is intentionally only background context.
- Every versioned roadmap item should have a GitHub issue assigned to the matching release milestone.
- Backlog roadmap items without a version commitment should have GitHub issues with no milestone until scheduled.
- If an issue changes scope, title, or target release, update the roadmap when it affects product direction or sequencing.
- If the roadmap changes scope, title, or target release, update or create the matching GitHub issue.
- Do not use the roadmap as the issue label registry; labels belong in GitHub.
- Before adding a new roadmap issue, search existing open and closed issues to avoid duplicates.

## Roadmap Rules

The roadmap should contain:

- The most recent released version as the current baseline.
- Planned version sections.
- Backlog themes without version commitment.
- Brief product direction and sequencing context.

The roadmap should not contain:

- Older release archives.
- Full release notes.
- GitHub label lists.
- Suggested GitHub milestones.
- QA checklists.
- Detailed implementation instructions better suited to issues.

## Pre-Commit Doc Check

Before committing documentation changes, run targeted searches for stale terms:

```powershell
rg -n "Postreader|Diag|browser-compat|prerelease|release candidate" README.md CHANGELOG.md docs public src
rg -n "Planning Labels|Suggested GitHub milestones|^## Released:" docs/ROADMAP.md
```

Use judgment for intentional hits, such as internal code identifiers or docs explaining old release behavior.

For roadmap and issue sync, also check GitHub:

```powershell
gh issue list --repo bonklek/milXdy --state open --limit 200 --json number,title,milestone,labels
gh api repos/bonklek/milXdy/milestones --paginate
```

Confirm planned version sections map to milestones, and unversioned backlog items map to issues without milestones.
