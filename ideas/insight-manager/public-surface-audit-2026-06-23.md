# Public Surface Audit - 2026-06-23

Goal: identify information the public repo/docs do not need to say, especially before `0.1.3`.

This is not a secret-leak audit only. The larger issue is over-explaining internal mechanics, agent workflow, release planning, and auth implementation in public-facing docs.

## Executive Summary

No obvious hardcoded private secret was found in the scanned public/tracked surface. The concern is over-disclosure:

- public docs expose internal agent/maintainer process
- public docs describe auth/cookie/token implementation more specifically than users need
- release notes and roadmap announce too much future/incomplete surface
- bug-report and diagnostics docs describe internals more than tester guidance requires
- RemiNet Chat appears over-promoted for `0.1.3` if it is still experimental/off-by-default

Recommended immediate posture for `0.1.3`: public docs should say what users need to install, update, use, and report bugs. Move implementation details, agent setup, change inventory, and speculative roadmap material out of the public docs index.

## Highest Priority Cuts Before 0.1.3

### 1. Remove internal docs from the public docs index

Current public index links:

- `docs/AGENT_SETUP_GUIDE.md`
- `docs/CHANGE_INVENTORY.md`
- `docs/RELEASES.md`

Recommendation:

- Remove `AGENT_SETUP_GUIDE.md` and `CHANGE_INVENTORY.md` from `docs/INDEX.md`.
- Consider moving both to `ideas/` after release, or keep them unlinked if they must remain tracked.
- `RELEASES.md` can stay public only if shortened to basic build/release commands. Anything about "no personal identifiers", release process internals, and exact asset checks can be maintainer-private.

Rationale:

- `AGENT_SETUP_GUIDE.md` is explicitly for assistants/automation agents and contains DevTools scripts, storage migration internals, and detailed verification procedures.
- `CHANGE_INVENTORY.md` is an internal map from local behavior to docs. It exposes implementation decisions and known doc gaps.

### 2. Reduce auth/token/cookie implementation detail

Files with too much detail:

- `docs/USER_GUIDE.md`
- `docs/PRIVACY_AND_PERMISSIONS.md`
- `docs/CHANGE_INVENTORY.md`
- `docs/RELEASE_NOTES_0.1.2.md`
- `docs/RELEASE_NOTES_0.1.3.md`

Current public phrasing includes:

- access and refresh tokens stored in Chrome extension local storage
- sets a short-lived RemiliaNET `authToken` cookie from the local access token
- mirrors RemiliaNET client behavior
- password-grant popup flow
- future OAuth authorization-code/PKCE flow
- `/api/profile/whoami`
- cookie-backed API paths

Recommended public replacement:

> RemiNet actions require RemiliaNET login. milXdy stores login state in Chrome extension storage and uses the browser cookies permission only for RemiliaNET requests. Passwords are sent to RemiliaNET for login and are not stored by milXdy.

Keep high-level user impact:

- passwords are not stored
- login state persists only while the same extension identity/folder is kept
- removing/reloading as a different extension can reset local data
- accounts with 2FA may need browser SSO/retry

Cut from public docs:

- exact token names
- exact cookie name
- exact API endpoints
- grant-flow naming
- future OAuth design detail

### 3. Downplay or remove RemiNet Chat from 0.1.3 public release materials if not fully intended to ship

Files currently publicizing chat:

- `README.md`
- `docs/USER_GUIDE.md`
- `docs/PRIVACY_AND_PERMISSIONS.md`
- `docs/TROUBLESHOOTING.md`
- `docs/RELEASE_NOTES_0.1.3.md`
- `docs/ROADMAP.md`
- `CHANGELOG.md`

Current wording says chat supports:

- history
- live WebSocket updates
- reactions
- pokes
- attachments
- media previews/fetches
- profile lookups
- minimized mode

Recommendation:

- If chat is not a core `0.1.3` deliverable, remove it from README highlights and 0.1.3 release notes.
- Keep only a short experimental note in user guide if the toggle ships:
  > Experimental RemiNet Chat is off by default and may be enabled from the RemiNet tab for testing.
- Avoid listing all capabilities publicly until the feature has been smoke-tested and support expectations are clear.

Rationale:

- Listing full capability surface creates a support promise.
- Chat brings extra auth, WebSocket, media, attachment, and privacy expectations.

### 4. Shorten the public roadmap

`docs/ROADMAP.md` exposes too much:

- exact speculative feature names
- `$CULT token cheer`
- ENS/ETH address discovery
- Miladychan discovery
- public lookup/sync service
- possible updater architecture
- suggested labels and milestones

