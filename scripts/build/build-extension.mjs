import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp, copyFile, lstat, mkdir, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, posix, relative, resolve } from "node:path";
import { createRequire } from "node:module";
import esbuild from "esbuild";
import { assertSafeGeneratedOutputDir } from "./generated-output-dir-safety.mjs";
import { commonAssetDirs, webAccessibleMatches } from "../release/release-builds.mjs";

const watch = process.argv.includes("--watch");
const target = readTarget();
const buildProfile = readProfile();
const localAppPlanPath = readStringArg("--local-app-plan");
const localAppPlan = localAppPlanPath ? JSON.parse(await readFile(localAppPlanPath, "utf8")) : null;
const firstPartyReplacementPolicy = JSON.parse(await readFile("scripts/packages/local-app-first-party-replacements.json", "utf8"));
const firstPartyReplacementPolicyById = new Map((firstPartyReplacementPolicy.replacements || []).map((item) => [item.id, item]));
if (localAppPlan && target !== "chromium") {
  throw new Error("Local app composition builds currently target Chromium only.");
}
if (localAppPlan) validateLocalAppPlan(localAppPlan);
const userDownloadAssetDirs = ["wiki-helper"];
const nonWebAccessibleAssetDirs = new Set(userDownloadAssetDirs);
const outDir = localAppPlan?.outputDir ?? (buildProfile === "full" ? `dist/${target}` : `dist/${target}-${buildProfile}`);
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const extensionVersion = String(packageJson.extensionVersion || packageJson.version || "").trim();
const registryApps = localAppPlan?.apps ?? JSON.parse(await readFile("src/platform/app-sdk/first-party-apps.json", "utf8"));
const firstPartyApps = registryApps;
const sourceBuiltApps = firstPartyApps.filter((app) => app.entryName && app.entryPoint);
const require = createRequire(import.meta.url);
const tesseractCoreDir = resolvePackageDir("tesseract.js-core");

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
await mkdir(`${outDir}/features`, { recursive: true });

await writeManifest();
await copyFile("assets/extension/popup/popup.html", `${outDir}/popup.html`);
await copyFile("assets/extension/popup/popup.css", `${outDir}/popup.css`);
if (existsSync("assets/extension/_locales")) {
  await cp("assets/extension/_locales", `${outDir}/_locales`, { recursive: true });
}
if (appEnabled("post-reading")) {
  await copyFile("assets/extension/frames/ocr.html", `${outDir}/ocr.html`);
}
if (appEnabled("miladymaxxer") && existsSync("assets/apps/milady-maxxer/milady-logo.png")) {
  await copyFile("assets/apps/milady-maxxer/milady-logo.png", `${outDir}/milady-logo.png`);
}

for (const dir of unique([
  ...commonAssetDirs,
  ...firstPartyApps.flatMap((app) => app.assets || []),
])) {
  await copyAssetDirectory(dir);
}
await copyUserDownloadAssets();
for (const sheet of firstPartyApps.flatMap((app) => app.css || [])) {
  if (sheet.source && existsSync(sheet.source)) {
    await mkdir(`${outDir}/${sheet.targetDir}`, { recursive: true });
    await copyFile(sheet.source, `${outDir}/${sheet.targetDir}/${sheet.target}`);
  }
}
await copyLocalPackageAssets();
if (appEnabled("music") && existsSync("node_modules/@unimusic/chromaprint/dist/chromaprint.wasm")) {
  await copyFile("node_modules/@unimusic/chromaprint/dist/chromaprint.wasm", `${outDir}/features/chromaprint.wasm`);
}

if (appEnabled("post-reading")) {
  await mkdir(`${outDir}/ocr/core`, { recursive: true });
  await mkdir(`${outDir}/ocr/lang`, { recursive: true });
  if (existsSync("node_modules/tesseract.js/dist/worker.min.js")) {
    await copyFile("node_modules/tesseract.js/dist/worker.min.js", `${outDir}/ocr/worker.min.js`);
  }
  if (tesseractCoreDir) {
    await cp(tesseractCoreDir, `${outDir}/ocr/core`, { recursive: true });
  }
  if (existsSync("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz")) {
    await copyFile("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz", `${outDir}/ocr/lang/eng.traineddata.gz`);
  }
}
if (appEnabled("miladymaxxer") && existsSync("node_modules/onnxruntime-web/dist")) {
  await mkdir(`${outDir}/ort`, { recursive: true });
  for (const file of [
    "ort-wasm-simd-threaded.jsep.mjs",
    "ort-wasm-simd-threaded.jsep.wasm",
  ]) {
    await copyFile(`node_modules/onnxruntime-web/dist/${file}`, `${outDir}/ort/${file}`);
  }
}
await pruneSourceMaps(outDir);

