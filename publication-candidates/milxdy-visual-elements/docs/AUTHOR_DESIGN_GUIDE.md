# milXdy App visual design guide

Version: candidate for App SDK 0.2.4 and visual catalog schema 1.

milXdy apps are compact utilities embedded in X. They belong to a host-owned
window and rail system; they are not miniature marketing sites. Coherence comes
from semantic roles, stable narrow geometry, explicit states, accessible
behavior, and provenance—not from copying a particular artwork or forcing one
skin onto every app.

The copyable implementation is under
[`examples/compact-utility/index.html`](../examples/compact-utility/index.html).

## 1. Ownership boundary

The host owns:

- route observation, shared scanning/scheduling, network policy, trust, and
  diagnostics;
- the single 48 px app rail, app opening/closing, window placement, and common
  chrome;
- the active light/dim/dark/system environment and selected chrome preset;
- focus transfer into and out of host surfaces; and
- global reduced-motion and lifecycle signals.

The package owns:

- feature behavior and information architecture inside its declared surface;
- local controls, lists, tables, previews, state transitions, and cleanup;
- package-owned motion, sound, imagery, and error recovery;
- accessible names and descriptions for package content; and
- every declared shipping asset and its package provenance.

Do not add a second rail, global scanner, independent theme root, arbitrary
window manager, or package-owned copy of host chrome. A feature local to an X
post should remain inline. An app may use a host-provided overlay. Request a
Native treatment only when preserving an established authored identity, and
document which identity is preserved and which host behaviors remain intact.

## 2. Utility chassis

A typical overlay has five regions:

1. titlebar with app identity and bounded status;
2. compact navigation when the surface has multiple modes;
3. main content with one primary reading order;
4. recovery or contextual actions near the state they affect; and
5. optional footer metadata, not a decorative call-to-action band.

Use a programmatically named `section` or `dialog`, a real heading, native
controls, lists for collections, tables for comparable records, and
`role="status"` only for bounded asynchronous changes. Avoid a generic
`div`-only component tree.

```html
<section class="mx-window" aria-labelledby="library-title">
  <header class="mx-titlebar">
    <div>
      <h2 id="library-title">Library</h2>
      <p class="mx-status" role="status" aria-live="polite">Ready</p>
    </div>
    <button class="mx-tool" type="button" aria-label="Close Library">×</button>
  </header>
  <nav class="mx-tabs" aria-label="Library sections">
    <button type="button" aria-pressed="true">Tracks</button>
    <button type="button" aria-pressed="false">Playlists</button>
  </nav>
  <main class="mx-body" tabindex="-1"></main>
</section>
```

Opening moves focus to a meaningful heading, first control, or main region.
Closing restores focus to the connected invoker. Escape closes a transient
surface unless doing so would discard work without confirmation.

## 3. Semantic token layers

Use roles, not palette names. The host-compatible layer is published in
[`tokens/milxdy.css`](../tokens/milxdy.css) and represented as data in
[`tokens/milxdy.tokens.json`](../tokens/milxdy.tokens.json).

Core color roles:

```css
--mx-color-surface
--mx-color-surface-raised
--mx-color-surface-sunken
--mx-color-border
--mx-color-bevel-shadow
--mx-color-highlight
--mx-color-accent
--mx-color-title
--mx-color-text
--mx-color-muted
--mx-color-focus
--mx-color-success
--mx-color-warning
--mx-color-danger
--mx-color-offline
```

Geometry and behavior roles:

```css
--mx-window-radius
--mx-control-radius
--mx-border-width
--mx-shadow
--mx-space-1
--mx-space-2
--mx-space-3
--mx-space-4
--mx-target-min
--mx-motion-fast
--mx-motion-medium
```

The token source first consumes public host variables when present, then uses
explicit fallbacks. Never depend on private selectors or internal TypeScript
helpers.

## 4. Chrome presets and visual registers

### RemiNet utility

Use for most apps. It has a small radius, one-pixel border, heavier lower/right
edge, inset highlight, restrained shadow, and optional subtle grid. It supports
dense metadata and small culturally specific feedback without becoming
ornamental.

### Classic desktop

Use for file-like, settings, or strongly desktop-native tools. It is square,
beveled, gray, and uses a navy-like title role. Controls still need clear
keyboard focus and zoom-safe targets; “retro” is not an accessibility
exemption.

### Native

