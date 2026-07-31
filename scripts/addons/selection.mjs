import { cp, lstat, mkdir, readFile, readdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const PACKAGE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/u;
const SEMVER = /^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/u;
const SHA256 = /^[a-f0-9]{64}$/u;
const RECIPE_ID = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/u;

export async function loadSelection(selectionPath, catalogPath, policyPath, reviewsPath) {
  const [selectionBytes, catalog, policy, trustedReviews] = await Promise.all([
    readFile(selectionPath),
    readJsonRequired(catalogPath),
    readJsonRequired(policyPath),
    readJsonRequired(reviewsPath),
  ]);
  let selection;
  try {
    selection = JSON.parse(selectionBytes.toString("utf8"));
  } catch (error) {
    throw selectionError("selection-json", `Selection is not valid JSON: ${error.message}`);
  }
  validateSelection(selection, catalog, policy);
  const catalogById = new Map(catalog.sections.flatMap((section) => section.packages).map((entry) => [entry.id, entry]));
  const trusted = new Set((trustedReviews.reviews || []).map(reviewKey));
  return {
    selection,
    selectionSha256: sha256Buffer(selectionBytes),
    catalog,
    policy,
    packages: selection.packages.map((entry) => {
      const catalogPackage = catalogById.get(entry.id);
      return {
        ...entry,
        artifact: catalogPackage.artifact,
        review: catalogPackage.review,
        permissions: catalogPackage.permissions,
        privacy: {
          remoteServices: catalogPackage.remoteServices.map((service) => service.origin),
          privacyNotes: catalogPackage.privacyNotes,
        },
        storage: catalogPackage.storage,
        siteScopes: catalogPackage.siteScopes,
        replacement: catalogPackage.replacement,
        reviewTrusted: trusted.has(reviewKey({
          id: entry.id,
          version: entry.version,
          packageSha256: entry.packageSha256,
          reviewedBy: catalogPackage.review.reviewedBy,
          reviewedAt: catalogPackage.review.reviewedAt,
        })),
      };
    }),
  };
}

export function validateSelection(selection, catalog, policy) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) throw selectionError("selection-schema", "Selection must be an object.");
  requireOnly(selection, ["schemaVersion", "catalog", "build", "packages"], "selection");
  if (selection.schemaVersion !== 2) throw selectionError("selection-schema", "Unsupported selection schemaVersion; expected 2.");
  validateCatalogIdentity(selection.catalog, catalog);
  validateBuild(selection.build, catalog, policy);
  if (!Array.isArray(selection.packages) || selection.packages.length > 100) {
    throw selectionError("selection-schema", "packages must be an array with at most 100 entries.");
  }

  const catalogById = new Map(catalog.sections.flatMap((section) => section.packages).map((entry) => [entry.id, entry]));
  const selectedIds = new Set();
  for (const entry of selection.packages) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw selectionError("selection-schema", "Each package selection must be an object.");
    requireOnly(entry, ["id", "version", "packageSha256"], `package ${entry.id || "<missing>"}`);
    if (!PACKAGE_ID.test(entry.id || "")) throw selectionError("selection-schema", `Invalid package id: ${entry.id || "<missing>"}.`);
    if (!SEMVER.test(entry.version || "")) throw selectionError("selection-version", `Invalid package version for ${entry.id}.`);
    if (!SHA256.test(entry.packageSha256 || "")) throw selectionError("selection-hash", `Invalid package SHA-256 for ${entry.id}.`);
    if (selectedIds.has(entry.id)) throw selectionError("selection-duplicate-id", `Duplicate package id: ${entry.id}.`);
    selectedIds.add(entry.id);

    const catalogPackage = catalogById.get(entry.id);
    if (!catalogPackage) throw selectionError("selection-unknown-package", `Package ${entry.id} is not in catalog revision ${catalog.revision}.`);
    if (catalogPackage.availability !== "published") {
      throw selectionError("selection-unavailable", `Package ${entry.id} is ${catalogPackage.availability}, not published.`);
    }
    if (catalogPackage.review?.status !== "approved") throw selectionError("selection-review", `Package ${entry.id} does not have approved catalog review.`);
    if (catalogPackage.version !== entry.version) {
      throw selectionError("selection-version", `Package ${entry.id} selection version ${entry.version} does not match catalog version ${catalogPackage.version}.`);
    }
    if (catalogPackage.artifact?.kind !== "maintainer-source") {
      throw selectionError("selection-artifact", `Package ${entry.id} does not reference a checked-in maintainer artifact.`);
    }
    if (catalogPackage.artifact.packageSha256 !== entry.packageSha256) {
      throw selectionError("selection-hash", `Package ${entry.id} selection hash does not match the catalog.`);
    }
    if (catalogPackage.artifact.recipeId !== selection.build.recipeId) {
      throw selectionError("selection-recipe", `Package ${entry.id} requires recipe ${catalogPackage.artifact.recipeId}.`);
    }
    validateArtifactPath(catalogPackage.artifact.path, policy.allowedArtifactRoots || [], entry.id);
  }

  for (const entry of selection.packages) {
    const catalogPackage = catalogById.get(entry.id);
    for (const dependency of catalogPackage.dependencies || []) {
      const selected = selection.packages.find((candidate) => candidate.id === dependency.id);
      if (!selected) {
        throw selectionError("selection-missing-dependency", `${entry.id} requires explicit selection of ${dependency.id}@${dependency.version}.`);
      }
      if (selected.version !== dependency.version) {
        throw selectionError("selection-dependency-version", `${entry.id} requires ${dependency.id}@${dependency.version}, not ${selected.version}.`);
      }
    }
    for (const conflict of catalogPackage.conflicts || []) {
      if (selectedIds.has(conflict.id)) throw selectionError("selection-conflict", `${entry.id} conflicts with ${conflict.id}: ${conflict.reason}`);
    }
  }
}

