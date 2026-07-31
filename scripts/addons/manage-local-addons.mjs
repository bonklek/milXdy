import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { assertSafeGeneratedOutputDir } from "../build/generated-output-dir-safety.mjs";
import { loadSelection, materializeSelectionPackages, verifyMaterializedSelection } from "./selection.mjs";

const command = process.argv[2] ?? "status";
if (!new Set(["prepare", "apply", "status", "rebuild"]).has(command)) {
  throw new Error('Use "prepare", "apply", "status", or "rebuild".');
}

const testRoot = process.env.MILXDY_ADDON_MANAGER_TEST_ROOT
  ? assertSafeGeneratedOutputDir(process.env.MILXDY_ADDON_MANAGER_TEST_ROOT, "Local Add-on Manager test root")
  : null;
const addOnsDirectory = testRoot || "local-addons";
const manualPackagesDirectory = `${addOnsDirectory}/manual`;
const catalogPackagesDirectory = `${addOnsDirectory}/catalog`;
const managerStateDirectory = `${addOnsDirectory}/.state`;
const selectionLockPath = `${managerStateDirectory}/selection-lock.json`;
const stableOutputDirectory = assertSafeGeneratedOutputDir(testRoot ? `${testRoot}/stable` : "dist/chromium-local-apps", "Stable local app output");
const workDirectory = assertSafeGeneratedOutputDir(testRoot ? `${testRoot}/work` : "tmp/local-addon-manager", "Local Add-on Manager work directory");
const compositionDirectory = `${workDirectory}/composition`;
const stagingDirectory = `${workDirectory}/build-staging`;
const catalogStagingDirectory = `${workDirectory}/catalog-staging`;
const managerStatusPath = `${workDirectory}/status.json`;
const planPath = `${compositionDirectory}/build-plan.json`;
const buildPromotionJournal = `${managerStateDirectory}/build-promotion.json`;
const catalogPromotionJournal = `${managerStateDirectory}/catalog-promotion.json`;
const catalogBackupDirectory = `${addOnsDirectory}/.catalog-backup`;
const buildBackupDirectory = testRoot ? `${testRoot}/.stable-backup` : "dist/.chromium-local-apps-backup";
const packageJson = await readJson("package.json", {});
const catalogPath = process.env.MILXDY_ADDON_MANAGER_CATALOG_PATH || "catalog/data/catalog.json";

const supportedTrustFlags = new Set([
  "--allow-local-review",
  "--acknowledge-package-consent",
  "--acknowledge-first-party-replacement",
  "--allow-sensitive-package-apis",
]);
const forwardedTrustFlags = process.argv.slice(3).filter((arg) => supportedTrustFlags.has(arg));
const managerArgs = process.argv.slice(3).filter((arg) => arg.startsWith("--selection="));
const unsupportedFlags = process.argv.slice(3).filter((arg) => arg.startsWith("--") && !supportedTrustFlags.has(arg) && !arg.startsWith("--selection="));
if (unsupportedFlags.length > 0) throw new Error(`Unsupported Add-on Manager flag(s): ${unsupportedFlags.join(", ")}`);

await mkdir(manualPackagesDirectory, { recursive: true });
await mkdir(managerStateDirectory, { recursive: true });
await recoverPromotion(buildPromotionJournal, stableOutputDirectory, buildBackupDirectory);
await recoverPromotion(catalogPromotionJournal, catalogPackagesDirectory, catalogBackupDirectory);
await mkdir(catalogPackagesDirectory, { recursive: true });

if (command === "prepare") {
  await prepareSelection(managerArgs[0]?.slice("--selection=".length) || ".milxdy-selection.json");
  process.exit(0);
}

if (command === "apply") {
  const lock = await readJson(selectionLockPath, null);
  if (!lock) {
    await recordFailure("validation-failed", "selection-not-prepared", null, await activeBuildIdentity());
    fail("selection-not-prepared", `No prepared selection found. Run npm run addons:prepare -- --selection=<file> first.`);
  }
  try {
    await verifyMaterializedSelection(lock.packages || [], catalogPackagesDirectory);
  } catch (error) {
    await recordFailure("validation-failed", error.code || "materialized-package", null, await activeBuildIdentity());
    fail(error.code || "materialized-package", error.message);
  }
  if (lock.packages?.some((entry) => entry.reviewTrusted !== true) && !forwardedTrustFlags.includes("--allow-local-review")) {
    await recordFailure("validation-failed", "catalog-review-untrusted", null, await activeBuildIdentity());
    fail("catalog-review-untrusted", "Selection includes packages without a checked-in trusted catalog review. Inspect them, then pass --allow-local-review to continue.");
  }
}

