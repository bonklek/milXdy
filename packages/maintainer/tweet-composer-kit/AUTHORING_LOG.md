# Post-Factory package provenance

This App SDK package contains its own JavaScript, styles, reply icons, and Maker
thumbnails. It uses declared host capabilities and cannot read host credentials
or private browser data. Remote actions require explicit user interaction.

## Maker thumbnails

- `assets/makers/cheeseworld.png` derives from the public CHEESEWORLD image at
  `https://cult.inc/assets/img/cheese.png`.
- Milady, Remilio, Bonkler, and Kagami thumbnails use maintainer-supplied artwork.
  Processing crops transparent margins or removes border-connected background;
  no generative redrawing or resampling is used.

Source origin is not a copyright, redistribution, or other license approval.
Applicable rights review remains separate from technical package validation.
Package manifests identify the exact distributed files and hashes.

Private source filenames, authoring sessions, and local review records are not
part of the public package. Custom pet functionality belongs to the separate
optional Pets Maker package.
