# Remilia Maker Pet Import

`remilia-maker-pet-import` is the companion Codex adapter for Composer Kit’s
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
a Composer Kit export and say:

```text
Use $remilia-maker-pet-import with the attached Maker export bundle.
```

The adapter stores input only in the user-selected run directory. It does not
publish, post, install a pet, infer missing body choices, or broaden the
sidecar’s rights scope.

## Sanitized contract fixtures

Each fixture contains generated geometric sample art only—no user image,
reference image, or Maker source raster. All four run through bundle validation,
family-template selection, identity preparation, and hatch-pet handoff:

| Family | Bundle | SHA-256 |
|---|---|---|
| Milady | `examples/fixtures/remilia-pet-request/milady/remilia-pet-request.zip` | `6c31279ecb6e67a9542f54d6baf9661867c77cf0698d8e24912a12222d62ea8a` |
| Remilio | `examples/fixtures/remilia-pet-request/remilio/remilia-pet-request.zip` | `2ebef3d8386467c7ccc411c84874d3d83301c7f7872ae3db35aa453bc4f6729f` |
| Bonkler | `examples/fixtures/remilia-pet-request/bonkler/remilia-pet-request.zip` | `981bc480fcf686b25fe679799cf87380ab35546b555882984d1a92b601f073c8` |
| Kagami | `examples/fixtures/remilia-pet-request/kagami/remilia-pet-request.zip` | `f55bf996774cc3f7b5ea17be846b1e59b432494e8a180453360460f9a4db7487` |

These fixtures verify the import and delegation contract. Final sprite
generation remains under `hatch-pet`; deterministic Maker-template QA and
semantic approval are recorded separately.