const common = {
  bundle: true,
  platform: "browser",
  target: "es2022",
  sourcemap: false,
  logLevel: "info",
  define: {
    MILXDY_BUILD_PROFILE: JSON.stringify(buildProfile),
    MILXDY_BUILD_TARGET: JSON.stringify(target),
    MILXDY_VERSION: JSON.stringify(extensionVersion),
  },
  plugins: [profileRegistryPlugin()],
};

const contexts = [];

const source = (path) => resolve(path);

function readTarget() {
  const value = process.argv.find((arg) => arg.startsWith("--target="))?.split("=")[1] ?? "chromium";
  if (value !== "chromium" && value !== "firefox") {
    throw new Error(`Unknown build target "${value}". Use "chromium" or "firefox".`);
  }
  return value;
}

function readProfile() {
  const value = process.argv.find((arg) => arg.startsWith("--profile="))?.split("=")[1] ?? "full";
  if (value !== "lite" && value !== "balanced" && value !== "full") {
    throw new Error(`Unknown build profile "${value}". Use "lite", "balanced", or "full".`);
  }
  return value;
}

function readStringArg(name) {
  const prefix = `${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function appEnabled(id) {
  return firstPartyApps.some((app) => app.id === id);
}

async function copyAssetDirectory(outputDir) {
  if (outputDir === "generated") {
    await copyGeneratedModelMetadata();
    return;
  }
  const sourceDir = assetSourceDir(outputDir);
  if (!sourceDir || !existsSync(sourceDir)) return;
  await cp(sourceDir, `${outDir}/${outputDir}`, { recursive: true });
}

function assetSourceDir(outputDir) {
  const sourceByOutputDir = {
    brand: "assets/brand",
    icons: "assets/extension/icons",
    "remilia-fonts": "assets/shared/fonts",
    beetol: "assets/apps/beetol",
    miladymaxxer: "assets/apps/milady-maxxer",
    miladychanSpotlight: "assets/apps/miladychan-portal",
    music: "assets/apps/music",
    "post-reading": "assets/apps/post-reading",
    remistats: "assets/apps/remistats",
    wikiSidebar: "assets/apps/wiki-sidebar",
    models: "assets/models",
  };
  return sourceByOutputDir[outputDir] || null;
}

async function copyGeneratedModelMetadata() {
  const sourceFile = "assets/models/milady-mobilenetv3-small.meta.json";
  if (!existsSync(sourceFile)) return;
  await mkdir(`${outDir}/generated`, { recursive: true });
  await copyFile(sourceFile, `${outDir}/generated/milady-mobilenetv3-small.meta.json`);
}

async function copyUserDownloadAssets() {
  for (const dir of userDownloadAssetDirs) {
    const sourceDir = `assets/user-downloads/${dir}`;
    if (!existsSync(sourceDir)) continue;
    await cp(sourceDir, `${outDir}/${dir}`, { recursive: true });
  }
}

function validateLocalAppPlan(plan) {
  if (plan.composer !== "milxdy-local-app-composer" || plan.schemaVersion !== 1) {
    throw new Error("Local app plan must be generated by the milXdy local app composer.");
  }
  if (typeof plan.outputDir !== "string") {
    throw new Error("Local app plan is missing a safe output directory.");
  }
  plan.outputDir = assertSafeGeneratedOutputDir(plan.outputDir, "Local app plan outputDir");
  if (!Array.isArray(plan.diagnostics)) {
    throw new Error("Local app plan is missing composer diagnostics and trust decisions.");
  }
  for (const diagnostic of plan.diagnostics) {
    const packageId = assertSafePackageId(diagnostic.packageId, "diagnostics package id");
    const trust = diagnostic.trust;
    if (!trust) throw new Error(`Local app plan package ${packageId} is missing trust decisions.`);
    if (trust.reviewStatus === "blocked") throw new Error(`Local app plan includes blocked package ${packageId}.`);
    if (trust.reviewStatus !== "reviewed" && trust.localReviewAcknowledged !== true) {
      throw new Error(`Local app plan package ${packageId} lacks local review acknowledgement.`);
    }
    if ((trust.privilegedSurfaces || []).length > 0 && trust.packageConsentAcknowledged !== true) {
      throw new Error(`Local app plan package ${packageId} lacks package consent acknowledgement.`);
    }
    if ((trust.sensitiveApiFindings || []).length > 0 && (trust.reviewStatus !== "reviewed" || trust.sensitiveApiExceptionAcknowledged !== true)) {
      throw new Error(`Local app plan package ${packageId} lacks a reviewed sensitive API exception.`);
    }
  }
  if (!Array.isArray(plan.packageSources)) {
    throw new Error("Local app plan is missing package source roots.");
  }
  const packageRoots = new Map();
  for (const source of plan.packageSources) {
    const packageId = assertSafePackageId(source?.packageId, "package source package id");
    packageRoots.set(packageId, assertSafePlanRelativePath(source?.root, `package source ${packageId} root`));
  }
  validateLocalAppPlanPackageDiagnostics(plan, packageRoots);
  for (const diagnostic of plan.diagnostics) {
    const packageId = assertSafePackageId(diagnostic?.packageId, "diagnostics package id");
    if (!diagnostic?.trust?.shadowsFirstParty) continue;
    const policy = firstPartyReplacementPolicyById.get(packageId);
    const actualRoot = packageRoots.get(packageId);
    if (!policy) throw new Error(`Local app plan package ${packageId} shadows a first-party app without repo-owned replacement policy.`);
    if (policy.sourceType && diagnostic.sourceType !== policy.sourceType) {
      throw new Error(`Local app plan package ${packageId} first-party replacement source type does not match policy.`);
    }
    if (actualRoot !== assertSafePlanRelativePath(policy.root, `first-party replacement policy ${packageId} root`)) {
      throw new Error(`Local app plan package ${packageId} first-party replacement root does not match policy.`);
    }
    if (diagnostic.packageSha256 !== policy.packageSha256) {
      throw new Error(`Local app plan package ${packageId} first-party replacement hash does not match policy.`);
    }
    const trustPolicy = diagnostic.trust.firstPartyReplacementPolicy;
    if (trustPolicy?.allowed !== true || trustPolicy.root !== policy.root || trustPolicy.packageSha256 !== policy.packageSha256) {
      throw new Error(`Local app plan package ${packageId} is missing a verified first-party replacement trust decision.`);
    }
  }
  if (!Array.isArray(plan.packageCopyMap)) {
    throw new Error("Local app plan is missing a package copy map.");
  }
  const copyTargetsByPackage = new Map();
  for (const item of plan.packageCopyMap) {
    const label = assertSafePackageId(item?.packageId, "packageCopyMap package id");
    const fromRoot = assertSafePlanRelativePath(item?.fromRoot, `packageCopyMap ${label} fromRoot`);
    assertSafePlanRelativePath(item?.from, `packageCopyMap ${label} from`);
    const to = assertSafePlanRelativePath(item?.to, `packageCopyMap ${label} to`);
    assertLocalPackageTarget(label, to, `packageCopyMap ${label} to`);
    assertValidSha256(item?.sha256, `packageCopyMap ${label}`);
    if (fromRoot !== packageRoots.get(item?.packageId)) {
      throw new Error(`Local app plan packageCopyMap ${label} does not match its declared package root.`);
    }
    if (!copyTargetsByPackage.has(label)) copyTargetsByPackage.set(label, new Set());
    copyTargetsByPackage.get(label).add(to);
  }
  validateLocalAppPlanMetadata(plan, packageRoots, copyTargetsByPackage);
}

function validateLocalAppPlanPackageDiagnostics(plan, packageRoots) {
  const selectedIds = new Set((plan.selectedPackageIds || []).map((packageId) => assertSafePackageId(packageId, "selected package id")));
  const diagnosticsById = new Map((plan.diagnostics || []).map((entry) => [assertSafePackageId(entry.packageId, "diagnostics package id"), entry]));
  for (const packageId of selectedIds) {
    const diagnostic = diagnosticsById.get(packageId);
    const packageRoot = packageRoots.get(packageId);
    if (!diagnostic || !packageRoot) continue;
    const recomputed = recomputeLocalPackageDiagnostics(packageId, packageRoot, diagnostic.trust || {});
    const recomputedPackage = recomputed.acceptedPackages.find((candidate) => candidate.id === packageId)
      || recomputed.rejectedPackages.find((candidate) => candidate.id === packageId);
    if (recomputed.summary?.rejected > 0 || (recomputed.diagnostics?.errors || []).length > 0 || !recomputedPackage) {
      throw new Error(`Local app plan package ${packageId} no longer passes composer trust gates.`);
    }
    assertSensitiveApiFindingsMatch(
      packageId,
      diagnostic.trust?.sensitiveApiFindings || [],
      recomputedPackage.trust?.sensitiveApiFindings || [],
    );
  }
}

function recomputeLocalPackageDiagnostics(packageId, packageRoot, trust) {
  const args = [
    "scripts/packages/compose-local-app-packages.mjs",
    "--check",
    "--json",
    `--package=${packageRoot}`,
  ];
  if (trust.localReviewAcknowledged === true) args.push("--allow-local-review");
  if (trust.packageConsentAcknowledged === true) args.push("--acknowledge-package-consent");
  if (trust.firstPartyReplacementAcknowledged === true) args.push("--acknowledge-first-party-replacement");
  if (trust.sensitiveApiExceptionAcknowledged === true) args.push("--allow-sensitive-package-apis");

  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  let report;
  try {
    report = JSON.parse(result.stdout || "{}");
  } catch (error) {
    throw new Error(`Local app plan package ${packageId} composer revalidation did not return JSON: ${error.message}`);
  }
  if (result.status !== 0) {
    throw new Error(`Local app plan package ${packageId} no longer passes composer trust gates.`);
  }
  return report;
}

function assertSensitiveApiFindingsMatch(packageId, plannedFindings, recomputedFindings) {
  const planned = normalizedSensitiveApiFindings(plannedFindings);
  const recomputed = normalizedSensitiveApiFindings(recomputedFindings);
  if (JSON.stringify(planned) === JSON.stringify(recomputed)) return;
  throw new Error(`Local app plan package ${packageId} sensitive API scan does not match composer diagnostics.`);
}

function normalizedSensitiveApiFindings(findings) {
  return (findings || []).map((finding) => ({
    ruleId: finding.ruleId,
    severity: finding.severity,
    file: finding.file,
    line: finding.line,
    column: finding.column,
    message: finding.message,
  })).sort((left, right) => `${left.file}:${left.line}:${left.column}:${left.ruleId}`.localeCompare(`${right.file}:${right.line}:${right.column}:${right.ruleId}`));
}

function validateLocalAppPlanMetadata(plan, packageRoots, copyTargetsByPackage) {
  if (!Array.isArray(plan.selectedPackageIds)) {
    throw new Error("Local app plan is missing selected package ids.");
  }
  const selectedIds = new Set(plan.selectedPackageIds.map((packageId) => assertSafePackageId(packageId, "selected package id")));
  const diagnosticsById = new Map((plan.diagnostics || []).map((entry) => [assertSafePackageId(entry.packageId, "diagnostics package id"), entry]));
  const privacyById = new Map((plan.privacy || []).map((entry) => [assertSafePackageId(entry.packageId, "privacy package id"), entry]));
  for (const packageId of selectedIds) {
    if (!diagnosticsById.has(packageId)) throw new Error(`Local app plan package ${packageId} is missing diagnostics metadata.`);
    if (!packageRoots.has(packageId)) throw new Error(`Local app plan package ${packageId} is missing source metadata.`);
  }

  const contentEntries = plan.contentEntries || {};
  const webAccessibleResources = new Set((plan.webAccessibleAssets || []).flatMap((entry) => entry.resources || []));
  for (const app of plan.apps || []) {
    if (!app?.localPackage) continue;
    const packageId = assertSafePackageId(app.id, "local app metadata package id");
    const copyTargets = copyTargetsByPackage.get(packageId) || new Set();
    if (!selectedIds.has(packageId)) throw new Error(`Local app plan metadata includes unselected local package ${packageId}.`);
    if (app.entryName !== undefined || app.entryPoint !== undefined || app.requiredOutputs !== undefined || app.assets !== undefined) {
      throw new Error(`Local app plan metadata for ${packageId} includes first-party build-only fields.`);
    }
    if (app.localPackage.root !== packageRoots.get(packageId)) {
      throw new Error(`Local app plan metadata for ${packageId} does not match its declared package root.`);
    }
    const contentEntry = contentEntries[packageId];
    if (contentEntry) assertLocalPackageTarget(packageId, contentEntry.target, `content entry ${packageId} target`);
    if (!contentEntry || app.contentEntry !== contentEntry.target || !copyTargets.has(contentEntry.target)) {
      throw new Error(`Local app plan metadata for ${packageId} has a content entry outside the composer copy map.`);
    }
    if (!webAccessibleResources.has(contentEntry.target)) {
      throw new Error(`Local app plan metadata for ${packageId} does not expose its runtime-imported contentEntry as a web-accessible resource.`);
    }
    for (const sheet of app.css || []) {
      assertLocalPackageTarget(packageId, sheet.path, `CSS entry ${packageId}`);
      if (!copyTargets.has(sheet.path)) throw new Error(`Local app plan metadata for ${packageId} has a CSS entry outside the composer copy map.`);
    }
    for (const asset of app.package?.assets || []) {
      assertLocalPackageTarget(packageId, asset, `package asset ${packageId}`);
      if (!copyTargets.has(asset)) throw new Error(`Local app plan metadata for ${packageId} has a package asset outside the composer copy map.`);
    }
    for (const asset of app.package?.webAccessibleAssets || []) {
      assertLocalPackageTarget(packageId, asset, `web-accessible asset ${packageId}`);
      if (!copyTargets.has(asset)) throw new Error(`Local app plan metadata for ${packageId} has a web-accessible asset outside the composer copy map.`);
    }
  }

  const declaredAddedHosts = unique(Array.from(privacyById.values()).flatMap((entry) => entry.permissions?.addedHosts || [])).sort();
  const planAddedHosts = unique(plan.manifestPermissions?.addedHostPermissions || []).sort();
  if (JSON.stringify(planAddedHosts) !== JSON.stringify(declaredAddedHosts)) {
    throw new Error("Local app plan manifest permission expansion does not match composer privacy diagnostics.");
  }
  for (const host of planAddedHosts) {
    if (!(plan.manifestPermissions?.host_permissions || []).includes(host)) {
      throw new Error(`Local app plan added host permission is missing from host_permissions: ${host}`);
    }
  }
  const baseManifest = JSON.parse(readFileSync("assets/extension/manifest.json", "utf8"));
  const allowedHostPermissions = new Set([...(baseManifest.host_permissions || []), ...planAddedHosts]);
  for (const host of plan.manifestPermissions?.host_permissions || []) {
    if (!allowedHostPermissions.has(host)) {
      throw new Error(`Local app plan host permission is outside composer diagnostics: ${host}`);
    }
  }
  const declaredOptional = unique(Array.from(privacyById.values()).flatMap((entry) => entry.permissions?.optional || [])).sort();
  const planOptional = unique(plan.manifestPermissions?.optional_permissions || []).sort();
  if (JSON.stringify(planOptional) !== JSON.stringify(declaredOptional)) {
    throw new Error("Local app plan optional permissions do not match composer privacy diagnostics.");
  }

  const allowedWebResources = new Set();
  for (const targets of copyTargetsByPackage.values()) {
    for (const target of targets) allowedWebResources.add(target);
  }
  for (const entry of plan.webAccessibleAssets || []) {
    for (const resource of entry.resources || []) {
      if (!allowedWebResources.has(resource)) {
        throw new Error(`Local app plan web-accessible resource is outside the composer copy map: ${resource}`);
      }
    }
  }
}

function profileRegistryPlugin() {
  return {
    name: "milxdy-profile-registry",
    setup(build) {
      build.onLoad({ filter: /firstPartyApps\.json$/ }, () => ({
        contents: JSON.stringify(registryApps),
        loader: "json",
      }));
    },
  };
}

function unique(values) {
  return Array.from(new Set(values));
}

function resolvePackageDir(packageName) {
  try {
    return resolve(require.resolve(`${packageName}/package.json`), "..");
  } catch {
    try {
      return dirname(require.resolve(packageName));
    } catch {
      return resolvePnpmPackageDir(packageName);
    }
  }
}

function resolvePnpmPackageDir(packageName) {
  const pnpmDir = resolve("node_modules/.pnpm");
  if (!existsSync(pnpmDir)) return null;
  const packageFolderName = packageName.replace("/", "+");
  const entry = readdirSync(pnpmDir).find((name) => name === packageFolderName || name.startsWith(`${packageFolderName}@`));
  if (!entry) return null;
  const packageDir = resolve(pnpmDir, entry, "node_modules", packageName);
  return existsSync(packageDir) ? packageDir : null;
}

async function writeManifest() {
  const manifest = JSON.parse(await readFile("assets/extension/manifest.json", "utf8"));
  manifest.host_permissions = buildHostPermissions(manifest.host_permissions || []);
  manifest.optional_permissions = buildOptionalPermissions(manifest.optional_permissions || []);
  if (manifest.optional_permissions.length === 0) delete manifest.optional_permissions;
  manifest.web_accessible_resources = buildWebAccessibleResources(manifest.web_accessible_resources || []);
  if (target === "firefox") {
    manifest.background = {
      scripts: ["background.js"],
      type: "module",
    };
    manifest.browser_specific_settings = {
      gecko: {
        id: "milxdy@remilia",
        data_collection_permissions: {
          required: [
            "authenticationInfo",
            "personalCommunications",
            "personallyIdentifyingInfo",
            "websiteActivity",
            "websiteContent",
          ],
        },
        strict_min_version: "140.0",
      },
      gecko_android: {
        strict_min_version: "142.0",
      },
    };
  }
  await writeFile(`${outDir}/manifest.json`, `${JSON.stringify(manifest, null, 2)}\n`);
}

function buildHostPermissions(existing) {
  return unique([
    ...existing,
    ...(localAppPlan?.manifestPermissions?.host_permissions || []),
  ]);
}

function buildOptionalPermissions(existing) {
  return unique([
    ...existing,
    ...(localAppPlan?.manifestPermissions?.optional_permissions || []),
  ]);
}

function buildWebAccessibleResources(existing) {
  const resources = unique([
    "brand/*",
    "icons/*",
    "remilia-fonts/*",
    "features/*.js",
    ...firstPartyApps.flatMap((app) => app.assets || []).filter((dir) => !nonWebAccessibleAssetDirs.has(dir)).map((dir) => `${dir}/*`),
    ...firstPartyApps.flatMap((app) => app.requiredOutputs || []),
  ]);
  if (appEnabled("post-reading")) {
    resources.push("ocr/*");
    if (tesseractCoreDir) resources.push("ocr/core/*");
    if (existsSync("node_modules/@tesseract.js-data/eng/4.0.0/eng.traineddata.gz")) resources.push("ocr/lang/*");
  }
  if (appEnabled("music")) resources.push("features/*.wasm");
  if (appEnabled("miladymaxxer")) resources.push("features/*.wasm", "worker.js", "ort/*", "generated/*", "models/*", "milady-logo.png");
  const localResources = localAppPlan?.webAccessibleAssets?.flatMap((entry) => entry.resources || []) || [];
  return [{
    resources: unique(resources),
    matches: webAccessibleMatches,
  }, ...(localResources.length > 0 ? [{
    resources: unique(localResources),
    matches: webAccessibleMatches,
  }] : [])];
}

async function buildOrWatch(options) {
  if (!watch) {
    await esbuild.build(options);
    return;
  }
  const context = await esbuild.context(options);
  await context.watch();
  contexts.push(context);
}

async function pruneSourceMaps(dir) {
  if (!existsSync(dir)) return;
  const entries = await readdir(dir, { withFileTypes: true });
  await Promise.all(entries.map(async (entry) => {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      await pruneSourceMaps(path);
      return;
    }
    if (entry.isFile() && entry.name.endsWith(".map")) {
      await rm(path, { force: true });
    }
  }));
}

async function mirrorChromiumRootOutput() {
  if (target !== "chromium" || watch || localAppPlan) return;
  const rootOutDir = "dist";
  const entries = [
    "background.js",
    "content.js",
    "manifest.json",
    "milady-logo.png",
    "ocr.html",
    "ocrHost.js",
    "popup.css",
    "popup.html",
    "popup.js",
    "wikiFrame.js",
    "worker.js",
    "features",
    ...unique([
      ...commonAssetDirs,
      ...firstPartyApps.flatMap((app) => app.assets || []),
      ...userDownloadAssetDirs,
      ...firstPartyApps.flatMap((app) => (app.css || []).map((sheet) => sheet.targetDir)),
    ]),
  ];
  for (const entry of entries) {
    await rm(`${rootOutDir}/${entry}`, { recursive: true, force: true });
    if (existsSync(`${outDir}/${entry}`)) {
      await cp(`${outDir}/${entry}`, `${rootOutDir}/${entry}`, { recursive: true });
    }
  }
}

async function copyLocalPackageAssets() {
  if (!localAppPlan) return;
  const resolvedOutDir = resolve(outDir);
  for (const item of localAppPlan.packageCopyMap || []) {
    const packageRoot = resolve(item.fromRoot);
    const from = resolve(packageRoot, item.from);
    const to = resolve(resolvedOutDir, item.to);
    assertResolvedInside(packageRoot, from, `Local package source escapes package root: ${item.packageId} ${item.from}`);
    assertResolvedInside(resolvedOutDir, to, `Local package destination escapes output directory: ${item.packageId} ${item.to}`);
    if (!existsSync(from)) throw new Error(`Local package file missing: ${item.packageId} ${item.from}`);
    const realPackageRoot = await realpath(packageRoot);
    const info = await lstat(from);
    if (!info.isFile()) throw new Error(`Local package file is not a regular file: ${item.packageId} ${item.from}`);
    const realFrom = await realpath(from);
    assertResolvedInside(realPackageRoot, realFrom, `Local package source escapes package root: ${item.packageId} ${item.from}`);
    const actualSha256 = await sha256File(realFrom);
    if (actualSha256 !== item.sha256) {
      throw new Error(`Local package file hash mismatch: ${item.packageId} ${item.from}`);
    }
    await mkdir(dirname(to), { recursive: true });
    await copyFile(realFrom, to);
  }
  await writeFile(`${outDir}/local-app-composition.json`, `${JSON.stringify({
    schemaVersion: localAppPlan.schemaVersion,
    composer: localAppPlan.composer,
    sdkVersion: localAppPlan.sdkVersion,
    selectedPackageIds: localAppPlan.selectedPackageIds,
    packageSources: localAppPlan.packageSources,
    diagnostics: localAppPlan.diagnostics,
    privacy: localAppPlan.privacy,
    settings: localAppPlan.settings,
  }, null, 2)}\n`);
}

function assertSafePlanRelativePath(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Local app plan ${label} must be a non-empty relative path.`);
  }
  const normalizedValue = value.replaceAll("\\", "/");
  if (isAbsolute(value) || posix.isAbsolute(normalizedValue) || /^[A-Za-z]:/.test(normalizedValue)) {
    throw new Error(`Local app plan ${label} must be a relative path.`);
  }
  const parts = normalizedValue.split("/");
  if (parts.includes("..") || parts.includes("")) {
    throw new Error(`Local app plan ${label} must not traverse directories.`);
  }
  const normalized = posix.normalize(normalizedValue);
  if (normalized === "." || normalized.startsWith("../") || normalized === "..") {
    throw new Error(`Local app plan ${label} must not traverse directories.`);
  }
  return normalized;
}

function assertSafePackageId(value, label) {
  if (typeof value !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value)) {
    throw new Error(`Local app plan ${label} must be a safe package identifier.`);
  }
  return value;
}

function assertLocalPackageTarget(packageId, value, label) {
  const target = assertSafePlanRelativePath(value, label);
  const expectedPrefix = `local-apps/${packageId}/`;
  if (!target.startsWith(expectedPrefix)) {
    throw new Error(`Local app plan ${label} must stay inside ${expectedPrefix}.`);
  }
  return target;
}

function assertValidSha256(value, label) {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`Local app plan ${label} is missing a SHA-256 file hash.`);
  }
}

function assertResolvedInside(root, candidate, message) {
  const relativePath = relative(root, candidate);
  if (relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath))) return;
  throw new Error(message);
}

async function sha256File(filePath) {
  return createHash("sha256").update(await readFile(filePath)).digest("hex");
}

await buildOrWatch({
  ...common,
  entryPoints: {
    content: source("src/extension/content/index.ts"),
    background: source("src/extension/background/index.ts"),
    popup: source("src/extension/popup/index.ts"),
    wikiFrame: source("src/extension/frames/wiki-frame.ts"),
  },
  outdir: outDir,
  format: "iife",
});

await buildOrWatch({
  ...common,
  entryPoints: Object.fromEntries(sourceBuiltApps.map((app) => [app.entryName, source(app.entryPoint)])),
  outdir: outDir,
  format: "esm",
});

await buildOrWatch({
  ...common,
  entryPoints: Object.fromEntries([
    appEnabled("miladymaxxer") ? ["worker", source("src/apps/milady-maxxer/worker.ts")] : null,
    appEnabled("post-reading") ? ["ocrHost", source("src/extension/frames/ocr-host.ts")] : null,
  ].filter(Boolean)),
  outdir: outDir,
  format: "iife",
});

if (watch) {
  console.log(`Watching milXdy ${target}/${buildProfile} extension files with ${contexts.length} build contexts...`);
}

if (!watch) {
  const required = [
    `${outDir}/content.js`,
    `${outDir}/wikiFrame.js`,
    ...sourceBuiltApps.map((app) => `${outDir}/${app.entryName}.js`),
    ...firstPartyApps.flatMap((app) => (app.requiredOutputs || []).map((file) => `${outDir}/${file}`)),
    ...(localAppPlan?.packageCopyMap || []).map((item) => `${outDir}/${item.to}`),
  ];
  const missing = required.filter((file) => !existsSync(file));
  if (missing.length > 0) {
    throw new Error(`Missing split bundle output: ${missing.join(", ")}`);
  }
  const bootstrap = await readFile(`${outDir}/content.js`, "utf8");
  const forbiddenBootstrapNeedles = ["tesseract", "onnxruntime", "wiki-index.generated", "createScoreBadge", "mountBeetolGame"];
  const foundNeedles = forbiddenBootstrapNeedles.filter((needle) => bootstrap.toLowerCase().includes(needle.toLowerCase()));
  if (foundNeedles.length > 0) {
    throw new Error(`Content bootstrap contains feature implementation strings: ${foundNeedles.join(", ")}`);
  }
  await mirrorChromiumRootOutput();
  if (localAppPlan) printLocalAppBuildSummary();
}

function printLocalAppBuildSummary() {
  console.log("Local app custom Chromium build emitted.");
  console.log(`  plan: ${localAppPlanPath}`);
  console.log(`  output: ${outDir}`);
  console.log(`  packages: ${(localAppPlan.selectedPackageIds || []).join(", ") || "none"}`);
  const addedHosts = localAppPlan.manifestPermissions?.addedHostPermissions || [];
  if (addedHosts.length > 0) {
    console.log("  added host permissions:");
    for (const host of addedHosts) console.log(`  - ${host}`);
  }
  const consentPackages = (localAppPlan.privacy || []).filter((entry) => entry.privacy?.consentRequired).map((entry) => entry.packageId);
  if (consentPackages.length > 0) {
    console.log(`  consent required: ${consentPackages.join(", ")}`);
  }
  console.log(`Load ${outDir} as an unpacked extension in Chromium developer mode.`);
}
