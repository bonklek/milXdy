import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import {
  loadSelection,
  materializeSelectionPackages,
  validateSelection,
  verifyMaterializedSelection,
} from "../addons/selection.mjs";

const root = "tmp/verify-local-addon-selection";
const staging = `${root}/staging`;
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });

const repositoryCatalog = JSON.parse(await readFile("catalog/data/catalog.json", "utf8"));
const petsMaker = repositoryCatalog.sections[0].packages.find((pkg) => pkg.id === "pets-maker");
const shareKit = repositoryCatalog.sections[0].packages.find((pkg) => pkg.id === "tweetPng");
const catalog = structuredClone(repositoryCatalog);
catalog.catalogId = "verify-maintainer-catalog";
catalog.revision = "verify-1";
catalog.sections[0].packages = [petsMaker, shareKit];
const policy = JSON.parse(await readFile("scripts/addons/catalog-policy.json", "utf8"));
const selection = {
  schemaVersion: 2,
  catalog: { id: catalog.catalogId, revision: catalog.revision },
  build: { target: "chromium", recipeId: "maintainer-local-v1" },
  packages: [{
    id: "tweetPng",
    version: shareKit.version,
    packageSha256: shareKit.artifact.packageSha256,
  }],
};

validateSelection(selection, catalog, policy);
const petsSelection = {
  ...selection,
  packages: [{
    id: petsMaker.id,
    version: petsMaker.version,
    packageSha256: petsMaker.artifact.packageSha256,
  }],
};
const combinedSelection = {
  ...selection,
  packages: [...petsSelection.packages, ...selection.packages],
};
validateSelection(petsSelection, catalog, policy);
validateSelection(combinedSelection, catalog, policy);
assert.throws(() => validateSelection({ ...selection, remoteUrl: "https://example.com/pkg.zip" }, catalog, policy), /Unknown selection field/u);
assert.throws(() => validateSelection({ ...selection, catalog: { ...selection.catalog, revision: "stale" } }, catalog, policy), /does not match/u);
assert.throws(() => validateSelection({ ...selection, build: { ...selection.build, target: "firefox" } }, catalog, policy), /Unsupported build target/u);
assert.throws(() => validateSelection({ ...selection, packages: [{ ...selection.packages[0], url: "https://example.com/pkg.zip" }] }, catalog, policy), /Unknown package tweetPng field/u);
assert.throws(() => validateSelection({ ...selection, packages: [{ ...selection.packages[0], packageSha256: "0".repeat(64) }] }, catalog, policy), /does not match the catalog/u);
assert.throws(() => validateSelection({ ...selection, packages: [selection.packages[0], selection.packages[0]] }, catalog, policy), /Duplicate package id/u);

const unavailableCatalog = structuredClone(catalog);
unavailableCatalog.sections[0].packages.find((pkg) => pkg.id === "tweetPng").availability = "under-review";
assert.throws(() => validateSelection(selection, unavailableCatalog, policy), /not published/u);

const dependencyCatalog = structuredClone(catalog);
dependencyCatalog.sections[0].packages.find((pkg) => pkg.id === "tweetPng").dependencies = [{ id: "required", version: "1.0.0", reason: "verification fixture" }];
assert.throws(() => validateSelection(selection, dependencyCatalog, policy), /requires explicit selection/u);

await writeFile(`${root}/selection.json`, JSON.stringify(selection));
await writeFile(`${root}/catalog.json`, JSON.stringify(catalog));
await writeFile(`${root}/policy.json`, JSON.stringify(policy));
await writeFile(`${root}/reviews.json`, JSON.stringify({
  schemaVersion: 2,
  reviews: [{
    id: petsMaker.id,
    version: petsMaker.version,
    packageSha256: petsMaker.artifact.packageSha256,
    reviewedBy: petsMaker.review.reviewedBy,
    reviewedAt: petsMaker.review.reviewedAt,
  }, {
    id: "tweetPng",
    version: shareKit.version,
    packageSha256: shareKit.artifact.packageSha256,
    reviewedBy: shareKit.review.reviewedBy,
    reviewedAt: shareKit.review.reviewedAt,
  }],
}));
const loaded = await loadSelection(`${root}/selection.json`, `${root}/catalog.json`, `${root}/policy.json`, `${root}/reviews.json`);
assert.equal(loaded.packages[0].reviewTrusted, true);
await materializeSelectionPackages(loaded, { stagingDirectory: staging });
await verifyMaterializedSelection(loaded.packages, staging);
const stagedManifestPath = `${staging}/tweetPng/milxdy.app.json`;
const stagedManifest = JSON.parse(await readFile(stagedManifestPath, "utf8"));
stagedManifest.version = "9.9.9";
await writeFile(stagedManifestPath, JSON.stringify(stagedManifest));
await assert.rejects(() => verifyMaterializedSelection(loaded.packages, staging), /identity mismatch/u);

const missingLoaded = structuredClone(loaded);
missingLoaded.packages[0].artifact.path = "packages/maintainer/missing-package";
await assert.rejects(() => materializeSelectionPackages(missingLoaded, { stagingDirectory: `${root}/missing` }), /ENOENT|cannot find|no such file/u);

await rm(root, { recursive: true, force: true });
console.log("Local maintainer-catalog selection verification passed.");
