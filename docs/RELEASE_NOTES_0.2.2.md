# milXdy 0.2.2 Release Notes

milXdy `0.2.2`, **The Prepared App SDK Update**, is a platform beta update focused on making apps, settings, package metadata, and release gates easier to reason about before broader community app loading work continues.

Status: released. Automated non-live release gates passed, release artifacts were verified, and live QA for the 0.2.2 release scope is complete.

## Highlights

### Apps & Features and settings cleanup

- Apps & Features now has clearer information architecture for full apps, feature modules, enablement, rail pinning, app-card details, reset actions, privacy notes, and diagnostics.
- First-run Lite, Balanced, and Full setup choices apply exact app enablement, rail defaults, and the matching Performance mode while keeping first-party apps available and toggleable.
- First-party app and feature settings declare manifest metadata for location, storage, reset behavior, preset participation, and generated control expectations.
- The settings migration audit records current storage ownership, popup mirrors, Apps & Features destinations, and profile-pack safety decisions.
- App settings mirror verification keeps popup compatibility and generated Apps & Features metadata from drifting.
- Composer Tools joins Apps & Features as a local-only feature module that converts typed double dashes into em dashes inside supported X/Twitter post composers.

### App SDK preparation

- First-party app registry metadata now covers package kind, lifecycle mode, surfaces, site scopes, route scopes, cost, privacy labels, background message declarations, rail support, and app chrome compatibility.
- First-party apps are aligned with the shared runtime contract for lifecycle hooks, routed background messages, surface delivery, shared scheduler use, and bounded observer behavior.
- App SDK compliance verification now checks app metadata, direct messaging exceptions, settings declarations, background capabilities, and remaining internal bridges.
- Remaining direct runtime bridge use is classified as internal and verified: RemiNet Chat's stateful socket bridge and the Wiki sidebar frame bridge are both sender-restricted and intentionally not local package APIs.

### App chrome and contributor UI guidance

- Shared app chrome style presets cover native app defaults, RemiliaNet-style chrome, and classic bevel utility-window chrome.
- App surfaces share theme variables for frames, headers, controls, dividers, shadows, and light/dark readability.
- The contributor UI style guide documents side-rail apps, app headers, controls, theme expectations, semantic variables, and do/do-not guidance for classic app windows.
- Overlay geometry hardening keeps app windows bounded around the side rail and preserves restore behavior.

### Local app package and custom-build groundwork

- Local package examples now cover first-party replacement pilots and a novel local-dev package shape.
- `milxdy.app.json` has a documented schema with package kind, SDK compatibility, lifecycle, site scopes, settings, permissions, privacy, background metadata, and asset declarations.
- The local package composer supports folder and zip package inputs, deterministic build plans, package hashes, permission summaries, web-accessible asset output, and custom Chromium build output under `dist/chromium-local-apps/`.
- Trust gates fail closed for blocked or unreviewed packages, unacknowledged privileged surfaces, unsafe paths, malformed zips, duplicate package IDs, storage conflicts, invalid host declarations, direct runtime messaging, and sensitive extension API use.
- Novel local packages can be controllable through generated Apps & Features enablement metadata, but package-owned background handlers, marketplace discovery, signatures, and polished install/update UI remain follow-up work.

### Filesystem and release infrastructure

- Source layout is organized around `src/apps`, `src/platform`, `src/extension`, and `src/distributions`.
- Public extension assets live under `assets/extension`; app assets live under `assets/apps`; user-download helper material is kept out of web-accessible resources.
- Build, package, smoke, verify, and release scripts are grouped under `scripts/build`, `scripts/packages`, `scripts/smoke`, `scripts/verify`, and `scripts/release`.
- `verify:filesystem-layout` prevents historical roots such as `public`, `src/features`, flat `scripts/*.mjs`, and old example package paths from returning.
- The canonical current release gate, `verify:release:gates`, rebuilds Chromium/Firefox outputs, validates platform contracts, verifies package/composer trust gates, checks app smoke, packages release archives, verifies checksums, and checks archive reproducibility.

### Security, privacy, and compatibility hardening

- App SDK `context.sendMessage()` now enforces declared background message types for the sender app.
- Beetol, Music, Milady Maxxer, RemiStats, Miladychan Portal, and Post-reading message paths are routed through App SDK or explicitly classified internal bridges.
- Post-reading full-quote fetching is off by default and uses credentialless public sources instead of active X/Twitter session material, bearer tokens, CSRF values, or GraphQL discovery.
- Post-reading OCR bridge responses no longer echo authentication tokens, and OCR/media URL policy is restricted to expected X/Twitter media sources.
- RemiNet media and avatar URL handling is allowlisted so the extension background is not a general-purpose remote fetcher.
- Release artifact verification locks expected archive behavior and avoids exposing mismatched browser ZIP downloads through the update flow.

