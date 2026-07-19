# milXdy Senior Code Review Remediation Plan

Date: 2026-06-27

Reviewer stance: this is not a cleanup list. Treat it as a product-quality bar for a browser extension that runs on social pages, handles authenticated RemiliaNET actions, injects UI into a hostile/changing DOM, and ships to Firefox/Chromium users. The work is intentionally demanding. The expected outcome is not only fewer bugs; it is a codebase whose security model, feature boundaries, and quality gates are explicit enough that future changes are harder to get wrong.

## Release Bar

No release candidate should be cut until all of these pass from a clean checkout:

```powershell
npm.cmd run typecheck
npm.cmd run build:all
npm.cmd run verify:music
npm.cmd run lint:firefox
npm.cmd test
```

Add a single `npm.cmd run verify` script that runs the complete gate. A build passing while TypeScript fails is not acceptable. The current state fails `typecheck` in `src/features/reminetChat/content.ts` around the media hydration path, while `build:all` still succeeds. That mismatch must be eliminated.

Acceptance criteria:

- `npm.cmd run verify` exists and exits nonzero on typecheck, build, lint, or test failure.
- The repository has no known TypeScript errors.
- Firefox lint has no first-party unsafe `innerHTML` warnings left. Any third-party dependency warnings are documented in a short allowlist with rationale.
- New features are not accepted unless they include tests or a written reason why automated tests are impossible.

## 1. Secure Background Messaging

The most important remediation is to define and enforce the extension's trust boundary. Background handlers currently route privileged messages by shape. That is not enough for code that can read cookies, set auth cookies, upload media, fetch authenticated RemiliaNET data, proxy media, and call external APIs.

Required work:

- Add a shared background authorization layer in `src/shared/backgroundRouter.ts`.
- Every registered handler must declare allowed sender contexts, for example X/Twitter content script, extension popup/options, extension iframe, or internal-only.
- Reject messages unless `sender.id === chrome.runtime.id`.
- For content-script messages, validate `sender.url` or `sender.tab.url` against the exact origins expected by the feature.
- For extension-page messages, validate the sender is an extension URL.
- Add per-handler URL allowlists for message payloads that trigger network fetches.
- Add tests proving unauthorized senders are rejected before handler code runs.

Acceptance criteria:

- `reminetChat:*`, `beetol:*`, `music:*`, `miladychan:*`, `remistats:getUser`, `postreader:*`, and update-check messages all have explicit sender policies.
- No handler reaches token, cookie, upload, or network code before sender authorization.
- Tests cover valid sender, wrong extension id, missing sender URL, disallowed page origin, and malformed payload.
- The policy is documented in code comments near the router, not scattered across feature handlers.

High bar:

- Make unauthorized background calls observable through diagnostics without exposing sensitive payloads.
- Add a small typed message schema helper so matching, sender policy, and handler types stay together.

## 2. Rework Auth And Credential Storage

Beetol and RemiNet Chat share RemiliaNET auth concepts and currently store access and refresh tokens in `chrome.storage.local`. They also write an `authToken` cookie for RemiliaNET. This should be treated as sensitive credential infrastructure, not feature-local convenience code.

Required work:

- Create a single RemiliaNET auth service in the background layer.
- Remove duplicated auth flows from Beetol and RemiNet Chat.
- Define exactly which tokens are stored, why they are stored, and their lifetime.
- Prefer adopting the browser session only when needed rather than persisting long-lived credentials by default.
- Ensure logout clears all current and legacy token keys and cookies.
- Add defensive migration for legacy keys without preserving stale credentials indefinitely.
- Add tests for migration, disconnect state, refresh failure, logout, and session adoption.

Acceptance criteria:

- Only one module owns RemiliaNET auth.
- Feature code requests auth status/actions through the service; it does not read/write token keys directly.
- Token/cookie storage keys are named, documented, and covered by tests.
- A failed refresh does not leave stale access tokens pretending to be valid.
- Logout/disconnect behavior is consistent between Beetol and RemiNet Chat.

