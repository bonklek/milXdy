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
npm run verify:release:gates:020
```

For reproducible release archives, use the npm lockfile as the canonical dependency input (`npm ci` in clean release environments) and run packaging through the checked-in Node scripts. `scripts/package-release.mjs` writes ZIP files with sorted entries, normalized permissions, forward-slash paths, deterministic deflate output, and a fixed timestamp from `SOURCE_DATE_EPOCH` when set. If `SOURCE_DATE_EPOCH` is unset, the release tooling uses its built-in fixed timestamp so repeated packages from the same `dist` tree are byte-for-byte identical.

`scripts/verify-reproducible-release.mjs` compares the checked release archives against two freshly packaged deterministic archive sets from the same `dist` tree. Keep `npm run verify:release:reproducible` in the final gate whenever release packaging, profile builds, copied assets, or archive metadata changes.

The profile build emits browser-ready files under `dist/chromium-lite`, `dist/chromium-balanced`, `dist/chromium`, `dist/firefox-lite`, `dist/firefox-balanced`, and `dist/firefox`. The full Chromium build lives at `dist/chromium`; the full Firefox build lives at `dist/firefox`, with a Firefox-specific manifest generated from `public/manifest.json`.

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

Before publishing:

```powershell
npm.cmd run verify:release:gates:020
npm.cmd run print:live-probe:020
npm.cmd run verify:live-probe:020
```

`verify:release:gates:020` is the canonical release readiness gate. It rebuilds the profile matrix, runs TypeScript, release contracts, platform checks, URL allowlist checks, Music verification, Firefox lint, extension/app smoke checks, release packaging, checksum verification, and reproducible archive verification. Keep live Chrome proof separate and optional because it must validate a real X/Twitter tab after reloading the unpacked `dist/chromium` build.

Also verify:

- `git status --short`
- app version in `package.json`
- extension version in `public/manifest.json`
- release archives in `release/milXdy-<version>-<target>-<profile>.zip`
- SHA-256 checksum manifest in `release/milXdy-<version>-checksums.sha256`
- reproducibility verification with `npm run verify:release:reproducible`
- changelog entry
- 0.2.0 QA checklist, when cutting a 0.2.x platform beta
- 0.2.0 Chrome live QA guide, when cutting a platform beta
- `window.__milxdy020LiveProbe` evidence from the live X/Twitter tab for 0.2.x platform betas
- safe-update instructions
- no personal identifiers or secrets in source/docs
- no local browser caches or machine-specific test output in source or release archives
- `.gitignore` contains secret-file rules for `.env`, `.env.*`, `!.env.example`, `*.pem`, `*.key`, `*.p12`, and `*.pfx`
- GitHub release is marked as a prerelease for beta versions

## Push Policy

Do not push unless the repository owner explicitly approves the push.