Recommendation:

- For public 0.1.3, either remove Roadmap from README/docs index or replace with a short "Public Beta Direction" page.
- Move detailed roadmap to `ideas/` until the release is out.

Public-safe roadmap shape:

- near-term: update UX, bug reporting, docs, stability
- later: browser compatibility, settings presets, performance, import/export
- experimental: RemiNet social surfaces and companion tools

Cut:

- on-chain/address discovery details
- exact future feature concepts not yet committed
- internal labels/milestones
- "already shipped or mostly shipped" internal release accounting

### 5. Keep diagnostics user-facing, not implementation-facing

Files:

- `docs/USER_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
- `docs/AGENT_SETUP_GUIDE.md`
- `src/popup.ts` visible strings

Public docs currently mention:

- loaded bundles
- scanner state
- detection queue
- matched accounts
- before/after poke state
- auth method attempts

Recommendation:

- Public docs should say:
  > The Health tab shows diagnostic information you can include in bug reports.
- Do not list internal counters unless a tester needs to read them.
- In popup UI, consider replacing detailed poke diagnostic text with a copyable "diagnostic details" block or hiding it behind a disclosure.

Immediate doc cut:

- remove granular descriptions of what diagnostics contain, especially auth attempt details.

## Medium Priority Cuts

### Public release notes say too much implementation detail

`docs/RELEASE_NOTES_0.1.2.md` and `docs/RELEASE_NOTES_0.1.3.md` read like engineering changelogs. They should be compressed for users.

For public release notes, prefer:

- Added guided update controls.
- Improved RemiNet poke status and incoming poke indicators.
- Improved Beetol/RemiNet login persistence.
- Reorganized popup tabs.
- Updated docs and feedback flow.

Avoid:

- exact storage/cookie/API details
- exact matching heuristics
- exact internal diagnostics
- "release-planning infrastructure"

### Public docs mention AI/agent process too much

Files:

- `docs/AGENT_SETUP_GUIDE.md`
- `public/wiki-helper/remilia-wiki-article-writer/SKILL.md`
- `public/popup.html`
- `src/popup.ts`

The shipped wiki helper is intentionally an AI-facing artifact, so that can exist. But public docs do not need to foreground agent setup and Codex-style workflows.

Recommendation:

- Keep the AI helper as a downloadable feature if intended.
- Remove `AGENT_SETUP_GUIDE.md` from public docs index.
- In user docs, describe the feature as "AI article helper" rather than exposing local-agent command detail.

### Localhost permissions need explanation or removal

`public/manifest.json` includes:

- `http://localhost/*`
- `http://127.0.0.1/*`

This is probably for custom local TTS. Public privacy docs should state this plainly if retained:

> Localhost access is used only when the user configures a custom local TTS endpoint.

If custom local TTS is not central to `0.1.3`, consider whether the host permissions can be optional/later.

## What Can Stay Public

Safe and useful:

- concise install/update instructions
- same-folder update warning
- high-level feature list
- high-level network destinations by domain
- "passwords are not stored"
- "local OCR/model inference"
- "RemiNet chat is off by default" if chat ships
- "diagnostics are optional and local unless included in a report"
- credits/upstream repositories
- license information

## Suggested Public Doc Set For 0.1.3

Keep linked:

- `README.md`
- `CHANGELOG.md`
- `docs/INSTALL_AND_UPDATE.md`
- `docs/USER_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
- `docs/PRIVACY_AND_PERMISSIONS.md`
- `docs/CONTRIBUTING.md`

Optional:

- `docs/RELEASE_NOTES_0.1.3.md`, shortened

Remove from public index:

- `docs/AGENT_SETUP_GUIDE.md`
- `docs/CHANGE_INVENTORY.md`
- `docs/RELEASES.md` unless shortened
- `docs/ROADMAP.md` unless greatly simplified
- old detailed `docs/RELEASE_NOTES_0.1.2.md` from main docs nav

## Suggested Immediate Assignments

For 0.1.3, do not ask every agent for reports. Assign edits narrowly:

- Release Management: cut README/docs/release notes down to public-safe scope.
- GitHub Update Checker: verify update docs are accurate but concise.
- Poke Feature/Beetle Hunt: approve high-level auth/privacy wording.
- Settings Menu: reduce visible diagnostic/auth copy if it overexplains.

## One-Sentence Policy

Public docs should explain user-visible behavior, data destinations, and safe operation. Implementation details, internal process, exact auth mechanics, agent workflows, and speculative roadmap should live in `ideas/` or maintainer-only notes.