## GitHub Issue Coverage

The `release/0.2.2` branch carried the accepted scope for this release. Update or close the matching issues based on the final shipped scope.

- `#42` Overlay positioning, snap, and restore behavior: covered by overlay geometry hardening and live rail/app probe coverage.
- `#43` Contributor UI style guide: covered by the public contributor UI style guide for classic app surfaces.
- `#52` Apps & Features settings migration: covered by app/feature enablement, rail management, app-card metadata, and settings mirror verification.
- `#53` First-party App SDK compliance: covered by lifecycle metadata, shared runtime alignment, bounded observers, app compliance verification, and internal bridge classification.
- `#54` Future local apps-folder package shape: covered by package manifests, examples, schema, package verifier, composer, and custom Chromium build flow.
- `#55` Top-level settings and presets: covered by first-run setup, Performance mode/profile-pack metadata, and popup/App surface split.
- `#57` Settings schema: covered by manifest settings metadata, reset behavior, storage ownership, control metadata, and preset participation rules.
- `#58` Settings audit: covered by the settings migration audit and generated mirror verification.
- `#59` Apps & Features IA: covered by app/feature grouping, enable/open/reset roles, rail pinning, and privacy/cost metadata.
- `#60` Registry metadata: covered by first-party app registry metadata and release verifiers.
- `#61` Settings compatibility: covered by popup mirrors, storage migration notes, reset compatibility, and app settings verification.
- `#62` App chrome presets: covered by shared app chrome presets and style-guide documentation.
- `#63` Profile packs: covered by profile-pack import/export for Appearance plus Performance and safety rules for future sections.
- `#64`, `#90`, and `#39`: partially advanced by bounded Root Visuals observers and shared runtime guidance; deeper visual controls, Max long-task work, and scanner rewrites remain follow-up work.
- `#66` RemiNet Chat in X Messages: covered by placement fixes and route-scope declarations.
- `#74` Multi-site app runtime direction: advanced by site-scope metadata and privacy disclosure, while broad non-X content-runtime expansion remains future work.
- `#94` and `#96` Wiki sidebar dark-mode polish: covered by the dark-mode setting and footer styling fix.
- `#101` Local app composer/custom build: substantially advanced by the composer, build integration, and trust gates; marketplace discovery, signatures, and install/update UI remain follow-up work.
- `#102` Custom app authoring developer experience: advanced by the schema, novel verifier command, example package, and empty-folder-to-build docs.

## QA Status

Passed locally on the prepared branch:

- `pnpm.cmd run verify:release:gates`
- `git diff --check`
- `pnpm.cmd audit --json`

The release gate includes TypeScript, Chromium and Firefox profile builds, current release contract checks, filesystem layout verification, platform contracts, URL allowlists, App SDK compliance, internal messaging bridge verification, local app package and trust-gate verification, app settings mirrors, Music build checks, Post-reading distribution checks, Firefox lint classification, current extension/app smoke, release archive packaging, checksum verification, and reproducible archive verification.

Known non-live warnings:

- App SDK compliance reports the RemiNet Chat socket bridge and Wiki sidebar frame bridge as intentional internal bridges with sender restrictions.
- Firefox lint continues to report classified warnings for generated/bundled code patterns such as OCR/worker eval and innerHTML use. The release gate treats the current warning class as expected while failing on unclassified release blockers.

Manual QA still required before publishing:

- Reload the unpacked `dist/chromium` build and refresh X/Twitter.
- Open Apps & Features from the side rail.
- Confirm representative enabled and pinned apps open from the rail: Post-reading, RemiNet Chat, Beetol, Remilia Wiki Sidebar, Miladychan Portal, Music, and Milady Maxxer.
- Confirm disabled or unpinned apps are absent or reachable exactly as expected.
- Enable Composer Tools and confirm typing `--` in a post composer becomes an em dash, while DMs and search fields are ignored.
- Check Post-reading feed controls, full-quote behavior, OCR skip/status, and highlight cleanup.
- Check RemiNet/RemiStats poke state, Beetol cooldown memory, RemiNet Chat X Messages placement, and Wiki sidebar dark mode.
- Exercise a local package dry run or custom local build when validating package/composer scope.

## Upgrade Notes

Use the same safe in-place update path as earlier unpacked beta releases: replace files inside the same loaded extension folder, reload the existing extension card, and refresh X/Twitter tabs. Do not remove and re-add the extension unless you intentionally want to reset local extension storage.

Local app package support in this release is for reviewed custom-build inputs and developer testing. It is not a runtime marketplace, not a sandboxed plugin system, and not yet intended as normal-user package installation.
