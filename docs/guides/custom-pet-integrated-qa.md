# Custom Pet integrated QA

> Planned 0.2.5 pipeline evidence. This workflow is not part of the 0.2.4
> shipped feature set.

The #190 integration proof exercises the complete local contract without
committing or uploading a character raster:

1. read a VPL-compatible, already-validated Codex v2 atlas from the
   maintainer-selected read-only `remilia-pets` source;
2. derive a deterministic 1024x1024 private-review avatar from its reserved
   neutral-look cell and declare every trait and lower-body choice explicitly;
3. create and validate the exact two-file `remilia-pet-request.zip`;
4. run the Maker adapter, select `milady-v1`, and produce the versioned
   hatch-pet handoff and provenance fingerprint;
5. validate the real 1536x2288 WebP through hatch-pet;
6. run deterministic Maker-template QA and produce diagnostics;
7. apply the separately recorded semantic review; and
8. store and reuse the exact validated atlas through the local cache contract.

Run the reproducible check with the bundled workspace Python runtime:

```powershell
$env:PYTHON = "<bundled-workspace-python>"
npm.cmd run verify:remilia-pet-integration -- `
  --source-root="<read-only-remilia-pets-root>" `
  --expected=docs/evidence/custom-pet-mvp/milady-integrated-run.json
```

The source root is an explicit input so the repository contains no
machine-specific path. The verifier hashes the license, manifest, atlas,
contact sheet, and direction sheet before trusting the manual review; uses a
temporary local run/cache; and removes it afterward. It never modifies the
source tree. It fails if the request, adapter handoff, hatch-pet v2 validation,
objective QA, semantic evidence, or exact-cache reuse diverges.

The committed evidence is split deliberately:

- `docs/evidence/custom-pet-mvp/milady-integrated-run.json` contains portable
  hashes and gate results only.
- `docs/evidence/custom-pet-mvp/milady-semantic-review.json` records the
  identity, expression, trait, direction/gait, and motion-quality review
  separately from objective measurements.

The real run passed hatch-pet and measured 73 runtime frames plus the v2
neutral-look fallback cell with zero deterministic failures. Hair and costume
expansion zones were activated from authoritative traits. The semantic review
then approved the same hash-identified atlas and preview sheets, after which an
exact rerun reused the validated atlas without caching the raw bundle,
request sidecar, or canonical input image.

This proof authorizes no publication, installation, upload, post, or rights
expansion. The generated bundle and temporary extracted avatar are not retained
in the repository.
