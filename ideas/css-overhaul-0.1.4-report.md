# milXdy 0.1.4 CSS Overhaul Report

Temporary planning report for the 0.1.4 CSS reskin. This file lives under `ideas/`, which is gitignored.

## Objective

Reskin X/Twitter toward a Remilia/Milady visual language while preserving browser speed. The extension already adds meaningful cost on X through scanning, injected UI, avatar detection, API fetches, OCR, and DOM mutations, so the CSS overhaul should behave like a controlled theme system, not another unbounded feature.

The reskin should be organized around three default profile settings:

- Max: X becomes mostly unrecognizable and fully Milady/Remilia themed.
- Moderate: X remains recognizable, but carries visible Milady/Remilia surfaces, accents, badges, and panel language.
- Min: X looks mostly original, with milXdy additions styled consistently but lightly.

Miladymaxxer is part of this reskin, not just a consumer of it. The CSS pass should reinterpret and refactor Maxxer visual treatments so its card tiers, profile treatments, quote states, DM states, avatar effects, and active Postreader overlays use the same profile model.

Primary 0.1.4 source in repo docs: `docs/ROADMAP.md` calls for browser compatibility, settings ergonomics, and RemiNet-style visual polish, including a CSS pass for max settings and more consistent RemiNet/Beetol/Maxxer styling. `PLANNING.md` also keeps performance as a primary goal and warns against duplicated scanners, broad CSS, expensive effects, and feature interference.

## Sites Studied

- `https://www.remilia.net/`
- `https://miladychan.org/`
- `https://miladymaker.net/`
- `https://maker.remilia.org/milady`
- `https://x.com/`

## Visual Direction

There are two compatible but distinct Remilia/Milady families.

### RemiliaNET / Miladychan

This is the stronger target for the X reskin because it already resembles an application shell.

- Dense, modular UI with small controls, compact panels, and repeated status surfaces.
- Early-web/desktop feel: beveled buttons, 1px borders, inset highlights, cast shadows, patterned backgrounds, pixel/mono/mincho type.
- Color tokens are broad, not one-note: Remilia blue, pink, green, gold, bronze, bloody red, diamond/cyan, silver/grey, cream.
- Frequent use of textures and symbols: tartan backgrounds, monograms, card dividers, star/beetle/icon language.
- Buttons often read as physical objects: top-left highlight, darker right/bottom edge, small press shift on hover/active.
- RemiliaNET CSS includes many custom fonts and highly styled cards. It is visually rich but expensive if copied wholesale.
- Miladychan provides a useful token set:
  - pink: `#f1a8b7`, `#b35e7d`, `#ffcee4`
  - blue: `#b5d1ed`, `#3473ac`, `#eef2ff`
  - green: `#2f4d0c`, `#327025`, `#b9d9b7`
  - gold: `#f2bc21`, `#dda004`, `#fff4d6`
  - bronze/red/diamond/silver secondary tiers

### Milady Maker / Maker Remilia

This is the lighter early-web reference.

- Simple boxed document layout, centered narrow content, green borders, white or cream panels.
- Fixed gradient body background: `#d9f0d6 -> #f4ffee -> white`.
- Green frame language: `#2f4d0c` borders/title bars, `#b9d9b7` panel bars.
- Standard blue underlined links and red hover links.
- Low CSS cost: almost no filters, shadows, or complex animations.

This style is useful for low-cost global surfaces: borders, sidebars, popup settings, simple section headers, and fallback mode.

## X/Twitter Baseline To Respect

X is an SPA with virtualized feeds, unstable class names, and reliable-enough semantic hooks like `article`, `data-testid`, `role`, and `aria-label`. The UI is optimized around fast scrolling and frequent DOM replacement.

Baseline traits to preserve in Moderate and Min:

- Timeline rows are full-width, border-separated, and frequently mounted/unmounted.
- Text must remain readable in light, dim, and dark modes.
- X already uses many inline styles and generated class names; broad selectors are brittle.
- User action controls must retain hit targets and accessibility states.
- Layout shifts are highly visible because feed items are continuously measured and recycled.

Styling should prefer attribute hooks added by milXdy over trying to restyle every X class.

Max deliberately violates normal X recognition, but it still must preserve mechanical behavior: hit targets, text readability, scroll performance, focus states, route changes, compose flow, media viewing, and accessibility.

## Default Profile Model

The profile setting should drive both feature enablement and CSS intensity.

### Max Profile

Goal: X should feel like a Remilia/Milady client running on X data, not like a lightly themed X page.

Visual behavior:

- Strong page chrome reskin: app background, left nav, timeline shell, right sidebar, compose surfaces, modals, buttons, tabs, separators, and profile headers.
- Use RemiliaNET/Miladychan application language: beveled frames, compact header bars, green/blue/pink/gold accents, pixel/mono/mincho typography, small status indicators, star/beetle icons, and controlled patterned surfaces.
- Timeline articles may become framed Milady cards, but avoid expensive effects on every row by default. Prefer static borders, header strips, flat gradients, and lightweight pseudo-elements.
- Miladymaxxer should be visually central: recognized Milady posts, profiles, quote tweets, DMs, and user cells get strong tier treatments. Non-Milady minimization can be more obvious when enabled.
- X brand color should largely disappear except where required by user expectations or platform affordances.
- The popup should make it clear this mode is the most visually invasive and the highest rendering-risk preset.

Implementation constraints:

- Max may inject broad X chrome CSS, but it should be behind a single profile marker such as `html[data-milxdy-reskin-profile="max"]`.
- Avoid JavaScript per-node style writes for global chrome. Use static CSS where possible.
- Heavy Maxxer effects should be tiered: static default, richer hover/focus/profile treatments, animation only for explicit events or reduced-motion-safe states.
- Include a quick disable path from the popup in case X layout changes cause breakage.

### Moderate Profile

Goal: X should remain clearly X, with Remilia/Milady identity layered into milXdy-owned UI and important marked surfaces.

Visual behavior:

- Keep X layout, typography scale, and most native spacing.
- Theme milXdy-owned UI strongly: RemiNet Chat, RemiStats tooltips/badges, Beetol, Wiki previews, Postreader player, popup/settings.
- Theme feature-marked X surfaces: Miladymaxxer posts/profiles/quotes, active Postreader article, RemiStats profile badges, incoming poke indicators.
- Use colored borders, subtle panel backgrounds, badges, and title-bar motifs rather than replacing the entire page.
- Preserve X blues and native action affordances unless milXdy owns the control.

Implementation constraints:

- This should be the safest default for testers who want the extension identity visible.
- Avoid styling unmarked timeline articles.
- Keep Maxxer card treatments rich but static, with animation reduced to hover or explicit catch/level events.

### Min Profile

Goal: X should look mostly original.

Visual behavior:

- No broad X chrome reskin.
- milXdy controls should look native-adjacent with small Remilia accents.
- Maxxer should use badges, small outlines, or muted tier markers instead of full-card transformations.
- RemiStats and Postreader should keep their controls compact and readable without changing the surrounding feed.

Implementation constraints:

- This should be the performance baseline and compatibility fallback.
- Inject the least CSS and avoid remote font dependency.
- Disable decorative animations by default.

## Existing Local CSS Observations

### RemiNet Chat

`src/features/reminetChat/content.css` is closest to the target aesthetic:

- Uses Remilia fonts from `https://www.remilia.net/fonts/Hei.ttf` and `Menlo.woff2`.
- Has scoped root `#milxdy-reminet-chat-root`.
- Uses bevel borders, inset highlights, grid pattern overlay, compact mono/mincho text, and button press feedback.
- Has CSS variables for light/dark mode.

Concerns:

- Remote font loading from a content stylesheet can add network latency and potential CSP/availability issues. Prefer bundling only the required font subset/assets or falling back cleanly.
- Pattern overlays and shadows are acceptable on one chat panel, but should not be applied to every timeline article.

### RemiStats

`src/features/remistats/remistats.css` already includes Remilia Mincho, badges, star/beetle icons, tooltips, and poke color variables.

Concerns:

- Some selectors are global on `html[...]`; keep them limited to variable toggles only.
- Tooltip styling has heavy shadows, dot-pattern pseudo overlay, and very high z-index. Keep a single tooltip manager and avoid per-badge visual layers.
- Badge hover transforms are okay if limited to small inline elements.

### Miladymaxxer

`src/features/miladymaxxer/styles.ts` is the largest risk area.

Positive:

- Uses feature-owned data attributes such as `data-miladymaxxer-effect`.
- Already differentiates gold, silver, mint, diamond, DM, profile, quote, and Postreader active states.

Concerns:

- Heavy use of `!important`, multi-layer gradients, pseudo overlays, `filter: drop-shadow`, avatar filters, animated shimmer, masks, and broad X selectors.
- Style is embedded as a large template string, making token reuse and auditing harder.
- Theme detection through `html[style*="background-color: ..."]` / `body[style*="background-color: ..."]` is brittle.
- Full-card effects on many timeline articles can create paint/compositing overhead during scroll.

Refactor direction:

