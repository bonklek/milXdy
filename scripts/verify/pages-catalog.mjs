import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");
const failures = [];
const notes = [];

const requiredFiles = [
  "catalog/index.html",
  "catalog/add-ons/index.html",
  "catalog/assets/catalog.js",
  "catalog/assets/selection.js",
  "catalog/assets/styles.css",
  "catalog/assets/addons/tweet-composer.svg",
  "catalog/assets/addons/share-kit.svg",
  "catalog/assets/addons/pets-maker.svg",
  "catalog/data/catalog.json",
  "catalog/data/catalog.schema.json",
  "docs/schemas/milxdy-selection.schema.json",
  "scripts/addons/catalog-policy.json",
  "scripts/addons/trusted-catalog-reviews.json",
  "scripts/build/build-pages-catalog.mjs",
  "docs/contributors/ADD_ONS_CATALOG.md",
  ".github/workflows/pages-catalog.yml",
];

const contents = new Map();
for (const file of requiredFiles) {
  try {
    contents.set(file, await read(file));
  } catch {
    failures.push(`missing required catalog file: ${file}`);
  }
}

const catalog = parseJson("catalog/data/catalog.json");
const catalogPolicy = parseJson("scripts/addons/catalog-policy.json");
const trustedReviews = parseJson("scripts/addons/trusted-catalog-reviews.json");
const selectionSchema = parseJson("docs/schemas/milxdy-selection.schema.json");

if (catalog) verifyCatalog(catalog, catalogPolicy, trustedReviews);
if (selectionSchema?.properties?.schemaVersion?.const !== 2) failures.push("selection schema must require schemaVersion 2");
if (selectionSchema?.properties?.build?.properties?.target?.const !== "chromium") failures.push("selection schema must be Chromium-only");
if (JSON.stringify(selectionSchema).includes('"url"') || JSON.stringify(selectionSchema).includes('"filename"')) {
  failures.push("selection schema must not carry remote package URLs or download filenames");
}

const index = contents.get("catalog/index.html") || "";
for (const phrase of [
  "No marketplace package download or runtime install.",
  "Download selection file",
  "npm run addons:prepare",
  "npm run addons:apply",
  "Combined review",
]) {
  if (!index.includes(phrase)) failures.push(`catalog index is missing required disclosure or workflow text: ${phrase}`);
}
for (const phrase of ["milxdy-logo-square-bevel.png", "workflow-steps", "catalog-window", "tabs", ">Steps</p>"]) {
  if (!index.includes(phrase)) failures.push(`catalog index is missing established milXdy UI reference: ${phrase}`);
}

const styles = contents.get("catalog/assets/styles.css") || "";
for (const phrase of ["--milxdy-surface", "--milxdy-surface-2", "--milxdy-rn-blue", "--milxdy-green-soft", "--milxdy-page-bg", "border-radius: 6px", "prefers-color-scheme: dark", ".selection-review"]) {
  if (!styles.includes(phrase)) failures.push(`catalog styles are missing established token, geometry, or review UI: ${phrase}`);
}

const detail = contents.get("catalog/add-ons/index.html") || "";
if (!detail.includes("addon-detail")) failures.push("detail page mount is missing");

