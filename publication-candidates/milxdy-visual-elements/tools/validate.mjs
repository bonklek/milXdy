import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  applyInvalidCase,
  candidateRoot,
  fileSize,
  invariant,
  isDirectExecution,
  isSafeRelativePath,
  mainRepositoryRoot,
  readJson,
  relativeFromCandidate,
  resolveCandidatePath,
  sha256File,
} from "./lib.mjs";
import { validateWithSchema } from "./json-schema-lite.mjs";

const schemaPaths = {
  asset: "schemas/asset.schema.json",
  catalog: "schemas/catalog.schema.json",
  decision: "schemas/review-decision.schema.json",
  lock: "schemas/package-visual-assets-lock.schema.json",
};

const validManifestPaths = [
  "fixtures/valid/reference-source/manifest.json",
  "fixtures/valid/ui-primitive/manifest.json",
];

function pushRequired(errors, object, fields, prefix) {
  if (!object || typeof object !== "object" || Array.isArray(object)) {
    errors.push(`${prefix}: expected object`);
    return;
  }
  for (const field of fields) {
    if (!Object.hasOwn(object, field)) errors.push(`${prefix}.${field}: is required`);
  }
}

async function checkFileIdentity(errors, relativePath, expectedHash, expectedBytes, prefix) {
  if (!isSafeRelativePath(relativePath)) {
    errors.push(`${prefix}: unsafe or remote path`);
    return;
  }

  const absolute = resolveCandidatePath(relativePath);
  try {
    await access(absolute);
  } catch {
    errors.push(`${prefix}: file does not exist (${relativePath})`);
    return;
  }

  const actualHash = await sha256File(absolute);
  if (actualHash !== expectedHash) errors.push(`${prefix}: SHA-256 mismatch`);
  if (expectedBytes !== undefined) {
    const actualBytes = await fileSize(absolute);
    if (actualBytes !== expectedBytes) errors.push(`${prefix}: byte size mismatch`);
  }
}

export async function validateRightsCompatibility(manifest) {
  const errors = [];
  const rights = manifest.license?.compatibility;
  const prefix = "$.license.compatibility";
  if (!rights || rights.decision !== "compatible") {
    return [`${prefix}.decision: exact-file rights must be reviewed compatible`];
  }
  if (!["license", "explicit-permission"].includes(rights.basis)) errors.push(`${prefix}.basis: license or explicit permission required`);
  if (rights.sourceSha256 !== manifest.sha256) errors.push(`${prefix}.sourceSha256: decision does not cover exact source`);
  for (const permission of ["copy", "modify", "redistribute", "appSdkUse"]) {
    if (rights.permissions?.[permission] !== true) errors.push(`${prefix}.permissions.${permission}: permission must be explicitly covered`);
  }
  for (const field of ["rationale", "reviewedBy", "reviewedAt"]) {
    if (typeof rights[field] !== "string" || !rights[field].trim()) errors.push(`${prefix}.${field}: documented human review required`);
  }
  if (!Array.isArray(rights.notices) || !rights.notices.length) errors.push(`${prefix}.notices: exact notice files required`);
  const noticePaths = new Set();
  for (const [index, notice] of (rights.notices ?? []).entries()) {
    noticePaths.add(notice.path);
    await checkFileIdentity(errors, notice.path, notice.sha256, undefined, `${prefix}.notices[${index}]`);
  }
  if (!noticePaths.has(manifest.license.textPath)) errors.push(`${prefix}.notices: include exact license or permission text`);
  for (const noticePath of manifest.attribution?.noticePaths ?? []) {
    if (!noticePaths.has(noticePath)) errors.push(`${prefix}.notices: missing hashed attribution notice ${noticePath}`);
  }
  for (const [index, obligation] of (rights.obligations ?? []).entries()) {
    if (!obligation.requirement?.trim() || !obligation.fulfilment?.trim() || !obligation.evidence?.length) {
      errors.push(`${prefix}.obligations[${index}]: requirement, fulfilment and hashed evidence required`);
    }
    for (const evidence of obligation.evidence ?? []) {
      await checkFileIdentity(errors, evidence.path, evidence.sha256, undefined, `${prefix}.obligations[${index}].evidence`);
    }
  }
  for (const restriction of manifest.license.additionalRestrictions ?? []) {
    if (!(rights.obligations ?? []).some((obligation) => obligation.requirement === restriction)) {
      errors.push(`${prefix}.obligations: unresolved license restriction ${restriction}`);
    }
  }
  return errors;
}

