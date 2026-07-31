# Release Process

This document covers the reproducible public build and release mechanics available to contributors.

## Start a release branch

The first commit on a new release-integration branch must align `package.json` (`version`, `extensionVersion`, and `appSdkVersion`), `package-lock.json`, the extension manifest template, current App SDK declarations/templates, and candidate release notes to the branch version. Run `npm run verify:release` before creating the release QA baseline; it rejects a `release-<version>` branch whose declared versions disagree.

Before feature work begins, run `npm run build:all`, `npm run package:release`, `npm run verify:release:checksums`, and `npm run verify:release:reproducible`. Record the fresh Chromium/Firefox archive names and checksums with the initial QA-host identity. Never carry the prior release's ZIPs, checksum manifest, or QA provenance forward as the new release baseline.

## Maintainer Setup

Before a public beta release, confirm the GitHub repository endpoint in:

- `src/platform/background/update-check.ts`

The public beta endpoint should be:

```ts
export const GITHUB_RELEASES_API_URL = "https://api.github.com/repos/bonklek/milXdy/releases?per_page=20";
```

Release tags should be semantic versions with an optional `v` prefix, such as `v0.2.1`. The normal in-extension update channel tracks normal published GitHub releases and ignores drafts/prereleases. Mark a release as a GitHub prerelease only when it is meant for an experimental channel or manual tester handoff outside the normal update path. Release assets should use predictable `milXdy*.zip` names. The manifest version in `assets/extension/manifest.json` is the installed version used for comparison.

## Build

```powershell
npm install
npm run verify:release:gates
```

For reproducible release archives, use the npm lockfile as the canonical dependency input (`npm ci` in clean release environments) and run packaging through the checked-in Node scripts. `scripts/release/package-release.mjs` writes ZIP files with sorted entries, normalized permissions, forward-slash paths, deterministic deflate output, and a fixed timestamp from `SOURCE_DATE_EPOCH` when set. If `SOURCE_DATE_EPOCH` is unset, the release tooling uses its built-in fixed timestamp so repeated packages from the same `dist` tree are byte-for-byte identical.

`scripts/release/verify-reproducible-release.mjs` compares the checked release archives against two freshly packaged deterministic archive sets from the same `dist` tree. Keep `npm run verify:release:reproducible` in the final gate whenever release packaging, browser builds, copied assets, or archive metadata changes.

The release build emits browser-ready files under `dist/chromium` and `dist/firefox`. Lite, Balanced, and Full are setup choices inside the extension, not separate public release archives.

## Snapshot Builds

Use the `Snapshot Build` GitHub Actions workflow when accumulated changes on `main` are worth testing before the next release. Snapshots are temporary workflow artifacts for power users and reviewers; they are not GitHub Releases, are not part of the normal update channel, and should not be advertised as stable releases.

Use a short label such as `0.2.2-snapshot-1` or `app-sdk-windowing`. The workflow packages Chromium and Firefox ZIPs plus the checksum manifest from the selected commit. Prefer running snapshots from `main` after the relevant pull requests have merged.

Use release candidates, such as `v0.2.2-rc.1`, only when the release scope is nearly frozen and the build needs a stable prerelease page with notes.

Required outputs include:

- `dist/chromium/content.js`
- `dist/chromium/background.js`
- `dist/chromium/popup.js`
- `dist/chromium/features/wiki.js`
- `dist/chromium/features/post-reading.js`
- `dist/chromium/features/remistats.js`
- `dist/chromium/features/miladymaxxer.js`
- `dist/chromium/features/beetol.js`
- `dist/chromium/features/reminetChat.js`
- `dist/chromium/worker.js`
- `dist/chromium/ocr.html`
- `dist/chromium/ocrHost.js`
- `dist/firefox/manifest.json`

Disabled feature bundles should not be downloaded or parsed on initial page load. The build script includes smoke checks to keep large feature implementation strings out of the bootstrap.

## Checks

To build and validate release archives:

```powershell
npm.cmd run verify:release:gates
```

`verify:release:gates` rebuilds the profile matrix, runs the project checks, packages both browser archives, verifies checksums, and confirms reproducible output. Version-specific commands such as `verify:release:gates:020` are retained only for compatibility with their historical release line.

Also verify:

- `git status --short`
- app version in `package.json`
- extension version in `assets/extension/manifest.json`
- release archives in `release/milXdy-<version>-chromium.zip` and `release/milXdy-<version>-firefox.zip`
- SHA-256 checksum manifest in `release/milXdy-<version>-checksums.sha256`
- reproducibility verification with `npm run verify:release:reproducible`
- changelog entry
- version-specific release notes, such as `docs/releases/RELEASE_NOTES_0.2.1.md`
- safe-update instructions
- no personal identifiers or secrets in source/docs
- no local browser caches or machine-specific test output in source or release archives
- `.gitignore` contains secret-file rules for `.env`, `.env.*`, `!.env.example`, `*.pem`, `*.key`, `*.p12`, and `*.pfx`
- GitHub release state matches the intended update channel: normal published releases for the normal updater, prereleases only for experimental tester builds

## Push Policy

Do not push unless the repository owner explicitly approves the push.

`main` is the shared integration branch and may be ahead of the latest public release. Contributors should branch from `main` and open pull requests back to `main`. Public releases are fixed by tags, release notes, and GitHub Release assets, not by holding `main` at the latest shipped version.

Use release branches only when stabilizing or hotfixing a release line. Merge or cherry-pick accepted release fixes back to `main` so future feature work does not fork from stale release code.