- Split Maxxer visuals into profile-aware tiers: `max`, `moderate`, and `min`.
- Replace repeated hard-coded colors with shared `--milxdy-*` tokens and Maxxer-specific semantic variables such as `--milxdy-maxxer-tier-bg`, `--milxdy-maxxer-tier-border`, and `--milxdy-maxxer-tier-glow`.
- Separate structural markers from decorative treatments. The classifier/effects code should mark state; CSS should decide how intense that state appears under the active profile.
- Convert expensive defaults into optional layers:
  - static tier color and border: allowed in all profiles
  - box-shadow/glow: Moderate and Max
  - shimmer, masks, avatar filters, and animated overlays: Max only, preferably hover/event-gated
- Move stable CSS out of `styles.ts` when practical so it can be audited and shared with the reskin CSS.

### Postreader

`src/features/postreader/styles.ts` is scoped and comparatively light, but its active-post backgrounds overlap with Miladymaxxer card styling.

Concern:

- Shared active/read state should use common tokens so it does not fight the Maxxer theme.

### Beetol

`src/features/beetol/content.css` is scoped under `#beetol-hunter-root` and already cheap enough for a self-contained panel.

Concern:

- Its dark utility style does not match the RemiliaNET chat shell yet. It can be brought closer with shared button, frame, and color tokens without affecting X.

## Recommended Theme Architecture

Create one shared CSS token layer, one reskin profile marker, and feature CSS that consumes both.

Suggested files:

- `src/styles/milxdy-theme.css` or `src/shared/themeCss.ts`
- `src/styles/x-reskin.css` or `src/shared/xReskinCss.ts`
- Feature-owned CSS modules continue to exist, but consume shared variables.

Root token shape:

```css
:root {
  --milxdy-rn-blue: #626bb2;
  --milxdy-rn-blue-dark: #171f82;
  --milxdy-green: #2f4d0c;
  --milxdy-green-soft: #b9d9b7;
  --milxdy-mint-bg: #f4ffee;
  --milxdy-pink: #f1a8b7;
  --milxdy-pink-dark: #b35e7d;
  --milxdy-gold: #f2bc21;
  --milxdy-gold-dark: #dda004;
  --milxdy-cream: #ffffee;
  --milxdy-surface: #fbfbfb;
  --milxdy-surface-2: #e5e5e5;
  --milxdy-border: #b4b4b4;
  --milxdy-border-dark: #464a6c;
  --milxdy-text: #19191d;
  --milxdy-muted: rgba(0, 0, 0, 0.56);
}
```

Use local root wrappers for dark values:

```css
[data-milxdy-theme="dark"] {
  --milxdy-surface: #171820;
  --milxdy-surface-2: #20222d;
  --milxdy-border: #4c5064;
  --milxdy-text: #f0f1f8;
  --milxdy-muted: rgba(240, 241, 248, 0.62);
}
```

Do not set global `body` fonts, body backgrounds, or universal element resets on X.

Profile marker:

```css
html[data-milxdy-reskin-profile="min"] { ... }
html[data-milxdy-reskin-profile="moderate"] { ... }
html[data-milxdy-reskin-profile="max"] { ... }
```

Settings should store the profile separately from individual feature toggles. Feature toggles decide what runs; the profile decides how strongly enabled features and X chrome are styled.

## X Reskin Strategy

Use the profile model instead of one reskin intensity:

1. Theme milXdy-owned UI first: popup, RemiNet Chat, RemiStats tooltip, Beetol panel, Postreader player, Wiki previews.
2. Theme selected X surfaces only when feature state exists:
   - articles with `data-miladymaxxer-effect`
   - active Postreader article
   - RemiStats badge/tooltip targets
   - profile surfaces explicitly marked by feature code
3. Add the broader X chrome reskin only for Max:
   - left nav selected/hover states
   - right sidebar frames
   - compose/action button accents
   - timeline separator/border tone
   - app background and column surfaces
   - native buttons, tabs, modals, and profile headers where selectors are stable enough
4. Avoid restyling all text, all links, all buttons, or all `article` nodes in Moderate and Min.

Good low-cost X-level effects:

- 1px border recolors
- subtle background tint on major columns
- small badge/header bars
- static CSS variables
- box-shadow on fixed panels only
- one static repeating-linear-gradient on a fixed panel/root, not on every feed item

Avoid or gate behind max mode:

- backdrop-filter on scroll containers
- filter/drop-shadow on many avatars
- animated shimmer on every marked article
- masks on timeline articles
- large blur shadows on many items
- `:has(...)` selectors in hot feed paths
- global `*` selectors outside milXdy roots
- remote fonts fetched on every page before the user enables the feature

