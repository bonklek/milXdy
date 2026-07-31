import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {
  applyInvalidCase,
  candidateRoot,
  readJson,
} from "../tools/lib.mjs";
import { validateWithSchema } from "../tools/json-schema-lite.mjs";
import { runValidation, validateAssetPolicy } from "../tools/validate.mjs";

test("full validation suite covers all declared fixture classes", async () => {
  const summary = await runValidation();
  assert.equal(summary.schemas, 4);
  assert.equal(summary.productionEntries, 0);
  assert.equal(summary.validManifests, 2);
  assert.ok(summary.invalidCases >= 40);
  assert.equal(summary.packageLocks, 1);
  assert.equal(summary.reviewDecisions, 1);
});

test("schema rejects additional manifest fields", async () => {
  const schema = await readJson(path.join(candidateRoot, "schemas", "asset.schema.json"));
  const manifest = await readJson(path.join(candidateRoot, "fixtures", "valid", "reference-source", "manifest.json"));
  manifest.unreviewedClaim = true;
  const errors = validateWithSchema(manifest, schema);
  assert.ok(errors.some((error) => error.includes("additional property")));
});

test("upstream and structural fixture mutations fail with their expected field", async () => {
  const schema = await readJson(path.join(candidateRoot, "schemas", "asset.schema.json"));
  const baseline = await readJson(path.join(candidateRoot, "fixtures", "valid", "reference-source", "manifest.json"));
  const cases = await readJson(path.join(candidateRoot, "fixtures", "invalid", "cases.json"));
  const selected = cases.filter((fixtureCase) =>
    ["upstream-with-unknown-license", "remote-source-path", "invalid-embedded-mark-state", "upstream-without-review"].includes(fixtureCase.name)
  );

  for (const fixtureCase of selected) {
    const invalid = applyInvalidCase(baseline, fixtureCase);
    const errors = [
      ...validateWithSchema(invalid, schema),
      ...(await validateAssetPolicy(invalid, new Map())),
    ];
    assert.ok(errors.some((error) => error.includes(fixtureCase.expect)), fixtureCase.name);
  }
});

test("local custom assets may use unknown or non-VPL licensing without upstream review", async () => {
  const schema = await readJson(path.join(candidateRoot, "schemas", "asset.schema.json"));
  const manifest = await readJson(path.join(candidateRoot, "fixtures", "valid", "reference-source", "manifest.json"));

  for (const license of [
    manifest.license,
    { ...manifest.license, status: "declared", id: "CC0-1.0", additionalRestrictions: ["retain author notice"] },
  ]) {
    const local = { ...manifest, license };
    const errors = [
      ...validateWithSchema(local, schema),
      ...(await validateAssetPolicy(local, new Map())),
    ];
    assert.deepEqual(errors, []);
  }
});

test("declared embedded marks are allowed locally but rejected for upstream defaults", async () => {
  const schema = await readJson(path.join(candidateRoot, "schemas", "asset.schema.json"));
  const manifest = await readJson(path.join(candidateRoot, "fixtures", "valid", "reference-source", "manifest.json"));
  manifest.embeddedMarks = [{ kind: "logo", description: "User-selected local mark", status: "declared" }];
  assert.deepEqual([
    ...validateWithSchema(manifest, schema),
    ...(await validateAssetPolicy(manifest, new Map())),
  ], []);

  manifest.distributionScope = "upstream-default";
  const upstreamErrors = [
    ...validateWithSchema(manifest, schema),
    ...(await validateAssetPolicy(manifest, new Map())),
  ];
  assert.ok(upstreamErrors.some((error) => error.includes("embeddedMarks")));
});