await rm(compositionDirectory, { recursive: true, force: true });
await rm(stagingDirectory, { recursive: true, force: true });
const preview = command === "status";
const composeResult = compose([manualPackagesDirectory, catalogPackagesDirectory], preview);
const report = await readJson(`${compositionDirectory}/composition-report.json`, null);
if (composeResult.status !== 0 || !report) {
  await recordFailure("validation-failed", "composition", report, await activeBuildIdentity());
  console.error(`Local add-on validation failed. See ${managerStatusPath}. The stable build was not replaced.`);
  process.exit(composeResult.status ?? 1);
}
printCapabilitySummary(report);

if (command === "status") {
  const identity = await activeBuildIdentity();
  const status = managerStatus("prepared", report, identity, await readJson(selectionLockPath, null));
  await writeManagerStatus(status);
  printStatus(status, "Validation passed; no build was changed.");
  process.exit(0);
}

const plan = await readJson(planPath, null);
if (!plan || typeof plan.buildId !== "string" || typeof plan.compositionFingerprint !== "string") {
  throw new Error("Composer did not produce valid build identities.");
}
const buildResult = run([
  "scripts/build/build-extension.mjs",
  "--target=chromium",
  `--local-app-plan=${planPath}`,
]);
if (buildResult.status !== 0) {
  await recordFailure("build-failed", "build", report, await activeBuildIdentity());
  console.error(`Local add-on build failed. See ${managerStatusPath}. The stable build was not replaced.`);
  process.exit(buildResult.status ?? 1);
}

const selectionLock = await readJson(selectionLockPath, null);
const ready = managerStatus("built", report, {
  buildId: plan.buildId,
  compositionFingerprint: plan.compositionFingerprint,
}, selectionLock);
await writeFile(`${stagingDirectory}/local-addon-status.json`, `${JSON.stringify(ready, null, 2)}\n`);
try {
  await promoteWithJournal({
    journalPath: buildPromotionJournal,
    stablePath: stableOutputDirectory,
    stagingPath: stagingDirectory,
    backupPath: buildBackupDirectory,
  });
} catch (error) {
  await recordFailure("build-failed", "promotion", report, await activeBuildIdentity());
  throw error;
}
await writeManagerStatus(ready);
printStatus(ready, "Stable local app build updated.");
console.log("Stage 4/4 — Reload: open chrome://extensions, click Reload on the existing milXdy unpacked extension, then refresh X.");

async function prepareSelection(selectionPath) {
  let loaded;
  try {
    loaded = await loadSelection(
      selectionPath,
      catalogPath,
      "scripts/addons/catalog-policy.json",
      "scripts/addons/trusted-catalog-reviews.json",
    );
  } catch (error) {
    await recordFailure("validation-failed", error.code || "selection-read", null, await activeBuildIdentity());
    fail(error.code || "selection-read", error.message);
  }
  console.log(`Stage 1/4 — Select: ${loaded.packages.length} package(s) from ${selectionPath}`);
  try {
    await materializeSelectionPackages(loaded, {
      stagingDirectory: catalogStagingDirectory,
    });
  } catch (error) {
    await recordFailure("validation-failed", error.code || "materialize", null, await activeBuildIdentity());
    fail(error.code || "materialize", error.message);
  }
  console.log(`Stage 2/4 — Materialize: reviewed checked-in packages copied to ${catalogStagingDirectory}`);

  await rm(compositionDirectory, { recursive: true, force: true });
  const result = compose([manualPackagesDirectory, catalogStagingDirectory], true);
  const report = await readJson(`${compositionDirectory}/composition-report.json`, null);
  if (result.status !== 0 || !report) {
    await recordFailure("validation-failed", "composition", report, await activeBuildIdentity());
    fail("composition", `Prepared selection did not pass package validation. See ${managerStatusPath}.`);
  }
  verifySelectionAgainstReport(loaded.packages, report, catalogStagingDirectory);
  printCapabilitySummary(report);
  try {
    await promoteWithJournal({
      journalPath: catalogPromotionJournal,
      stablePath: catalogPackagesDirectory,
      stagingPath: catalogStagingDirectory,
      backupPath: catalogBackupDirectory,
    });
  } catch (error) {
    await recordFailure("validation-failed", "placement-promotion", report, await activeBuildIdentity());
    throw error;
  }
  const lock = {
    schemaVersion: 2,
    selectionSchemaVersion: loaded.selection.schemaVersion,
    selectionSha256: loaded.selectionSha256,
    catalog: loaded.selection.catalog,
    build: loaded.selection.build,
    preparedAt: new Date().toISOString(),
    packages: loaded.packages.map((entry) => ({
      id: entry.id,
      version: entry.version,
      packageSha256: entry.packageSha256,
      artifact: {
        kind: entry.artifact.kind,
        path: entry.artifact.path,
        recipeId: entry.artifact.recipeId,
      },
      review: entry.review,
      reviewTrusted: entry.reviewTrusted,
    })),
  };
  await writeJsonAtomic(selectionLockPath, lock);
  const status = managerStatus("prepared", report, await activeBuildIdentity(), lock);
  await writeManagerStatus(status);
  const missing = unique(report.requiredAcknowledgements?.filter((entry) => entry.acknowledged !== true).map((entry) => entry.flag) || []);
  if (lock.packages.some((entry) => entry.reviewTrusted !== true)) missing.push("--allow-local-review (catalog review is not in the trusted registry)");
  console.log(`Prepared selection: ${lock.selectionSha256}`);
  console.log(missing.length ? `Required before apply: ${unique(missing).join(", ")}` : "No additional trust acknowledgements are required.");
  console.log("Stage 3/4 — Rebuild: run npm run addons:apply with the listed acknowledgements.");
}

