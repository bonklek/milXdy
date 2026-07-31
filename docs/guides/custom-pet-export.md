# Custom Pet export

Composer Kit can turn one explicitly selected, transparent Maker PNG into a local handoff bundle for Codex. It does not upload the image, invoke Codex, generate animation rows, publish a pet, or post to X.

## Export

1. Open **Composer Kit** from the existing X composer action.
2. Expand **Custom Pet export**.
3. Select Milady, Remilio, Bonkler, or Kagami and choose the transparent PNG downloaded from that Maker.
4. Enter every stable Maker trait ID. Use the explicit ID `none` for an absent trait; no missing trait is invented.
5. Choose leg coverage, leg color, a compatible bottom garment and color, and footwear and color.
6. Review the completed 1024×1024 avatar preview.
7. Confirm the visible rights scope and download `remilia-pet-request.zip`.

The ZIP contains exactly:

```text
remilia-pet-request.zip
├── avatar.png
└── request.json
```

The package checks the PNG signature and dimensions, recomputes its SHA-256, validates the sidecar, writes a deterministic stored ZIP, reopens that ZIP locally, and validates the hash again before download.

After a successful export, attach the ZIP to Codex and use:

```text
Use $remilia-maker-pet-import with the attached Maker export bundle.
```

## Contract

`request.json` follows [the version 1 schema](../schemas/remilia-pet-request.schema.json). Its compatibility boundary includes:

- one of the four template families and template version 1;
- the exact PNG SHA-256 and canonical 1024×1024 dimensions;
- stable IDs for race, hair, eyes, glasses, shirt, and earrings;
- explicit omission/adaptation policy for background, friend, overlay, and shirt text;
- versioned leg, bottom, footwear, and palette choices;
- a visible rights scope, conservatively initialized to `private-review`.

Only combinations declared by the versioned completion catalog can be exported. Changing leg coverage can invalidate a prior bottom choice, but the UI never replaces it with a guessed selection.

## Recovery

- **Opaque PNG:** return to the Maker and export a transparent avatar. Background material is outside the pet identity contract.
- **Missing trait:** enter its exact asset ID or the explicit ID `none`.
- **Unavailable bottom:** choose a garment compatible with the current leg coverage.
- **Hash or ZIP failure:** the bundle is not downloaded; the panel keeps the current selections so the user can retry.
- **Legacy upper-body avatar:** complete the visible lower-body fields. Neither Composer Kit nor the adapter infers a lower half.