Use when a Wiki, imageboard, game, reader, or other established product identity
would be damaged by reskinning. Native means the package may preserve its
interior grammar. It does not transfer ownership of rail placement, window
lifecycle, focus restoration, trust, theme communication, or reduced-motion
signals.

### Optional reference registers

- **Operator console:** black/red/white, one-pixel rules, uppercase labels, and
  mono data. Appropriate for dense tools; avoid tiny type, click-only `div`
  controls, missing headings, or hover-only disclosure.
- **Institutional record:** off-white/dark equivalent, mono metadata, compact
  tables, restrained blue information and red warnings. Appropriate for source
  and decision records.
- **Neochibi artifact:** constrained character components and palette
  variation inside a modest UI frame. Local authors choose their own source;
  upstream/default examples use reviewed sources with exact compatible
  license-or-permission evidence.
- **Native archival:** predictable headings, compact indexes, timestamps,
  categories, revision history, and visible provenance.

These are plural registers, not a single “Remilia look.” Public context is
summarized in the [reference atlas](REFERENCE_ATLAS.md).

## 5. Density and hit areas

Design for stable operation around 320–420 CSS px. Prefer short functional
headers, 4/8/12/16 px spacing roles, one- or two-pixel rules, and controls whose
labels remain visible.

Keep interactive targets at least 44 by 44 CSS px where practical. A compact
glyph can sit inside a generous hit area:

```css
.mx-tool {
  inline-size: var(--mx-target-min);
  block-size: var(--mx-target-min);
  padding: 10px;
}

.mx-tool > svg {
  inline-size: 16px;
  block-size: 16px;
}
```

Do not overlap invisible target extensions. A genuinely dense desktop table may
document a smaller pointer target only when every action is keyboard reachable,
focus is unmistakable, spacing remains usable at 200% zoom, and the exception
passes review.

Avoid universal 999 px pills. Pills are appropriate for tags, counts, switches,
or an intentionally rounded native pattern. They are not the default geometry
for every button or panel.

## 6. Theme behavior

Test four host modes:

- **light:** light surfaces, dark text, visible bevel/highlight;
- **dim:** dark gray surfaces with separated raised/sunken layers;
- **dark:** near-black canvas without losing borders or muted text;
- **system:** follows the current host/environment rather than freezing a
  package preference.

Theme meaning must survive palette changes. Selection, warning, success,
offline, and error each need text, iconography, or structure in addition to
color.

At `forced-colors: active`, allow system colors to win. Remove decorative
shadows and textures, use `Canvas`, `CanvasText`, `ButtonFace`, `ButtonText`,
`Highlight`, `HighlightText`, and visible borders. Do not use
`forced-color-adjust: none` on ordinary content.

Images are reviewed on every declared background. If an icon requires separate
light and dark exports, declare and hash each. Do not invert photographs or
illustrations blindly.

## 7. State vocabulary

Asynchronous components use a finite, visible vocabulary:

```js
const states = new Set([
  "idle", "loading", "refreshing", "ready", "empty", "success",
  "error", "offline", "auth-required", "cooldown", "unsupported"
]);
```

Rules:

- keep safe prior data visible during refresh;
- distinguish empty from error and offline;
- provide the next recovery action;
- disable only the action in flight;
- write bounded status text for assistive technology;
- preserve geometry to avoid layout jumps;
- never communicate state only with color, motion, or sound;
- abort stale work on close, route change, disable, or a newer request; and
- prevent late promises from rewriting a closed surface.

Use `aria-pressed`, `aria-expanded`, `aria-current`, or native selection only
when the corresponding state exists. Avoid noisy live regions: announce
meaningful transitions, not timers, waveforms, scroll position, or every
incoming mutation.

## 8. Motion

Motion is brief, functional, interruptible, and package-local. It can explain
open/close, reordering, or a successful action; it should not create ambient
movement behind a utility.

```css
.mx-panel {
  transition:
    opacity var(--mx-motion-fast) ease,
    transform var(--mx-motion-fast) ease;
}

@media (prefers-reduced-motion: reduce) {
  .mx-panel,
  .mx-panel * {
    animation: none !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}
```

CSS suppression is not sufficient for JavaScript motion. Stop
`requestAnimationFrame`, particles, waveform animation, shimmers, wiggles, and
random reward motion. Substitute status text, a determinate progress element,
or a static completed state. Global host suppression does not remove the
package's responsibility.

## 9. Sound and audio boundaries

Sound is optional semantic feedback, never ambient permission. Recorded audio
products may play user-selected media; ordinary apps should use a small event
map:

```js
const soundEvents = {
  confirm: { priority: "normal", visual: "Saved" },
  message: { priority: "normal", visual: "Unread message" },
  reward: { priority: "low", visual: "Achievement unlocked" },
  warning: { priority: "high", visual: "Warning" },
  error: { priority: "high", visual: "Action failed" }
};
```

Requirements:

- no audio before user activation;
- master mute plus per-app control;
- user volume and browser/OS policy are respected;
- every event has a simultaneous visible equivalent;
- overlapping events are rate-limited and low-priority events may be dropped;
- speech and media can pause and stop;
- reduced sensory effects suppress reward/ambient feedback independently of
  warnings;
- generated tones document synthesis parameters; and
- recorded audio is declared like every other package asset and carries the
  notices required by its actual license or permission; upstream/default audio
  must pass the same rights-compatibility review as visual assets.

The original, dependency-free generative example under
[`examples/semantic-sound/index.html`](../examples/semantic-sound/index.html) creates a short tone
only from a click and always updates visible status. Do not copy an external
sound family merely because it is a useful design reference.

## 10. Imagery and source records

For local custom packages, choose imagery that fits the user's modification.
Preserve an untouched source, declare only the exports the package ships, and
record hashes/transformations when reproducibility matters. Catalog IDs,
license proof, and maintainer approval are optional locally.

For default/upstream inclusion, promote the same local record through the
project review lane: exact source evidence, VPL continuity, parent hashes,
material changes, author/tool/date, accessibility review, and a final upstream
decision become mandatory.

Meaningful image alt text describes its function in context:

> Decorative frame surrounding the package status panel.

A neighboring visible label may make an image decorative, in which case use
`alt=""`. Never stuff provenance or visual speculation into alt text. Keep
complete provenance in the catalog/source panel.

Essential text should be HTML, not pixels. When lettering is unavoidable,
record it, localize around it, and ensure the same information is available as
text.

## 11. Texture and frame recipes

Use original CSS/code recipes for one-pixel rules, offset bevels, grids,
scanlines, palette quantization, and other deterministic treatments. Keep
parameters and seed/version visible. Recipes must not embed scraped textures,
signatures, logos, screenshots, or remote URLs.

Available examples:

- [`recipes/bevel/reminet.css`](../recipes/bevel/reminet.css)
- [`recipes/grid/subtle-grid.css`](../recipes/grid/subtle-grid.css)
- [`recipes/forced-colors/forced-colors.css`](../recipes/forced-colors/forced-colors.css)

## 12. Required QA matrix

Every example and package-owned component is checked at:

| Dimension | Required coverage |
|---|---|
| Width | 320, 360, 420, and nominal desktop CSS px |
| Zoom | 100% and 200% |
| Theme | light, dim, dark, system |
| Chrome | RemiNet, Classic, and justified Native |
| Color adaptation | `forced-colors: active` |
| Motion | normal and `prefers-reduced-motion: reduce` |
| Input | keyboard-only plus pointer/touch where supported |
| Assistive technology | at least one supported screen-reader smoke test |
| Images | actual rendered sizes on every declared background |
| Sound | muted, reduced-sensory, autoplay-blocked, and visible-equivalent states |
| Network state | loading, stale refresh, empty, error, offline, and recovery |

Record browser/version, build identity, viewport, zoom, theme, preset, result,
and reviewer. Static code inspection cannot substitute for runtime testing.

## 13. Anti-patterns

Reject an example that:

- reads like a standalone landing page or hero card;
- uses glassmorphism, decorative blobs, or gradients without function;
- hides controls until hover;
- hard-codes one theme or relies only on color;
- mixes host chrome and package interiors without an ownership boundary;
- claims project endorsement merely because a custom asset works locally;
- bulk-copies public-site assets into an upstream/default submission;
- promotes an unknown, ambiguous, or rights-incompatible dependency into a default package;
- publishes an AI edit without its parent graph; or
- remains incoherent at the actual rail, badge, notification, or compact-panel
  size.

## 14. Package and catalog handoff

Declare each vendored export in `milxdy.app.json` and verify the package without
network access. A `visual-assets.lock.json` is optional for local work and
required for upstream/default promotion. Include whatever notices the selected
asset actually requires; the upstream lane additionally requires exact evidence
that its license or permission supports copying, modification, redistribution,
and App SDK use. VPL is one supported path, not the only one. See
[Package integration](PACKAGE_INTEGRATION.md).

The catalog is an authoring and review input. It is not a runtime CDN.