function compose(packageDirectories, preview) {
  return run([
    "scripts/packages/compose-local-app-packages.mjs",
    ...packageDirectories.map((directory) => `--packages-dir=${directory}`),
    `--out-dir=${compositionDirectory}`,
    `--plan-out=${planPath}`,
    `--build-output-dir=${stagingDirectory}`,
    `--build-id=${randomBytes(12).toString("hex")}`,
    preview ? "--preview-trust-requirements" : null,
    ...forwardedTrustFlags,
  ].filter(Boolean));
}

function verifySelectionAgainstReport(packages, report, stagingPath) {
  const selectedIds = new Set(packages.map((entry) => entry.id));
  const normalizedStaging = stagingPath.replaceAll("\\", "/").replace(/\/+$/u, "");
  const stagedAccepted = (report.acceptedPackages || []).filter((entry) => String(entry.source?.root || "").replaceAll("\\", "/").startsWith(`${normalizedStaging}/`));
  const acceptedIds = new Set(stagedAccepted.map((entry) => entry.id));
  if (selectedIds.size !== acceptedIds.size || Array.from(selectedIds).some((id) => !acceptedIds.has(id))) {
    fail("selection-package-id", "Materialized package manifest IDs do not exactly match the selection.");
  }
  for (const entry of packages) {
    const accepted = stagedAccepted.find((candidate) => candidate.id === entry.id);
    if (accepted?.packageSha256 !== entry.packageSha256 || accepted?.version !== entry.version || path.basename(accepted.source.root) !== entry.id) {
      fail("selection-package-mismatch", `Composer provenance does not match the selected maintainer package for ${entry.id}.`);
    }
  }
}

function printCapabilitySummary(report) {
  const accepted = report.acceptedPackages || [];
  const hosts = unique(accepted.flatMap((entry) => entry.permissions?.hosts || []));
  const optional = unique(accepted.flatMap((entry) => entry.permissions?.optional || []));
  const storage = unique(accepted.flatMap((entry) => Object.entries(entry.settings?.storageKeys || {}).flatMap(([area, keys]) => (keys || []).map((key) => `${area}:${key}`))));
  const remote = unique(accepted.flatMap((entry) => entry.privacy?.remoteServices || entry.trust?.remoteServices || []));
  const surfaces = unique(accepted.flatMap((entry) => entry.trust?.privilegedSurfaces || []));
  console.log("Consolidated package review");
  console.log(`  packages: ${accepted.map((entry) => `${entry.id}@${entry.version}`).join(", ") || "none"}`);
  console.log(`  hosts: ${hosts.join(", ") || "none"}`);
  console.log(`  optional permissions: ${optional.join(", ") || "none"}`);
  console.log(`  storage: ${storage.join(", ") || "none"}`);
  console.log(`  remote services: ${remote.join(", ") || "none"}`);
  console.log(`  privileged surfaces: ${surfaces.join(", ") || "none"}`);
}