export function validateReviewDecisionForAsset(decision, manifest, manifestHash) {
  const errors = [];
  if (decision.outcome !== "UPSTREAM_APPROVED") errors.push("$.outcome: not UPSTREAM_APPROVED");
  if (decision.id !== manifest.review?.decisionId) errors.push("$.id: reviewed manifest decision ID mismatch");
  for (const field of ["id", "version"]) {
    if (decision.asset?.[field] !== manifest[field]) errors.push(`$.asset.${field}: reviewed asset mismatch`);
  }
  if (decision.asset?.manifestSha256 !== manifestHash) errors.push("$.asset.manifestSha256: reviewed manifest hash mismatch");
  if (decision.asset?.sourceSha256 !== manifest.sha256) errors.push("$.asset.sourceSha256: reviewed source hash mismatch");
  for (const role of ["technical", "visualCultural", "accessibility", "license", "release"]) {
    if (decision.reviewers?.[role]?.decision !== "approved") errors.push(`$.reviewers.${role}: human approval required`);
  }
  return errors;
}

export async function validateAssetPolicy(manifest, manifestMap = new Map()) {
  const errors = [];
  pushRequired(errors, manifest, [
    "id",
    "version",
    "distributionScope",
    "entryRole",
    "sourcePath",
    "exports",
    "media",
    "sha256",
    "license",
    "attribution",
    "parents",
    "transformations",
    "generation",
    "embeddedMarks",
    "dependencies",
    "accessibility",
    "review",
    "lifecycle",
  ], "$");

  if (!manifest || typeof manifest !== "object") return errors;

  if (manifest.license) {
    if (manifest.license.textPath || manifest.license.textSha256) {
      if (!manifest.license.textPath || !manifest.license.textSha256) {
        errors.push("$.license.textPath: license text path and hash must be provided together");
      } else {
        await checkFileIdentity(errors, manifest.license.textPath, manifest.license.textSha256, undefined, "$.license.textPath");
      }
    }
    if (manifest.license.proofPath || manifest.license.proofSha256) {
      if (!manifest.license.proofPath || !manifest.license.proofSha256) {
        errors.push("$.license.proofPath: proof path and hash must be provided together");
      } else {
        await checkFileIdentity(errors, manifest.license.proofPath, manifest.license.proofSha256, undefined, "$.license.proofPath");
      }
    }

    if (manifest.distributionScope === "upstream-default") {
      if (manifest.license.status !== "declared") errors.push("$.license.status: upstream/default assets require a declared license");
      if (!manifest.license.id?.trim()) errors.push("$.license.id: upstream/default assets require an exact license or permission identifier");
      if (!manifest.license.textPath || !manifest.license.textSha256) errors.push("$.license.textPath: upstream/default assets require verified license text");
      if (!manifest.license.proofUrl || !manifest.license.proofPath || !manifest.license.proofRetrievedAt || !manifest.license.proofSha256) {
        errors.push("$.license.proofPath: upstream/default assets require publication evidence");
      }
      errors.push(...(await validateRightsCompatibility(manifest)));

    }
  }

  if (manifest.sourcePath && manifest.sha256) {
    await checkFileIdentity(errors, manifest.sourcePath, manifest.sha256, manifest.media?.byteSize, "$.sourcePath");
  }

  if (Array.isArray(manifest.exports)) {
    for (const [index, exportRecord] of manifest.exports.entries()) {
      await checkFileIdentity(
        errors,
        exportRecord.path,
        exportRecord.sha256,
        exportRecord.byteSize,
        `$.exports[${index}].path`,
      );
    }
  }

  if (manifest.entryRole === "derived-asset") {
    if (!Array.isArray(manifest.parents) || manifest.parents.length === 0) {
      errors.push("$.parents: derived assets require at least one parent");
    }
    if (!Array.isArray(manifest.transformations) || manifest.transformations.length === 0) {
      errors.push("$.transformations: derived assets require material transformations");
    }
  }

  for (const [index, parent] of (manifest.parents ?? []).entries()) {
    const parentManifest = manifestMap.get(`${parent.id}@${parent.version}`);
    if (!parentManifest) {
      errors.push(`$.parents[${index}]: orphan parent ${parent.id}@${parent.version}`);
    } else {
      if (parentManifest.sha256 !== parent.sha256) errors.push(`$.parents[${index}].sha256: parent source hash mismatch`);
      if (manifest.distributionScope === "upstream-default") {
        if (parentManifest.distributionScope !== "upstream-default") errors.push(`$.parents[${index}]: upstream parent requires its own rights and review`);
        errors.push(...(await validateRightsCompatibility(parentManifest)).map((error) => `$.parents[${index}] ${error}`));
      }
    }
  }

  for (const [index, dependency] of (manifest.dependencies ?? []).entries()) {
    const dependencyManifest = manifestMap.get(`${dependency.id}@${dependency.version}`);
    if (!dependencyManifest) {
      errors.push(`$.dependencies[${index}]: orphan dependency ${dependency.id}@${dependency.version}`);
    } else {
      if (dependencyManifest.sha256 !== dependency.sha256) errors.push(`$.dependencies[${index}].sha256: dependency hash mismatch`);
      if (dependencyManifest.license?.id !== dependency.licenseId) errors.push(`$.dependencies[${index}].licenseId: dependency license differs from manifest`);
      if (manifest.distributionScope === "upstream-default") {
        if (dependencyManifest.distributionScope !== "upstream-default") errors.push(`$.dependencies[${index}]: upstream dependency requires its own rights and review`);
        errors.push(...(await validateRightsCompatibility(dependencyManifest)).map((error) => `$.dependencies[${index}] ${error}`));
      }
    }
  }

  for (const [index, mark] of (manifest.embeddedMarks ?? []).entries()) {
    if (manifest.distributionScope === "upstream-default" && mark.status === "declared") {
      errors.push(`$.embeddedMarks[${index}]: embedded material must be cleared or removed for upstream/default use`);
    }
  }

  if (manifest.generation?.aiModified && (!manifest.generation.tool || !manifest.generation.model)) {
    errors.push("$.generation: AI-modified work requires tool and model");
  }

  if (manifest.accessibility?.decorative === true && manifest.accessibility.alt !== "") {
    errors.push("$.accessibility.alt: decorative assets require empty alt guidance");
  }
  if (manifest.accessibility?.decorative === false && !manifest.accessibility.alt) {
    errors.push("$.accessibility.alt: meaningful assets require functional alt guidance");
  }

  if (manifest.distributionScope === "upstream-default") {
    for (const lane of ["technical", "visual", "accessibility", "license", "release"]) {
      if (manifest.review?.[lane] !== "approved") {
        errors.push(`$.review.${lane}: upstream/default entry requires approval`);
      }
    }
    if (!manifest.review?.decisionId) errors.push("$.review.decisionId: upstream/default entry requires immutable decision");
    if (manifest.lifecycle?.status !== "upstream-approved") errors.push("$.lifecycle.status: upstream/default entry must be upstream-approved");
  } else if (manifest.lifecycle?.status === "upstream-approved") {
    errors.push("$.lifecycle.status: local custom entry cannot claim upstream approval");
  }

  return errors;
}

