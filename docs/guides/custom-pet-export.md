# Pets Maker export

Pets Maker is an optional, disabled-by-default App SDK package installed from
the checked-in maintainer Add-ons catalog. Installing it makes the app
available without enabling or pinning it; the user must deliberately enable it
in **Apps & Features**. It then opens from the side rail as a dedicated popout
and turns one explicitly selected transparent Maker PNG into a local handoff
bundle for Codex. An optional Fetch action sends only the selected public Maker
family and NFT number to `maker.remilia.org` to populate visible trait fields.
It does not upload the image, invoke Codex, generate animation rows, publish a
pet, or post to X.

## Export

1. Select **Pets Maker** in the Add-ons catalog and run the reviewed local
   Prepare/Apply workflow.
2. Enable **Pets Maker** in **Apps & Features**, then open **Pets** from the rail.
3. Select Milady, Remilio, Bonkler, or Kagami.
4. Optionally enter the source NFT number. The app applies the family-specific
   range: Milady 0-9999, Remilio 1-10000, Bonkler 1-150, Kagami 1-3000.
5. Click **Fetch** to populate the visible trait fields from public Maker
   metadata, or enter the traits manually. Review every populated value.
6. Choose the transparent PNG downloaded from that Maker.
7. Enter or correct every stable Maker trait ID. Use `none` for an absent trait;
   no missing trait is invented.
8. Choose leg coverage, a compatible bottom and color, and footwear and color.
   Leg color is derived from the selected family's race trait and is not a
   separate input.
9. Review the completed 1024x1024 avatar and download
   `remilia-pet-request.zip`.

The ZIP contains exactly `avatar.png` and `request.json`. The package checks the
PNG signature and dimensions, recomputes SHA-256, validates the sidecar, writes
a deterministic stored ZIP, reopens it locally, and validates the hash again.
The sidecar contains no rights checkbox or rights declaration; downstream use
remains private unless the user establishes permission elsewhere.

After a successful export, attach the ZIP to Codex and use:

```text
Use $remilia-maker-pet-import with the attached Maker export bundle.
```

## Contract and recovery

`request.json` follows [the version 1 schema](../schemas/remilia-pet-request.schema.json).
It records the family and optional NFT number, exact PNG SHA-256, canonical
dimensions, stable trait IDs, omission/adaptation policy, versioned body assets,
derived leg color, and Pets Maker generator version.

- If the PNG is opaque, return to the Maker and export a transparent avatar.
- If public Maker metadata cannot be fetched, keep the form open and enter the
  visible traits manually; no image or account data is required by the request.
- If a trait is absent, enter the explicit ID `none`.
- If race cannot be mapped to a family-specific leg color, correct the exact
  race asset ID; the app does not guess.
- If a bottom is unavailable, choose one compatible with leg coverage.
- On hash or ZIP failure, no bundle is downloaded and the visible form remains
  available to retry.