const script = contents.get("catalog/assets/catalog.js") || "";
for (const phrase of ["catalog.json", "add-ons/?id=", "isSelectable", "resolveSelection", "selectionJson", ".milxdy-selection.json", "selection-summary"]) {
  if (!script.includes(phrase)) failures.push(`catalog renderer is missing required behavior: ${phrase}`);
}
if (/pkg\.download|Starting \$\{downloads\.length\}|fetch\(pkg\./u.test(script)) {
  failures.push("catalog renderer must not download package code");
}

if (catalog) await verifySelectionModule(catalog);

const workflow = contents.get(".github/workflows/pages-catalog.yml") || "";
if (!/^on:\s*\n\s+workflow_dispatch:/m.test(workflow)) failures.push("Pages workflow must be manual-only with workflow_dispatch");
for (const forbidden of ["push:", "pull_request:", "schedule:", "release:"]) {
  if (workflow.includes(forbidden)) failures.push(`Pages workflow must not include automatic trigger: ${forbidden}`);
}
if (!workflow.includes("build-pages-catalog.mjs") || !workflow.includes("tmp/pages-catalog-site")) {
  failures.push("Pages workflow must build and upload the staged catalog with checked-in brand assets");
}

const docs = contents.get("docs/contributors/ADD_ONS_CATALOG.md") || "";
if (!docs.includes("intentionally manual-only")) failures.push("catalog docs must explain the manual-only deployment gate");

if (failures.length) {
  console.error("Pages catalog verification failed:");
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log("Pages catalog verification passed.");
notes.forEach((note) => console.log(`  ${note}`));
console.log("  local-only selection, combined disclosure, dependency, conflict, and empty-selection gates: present");

function parseJson(file) {
  try {
    return JSON.parse(contents.get(file) || "");
  } catch (error) {
    failures.push(`${file} is invalid JSON: ${error.message}`);
    return null;
  }
}

function verifyCatalog(value, policy, reviews) {
  if (value.schemaVersion !== 2) failures.push("catalog schemaVersion must be 2");
  if (!value.catalogId || !value.revision) failures.push("catalog identity and revision are required");
  if (!["preview", "live"].includes(value.catalogStatus)) failures.push("catalogStatus must be preview or live");
  if (value.supportedBuildTargets?.join(",") !== "chromium") failures.push("first catalog must be Chromium-only");
  if (!value.buildRecipes?.some((recipe) => recipe.id === "maintainer-local-v1" && recipe.target === "chromium")) {
    failures.push("catalog must define the maintainer-local-v1 Chromium recipe");
  }
  const sections = new Map((value.sections || []).map((section) => [section.id, section]));
  for (const [id, name] of [["official", "Official milXdy add-ons"], ["approved-external", "Approved external add-ons"]]) {
    if (sections.get(id)?.name !== name) failures.push(`catalog section ${id} must be named ${name}`);
  }
  for (const id of sections.keys()) if (!["official", "approved-external"].includes(id)) failures.push(`unsupported catalog section: ${id}`);

  const packages = (value.sections || []).flatMap((section) => section.packages || []);
  const packageById = new Map(packages.map((pkg) => [pkg.id, pkg]));
  for (const id of ["pets-maker", "tweet-composer-kit", "tweetPng"]) {
    if (!packageById.has(id)) failures.push(`initial maintainer catalog is missing ${id}`);
  }
  if (packages.length !== 3) failures.push("current maintainer catalog must contain exactly Pets Maker, Composer Kit, and Share Kit");
  if (packageById.get("pets-maker")?.availability !== "published") failures.push("reviewed checked-in Pets Maker must be selectable");
  if (packageById.get("tweet-composer-kit")?.availability !== "under-review") failures.push("Composer Kit must fail closed until its source and trusted review are checked in");
  if (packageById.get("tweetPng")?.availability !== "published") failures.push("reviewed checked-in Share Kit must be selectable");
  if (packages.some((pkg) => ["booru", "memeMaker", "composerTools"].includes(pkg.id))) failures.push("feature concepts and the built-in typing helper must not appear as standalone add-ons");

  const ids = new Set();
  const allowedRoots = policy?.allowedArtifactRoots || [];
  const trusted = new Set((reviews?.reviews || []).map((entry) => reviewKey(entry)));
  let selectableCount = 0;
  for (const pkg of packages) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(pkg.id || "")) failures.push(`invalid package id: ${pkg.id || "<missing>"}`);
    if (ids.has(pkg.id)) failures.push(`duplicate package id: ${pkg.id}`);
    ids.add(pkg.id);
    for (const field of ["name", "summary", "publisher", "packageKind", "sdk", "source", "review", "permissions", "storage"]) {
      if (!pkg[field]) failures.push(`${pkg.id}: ${field} is required`);
    }
    for (const field of ["capabilities", "siteScopes", "remoteServices", "privacyNotes", "dependencies", "conflicts", "blockers"]) {
      if (!Array.isArray(pkg[field])) failures.push(`${pkg.id}: ${field} must be an array`);
    }
    if (!pkg.icon?.src || !pkg.icon?.alt) failures.push(`${pkg.id}: icon metadata is required`);
    if (!["planned", "experimental", "under-review", "published", "incompatible", "unavailable", "deprecated", "blocked"].includes(pkg.availability)) {
      failures.push(`${pkg.id}: invalid availability`);
    }
    if (!["not-started", "in-progress", "approved", "blocked"].includes(pkg.review?.status)) failures.push(`${pkg.id}: invalid review status`);
    if (pkg.review?.status === "approved" && (!pkg.review.reviewedBy || !/^\d{4}-\d{2}-\d{2}$/.test(pkg.review.reviewedAt || ""))) {
      failures.push(`${pkg.id}: approved review records require reviewedBy and ISO review date`);
    }
    if (pkg.artifact) {
      if (pkg.artifact.kind !== "maintainer-source") failures.push(`${pkg.id}: only maintainer-source artifacts are allowed`);
      if (!allowedRoots.some((root) => pkg.artifact.path === root || pkg.artifact.path.startsWith(`${root}/`))) failures.push(`${pkg.id}: artifact path is outside allowed roots`);
      if (!/^[a-f0-9]{64}$/.test(pkg.artifact.packageSha256 || "")) failures.push(`${pkg.id}: artifact package hash is invalid`);
      if (pkg.review?.status === "approved" && !trusted.has(reviewKey({
        id: pkg.id,
        version: pkg.version,
        packageSha256: pkg.artifact.packageSha256,
        reviewedBy: pkg.review.reviewedBy,
        reviewedAt: pkg.review.reviewedAt,
      }))) failures.push(`${pkg.id}: reviewed artifact is not pinned in trusted-catalog-reviews.json`);
    }
    if (pkg.availability === "published") {
      selectableCount += 1;
      if (!pkg.version || !pkg.artifact || pkg.review?.status !== "approved") failures.push(`${pkg.id}: published packages require version, local artifact, and approved review`);
    }
    if (!pkg.artifact && pkg.availability === "published") failures.push(`${pkg.id}: published package cannot omit its local artifact`);
    if ("download" in pkg) failures.push(`${pkg.id}: remote download metadata is forbidden in the local maintainer catalog`);
  }
  notes.push(`catalog metadata: ${packages.length} package record(s), ${selectableCount} selectable`);
}

