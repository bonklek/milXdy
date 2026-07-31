# Remilia Maker pet QA and local cache

The Maker adapter rejects objective atlas defects before a separate semantic
visual review. Its deterministic sequence is fixed:

1. v2 atlas canvas, 11-row geometry, runtime frame count, the reserved
   neutral-look fallback cell, and unused-cell transparency;
2. visible alpha, cell-edge clipping, and frame separation;
3. family-template baseline, centroid, scale continuity, required inner-region
   coverage, and permitted-envelope registration;
4. declared phase order, adjacent-frame continuity, and loop closure;
5. separate review of identity, expression, trait fidelity, gait/look
   direction, and motion quality.

`compare_pose_envelope.py` writes `deterministic-qa.json`, an annotated atlas,
and a diagnostic PNG for each failed cell. Every failure records the row,
frame, phase, measured value, threshold, template ID/version, and diagnostic
path. It also initializes `semantic-review.json` with `status: pending`;
deterministic success never changes that status.

Run the checks with the bundled workspace Python runtime, which supplies
Pillow:

```powershell
python scripts/compare_pose_envelope.py `
  --atlas <spritesheet> `
  --selected-template <run>/selected-template.json `
  --identity-brief <run>/identity-brief.json `
  --output-dir <run>/qa
```

## Versioned v1 thresholds

All distances and regions are normalized to a 192x208 cell. Scale tolerance is
relative to the row median. Expansion zones widen the permitted envelope only
when an authoritative identity brief declares the applicable hair, costume,
headwear, or prop; they do not waive clipping or required core coverage.

| Template | Min alpha | Max edge alpha | Baseline | Centroid | Scale | Max outside envelope | Adjacent | Loop |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| `milady-v1` | 180 | 0 | 0.060 | 0.090 | 0.130 | 0.015 | 0.140 | 0.100 |
| `remilio-v1` | 210 | 0 | 0.040 | 0.100 | 0.140 | 0.018 | 0.160 | 0.110 |
| `bonkler-v1` | 260 | 0 | 0.045 | 0.120 | 0.160 | 0.020 | 0.180 | 0.120 |
| `kagami-v1` | 180 | 0 | 0.032 | 0.085 | 0.120 | 0.014 | 0.130 | 0.090 |

These thresholds are template-version inputs and therefore participate in
provenance invalidation through the combined template SHA-256.

Each row also declares a versioned QA policy. Locked rows register to the
family alpha centroid/baseline. Run and jump rows may rise but not sink below
the baseline tolerance. Jump and failed sequences use continuity rather than a
fixed neutral centroid; failed poses allow dynamic scale; moving feet and
airborne phases exempt only the neutral foot-contact region. The measured
values remain in the report even when the row policy makes a neutral-region
comparison inapplicable.

## Cache and resume

The adapter fingerprint is the SHA-256 of canonical JSON containing the image
hash, exact traits and trait policy, body completion, family/template version,
adapter/prompt/policy versions, and style settings. `cache_resume.py plan`
selects one of:

- exact validated atlas reuse after hash, provenance, deterministic QA, and
  separate semantic-approval verification;
- the first unfinished row in a provenance-bound interrupted run;
- a trait-diff action; or
- full row generation.

`plan_trait_diff.py` distinguishes exact/non-pet-only and metadata-only changes,
small face/accessory edits, and identity/major-silhouette changes. It never
infers that a visual row is safe merely from raw silhouette similarity.

Cache roots are explicitly user selected. Entries contain only the final
validated atlas and provenance/review hashes—not the raw bundle, request
sidecar, or canonical input image. `cache_resume.py store` refuses an atlas
unless deterministic QA passed, semantic review is independently approved and
bound to the current QA report, and the atlas hash matches the measured
artifact.
