# Custom Pet pipeline provenance

This record distinguishes copied material from independently implemented work. It contains no user image, private prompt, or machine-specific path.

## Composer Kit baseline

The versioned package under `examples/packages/local-dev/tweet-composer-kit/` was imported from the maintainer-reviewed local Composer Kit pilot already used by the 0.2.4 shared QA extension.

- package ID: `tweet-composer-kit`
- imported package content SHA-256: `f7baa0e50a1a5f44236e23ac5af2d317000a7d7b2148112cb213b5515c8a39c7`
- imported manifest SHA-256: `9217246fa3487f2cd8296ab3bcc53f5ac4ce862f8246a3240e96c7eb2cc4c705`
- license compatibility: both the source package context and milXdy use the Viral Public License
- retained behavior: quick replies, native Drafts, Maker handoffs, Remibooru browsing/contribution handoff, and CHEESEWORLD link

The Custom Pet contract, completion catalog, canvas compositor, ZIP writer, tests, and schema were implemented in this task. No user image or pet-generation raster was imported.

## Remilia Pets source material

The maintainer-local `remilia-pets` repository is treated as read-only source material. Its VPL license is compatible with milXdy. Adapter/template reuse is recorded by exact repository-relative file and SHA-256 when those files enter a later issue-mapped commit. Pet spritesheets, references, generation prompts, and private run artifacts are not copied.

The #192 adapter and template contract use the following VPL-compatible source
material from the read-only repository snapshot. The source worktree had local
changes, so hashes—not an assumed clean commit—identify the exact inputs.

| Read-only source file | SHA-256 | Reuse |
|---|---|---|
| `skills/remilia-pet-intake/scripts/validate_template.py` | `32a7ba12c69dc85c0c8a52e7ad2966eccba61a80beb343a137c0365618516e88` | Ported safe-path, 11-row, frame-contract, and actionable validation conventions into the independent JSON-template selector. |
| `skills/remilia-pet-intake/assets/motion-templates/remilio-v1/manifest.json` | `1c2045e8e94ac0d86ffd87a51af680bbb3556ed0b186be8f4cc6edae023bd741` | Reused the Codex v2 row map, centered registration vocabulary, and specification-only template boundary; expanded it to four family-specific geometry contracts. |
| `skills/remilia-pet-intake/references/motion-catalog.json` | `aeb0ecae7b18b72dffebb27d55cae2c8ccac09679b98f11f8474281940361262` | Reused standard-row meanings, frame counts, transition semantics, and concise motion guidance. |
| `skills/remilia-pet-intake/references/template-authoring.md` | `9390841d8cbb07559a3eb80228107be90568e5eb10a3a48ba82cc6ada344f498` | Reused the identity-neutral template, landmark, safe-padding, and tolerance-envelope principles. |
| `skills/remilia-pet-intake/references/intake-sidecar.md` | `79c7b06fc13bd61366006f4f82512c7db001832060c880678e9db49e3f6db55d` | Reused the authoritative identity/evidence split and explicit omission policy. |

No raster, pet package, source reference, prompt, or private run artifact was
copied from `remilia-pets`.

## Deterministic QA and cache/resume

The #193 atlas measurement, failure diagnostics, trait-diff classification, and
provenance-aware cache/resume scripts are independently implemented for this
pipeline. They reuse the VPL-compatible source validator's documented
transparent-cell, alpha-bounds, safe-envelope, and actionable-error
conventions listed above. They do not copy its implementation, template
rasters, character sprites, private inputs, or semantic-review results.