async function verifySelectionModule(catalog) {
  const { resolveSelection, selectionFor } = await import(new URL("../../catalog/assets/selection.js", import.meta.url));
  const empty = selectionFor(catalog, []);
  if (empty.schemaVersion !== 2 || empty.catalog.id !== catalog.catalogId || empty.catalog.revision !== catalog.revision) failures.push("empty selection must preserve catalog identity and schema 2");
  if (empty.build.target !== "chromium" || empty.build.recipeId !== "maintainer-local-v1" || empty.packages.length !== 0) failures.push("empty selection must be an explicit Chromium baseline recipe");
  if (JSON.stringify(empty).includes("url") || JSON.stringify(empty).includes("filename")) failures.push("selection artifact must not contain package download data");

  const basePackage = {
    ...catalog.sections[0].packages.find((pkg) => pkg.id === "tweetPng"),
  };
  const dependency = { ...basePackage, id: "dependency", name: "Dependency", version: "1.0.0", replacement: null, dependencies: [], conflicts: [], artifact: { ...basePackage.artifact, path: "packages/maintainer/dependency" } };
  const dependent = { ...basePackage, id: "dependent", name: "Dependent", version: "1.0.0", replacement: null, dependencies: [{ id: "dependency", version: "1.0.0", reason: "fixture" }], conflicts: [], artifact: { ...basePackage.artifact, path: "packages/maintainer/dependent" } };
  const conflicting = { ...basePackage, id: "conflicting", name: "Conflicting", version: "1.0.0", replacement: null, dependencies: [], conflicts: [{ id: "dependency", reason: "fixture overlap" }], artifact: { ...basePackage.artifact, path: "packages/maintainer/conflicting" } };
  const fixture = { ...catalog, sections: [{ ...catalog.sections[0], packages: [dependency, dependent, conflicting] }, catalog.sections[1]] };
  if (resolveSelection(fixture, ["dependent"]).ok) failures.push("selection resolver must reject a missing explicit dependency");
  if (resolveSelection(fixture, ["dependency", "conflicting"]).ok) failures.push("selection resolver must reject conflicts");
  const valid = resolveSelection(fixture, ["dependent", "dependency"]);
  if (!valid.ok || valid.selected.map((pkg) => pkg.id).join(",") !== "dependency,dependent") failures.push("selection resolver must sort and accept a valid explicit dependency set");
  if (resolveSelection(catalog, ["tweet-composer-kit"]).ok) failures.push("selection resolver must reject under-review packages");
  if (!resolveSelection(catalog, ["pets-maker"]).ok) failures.push("selection resolver must accept published Pets Maker");
  if (!resolveSelection(catalog, ["pets-maker", "tweetPng"]).ok) failures.push("selection resolver must accept the compatible Pets Maker and Share Kit pair");
  if (!resolveSelection(catalog, ["tweetPng"]).ok) failures.push("selection resolver must accept published Share Kit");
}

function reviewKey(entry) {
  return [entry.id, entry.version, entry.packageSha256, entry.reviewedBy, entry.reviewedAt].join("\n");
}
