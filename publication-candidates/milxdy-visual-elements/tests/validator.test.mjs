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

async function upstreamFixture() {
  return readJson(path.join(candidateRoot, "fixtures", "valid", "ui-primitive", "manifest.json"));
}

test("upstream rights-compatible admission supports exact non-VPL license or explicit permission evidence", async () => {
  const schema = await readJson(path.join(candidateRoot, "schemas", "asset.schema.json"));
  for (const basis of ["license", "explicit-permission"]) {
    // All data is a synthetic reviewer scenario, never an actual permission claim.
    const manifest = await upstreamFixture();
    manifest.license.id = "LicenseRef-Synthetic-Rights-Scenario";
    manifest.license.compatibility.basis = basis;
    assert.deepEqual([
      ...validateWithSchema(manifest, schema),
      ...(await validateAssetPolicy(manifest)),
    ], []);
  }
});

test("upstream rights admission fails closed on unknown, incompatible, missing or wrong-file permission", async () => {
  const mutations = [
    ["missing decision", (m) => { delete m.license.compatibility; }],
    ["unknown", (m) => { m.license.compatibility.decision = "unknown"; }],
    ["incompatible", (m) => { m.license.compatibility.decision = "incompatible"; }],
    ["wrong source", (m) => { m.license.compatibility.sourceSha256 = "a".repeat(64); }],
    ["missing exact license", (m) => { m.license.id = ""; }],
    ["missing reviewer", (m) => { m.license.compatibility.reviewedBy = ""; }],
    ["missing explanation", (m) => { m.license.compatibility.rationale = ""; }],
    ["tampered notice", (m) => { m.license.compatibility.notices[0].sha256 = "a".repeat(64); }],
    ["unhashed notice", (m) => { m.attribution.noticePaths.push("unreviewed-notice.txt"); }],
    ["unresolved restriction", (m) => { m.license.additionalRestrictions = ["retain attribution"]; }],
  ];
  for (const permission of ["copy", "modify", "redistribute", "appSdkUse"]) {
    mutations.push([`denied ${permission}`, (m) => { m.license.compatibility.permissions[permission] = false; }]);
  }
  for (const [name, mutate] of mutations) {
    const manifest = await upstreamFixture();
    mutate(manifest);
    assert.ok((await validateAssetPolicy(manifest)).length > 0, name);
  }
});

test("reviewed notice obligations can qualify but missing obligation evidence cannot", async () => {
  const manifest = await upstreamFixture();
  manifest.license.id = "LicenseRef-Synthetic-Attribution-Scenario";
  manifest.license.additionalRestrictions = ["retain attribution"];
  manifest.license.compatibility.obligations = [{
    requirement: "retain attribution", fulfilment: "Synthetic notice retained in package fixture.",
    evidence: [manifest.license.compatibility.notices[0]],
  }];
  assert.deepEqual(await validateAssetPolicy(manifest), []);
  manifest.license.compatibility.obligations[0].evidence = [];
  assert.ok((await validateAssetPolicy(manifest)).some((error) => error.includes("obligations")));
});

test("upstream dependencies require matching hashes and their own exact rights review regardless of license ID", async () => {
  const manifest = await upstreamFixture();
  const dependency = await upstreamFixture();
  dependency.id = "fixture.nonvpl-dependency";
  dependency.license.id = "LicenseRef-Synthetic-Dependency";
  manifest.dependencies = [{ id: dependency.id, version: dependency.version, sha256: dependency.sha256, licenseId: dependency.license.id }];
  const manifests = new Map([[`${dependency.id}@${dependency.version}`, dependency]]);
  assert.deepEqual(await validateAssetPolicy(manifest, manifests), []);
  dependency.license.compatibility.permissions.modify = false;
  assert.ok((await validateAssetPolicy(manifest, manifests)).some((error) => error.includes("dependencies[0]")));
});

test("production review decisions bind every approval to the exact manifest and source", async () => {
  const { validateReviewDecisionForAsset } = await import("../tools/validate.mjs");
  const manifest = await upstreamFixture();
  const decision = await readJson(path.join(candidateRoot, "fixtures", "valid", "review-decision.json"));
  const hash = decision.asset.manifestSha256;
  assert.deepEqual(validateReviewDecisionForAsset(decision, manifest, hash), []);
  assert.ok(validateReviewDecisionForAsset(decision, manifest, "b".repeat(64)).some((error) => error.includes("manifestSha256")));
  for (const role of ["technical", "visualCultural", "accessibility", "license", "release"]) {
    const invalid = structuredClone(decision);
    invalid.reviewers[role].decision = "not-reviewed";
    assert.ok(validateReviewDecisionForAsset(invalid, manifest, hash).some((error) => error.includes(role)));
  }
});

test("upstream lock schema accepts exact non-VPL identifiers and rejects missing identifiers", async () => {
  const schema = await readJson(path.join(candidateRoot, "schemas", "package-visual-assets-lock.schema.json"));
  const lock = await readJson(path.join(candidateRoot, "fixtures", "valid", "package-integration", "visual-assets.lock.json"));
  lock.assets[0].licenseId = "LicenseRef-Synthetic-Permission";
  assert.deepEqual(validateWithSchema(lock, schema), []);
  lock.assets[0].licenseId = null;
  assert.ok(validateWithSchema(lock, schema).some((error) => error.includes("licenseId")));
});
