# 0.2.3 General X Lag Regression

## What changed

The reliability remediation commit added a second `MutationObserver` for the small
**Show new posts** visual treatment. It originally watched all of `document.body`,
including text mutations. The first performance follow-up narrowed that observer to
`main`, removed text mutations, capped pending roots, and deferred scanning to one
animation frame.

That was not a sufficient fix. X performs most feed rendering and recycling under
`main`, so the observer still woke for ordinary timeline work. One frame could still
scan up to 24 added roots and up to 16 buttons below each root. The code was bounded,
but it remained attached to the same high-frequency trigger.

The UI-polish change also added this dock rule:

```css
html:has(body [role="dialog"] [aria-label="Close"]) #milxdy-overlay-dock-root { ... }
```

Because the relational selector is rooted at `html`, descendant changes can require
the browser to reconsider whether the rule matches. X changes descendants constantly,
including while scrolling, liking, updating counts, and recycling timeline cards.

## Fix and causal connection

- `setupShowNewPostsMarkers()` no longer observes timeline mutations or schedules a
  scan on the next animation frame. When the styling option is enabled, it checks at
  most 120 buttons in the visible page's main column once every five seconds instead.
  This removes the repeated mutation -> queued frame -> descendant scan chain while
  still styling a Show-new-posts control inserted after boot.
- The dock no longer uses a root-level `:has(...)` dialog rule. This removes the
  descendant mutation -> relational selector invalidation chain. The left rail uses
  the same 72px top and 80px bottom offsets statically, so it still clears X's
  top-left dialog controls without inspecting live host DOM.
- `scripts/verify/platform.mjs` rejects both patterns so a later visual fix cannot
  silently put them back. It also enforces a minimum three-second scan interval,
  visible-page gating, and the static left-rail safe area.

The UX tradeoff is bounded and explicit: newly inserted Show-new-post controls can
take up to five seconds to receive optional custom styling, and a left-side dock stays
56px lower even when no dialog is open. Desktop left-rail height is unchanged because
the old default and new safe-area clearances both total 152px. At viewports up to
720px, the left rail keeps the 72px/80px dialog-safe geometry and is therefore 48px
shorter than the prior 8px/96px mobile layout; the rail remains scrollable. These
costs are preferable to tying work or root-level selector matching to every timeline
mutation.

## Runtime validation

Validate on the same X account, route, viewport, enabled-app set, and appearance
profile before and after reloading the unpacked build:

1. Let the Home timeline settle.
2. Run the 30-second Max profile benchmark while continuously scrolling the feed.
3. Repeat a Like interaction and open/minimize a rail app.
4. Compare average FPS, worst frame gap, frames over 50/100 ms, long-task totals, and
   feature timings against the prior build.

The suspected-cause fix is not considered live-validated until the new build completes the same scroll
workload without multi-second input stalls. Static release gates prove build and
contract safety; they do not prove interaction responsiveness.
