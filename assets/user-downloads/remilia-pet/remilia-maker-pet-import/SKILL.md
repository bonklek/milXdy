---
name: remilia-maker-pet-import
description: Validate and import versioned remilia-pet-request.zip bundles exported by milXdy Composer Kit, select the declared Milady, Remilio, Bonkler, or Kagami motion-template family, prepare a traceable full-body identity and provenance handoff, and delegate final v2 pet generation and packaging to hatch-pet. Use when a user attaches a Maker Custom Pet export, asks to resume that import, or needs a Maker-family bundle checked without uploading, publishing, or inventing missing lower-body choices.
---

# Remilia Maker Pet Import

Keep this skill thin. Own the Maker bundle, family/template selection, identity
translation, provenance, and template-aware preflight. Let `$hatch-pet` own
visual generation, atlas assembly, v2 validation, semantic visual QA, and final
packaging. This adapter adds Maker-template measurements before that semantic
gate without replacing hatch-pet's package validation.

## Import workflow

1. Treat the attached ZIP and its image as private unless the sidecar explicitly
   says otherwise. Never infer publication permission.
2. Run `scripts/validate_bundle.py` before extracting or reading the image into
   another workflow:

   ```powershell
   python scripts/validate_bundle.py <bundle.zip> --json-out <run>/bundle-validation.json
   ```

3. Stop on any archive, schema, PNG, SHA-256, trait, policy, body-completion, or
   rights error. A legacy upper-body bundle without explicit legs, bottom,
   footwear, asset versions, and colors is incomplete; do not fill it in.
4. Prepare a local run:

   ```powershell
   python scripts/prepare_import.py <bundle.zip> --output-dir <run>
   ```

   The command writes a validated input copy, selected template record,
   full-body identity brief, hatch-pet handoff, provenance, and row state.
5. Read `<run>/identity-brief.md`,
   `<run>/selected-template.json`, and `<run>/hatch-pet-handoff.json`.
   Treat the composited PNG and `bodyCompletion` choices as authoritative.
   Omit background, friend, and overlay material. Convert readable shirt text
   to an unreadable visual motif.
6. Invoke `$hatch-pet` with `<run>/input/avatar.png` as the canonical reference,
   the identity brief as the character contract, and the selected template as
   motion guidance. Do not copy hatch-pet scripts or reimplement its package
   stage here.
7. Before generating or resuming rows, inspect the provenance-aware local cache:

   ```powershell
   python scripts/cache_resume.py plan --run-dir <run> --cache-dir <user-selected-cache> --json-out <run>/resume-plan.json
   ```

   Reuse only an exact entry whose atlas hash, template/prompt/style provenance,
   deterministic QA, and separate semantic approval all validate. For an
   interrupted local run, resume at the first unfinished row recorded in
   `run-state.json`.
8. After hatch-pet assembles the v2 atlas, run Maker-template QA with the bundled
   workspace Python runtime (Pillow is required):

   ```powershell
   python scripts/compare_pose_envelope.py --atlas <atlas> --selected-template <run>/selected-template.json --identity-brief <run>/identity-brief.json --output-dir <run>/qa
   ```

   Fix objective failures before visual review. The command measures canvas and
   frame geometry, alpha, transparent unused cells, clipping, registration,
   baseline, scale, centroid, required-region coverage, permitted envelope,
   adjacency, declared phase order, and loop closure. It writes frame-specific
   diagnostics and initializes `semantic-review.json` as `pending`.
9. Review identity, expression, trait fidelity, gait/look direction, and motion
   quality separately. Mark `semantic-review.json` approved only after that
   review. Cache the final atlas only after both gates pass:

   ```powershell
   python scripts/cache_resume.py store --run-dir <run> --atlas <atlas> --cache-dir <user-selected-cache>
   ```

10. When a prior request exists, classify changes before reuse:

   ```powershell
   python scripts/plan_trait_diff.py --previous <old-request.json> --current <run>/input/request.json --json-out <run>/trait-diff-plan.json
   ```

## Template rules

- Select exactly `<templateFamily>-v<templateVersion>` from the sidecar.
- Support only `milady-v1`, `remilio-v1`, `bonkler-v1`, and `kagami-v1`.
- Read the selected family manifest plus
  `assets/templates/motion-profile-v1.json`; do not load every family into the
  generation prompt.
- Use required inner regions to preserve core body registration and permitted
  outer envelopes to catch clipping. Hair, hats, costumes, and props may enter
  only their declared expansion zones.
- Preserve the standard nine row meanings and the fixed 16-direction clockwise
  look contract. Geometry guidance is not character artwork and never replaces
  semantic review.
- Apply the selected manifest's versioned thresholds. A declared hair, costume,
  headwear, or prop expansion zone may enlarge the outer envelope; it never
  waives clipping, continuity, or required core registration.

## Trust boundaries

- Do not upload, post, publish, install, or broaden rights merely because a
  bundle validates.
- Do not regenerate omitted background, friend, or overlay material.
- Do not silently choose a family, trait, leg, bottom, footwear, or color.
- Do not cache raw private bundle data outside the user-selected local run.
- A cache entry may contain the final validated atlas and provenance hashes, but
  never the raw bundle, request sidecar, or canonical input image.
- Do not accept a model output solely because it resembles a silhouette.
- Keep the copied bundle, request hash, template hash, adapter version, policy
  version, and style settings in provenance.

Read `references/trait-policies.json` when translating traits. Read
`references/sidecar-schema.json` only when debugging or extending the versioned
contract.