High bar:

- Add a threat-model note to docs describing credential risks and mitigations.
- Add a diagnostics view that reports signed-in state and token source without exposing token values.

## 3. Reduce Manifest Permissions

The manifest currently requests broad permissions, including `cookies`, `tabs`, `scripting`, `unlimitedStorage`, localhost hosts, and multiple remote services. Browser extension users and review tooling will judge the product by this surface area.

Required work:

- Audit every manifest permission and host permission.
- Remove permissions that are not used.
- Remove localhost permissions from production builds unless there is a documented release reason.
- Generate or transform manifests per target and per enabled feature where practical.
- Use `src/shared/firstPartyApps.json` as the source of truth for feature host needs.
- Add Firefox `browser_specific_settings.gecko.data_collection_permissions` or the equivalent expected property to satisfy current web-ext notices.

Acceptance criteria:

- A reviewer can trace each permission to a feature and code path.
- `scripting` is removed unless an actual runtime injection path requires it.
- `unlimitedStorage` is justified or removed.
- Host permissions are not broader than the feature code needs.
- Production manifests do not include dev-only hosts.

High bar:

- Add a script that fails if a feature declares hosts in code or docs but the generated manifest does not match.
- Add a permissions table to `docs/PRIVACY_AND_PERMISSIONS.md`.

## 4. Ban Dynamic HTML For Untrusted Data

The codebase uses `innerHTML` heavily. Some uses are harmless constant templates. Others render API data, user names, profile fields, chat messages, media URLs, tooltip content, or page-derived strings. Manual escaping helps but is not a robust product-wide standard.

Required work:

- Define a rendering rule: remote/user/page data must be assigned through `textContent`, DOM attributes, or typed DOM builder helpers.
- Reserve `innerHTML` for static compile-time templates only.
- Replace RemiStats tooltip HTML stored in `dataset.reminetTooltipHtml` with structured data or live DOM creation.
- Replace RemiNet Chat message rendering with DOM builders for messages, reactions, attachments, reply previews, and pending attachments.
- Replace popup diagnostic `innerHTML` with element creation.
- Audit Postreader, Wiki, Beetol, Milady Maxxer, Tweet PNG, Music, and Spotlight for dynamic HTML.
- Add an ESLint or custom grep-based verification that fails on dynamic `innerHTML` unless allowlisted.

Acceptance criteria:

- Firefox lint no longer reports first-party unsafe `innerHTML` warnings.
- No API/user/page data is interpolated into HTML strings.
- Tests prove malicious display names, handles, chat bodies, attachment names, profile fields, and wiki text render as text, not markup.
- Rendering helpers are small and local; do not introduce a large framework just to solve this.

High bar:

- Build a tiny typed DOM helper for common patterns: `button`, `link`, `img`, `row`, `field`, `emptyState`.
- Keep render functions readable enough that a reviewer can tell which values are text, URLs, CSS values, and dataset values.

## 5. Put Hard Limits On Uploads, Media Proxies, And Network Tasks

The extension proxies images/media through background code and accepts attachment uploads. Without caps, this can create memory pressure, slowdowns, accidental abuse, or security-review objections.

Required work:

- Add maximum upload size before decoding `data:` URLs.
- Add explicit MIME allowlists for images and videos.
- Reject oversized data URLs before calling `fetch(dataUrl)`.
- Add response-size caps when converting remote media to data URLs.
- Add `AbortController` timeouts to all background fetches.
- Add per-feature network rate limits or queue labels that can be enforced.
- Ensure base64 conversions cannot process unbounded blobs.

Acceptance criteria:

- RemiNet Chat upload rejects oversized files with a user-visible error.
- Media proxy rejects unsupported MIME, unsupported host, and oversized responses.
- Music image proxy and Milady image fetch paths use the same limit concepts.
- Tests cover invalid data URL, too-large image, too-large video, wrong MIME, disallowed host, timeout, and successful small media.

High bar:

- Centralize safe fetch helpers in the background layer.
- Add diagnostics for network queue depth, timeout count, rejected oversized responses, and per-feature request count.

## 6. Migrate Legacy JavaScript To TypeScript

Large security- and UI-sensitive modules remain plain JavaScript while the repo claims strict TypeScript. `allowJs` with `checkJs: false` is a temporary bridge, not an acceptable long-term state.

Required work:

- Convert `src/features/beetol/background.js` to TypeScript first.
- Convert `src/features/beetol/content.js` second.
- Convert `src/features/remistats/content.js`, `background.js`, and `sounds.js` after Beetol.
- Add explicit types for API responses, storage records, cooldowns, score data, tooltip data, poke actions, and inventory items.
- Remove or shrink `allowJs` once migrations are complete.
- Do not silence errors with broad `any`; use `unknown` at boundaries and normalize.

Acceptance criteria:

- Converted modules pass strict TypeScript.
- No new `as any`, `@ts-ignore`, or broad `Record<string, any>` escapes are introduced.
- Runtime behavior is preserved with tests around normalization and message handling.
- The final `tsconfig` either disables `allowJs` or has a documented reason for any remaining JS.

High bar:

- Split giant content modules into small files by responsibility: API normalization, rendering, DOM placement, storage, sounds, and feature boot.
- Keep public feature entry files thin.

## 7. Build A Real Test Suite

This project has complex parsing, URL validation, DOM extraction, auth state, scheduling, rendering, and storage normalization. It currently has tooling for tests but no meaningful tests. That has to change.

Required test coverage:

- Background sender authorization and message schema validation.
- URL allowlists for GitHub, RemiStats, RemiliaNET, Miladychan, MusicBrainz, AcoustID, pbs.twimg.com, and miladymaker.
- RemiliaNET auth migration, refresh, disconnect, logout, and cookie sync.
- RemiNet Chat renderers with malicious input.
- RemiStats tooltip/rendering with malicious profile fields.
- Postreader settings normalization and keybind normalization.
- Update version comparison and release selection.
- Twitter scanner handle/status extraction and route blocklist behavior.
- Music metadata normalization, file import edge cases, AcoustID key persistence, and image MIME validation.

Acceptance criteria:

- `npm.cmd test` exists.
- Tests run headlessly and do not require network.
- Network calls are mocked at module boundaries.
- At least one regression test is added for every P0/P1 fix.
- Test names describe the behavior, not the implementation detail.

High bar:

- Add a small browser smoke test that loads the built extension page or popup and verifies no boot errors.
- Add DOM tests for scanner/rendering code using realistic X/Twitter fixture snippets.

## 8. Improve Runtime Architecture And Feature Boundaries

The new app registry, lazy bundles, shared scanner, and runtime scheduler are good foundations. The next step is making boundaries enforceable.

Required work:

- Treat `firstPartyApps.json` as the product manifest for each feature.
- Each feature must declare storage keys, message types, host permissions, assets, CSS, load triggers, and cost class.
- Add verification that declared assets and required outputs exist after build.
- Add verification that feature message types have background handlers and sender policies.
- Keep startup bootstrap small; heavy features must lazy-load through explicit triggers.
- Ensure every feature implements teardown for listeners, observers, timers, sockets, object URLs, and audio where applicable.

Acceptance criteria:

- Adding a new feature requires updating one manifest entry and one feature entry point.
- Missing assets, missing background handlers, undeclared message types, or undeclared hosts fail verification.
- Disabling a feature removes UI, listeners, pending network tasks, dock registrations, and injected runtime state.
- The content bootstrap remains free of heavy implementation strings and large dependencies.

High bar:

- Add a generated feature report in diagnostics listing loaded bundles, deferred bundles, pending network tasks, scanner load, and recent feature errors.
- Add performance budgets per feature and fail diagnostics if a feature exceeds them in developer mode.

## 9. Normalize Storage And Settings

