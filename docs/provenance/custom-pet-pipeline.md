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