## Performance Concerns

The CSS pass can hurt performance even without JavaScript changes.

Specific risks:

- Paint cost: gradients, filters, shadows, masks, and blend modes on many timeline articles repaint while scrolling.
- Compositing cost: hover transforms and animated pseudo-elements can create many layers.
- Selector cost: broad attribute selectors and `:has()` over X's large DOM can be expensive.
- Layout cost: adding margins, borders, or dynamic widths to articles can shift virtualized rows and cause remeasure work.
- Network cost: remote fonts/assets delay first paint and can fail offline.
- Specificity debt: broad `!important` rules make future integration and user settings harder.

Performance budget recommendation:

- Min should add near-zero work to normal scrolling.
- Moderate should add low paint cost and no broad feed transformations.
- Max can be visually invasive, but still needs a measured paint budget and a quick fallback.
- Full-card Maxxer visual effects should be profile-gated and preferably visible-only.
- Animated effects should have a global kill switch and respect `prefers-reduced-motion`.
- Theme CSS should be injected only when the corresponding feature or reskin profile is enabled.
- Keep generated CSS small enough to audit. Split shared tokens from feature effects.

## Integration Concerns

- The current worktree already has modified `docs/ROADMAP.md`, `public/popup.html`, `src/features/reminetChat/content.css`, and `src/features/reminetChat/content.ts`. Do not overwrite those changes during the CSS pass without reviewing them.
- `ideas/` is gitignored, so this report will not ship.
- Existing CSS naming is mixed: `reminet-*`, `milxdy-chat-*`, `miladymaxxer-*`, `postreader-*`, `beetol-*`, and `remilia-wiki-*`. The overhaul should standardize shared tokens under `--milxdy-*` while leaving feature DOM classes stable.
- Current styles use both external stylesheets and injected `<style>` strings. For maintainability, move large stable CSS out of TypeScript where possible, but do not do that as part of a visual pass unless the build already supports the file.
- X dark mode detection should be normalized through a shared helper/class/data attribute rather than repeated inline-background selectors.
- The extension should include a visual regression/smoke checklist for X light/dim/dark, profile page, home feed, notifications, DMs, and compose modal.

## Proposed 0.1.4 CSS Scope

Recommended first pass:

- Define shared `--milxdy-*` theme tokens.
- Add a settings-level reskin profile with `max`, `moderate`, and `min`.
- Add a root profile marker such as `html[data-milxdy-reskin-profile]`.
- Update RemiNet Chat, RemiStats tooltip, Beetol panel, Postreader player, and Wiki preview to use the same surface, border, text, pink/blue/green/gold variables.
- Add `prefers-reduced-motion` handling to existing animations.
- Refactor Maxxer timeline/profile/quote/DM effects around profile intensity:
  - Min: badges, outlines, small markers, no full-card transformation by default
  - Moderate: full-card tier colors where marked, static borders/backgrounds, limited hover polish
  - Max: full Remilia/Milady card treatment, stronger non-Milady minimization, richer profile chrome, event-gated animations
- Add Max X chrome CSS behind the profile marker so the page becomes mostly unrecognizable only in Max.
- Keep Moderate and Min scoped to milXdy-owned UI plus feature-marked X surfaces.

Defer:

- Full global X skinning of every article/control outside Max.
- Importing the full RemiliaNET CSS or font set.
- Texture-heavy feed backgrounds in Moderate and Min.
- Any CSS requiring a new scanner or extra per-node style mutation.

## Validation Checklist

- `npm run typecheck`
- `npm run build`
- Load unpacked `dist` in Chromium.
- Test X with all features disabled: no theme CSS should alter X.
- Test each profile independently: Min, Moderate, Max.
- Enable only reskin/theme: normal feed scroll should remain smooth in Min and Moderate, and acceptable in Max.
- Enable Maxxer + RemiStats + Postreader together and check that article backgrounds, active-read state, badges, and quote tweets do not fight each other.
- Check Maxxer intensity changes correctly when switching profiles without leaving stale article classes or inline styles.
- Test X light, dim, and dark themes.
- Test `prefers-reduced-motion`.
- Verify no remote font/network request is required for core X rendering unless the feature is enabled.
- Use Chrome Performance panel on a long scrolling feed and compare before/after paint/composite time.

## Practical Design Target

The best fit varies by profile. Max should feel like a RemiliaNET/Milady client using X as a data source. Moderate should feel like X with confident Remilia/Milady overlays. Min should feel like X with restrained milXdy controls. Miladymaxxer should be the visual bridge across all three profiles, with its intensity controlled by the same preset rather than by one-off CSS branches.
