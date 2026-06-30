# milXdy Planning

This document is the short planning handoff for the current public beta. Keep durable product direction here, keep release sequencing in `docs/ROADMAP.md`, keep shipped history in `CHANGELOG.md` and release notes, and keep concrete contributor work in GitHub Issues.

## Current Baseline

The current public baseline is `0.2.1`, **The Polish Patch**. It shipped as a normal GitHub release with two public browser archives:

- `milXdy-<version>-chromium.zip`
- `milXdy-<version>-firefox.zip`

Lite, Balanced, and Full are setup choices inside milXdy. They should not be treated as public release-asset categories unless the builds become meaningfully different again.

## Near-Term Release Identity

The next planned release is `0.2.2`, **Prepared App SDK**.

The purpose of `0.2.2` is to turn the current local-first app platform into a clearer SDK preparation layer. This does not mean shipping remote community app installation yet. It means first-party apps should be shaped like future SDK apps:

- clear app/package boundaries
- stable lifecycle hooks
- manifest-owned metadata
- shared scanner/runtime services
- consistent dock/window behavior
- app settings schema expectations
- reviewable privacy, permission, storage, and performance disclosures
- diagnostics that show whether the platform is actually cheaper and more maintainable

Diagnostics, app rail/windowing, and settings IA belong in `0.2.2` when they support SDK readiness. They should not displace the release identity.

## Planning Source Of Truth

- `docs/ROADMAP.md`: public release sequencing and product direction.
- `docs/APP_SDK.md`: developer-facing app contract and future package shape.
- `docs/DOCS_MAINTENANCE.md`: how roadmap, issues, milestones, docs, and releases stay aligned.
- GitHub Issues: concrete work with acceptance criteria.
- GitHub Milestones: target release grouping.

Do not let this file become a second roadmap or issue registry.

## 0.2.2 Planning Buckets

### App Package Boundaries

- Define the default first-party app folder/package layout.
- Keep app metadata in the registry where possible instead of scattering app descriptions across UI, docs, and build scripts.
- Preserve shared runtime services for expensive X/Twitter work instead of letting apps reintroduce independent observers, pollers, or network queues.

### Lifecycle And Runtime Contract

- Stabilize app hooks for boot, enable, disable, route changes, surface delivery, overlay open/close, and dispose.
- Require async work to respect runtime abort signals.
- Keep invoked-only tools such as export/render actions lazy.
- Make app enablement and rail pinning separate concepts.

### Settings And Presets

- Treat Lite, Balanced, and Full as setup/settings presets inside milXdy.
- Keep browser downloads simple: Chromium or Firefox.
- Move app and feature settings toward an Apps and Features information architecture.
- Make settings export/import/profile packs a user-facing follow-up only after the schema is coherent.

### App Chrome, Rail, And Windowing

- Harden docked app layout, protected zones, snap behavior, restore behavior, and narrow-viewport recovery.
- Keep app header controls clickable and distinguish drag handles from controls.
- Make the rail scalable when the number of app surfaces grows.
- Document contributor-facing utility-window style so future apps feel native to milXdy.

### Diagnostics

- Keep diagnostics tied to release decisions.
- Measure Max and other heavy app paths with long-task, frame-gap, FPS, feature timing, queue depth, and scanner counters.
- Use those measurements before committing to deeper scanner rewrites.
- Make reports useful from the Health panel without requiring DevTools.

## Out Of Scope For 0.2.2 Unless Rescheduled

- Remote app marketplace installation.
- Store-style app review and automated trust infrastructure.
- Major new social/media features whose main value is not SDK preparation.
- `0.3.0` front-door onboarding, screenshots, and non-technical walkthrough work.

## Planning Hygiene

Before changing roadmap or planning docs:

1. Check current GitHub releases.
2. Check open issues and milestones.
3. Update `docs/ROADMAP.md` and GitHub milestone descriptions together when release identity changes.
4. Keep detailed implementation tasks in issues, not the roadmap.
5. Search for stale names such as `Postreader`, `Diag`, `prerelease`, and old release-asset profile wording.