async function validateManifestFile(relativePath, assetSchema, manifestMap) {
  const manifest = await readJson(resolveCandidatePath(relativePath));
  const schemaErrors = validateWithSchema(manifest, assetSchema);
  const policyErrors = await validateAssetPolicy(manifest, manifestMap);
  return { manifest, errors: [...schemaErrors, ...policyErrors] };
}

async function validateProductionCatalog(catalog, catalogSchema, assetSchema, decisionSchema) {
  const errors = validateWithSchema(catalog, catalogSchema);

  await checkFileIdentity(
    errors,
    catalog.repositoryLicense?.textPath,
    catalog.repositoryLicense?.sha256,
    undefined,
    "$.repositoryLicense.textPath",
  );

  const manifestMap = new Map();
  for (const entry of catalog.entries ?? []) {
    const manifest = await readJson(resolveCandidatePath(entry.manifestPath));
    manifestMap.set(`${manifest.id}@${manifest.version}`, manifest);
  }
  for (const [index, entry] of (catalog.entries ?? []).entries()) {
    if (entry.manifestPath.startsWith("fixtures/") || entry.decisionPath?.startsWith("fixtures/")) {
      errors.push(`$.entries[${index}]: production catalog cannot reference fixtures`);
      continue;
    }
    const manifestPath = resolveCandidatePath(entry.manifestPath);
    const manifest = await readJson(manifestPath);

    errors.push(...validateWithSchema(manifest, assetSchema).map((error) => `$.entries[${index}] manifest ${error}`));
    errors.push(...(await validateAssetPolicy(manifest, manifestMap)).map((error) => `$.entries[${index}] manifest ${error}`));

    if (await sha256File(manifestPath) !== entry.manifestSha256) {
      errors.push(`$.entries[${index}].manifestSha256: mismatch`);
    }
    if (manifest.id !== entry.id || manifest.version !== entry.version || manifest.sha256 !== entry.sourceSha256) {
      errors.push(`$.entries[${index}]: catalog identity does not match manifest`);
    }
    if (manifest.distributionScope !== entry.distributionScope) errors.push(`$.entries[${index}]: distribution scope does not match manifest`);

    if (entry.distributionScope === "upstream-default") {
      const decisionPath = resolveCandidatePath(entry.decisionPath);
      const decision = await readJson(decisionPath);
      errors.push(...validateWithSchema(decision, decisionSchema).map((error) => `$.entries[${index}] decision ${error}`));
      if (manifest.lifecycle.status !== "upstream-approved") errors.push(`$.entries[${index}]: manifest is not upstream-approved`);
      errors.push(...validateReviewDecisionForAsset(decision, manifest, await sha256File(manifestPath)).map((error) => `$.entries[${index}] decision ${error}`));
    }

    if (entry.distributionScope === "upstream-default") {
      const expectedSourcePrefix = `assets/${manifest.sha256}/source/`;
      if (!manifest.sourcePath.startsWith(expectedSourcePrefix)) {
        errors.push(`$.entries[${index}]: source is not stored below ${expectedSourcePrefix}`);
      }
    }
  }

  return errors;
}

