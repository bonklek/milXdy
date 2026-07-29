import { builtinModules } from "node:module";

const NODE_BUILTINS = new Set(builtinModules.map((name) => name.replace(/^node:/, "")));
const UI_FORBIDDEN_GLOBALS = new Set([
  "chrome", "browser", "process", "self", "fetch", "localStorage", "sessionStorage", "indexedDB",
]);

export function verifyArchitecture(inventory, baseline) {
  const failures = [];
  const warnings = [];
  const allowedUnchecked = new Set(baseline.uncheckedProduction || []);
  const allowedWildcardEntries = new Set(baseline.wildcardAppEntries || []);
  const filesByPath = new Map(inventory.files.map((file) => [file.path, file]));

  validateWaivers(baseline, filesByPath, failures);
  for (const file of inventory.files) {
    verifyContractBoundary(file, failures);
    verifyFeatureBoundary(file, failures);
    verifyPlatformBoundary(file, failures);
    verifySizeRatchet(file, baseline, failures, warnings);
    verifyCompilerCoverage(file, allowedUnchecked, failures);
    verifyWildcardExports(file, allowedWildcardEntries, failures);
  }
  validateStaleBaselines(inventory, baseline, failures);
  return { failures, warnings };
}

function verifyContractBoundary(file, failures) {
  if (file.scope !== "contracts") return;
  const forbiddenGlobals = usedGlobals(file);
  if (forbiddenGlobals.length > 0) failures.push(`${file.path}: dependency-free contracts use ambient globals ${forbiddenGlobals.join(", ")}`);
  for (const dependency of file.resolvedImports || []) {
    if (!dependency.path?.startsWith("packages/app-contracts/src/")) {
      failures.push(`${file.path}: contract import escapes its package: ${dependency.specifier}`);
    }
  }
}

function verifyFeatureBoundary(file, failures) {
  const source = featureLayer(file.path);
  if (!source) {
    if (!file.test && /^src\/features\/[^/]+\//.test(file.path)) {
      failures.push(`${file.path}: executable feature code must live in domain, application, adapters, ui, or the explicit index entrypoint`);
    }
    return;
  }
  if (source.layer === "root" && file.wildcardExports.length > 0) {
    failures.push(`${file.path}: feature entrypoints must use explicit named exports`);
  }
  if (source.layer === "domain" || source.layer === "application") {
    for (const global of usedGlobals(file)) failures.push(`${file.path}: ${source.layer} code cannot use ambient ${global}`);
  } else if (source.layer === "ui") {
    for (const global of usedGlobals(file).filter((name) => UI_FORBIDDEN_GLOBALS.has(name))) {
      failures.push(`${file.path}: ui code cannot use ambient ${global}`);
    }
  }
  for (const dependency of file.resolvedImports || []) {
    const target = dependency.path ? featureLayer(dependency.path) : null;
    if (target && target.id !== source.id) {
      failures.push(`${file.path}: cross-feature internal import ${dependency.specifier} resolves to ${dependency.path}`);
      continue;
    }
    if (isNodeImport(dependency.specifier) && source.layer !== "adapters") {
      failures.push(`${file.path}: ${source.layer} code cannot import Node API ${dependency.specifier}`);
      continue;
    }
    if (!dependency.path) continue;
    if (!featureImportAllowed(source, dependency.path, target)) {
      failures.push(`${file.path}: forbidden ${source.layer} dependency ${dependency.specifier} resolves to ${dependency.path}`);
    }
  }
}

function featureImportAllowed(source, targetPath, target) {
  if (targetPath.startsWith("packages/app-contracts/src/")) return true;
  if (source.layer === "domain") return target?.id === source.id && target.layer === "domain";
  if (source.layer === "application") return target?.id === source.id && ["domain", "application"].includes(target.layer);
  if (source.layer === "adapters") {
    return (target?.id === source.id && ["domain", "application", "adapters"].includes(target.layer))
      || targetPath.startsWith("src/platform/");
  }
  if (source.layer === "ui") {
    return (target?.id === source.id && ["application", "ui"].includes(target.layer))
      || targetPath.startsWith("packages/app-sdk/");
  }
  return source.layer === "root" && target?.id === source.id;
}

function verifyPlatformBoundary(file, failures) {
  if (file.scope === "platform") {
    for (const dependency of file.resolvedImports || []) {
      if (dependency.path?.startsWith("src/apps/") || dependency.path?.startsWith("src/features/")) {
        failures.push(`${file.path}: platform code cannot import feature implementation ${dependency.path}`);
      }
    }
  }
  if (file.scope === "public-sdk") {
    for (const dependency of file.resolvedImports || []) {
      if (dependency.path?.startsWith("src/platform/runtime/")) failures.push(`${file.path}: public SDK cannot import internal runtime implementation`);
    }
  }
}

