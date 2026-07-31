# App SDK UI Kit

`ui/theme.css` and `ui/overlay.css` are the supported App SDK 0.2.4 UI
baseline. Copy both into a package, declare them in manifest `css`, and use the
`milxdy-sdk-overlay*` classes. The docked-app template is the canonical example.

The semantic `--milxdy-sdk-*` tokens adapt to milXdy overlay variables when
available and retain light/dark fallbacks when the reskin is disabled. Apps may
override semantic tokens on their own root. They must not depend directly on
private selectors or internal TypeScript overlay helpers.

The primitives provide responsive geometry, logical properties, 44px controls,
visible keyboard focus, reduced-motion behavior, and forced-colors borders.
They do not manage behavior: app code still owns dialog semantics, labels,
Escape handling, initial focus, focus restoration, and deterministic removal.

When these files change, `verify:app-sdk-production` ensures the copies in the
docked starter remain byte-for-byte synchronized.
