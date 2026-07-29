# Contributor UI Style Guide

This guide is for contributors building or changing milXdy app UI inside the extension. It covers classic app surfaces: side-rail apps, docked overlay panels, Apps & Features-adjacent panels, and compact utility windows.

milXdy app UI should feel like practical desktop utility software layered onto X/Twitter. Favor dense, readable controls; stable panel geometry; crisp borders; and clear states. Avoid marketing-page layouts, oversized hero content, or decorative backgrounds inside app surfaces.

## Classic Utility Windows

Classic app surfaces should be compact windows, not landing pages. They work best with:

- square or slightly rounded corners
- visible 1-2px borders and bevels
- inset highlights and shadows that still read when drop shadows are disabled
- compact headers with the app name, state, and direct controls
- dense lists, tabs, segmented controls, checkboxes, sliders, counters, and icon buttons
- stable dimensions for rows, buttons, badges, resize handles, and tab bars

The classic appearance profile is applied from the document root with `data-milxdy-visual-app-window-style="classic"`. The RemiNet-style profile uses `data-milxdy-visual-app-window-style="reminet"`, and `data-milxdy-visual-app-window-style="native"` means each app keeps its authored chrome. Users can also disable app shadows with `data-milxdy-visual-app-shadows="false"`.

App CSS must cooperate with those root settings. A window should remain legible in light mode, dark mode, classic style, RemiNet style, and shadows-disabled mode without each feature reimplementing theme detection.

Apps should declare their chrome compatibility in `src/platform/app-sdk/first-party-apps.json`. Use `chrome.nativeStyle` for the app-authored look and `chrome.supportedStyles` for shared presets the app can safely receive.

## Shared Overlay Chrome

Use the shared overlay platform for side-rail app windows:

- Call `ensureOverlayAppChromeStyles()` before rendering the panel root.
- Use `prepareOverlayAppRoot()` before measuring or placing a new root.
- Add `milxdy-overlay-app-shell` to the root element.
- Add `milxdy-overlay-app-card` to the window container.
- Add `milxdy-overlay-app-header` to the draggable title/header row.
- Call `markOverlayAppLayoutReady()` after placement is restored and applied.
- Use `animateOverlayAppOpen()` and `animateOverlayAppClose()` for open/close transitions when a panel can reopen without rebuilding.

For panel behavior, prefer helpers from `overlayPanelBase` and `overlayAppLayout` through the existing app patterns:

- `observeOverlayPanelTheme()` and `resolveOverlayPanelTheme()` for light/dark behavior
- `restoreOverlayPanelBox()` for persisted size and position
- `startOverlayPanelDrag()` for title-bar dragging
- `startOverlayPanelResize()` for resize handles
- platform clamping, protected zones, snap guides, and persistence instead of custom pointer math

Apps should own feature UI and state. Shared window mechanics belong in the platform layer.

## Semantic Theme Variables

Overlay app surfaces should use these shared variables instead of hard-coded palette values:

- `--milxdy-overlay-app-surface`
- `--milxdy-overlay-app-surface-2`
- `--milxdy-overlay-app-surface-3`
- `--milxdy-overlay-app-border`
- `--milxdy-overlay-app-bevel-shadow`
- `--milxdy-overlay-app-highlight`
- `--milxdy-overlay-app-accent`
- `--milxdy-overlay-app-title`
- `--milxdy-overlay-app-text`
- `--milxdy-overlay-app-muted`

Feature-specific variables are fine when an app already has a local design system, but map them back to the shared overlay variables at the shell/card boundary. This lets the classic and RemiNet profiles restyle app chrome consistently.

Use semantic variable roles:

- `surface` for the main panel face
- `surface-2` for recessed content areas
- `surface-3` for headers, buttons, and raised controls
- `border`, `bevel-shadow`, and `highlight` for crisp window edges
- `accent` for active controls, badges, links, and selected states
- `title`, `text`, and `muted` for readable hierarchy

Avoid app-local theme observers unless the app has a real feature need that the shared theme helpers cannot cover.

## Side Rail Apps

