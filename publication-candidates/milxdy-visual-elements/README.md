# milXdy Visual Elements

Status: local publication candidate for [milXdy issue #183](https://github.com/bonklek/milXdy/issues/183).

This repository candidate gives App SDK authors public contributor guidance,
semantic design tokens, reusable UI recipes, working HTML/CSS/JavaScript
examples, and optional asset metadata for custom milXdy modifications.

Local custom packages are user-controlled. Authors may use their own assets and
their own licensing choices; the visual-elements tooling does not block a local
package because an asset is not VPL. Authors remain responsible for what they
choose to copy, modify, or distribute.

VPL becomes mandatory only when an asset or package is proposed for inclusion
in milXdy's default/upstream codebase. The upstream review lane verifies that
requirement without turning it into a restriction on local customization. See
[Asset and contribution policy](docs/ASSET_AND_CONTRIBUTION_POLICY.md).

## Start here

- [Author design guide](docs/AUTHOR_DESIGN_GUIDE.md)
- [Asset and contribution policy](docs/ASSET_AND_CONTRIBUTION_POLICY.md)
- [Public/private publication boundary](docs/PUBLICATION_BOUNDARY.md)
- [Package integration](docs/PACKAGE_INTEGRATION.md)
- [Music headphones walkthrough](docs/MUSIC_HEADPHONES_WALKTHROUGH.md)
- [Contribution lanes](CONTRIBUTING.md)
- [Validation and QA](docs/VALIDATION_AND_QA.md)
- [Publication checklist](docs/PUBLICATION_CHECKLIST.md)
- [Human example index](catalog/index.html)

## Repository layout

```text
catalog.json                  optional example/index metadata
LICENSE                       repository license for these default guide files
LICENSES/VPL.txt              copy used by upstream/default examples
schemas/                      asset, catalog, review, and package-lock schemas
assets/                       optional versioned reusable exports
manifests/                    local or upstream asset manifests
tokens/                       semantic design-token sources
recipes/                      original code-native visual recipes
examples/                     semantic HTML/CSS/JS author examples
reviews/                      optional upstream decisions and removal records
fixtures/                     clearly non-production validator fixtures
tools/                        dependency-free validation and safety checks
docs/                         author, contribution, integration, and QA guides
```

The catalog is a convenience for browsing and reproducibility. Local packages
may simply declare their files in `milxdy.app.json`. A catalog pin and visual
asset lockfile are recommended when authors want repeatable builds and required
for upstream/default submissions.

## Validate locally

Node.js 20 or newer is required. The candidate has no runtime or development
dependencies.

```sh
npm run verify
```

The verification suite checks schema/fixture behavior, file hashes, local
links, SVG safety, remote-runtime references, private path leaks, package asset
alignment, and extension release-archive exclusion. It applies strict VPL
continuity checks only to entries marked `upstream-default`.

## Publication boundary

This directory is a staging shape for a future dedicated repository. Before
release, a maintainer must approve the final organization/name, confirm the
local-versus-upstream wording, run the verification suite from the publication
commit, and publish only the reviewed commit.

No script in this candidate pushes, creates a repository, publishes a release,
or downloads assets.
