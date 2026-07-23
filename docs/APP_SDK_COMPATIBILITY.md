# App SDK Compatibility Policy

The milXdy extension version, App SDK version, package manifest version, and app
package version are separate compatibility signals even when early releases use
the same numeric value for more than one of them.

## Version Fields

- `package.json.version`: repository/release package version.
- `package.json.extensionVersion`: browser extension manifest version.
- `package.json.appSdkVersion`: current App SDK SemVer.
- `milxdy.app.json.manifestVersion`: package document schema version, currently
  `1`.
- `milxdy.app.json.version`: the app package's own version.
- `milxdy.app.json.sdk.minVersion`: oldest App SDK version the package supports.
- `milxdy.app.json.sdk.targetVersion`: App SDK version against which the package
  was built and tested.

`manifestVersion` changes only when the package document cannot be interpreted
under the previous schema. It does not change for every App SDK release.

## SemVer Policy

Before App SDK `1.0.0`, minor releases may introduce contract changes. Every
such change ships with updated declarations, fixtures, verification, and
migration notes.

Starting with App SDK `1.0.0`:

- patch: compatible fixes and documentation corrections;
- minor: backward-compatible fields, lifecycle hooks, manifest values, or
  capabilities;
- major: removal, incompatible semantics, or a required package migration.

Package authors should set `minVersion` to the first SDK release containing every
required contract and `targetVersion` to the exact SDK used for release testing.
The composer rejects a package whose minimum is newer than the current SDK and
warns when its target differs.

## Capability Compatibility

Manifest compatibility and runtime capability availability are separate checks.
Packages use capabilities guaranteed by their target SDK and degrade safely
when optional behavior is unavailable.

App SDK `0.2.3` exposes `context.requestSurfaceRescan()` as the supported way to
ask the shared X surface scanner to revisit already-rendered surfaces after a
settings change. The internal `scheduleScan` name is not part of the public
declaration and must not be imported or reconstructed by external packages.

App SDK `0.2.3` also exposes declared-key `context.storage.local` and
`context.storage.sync` areas. Packages must declare every accessed key in
`storageKeys`; undeclared reads, writes, removals, and change delivery fail
closed.

`context.resolveAssetUrl(path)` is the public extension-asset capability.
Package-owned assets resolve inside the package namespace; host-owned assets
require repository policy. Unsafe and undeclared paths fail closed.

App packages use host-provided background services. `background.messageTypes`
declares messages a content bundle may send through `context.sendMessage`; it
does not install package-authored background code.

The shared content runtime delivers X routes and surfaces. Non-X `siteScopes`
declare background-service, embedded-frame, or overlay integrations.

## Deprecation And Migration

- Additions must be optional or have a backward-compatible default.
- Deprecations must be documented for at least one minor SDK release before
  removal after `1.0.0`.
- A breaking release must include a migration guide and updated starter-kit
  templates.
- Storage changes must declare migration and reset/cleanup behavior; package
  updates must not silently orphan secrets, local paths, caches, or user data.
- Error envelopes and message namespaces are compatibility contracts, not
  implementation details.

## Support Matrix

| Surface | Support |
| --- | --- |
| First-party bundled apps | Supported by the extension release contract. |
| Reviewed local folder/ZIP composed into Chromium | Supported App SDK distribution path. |
| Novel app enable/disable through generated Apps & Features metadata | Supported in composed builds. |
| Package-owned background module | Use host-provided declared services. |
| Runtime install into an already-installed extension | Outside the custom-build distribution model. |
| Remote marketplace install/update/remove | Outside the custom-build distribution model. |
| Capability-isolated third-party execution | Packages are reviewed extension build inputs. |
| General non-X content runtime | X content runtime; non-X host integrations are declared separately. |

This matrix defines the App SDK 0.2.3 compatibility boundary.
