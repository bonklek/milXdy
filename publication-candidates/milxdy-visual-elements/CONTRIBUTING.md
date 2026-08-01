# Contributing visual elements

There are two distinct contribution lanes. Choose the lane before preparing
metadata or asking for review.

## Lane A: local custom modification

Local packages belong to their users. Authors can use original work, personal
files, generated output, third-party material, or other assets according to
their own needs and obligations. The milXdy tooling does not require VPL,
catalog admission, or a maintainer decision for local use.

Recommended local practice:

- keep source and optimized exports separate;
- declare every shipped path and SHA-256 in `milxdy.app.json`;
- record where an asset came from and what changed when that information is
  useful to future you or collaborators;
- include any notices required by the asset's actual license;
- avoid secrets, personal metadata, tracking URLs, and executable remote code;
- add alt/decorative guidance and test at the actual rendered size; and
- use `visual-assets.lock.json` when reproducible pinning matters.

Unknown or informal provenance may produce a warning, but it does not prevent a
user from composing and running a local custom package.

## Lane B: default/upstream inclusion

An asset proposed for the milXdy codebase, default packages, or official
published visual bundle must have exact license-or-permission evidence
compatible with copying, modification, redistribution, and App SDK use. VPL is
supported but not the only qualifying path. This is the project contribution
policy, not a restriction on local packages.

An upstream submission includes:

- exact source and proposed exports with SHA-256 values;
- creator/source context and exact license or permission evidence covering the file;
- complete terms, required notices, and a compatibility decision for the intended use;
- parent records and transformation notes for derivatives;
- disclosure of AI/tool/model use when applicable;
- theme, rendered-size, alt/decorative, contrast, motion, and sensory guidance;
- package declaration and reproducibility lockfile; and
- technical, visual/cultural, accessibility, license, and release review.

The contributor or an AI tool cannot self-approve upstream inclusion.

## Review roles for upstream work

1. **Technical reviewer** — verifies file identity, safe paths, formats,
   dimensions/duration, hashes, package declarations, and build exclusion.
2. **Visual/cultural reviewer** — verifies intended use, composability,
   misleading affiliation, embedded marks/text, and cultural framing.
3. **Accessibility reviewer** — verifies alt/decorative guidance, contrast,
   rendered-size legibility, theme behavior, and motion/sensory needs.
4. **Rights reviewer** — verifies exact license-or-permission scope, proof,
   notices, dependencies, and compatibility with intended catalog use.
5. **Release reviewer** — binds approvals to final hashes and promotes the
   entry into the default/upstream set.

## Local checks

```sh
npm run verify
```

Mechanical validation is not legal advice and does not transfer rights. For
local entries it verifies structure and safety while reporting rights metadata
as informational. The current upstream validator still enforces the older
VPL-only gate and must be generalized and re-reviewed before publication.

## Versioning and removal

Stable IDs and hashes are recommended for local collaboration and required
upstream. Published upstream bytes are immutable: changes receive a new version.
Deprecation, correction, takedown, or removal retains enough history for
packages to migrate without continuing to advertise withdrawn bytes.
