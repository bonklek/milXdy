import { existsSync, lstatSync, readFileSync, realpathSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { inflateRawSync } from "node:zlib";
import { assertSafeGeneratedOutputDir } from "../build/generated-output-dir-safety.mjs";
import { webAccessibleMatches } from "../release/release-builds.mjs";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const currentSdkVersion = packageJson.appSdkVersion;
if (typeof currentSdkVersion !== "string" || !/^\d+\.\d+\.\d+(?:[-+][A-Za-z0-9.-]+)?$/.test(currentSdkVersion)) {
  throw new Error("package.json appSdkVersion must declare the local app SDK version.");
}
const defaultLocalPackagesDir = "local-app-packages";
const defaultPackagesDir = "examples/packages/first-party-replacements";
const defaultOutDir = "tmp/local-app-composition";
const args = process.argv.slice(2);
const outDir = assertSafeGeneratedOutputDir(readArg("--out-dir") ?? defaultOutDir, "Local app composer --out-dir");
const buildOutputDir = assertSafeGeneratedOutputDir(readArg("--build-output-dir") ?? "dist/chromium-local-apps", "Local app composer --build-output-dir");
const requestedBuildId = readArg("--build-id");
if (requestedBuildId && !/^[a-f0-9]{24}$/u.test(requestedBuildId)) {
  throw new Error("Local app composer --build-id must be 24 lowercase hexadecimal characters.");
}
const planOut = readArg("--plan-out") ?? path.join(outDir, "build-plan.json");
const packagesDirs = readRepeatedArg("--packages-dir");
const legacyPackagesRoot = readArg("--packages-root");
const clean = !args.includes("--no-clean");
const jsonOnly = args.includes("--json");
const checkOnly = args.includes("--check");
const allowLocalReview = args.includes("--allow-local-review");
const acknowledgePackageConsent = args.includes("--acknowledge-package-consent");
const acknowledgeFirstPartyReplacement = args.includes("--acknowledge-first-party-replacement");
const allowSensitivePackageApis = args.includes("--allow-sensitive-package-apis");
const previewTrustRequirements = args.includes("--preview-trust-requirements");
const stageExternalPackages = args.includes("--stage-external-packages");
const requestedPackages = [
  ...readRepeatedArg("--package"),
  ...args.filter((arg) => !arg.startsWith("--")),
];
const extractionDir = checkOnly
  ? await mkdtemp(path.join(os.tmpdir(), "milxdy-local-app-composer-"))
  : path.join(outDir, "extracted");

const registryApps = JSON.parse(await readFile("src/platform/app-sdk/first-party-apps.json", "utf8"));
const publicManifest = JSON.parse(await readFile("assets/extension/manifest.json", "utf8"));
const firstPartyReplacementPolicy = JSON.parse(await readFile("scripts/packages/local-app-first-party-replacements.json", "utf8"));
const firstPartyById = new Map(registryApps.map((app) => [app.id, app]));
const firstPartyReplacementPolicyById = new Map((firstPartyReplacementPolicy.replacements || []).map((item) => [item.id, item]));
const baseHostPermissions = publicManifest.host_permissions ?? [];
const builtInStorageKeys = builtInRegistryStorageKeys(registryApps);

const validPackageKinds = new Set(["app", "feature", "theme"]);
const validAssetKinds = new Set(["icon", "image", "style", "font", "audio", "worker", "wasm", "html", "other"]);
const validReviewStatuses = new Set(["local", "reviewed", "blocked"]);
const executableContentEntryExtensions = new Set([".js", ".mjs"]);
const scannableTextExtensions = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx", ".html", ".htm", ".css"]);
const forbiddenManifestFields = new Set([
  "available",
  "unavailableReason",
  "isEnabled",
  "setEnabled",
  "entryName",
  "entryPoint",
  "assets",
  "requiredOutputs",
]);
const forbiddenCssFields = new Set(["source", "target", "targetDir"]);
const supportedExternalHandoffAdapters = new Map([
  ["remilia-maker", {
    host: "https://maker.remilia.org/*",
    targets: new Set(["milady", "remilio", "bonkler", "kagami"]),
  }],
]);
const sensitiveStorageNeedles = [
  "auth",
  "cache",
  "cookie",
  "credential",
  "diagnostic",
  "file",
  "folder",
  "key",
  "path",
  "private",
  "queue",
  "secret",
  "session",
  "token",
];
const sensitiveGeneratedStorageNeedles = [
  "accesstoken",
  "auth",
  "apikey",
  "cache",
  "cookie",
  "credential",
  "diagnostic",
  "file",
  "folder",
  "localpath",
  "path",
  "private",
  "queue",
  "secret",
  "session",
  "token",
];
const nonAcknowledgeablePackageApiRuleIds = new Set([
  "chrome-runtime-send-message",
  "chrome-runtime-connect",
  "browser-runtime-send-message",
  "browser-runtime-connect",
  "computed-extension-api-global",
  "computed-extension-api-global-from-decoder",
  "computed-extension-api-global-from-char-code",
  "computed-extension-api-global-from-reflect",
  "computed-runtime-api-property",
]);
const staticSensitiveStringValues = Object.freeze([
  "chrome",
  "browser",
  "runtime",
  "sendMessage",
  "connect",
]);
const sensitivePackageApiRules = [
  {
    id: "chrome-runtime-send-message",
    severity: "error",
    pattern: runtimeApiPattern(globalApiPattern("chrome"), "sendMessage"),
    message: "uses chrome.runtime.sendMessage directly; local packages must use context.sendMessage() so background message authorization can enforce declared message types",
  },
  {
    id: "chrome-runtime-connect",
    severity: "error",
    pattern: runtimeApiPattern(globalApiPattern("chrome"), "connect"),
    message: "uses chrome.runtime.connect directly; port bridges require a reviewed background handler and sender policy",
  },
  {
    id: "browser-runtime-send-message",
    severity: "error",
    pattern: runtimeApiPattern(globalApiPattern("browser"), "sendMessage"),
    message: "uses browser.runtime.sendMessage directly; local packages must use context.sendMessage() so background message authorization can enforce declared message types",
  },
  {
    id: "browser-runtime-connect",
    severity: "error",
    pattern: runtimeApiPattern(globalApiPattern("browser"), "connect"),
    message: "uses browser.runtime.connect directly; port bridges require a reviewed background handler and sender policy",
  },
  {
    id: "extension-runtime-url",
    severity: "warning",
    pattern: runtimeApiPattern("(?:chrome|browser)", "getURL"),
    message: "constructs extension-origin URLs; review web-accessible resources, frame/worker loading, and package asset exposure",
  },
  {
    id: "broad-chrome-api",
    severity: "warning",
    pattern: privilegedNamespacePattern(globalApiPattern("chrome")),
    message: "references a privileged chrome.* API; package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "broad-browser-api",
    severity: "warning",
    pattern: privilegedNamespacePattern(globalApiPattern("browser")),
    message: "references a privileged browser.* API; package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "computed-extension-api-global",
    severity: "error",
    pattern: new RegExp(`\\b(?:[A-Za-z_$][\\w$]*|globalThis|window|self)\\s*\\[\\s*(?:${constructedStringExpressionPattern("chrome")}|${constructedStringExpressionPattern("browser")})\\s*\\]`, "g"),
    message: "constructs chrome/browser globals through computed string access; local package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "computed-extension-api-global-from-decoder",
    severity: "error",
    pattern: new RegExp(`\\b(?:[A-Za-z_$][\\w$]*|globalThis|window|self)${jsTriviaPattern()}\\[${jsTriviaPattern()}(?:${atobStringExpressionPattern("chrome")}|${atobStringExpressionPattern("browser")})${jsTriviaPattern()}\\]`, "g"),
    message: "constructs chrome/browser globals through decoded string access; local package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "computed-extension-api-global-from-char-code",
    severity: "error",
    pattern: new RegExp(`\\b(?:[A-Za-z_$][\\w$]*|globalThis|window|self)\\s*\\[\\s*(?:${charCodeStringExpressionPattern("chrome")}|${charCodeStringExpressionPattern("browser")})\\s*\\]`, "g"),
    message: "constructs chrome/browser globals through character-code string access; local package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "computed-extension-api-global-from-reflect",
    severity: "error",
    pattern: reflectGlobalApiPattern(),
    message: "constructs chrome/browser globals through Reflect.get(); local package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "computed-runtime-api-property",
    severity: "error",
    pattern: new RegExp(`\\[\\s*(?:${constructedStringExpressionPattern("runtime")}|${constructedStringExpressionPattern("sendMessage")}|${constructedStringExpressionPattern("connect")})\\s*\\]`, "g"),
    message: "constructs runtime/sendMessage/connect through computed string access; local package code must not bypass the App SDK capability surface without a reviewed exception",
  },
  {
    id: "unsafe-eval",
    severity: "error",
    pattern: /\beval\s*\(/g,
    message: "uses eval(); local package payloads must not execute dynamically generated code",
  },
  {
    id: "unsafe-new-function",
    severity: "error",
    pattern: /\bnew\s+Function\s*\(/g,
    message: "uses new Function(); local package payloads must not execute dynamically generated code",
  },
  {
    id: "remote-script-loading",
    severity: "error",
    pattern: /(?:<script\b[^>]*\bsrc\s*=\s*["']https?:\/\/|importScripts\s*\(\s*["']https?:\/\/|import\s*\(\s*["']https?:\/\/|\.src\s*=\s*["']https?:\/\/[^"']+\.js\b)/gi,
    message: "loads remote script code; local packages must ship reviewed, declared package files instead",
  },
  {
    id: "dynamic-extension-internals",
    severity: "warning",
    pattern: /\b(?:chrome-extension|moz-extension):\/\//g,
    message: "references extension-origin internals directly; use declared package assets and reviewed platform APIs",
  },
];

if (!checkOnly && clean) await rm(outDir, { recursive: true, force: true });
if (!checkOnly) await mkdir(outDir, { recursive: true });
const packageSources = await resolvePackageSources();
const composition = await composeLocalPackages(packageSources);
if (!checkOnly) await writeOutputs(composition);
if (jsonOnly) {
  console.log(JSON.stringify(composition.report, null, 2));
} else {
  printHumanReport(composition.report);
}
if (checkOnly) await rm(extractionDir, { recursive: true, force: true });
if (composition.report.summary.rejected > 0 || composition.report.diagnostics.errors.length > 0) process.exit(1);

async function composeLocalPackages(sources) {
  const discovered = [];
  const accepted = [];
  const rejected = [];
  const warnings = [];
  const errors = [];
  const packageRecords = [];

  for (const source of sources.sort(compareSources)) {
    const root = normalizeInputPath(source.root);
    const manifestPath = path.join(root, "milxdy.app.json");
    const discoveredRecord = {
      input: source.input,
      root,
      sourceType: source.type,
      archivePath: source.archivePath,
      archiveSha256: source.archiveSha256,
      manifestPath: normalizePosix(manifestPath),
      status: "discovered",
    };
    discovered.push(discoveredRecord);
    if (source.error) {
      rejected.push({ root, input: source.input, reason: "invalid-package-source", diagnostics: [source.error] });
      continue;
    }
    if (!existsSync(manifestPath)) {
      rejected.push({ root, reason: "missing-manifest", diagnostics: [`${root}: missing milxdy.app.json`] });
      continue;
    }

    let manifest;
    try {
      manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    } catch (error) {
      rejected.push({ root, reason: "invalid-json", diagnostics: [`${root}: unable to parse milxdy.app.json: ${error.message}`] });
      continue;
    }

    const record = await analyzePackage(source, manifest);
    packageRecords.push(record);
    if (record.errors.length > 0) {
      rejected.push({ id: record.id, root, reason: record.trustErrors.length > 0 ? "package-trust-gate" : "package-validation", diagnostics: record.errors });
      continue;
    }
    accepted.push(record);
  }

  const conflictDiagnostics = detectPackageSetConflicts(accepted);
  errors.push(...conflictDiagnostics.errors);
  warnings.push(...conflictDiagnostics.warnings);
  for (const record of accepted) {
    warnings.push(...record.warnings);
  }

  const acceptedWithoutSetConflicts = errors.length === 0 ? accepted : [];
  if (stageExternalPackages && acceptedWithoutSetConflicts.length > 0) {
    await stageExternalPackageSources(acceptedWithoutSetConflicts);
  }
  const generated = buildGeneratedPlan(acceptedWithoutSetConflicts);
  const report = {
    schemaVersion: 1,
    composer: "milxdy-local-app-composer",
    sdk: {
      currentVersion: currentSdkVersion,
      acceptedRange: `<=${currentSdkVersion}`,
    },
    packageRoots: stageExternalPackages ? redactExternalPackageRoots(discovered) : discovered,
    summary: {
      discovered: discovered.length,
      accepted: acceptedWithoutSetConflicts.length,
      rejected: rejected.length + (errors.length > 0 ? accepted.length : 0),
      warned: warnings.length,
      packageKinds: countBy(accepted, (record) => record.manifest.packageKind),
      hostPermissions: unique(accepted.flatMap((record) => record.permissions.hosts)).sort(),
      optionalPermissions: unique(accepted.flatMap((record) => record.permissions.optional)).sort(),
      webAccessibleAssets: unique(accepted.flatMap((record) => record.webAccessibleAssets.map((asset) => asset.target))).sort(),
      requiredAcknowledgements: packageRecords.reduce((count, record) => count + record.requiredAcknowledgements.length, 0),
    },
    acceptedPackages: acceptedWithoutSetConflicts.map(toReportPackage),
    rejectedPackages: [
      ...rejected,
      ...(errors.length > 0 ? accepted.map((record) => ({
        id: record.id,
        root: record.root,
        reason: "package-set-conflict",
        diagnostics: errors,
      })) : []),
    ],
    requiredAcknowledgements: packageRecords.flatMap((record) => record.requiredAcknowledgements),
    trustDecisions: packageRecords.map((record) => record.trustDecision),
    diagnostics: {
      warnings,
      errors,
    },
  };

  return {
    report,
    buildPlan: generated.buildPlan,
    apps: generated.apps,
    manifestPermissions: generated.manifestPermissions,
    webAccessibleAssets: generated.webAccessibleAssets,
  };
}

async function stageExternalPackageSources(records) {
  for (const record of records) {
    if (!isExternalPackageRoot(record.root) && !isExternalPackageRoot(record.source.input)) continue;
    const stageRoot = path.resolve(outDir, "staged-packages", `${record.id}-${record.contentSha256.slice(0, 16)}`);
    await rm(stageRoot, { recursive: true, force: true });
    await mkdir(stageRoot, { recursive: true });
    const stagedFiles = ["milxdy.app.json", ...record.files.map((file) => file.source)].sort();
    for (const relativePath of stagedFiles) {
      const sourcePath = path.resolve(record.root, relativePath);
      const targetPath = resolveInside(stageRoot, relativePath);
      const expectedHash = relativePath === "milxdy.app.json"
        ? record.manifestSha256
        : record.files.find((file) => file.source === relativePath)?.sha256;
      if (!expectedHash || sha256File(sourcePath) !== expectedHash) {
        throw new Error(`${record.id}: validated package file changed before staging: ${relativePath}`);
      }
      await mkdir(path.dirname(targetPath), { recursive: true });
      await copyFile(sourcePath, targetPath);
    }
    record.compositionRoot = normalizeWorkspaceRelativePath(stageRoot);
    record.compositionSourceType = "staged-external";
  }
}

function isExternalPackageRoot(root) {
  const relativePath = path.relative(process.cwd(), path.resolve(root));
  return relativePath.startsWith("..") || path.isAbsolute(relativePath);
}

function redactExternalPackageRoots(sources) {
  return sources.map((source) => {
    if (!isExternalPackageRoot(source.root) && !isExternalPackageRoot(source.input)) return source;
    return {
      type: "staged-external",
      status: source.error ? "rejected" : "staged",
    };
  });
}

async function resolvePackageSources() {
  const sources = [];
  const dirs = packagesDirs.length > 0
    ? packagesDirs
    : legacyPackagesRoot
      ? [legacyPackagesRoot]
      : requestedPackages.length === 0
        ? [existsSync(defaultLocalPackagesDir) ? defaultLocalPackagesDir : defaultPackagesDir]
        : [];

  for (const packagesDir of dirs) {
    sources.push(...await discoverPackageSources(packagesDir));
  }
  for (const requested of requestedPackages) {
    sources.push(await sourceFromInput(requested));
  }
  return dedupeSources(sources);
}

async function discoverPackageSources(packagesDir) {
  if (!existsSync(packagesDir)) return [];
  const entries = await readdir(packagesDir, { withFileTypes: true });
  const sources = [];
  for (const entry of entries) {
    if (!entry.isDirectory() && !(entry.isFile() && entry.name.toLowerCase().endsWith(".zip"))) continue;
    sources.push(await sourceFromInput(path.join(packagesDir, entry.name)));
  }
  return sources;
}

async function sourceFromInput(input) {
  const normalizedInput = normalizeInputPath(input);
  if (!existsSync(input)) {
    return {
      type: "missing",
      input: normalizedInput,
      root: normalizedInput,
      error: `${normalizedInput}: package source does not exist`,
    };
  }
  const { stat } = await import("node:fs/promises");
  const info = await stat(input);
  if (info.isDirectory()) {
    const root = normalizeWorkspaceRelativePath(input);
    return {
      type: "folder",
      input: normalizedInput,
      root,
      realRoot: normalizeInputPath(await realpath(input)),
    };
  }
  if (info.isFile() && input.toLowerCase().endsWith(".zip")) return extractZipSource(input);
  return {
    type: "unsupported",
    input: normalizedInput,
    root: normalizedInput,
    error: `${normalizedInput}: package source must be a folder or .zip archive`,
  };
}

async function extractZipSource(archivePath) {
  const normalizedInput = normalizeInputPath(archivePath);
  try {
    const zip = await readFile(archivePath);
    const archiveSha256 = sha256Buffer(zip);
    const entries = listZipEntries(zip);
    validateZipPackageEntries(normalizedInput, entries);
    const root = path.join(extractionDir, `${safeArchiveStem(path.basename(archivePath))}-${archiveSha256.slice(0, 12)}`);
    await mkdir(root, { recursive: true });
    for (const entry of entries) {
      const outputPath = resolveInside(root, entry.fileName);
      await mkdir(path.dirname(outputPath), { recursive: true });
      await writeFile(outputPath, readZipEntryBuffer(zip, entry));
    }
    return {
      type: "zip",
      input: normalizedInput,
      root: normalizeInputPath(root),
      archivePath: normalizedInput,
      archiveSha256,
      entries: entries.map((entry) => entry.fileName).sort(),
    };
  } catch (error) {
    return {
      type: "zip",
      input: normalizedInput,
      root: normalizedInput,
      archivePath: normalizedInput,
      error: `${normalizedInput}: ${error.message}`,
    };
  }
}

async function analyzePackage(source, manifest) {
  const root = source.root;
  const id = manifest.id || path.basename(root);
  const packageIdSafe = isSafePackageId(id);
  const errors = [];
  const warnings = [];
  const files = [];
  const webAccessibleAssets = [];

  for (const field of ["manifestVersion", "id", "name", "version", "description", "packageKind", "sdk", "contentEntry", "defaultEnabled", "storageKeys", "surfaces", "cost", "loadTriggers", "hub", "privacy", "package"]) {
    if (!hasOwn(manifest, field)) errors.push(`${id}: missing required local package field ${field}`);
  }
  for (const field of Object.keys(manifest)) {
    if (forbiddenManifestFields.has(field)) errors.push(`${id}: local package manifest must not include first-party runtime/build field ${field}`);
  }
  if (manifest.manifestVersion !== 1) errors.push(`${id}: manifestVersion must be 1`);
  if (!packageIdSafe) errors.push(`${id}: local package id must be a safe package identifier`);
  if (!validPackageKinds.has(manifest.packageKind)) errors.push(`${id}: unsupported packageKind ${manifest.packageKind}`);
  if (source.type === "folder" && manifest.id !== path.basename(root)) warnings.push(`${id}: package folder name does not match manifest id; folder packages should be renamed before distribution`);
  if (firstPartyById.has(id)) warnings.push(`${id}: local package declares a built-in app id; replacement requires reviewed status and explicit acknowledgement`);
  verifyNovelPackageEnablement(id, manifest, errors);
  if (!firstPartyById.has(id) && manifest.defaultEnabled === true && packageRequiresExplicitEnablement(manifest)) {
    errors.push(`${id}: novel local packages with host permissions, remote services, background declarations, or consentRequired privacy must set defaultEnabled false`);
  }
  verifyReviewStatus(id, manifest, errors, warnings);
  verifySdk(id, manifest, errors, warnings);
  verifyExecutableContentEntry(id, manifest, errors);
  collectFile(source, manifest.contentEntry, "contentEntry", files, errors);
  for (const sheet of manifest.css || []) {
    for (const field of Object.keys(sheet)) {
      if (forbiddenCssFields.has(field)) errors.push(`${id}: css entry must not include first-party build field ${field}`);
    }
    collectFile(source, sheet.path, `css ${sheet.id || "<unknown>"}`, files, errors);
  }
  for (const asset of manifest.package?.assets || []) {
    if (!validAssetKinds.has(asset.kind)) errors.push(`${id}: package asset ${asset.path} has unsupported kind ${asset.kind}`);
    collectFile(source, asset.path, `asset ${asset.id || asset.path}`, files, errors);
  }
  for (const assetPath of manifest.package?.webAccessibleAssets || []) {
    collectFile(source, assetPath, `webAccessibleAsset ${assetPath}`, files, errors);
  }
  for (const iconPath of dockIconPaths(manifest.dock?.icon)) {
    collectFile(source, iconPath, "dock icon", files, errors);
  }
  for (const iconPath of dockIconPaths(manifest.composerAction?.icon)) {
    collectFile(source, iconPath, "composer action icon", files, errors);
  }
  verifyKindRules(id, manifest, errors);
  verifyComposerAction(id, manifest, errors);
  verifyReplyAction(id, manifest, errors);
  verifyExternalHandoffs(id, manifest, errors);
  verifyPermissionsAndPrivacy(id, manifest, errors);
  verifyBackgroundCapabilities(id, manifest, errors);
  verifyLifecycleExports(id, root, manifest, errors);

  for (const source of unique(files)) {
    if (!packageIdSafe) continue;
    const target = packageOutputPath(id, source);
    const asset = {
      source,
      target,
      kind: assetKindFor(source, manifest),
    };
    if ((manifest.package?.webAccessibleAssets || []).includes(source)) webAccessibleAssets.push(asset);
  }
  const packageFiles = unique(files);
  const contentSha256 = sha256Files(root, packageFiles);
  const manifestSha256 = sha256File(path.join(root, "milxdy.app.json"));
  const packageSha256 = source.archiveSha256 ?? contentSha256;
  const payloadScan = scanPackagePayloads(id, root, packageFiles);
  const trust = evaluatePackageTrust(id, source, manifest, packageFiles, webAccessibleAssets, payloadScan, packageSha256);
  verifySensitivePresetParticipation(id, manifest, errors);
  verifyStorageDeclarations(id, manifest, errors, {
    allowBuiltInStorageKeys: trust.trustDecision.firstPartyReplacementPolicy.allowed && acknowledgeFirstPartyReplacement,
  });
  errors.push(...trust.errors);
  warnings.push(...trust.warnings);

  return {
    id,
    root,
    source,
    manifest,
    errors,
    warnings,
    trustErrors: trust.errors,
    requiredAcknowledgements: trust.requiredAcknowledgements,
    trustDecision: trust.trustDecision,
    payloadScan,
    files: packageFiles.map((filePath) => ({
      source: filePath,
      target: packageIdSafe ? packageOutputPath(id, filePath) : "",
      kind: assetKindFor(filePath, manifest),
      sha256: sha256File(path.join(root, filePath)),
    })),
    contentEntry: {
      source: manifest.contentEntry,
      target: packageIdSafe ? packageOutputPath(id, manifest.contentEntry) : "",
    },
    css: (manifest.css || []).map((sheet) => ({
      id: sheet.id,
      source: sheet.path,
      target: packageIdSafe ? packageOutputPath(id, sheet.path) : "",
    })),
    webAccessibleAssets,
    permissions: {
      hosts: manifest.permissions?.hosts || [],
      optional: manifest.permissions?.optional || [],
      addedHosts: (manifest.permissions?.hosts || []).filter((host) => !baseHostPermissions.includes(host)),
    },
    background: {
      messageTypes: manifest.background?.messageTypes || [],
      services: manifest.background?.services || [],
      handlerStatus: "metadata-only",
    },
    storageOwnership: storageOwnershipFor(manifest),
    siteRoutes: siteRoutesFor(manifest),
    packageSha256,
    contentSha256,
    manifestSha256,
  };
}

function buildGeneratedPlan(records) {
  const localApps = records.map((record) => toGeneratedRegistryApp(record));
  const localById = new Map(localApps.map((app) => [app.id, app]));
  const replacedIds = new Set(localApps.map((app) => app.id).filter((id) => firstPartyById.has(id)));
  const apps = [
    ...registryApps.map((app) => localById.get(app.id) || app),
    ...localApps.filter((app) => !replacedIds.has(app.id)).sort((a, b) => a.id.localeCompare(b.id)),
  ];
  const packageCopyMap = records.flatMap((record) => record.files.map((file) => ({
    packageId: record.id,
    fromRoot: record.compositionRoot || record.root,
    from: file.source,
    to: file.target,
    kind: file.kind,
    sha256: file.sha256,
  }))).sort(compareCopyMap);
  const hostPermissions = unique([
    ...baseHostPermissions,
    ...records.flatMap((record) => record.permissions.hosts),
  ]).sort();
  const webResources = unique([
    ...records.map((record) => record.contentEntry.target),
    ...records.flatMap((record) => record.css.map((sheet) => sheet.target)),
    ...records.flatMap((record) => record.webAccessibleAssets.map((asset) => asset.target)),
  ]).sort();
  const webAccessibleAssets = [{
    resources: webResources,
    matches: webAccessibleMatches,
  }];
  const manifestPermissions = {
    host_permissions: hostPermissions,
    addedHostPermissions: unique(records.flatMap((record) => record.permissions.addedHosts)).sort(),
    optional_permissions: unique(records.flatMap((record) => record.permissions.optional)).sort(),
  };
  const buildFingerprint = records.map((record) => ({
    id: record.id,
    version: record.manifest.version,
    packageSha256: record.packageSha256,
  })).sort((a, b) => a.id.localeCompare(b.id));
  const compositionFingerprint = createHash("sha256")
    .update(JSON.stringify({
      extensionVersion: packageJson.extensionVersion || packageJson.version,
      sdkVersion: currentSdkVersion,
      target: "chromium",
      packages: buildFingerprint,
    }))
    .digest("hex");
  const buildId = requestedBuildId ?? compositionFingerprint.slice(0, 24);
  const buildPlan = {
    schemaVersion: 1,
    composer: "milxdy-local-app-composer",
    sdkVersion: currentSdkVersion,
    target: "chromium",
    outputDir: buildOutputDir,
    buildId,
    compositionFingerprint,
    selectedPackageIds: records.map((record) => record.id).sort(),
    apps,
    packageCopyMap,
    packageSources: records.map((record) => sourceSummary(record)).sort((a, b) => a.packageId.localeCompare(b.packageId)),
    manifestPermissions,
    webAccessibleAssets,
    contentEntries: Object.fromEntries(records.map((record) => [record.id, record.contentEntry])),
    css: records.flatMap((record) => record.css.map((sheet) => ({ packageId: record.id, ...sheet }))).sort((a, b) => `${a.packageId}:${a.id}`.localeCompare(`${b.packageId}:${b.id}`)),
    background: records.map((record) => ({
      packageId: record.id,
      messageTypes: record.background.messageTypes,
      services: record.background.services,
      handlerStatus: record.background.handlerStatus,
    })).sort((a, b) => a.packageId.localeCompare(b.packageId)),
    settings: records.map((record) => ({
      packageId: record.id,
      storageKeys: record.manifest.storageKeys || {},
      settings: (record.manifest.settings || []).map((setting) => ({
        id: setting.id,
        storage: setting.storage,
        presets: setting.presets || [],
      })),
    })).sort((a, b) => a.packageId.localeCompare(b.packageId)),
    privacy: records.map((record) => ({
      packageId: record.id,
      permissions: record.permissions,
      privacy: record.manifest.privacy,
      hub: {
        permissionNotes: record.manifest.hub?.permissionNotes || [],
        dataNotes: record.manifest.hub?.dataNotes || [],
        remoteServices: record.manifest.hub?.remoteServices || [],
        localStorageNotes: record.manifest.hub?.localStorageNotes || [],
        privacyLabels: record.manifest.hub?.privacyLabels || [],
      },
    })).sort((a, b) => a.packageId.localeCompare(b.packageId)),
    diagnostics: records.map((record) => ({
      packageId: record.id,
      label: `${record.manifest.name} ${record.manifest.version}`,
      version: record.manifest.version,
      reviewStatus: record.manifest.review?.status || "local",
      localPackage: true,
      sourceType: record.compositionSourceType || record.source.type,
      packageSha256: record.packageSha256,
      contentSha256: record.contentSha256,
      manifestSha256: record.manifestSha256,
      archiveSha256: record.source.archiveSha256,
      trust: record.trustDecision,
      payloadScan: {
        scannedFiles: record.payloadScan.scannedFiles,
        skippedFiles: record.payloadScan.skippedFiles,
        findings: record.payloadScan.findings,
      },
    })).sort((a, b) => a.packageId.localeCompare(b.packageId)),
  };
  return {
    buildPlan,
    apps,
    manifestPermissions,
    webAccessibleAssets,
  };
}

function toGeneratedRegistryApp(record) {
  const manifest = structuredClone(record.manifest);
  const firstParty = firstPartyById.get(record.id);
  manifest.contentEntry = record.contentEntry.target;
  manifest.css = record.css.map((sheet) => ({
    id: sheet.id,
    path: sheet.target,
  }));
  manifest.dock = rewriteDockIcon(manifest.dock, record.id);
  manifest.package = {
    assets: record.files.map((file) => file.target),
    webAccessibleAssets: record.webAccessibleAssets.map((asset) => asset.target),
  };
  delete manifest.$schema;
  delete manifest.manifestVersion;
  delete manifest.sdk;
  delete manifest.privacy;
  delete manifest.review;
  return {
    ...firstParty,
    ...manifest,
    hostAssetAccess: firstParty
      ? [...(firstParty.assets || []), ...(firstParty.requiredOutputs || [])]
      : undefined,
    entryName: undefined,
    entryPoint: undefined,
    assets: undefined,
    requiredOutputs: undefined,
    localPackage: {
      root: record.compositionRoot || record.root,
      sourceType: record.compositionSourceType || record.source.type,
      reviewStatus: record.manifest.review?.status || "local",
      sourceVersion: record.manifest.version,
      packageSha256: record.packageSha256,
      contentSha256: record.contentSha256,
      manifestSha256: record.manifestSha256,
      archiveSha256: record.source.archiveSha256,
    },
  };
}

function rewriteDockIcon(dock, packageId) {
  if (!dock?.icon) return dock;
  if (typeof dock.icon === "string") return { ...dock, icon: packageOutputPath(packageId, dock.icon) };
  return {
    ...dock,
    icon: Object.fromEntries(Object.entries(dock.icon).map(([key, value]) => [key, packageOutputPath(packageId, value)])),
  };
}

function detectPackageSetConflicts(records) {
  const errors = [];
  const warnings = [];
  collectDuplicate(records, (record) => record.id).forEach(([id, owners]) => {
    errors.push(`duplicate-package-id: ${id} declared by ${owners.map((record) => record.root).join(", ")}`);
  });
  collectDuplicate(records.flatMap((record) => record.background.messageTypes.map((value) => ({ value, record }))), (item) => item.value).forEach(([value, owners]) => {
    errors.push(`duplicate-background-message-type: ${value} declared by ${owners.map((item) => item.record.id).join(", ")}`);
  });
  collectDuplicate(records.flatMap((record) => record.background.services.map((value) => ({ value, record }))), (item) => item.value).forEach(([value, owners]) => {
    errors.push(`duplicate-background-service: ${value} declared by ${owners.map((item) => item.record.id).join(", ")}`);
  });
  for (const [left, right] of pairs(records)) {
    for (const leftType of left.background.messageTypes) {
      for (const rightType of right.background.messageTypes) {
        if (messagePatternsOverlap(leftType, rightType)) errors.push(`overlapping-background-message-type: ${left.id}:${leftType} overlaps ${right.id}:${rightType}`);
      }
    }
  }
  for (const record of records) {
    for (const app of registryApps) {
      if (isAcknowledgedFirstPartyReplacement(record, app)) continue;
      for (const localType of record.background.messageTypes) {
        for (const builtInType of app.background?.messageTypes || []) {
          if (messagePatternsOverlap(localType, builtInType)) {
            errors.push(`built-in-background-message-type-conflict: ${record.id}:${localType} overlaps built-in ${app.id}:${builtInType}`);
          }
        }
      }
      for (const localService of record.background.services) {
        if ((app.background?.services || []).includes(localService)) {
          errors.push(`built-in-background-service-conflict: ${record.id}:${localService} overlaps built-in ${app.id}:${localService}`);
        }
      }
    }
  }
  collectDuplicate(records.flatMap((record) => record.webAccessibleAssets.map((asset) => ({ value: asset.target, record }))), (item) => item.value).forEach(([value, owners]) => {
    errors.push(`web-accessible-asset-collision: ${value} declared by ${owners.map((item) => item.record.id).join(", ")}`);
  });
  collectDuplicate(records.flatMap((record) => (record.manifest.package?.assets || []).map((asset) => ({ value: asset.id, record })).filter((item) => item.value)), (item) => item.value).forEach(([value, owners]) => {
    errors.push(`package-asset-id-collision: ${value} declared by ${owners.map((item) => item.record.id).join(", ")}`);
  });
  for (const [left, right] of pairs(records)) {
    for (const leftStorage of left.storageOwnership) {
      for (const rightStorage of right.storageOwnership) {
        if (storageConflicts(leftStorage, rightStorage)) {
          errors.push(`storage-key-ownership-conflict: ${left.id}:${leftStorage.area}.${leftStorage.key}${propertyLabel(leftStorage)} conflicts with ${right.id}:${rightStorage.area}.${rightStorage.key}${propertyLabel(rightStorage)}`);
        }
      }
    }
    for (const leftRoute of left.siteRoutes) {
      for (const rightRoute of right.siteRoutes) {
        if (siteRoutesConflict(leftRoute, rightRoute)) errors.push(`site-route-conflict: ${left.id}:${routeLabel(leftRoute)} conflicts with ${right.id}:${routeLabel(rightRoute)}`);
      }
    }
  }
  const appChromeOverrides = records.flatMap((record) => (record.manifest.settings || [])
    .filter((setting) => setting.storage?.key === "milxdy.settings.visualTheme" && setting.storage?.property === "appWindowStyle")
    .map((setting) => ({ record, setting })));
  if (appChromeOverrides.length > 1) {
    errors.push(`app-chrome-override-conflict: ${appChromeOverrides.map(({ record, setting }) => `${record.id}:${setting.id}`).join(", ")} share milxdy.settings.visualTheme.appWindowStyle without deterministic precedence`);
  }
  if (records.some((record) => record.permissions.addedHosts.length > 0)) {
    warnings.push("host-permission-expansion: generated manifest adds host permissions; review composition-report.json before installing the custom build");
  }
  return { errors: unique(errors), warnings: unique(warnings) };
}

function isAcknowledgedFirstPartyReplacement(record, app) {
  return record.id === app.id && acknowledgeFirstPartyReplacement;
}

function verifySdk(id, manifest, errors, warnings) {
  if (!manifest.sdk || typeof manifest.sdk.minVersion !== "string") {
    errors.push(`${id}: sdk.minVersion is required`);
    return;
  }
  if (compareVersions(manifest.sdk.minVersion, currentSdkVersion) > 0) errors.push(`${id}: sdk.minVersion ${manifest.sdk.minVersion} is newer than composer SDK ${currentSdkVersion}`);
  if (manifest.sdk.targetVersion && manifest.sdk.targetVersion !== currentSdkVersion) warnings.push(`${id}: sdk.targetVersion ${manifest.sdk.targetVersion} differs from composer SDK ${currentSdkVersion}`);
}

function verifyKindRules(id, manifest, errors) {
  if (manifest.packageKind === "feature") {
    if (manifest.dock) errors.push(`${id}: feature packages must not declare dock metadata`);
    if (manifest.hub?.rail?.supported) errors.push(`${id}: feature packages must not support rail pinning`);
  }
  if (manifest.packageKind === "app" && manifest.hub?.rail?.supported && !manifest.dock?.label) {
    errors.push(`${id}: rail-supported app packages must declare dock metadata`);
  }
  if (manifest.packageKind === "theme") {
    if ((manifest.surfaces || []).length > 0) errors.push(`${id}: theme packages must not declare runtime surfaces`);
    if (manifest.permissions?.hosts?.length > 0) errors.push(`${id}: theme packages must not request host permissions`);
    if (manifest.background) errors.push(`${id}: theme packages must not declare background services`);
  }
}

function verifyComposerAction(id, manifest, errors) {
  const action = manifest.composerAction;
  if (!action) return;
  if (!action.label || typeof action.label !== "string") errors.push(`${id}: composerAction requires a label`);
  if (action.presentation !== "anchoredPanel") errors.push(`${id}: composerAction presentation must be anchoredPanel`);
  if (!manifest.loadTriggers?.includes("userAction")) errors.push(`${id}: composerAction packages must declare the userAction load trigger`);
}

function verifyReplyAction(id, manifest, errors) {
  const action = manifest.replyAction;
  if (!action) return;
  if (!manifest.loadTriggers?.includes("userAction")) errors.push(`${id}: replyAction packages must declare the userAction load trigger`);
  if (!manifest.surfaces?.includes("replyAction")) errors.push(`${id}: replyAction packages must declare the replyAction surface`);
  const templates = action.templates;
  if (!Array.isArray(templates) || templates.length === 0 || templates.length > 6) {
    errors.push(`${id}: replyAction requires between one and six templates`);
    return;
  }
  const ids = new Set();
  for (const template of templates) {
    if (!template?.id || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(template.id) || ids.has(template.id)) errors.push(`${id}: replyAction template ids must be unique safe identifiers`);
    ids.add(template?.id);
    if (!template?.label || typeof template.label !== "string") errors.push(`${id}: replyAction templates require a label`);
    const hasText = typeof template?.text === "string";
    const hasStorageKey = typeof template?.storageKey === "string" && template.storageKey.length > 0;
    if (hasText === hasStorageKey) errors.push(`${id}: replyAction template must declare exactly one of text or storageKey`);
    if (hasStorageKey && !Object.values(manifest.storageKeys || {}).flat().includes(template.storageKey)) errors.push(`${id}: replyAction storageKey must be declared in storageKeys`);
    if (template.sendAfterInsert !== undefined && typeof template.sendAfterInsert !== "boolean") errors.push(`${id}: replyAction sendAfterInsert must be boolean when declared`);
  }
}

function verifyExternalHandoffs(id, manifest, errors) {
  const handoffs = manifest.externalHandoffs;
  if (!handoffs) return;
  if (!manifest.composerAction || !manifest.surfaces?.includes("composerAction")) {
    errors.push(`${id}: externalHandoffs require the composerAction surface`);
  }
  if (!manifest.loadTriggers?.includes("userAction")) {
    errors.push(`${id}: externalHandoffs require the userAction load trigger`);
  }
  if (!Array.isArray(handoffs) || handoffs.length === 0 || handoffs.length > 8) {
    errors.push(`${id}: externalHandoffs require between one and eight declarations`);
    return;
  }
  const ids = new Set();
  for (const handoff of handoffs) {
    if (!handoff?.id || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(handoff.id) || ids.has(handoff.id)) {
      errors.push(`${id}: externalHandoff ids must be unique safe identifiers`);
    }
    ids.add(handoff?.id);
    if (!handoff?.label || typeof handoff.label !== "string") errors.push(`${id}: externalHandoff labels are required`);
    const adapter = supportedExternalHandoffAdapters.get(handoff?.adapter);
    if (!adapter) {
      errors.push(`${id}: externalHandoff adapter is not a reviewed host adapter`);
      continue;
    }
    if (!adapter.targets.has(handoff?.target)) errors.push(`${id}: externalHandoff target is not supported by ${handoff.adapter}`);
    if (!(manifest.permissions?.hosts || []).includes(adapter.host)) {
      errors.push(`${id}: externalHandoff ${handoff.id} must declare host permission ${adapter.host}`);
    }
  }
  if (!(manifest.privacy?.remoteServices || []).length) {
    errors.push(`${id}: externalHandoffs require privacy.remoteServices disclosure`);
  }
  if (manifest.privacy?.consentRequired !== true) {
    errors.push(`${id}: externalHandoffs require consent before enablement`);
  }
  if ((manifest.background?.messageTypes || []).some((type) => type === "milxdy:externalHandoff")) {
    errors.push(`${id}: externalHandoffs must use the host callback, not declare the host handoff message type`);
  }
}

function verifyPermissionsAndPrivacy(id, manifest, errors) {
  const hosts = manifest.permissions?.hosts || [];
  const optional = manifest.permissions?.optional || [];
  const adapterHosts = new Set((manifest.externalHandoffs || []).flatMap((handoff) => {
    const adapter = supportedExternalHandoffAdapters.get(handoff?.adapter);
    return adapter ? [adapter.host] : [];
  }));
  const permissionNotes = [
    ...(manifest.hub?.permissionNotes || []),
    ...(manifest.privacy?.permissionNotes || []),
  ];
  if ((hosts.length > 0 || optional.length > 0) && permissionNotes.length === 0) {
    errors.push(`${id}: host permission expansion requires hub/privacy permission notes`);
  }
  for (const host of hosts) {
    if (!validSiteHostPattern(host)) {
      errors.push(`${id}: invalid permission host pattern ${host}; expected http(s) or wss origin pattern ending in /* without wildcards`);
      continue;
    }
    // A host-owned external adapter is not a package content-script scope.
    // Requiring one would incorrectly imply package code runs on that site.
    if (!adapterHosts.has(host) && !manifest.siteScopes?.some((scope) => scope.hosts?.includes(host))) {
      errors.push(`${id}: permission host ${host} must be represented by a matching site scope host`);
    }
  }
  for (const scope of manifest.siteScopes || []) {
    for (const host of scope.hosts || []) {
      if (!validSiteHostPattern(host)) {
        errors.push(`${id}: invalid site scope host pattern ${host}; expected http(s) or wss origin pattern ending in /* without wildcards`);
      }
    }
  }
  if ((hosts.length > 0 || manifest.privacy?.remoteServices?.length > 0) && manifest.privacy?.consentRequired !== true) {
    errors.push(`${id}: network/permission package must require consent before enablement`);
  }
}

function validSiteHostPattern(value) {
  if (typeof value !== "string" || !/^(https?|wss):\/\/[^/*\s/?#@:]+(?::[0-9]+)?\/\*$/.test(value)) return false;
  const originText = value.slice(0, -2);
  let parsed;
  try {
    parsed = new URL(originText);
  } catch {
    return false;
  }
  if (!["http:", "https:", "wss:"].includes(parsed.protocol)) return false;
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return false;
  if (!parsed.hostname || parsed.hostname.includes("*")) return false;
  return parsed.origin === originText;
}

function packageRequiresExplicitEnablement(manifest) {
  return manifest.privacy?.consentRequired === true
    || (manifest.permissions?.hosts || []).length > 0
    || (manifest.permissions?.optional || []).length > 0
    || (manifest.background?.messageTypes || []).length > 0
    || (manifest.background?.services || []).length > 0
    || (manifest.privacy?.remoteServices || []).length > 0;
}

function verifyBackgroundCapabilities(id, manifest, errors) {
  const messageTypes = manifest.background?.messageTypes || [];
  const services = manifest.background?.services || [];
  for (const field of Object.keys(manifest.background || {})) {
    if (field !== "messageTypes" && field !== "services") {
      errors.push(`${id}: background.${field} is unsupported for local packages; background declarations are metadata-only and do not create handlers`);
    }
  }
  for (const type of messageTypes) {
    if (!validBackgroundMessagePattern(type)) errors.push(`${id}: background message type must be exact namespace:action or trailing namespace:* wildcard: ${type}`);
    else if (!backgroundMessageOwnedByPackage(id, type)) errors.push(`${id}: background message type ${type} must use the package-owned namespace ${id}:*`);
  }
  if (new Set(messageTypes).size !== messageTypes.length) errors.push(`${id}: duplicate background message type declaration`);
  if (services.length > 0) {
    errors.push(`${id}: background.services is not supported for local packages yet; declare no services until package-owned background handlers are implemented`);
  }
  if (messageTypes.length === 0 && services.length === 0) return;
  if (!Array.isArray(manifest.privacy?.permissionNotes) || manifest.privacy.permissionNotes.length === 0) {
    errors.push(`${id}: background capabilities require privacy.permissionNotes review disclosure`);
  }
  if (manifest.privacy?.consentRequired !== true) {
    errors.push(`${id}: background capabilities require consent before enablement`);
  }
}

function validBackgroundMessagePattern(value) {
  return typeof value === "string" && /^[a-z][A-Za-z0-9-]*:(?:[A-Za-z0-9._-]+|\*)$/.test(value);
}

function backgroundMessageOwnedByPackage(packageId, value) {
  return typeof value === "string" && value.startsWith(`${packageId}:`);
}

function verifySensitivePresetParticipation(id, manifest, errors) {
  for (const setting of manifest.settings || []) {
    if (!(setting.presets || []).includes("profilePack")) continue;
    const storageText = `${setting.id} ${setting.storage?.key || ""} ${setting.storage?.property || ""}`.toLowerCase();
    if (sensitiveStorageNeedles.some((needle) => storageText.includes(needle))) {
      errors.push(`${id}:${setting.id}: sensitive storage must not participate in profilePack presets`);
    }
  }
}

function builtInRegistryStorageKeys(apps) {
  const keys = new Set();
  for (const app of apps) {
    for (const [area, storageKeys] of Object.entries(app.storageKeys || {})) {
      for (const key of storageKeys || []) {
        if (typeof key === "string" && key.length > 0) keys.add(`${area}:${key}`);
      }
    }
    for (const setting of app.settings || []) {
      if (setting.storage?.area && setting.storage?.key) keys.add(`${setting.storage.area}:${setting.storage.key}`);
    }
  }
  return keys;
}

function verifyReviewStatus(id, manifest, errors, warnings) {
  const status = manifest.review?.status || "local";
  if (!validReviewStatuses.has(status)) {
    errors.push(`${id}: invalid review status ${status}`);
    return;
  }
  if (status === "blocked") {
    errors.push(`${id}: blocked packages cannot be composed`);
    return;
  }
  if (status === "local") warnings.push(`${id}: package review status is local/unreviewed; inspect permissions and hashes before installing the custom build`);
}

function evaluatePackageTrust(id, source, manifest, files, webAccessibleAssets, payloadScan, packageSha256) {
  const errors = [];
  const warnings = [];
  const requiredAcknowledgements = [];
  const reviewStatus = manifest.review?.status || "local";
  const privilegedSurfaces = privilegedSurfacesFor(manifest, files, webAccessibleAssets);
  const sensitiveFindings = payloadScan.findings.filter((finding) => finding.severity === "error" || finding.severity === "warning");
  const replacementPolicy = firstPartyReplacementTrust(id, source, manifest, packageSha256);

  if (reviewStatus !== "reviewed" && reviewStatus !== "blocked") {
    requiredAcknowledgements.push({
      packageId: id,
      flag: "--allow-local-review",
      reason: "missing-or-local-review",
      acknowledged: allowLocalReview,
      details: `review.status is ${reviewStatus}; local packages fail closed unless the developer acknowledges local/unreviewed package review`,
    });
    if (!allowLocalReview && !previewTrustRequirements) errors.push(`${id}: review.status ${reviewStatus} requires --allow-local-review before composing local/unreviewed packages`);
  }

  if (firstPartyById.has(id)) {
    requiredAcknowledgements.push({
      packageId: id,
      flag: "--acknowledge-first-party-replacement",
      reason: "first-party-id-replacement",
      acknowledged: acknowledgeFirstPartyReplacement,
      details: replacementPolicy.allowed
        ? `package id matches a built-in first-party app and is allowed by repo policy ${replacementPolicy.root}`
        : "package id matches a built-in first-party app but is not allowed by the repo-owned replacement policy",
    });
    if (reviewStatus !== "reviewed") {
      errors.push(`${id}: replacing a built-in app id requires review.status "reviewed"`);
    }
    if (!replacementPolicy.allowed) {
      errors.push(`${id}: replacing a built-in app id requires a repo-owned first-party replacement policy match; ${replacementPolicy.reason}`);
    }
    if (!acknowledgeFirstPartyReplacement && !previewTrustRequirements) {
      errors.push(`${id}: replacing a built-in app id requires --acknowledge-first-party-replacement`);
    }
  }

  if (manifest.privacy?.consentRequired === true || privilegedSurfaces.length > 0) {
    requiredAcknowledgements.push({
      packageId: id,
      flag: "--acknowledge-package-consent",
      reason: "privileged-package-surface",
      acknowledged: acknowledgePackageConsent,
      details: privilegedSurfaces.length > 0
        ? `package declares privileged build inputs: ${privilegedSurfaces.join(", ")}`
        : "package privacy metadata requires user/developer consent before enablement",
    });
    if (!acknowledgePackageConsent && !previewTrustRequirements) {
      errors.push(`${id}: privileged local package surfaces require --acknowledge-package-consent before emitting a custom build plan`);
    }
  }

  const blockedSensitiveFindings = sensitiveFindings.filter((finding) => isNonAcknowledgeableSensitiveFinding(finding));
  const acknowledgeableSensitiveFindings = sensitiveFindings.filter((finding) => !isNonAcknowledgeableSensitiveFinding(finding));

  if (acknowledgeableSensitiveFindings.length > 0) {
    requiredAcknowledgements.push({
      packageId: id,
      flag: "--allow-sensitive-package-apis",
      reason: "sensitive-package-api-scan",
      acknowledged: allowSensitivePackageApis,
      details: `${acknowledgeableSensitiveFindings.length} reviewable sensitive API finding(s) in package payloads`,
    });
    if (reviewStatus !== "reviewed") {
      errors.push(`${id}: sensitive package API findings require review.status "reviewed" before an exception can be acknowledged`);
    } else if (!allowSensitivePackageApis && !previewTrustRequirements) {
      errors.push(`${id}: sensitive package API findings require --allow-sensitive-package-apis after review`);
    }
  }
  if (blockedSensitiveFindings.length > 0) {
    errors.push(`${id}: runtime messaging/port API findings cannot be authorized with --allow-sensitive-package-apis; local packages must use context.sendMessage() and declared App SDK background.messageTypes`);
  }

  for (const finding of sensitiveFindings) {
    const label = `${id}:${finding.file}:${finding.line}:${finding.column}`;
    const diagnostic = `${label}: ${finding.ruleId}: ${finding.message}`;
    if (isNonAcknowledgeableSensitiveFinding(finding) || reviewStatus !== "reviewed" || (!allowSensitivePackageApis && !previewTrustRequirements)) errors.push(diagnostic);
    else warnings.push(diagnostic);
  }

  return {
    errors: unique(errors),
    warnings: unique(warnings),
    requiredAcknowledgements,
    trustDecision: {
      packageId: id,
      reviewStatus,
      localReviewAcknowledged: allowLocalReview,
      packageConsentAcknowledged: acknowledgePackageConsent,
      firstPartyReplacementAcknowledged: acknowledgeFirstPartyReplacement,
      firstPartyReplacementPolicy: replacementPolicy,
      shadowsFirstParty: firstPartyById.has(id),
      sensitiveApiExceptionAcknowledged: allowSensitivePackageApis,
      sensitiveApiScanBoundary: "static-review-gate-known-patterns-not-runtime-sandbox",
      privilegedSurfaces,
      sensitiveApiFindings: sensitiveFindings.map((finding) => ({
        ruleId: finding.ruleId,
        severity: finding.severity,
        file: finding.file,
        line: finding.line,
        column: finding.column,
        message: finding.message,
      })),
      accepted: errors.length === 0,
    },
  };
}

function privilegedSurfacesFor(manifest, files, webAccessibleAssets) {
  const surfaces = [];
  if (manifest.contentEntry) surfaces.push(`contentEntry:${manifest.contentEntry}`);
  for (const sheet of manifest.css || []) surfaces.push(`css:${sheet.path}`);
  for (const asset of manifest.package?.assets || []) surfaces.push(`asset:${asset.path}`);
  for (const asset of webAccessibleAssets) surfaces.push(`webAccessibleAsset:${asset.source}`);
  for (const host of manifest.permissions?.hosts || []) surfaces.push(`hostPermission:${host}`);
  for (const permission of manifest.permissions?.optional || []) surfaces.push(`optionalPermission:${permission}`);
  for (const type of manifest.background?.messageTypes || []) surfaces.push(`backgroundMessage:${type}`);
  for (const service of manifest.background?.services || []) surfaces.push(`backgroundService:${service}`);
  for (const scope of manifest.siteScopes || []) {
    surfaces.push(`siteScope:${scope.site}:${scope.integration}`);
    for (const host of scope.hosts || []) surfaces.push(`siteHost:${host}`);
  }
  for (const file of files) {
    if (isExtensionOriginCodePath(file)) surfaces.push(`extensionOriginCode:${file}`);
  }
  if (manifest.privacy?.consentRequired === true) surfaces.push("privacyConsentRequired");
  return unique(surfaces).sort();
}

function scanPackagePayloads(id, root, files) {
  const findings = [];
  const scannedFiles = [];
  const skippedFiles = [];
  for (const file of files) {
    if (!isScannablePackageText(file)) {
      skippedFiles.push(file);
      continue;
    }
    const filePath = path.join(root, file);
    const source = readFileSyncSafe(filePath);
    if (!source || source.includes("\0")) {
      skippedFiles.push(file);
      continue;
    }
    scannedFiles.push(file);
    findings.push(...scanPayloadText(id, file, source));
  }
  return {
    scannedFiles: scannedFiles.sort(),
    skippedFiles: skippedFiles.sort(),
    findings: findings.sort((left, right) => `${left.file}:${left.line}:${left.column}:${left.ruleId}`.localeCompare(`${right.file}:${right.line}:${right.column}:${right.ruleId}`)),
  };
}

function scanPayloadText(id, file, source) {
  const findings = [];
  for (const rule of sensitivePackageApiScanRules(source)) {
    rule.pattern.lastIndex = 0;
    for (const match of source.matchAll(rule.pattern)) {
      const location = locationForOffset(source, match.index ?? 0);
      findings.push({
        packageId: id,
        file,
        line: location.line,
        column: location.column,
        ruleId: rule.id,
        severity: rule.severity,
        match: trimmedMatch(match[0]),
        message: rule.message,
      });
    }
  }
  return findings;
}

function sensitivePackageApiScanRules(source) {
  const rules = [...sensitivePackageApiRules];
  const stringConstants = findStringConstants(source);
  const chromeAliases = expandSimpleAliasChains(source, [
    ...findSimpleGlobalAliases(source, "chrome"),
    ...findReflectGlobalAliases(source, "chrome"),
  ]);
  const browserAliases = expandSimpleAliasChains(source, [
    ...findSimpleGlobalAliases(source, "browser"),
    ...findReflectGlobalAliases(source, "browser"),
  ]);
  const runtimeAliases = expandSimpleAliasChains(source, [
    ...findRuntimeAliases(source, "chrome"),
    ...findRuntimeAliases(source, "browser"),
    ...findRuntimeAliasesForAliases(source, chromeAliases),
    ...findRuntimeAliasesForAliases(source, browserAliases),
  ]);
  for (const alias of chromeAliases) {
    rules.push(
      aliasRule("chrome-runtime-send-message", alias, "sendMessage"),
      aliasRule("chrome-runtime-connect", alias, "connect"),
      aliasRule("broad-chrome-api", alias),
    );
    rules.push(...variableHeldGlobalApiRules("chrome", alias, stringConstants));
  }
  for (const alias of browserAliases) {
    rules.push(
      aliasRule("browser-runtime-send-message", alias, "sendMessage"),
      aliasRule("browser-runtime-connect", alias, "connect"),
      aliasRule("broad-browser-api", alias),
    );
    rules.push(...variableHeldGlobalApiRules("browser", alias, stringConstants));
  }
  for (const alias of runtimeAliases) {
    rules.push(
      runtimeAliasRule("chrome-runtime-send-message", alias, "sendMessage"),
      runtimeAliasRule("chrome-runtime-connect", alias, "connect"),
    );
  }
  return rules;
}

function firstPartyReplacementTrust(id, source, manifest, packageSha256) {
  const policy = firstPartyReplacementPolicyById.get(id);
  if (!firstPartyById.has(id)) {
    return { allowed: false, reason: "not-a-first-party-replacement" };
  }
  if (!policy) {
    return { allowed: false, reason: "no repo-owned replacement policy entry" };
  }
  const expectedRoot = normalizeInputPath(policy.root);
  const actualRoot = normalizeInputPath(source.root);
  if (policy.sourceType && policy.sourceType !== source.type) {
    return {
      allowed: false,
      root: expectedRoot,
      packageSha256: policy.packageSha256,
      reason: `source type ${source.type} does not match policy sourceType ${policy.sourceType}`,
    };
  }
  if (expectedRoot !== actualRoot) {
    return {
      allowed: false,
      root: expectedRoot,
      packageSha256: policy.packageSha256,
      reason: `source root ${actualRoot} does not match policy root ${expectedRoot}`,
    };
  }
  if (policy.sourceUrl && manifest.review?.sourceUrl !== policy.sourceUrl) {
    return {
      allowed: false,
      root: expectedRoot,
      sourceUrl: policy.sourceUrl,
      packageSha256: policy.packageSha256,
      reason: `review source URL ${manifest.review?.sourceUrl || "<missing>"} does not match policy sourceUrl ${policy.sourceUrl}`,
    };
  }
  if (policy.packageSha256 !== packageSha256) {
    return {
      allowed: false,
      root: expectedRoot,
      packageSha256: policy.packageSha256,
      reason: `package SHA-256 ${packageSha256} does not match policy hash`,
    };
  }
  return {
    allowed: true,
    root: expectedRoot,
    ...(policy.sourceUrl ? { sourceUrl: policy.sourceUrl } : {}),
    packageSha256: policy.packageSha256,
    reason: policy.reason || "repo-owned replacement policy matched",
  };
}

function aliasRule(ruleId, alias, runtimeMethod) {
  const baseRule = sensitivePackageApiRules.find((rule) => rule.id === ruleId);
  return {
    ...baseRule,
    pattern: runtimeMethod
      ? runtimeApiPattern(escapeRegExp(alias), runtimeMethod)
      : privilegedNamespacePattern(escapeRegExp(alias)),
  };
}

function variableHeldGlobalApiRules(globalName, alias, stringConstants) {
  const rules = [];
  const runtimeKeys = variableNamesForValue(stringConstants, "runtime");
  const sendMessageKeys = variableNamesForValue(stringConstants, "sendMessage");
  const connectKeys = variableNamesForValue(stringConstants, "connect");
  const privilegedNamespaceKeys = variableNamesForValues(stringConstants, [
    "storage",
    "tabs",
    "cookies",
    "scripting",
    "permissions",
    "downloads",
    "webRequest",
    "runtime",
    "extension",
  ]);
  const runtimeRulePrefix = globalName === "browser" ? "browser" : "chrome";
  const broadRuleId = globalName === "browser" ? "broad-browser-api" : "broad-chrome-api";

  for (const runtimeKey of runtimeKeys) {
    for (const methodKey of sendMessageKeys) {
      rules.push(variableHeldRuntimeRule(`${runtimeRulePrefix}-runtime-send-message`, alias, runtimeKey, methodKey));
    }
    for (const methodKey of connectKeys) {
      rules.push(variableHeldRuntimeRule(`${runtimeRulePrefix}-runtime-connect`, alias, runtimeKey, methodKey));
    }
  }
  for (const namespaceKey of privilegedNamespaceKeys) {
    rules.push(variableHeldPrivilegedNamespaceRule(broadRuleId, alias, namespaceKey));
  }
  return rules;
}

function variableHeldRuntimeRule(ruleId, alias, runtimeKey, methodKey) {
  const baseRule = sensitivePackageApiRules.find((rule) => rule.id === ruleId);
  return {
    ...baseRule,
    pattern: new RegExp(`\\b${escapeRegExp(alias)}${jsTriviaPattern()}\\[${jsTriviaPattern()}${escapeRegExp(runtimeKey)}${jsTriviaPattern()}\\]${jsTriviaPattern()}\\[${jsTriviaPattern()}${escapeRegExp(methodKey)}${jsTriviaPattern()}\\]${jsTriviaPattern()}\\(`, "g"),
  };
}

function variableHeldPrivilegedNamespaceRule(ruleId, alias, namespaceKey) {
  const baseRule = sensitivePackageApiRules.find((rule) => rule.id === ruleId);
  return {
    ...baseRule,
    pattern: new RegExp(`\\b${escapeRegExp(alias)}${jsTriviaPattern()}\\[${jsTriviaPattern()}${escapeRegExp(namespaceKey)}${jsTriviaPattern()}\\]`, "g"),
  };
}

function runtimeAliasRule(ruleId, alias, runtimeMethod) {
  const baseRule = sensitivePackageApiRules.find((rule) => rule.id === ruleId);
  return {
    ...baseRule,
    pattern: new RegExp(`\\b${escapeRegExp(alias)}${jsTriviaPattern()}${propertyAccessPattern(runtimeMethod)}${jsTriviaPattern()}\\(`, "g"),
  };
}

function findSimpleGlobalAliases(source, globalName) {
  const aliases = new Set();
  const pattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${globalApiPattern(globalName)}(?![\\w$])`, "g");
  for (const match of source.matchAll(pattern)) {
    if (match[1] && match[1] !== globalName) aliases.add(match[1]);
  }
  return aliases;
}

function findReflectGlobalAliases(source, globalName) {
  const aliases = new Set();
  const pattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${reflectGlobalApiPattern(globalName).source}`, "g");
  for (const match of source.matchAll(pattern)) {
    if (match[1]) aliases.add(match[1]);
  }
  return aliases;
}

function findStringConstants(source) {
  const constants = new Map();
  const pattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(["'])([^"'\\]*(?:\\.[^"'\\]*)*)\2/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1];
    const value = decodeStaticStringLiteralBody(match[3] || "");
    if (name && value) constants.set(name, value);
  }
  const templatePattern = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*`([^`\\$]*(?:\\[\s\S][^`\\$]*)*)`/g;
  for (const match of source.matchAll(templatePattern)) {
    const name = match[1];
    const value = decodeStaticStringLiteralBody(match[2] || "");
    if (name && value) constants.set(name, value);
  }
  const constructedPattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*(${knownSensitiveStringExpressionPattern()})`, "g");
  for (const match of source.matchAll(constructedPattern)) {
    const name = match[1];
    const value = staticSensitiveStringValue(match[2] || "");
    if (name && value) constants.set(name, value);
  }
  return constants;
}

function decodeStaticStringLiteralBody(value) {
  return value.replace(/\\(?:u\{([0-9a-fA-F]+)\}|u([0-9a-fA-F]{4})|x([0-9a-fA-F]{2})|([0-7]{1,3})|([\s\S]))/g, (_, codePointHex, unicodeHex, hex, octal, escaped) => {
    if (codePointHex) {
      const codePoint = Number.parseInt(codePointHex, 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : "";
    }
    if (unicodeHex || hex) return String.fromCharCode(Number.parseInt(unicodeHex || hex, 16));
    if (octal) return String.fromCharCode(Number.parseInt(octal, 8));
    return jsSingleCharacterEscapeValue(escaped);
  });
}

function jsSingleCharacterEscapeValue(value) {
  switch (value) {
    case "b":
      return "\b";
    case "f":
      return "\f";
    case "n":
      return "\n";
    case "r":
      return "\r";
    case "t":
      return "\t";
    case "v":
      return "\v";
    case "0":
      return "\0";
    case "\r":
    case "\n":
      return "";
    default:
      return value || "";
  }
}

function variableNamesForValue(constants, expectedValue) {
  return [...constants.entries()].filter(([, value]) => value === expectedValue).map(([name]) => name);
}

function variableNamesForValues(constants, expectedValues) {
  const allowed = new Set(expectedValues);
  return [...constants.entries()].filter(([, value]) => allowed.has(value)).map(([name]) => name);
}

function findRuntimeAliases(source, globalName) {
  const aliases = new Set();
  const globalPattern = globalApiPattern(globalName);
  const directPattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${globalPattern}\\s*${propertyAccessPattern("runtime")}`, "g");
  for (const match of source.matchAll(directPattern)) {
    if (match[1]) aliases.add(match[1]);
  }
  const destructurePattern = new RegExp(`\\b(?:const|let|var)\\s*\\{([^}]+)\\}\\s*=\\s*${globalPattern}\\b`, "g");
  for (const match of source.matchAll(destructurePattern)) {
    for (const alias of destructuredRuntimeAliases(match[1] || "")) aliases.add(alias);
  }
  return aliases;
}

function findRuntimeAliasesForAliases(source, globalAliases) {
  const aliases = new Set();
  for (const globalAlias of globalAliases) {
    const directPattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegExp(globalAlias)}\\s*${propertyAccessPattern("runtime")}`, "g");
    for (const match of source.matchAll(directPattern)) {
      if (match[1]) aliases.add(match[1]);
    }
    const destructurePattern = new RegExp(`\\b(?:const|let|var)\\s*\\{([^}]+)\\}\\s*=\\s*${escapeRegExp(globalAlias)}\\b`, "g");
    for (const match of source.matchAll(destructurePattern)) {
      for (const alias of destructuredRuntimeAliases(match[1] || "")) aliases.add(alias);
    }
  }
  return aliases;
}

function expandSimpleAliasChains(source, initialAliases) {
  const aliases = new Set(initialAliases);
  let changed = true;
  while (changed) {
    changed = false;
    for (const alias of [...aliases]) {
      const pattern = new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*${escapeRegExp(alias)}\\b`, "g");
      for (const match of source.matchAll(pattern)) {
        if (match[1] && !aliases.has(match[1])) {
          aliases.add(match[1]);
          changed = true;
        }
      }
    }
  }
  return aliases;
}

function destructuredRuntimeAliases(bindingSource) {
  const aliases = [];
  const runtimeBinding = /(?:^|,)\s*runtime\s*(?::\s*([A-Za-z_$][\w$]*))?(?:\s*=[^,]+)?(?=,|$)/g;
  for (const match of bindingSource.matchAll(runtimeBinding)) {
    aliases.push(match[1] || "runtime");
  }
  return aliases;
}

function runtimeApiPattern(objectPattern, methodName) {
  return new RegExp(`\\b${objectPattern}${jsTriviaPattern()}${propertyAccessPattern("runtime")}${jsTriviaPattern()}${propertyAccessPattern(methodName)}${jsTriviaPattern()}\\(`, "g");
}

function privilegedNamespacePattern(objectPattern) {
  return new RegExp(`\\b${objectPattern}${jsTriviaPattern()}${propertyAccessPattern("(?:storage|tabs|cookies|scripting|permissions|downloads|webRequest|runtime|extension)", false)}`, "g");
}

function propertyAccessPattern(propertyPattern, quoteLiteral = true) {
  const trivia = jsTriviaPattern();
  const bracket = quoteLiteral
    ? `\\[${trivia}${stringExpressionPattern(propertyPattern)}${trivia}\\]`
    : `\\[${trivia}${staticStringLiteralAlternationPattern(propertyPattern)}${trivia}\\]`;
  return `(?:\\.${trivia}${propertyPattern}|${bracket})`;
}

function globalApiPattern(globalName) {
  const escaped = escapeRegExp(globalName);
  return `(?:${escaped}|(?:globalThis|window|self)${jsTriviaPattern()}${propertyAccessPattern(escaped)}|${reflectGlobalApiPattern(globalName).source})`;
}

function reflectGlobalApiPattern(globalName = "(?:chrome|browser)") {
  const names = globalName === "chrome" || globalName === "browser" ? [globalName] : ["chrome", "browser"];
  const stringPatterns = names.map((name) => stringExpressionPattern(name));
  const trivia = jsTriviaPattern();
  return new RegExp(`\\bReflect${trivia}\\.${trivia}get${trivia}\\(${trivia}(?:globalThis|window|self)${trivia},${trivia}(?:${stringPatterns.join("|")})${trivia}\\)`, "g");
}

function stringExpressionPattern(value) {
  const literal = staticStringLiteralPattern(value);
  return `(?:${literal}|String\\(${jsTriviaPattern()}${literal}${jsTriviaPattern()}\\)|${arrayJoinStringExpressionPattern(value)}|${charCodeStringExpressionPattern(value)}|${atobStringExpressionPattern(value)})`;
}

function constructedStringExpressionPattern(value) {
  return `(?:${staticStringLiteralPattern(value)}|${concatenatedStringExpressionPattern(value)}|${arrayJoinStringExpressionPattern(value)}|${charCodeStringExpressionPattern(value)}|${atobStringExpressionPattern(value)})`;
}

function knownSensitiveStringExpressionPattern() {
  return staticSensitiveStringValues.map(constructedStringExpressionPattern).join("|");
}

function staticSensitiveStringValue(expression) {
  const normalized = expression.replace(/\s+/g, "");
  for (const value of staticSensitiveStringValues) {
    const exactPatterns = [
      staticStringLiteralPattern(value),
      `String\\(${staticStringLiteralPattern(value)}\\)`,
      concatenatedStringExpressionPattern(value),
      arrayJoinStringExpressionPattern(value),
      charCodeStringExpressionPattern(value),
      atobStringExpressionPattern(value),
    ].map((pattern) => new RegExp(`^${pattern}$`));
    if (exactPatterns.some((pattern) => pattern.test(normalized))) return value;
  }
  return null;
}

function staticStringLiteralPattern(value) {
  return `(?:${quoteDelimitedStringLiteralPattern(value, "'")}|${quoteDelimitedStringLiteralPattern(value, "\"")}|${quoteDelimitedStringLiteralPattern(value, "`")})`;
}

function staticStringLiteralAlternationPattern(valuePattern) {
  const alternatives = valuePattern.startsWith("(?:") && valuePattern.endsWith(")")
    ? valuePattern.slice(3, -1).split("|")
    : [valuePattern];
  return `(?:${alternatives.map(staticStringLiteralPattern).join("|")})`;
}

function quoteDelimitedStringLiteralPattern(value, quote) {
  const delimiter = escapeRegExp(quote);
  return `${delimiter}${[...value].map((char) => staticStringLiteralCharPattern(char, quote)).join("")}${delimiter}`;
}

function staticStringLiteralCharPattern(char, quote) {
  const alternatives = [escapeRegExp(char)];
  const code = char.codePointAt(0);
  if (code !== undefined) {
    alternatives.push(`\\\\x${hexDigitPattern(code.toString(16).padStart(2, "0"))}`);
    alternatives.push(`\\\\u${hexDigitPattern(code.toString(16).padStart(4, "0"))}`);
    alternatives.push(`\\\\u\\{0*${hexDigitPattern(code.toString(16))}\\}`);
  }
  if (char === quote) alternatives.shift();
  return `(?:${unique(alternatives).join("|")})`;
}

function hexDigitPattern(value) {
  return [...value].map((char) => /[a-f]/.test(char) ? `[${char}${char.toUpperCase()}]` : char).join("");
}

function concatenatedStringExpressionPattern(value) {
  if (!staticSensitiveStringValues.includes(value)) return `(?!x)x`;
  const trivia = jsTriviaPattern();
  return partitionedStringLiteralPattern(value, `${trivia}\\+${trivia}`, { requireSeparator: true });
}

function arrayJoinStringExpressionPattern(value) {
  if (!staticSensitiveStringValues.includes(value)) return `(?!x)x`;
  const trivia = jsTriviaPattern();
  return `\\[${trivia}${partitionedStringLiteralPattern(value, `${trivia},${trivia}`, { requireSeparator: false })}${trivia}\\]${trivia}\\.${trivia}join${trivia}\\(${trivia}(?:""|'')?${trivia}\\)`;
}

function charCodeStringExpressionPattern(value) {
  const trivia = jsTriviaPattern();
  return `String${trivia}\\.${trivia}fromCharCode${trivia}\\(${trivia}${[...value].map((char) => numericLiteralPattern(char.charCodeAt(0))).join(`${trivia},${trivia}`)}${trivia}\\)`;
}

function atobStringExpressionPattern(value) {
  const encoded = Buffer.from(value, "utf8").toString("base64");
  const encodings = unique([encoded, encoded.replace(/=+$/g, "")]).filter(Boolean);
  if (encodings.length === 0) return `(?!x)x`;
  const trivia = jsTriviaPattern();
  const callee = `(?:atob|(?:globalThis|window|self)(?:${trivia}\\.${trivia}atob|${trivia}\\[${trivia}["']atob["']${trivia}\\]))`;
  return `${callee}${trivia}\\(${trivia}(?:${encodings.map((item) => `["']${escapeRegExp(item)}["']`).join("|")})${trivia}\\)`;
}

function jsTriviaPattern() {
  return `(?:\\s|/\\*[\\s\\S]*?\\*/|//[^\\r\\n]*(?:\\r?\\n|$))*`;
}

function numericLiteralPattern(value) {
  const decimalPattern = digitsWithOptionalSeparators(String(value));
  const hexPattern = digitsWithOptionalSeparators(value.toString(16), true);
  const binaryPattern = digitsWithOptionalSeparators(value.toString(2));
  const octalPattern = digitsWithOptionalSeparators(value.toString(8));
  return `(?:${decimalPattern}|0[xX]${hexPattern}|0[bB]${binaryPattern}|0[oO]${octalPattern})`;
}

function digitsWithOptionalSeparators(value, caseInsensitive = false) {
  return [...value].map((char) => {
    if (caseInsensitive && /[a-f]/.test(char)) return `[${char}${char.toUpperCase()}]`;
    return char;
  }).join("_?");
}

function partitionedStringLiteralPattern(value, separatorPattern, { requireSeparator }) {
  const chars = [...value].map(escapeRegExp);
  const optionalSeparator = `(?:["']${separatorPattern}["'])?`;
  const patternForRequiredBoundary = (requiredBoundary) => {
    let pattern = `["']`;
    for (let index = 0; index < chars.length; index += 1) {
      pattern += chars[index];
      if (index < chars.length - 1) {
        pattern += index === requiredBoundary ? `["']${separatorPattern}["']` : optionalSeparator;
      }
    }
    return `${pattern}["']`;
  };
  if (!requireSeparator) return patternForRequiredBoundary(-1);
  return `(?:${chars.slice(0, -1).map((_, index) => patternForRequiredBoundary(index)).join("|")})`;
}

function isNonAcknowledgeableSensitiveFinding(finding) {
  return nonAcknowledgeablePackageApiRuleIds.has(finding.ruleId);
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isScannablePackageText(file) {
  return scannableTextExtensions.has(path.extname(file).toLowerCase());
}

function isExtensionOriginCodePath(file) {
  return [".js", ".mjs", ".cjs", ".html", ".htm", ".wasm"].includes(path.extname(file).toLowerCase());
}

function locationForOffset(source, offset) {
  let line = 1;
  let column = 1;
  for (let index = 0; index < offset; index += 1) {
    if (source.charCodeAt(index) === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }
  return { line, column };
}

function trimmedMatch(value) {
  return value.replace(/\s+/g, " ").slice(0, 120);
}

function verifyStorageDeclarations(id, manifest, errors, options = {}) {
  const declared = manifest.storageKeys || {};
  for (const [area, storageKeys] of Object.entries(declared)) {
    for (const key of storageKeys || []) {
      if (!options.allowBuiltInStorageKeys && builtInStorageKeys.has(`${area}:${key}`)) {
        errors.push(`${id}: local package storageKeys.${area} cannot claim built-in registry storage key ${key} without a trusted first-party replacement policy`);
      }
    }
  }
  for (const setting of manifest.settings || []) {
    if (!setting.storage?.area || !setting.storage?.key) {
      errors.push(`${id}:${setting.id || "<unknown>"}: invalid storage metadata`);
      continue;
    }
    if (!declared[setting.storage.area]?.includes(setting.storage.key)) {
      errors.push(`${id}:${setting.id}: setting storage key must be declared in storageKeys.${setting.storage.area}`);
    }
    const storageLabel = `${setting.id || ""}.${setting.storage.key || ""}.${setting.storage.property || ""}`;
    if (isSensitiveGeneratedStorageName(storageLabel)) {
      errors.push(`${id}:${setting.id}: generated settings controls must not expose auth, session, token, cookie, API-key, private cache, diagnostic, queue, local file, folder, or path storage`);
    }
    if (!options.allowBuiltInStorageKeys && builtInStorageKeys.has(`${setting.storage.area}:${setting.storage.key}`)) {
      errors.push(`${id}:${setting.id}: setting storage key ${setting.storage.key} collides with built-in registry storage and requires a trusted first-party replacement policy`);
    }
  }
}

function isSensitiveGeneratedStorageName(value) {
  const normalized = String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  return sensitiveGeneratedStorageNeedles.some((needle) => normalized.includes(needle));
}

function verifyNovelPackageEnablement(id, manifest, errors) {
  if (firstPartyById.has(id)) return;
  const enablementSettings = (manifest.settings || []).filter((setting) => setting.role === "enablement");
  if (enablementSettings.length === 0) {
    errors.push(`${id}: novel local package must declare a toggle setting with role "enablement" so Apps & Features can control it`);
    return;
  }

  let hasValidEnablement = false;
  const declared = manifest.storageKeys || {};
  for (const setting of enablementSettings) {
    const settingId = setting.id || "<unknown>";
    if (setting.control?.type !== "toggle") {
      errors.push(`${id}:${settingId}: enablement setting must use control.type "toggle"`);
      continue;
    }
    if ((setting.storage?.area !== "local" && setting.storage?.area !== "sync") || typeof setting.storage?.key !== "string" || setting.storage.key.length === 0) {
      errors.push(`${id}:${settingId}: enablement setting must declare local or sync storage metadata`);
      continue;
    }
    if (!declared[setting.storage.area]?.includes(setting.storage.key)) {
      errors.push(`${id}:${settingId}: enablement storage key must be declared in storageKeys.${setting.storage.area}`);
      continue;
    }
    if (packageRequiresExplicitEnablement(manifest) && setting.defaultValue === true) {
      errors.push(`${id}:${settingId}: privileged or consent-required local packages must not default enablement settings to true`);
      continue;
    }
    hasValidEnablement = true;
  }

  if (!hasValidEnablement) {
    errors.push(`${id}: novel local package must include at least one valid storage-backed enablement toggle`);
  }
}

function verifyExecutableContentEntry(id, manifest, errors) {
  if (typeof manifest.contentEntry !== "string") return;
  const extension = path.extname(manifest.contentEntry).toLowerCase();
  if (!executableContentEntryExtensions.has(extension)) {
    errors.push(`${id}: contentEntry must be an executable .js or .mjs module because local packages are copied without transpilation`);
  }
}

function verifyLifecycleExports(id, root, manifest, errors) {
  if (!manifest.contentEntry || !isSafeRelativePath(manifest.contentEntry) || !existsSync(path.join(root, manifest.contentEntry))) return;
  const source = readFileSyncSafe(path.join(root, manifest.contentEntry));
  const exports = lifecycleExports(source);
  if (manifest.lifecycle?.mode === "invoked" && exports.has("boot")) errors.push(`${id}: invoked package content entry must not export boot()`);
  if ((manifest.lifecycle?.mode ?? "runtime") === "runtime" && !exports.has("boot")) errors.push(`${id}: runtime package content entry must export boot()`);
  if ((manifest.surfaces || []).includes("overlayApp") || manifest.loadTriggers?.includes("dockOpen") || manifest.dock) {
    if (!exports.has("open") || !exports.has("close")) errors.push(`${id}: docked/overlay package content entry must export open() and close()`);
  }
}

function collectFile(source, value, fieldLabel, files, errors) {
  const root = source.root;
  if (!isSafeRelativePath(value)) {
    errors.push(`${path.basename(root)}: ${fieldLabel} must be a safe package-relative path`);
    return;
  }
  const declaredPath = path.join(root, value);
  if (!existsSync(declaredPath)) {
    errors.push(`${path.basename(root)}: declared ${fieldLabel} does not exist: ${value}`);
    return;
  }
  if (source.type === "folder") {
    const fileError = validateFolderPackageFile(source, declaredPath, fieldLabel, value);
    if (fileError) {
      errors.push(fileError);
      return;
    }
  }
  files.push(value);
}

function validateFolderPackageFile(source, declaredPath, fieldLabel, relativePath) {
  const root = source.root;
  try {
    const info = lstatSync(declaredPath);
    if (!info.isFile()) return `${path.basename(root)}: declared ${fieldLabel} must be a regular file: ${relativePath}`;
    const realRoot = path.resolve(source.realRoot || realpathSync(root));
    const realFile = realpathSync(declaredPath);
    if (!isPathInside(realRoot, realFile)) {
      return `${path.basename(root)}: declared ${fieldLabel} escapes package root: ${relativePath}`;
    }
  } catch (error) {
    return `${path.basename(root)}: unable to inspect declared ${fieldLabel}: ${relativePath}: ${error.message}`;
  }
  return "";
}

function storageOwnershipFor(manifest) {
  const owners = [];
  for (const setting of manifest.settings || []) {
    if (!setting.storage?.area || !setting.storage?.key) continue;
    owners.push({
      area: setting.storage.area,
      key: setting.storage.key,
      property: setting.storage.property,
      settingId: setting.id,
    });
  }
  return owners;
}

function siteRoutesFor(manifest) {
  return (manifest.siteScopes || []).flatMap((scope) => {
    const routes = scope.routes?.length ? scope.routes : [{ type: "scope", path: "*", surface: scope.surfaces?.join(",") || "*" }];
    return routes.map((route) => ({
      site: scope.site,
      hosts: scope.hosts || [],
      integration: scope.integration,
      presentation: scope.presentation,
      type: route.type,
      path: route.path,
      surface: route.surface,
    }));
  });
}

async function writeOutputs(composition) {
  await mkdir(outDir, { recursive: true });
  await writeJson(path.join(outDir, "composition-report.json"), composition.report);
  if (composition.report.summary.rejected > 0 || composition.report.diagnostics.errors.length > 0) return;
  await writeJson(planOut, composition.buildPlan);
  await writeJson(path.join(outDir, "apps.generated.json"), composition.apps);
  await writeJson(path.join(outDir, "manifest-permissions.generated.json"), composition.manifestPermissions);
  await writeJson(path.join(outDir, "web-accessible-assets.generated.json"), composition.webAccessibleAssets);
}

function printHumanReport(report) {
  console.log("Local app package composition dry run");
  console.log(`  discovered: ${report.summary.discovered}`);
  console.log(`  accepted: ${report.summary.accepted}`);
  console.log(`  rejected: ${report.summary.rejected}`);
  console.log(`  warnings: ${report.summary.warned}`);
  console.log(`  output dir: ${outDir}`);
  console.log(`  build plan: ${planOut}`);
  if (Object.keys(report.summary.packageKinds).length > 0) {
    console.log("  package kinds:");
    for (const [kind, count] of Object.entries(report.summary.packageKinds)) console.log(`  - ${kind}: ${count}`);
  }
  if (report.summary.hostPermissions.length > 0) {
    console.log("  host permissions:");
    for (const host of report.summary.hostPermissions) console.log(`  - ${host}`);
  }
  const addedHosts = report.acceptedPackages.flatMap((pkg) => pkg.permissions.addedHosts || []);
  if (addedHosts.length > 0) {
    console.log("  added host permissions:");
    for (const host of unique(addedHosts).sort()) console.log(`  - ${host}`);
  }
  const consentPackages = report.acceptedPackages.filter((pkg) => pkg.privacy?.consentRequired);
  if (consentPackages.length > 0) {
    console.log("  consent required:");
    for (const pkg of consentPackages) console.log(`  - ${pkg.id}`);
  }
  if (report.requiredAcknowledgements.length > 0) {
    console.log("  required acknowledgements:");
    for (const item of report.requiredAcknowledgements) {
      console.log(`  - ${item.packageId}: ${item.flag} (${item.acknowledged ? "acknowledged" : "missing"}) ${item.reason}`);
      console.log(`    ${item.details}`);
    }
  }
  if (report.trustDecisions.length > 0) {
    console.log("  trust decisions:");
    for (const decision of report.trustDecisions) {
      console.log(`  - ${decision.packageId}: review=${decision.reviewStatus}, privilegedSurfaces=${decision.privilegedSurfaces.length}, sensitiveApiFindings=${decision.sensitiveApiFindings.length}`);
      if (decision.sensitiveApiScanBoundary) {
        console.log(`    sensitive API scan: ${decision.sensitiveApiScanBoundary}`);
      }
    }
  }
  if (report.acceptedPackages.length > 0) {
    console.log("  accepted packages:");
    for (const pkg of report.acceptedPackages) {
      console.log(`  - ${pkg.id} (${pkg.packageKind}, ${pkg.source.type}, review=${pkg.diagnostics.reviewStatus}) content=${pkg.contentEntry.target}`);
    }
  }
  if (report.diagnostics.warnings.length > 0) {
    console.log("  warnings:");
    for (const warning of report.diagnostics.warnings) console.log(`  - ${warning}`);
  }
  if (report.diagnostics.errors.length > 0) {
    console.error("  errors:");
    for (const error of report.diagnostics.errors) console.error(`  - ${error}`);
  }
  if (report.rejectedPackages.length > 0) {
    console.error("  rejected packages:");
    for (const rejected of report.rejectedPackages) {
      console.error(`  - ${rejected.id || rejected.root}: ${rejected.reason}`);
      for (const diagnostic of rejected.diagnostics || []) console.error(`    - ${diagnostic}`);
    }
  }
  if (report.diagnostics.errors.length === 0 && report.rejectedPackages.length === 0) {
    if (checkOnly) {
      console.log("Local app composition check passed.");
    } else {
      console.log(`Generated local app composition artifacts in ${outDir}.`);
      console.log(stageExternalPackages
        ? "External package files were staged without retaining the author path."
        : `Use ${recommendedLocalBuildCommand(composition.report)} to emit dist/chromium-local-apps/.`);
    }
  }
}

function toReportPackage(record) {
  return {
    id: record.id,
    source: sourceSummary(record),
    root: record.compositionRoot || record.root,
    name: record.manifest.name,
    version: record.manifest.version,
    packageKind: record.manifest.packageKind,
    sdk: record.manifest.sdk,
    contentEntry: record.contentEntry,
    css: record.css,
    files: record.files,
    packageSha256: record.packageSha256,
    contentSha256: record.contentSha256,
    manifestSha256: record.manifestSha256,
    permissions: record.permissions,
    webAccessibleAssets: record.webAccessibleAssets,
    background: record.background,
    settings: {
      storageKeys: record.manifest.storageKeys || {},
      settingIds: (record.manifest.settings || []).map((setting) => setting.id).sort(),
      presetParticipation: presetParticipation(record.manifest),
    },
    siteScopes: record.manifest.siteScopes || [],
    privacy: record.manifest.privacy,
    trust: record.trustDecision,
    payloadScan: {
      scannedFiles: record.payloadScan.scannedFiles,
      skippedFiles: record.payloadScan.skippedFiles,
      findings: record.payloadScan.findings,
    },
    diagnostics: {
      reviewStatus: record.manifest.review?.status || "local",
      shadowsFirstParty: firstPartyById.has(record.id),
      localOnly: record.manifest.lifecycle?.localOnly === true || record.manifest.review?.status === "local",
    },
  };
}

function sourceSummary(record) {
  const summary = {
    packageId: record.id,
    type: record.compositionSourceType || record.source.type,
    root: record.compositionRoot || record.root,
    packageSha256: record.packageSha256,
    contentSha256: record.contentSha256,
    manifestSha256: record.manifestSha256,
    reviewStatus: record.manifest.review?.status || "local",
  };
  if (!record.compositionRoot) {
    summary.input = record.source.input;
    summary.archivePath = record.source.archivePath;
    summary.archiveSha256 = record.source.archiveSha256;
  }
  return summary;
}

function presetParticipation(manifest) {
  const result = {};
  for (const setting of manifest.settings || []) {
    for (const preset of setting.presets || []) {
      result[preset] = result[preset] || [];
      result[preset].push(setting.id);
    }
  }
  return Object.fromEntries(Object.entries(result).map(([key, value]) => [key, value.sort()]).sort());
}

function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (path.isAbsolute(value)) return false;
  const normalized = path.normalize(value);
  return normalized === value.replaceAll("/", path.sep) && !normalized.startsWith("..") && !normalized.split(path.sep).includes("..");
}

function isSafeArchivePath(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (value.includes("\\") || value.includes("\0")) return false;
  if (/[\x00-\x1f\x7f]/.test(value)) return false;
  if (value.startsWith("/") || value.startsWith("./") || /^[A-Za-z]:/.test(value)) return false;
  const normalized = path.posix.normalize(value);
  return normalized === value && !normalized.startsWith("../") && normalized !== ".." && !normalized.split("/").includes("..");
}

function isSafePackageId(value) {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value);
}

function packageOutputPath(packageId, relativePath) {
  if (!isSafePackageId(packageId)) throw new Error(`${packageId}: local package id must be a safe package identifier`);
  if (!isSafeRelativePath(relativePath)) throw new Error(`${packageId}: output path must be package-relative: ${relativePath}`);
  const outputPath = normalizePosix(path.join("local-apps", packageId, relativePath));
  const expectedPrefix = `local-apps/${packageId}/`;
  if (!outputPath.startsWith(expectedPrefix)) {
    throw new Error(`${packageId}: output path escapes ${expectedPrefix}: ${relativePath}`);
  }
  return outputPath;
}

function normalizeInputPath(value) {
  return normalizePosix(path.normalize(value));
}

function recommendedLocalBuildCommand(report) {
  const commandArgs = [];
  for (const dir of packagesDirs) commandArgs.push(`--packages-dir=${quoteShellArg(dir)}`);
  if (legacyPackagesRoot) commandArgs.push(`--packages-root=${quoteShellArg(legacyPackagesRoot)}`);
  for (const pkg of requestedPackages) commandArgs.push(`--package=${quoteShellArg(pkg)}`);
  if (outDir !== defaultOutDir) commandArgs.push(`--out-dir=${quoteShellArg(outDir)}`);
  if (planOut !== path.join(outDir, "build-plan.json")) commandArgs.push(`--plan-out=${quoteShellArg(planOut)}`);
  for (const flag of unique((report.requiredAcknowledgements || []).map((acknowledgement) => acknowledgement.flag)).sort()) {
    commandArgs.push(flag);
  }
  return commandArgs.length > 0
    ? `pnpm.cmd run build:local-apps:chromium -- ${commandArgs.join(" ")}`
    : "pnpm.cmd run build:local-apps:chromium";
}

function quoteShellArg(value) {
  const text = String(value);
  return /\s/.test(text) ? JSON.stringify(text) : text;
}

function normalizeWorkspaceRelativePath(value) {
  const absolute = path.resolve(value);
  const relativePath = path.relative(process.cwd(), absolute);
  if (relativePath && !relativePath.startsWith("..") && !path.isAbsolute(relativePath)) return normalizeInputPath(relativePath);
  return normalizeInputPath(value);
}

function normalizePosix(value) {
  return value.replaceAll("\\", "/");
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null)));
}

function dedupeSources(sources) {
  const seen = new Set();
  const result = [];
  for (const source of sources) {
    const key = `${source.type}:${source.input}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(source);
  }
  return result;
}

function compareSources(left, right) {
  return `${left.type}:${left.input}`.localeCompare(`${right.type}:${right.input}`);
}

function countBy(values, getKey) {
  const result = {};
  for (const value of values) {
    const key = getKey(value);
    result[key] = (result[key] || 0) + 1;
  }
  return Object.fromEntries(Object.entries(result).sort());
}

function collectDuplicate(values, getKey) {
  const byKey = new Map();
  for (const value of values) {
    const key = getKey(value);
    if (!key) continue;
    byKey.set(key, [...(byKey.get(key) || []), value]);
  }
  return Array.from(byKey.entries()).filter(([, owners]) => owners.length > 1);
}

function pairs(values) {
  const result = [];
  for (let left = 0; left < values.length; left += 1) {
    for (let right = left + 1; right < values.length; right += 1) result.push([values[left], values[right]]);
  }
  return result;
}

function messagePatternsOverlap(left, right) {
  if (left === right) return true;
  if (left.endsWith("*") && right.startsWith(left.slice(0, -1))) return true;
  if (right.endsWith("*") && left.startsWith(right.slice(0, -1))) return true;
  return false;
}

function storageConflicts(left, right) {
  if (left.area !== right.area || left.key !== right.key) return false;
  if (!left.property || !right.property) return true;
  return left.property === right.property;
}

function siteRoutesConflict(left, right) {
  if (left.site !== right.site || left.integration !== right.integration) return false;
  if (!left.hosts.some((host) => right.hosts.includes(host))) return false;
  return left.path === right.path && (left.surface || "*") === (right.surface || "*");
}

function propertyLabel(value) {
  return value.property ? `.${value.property}` : ".*";
}

function routeLabel(route) {
  return `${route.site}:${route.integration}:${route.path}:${route.surface || "*"}`;
}

function dockIconPaths(icon) {
  if (!icon) return [];
  if (typeof icon === "string") return [icon];
  return [icon.light, icon.dark].filter(Boolean);
}

function assetKindFor(source, manifest) {
  const asset = (manifest.package?.assets || []).find((candidate) => candidate.path === source);
  if (asset?.kind) return asset.kind;
  if (source === manifest.contentEntry) return "content";
  if ((manifest.css || []).some((sheet) => sheet.path === source)) return "css";
  return "declared";
}

function lifecycleExports(source) {
  const names = new Set();
  const regex = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)/g;
  for (const match of source.matchAll(regex)) names.add(match[1]);
  const namedExportRegex = /export\s*\{([^}]+)\}/g;
  for (const match of source.matchAll(namedExportRegex)) {
    for (const item of match[1].split(",")) {
      const candidate = item.trim().replace(/\/\*[\s\S]*?\*\//g, "");
      const alias = candidate.match(/(?:^|\s)as\s+([A-Za-z_$][\w$]*)$/);
      const direct = candidate.match(/^([A-Za-z_$][\w$]*)$/);
      if (alias) names.add(alias[1]);
      else if (direct) names.add(direct[1]);
    }
  }
  return names;
}

function readFileSyncSafe(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function sha256File(filePath) {
  return sha256Buffer(readFileSync(filePath));
}

function sha256Files(root, files) {
  const hash = createHash("sha256");
  for (const file of files.slice().sort()) {
    hash.update(file);
    hash.update("\0");
    hash.update(readFileSync(path.join(root, file)));
    hash.update("\0");
  }
  return hash.digest("hex");
}

function sha256Buffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function validateZipPackageEntries(archive, entries) {
  if (entries.length === 0) throw new Error("zip archive is empty");
  if (entries.length > 2000) throw new Error(`zip archive has too many files: ${entries.length}`);
  const manifests = entries.map((entry) => entry.fileName).filter((name) => name === "milxdy.app.json" || name.endsWith("/milxdy.app.json"));
  if (!manifests.includes("milxdy.app.json")) throw new Error("zip package must contain milxdy.app.json at the archive root");
  if (manifests.length > 1) throw new Error(`zip package must contain exactly one manifest, found: ${manifests.join(", ")}`);
  for (const entry of entries) {
    if (!isSafeArchivePath(entry.fileName)) throw new Error(`zip entry has unsafe path: ${entry.fileName}`);
    if (entry.encrypted) throw new Error(`zip entry is encrypted and cannot be inspected safely: ${entry.fileName}`);
    if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
      throw new Error(`zip entry uses unsupported compression method ${entry.compressionMethod}: ${entry.fileName}`);
    }
    if (entry.uncompressedSize > 25 * 1024 * 1024) throw new Error(`zip entry is too large: ${entry.fileName}`);
  }
  const totalUncompressed = entries.reduce((sum, entry) => sum + entry.uncompressedSize, 0);
  if (totalUncompressed > 100 * 1024 * 1024) throw new Error(`${archive}: zip package is too large after extraction`);
}

function readZipEntryBuffer(zip, entry) {
  const compressed = zip.subarray(entry.dataOffset, entry.dataOffset + entry.compressedSize);
  if (entry.compressionMethod === 0) {
    if (compressed.byteLength !== entry.uncompressedSize) {
      throw new Error(`${entry.fileName} inflated size mismatch: expected ${entry.uncompressedSize}, got ${compressed.byteLength}`);
    }
    return compressed;
  }
  if (entry.compressionMethod === 8) {
    const inflated = inflateRawSync(compressed, { maxOutputLength: entry.uncompressedSize });
    if (inflated.byteLength !== entry.uncompressedSize) {
      throw new Error(`${entry.fileName} inflated size mismatch: expected ${entry.uncompressedSize}, got ${inflated.byteLength}`);
    }
    return inflated;
  }
  throw new Error(`${entry.fileName} uses unsupported zip compression method ${entry.compressionMethod}`);
}

function listZipEntries(zip) {
  const eocdOffset = findEndOfCentralDirectory(zip);
  const entryCount = zip.readUInt16LE(eocdOffset + 10);
  const directoryOffset = zip.readUInt32LE(eocdOffset + 16);
  let offset = directoryOffset;
  const entries = [];
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > zip.length || zip.readUInt32LE(offset) !== 0x02014b50) throw new Error("invalid zip central directory");
    const flags = zip.readUInt16LE(offset + 8);
    const compressionMethod = zip.readUInt16LE(offset + 10);
    const compressedSize = zip.readUInt32LE(offset + 20);
    const uncompressedSize = zip.readUInt32LE(offset + 24);
    const fileNameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    const localHeaderOffset = zip.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    if (fileNameEnd > zip.length) throw new Error("invalid zip file name length");
    const fileName = zip.subarray(fileNameStart, fileNameEnd).toString("utf8");
    if (!fileName.endsWith("/")) {
      if (localHeaderOffset + 30 > zip.length || zip.readUInt32LE(localHeaderOffset) !== 0x04034b50) throw new Error(`invalid zip local header for ${fileName}`);
      const localNameLength = zip.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = zip.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localNameLength + localExtraLength;
      if (dataOffset + compressedSize > zip.length) throw new Error(`zip entry data is truncated: ${fileName}`);
      entries.push({
        fileName,
        compressionMethod,
        compressedSize,
        uncompressedSize,
        dataOffset,
        encrypted: (flags & 1) === 1,
      });
    }
    offset += 46 + fileNameLength + extraLength + commentLength;
  }
  return entries;
}

function findEndOfCentralDirectory(zip) {
  if (zip.length < 22) throw new Error("invalid zip: too small");
  const minOffset = Math.max(0, zip.length - 65557);
  for (let offset = zip.length - 22; offset >= minOffset; offset -= 1) {
    if (zip.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw new Error("invalid zip: end of central directory not found");
}

function resolveInside(root, relativePath) {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(resolvedRoot, relativePath);
  if (!isPathInside(resolvedRoot, resolved)) {
    throw new Error(`zip entry escapes package root: ${relativePath}`);
  }
  return resolved;
}

function isPathInside(root, candidate) {
  const relativePath = path.relative(root, candidate);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function safeArchiveStem(fileName) {
  return fileName.replace(/\.zip$/i, "").replace(/[^A-Za-z0-9._-]/g, "_") || "package";
}

function compareVersions(left, right) {
  const leftParts = left.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const rightParts = right.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const diff = (leftParts[index] || 0) - (rightParts[index] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function compareCopyMap(left, right) {
  return `${left.packageId}:${left.to}`.localeCompare(`${right.packageId}:${right.to}`);
}

async function writeJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function readArg(name) {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function readRepeatedArg(name) {
  const prefix = `${name}=`;
  return args.filter((arg) => arg.startsWith(prefix)).map((arg) => arg.slice(prefix.length));
}

function hasOwn(value, key) {
  return Object.prototype.hasOwnProperty.call(value || {}, key);
}
