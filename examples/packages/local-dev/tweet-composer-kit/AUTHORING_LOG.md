# Post-Factory — external-author pilot log

## Scope and method

This package was authored as if the author had only the published milXdy App SDK 0.2.3 material. No repository implementation, first-party feature code, build scripts, or private runtime imports were consulted. The package uses a prebuilt JavaScript content entry, manifest-declared local storage, and the documented docked-overlay lifecycle.

The initial external-author baseline excluded Grok/guru work and all Booru, Miladybooru, Meme Depot, CHEESEWORLD gallery, or reply-media browsing, search, storage, selection, upload, and insertion. The later reviewed #17 continuation adds bounded Remibooru queries and an explicit host-owned thumbnail attachment action without giving the package raw fetch, original-media URLs, image bytes, X DOM, tab, or browser access. CHEESEWORLD remains a disclosed link after a user click. The four declared Remilia makers use only the reviewed host-mediated handoff callback after an explicit icon click.

## Issue #17 discovery and cache decision

The link-only X-post cache prototype was evaluated and rejected for the 0.2.4
picker. Persisting X status URLs would add storage, reset, privacy, dead-link
pruning, and inaccessible-source states while still depending on posts that can
be deleted, protected, rate-limited, or changed by upstream behavior. It would
not make the underlying reaction media durable, and it would duplicate the
approved source's own canonical-post index.

Post-Factory instead uses bounded, no-cache Remibooru queries. The manifest
declares `cache.policy: "none"`; searches send at most five AND-filtered public
facet IDs, a bounded page size, and an opaque cursor. The host returns only
sanitized metadata, same-origin thumbnails, visible attribution, canonical post
links, and the next cursor. A single explicit result click may attach the
recently returned thumbnail to the same composer that opened the panel; a
double-click opens the canonical Remibooru post. The package receives no extra
URL or bytes, the host forgets attachment result IDs after five minutes, and no
action submits the X post.

A future X-link index would require its own approved storage/disclosure,
reset/pruning, unavailable-source, and user-value evidence. It is deferred, not
partially shipped under #17.

## Maker thumbnail provenance

The following package-local thumbnail files retain their source scene/character imagery and are rendered with `object-fit: contain`; they are not runtime hotlinks. The four supplied character PNGs were trimmed only at fully transparent canvas margins with four pixels of padding, with no resampling or changes to remaining RGBA pixels, so the compact controls give the art a larger share of the frame. They are loaded from package files at runtime; no remote image URL, download, canvas fetch, or user-private image is used.

| Package asset | Public source method and URL |
|---|---|
| `assets/makers/cheeseworld.png` | Public square CHEESEWORLD image: `https://cult.inc/assets/img/cheese.png` (667x680). |
| `assets/makers/milady.png` | Maintainer-provided `Milady-1785260877310.png` (700x875); transparent-margin crop `(0,40,676,875)` to 676x835, no resampling. |
| `assets/makers/remilio.png` | Maintainer-provided `Remilio-1785260755524.png` (700x700); transparent-margin crop `(0,65,563,700)`, then visible-character framing crop `(150,19,563,635)` to 413x616, no resampling. |
| `assets/makers/bonkler.png` | Maintainer-provided `Bonkler-1785261013732.png` (600x800). Deterministic derivative: only border-connected blue-sky/green-ground pixels had alpha set to zero, then transparent-margin crop `(0,76,600,800)` to 600x724; no redrawing, resampling, upscaling, generative editing, or foreground-pixel changes. |
| `assets/makers/kagami.png` | Maintainer-provided `Kagami-1785261058055.png` (768x1024); transparent-margin crop `(0,66,726,1024)` to 726x958, no resampling. |

Source origin is not a VPL, copyright, redistribution, or other licence approval. Any such approval remains a separate review decision.

## Public surfaces used

| Surface | Used for | Result |
|---|---|---|
| `sdk/README.md` | Package rules, prebuilt-JS requirement, lifecycle/disposable guidance, documented validation commands | Followed. |
| `sdk/types/index.d.ts` | `boot`, `open`, `close`, `disable`, `dispose`, `context.storage.local`, diagnostics, cancellation, disposables | Followed. |
| `sdk/templates/docked-app/` | Public overlay lifecycle and accessibility pattern | Adapted without private imports. |
| `sdk/UI.md` and `sdk/ACCESSIBILITY.md` | Dialog naming, Escape close, focus restoration, native controls, live status, 44px controls | Followed. |
| `sdk/ASSETS_AND_LICENSING.md` | Declared stylesheet, package-owned reply arrow/lightning SVG icons, and hash-declared maker images with explicit provenance notes | Followed; source origin is not treated as licence approval. |
| `docs/APP_SDK.md` | Manifest, generated enablement, local-package and dock rules, storage and privacy declarations | Followed. |
| `docs/LOCAL_ADDONS.md` | Validation/composition workflow and local-review acknowledgement | Followed. |
| `docs/local-app-package.schema.json` | Exact manifest fields and permitted enums | Followed. |
| `examples/packages/local-dev/dev-note/` | Prebuilt external-package structure and generated enablement setting | Followed. |

## Friction and blockers

