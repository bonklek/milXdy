# milXdy 0.2.4 Release Notes

milXdy `0.2.4` is the **Composer Kit** release. It turns the App SDK groundwork
from earlier releases into visible composer, sharing, add-on, and custom-pet
workflows while tightening the shared runtime underneath them.

## Composer Kit

- Adds one compact composer/reply add-on for quick replies, X native Drafts,
  Remibooru reaction browsing and attachment, and reviewed Remilia
  Maker/CHEESEWORLD handoffs.
- Opens the quick-reply panel from the invoking Reply control, preserves focus
  and dismissal behavior, and verifies a declared quick-reply value before the
  configured submission action.
- Uses X's native Drafts instead of creating a second local draft store.
- Browses bounded Remibooru pages and facets with visible attribution,
  canonical-source links, and explicit thumbnail attachment to the initiating
  composer. Nothing is attached or posted automatically.
- Keeps package code away from X DOM, cookies, tabs, image bytes, raw browser
  messaging, and remote-session details; reviewed host callbacks own those
  boundaries.

See [Composer Kit](../guides/composer-kit.md).

## Share Kit

- Moves Tweet PNG into the reviewed Share Kit package while preserving its
  stable feature identity and existing visual/profile settings.
- Keeps selected post text, media, quote context, date, stats, borders, palette,
  copy, download, and browser-share behavior inside a local review dialog.
- Adds live color previews, full-text and cashtag rendering, improved quote-post
  context, removable included images, themed link cards, and a subtle optional
  milXdy watermark.
- Adds deliberate **Share to RemiNet** staging. The reviewed PNG becomes a
  pending local RemiNet Chat attachment and is not uploaded until the user
  presses Send in Chat.

See [Share Kit — Tweet PNG](../guides/tweet-png.md).

## Miladychan Portal

- Adds explicit `milXdy`-pseudonymous text-only thread and reply posting with an
  editable visible name and final destination confirmation.
- Keeps Miladychan credentials, RemiNet/X identity, wallet identity, cookies,
  and extension identity out of the posting request.
- Retains a failed text submission locally, preserves native fallback for
  CAPTCHA/media/session/full-board behavior, and never uploads media.
- Adds local watched threads, fresh-post rail feedback on open/refresh, clearer
  board/thread navigation, top and bottom composers, JUMP controls, quote-link
  insertion, and transient target highlighting.

See [Miladychan Portal](../guides/miladychan-portal.md).

## Pets Maker and the custom-pet pipeline

- Publishes Pets Maker as the first selectable maintainer-catalog add-on. It is
  optional and remains disabled after installation until the user explicitly
  enables it in **Apps & Features**.
- Turns one user-selected transparent Milady, Remilio, Bonkler, or Kagami Maker
  PNG plus declared traits and body choices into a deterministic, validated
  two-file `remilia-pet-request.zip`.
- Adds a versioned local pet-request bundle and explicit Codex handoff.
- Gives the Pets Maker rail window Remilia-themed chrome plus movable and
  resizable window controls.
- Keeps source art, form state, generated bundles, and validation caches local.
  Pets Maker does not upload, post, publish, invoke Codex, infer missing traits,
  or add a rights declaration.

See [Pets Maker export](../guides/custom-pet-export.md).

## Add-ons Catalog and App SDK 0.2.4

- Adds a deterministic Chromium catalog-selection workflow for checked-in,
  hash-pinned maintainer packages with explicit capability/privacy review,
  acknowledgements, transactional promotion, rollback, and reload detection.
- Makes Pets Maker and Share Kit selectable. Composer Kit remains visibly
  **Under review** in the catalog until its exact source and trusted hash are
  committed to an allowlisted catalog path; the record does not pretend to be
  an installable artifact.
- Supports reviewed external folder/ZIP staging and multi-package composition
  without retaining author paths in provenance.
- Adds generic package-owned composer/reply panels, native Drafts, maker
  handoffs, bounded composer suggestions, reviewed Remibooru queries, and
  explicit remote-result attachments.
- Adds public starter templates, lifecycle harnesses, schemas, TypeScript types,
  accessibility guidance, asset declarations, and contributor UI guidance.
See [App SDK overview](../sdk/APP_SDK_OVERVIEW.md), [Local Add-ons](../sdk/LOCAL_ADDONS.md),
and [Add-ons Catalog](../contributors/ADD_ONS_CATALOG.md).

## RemiNet, Beetol, rail, and visual polish

- Keeps Remilia access and refresh tokens in background memory and clears
  legacy content-readable token keys.
- Improves RemiNet Chat placement on X Messages, reaction behavior, transient
  authentication-tab handling, and hover/focus dismissal for **Last read** and
  **Jump to present** markers.
- Adds faster Beetle Crafting item placement through RemiliaNET's existing UI,
  protects occupied slots, supports right-click clearing of selected items,
  preserves native inspection, and never crafts or submits automatically.
- Adds Beetol reward audio/visual feedback, lower-volume junk crunch, refresh
  ordering, and signed-out-state cleanup.
- Adds left/right rail switching, pointer reordering and persistence, a
  whole-item reel with mechanical feedback, media-viewer hiding, shortcut
  clearance, and stronger enable/disable recovery.
- Aligns composer/factory/Drafts icons, themes quick replies, expands the em
  dash helper to DMs, shows the standard 280-character zero boundary, improves
  notification/read-state visuals, and keeps verified display names readable.

## Runtime and maintenance

- Contains an individual Apps & Features card-render failure instead of losing
  the rest of the catalog.
- Stops automatically opening Apps & Features on first run; setup remains an
  explicit user action.
- Decomposes side-rail and app lifecycle ownership, centralizes background
  message authorization, adds architecture/negative-fixture gates, and removes
  more than two thousand lines of unreferenced legacy modules.
- Reorganizes the public documentation by audience and preserves exhaustive
  index/link coverage.

## Known limitations

- milXdy remains an unpacked GitHub beta rather than a Chrome Web Store or
  Firefox Add-ons listing.
- Catalog-managed custom builds are Chromium-only in 0.2.4. Firefox/Waterfox
  uses the normal release archive, and File System Access features remain
  browser-limited.
- Composer Kit is part of the reviewed 0.2.4 package composition but is not yet
  selectable from the public catalog record.
- Miladychan direct posting is text-only. CAPTCHA, media, session-bound, and
  unsupported-board behavior remains on the native site.
- **Share to RemiNet** stages a local attachment for review; it does not send a
  chat message automatically.
- Remibooru contribution, the rights-compatible visual-elements repository,
  the Maker pet-import/QA pipeline, versioned catalog releases, and the broader
  multi-site runtime are 0.2.5 follow-up work rather than 0.2.4 features.

## Issue map

The user-visible release work spans Composer Kit and sharing issues `#16`,
`#17`, `#25`, `#68`, `#79`, `#187`, `#188`, and `#189`; Miladychan Portal
`#41`; the catalog work in `#181`; Pets Maker issues `#190` and `#191`; and
RemiNet/Beetol work in `#194`. Issues `#24`, `#74`, `#183`, `#192`, and `#193`
are explicitly scheduled for 0.2.5 and are not represented as shipped here.