function managerStatus(state, compositionReport, identity, selectionLock) {
  const accepted = Array.isArray(compositionReport?.acceptedPackages) ? compositionReport.acceptedPackages : [];
  return {
    schemaVersion: 2,
    mode: "managed-local-addons",
    state,
    workflowStage: state === "built" ? "reload" : "rebuild",
    buildId: identity?.buildId,
    buildInstanceId: identity?.buildId,
    compositionFingerprint: identity?.compositionFingerprint,
    extensionVersion: String(packageJson.extensionVersion || packageJson.version || ""),
    generatedAt: new Date().toISOString(),
    addOnsDirectory,
    manualPackagesDirectory,
    catalogPackagesDirectory,
    outputDirectory: stableOutputDirectory,
    reportPath: `${compositionDirectory}/composition-report.json`,
    selection: selectionLock ? {
      schemaVersion: selectionLock.selectionSchemaVersion,
      sha256: selectionLock.selectionSha256,
      catalog: selectionLock.catalog,
    } : null,
    packages: accepted.map((entry) => ({
      id: entry.id,
      name: entry.name,
      version: entry.version,
      reviewStatus: entry.diagnostics?.reviewStatus,
      packageSha256: entry.packageSha256,
    })),
    errors: [],
    warnings: (compositionReport?.diagnostics?.warnings || []).filter((value) => typeof value === "string").slice(0, 50),
  };
}

async function recordFailure(state, failureClass, report, identity) {
  const status = managerStatus(state, report, identity, await readJson(selectionLockPath, null));
  status.failureClass = failureClass;
  status.workflowStage = /materialize|materialized|placement/u.test(failureClass)
    ? "place"
    : /composition|build|promotion/u.test(failureClass)
      ? "rebuild"
      : "select";
  status.errors = [
    ...(Array.isArray(report?.diagnostics?.errors) ? report.diagnostics.errors : []),
    ...(Array.isArray(report?.rejectedPackages) ? report.rejectedPackages.flatMap((entry) => [entry.reason, ...(entry.diagnostics || [])]) : []),
  ].filter((value) => typeof value === "string").slice(0, 50);
  await writeManagerStatus(status);
}

async function activeBuildIdentity() {
  const current = await readJson(`${stableOutputDirectory}/local-addon-status.json`, null);
  return {
    buildId: typeof current?.buildId === "string" ? current.buildId : undefined,
    compositionFingerprint: typeof current?.compositionFingerprint === "string" ? current.compositionFingerprint : undefined,
  };
}

async function writeManagerStatus(status) {
  await mkdir(workDirectory, { recursive: true });
  await writeJsonAtomic(managerStatusPath, status);
}

async function promoteWithJournal({ journalPath, stablePath, stagingPath, backupPath }) {
  await recoverPromotion(journalPath, stablePath, backupPath);
  await rm(backupPath, { recursive: true, force: true });
  await writeJsonAtomic(journalPath, { schemaVersion: 1, state: "prepared", stablePath, stagingPath, backupPath });
  if (existsSync(stablePath)) await rename(stablePath, backupPath);
  await writeJsonAtomic(journalPath, { schemaVersion: 1, state: "backed-up", stablePath, stagingPath, backupPath });
  try {
    await rename(stagingPath, stablePath);
    await writeJsonAtomic(journalPath, { schemaVersion: 1, state: "promoted", stablePath, stagingPath, backupPath });
    await rm(backupPath, { recursive: true, force: true });
    await rm(journalPath, { force: true });
  } catch (error) {
    if (existsSync(backupPath) && !existsSync(stablePath)) await rename(backupPath, stablePath);
    await rm(journalPath, { force: true });
    throw error;
  }
}

async function recoverPromotion(journalPath, stablePath, backupPath) {
  const journal = await readJson(journalPath, null);
  if (!journal && !existsSync(backupPath)) return;
  if (!existsSync(stablePath) && existsSync(backupPath)) await rename(backupPath, stablePath);
  else if (existsSync(stablePath) && existsSync(backupPath)) await rm(backupPath, { recursive: true, force: true });
  await rm(journalPath, { force: true });
}

async function writeJsonAtomic(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.partial`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`);
  await rename(temporary, filePath);
}

function run(args) {
  const result = spawnSync(process.execPath, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  return result;
}

async function readJson(file, fallback) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return fallback; }
}

function printStatus(status, lead) {
  console.log(lead);
  console.log(`  manual add-ons: ${manualPackagesDirectory}`);
  console.log(`  catalog add-ons: ${catalogPackagesDirectory}`);
  console.log(`  accepted: ${status.packages.length}`);
  console.log(`  composition: ${status.compositionFingerprint || "not built"}`);
  console.log(`  stable output: ${stableOutputDirectory}`);
  console.log(`  report: ${managerStatusPath}`);
}

function fail(code, message) {
  const error = new Error(`[${code}] ${message}`);
  error.code = code;
  throw error;
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean))).sort();
}
