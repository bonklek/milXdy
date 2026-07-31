# Music headphones customization walkthrough

This example is executable as a local custom modification. It does not require
catalog admission or VPL approval.

The repository includes a synthetic 64×64 source and a synthetic derivative so
authors can inspect the full before/after record without copying external art:

| Record | Path | SHA-256 |
|---|---|---|
| Local source | `fixtures/valid/reference-source/source/reference.svg` | `8de6065b721d47280f505e606eb5c710af4438e056931add408622224b9e9d93` |
| Headphones derivative | `fixtures/valid/local-derivative/source/music-headphones.svg` | `daacdcf08bc257d22da6302f66d0eeda3920a5594c2918c5da2637e724c4ee54` |
| Package export | `fixtures/valid/local-derivative/exports/achievement.svg` | `8922973786db41d378fd4cd842ba7ee251859736008b4c50fb99e0e6f9e1560f` |

These are validator fixtures, not required artwork or an external provenance
claim.

## 1. Choose a local source

Use an image you created, selected, or already keep locally. Preserve an
untouched copy. A catalog ID is optional.

Recommended record:

```text
local asset ID: local.music-source
source path: visual-sources/music-source.png
source SHA-256: <HASH>
license status: declared | unknown | not-applicable
source note: <OPTIONAL NOTE>
```

If license details are unknown, record `unknown` rather than blocking the local
workflow or inventing a license claim.

## 2. Write the transformation brief

Use the exact local file as the visual input:

> Add a pair of cartoon headphones as a feature-specific layer. Preserve the
> source character's treatment, palette relationship, framing, silhouette, and
> small-size legibility. Keep the headphones distinct from hair or headwear.
> Do not add unrelated text, signatures, logos, or background elements.

The brief is intentionally narrow. It helps visual consistency and makes later
edits understandable; it is not a licensing gate.

## 3. Create and inspect the derivative

Save the output separately from the source. Inspect:

- the ears, hair, headwear, cable, and ear-cup edges;
- accidental text, signatures, logos, or image-generation artifacts;
- silhouette and contrast at the actual UI size;
- light, dim, and dark backgrounds; and
- whether the result still reads as a Music-specific image.

Record the tool/model when useful. AI-modified output should be labeled as such
for collaborators, but it does not need project approval for local use.

## 4. Record local lineage

The included derivative manifest demonstrates:

```json
{
  "id": "fixture.music-headphones",
  "distributionScope": "local-custom",
  "entryRole": "derived-asset",
  "parents": [
    {
      "id": "fixture.reference-source",
      "version": "1.0.0",
      "sha256": "8de6065b721d47280f505e606eb5c710af4438e056931add408622224b9e9d93"
    }
  ],
  "transformations": [
    {
      "operation": "add-geometric-headphones",
      "notes": "Headband and ear-cup paths added; parent kept unchanged."
    }
  ],
  "license": {
    "status": "unknown",
    "id": null
  }
}
```

Unknown license status is valid in the local lane.

## 5. Export and declare the package asset

Create each size from the derivative master and record the actual dimensions,
format, byte size, and hash. The included fixture demonstrates a 64×64 SVG
achievement export. A real package should render-test the roles it actually
uses: rail icon, achievement/badge, notification, compact header, or preview.

Declare the shipped export:

```json
{
  "id": "music.achievement",
  "path": "assets/music-achievement.svg",
  "kind": "image",
  "webAccessible": true,
  "sha256": "8922973786db41d378fd4cd842ba7ee251859736008b4c50fb99e0e6f9e1560f"
}
```

No catalog lookup occurs at runtime.

## 6. Accessibility and theme review

Functional alt text:

> Character wearing headphones, Music achievement icon.

When adjacent text already communicates the achievement, use empty alt text.
Verify light/dim/dark, 320 px width, 200% zoom, forced colors, contrast, and the
actual rendered size. If the achievement triggers sound, also verify mute,
reduced sensory effects, and a visible equivalent.

## 7. Use locally

Run package and extension validation, compose the custom build, and inspect the
result. Local success does not imply project endorsement or upstream inclusion;
it simply means the user's custom modification is ready for their build.

## Optional: propose it for default/upstream inclusion

Only this optional promotion step requires VPL:

1. establish that the source and derivative are explicitly VPL;
2. add the complete VPL proof/text/notice metadata;
3. set `distributionScope` to `upstream-default`;
4. ensure every dependency is VPL and adds no further restriction;
5. complete technical, visual/cultural, accessibility, license, and release
   review; and
6. record an immutable `UPSTREAM_APPROVED` decision tied to final hashes.

If the asset is not VPL, the upstream proposal stops. The local custom package
does not fail and can continue using its own declared file.
