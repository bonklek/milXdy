# Codebase Change Inventory

This inventory maps the current local codebase behavior to user-facing documentation. Keep it updated when adding feature behavior that a tester or beta user needs to understand.

## Current Local Changes

| Area | Changed behavior | User documentation status |
| --- | --- | --- |
| RemiNet connector auth | Adds `cookies` permission, sets a short-lived RemiliaNET `authToken` cookie from the stored access token, sends RemiliaNET API requests with cookies, verifies auth with `/api/profile/whoami`, and clears the cookie on logout. | Documented in `README.md` privacy notes and `docs/USER_GUIDE.md` Beetol login section. |
| Beetol login persistence | Uses `chrome.storage.local` access/refresh tokens and refreshes login state from a stored refresh token when possible. | Documented in `README.md`, `docs/USER_GUIDE.md`, and `docs/AGENT_SETUP_GUIDE.md`. |
| RemiliaNET SSO fallback | Adds **Open RemiliaNET SSO** and **Retry session** for 2FA/browser-session testing. | Documented in `README.md`, `docs/USER_GUIDE.md`, and `docs/AGENT_SETUP_GUIDE.md`. |
| Popup auth status | Adds signed-in styling and explanatory auth detail text for RemiNet connector status. | Documented indirectly in `docs/USER_GUIDE.md`; no separate screenshot guide yet. |
| RemiStats poke UX | Poke button shakes while sending, handles cooldown response fields, displays live cooldown text, assumes 24h fallback cooldown, verifies poke results, stores last local poke diagnostic, and groups profile badges with poke buttons. | Documented in `README.md` feature overview/privacy notes and `docs/USER_GUIDE.md` RemiNet connector section. |
| RemiStats styling | Adds profile badge grouping, cooldown pill styling, and shake animation. | Covered by RemiNet poke UX docs. |
| Wiki Grok context menus | Replaces single Grok action with submenu modes: post seed, generic article prompt, and profile article prompt. | Documented in `README.md`, `docs/USER_GUIDE.md`, and `docs/AGENT_SETUP_GUIDE.md`. |
| Wiki Grok workflow | Adds **One-shot draft** and **Socratic research** modes. Socratic opens Grok's conversation view and sends staged scout, source, plan, and draft prompts. | Documented in `README.md`, `docs/USER_GUIDE.md`, and `docs/AGENT_SETUP_GUIDE.md`. |
| Wiki Grok prompt | Adds Remilia Wiki style guidance, citation template rules, commit-summary request, profile notability checks, and Grok render-artifact warnings. | Documented in `README.md` and `docs/USER_GUIDE.md`; exact prompt is intentionally not copied in full. |
| Wiki Grok activation | Detects Grok actions, Explain this post, and Profile Summary controls; dispatches pointer/mouse events instead of a simple click. | Covered in agent verification guide; user guide describes expected behavior. |
| Wiki new-page shortcut | Shows draggable Remilia Wiki shortcut after Grok prompt, opens templated new-page editor, snaps to viewport edges, and avoids Beetol overlap. | Documented in `README.md`, `docs/USER_GUIDE.md`, and `docs/AGENT_SETUP_GUIDE.md`. |
| Wiki popup copy | Updates Wiki tab helper text to mention Grok prompts and shortcut. | Present in popup copy and user guide. |
| Bug reporting | Diag tab opens bug reports through GitHub or X and optionally copies an LLM-assisted Socratic bug-report prompt before opening the destination. | Documented in `README.md` and `docs/USER_GUIDE.md`. |

## Documentation Gaps To Close Later

- Add screenshots or short GIFs for the popup tabs, Grok shortcut, RemiNet login state, and poke cooldown state.
- Add a beta tester checklist that is shorter than `docs/AGENT_SETUP_GUIDE.md` and less detailed than this inventory.
- Add a security/privacy page if the `cookies` permission causes user concern during install.
- Add a known-limits page for RemiliaNET 2FA, Grok UI fragility, OCR accuracy, and X/Twitter DOM changes.
- Add release-note templates so each beta release calls out permissions, persistence, and migration behavior.