async function validatePackageIntegration(lockSchema) {
  const fixtureDirectory = resolveCandidatePath("fixtures/valid/package-integration");
  const lockPath = path.join(fixtureDirectory, "visual-assets.lock.json");
  const appPath = path.join(fixtureDirectory, "milxdy.app.json");
  const lock = await readJson(lockPath);
  const app = await readJson(appPath);
  const packageSchema = await readJson(path.join(mainRepositoryRoot, "docs", "schemas", "local-app-package.schema.json"));
  const errors = [
    ...validateWithSchema(lock, lockSchema).map((error) => `lock ${error}`),
    ...validateWithSchema(app, packageSchema).map((error) => `milxdy.app.json ${error}`),
  ];
  const manifests = new Map();

  for (const manifestPath of validManifestPaths) {
    const manifest = await readJson(resolveCandidatePath(manifestPath));
    manifests.set(`${manifest.id}@${manifest.version}`, {
      path: resolveCandidatePath(manifestPath),
      manifest,
    });
  }

  for (const [index, locked] of lock.assets.entries()) {
    const packageAsset = app.package.assets.find((asset) => asset.id === locked.packageAssetId);
    if (!packageAsset) {
      errors.push(`lock $.assets[${index}]: package asset ID is undeclared`);
      continue;
    }
    if (packageAsset.path !== locked.vendoredPath || packageAsset.sha256 !== locked.sha256) {
      errors.push(`lock $.assets[${index}]: vendored path/hash differs from package manifest`);
    }

    const vendored = path.join(fixtureDirectory, locked.vendoredPath);
    if (await sha256File(vendored) !== locked.sha256) errors.push(`lock $.assets[${index}]: vendored file hash mismatch`);
    if (await sha256File(resolveCandidatePath(locked.exportPath)) !== locked.sha256) {
      errors.push(`lock $.assets[${index}]: catalog export hash mismatch`);
    }

    const source = manifests.get(`${locked.assetId}@${locked.assetVersion}`);
    if (!source) {
      errors.push(`lock $.assets[${index}]: catalog manifest fixture missing`);
    } else {
      if (source.manifest.sha256 !== locked.sourceSha256) errors.push(`lock $.assets[${index}]: source hash mismatch`);
      if (locked.manifestSha256 && await sha256File(source.path) !== locked.manifestSha256) {
        errors.push(`lock $.assets[${index}]: manifest hash mismatch`);
      }
    }
  }

  for (const asset of lock.assets.filter((entry) => entry.distributionScope === "upstream-default")) {
    const manifest = manifests.get(`${asset.assetId}@${asset.assetVersion}`)?.manifest;
    for (const notice of manifest?.license?.compatibility?.notices ?? []) {
      const packageNotice = path.join(fixtureDirectory, notice.path);
      try {
        if (await sha256File(packageNotice) !== notice.sha256) errors.push(`package notice hash mismatch: ${notice.path}`);
      } catch { errors.push(`package notice missing: ${notice.path}`); }
    }
  }

  return errors;
}