The side rail is platform-owned. Contributors should provide accurate app metadata and frame registration instead of custom rail UI.

For apps that appear in the rail:

- register with `createOverlayAppFrame()`
- provide a concise `label`
- provide meaningful `title` text for the rail button
- provide an icon that fits a 48px square button
- keep `hub.rail.supported` and `hub.rail.defaultPinned` accurate in `src/platform/app-sdk/first-party-apps.json`
- update active state, badges, titles, and dynamic icons through `frame.updateDock()`
- use `restoreOverlayPanelBox()`, `startOverlayPanelDrag()`, and `startOverlayPanelResize()` for movable freeform panels; reserve `frame.applySideOffset(root)` for legacy side-adjacent placement only
- respect user pinning, hidden apps, side changes, and left/right rail placement

Do not build custom dock ordering, app-owned pinning state, or a parallel side rail.

## App Headers

Headers are functional title bars. They should help users move, identify, and control the window quickly.

Use headers for:

- app title
- short status or context
- close/minimize/settings controls
- drag handling through the shared header class and drag helper

Keep header controls compact and predictable. Use icon buttons where the action is familiar, and include accessible labels or `title` text. Avoid large navigation blocks, multiline descriptions, or decorative brand art in the header.

Header controls must remain normal controls. Buttons, links, inputs, selects, sliders, and editable fields inside a header should not start drag sessions unless the app has a deliberate documented exception.

## Controls And Layout

Classic app UI should be efficient at narrow panel widths. Test around 320-420px wide and on small viewports.

Recommended patterns:

- tabs for switching major app views
- segmented controls for compact mode choices
- checkboxes or toggles for binary settings
- sliders, steppers, or numeric inputs for values
- menus for larger option sets
- badges for compact state, count, and health signals
- icon buttons for common window and tool actions
- scroll areas with visible boundaries and reachable controls

Keep control text short enough to fit its container. Do not rely on hover-only controls for important actions. Use `letter-spacing: 0` unless the app already has a specific type treatment that remains readable.

Declare user-facing controls in the app manifest `settings` schema when a setting is meant to be discoverable, resettable, or included in presets/profile packs. Use `appsAndFeatures` for enablement and app-card controls, `appearance` for global visual settings, `appSurface` for controls that live inside the app window, and `advanced` for diagnostics, endpoints, or power-user controls. App-owned Apps & Features controls should declare an enablement/open/reset `role`; detailed app preferences belong in app surfaces.

Only opt settings into `visual`, `audio`, `performance`, `firstRun`, or `profilePack` presets when those flows can safely overwrite the value. If a preset can replace a user-customized value, include public warning copy and support a save-as-custom path where the importing UI provides one.

## Light And Dark Expectations

Apps should inherit light/dark mode from the shared overlay theme helpers and the host page theme signal. Check at least:

- X/Twitter light mode
- X/Twitter dark or dim mode
- system dark preference when the page theme cannot be resolved
- classic app-window style
- RemiNet app-window style
- shadows disabled

Text, borders, icons, focus outlines, selected states, disabled states, and badges must stay readable in each case.

## Do And Do Not

Do:

- reuse shared overlay shell, card, header, frame, theme, drag, resize, clamp, snap, and persistence helpers
- keep panels useful before any decorative treatment is added
- use semantic overlay variables for colors, bevels, borders, and text
- keep app metadata aligned with user-visible rail and Apps & Features behavior
- declare settings metadata for discoverable controls, reset behavior, and preset/profile-pack participation
- preserve user placement, pinning, side, and theme preferences
- keep public UI copy clear, current, and contributor-friendly

Do not:

- add page-wide observers, scanners, intervals, or root content hooks just to style a panel
- hard-code app-window colors that bypass shared theme variables
- duplicate root light/dark detection in feature bundles
- create custom side rails, dock ordering, or per-app pinning storage
- use landing-page heroes, oversized cards, gradient backgrounds, or decorative blobs inside utility panels
- hide important controls behind hover-only affordances
- put private planning labels, old milestone wording, or release-only assumptions in public UI copy
