# Localization

milXdy `0.2.4` localizes browser-provided extension metadata. Chromium and Firefox select a catalog from the browser locale and fall back to English through `manifest.default_locale`.

## Current Scope

- English is the fallback catalog.
- Russian extension name and description metadata were contributed in PR #109.
- Popup, Apps & Features, rail, and injected in-page controls remain English.
- Spanish and Japanese in-app catalogs from the initial proposal are not enabled because they have not received fluent review.

The intentionally narrow scope keeps localization from changing arbitrary text nodes, dynamic values, accessible names, or stored setting values. Broader UI localization should use stable message keys at each owned rendering site rather than exact-text DOM replacement.

## Adding Or Updating A Locale

1. Add `assets/extension/_locales/<locale>/messages.json` using the same keys as the English catalog.
2. Have every user-facing translation reviewed by a fluent speaker and record that provenance in the pull request.
3. Run `npm.cmd run verify:locales`, `npm.cmd run build:all`, and the relevant popup/runtime smoke checks.
4. Check the built extension in a browser configured for that locale, including truncation, accessible names, dynamic substitutions, and English fallback.

`scripts/verify/locales.mjs` rejects missing or extra catalog keys, empty messages, malformed manifest references, and catalogs without the default fallback keys. Release builds copy `_locales` into every browser target.