export async function runValidation() {
  const schemas = {};
  for (const [name, relativePath] of Object.entries(schemaPaths)) {
    schemas[name] = await readJson(resolveCandidatePath(relativePath));
    invariant(schemas[name].$schema?.includes("2020-12"), `${relativePath}: must declare JSON Schema 2020-12`);
    invariant(schemas[name].$id, `${relativePath}: must declare an $id`);
  }

  const catalog = await readJson(resolveCandidatePath("catalog.json"));
  const productionErrors = await validateProductionCatalog(
    catalog,
    schemas.catalog,
    schemas.asset,
    schemas.decision,
  );
  invariant(productionErrors.length === 0, `Production catalog validation failed:\n${productionErrors.join("\n")}`);

  const manifests = [];
  const manifestMap = new Map();
  for (const relativePath of validManifestPaths) {
    const manifest = await readJson(resolveCandidatePath(relativePath));
    manifests.push({ relativePath, manifest });
    manifestMap.set(`${manifest.id}@${manifest.version}`, manifest);
  }

  for (const { relativePath } of manifests) {
    const result = await validateManifestFile(relativePath, schemas.asset, manifestMap);
    invariant(result.errors.length === 0, `${relativePath} failed:\n${result.errors.join("\n")}`);
  }

  const decision = await readJson(resolveCandidatePath("fixtures/valid/review-decision.json"));
  const decisionErrors = validateWithSchema(decision, schemas.decision);
  const reviewedManifestRecord = manifests.find(({ manifest }) =>
    manifest.id === decision.asset.id && manifest.version === decision.asset.version
  );
  if (!reviewedManifestRecord) {
    decisionErrors.push("$.asset: reviewed manifest fixture is missing");
  } else {
    const reviewedManifestPath = resolveCandidatePath(reviewedManifestRecord.relativePath);
    decisionErrors.push(...validateReviewDecisionForAsset(decision, reviewedManifestRecord.manifest, await sha256File(reviewedManifestPath)));
    if (await sha256File(reviewedManifestPath) !== decision.asset.manifestSha256) {
      decisionErrors.push("$.asset.manifestSha256: reviewed manifest hash mismatch");
    }
    if (reviewedManifestRecord.manifest.sha256 !== decision.asset.sourceSha256) {
      decisionErrors.push("$.asset.sourceSha256: reviewed source hash mismatch");
    }
    if (reviewedManifestRecord.manifest.review.decisionId !== decision.id) {
      decisionErrors.push("$.id: reviewed manifest decision ID mismatch");
    }
  }
  invariant(decisionErrors.length === 0, `review-decision fixture failed:\n${decisionErrors.join("\n")}`);

  const packageErrors = await validatePackageIntegration(schemas.lock);
  invariant(packageErrors.length === 0, `package integration fixture failed:\n${packageErrors.join("\n")}`);

  const invalidCases = await readJson(resolveCandidatePath("fixtures/invalid/cases.json"));
  const baseline = manifests.find(({ manifest }) => manifest.id === "fixture.reference-source").manifest;
  for (const fixtureCase of invalidCases) {
    const invalid = applyInvalidCase(baseline, fixtureCase);
    const errors = [
      ...validateWithSchema(invalid, schemas.asset),
      ...(await validateAssetPolicy(invalid, manifestMap)),
    ];
    invariant(errors.length > 0, `Invalid fixture unexpectedly passed: ${fixtureCase.name}`);
    invariant(
      errors.some((error) => error.includes(fixtureCase.expect)),
      `Invalid fixture ${fixtureCase.name} did not report ${fixtureCase.expect}:\n${errors.join("\n")}`,
    );
  }

  return {
    schemas: Object.keys(schemas).length,
    productionEntries: catalog.entries.length,
    validManifests: manifests.length,
    invalidCases: invalidCases.length,
    packageLocks: 1,
    reviewDecisions: 1,
  };
}

if (isDirectExecution(import.meta.url)) {
  const summary = await runValidation();
  console.log(
    `Validated ${summary.schemas} schemas, ${summary.productionEntries} production entries, ` +
    `${summary.validManifests} valid manifests, ${summary.invalidCases} invalid cases, ` +
    `${summary.packageLocks} package lock, and ${summary.reviewDecisions} review decision.`,
  );
}
