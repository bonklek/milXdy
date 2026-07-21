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

Before App SDK `1.0.0`, minor releases may change preview APIs. Such a change
must include updated declarations, fixtures, verification, and migration notes;
silently changing the runtime context is not acceptable.

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

An accepted manifest is not proof that every requested runtime capability is
implemented. Packages must degrade safely when a declared capability is absent.
Until capability negotiation is added to the manifest/runtime facade, authors
must treat optional behavior as unavailable unless the documented target SDK
guarantees it.

Third-party package background handlers are not supported in the current
reviewed custom-build contract. `background.messageTypes` declares messages a
content bundle may send through `context.sendMessage`; it does not cause package
background code to be installed.

The shared content runtime is X-first. A non-X `siteScopes` declaration records
intent and permission review but does not imply that a general non-X content
runtime exists.

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

| Surface | Current support |
| --- | --- |
| First-party bundled apps | Supported by the extension release contract. |
| Reviewed local folder/ZIP composed into Chromium | App SDK preview; supported advanced-developer path. |
| Novel app enable/disable through generated Apps & Features metadata | Supported in composed builds. |
| Package-owned background module | Unsupported. |
| Runtime install into an already-installed extension | Unsupported. |
| Remote marketplace install/update/remove | Unsupported. |
| Capability-isolated third-party execution | Unsupported. |
| General non-X content runtime | Not yet supported. |

This matrix must be updated before public copy broadens the supported platform
claim.
