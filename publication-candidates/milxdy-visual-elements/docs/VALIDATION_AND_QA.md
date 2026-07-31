# Validation and QA

## Automated verification

From this repository candidate:

```sh
npm run verify
```

The dependency-free command checks:

1. schema presence and structural sanity;
2. valid local-custom, upstream-default, derivative, decision, and package-lock
   fixtures;
3. invalid omission and upstream-policy fixtures;
4. source/export SHA-256 and byte-size identity;
5. license metadata shape without imposing VPL on local entries;
6. strict VPL continuity only for `upstream-default` entries;
7. parent/dependency graph integrity;
8. safe relative paths and SVG active-content rejection;
9. local Markdown/HTML/CSS/JSON links;
10. no runtime remote asset loading;
11. no private filesystem/planning/credential path leaks; and
12. no visual source library in a normal milXdy extension build.

A passing command proves mechanical consistency. It is not legal advice or a
statement that a local asset is endorsed by milXdy.

## Local package QA

For every package-owned component, record:

| Field | Required coverage |
|---|---|
| Package | package ID/version, declared asset paths and hashes |
| Browser | supported Chromium and Firefox versions where applicable |
| Width | 320, 360, 420, nominal desktop CSS px |
| Zoom | 100%, 200% |
| Host theme | light, dim, dark, system |
| Chrome | RemiNet, Classic, justified Native |
| Preferences | normal/reduced motion, normal/reduced sensory effects |
| Color mode | normal and forced colors |
| Input | keyboard-only and pointer/touch where supported |
| Assistive technology | named screen reader/browser smoke test |
| Result | pass/fail, defect link, reviewer, date |

Check text reflow, focus order/visibility, initial/restored focus, Escape,
bounded live regions, labels, non-color states, error recovery, and actual
rendered-size legibility.

Local QA does not require a catalog decision. If an asset's license is known,
include its required notices. If it is unknown, record that honestly in the
optional manifest/lock rather than inventing a license.

## Asset safety checks

Both local and upstream lanes should:

- compare file signature, MIME, extension, dimensions/duration, and byte size;
- reject archives, polyglots, malformed media, and decompression bombs;
- reject SVG with scripts, event handlers, `foreignObject`, external
  references, animation, or active content;
- decide and document metadata stripping before hashing final exports;
- isolate previews from executable application context;
- reject undeclared package files and hash mismatches; and
- build without runtime remote asset loading.

These are technical safety rules, not licensing gates.

## Upstream/default QA additions

An upstream proposal additionally verifies:

- `distributionScope` is `upstream-default`;
- the source and dependencies are explicitly VPL;
- the complete VPL text and notices are present;
- exact source/proof hashes resolve;
- technical, visual/cultural, accessibility, license, and release reviewers
  approved the final bytes; and
- the decision outcome is `UPSTREAM_APPROVED`.

Failure here means “not eligible for default inclusion.” It does not invalidate
the user's local custom package.

## Package verification

1. Validate `milxdy.app.json` with the milXdy package validator.
2. Compare each declared package asset hash with the vendored file.
3. When a local lockfile exists, validate its source/export relationship.
4. For upstream submissions, verify the lock against the reviewed release and
   decision.
5. Build with network access disabled.
6. Inspect the archive for only declared vendored exports and applicable
   notices.
7. Assert the source-library tree is absent.

## Sound and motion QA

Sound tests cover no activation, activation, mute, per-app volume, overlapping
events, interruption, reduced sensory effects, and visible equivalents. Speech
and media controls must pause and stop.

Motion tests cover CSS and JavaScript animation. With reduced motion enabled,
requestAnimationFrame loops, particles, waveforms, wiggles, shimmers, and
reward effects stop or become static without hiding progress.

## Publication evidence

Retain the exact command/output, clean Git status, release checksums, upstream
review decisions where applicable, manual QA matrix, and archive-exclusion
result. Do not include local machine paths, credentials, cookies, personal
browser state, or private source material in public evidence.
