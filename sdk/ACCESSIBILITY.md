# App SDK Accessibility Requirements

Every interactive app must meet these requirements before review:

- Use native HTML controls and landmarks before ARIA substitutes.
- Give overlays an accessible name with `aria-labelledby` or `aria-label`.
- Move focus into an opened overlay, close it with Escape when appropriate, and
  restore focus to the previously focused connected element.
- Keep every action keyboard reachable with a visible focus indicator and a
  minimum 44 by 44 CSS-pixel target where practical.
- Announce asynchronous status changes with a bounded `aria-live` region; do not
  repeatedly announce route or mutation noise.
- Preserve usable reading order, text reflow, and controls at 200% zoom and a
  320 CSS-pixel viewport.
- Do not encode state using color alone. Support dark mode, forced colors, and
  reduced motion without hiding essential information.
- Use descriptive alternative text for meaningful images and empty `alt` text
  for decorative images.
- Remove app-owned DOM, listeners, timers, and live regions on close, disable,
  abort, and dispose.

Static conformance and the starter are baselines. Authors should also test
keyboard use, zoom, screen readers, reduced motion, and forced colors in the
supported browsers.