1. **No composer surface or composer context.** `TwitterSurfaceKind` provides tweet/article/user-cell/notification/direct-message/profile, but no post or reply composer. `onSurface()` cannot receive a supported composer element.
   - Workaround used: none. The package does not query or observe X composer DOM.
   - Recommendation: expose a short-lived `composer` surface with explicit compose/reply kind and a constrained editor facade.

2. **Host-mediated composer actions and local lists.** The package uses only declared user-gesture callbacks for quick replies, host-owned native Drafts, declared maker modes, and a host-validated local text list; it does not read or mutate X composer or Drafts DOM.
   - Result: `milady`, `remilio`, and each host-expanded local custom phrase are passed only through the reviewed reply callback after an explicit row click. Native Drafts are opened only through the declared host action. The package does not read the phrase list directly.

4. **Reviewed maker handoff only.** The package calls the declared host-mediated handoff only after an explicit icon click. The host may transfer the active draft to the named reviewed maker, generate/capture the maker PNG, and attach it to that same active X composer. The package receives neither draft nor image bytes, does not inspect any X/maker DOM, clipboard, tab, or browser API, and cannot post.
   - CHEESEWORLD remains a normal, clearly disclosed user-click link. It transfers no text, sends no upload, and has no return-media flow.

5. **Unclear external-link policy.** The manifest distinguishes remote services and host permissions, but the public material does not say whether a user-clicked anchor needs a host declaration or which maker domains are reviewed.
   - Workaround used: declare the destination in privacy/hub disclosure and make no request from package code.
   - Recommendation: document an external-link policy and a reviewed-destination registry or explicit acknowledgement requirement.

7. **X site scope is treated as a privileged package surface.** The documented validator requires `privacy.consentRequired: true` before a package with this host scope can enable, even though the package makes no API request. The manifest now declares that consent requirement and remains disabled by default.
   - Recommendation: make this consent consequence explicit beside the external overlay-app authoring example.

8. **The documented validator accepts an absolute external package path, but the documented Chromium builder does not.** `verify:local-app-package` accepted this package outside the repository. `build:local-apps:chromium` composed it, then rejected the plan because its source root was absolute and the generated extension builder only permits relative package-source paths.
   - Workaround used: none. Copying the package into a repository folder would violate the outside-author premise and would hide the problem.
   - Recommendation: allow a composed plan to contain a canonicalized external package source (or copy validated sources into a composer-owned temporary staging root before plan validation). Document the supported external-author build path end to end.

6. **No public package test harness in the allowed contract set.** The README mentions `sdk/testing/app-harness.mjs`, but it was not included in the authorized public-reading set for this pilot.
   - Workaround used: run only the documented package validator/composer commands.
   - Recommendation: put a minimal harness usage example and an explicit external author test command in `sdk/README.md`.

## What this pilot could not implement

Quick replies, the bounded local phrase list, and native Drafts use only reviewed host-mediated contracts after explicit user actions. The package keeps no local draft shelf, cannot inspect X Drafts or read the phrase list, and never queries or mutates X DOM. The four reviewed Remilia maker actions are explicitly user initiated and request only declared `captioned` or `randomMeme` modes: randomMeme permits an empty draft and returns uncaptioned maker output. The host may attach a captured maker PNG to the same active X composer, while the package receives no image bytes and never posts. CHEESEWORLD remains a no-transfer external link.

## Public-command results

- `pnpm.cmd run verify:local-app-package -- --package=<external-package-path> --allow-local-review --acknowledge-package-consent` — **passed**: one accepted local `app`, one expected local/unreviewed warning, and both required acknowledgements recorded.
- `pnpm.cmd run build:local-apps:chromium -- --package=<external-package-path> --out-dir=tmp/external-author-pilot-chromium --allow-local-review --acknowledge-package-consent` — **composition passed, final Chromium build blocked** by the absolute external source-root restriction described above. No private workaround was attempted.

## Versioned Custom Pet continuation

For issues #190–#193, the reviewed pilot package was moved into
`examples/packages/local-dev/tweet-composer-kit/` without changing its package
ID. This gives the existing Post-Factory a reviewable source boundary and keeps
it composable with the existing Share Kit package in the one shared extension.

The continuation adds a user-initiated Custom Pet export inside the existing
composer panel. The user selects a transparent local Maker PNG, exact stable
trait IDs, one of the four declared template families, versioned lower-body and
footwear choices, palette variants, and a visible rights scope. The package
creates and verifies `remilia-pet-request.zip` locally; it does not upload,
cache, post, publish, invoke Codex, or infer missing identity choices.

The imported pilot baseline and its package hashes are recorded in
`docs/provenance/custom-pet-pipeline.md`. New source is bundled with
`npm.cmd run build:composer-kit-package`, and the sanitized fixture is generated
without a user or reference image.

## Migration to the optional Pets Maker app

The Custom Pet form, request contract, canvas/ZIP work, and pet-specific styles
were moved to `../pets-maker/`. Post-Factory no longer imports, renders, or
describes pet functionality. The historical continuation above records the
earlier pilot location; current ownership is the disabled-by-default Pets Maker
rail package requested during issue #191 follow-up QA.
