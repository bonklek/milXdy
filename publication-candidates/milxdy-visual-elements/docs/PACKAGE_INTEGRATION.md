# App SDK package integration

Local packages vendor their own files. They do not need an official catalog ID
or VPL approval to run in a custom milXdy build.

## Required package declaration

App SDK 0.2.4 packages declare every shipping file in `package.assets`:

```json
{
  "package": {
    "assets": [
      {
        "id": "music.achievement",
        "path": "assets/music-achievement.svg",
        "kind": "image",
        "webAccessible": true,
        "sha256": "64-lowercase-hex-characters"
      }
    ],
    "webAccessibleAssets": [
      "assets/music-achievement.svg"
    ]
  }
}
```

This declaration controls packaging and runtime access. It is intentionally
license-neutral. The file can be original, user-provided, generated, or under a
license chosen by the package author.

## Optional local asset lock

`visual-assets.lock.json` is recommended when an author wants reproducible
source/export history. A local lock can use `distributionScope:
"local-custom"`, `licenseStatus: "unknown"`, and `licenseId: null`:

```json
{
  "$schema": "schemas/milxdy-visual-assets-lock.schema.json",
  "schemaVersion": 1,
  "source": {
    "kind": "local-directory",
    "name": "my-visual-assets",
    "version": "1.0.0",
    "location": "visual-sources"
  },
  "packageManifest": "milxdy.app.json",
  "assets": [
    {
      "packageAssetId": "music.achievement",
      "assetId": "local.music-headphones",
      "assetVersion": "1.0.0",
      "distributionScope": "local-custom",
      "licenseStatus": "unknown",
      "licenseId": null,
      "sourceSha256": "64-lowercase-hex-characters",
      "exportPath": "exports/music-achievement.svg",
      "vendoredPath": "assets/music-achievement.svg",
      "sha256": "64-lowercase-hex-characters"
    }
  ]
}
```

The lock is metadata for the author; it is not a rights approval.

## Upstream/default promotion

When the same asset is proposed for a default package, the lock becomes
mandatory and changes to:

- `source.kind: "catalog-release"` with an immutable release URL;
- `distributionScope: "upstream-default"`;
- `licenseStatus: "declared"` and `licenseId: "VPL"`;
- exact manifest and decision hashes; and
- the complete VPL notice in the proposed package.

The strict upstream validator verifies those fields. A local asset that cannot
meet them remains valid for its local package.

## Authoring procedure

1. Copy only the exports the package actually needs.
2. Declare every path, kind, web-accessible state, and SHA-256.
3. Include notices required by the asset's actual license, when any.
4. Use a lockfile when sharing, pinning, or requesting upstream inclusion.
5. Build without runtime remote asset loading.
6. Confirm the extension archive contains neither source masters nor unrelated
   visual-library files.

The complete fixture under `fixtures/valid/package-integration/` demonstrates a
local custom package with a declared asset and optional local lock.