Storage keys are spread across local and sync areas with legacy names, feature-specific names, and shared visual settings. This makes migrations and debugging fragile.

Required work:

- Create a storage key registry.
- Document local vs sync rationale for each key.
- Normalize migrations through explicit versioned migration functions.
- Avoid generic keys like `enabled` and `mode` for feature settings unless namespaced.
- Validate all storage reads with normalizers.

Acceptance criteria:

- Every storage key used in code appears in one registry or a documented exception.
- No new generic unnamespaced keys are introduced.
- Migrations are idempotent and tested.
- Popup settings, feature enablement, and runtime diagnostics read from the same source of truth.

High bar:

- Add an export/import debug action that redacts credentials and produces a coherent settings snapshot.

## 10. Fix Update Checking And External Fetch Behavior

Update checking and external API calls should be bounded, testable, and polite.

Required work:

- Add fetch timeouts to update checks.
- Add backoff after GitHub failures or rate limits.
- Confirm whether prerelease-only selection is intentional.
- Add tests for version normalization, prerelease filtering, draft filtering, missing assets, and rate-limit failures.
- Avoid running duplicate checks on install/startup/alarm within a short window.

Acceptance criteria:

- Update checks cannot hang indefinitely.
- Repeated failures do not hammer GitHub.
- Popup update status can distinguish no update, failed check, rate limited, and update available.
- Release asset choice is deterministic and tested.

High bar:

- Add a manual "copy update diagnostics" action for support reports.

## 11. Clean Temporary Artifacts And Encoding

There is an untracked `.tmp-video-frames/` folder and visible mojibake in music UI strings. These are small issues, but they signal weak repo hygiene.

Required work:

- Add `.tmp-video-frames/` to `.gitignore` or move it under an already ignored temp path.
- Fix mojibake in `src/features/music/content.ts`.
- Add `.editorconfig` or equivalent formatting expectations for charset and line endings.
- Normalize line endings intentionally instead of letting Git produce noisy CRLF warnings.

Acceptance criteria:

- `git status --short` does not show generated frame artifacts.
- UI strings render correctly.
- Future edits do not churn entire files due to line ending changes.

## 12. Documentation Expectations

The junior engineer should document decisions that affect users, reviewers, or future maintainers. Do not write essays in code comments; write compact docs where product behavior or security assumptions matter.

Required docs:

- Permission rationale in `docs/PRIVACY_AND_PERMISSIONS.md`.
- Auth/token threat model and logout behavior.
- Feature architecture: registry, content runtime, background router, scanner, and dock.
- Verification commands and release gate.
- Known third-party lint warnings and accepted risk.

Acceptance criteria:

- A new contributor can explain why each major permission exists.
- A reviewer can identify where privileged messages are authorized.
- A maintainer can add a new feature without copying a legacy module.
- A release manager can run one command and know whether the workspace is releasable.

## Suggested Implementation Order

1. Fix typecheck and create the unified `verify` script.
2. Add tests around the current background router, then implement sender authorization.
3. Centralize RemiliaNET auth and migrate Beetol/RemiNet Chat to it.
4. Add network/media/upload limits.
5. Replace dynamic HTML for RemiStats and RemiNet Chat.
6. Migrate Beetol background/content to TypeScript.
7. Migrate RemiStats to TypeScript.
8. Generate/audit permissions from feature metadata.
9. Expand tests and diagnostics.
10. Clean docs, temp artifacts, encoding, and release notes.

## Definition Of Done

This remediation is complete when the codebase can answer these questions with code, tests, or docs:

- Who is allowed to send each privileged background message?
- Which feature owns each permission, host, storage key, asset, and bundle?
- What happens when auth refresh fails?
- What prevents untrusted chat/profile/wiki/page data from becoming HTML?
- What prevents oversized files or media responses from exhausting memory?
- What proves a build is releasable?
- What tests fail if a future change weakens any of the above?

If any answer is "the developer knows", the work is not done. The standard is that the system enforces the rule or the repository documents it so clearly that the next reviewer can hold the line.
