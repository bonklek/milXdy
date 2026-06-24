# Release Process

This document covers public release mechanics. Private release-planning notes live in the gitignored `ideas/` folder.

## Maintainer Setup

Before a public beta release, confirm the GitHub repository endpoint in:

- `src/shared/updateCheck.ts`

The public beta endpoint should be:

```ts
export const GITHUB_RELEASES_API_URL = "https://api.github.com/repos/bonklek/milXdy/releases?per_page=20";
```

Release tags should be semantic versions with an optional `v` prefix, such as `v0.1.3`. Beta releases should be published as GitHub prereleases with a predictable `milXdy*.zip` asset. The manifest version in `public/manifest.json` is the installed version used for comparison.

## Build

```powershell
npm install
npm run typecheck
npm run build
```

The build emits:

- `dist/content.js`
- `dist/background.js`
- `dist/popup.js`
- `dist/features/wiki.js`
- `dist/features/postreader.js`
- `dist/features/remistats.js`
- `dist/features/miladymaxxer.js`
- `dist/features/beetol.js`
- `dist/features/reminetChat.js`
- `dist/worker.js`
- `dist/ocr.html`
- `dist/ocrHost.js`

Disabled feature bundles should not be downloaded or parsed on initial page load. The build script includes smoke checks to keep large feature implementation strings out of the bootstrap.

## Checks

Before publishing:

```powershell
npm.cmd run typecheck
npm.cmd run build
```

Also verify:

- `git status --short`
- app version in `package.json`
- extension version in `public/manifest.json`
- changelog entry
- safe-update instructions
- no personal identifiers or secrets in source/docs
- GitHub release is marked as a prerelease for beta versions

## Push Policy

Do not push unless the repository owner explicitly approves the push.
