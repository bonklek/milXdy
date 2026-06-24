# Contributing

milXdy is in public beta. The best contribution path depends on the kind of feedback.

## Bugs

Use GitHub Issues or the in-extension Diag tab report flow for reproducible bugs.

Good bug reports include:

- milXdy version
- browser
- feature area
- what happened
- expected behavior
- reproduction steps
- relevant console errors or screenshots, with private information removed

## Feature Ideas

Use GitHub Discussions for early ideas and roadmap feedback. Use GitHub Issues when a feature is specific enough to track as implementation work.

Before opening a feature request, check:

- [Roadmap](ROADMAP.md)
- existing Issues
- existing Discussions

## Pull Requests

For code changes:

1. Keep changes scoped.
2. Preserve feature boundaries.
3. Run:

```powershell
npm run typecheck
npm run build
```

4. Update docs when behavior changes.

## Performance Expectations

milXdy combines several X/Twitter enhancement features, so performance is a release requirement. Avoid new page-wide scans, repeated mutation observers, unbounded network calls, and eager OCR/model initialization.

