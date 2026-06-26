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
npm run build:all
npm run lint:firefox
```

The Chromium build emits browser-ready files under `dist/chromium`. The Firefox build emits the same extension payload under `dist/firefox`, with a Firefox-specific manifest generated from `public/manifest.json`.

Required outputs include:

- `dist/chromium/content.js`
- `dist/chromium/background.js`
- `dist/chromium/popup.js`
- `dist/chromium/features/wiki.js`
- `dist/chromium/features/postreader.js`
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

Before publishing:

```powershell
npm.cmd run typecheck
npm.cmd run build:all
npm.cmd run lint:firefox
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