export async function materializeSelectionPackages(loaded, { stagingDirectory }) {
  await rm(stagingDirectory, { recursive: true, force: true });
  await mkdir(stagingDirectory, { recursive: true });
  const workspace = await realpath(process.cwd());
  for (const entry of loaded.packages) {
    const source = path.resolve(workspace, entry.artifact.path);
    assertPathInside(workspace, source, `artifact path for ${entry.id}`);
    await assertNoSymbolicLinks(source);
    await cp(source, path.join(stagingDirectory, entry.id), {
      recursive: true,
      errorOnExist: true,
      force: false,
    });
  }
}

export async function verifyMaterializedSelection(packages, directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const actual = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  const expected = packages.map((entry) => entry.id).sort();
  if (actual.join("\n") !== expected.join("\n")) {
    throw selectionError("materialized-package-set", `Materialized package directories do not match selection: expected ${expected.join(", ") || "none"}, got ${actual.join(", ") || "none"}.`);
  }
  for (const entry of packages) {
    const manifest = await readJsonRequired(path.join(directory, entry.id, "milxdy.app.json"));
    if (manifest.id !== entry.id || manifest.version !== entry.version) {
      throw selectionError("materialized-identity", `Materialized package identity mismatch for ${entry.id}@${entry.version}.`);
    }
  }
}

function validateCatalogIdentity(identity, catalog) {
  if (!identity || typeof identity !== "object" || Array.isArray(identity)) throw selectionError("selection-schema", "catalog must be an object.");
  requireOnly(identity, ["id", "revision"], "catalog");
  if (identity.id !== catalog.catalogId || identity.revision !== catalog.revision) {
    throw selectionError("selection-catalog-revision", `Selection catalog ${identity.id || "<missing>"}@${identity.revision || "<missing>"} does not match ${catalog.catalogId}@${catalog.revision}.`);
  }
}

function validateBuild(build, catalog, policy) {
  if (!build || typeof build !== "object" || Array.isArray(build)) throw selectionError("selection-schema", "build must be an object.");
  requireOnly(build, ["target", "recipeId"], "build");
  if (typeof build.target !== "string" || !(policy.allowedBuildTargets || []).includes(build.target) || !catalog.supportedBuildTargets.includes(build.target)) {
    throw selectionError("selection-build-target", `Unsupported build target: ${build.target || "<missing>"}.`);
  }
  if (!RECIPE_ID.test(build.recipeId || "") || !(policy.allowedRecipeIds || []).includes(build.recipeId)) {
    throw selectionError("selection-recipe", `Unsupported build recipe: ${build.recipeId || "<missing>"}.`);
  }
  const recipe = catalog.buildRecipes.find((candidate) => candidate.id === build.recipeId);
  if (!recipe || recipe.target !== build.target) throw selectionError("selection-recipe", `Catalog recipe ${build.recipeId} does not build ${build.target}.`);
}

function validateArtifactPath(value, allowedRoots, id) {
  if (typeof value !== "string" || path.isAbsolute(value) || value.includes("\\") || value.split("/").includes("..")) {
    throw selectionError("selection-artifact-path", `Unsafe maintainer artifact path for ${id}.`);
  }
  const normalized = path.posix.normalize(value);
  if (!allowedRoots.some((root) => normalized === root || normalized.startsWith(`${root}/`))) {
    throw selectionError("selection-artifact-path", `Maintainer artifact for ${id} is outside checked-in allowed roots.`);
  }
}

async function assertNoSymbolicLinks(root) {
  const pending = [root];
  while (pending.length) {
    const current = pending.pop();
    const info = await lstat(current);
    if (info.isSymbolicLink()) throw selectionError("selection-artifact-symlink", `Maintainer artifact contains a symbolic link: ${path.relative(process.cwd(), current)}.`);
    if (!info.isDirectory()) continue;
    for (const entry of await readdir(current)) pending.push(path.join(current, entry));
  }
}

function assertPathInside(root, candidate, label) {
  const relative = path.relative(root, candidate);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw selectionError("selection-artifact-path", `${label} must resolve inside the repository.`);
}

function requireOnly(value, allowed, label) {
  const accepted = new Set(allowed);
  for (const key of Object.keys(value)) {
    if (!accepted.has(key)) throw selectionError("selection-schema", `Unknown ${label} field: ${key}.`);
  }
}

function reviewKey(entry) {
  return [entry.id, entry.version, entry.packageSha256, entry.reviewedBy, entry.reviewedAt].join("\n");
}

function sha256Buffer(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJsonRequired(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    throw selectionError("selection-metadata", `Unable to read required JSON ${filePath}: ${error.message}`);
  }
}

export function selectionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
