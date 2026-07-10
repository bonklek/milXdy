# milXdy Planning

This document is the short planning handoff for the current public beta. Keep durable product direction here, keep release sequencing in `docs/ROADMAP.md`, keep shipped history in `CHANGELOG.md` and release notes, and keep concrete contributor work in GitHub Issues.

## Current Baseline

The current public baseline is `0.2.2`, **Prepared App SDK Update**. It shipped as a normal GitHub release with two public browser archives:

- `milXdy-<version>-chromium.zip`
- `milXdy-<version>-firefox.zip`

Lite, Balanced, and Full are setup choices inside milXdy. They should not be treated as public release-asset categories unless the builds become meaningfully different again.

## Near-Term Release Identity

The next planned release is `0.2.3`, a focused user-experience and feature-reliability update.

The purpose of `0.2.3` is to harden the existing first-party app platform before adding more surface area. Its release work is driven by the codebase-wide UX and reliability audit in `docs/UX_RELIABILITY_AUDIT.md`, especially:

- failure-isolated runtime lifecycle, bootstrap, scanners, and network queues
- cancelable and latest-intent-owned asynchronous feature work
- reversible feature teardown and bounded caches/resources
- honest error, clipboard, storage, authentication, and recovery states
- keyboard-operable app management, modal focus, labels, and reduced motion
- regression coverage for the specific audit findings

This is not a `0.2.2.1` hotfix line. Unpublished hotfix work is folded into `0.2.3`; release notes and version metadata must use `0.2.3` consistently.

## Planning Source Of Truth

- `docs/ROADMAP.md`: public release sequencing and product direction.
- `docs/APP_SDK.md`: developer-facing app contract and future package shape.
- `docs/DOCS_MAINTENANCE.md`: how roadmap, issues, milestones, docs, and releases stay aligned.
- GitHub Issues: concrete work with acceptance criteria.
- GitHub Milestones: target release grouping.

Do not let this file become a second roadmap or issue registry.

## 0.2.3 Planning Buckets

### Runtime And Recovery

- Isolate lifecycle, surface-delivery, and scheduler failures so one app cannot stall the suite.
- Make document-start bootstrap and scanner installation retryable and observable.
- Bound shared network work and release queue capacity after timeouts.

### Feature Reliability

- Give long-running work cancellation, deadlines, and stale-response guards.
- Make disable/dispose fully restore DOM and stop speech, workers, frames, sockets, and media.
- Bound caches and large in-memory payload paths.

### UX And Accessibility

- Keep visible controls reconciled with persisted storage after errors.
- Confirm destructive resets and preserve user-authored content unless explicitly chosen.
- Provide keyboard reorder controls, modal focus containment/restoration, accessible names, and reduced-motion behavior.

### Verification And Release Evidence

- Add focused regression checks for every repaired audit contract.
- Run strict TypeScript, platform/app verifiers, current and historical smoke, Chromium/Firefox builds, Firefox lint, and release-current verification.
- Keep authenticated X/RemiliaNET and permission-gated Music scenarios explicitly listed for manual release QA.

## Out Of Scope For 0.2.3 Unless Rescheduled

- Remote app marketplace installation.
- Store-style app review and automated trust infrastructure.
- Major new social/media features whose main value is not reliability.
- `0.3.0` front-door onboarding, screenshots, and non-technical walkthrough work.

## Planning Hygiene

Before changing roadmap or planning docs:

1. Check current GitHub releases.
2. Check open issues and milestones.
3. Update `docs/ROADMAP.md` and GitHub milestone descriptions together when release identity changes.
4. Keep detailed implementation tasks in issues, not the roadmap.
5. Search for stale names such as `Postreader`, `Diag`, `prerelease`, and old release-asset profile wording.
