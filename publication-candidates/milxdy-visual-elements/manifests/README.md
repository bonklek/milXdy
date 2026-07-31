# Asset manifests

Manifests are optional for one-off local packages and recommended for custom
assets that will be shared or revised. Use `distributionScope: "local-custom"`
without a project approval decision.

Entries proposed for default/upstream inclusion use `distributionScope:
"upstream-default"`, complete VPL evidence, approved review lanes, and an
immutable `UPSTREAM_APPROVED` decision.

Validator fixtures live under `fixtures/` and are never official assets.
