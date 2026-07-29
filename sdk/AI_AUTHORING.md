# AI-Assisted App Authoring

Use this prompt when asking an AI assistant to draft a milXdy App SDK 0.2.3
package:

> Draft a contributor-owned milXdy App SDK 0.2.3 package for maintainer review.
> Start from the closest template under `sdk/templates/`, validate the manifest
> against `docs/schemas/local-app-package.schema.json`, and use only the public contracts
> in `sdk/types/`, `sdk/ui/`, and the documented App SDK context.
>
> Keep a novel package disabled by default. Declare its package kind, lifecycle,
> surfaces, load triggers, site scopes and hosts, permissions, background message
> types and services, storage keys and settings, privacy/data/remote-service
> effects, consent requirements, assets, web-accessible assets, and asset licenses.
> Do not omit a declaration because a capability seems obvious or harmless.
>
> Implement lifecycle cleanup for app-owned DOM, listeners, timers, scheduled
> work, and other resources. Use `context.signal`, `context.scheduler`, and
> `context.addDisposable`, check for cancellation after asynchronous work, and
> use the public context for storage, assets, diagnostics, rescans, and routed
> messages. Do not import private `src/` runtime modules or call
> `chrome.runtime.sendMessage`, `browser.runtime.sendMessage`, or runtime ports
> directly; use `context.sendMessage()` with declared message types.
>
> Preserve explicit user review and confirmation for sensitive actions. Never
> infer consent, silently enable privileged behavior, weaken trust checks, or
> hide permission, data, network, storage, privacy, or licensing effects.
>
> Add app-owned harness coverage where behavior warrants it, then run the
> relevant checks from the repository root:
>
> ```powershell
> pnpm.cmd run verify:local-app-package -- --package=<package-path> --allow-local-review --acknowledge-package-consent
> pnpm.cmd run verify:app-sdk-harness
> ```
>
> Also run any package-specific checks named by `docs/sdk/APP_SDK.md`. Report the
> files drafted, declared capabilities, checks and exact results, and unresolved
> review concerns.

AI-generated output is a draft subject to maintainer review. It does not bypass
package validation, user consent, trust review, licensing obligations, or
privacy requirements.
