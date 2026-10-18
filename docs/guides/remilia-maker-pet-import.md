# Remilia Maker Pet Import

The adapter shipped with milXdy 0.2.5 as a non-web-accessible user download.

`remilia-maker-pet-import` is the companion Codex adapter for Pets Maker's
`remilia-pet-request.zip`. It validates the two-file bundle, selects the
declared Milady, Remilio, Bonkler, or Kagami v1 motion template, prepares an
authoritative full-body identity brief, and delegates final visual generation
and v2 packaging to `hatch-pet`.

The installable skill ZIP is built from:

```text
assets/user-downloads/remilia-pet/remilia-maker-pet-import/
```

Build it with:

```powershell
npm.cmd run build:remilia-pet-skill
```

The resulting
`assets/user-downloads/remilia-pet/remilia-maker-pet-import.zip` is a
non-web-accessible user download included in extension builds. Extract the
skill directory into the local Codex skills folder, refresh skills, then attach
a Pets Maker export and say:

```text
Use $remilia-maker-pet-import with the attached Maker export bundle.
```

The adapter stores input only in the user-selected run directory. It does not
publish, post, install a pet, infer missing body choices, or infer publication
permission. Pets Maker exports contain no rights declaration.

Validation fails closed before extraction. The adapter requires the exact
two-entry ZIP contract, rejects duplicate JSON fields, verifies every PNG chunk
boundary and CRC, decodes only the canonical non-interlaced 8-bit RGBA image,
requires retained transparency, and compares the SHA-256 of those exact image
bytes with the sidecar. Template selection then validates the complete v1
landmark, pose, phase, loop, region, envelope, threshold, and sixteen-direction
contract. Identity and run provenance name and hash the bundled trait-policy
document, so a policy or adapter change invalidates stale prepared work.

## Sanitized contract fixtures

Each fixture contains generated geometric sample art only—no user image,
reference image, or Maker source raster. All four run through bundle validation,
family-template selection, identity preparation, and hatch-pet handoff:

| Family | Bundle | SHA-256 |
|---|---|---|
| Milady | `examples/fixtures/remilia-pet-request/milady/remilia-pet-request.zip` | `6d3abcfae5d61c5a3f26706e39a11901b522f63068d29dc65bd931b46bedd690` |
| Remilio | `examples/fixtures/remilia-pet-request/remilio/remilia-pet-request.zip` | `b5542a066ab46339ebc71843ca17651e501dbb8d6decfc41e820be10c4240a69` |
| Bonkler | `examples/fixtures/remilia-pet-request/bonkler/remilia-pet-request.zip` | `6d1aa2a01a7f9c0db76fb01a53f8aaf52963afb3f1369b0dc1a600130bf7b6e8` |
| Kagami | `examples/fixtures/remilia-pet-request/kagami/remilia-pet-request.zip` | `8de16234c020368a5d315f136d72c9642a9b88316ca968aa54126e1a16e643bd` |

These fixtures verify the import and delegation contract. Final sprite
generation remains under `hatch-pet`; deterministic Maker-template QA and
semantic approval are recorded separately.

## Local family-template review

Run integration checks with your own read-only v2 samples and private review
records. Pass `--pets-root` and `--expected` explicitly to
`npm run verify:remilia-pet-family-integration`. Keep generated sprites,
reference images, sample inventories, and review records outside public source.
Each family needs deterministic template validation and a separate visual
review for identity, traits, motion, gait, clipping, and look directions.