function verifySizeRatchet(file, baseline, failures, warnings) {
  if (file.test) return;
  const size = file.logicalLines;
  const fileCeiling = baseline.oversizedFiles?.[file.path];
  if (size > baseline.limits.fileHard) {
    if (fileCeiling === undefined) failures.push(`${file.path}: new executable file exceeds ${baseline.limits.fileHard} logical lines (${size})`);
    else if (size > fileCeiling) failures.push(`${file.path}: oversized file grew from ceiling ${fileCeiling} to ${size} logical lines`);
    else if (size < fileCeiling) failures.push(`${file.path}: size improved to ${size}; lower its stale baseline ceiling ${fileCeiling}`);
  } else if (fileCeiling !== undefined) {
    failures.push(`${file.path}: file is now within the hard limit; remove its stale baseline ceiling ${fileCeiling}`);
  } else if (size > baseline.limits.fileSoft) {
    warnings.push(`${file.path}: executable file exceeds soft limit ${baseline.limits.fileSoft} (${size})`);
  }
  for (const fn of file.functions) {
    const key = `${file.path}:${fn.id}`;
    const ceiling = baseline.oversizedFunctions?.[key];
    if (fn.logicalLines > baseline.limits.functionHard) {
      if (ceiling === undefined) failures.push(`${key}: new function exceeds ${baseline.limits.functionHard} logical lines (${fn.logicalLines})`);
      else if (fn.logicalLines > ceiling) failures.push(`${key}: oversized function grew from ceiling ${ceiling} to ${fn.logicalLines} logical lines`);
      else if (fn.logicalLines < ceiling) failures.push(`${key}: function improved to ${fn.logicalLines}; lower its stale baseline ceiling ${ceiling}`);
    } else if (ceiling !== undefined) {
      failures.push(`${key}: function is now within the hard limit; remove its stale baseline ceiling ${ceiling}`);
    } else if (fn.logicalLines > baseline.limits.functionSoft) {
      warnings.push(`${key}: function exceeds soft limit ${baseline.limits.functionSoft} (${fn.logicalLines})`);
    }
  }
}

function verifyCompilerCoverage(file, allowedUnchecked, failures) {
  if (!file.path.startsWith("src/") || file.test) return;
  if (file.checked && file.projects.length > 0) return;
  if (!allowedUnchecked.has(file.path)) failures.push(`${file.path}: production source is not checked by an environment TypeScript project`);
}

function verifyWildcardExports(file, allowedEntries, failures) {
  if (file.wildcardExports.length === 0) return;
  if (/^src\/features\/[^/]+\/index\.[jt]s$/.test(file.path)) {
    failures.push(`${file.path}: feature entrypoints must not use wildcard exports`);
  }
  if (/^src\/apps\/[^/]+\/entry\.[jt]s$/.test(file.path) && !allowedEntries.has(file.path)) {
    failures.push(`${file.path}: new wildcard app entry export`);
  }
}

function validateWaivers(baseline, filesByPath, failures) {
  const ids = new Set();
  for (const waiver of baseline.waivers || []) {
    for (const field of ["id", "path", "owner", "rationale", "removalMilestone"]) {
      if (typeof waiver[field] !== "string" || waiver[field].trim() === "") failures.push(`waiver ${waiver.id || "<unknown>"}: missing ${field}`);
    }
    if (!Array.isArray(waiver.tests) || waiver.tests.length === 0) failures.push(`waiver ${waiver.id || "<unknown>"}: tests must be non-empty`);
    if (!Number.isInteger(waiver.maximumLogicalLines)) failures.push(`waiver ${waiver.id || "<unknown>"}: missing maximumLogicalLines`);
    if (ids.has(waiver.id)) failures.push(`duplicate waiver id ${waiver.id}`);
    ids.add(waiver.id);
    const file = filesByPath.get(waiver.path);
    if (!file) failures.push(`waiver ${waiver.id}: path does not exist: ${waiver.path}`);
    else if (file.logicalLines <= baseline.limits.fileEmergency) failures.push(`waiver ${waiver.id}: path no longer exceeds emergency ceiling`);
    else if (waiver.maximumLogicalLines !== baseline.oversizedFiles?.[waiver.path]) failures.push(`waiver ${waiver.id}: maximumLogicalLines must equal the file baseline ceiling`);
  }
  for (const file of filesByPath.values()) {
    if (!file.test && file.logicalLines > baseline.limits.fileEmergency && !(baseline.waivers || []).some((waiver) => waiver.path === file.path)) {
      failures.push(`${file.path}: emergency-size debt requires a complete waiver`);
    }
  }
}

function validateStaleBaselines(inventory, baseline, failures) {
  const files = new Set(inventory.files.map((file) => file.path));
  for (const path of Object.keys(baseline.oversizedFiles || {})) if (!files.has(path)) failures.push(`${path}: stale file baseline`);
  const functions = new Set(inventory.files.flatMap((file) => file.functions.map((fn) => `${file.path}:${fn.id}`)));
  for (const key of Object.keys(baseline.oversizedFunctions || {})) if (!functions.has(key)) failures.push(`${key}: stale function baseline`);
}

function featureLayer(file) {
  const match = file.match(/^src\/features\/([^/]+)(?:\/(domain|application|adapters|ui)(?:\/|$)|\/index\.[jt]s$)/);
  if (!match) return null;
  return { id: match[1], layer: match[2] || "root" };
}

function usedGlobals(file) {
  return Object.entries(file.ambientGlobals || {}).filter(([, count]) => count > 0).map(([name]) => name);
}

function isNodeImport(specifier) {
  if (specifier.startsWith("node:")) return true;
  return NODE_BUILTINS.has(specifier) || NODE_BUILTINS.has(specifier.split("/")[0]);
}
