# Agent Roster And Delegation Map

This is the current agent map provided by the user, plus delegation guidance from the repo-wide insight manager.

## Active Agents

### Ideas Log

Owns:

- `ideas/running-ideas.md`
- release idea notes under `ideas/releases/`
- raw idea capture before public docs or code tasks exist.

Delegate to this agent when:

- An idea is not ready for implementation.
- A question is mostly about roadmap shape, not code.
- A feature needs parking-lot notes or release-scope brainstorming.

### Sidebar Chat

Owns:

- RemiNet chat/sidebar feature.
- Likely files: `src/features/reminetChat/`, `src/entries/reminetChatContent.ts`, chat CSS, content-loader gate, background import, build/manifest entries.

Delegate to this agent when:

- Work concerns the right-rail RemiliaNET chat UI on X/Twitter.
- Work concerns RemiNet chat WebSocket behavior, message rendering, attachments, reactions, chat profile lookups, or sidebar layout.

Coordinate with:

- Settings Menu for the enable toggle.
- Beetle Hunt and Poke Feature for shared RemiliaNET auth/session behavior.
- Release Management for whether chat is `0.2.0` or an earlier hidden/experimental toggle.

### GitHub Update Checker

Owns:

- Update status checks against GitHub releases.
- Guided update controls and release asset selection.
- Likely files: `src/shared/updateCheck.ts`, `src/background.ts`, `src/popup.ts`, popup Suite tab, update docs.

Delegate to this agent when:

- The task concerns `v*` tag comparison, prerelease selection, release zip detection, update badge behavior, or copyable update steps.

Coordinate with:

- Release Management for tag/release conventions.
- Settings Menu for Suite tab UX.
- Bug Reporting if update failures should be reportable diagnostics.

### Release Management

Owns:

- Version scope, release notes, beta tester checklist, public release docs.
- Files likely include `README.md`, `docs/RELEASE_CHANGELOG_DRAFT.md`, `docs/X_RELEASE_POST_DRAFT.md`, `docs/ROADMAP.md`, and possibly release idea files.

Delegate to this agent when:

- A change needs to be sorted into `0.1.3`, `0.1.4`, `0.1.5`, `0.1.6`, or `0.2.0`.
- A release needs a cut checklist, changelog, or tester-facing summary.
- A public doc should be updated after feature behavior changes.

Coordinate with:

- Every feature agent before final release notes.
- GitHub Update Checker for release asset naming and update logic.

### Beetle Hunt

Owns:

- Beetol hunter panel and RemiliaNET token/session work inherited from Beetol.
- Likely files: `src/features/beetol/background.js`, `src/features/beetol/content.js`, `src/features/beetol/content.css`, popup Beetol controls.

Delegate to this agent when:

- The task concerns hunting, claims, rewards, panel behavior, Beetol theme/color, or Beetol auth persistence.

Coordinate with:

- Poke Feature for shared RemiliaNET login/cookie/token behavior.
- Settings Menu for popup controls.
- Sidebar Chat if chat reuses RemiliaNET auth.

### Settings Menu

Owns:

- Popup/options UI structure, tabs, settings controls, CSS polish, diagnostics presentation.
- Likely files: `public/popup.html`, `public/popup.css`, `src/popup.ts`.

Delegate to this agent when:

- The task changes popup layout, tab organization, settings names, control behavior, visual polish, or diagnostics UI.

Coordinate with:

- All feature agents. The popup is a shared integration surface and should not become a dumping ground.

### Poke Feature

Owns:

- RemiStats/RemiNet poke buttons, cooldowns, incoming poke indicators, poke diagnostics, auth behavior needed for poke actions.
- Likely files: `src/features/remistats/content.js`, `src/features/remistats/remistats.css`, `src/features/beetol/background.js`, popup diagnostics/status.

Delegate to this agent when:

- The task concerns poke sending, cooldown rendering, incoming "poked you" flags, notification matching, or poke error reporting.

Coordinate with:

- Beetle Hunt for auth/session/token behavior.
- Settings Menu for controls and diagnostics.
- Release Management for explaining privacy/auth limitations.

### Wiki Tool And Wiki Edits

Owns:

- Remilia Wiki linking, Grok/wiki article workflows, Link Later, wiki helper bundle, wiki editing prompts.
- Likely files: `src/features/wiki/`, wiki popup controls, `public/wiki-helper/`, wiki docs.

Delegate to this agent when:

- The task concerns wiki concept matching, previews, Grok prompts, article helper, link-later flow, MediaWiki output rules, or wiki edit UX.

Coordinate with:

- Settings Menu for Wiki tab changes.
- Release Management for public workflow docs.
- Bug Reporting if Grok/X UI fragility needs report templates.

### Firefox Support

Owns:

- Browser compatibility audit and Firefox build/load strategy.
- Likely files may include manifest variants, build script variants, compatibility docs, and API wrappers if needed.

Delegate to this agent when:

- The task concerns MV3 differences, `chrome.*` versus `browser.*`, background service worker behavior, host permissions, cookies, downloads, notifications, or Firefox smoke testing.

Coordinate with:

- GitHub Update Checker, Beetle Hunt, Poke Feature, Read Aloud, and Sidebar Chat because each uses APIs or runtime behavior Firefox may handle differently.

### Bug Reporting

Owns:

- Diag tab report flows, GitHub/X report launching, copied LLM-assisted bug-report prompts, diagnostic payload quality.
- Likely files: `src/popup.ts`, `public/popup.html`, docs.

Delegate to this agent when:

- The task concerns collecting diagnostic info, generating bug reports, opening GitHub/X report destinations, or improving tester issue quality.

Coordinate with:

- Settings Menu for Diag tab UI.
- Release Management for beta tester instructions.
- Feature agents when diagnostics need feature-specific counters/errors.

### Read Aloud

Owns:

- Postreader/read-aloud controls, speech playback, custom TTS, OCR, quote fetching, keyboard shortcuts, highlighting.
- Likely files: `src/features/postreader/`, `public/ocr.html`, Tesseract asset build behavior, Reader popup controls.

Delegate to this agent when:

- The task concerns speech, OCR, custom HTTP TTS, playback controls, quote text, body highlighting, or keyboard behavior.

Coordinate with:

- Settings Menu for Reader tab controls.
- Firefox Support for Web Speech/Tesseract behavior.
- Release Management for known limits and setup docs.

## When To Create A New Agent

Create a new agent when a workstream has at least two of these traits:

- It owns a distinct user-facing feature or platform boundary.
- It will touch shared integration files repeatedly over multiple sessions.
- It has its own test/smoke workflow.
- It has independent release timing or should be hidden behind an experimental toggle.
- It creates recurring architectural questions that distract from existing agents.

Likely future agents:

- Maxxer/Classifier agent: Miladymaxxer model, ONNX worker, image recognition, collection controls, card effects.
- Performance/Scanner agent: shared X/Twitter scanner, diagnostics counters, mutation/performance budgets, cross-feature DOM behavior.
- Storage/Migration agent: namespaced storage, export/import, legacy migration, settings backup.
- Security/Privacy agent: permissions, cookies, host access, auth token handling, privacy explanations.

Do not create a new agent for one-off edits to shared files. Route those through the feature agent plus Settings/Release coordination.
