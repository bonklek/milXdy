import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import ts from "typescript";

const EXECUTABLE_EXTENSION = /\.(?:[cm]?[jt]sx?)$/;
const TEST_FILE = /(?:^|\.)test\.[cm]?[jt]sx?$/;
const ROOTS = ["src", "packages", "scripts", "sdk"];
const AMBIENT_GLOBALS = new Set([
  "chrome", "browser", "window", "document", "globalThis", "self", "process",
  "fetch", "localStorage", "sessionStorage", "indexedDB", "navigator", "location", "history",
]);
// The 0.2.4 tree still uses a root project plus the public SDK project. Keep
// coverage aligned with configs that actually exist instead of importing the
// historical multi-project split as a prerequisite for the architecture gate.
const PROJECT_CONFIGS = ["tsconfig.json", "sdk/tsconfig.json"];

export function inventoryRepository(root, baseline = {}) {
  const coverage = compilerCoverage(root);
  const files = ROOTS.flatMap((directory) => walk(path.join(root, directory)))
    .filter((file) => EXECUTABLE_EXTENSION.test(file))
    .map((file) => inspectFile(root, file, coverage))
    .sort((left, right) => left.path.localeCompare(right.path));
  return {
    schemaVersion: 1,
    summary: summarize(files),
    waivers: baseline.waivers || [],
    files,
  };
}

export function createBaselineTemplate(inventory) {
  const limits = { fileSoft: 300, fileHard: 500, fileEmergency: 800, functionSoft: 40, functionHard: 80 };
  const oversizedFiles = Object.fromEntries(inventory.files
    .filter((file) => !file.test && file.logicalLines > 500)
    .map((file) => [file.path, file.logicalLines]));
  const oversizedFunctions = Object.fromEntries(inventory.files.flatMap((file) => file.functions
    .filter((fn) => !file.test && fn.logicalLines > 80)
    .map((fn) => [`${file.path}:${fn.id}`, fn.logicalLines])));
  const uncheckedProduction = inventory.files
    .filter((file) => file.path.startsWith("src/") && !file.test && file.checked === false)
    .map((file) => file.path);
  const wildcardAppEntries = inventory.files
    .filter((file) => /^src\/apps\/[^/]+\/entry\.[jt]s$/.test(file.path) && file.wildcardExports.length > 0)
    .map((file) => file.path);
  const waivers = inventory.files
    .filter((file) => !file.test && file.logicalLines > limits.fileEmergency)
    .map((file) => ({
      id: `existing-emergency-${file.path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase()}`,
      path: file.path,
      owner: "release-maintainer",
      rationale: "Pre-existing 0.2.4 monolith retained behind an exact non-growth baseline during current-base consolidation.",
      removalMilestone: "post-0.2.4 architecture reduction",
      tests: ["npm run verify:architecture"],
      maximumLogicalLines: oversizedFiles[file.path],
    }));
  return {
    schemaVersion: 1,
    limits,
    oversizedFiles,
    oversizedFunctions,
    uncheckedProduction,
    wildcardAppEntries,
    waivers,
  };
}

function inspectFile(root, absolutePath, coverage) {
  const source = readFileSync(absolutePath, "utf8");
  const relativePath = normalize(path.relative(root, absolutePath));
  const sourceFile = ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, scriptKind(relativePath));
  const imports = [];
  const wildcardExports = [];
  const functions = [];
  const ambientGlobals = Object.fromEntries(Array.from(AMBIENT_GLOBALS, (name) => [name, 0]));
  visit(sourceFile);
  const functionOccurrences = new Map();
  const identifiedFunctions = functions.sort((left, right) => left.startLine - right.startLine).map((fn) => {
    const occurrence = (functionOccurrences.get(fn.name) || 0) + 1;
    functionOccurrences.set(fn.name, occurrence);
    return { ...fn, id: `${fn.name}#${occurrence}` };
  });
  return {
    path: relativePath,
    scope: classifyArchitecturePath(relativePath),
    test: TEST_FILE.test(relativePath),
    checked: coverage.get(relativePath)?.checked === true,
    projects: Array.from(coverage.get(relativePath)?.projects || []).sort(),
    physicalLines: lineCount(source),
    logicalLines: logicalLineCount(source),
    imports: Array.from(new Set(imports)).sort(),
    resolvedImports: Array.from(new Set(imports)).map((specifier) => ({
      specifier,
      path: resolveImport(root, relativePath, specifier),
    })),
    wildcardExports: Array.from(new Set(wildcardExports)).sort(),
    ambientGlobals,
    functions: identifiedFunctions.sort((left, right) => right.logicalLines - left.logicalLines),
  };

  function visit(node) {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      imports.push(node.moduleSpecifier.text);
      if (ts.isExportDeclaration(node) && !node.exportClause) wildcardExports.push(node.moduleSpecifier.text);
    }
    if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      imports.push(node.arguments[0].text);
    }
    if (ts.isIdentifier(node) && AMBIENT_GLOBALS.has(node.text) && isReferenceIdentifier(node)) {
      ambientGlobals[node.text] += 1;
    }
    if (isFunctionLike(node) && node.body) {
      const startLine = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      const endLine = sourceFile.getLineAndCharacterOfPosition(node.end).line + 1;
      functions.push({
        name: functionName(node),
        startLine,
        physicalLines: endLine - startLine + 1,
        logicalLines: logicalLineCount(source.slice(node.getStart(sourceFile), node.end)),
      });
    }
    ts.forEachChild(node, visit);
  }
}

function walk(root) {
  try {
    return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
      const child = path.join(root, entry.name);
      if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "dist" ? [] : walk(child);
      return entry.isFile() ? [child] : [];
    });
  } catch {
    return [];
  }
}

function summarize(files) {
  const production = files.filter((file) => !file.test);
  return {
    executableFiles: files.length,
    productionFiles: production.length,
    physicalLines: production.reduce((sum, file) => sum + file.physicalLines, 0),
    filesOver300: production.filter((file) => file.logicalLines > 300).length,
    filesOver500: production.filter((file) => file.logicalLines > 500).length,
    filesOver800: production.filter((file) => file.logicalLines > 800).length,
    uncheckedProductionFiles: production.filter((file) => file.path.startsWith("src/") && !file.checked).length,
  };
}

export function classifyArchitecturePath(file) {
  if (file.startsWith("packages/app-contracts/")) return "contracts";
  if (file.startsWith("packages/app-sdk/")) return "public-sdk";
  const feature = file.match(/^src\/features\/[^/]+\/(domain|application|adapters|ui)\//);
  if (feature) return `feature-${feature[1]}`;
  if (file.startsWith("src/extension/")) return "extension";
  if (file.startsWith("src/platform/")) return "platform";
  if (file.startsWith("src/apps/")) return "legacy-feature";
  if (file.startsWith("scripts/")) return "node-tool";
  if (file.startsWith("sdk/")) return "public-sdk";
  return "other";
}

function isFunctionLike(node) {
  return ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)
    || ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)
    || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node);
}

function functionName(node) {
  if (node.name && ts.isIdentifier(node.name)) return node.name.text;
  const parent = node.parent;
  if (parent && ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name)) return parent.name.text;
  if (ts.isConstructorDeclaration(node)) return "constructor";
  return `<anonymous@${node.pos}>`;
}

function isReferenceIdentifier(node) {
  const parent = node.parent;
  if (!parent) return true;
  if ((ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isPropertyAssignment(parent) && parent.name === node)) return false;
  if (ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) || ts.isPropertySignature(parent) || ts.isMethodSignature(parent)) return false;
  return true;
}

function scriptKind(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".js") || file.endsWith(".mjs") || file.endsWith(".cjs")) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function lineCount(source) {
  return source.length === 0 ? 0 : source.split(/\r?\n/).length;
}

function logicalLineCount(source) {
  return source.split(/\r?\n/).filter((line) => {
    const trimmed = line.trim();
    return trimmed.length > 0 && !trimmed.startsWith("//") && !trimmed.startsWith("/*") && !trimmed.startsWith("*");
  }).length;
}

function normalize(value) {
  return value.replaceAll("\\", "/");
}

function compilerCoverage(root) {
  const coverage = new Map();
  for (const configPath of PROJECT_CONFIGS) {
    const absoluteConfig = path.join(root, configPath);
    const config = ts.readConfigFile(absoluteConfig, ts.sys.readFile);
    if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(absoluteConfig), {}, absoluteConfig);
    const program = ts.createProgram({ rootNames: parsed.fileNames, options: parsed.options });
    for (const sourceFile of program.getSourceFiles()) {
      const relative = normalize(path.relative(root, sourceFile.fileName));
      if (relative.startsWith("../") || sourceFile.isDeclarationFile) continue;
      const entry = coverage.get(relative) || { checked: false, projects: new Set() };
      entry.projects.add(configPath);
      const javascript = /\.[cm]?jsx?$/.test(relative);
      if (!javascript || parsed.options.checkJs === true) entry.checked = true;
      coverage.set(relative, entry);
    }
  }
  return coverage;
}

function resolveImport(root, fromFile, specifier) {
  if (specifier === "@milxdy/app-contracts") return "packages/app-contracts/src/index.ts";
  if (specifier.startsWith("@milxdy/app-contracts/")) {
    return `packages/app-contracts/src/${specifier.slice("@milxdy/app-contracts/".length)}.ts`;
  }
  if (!specifier.startsWith(".") && !specifier.startsWith("src/") && !specifier.startsWith("packages/")) return null;
  const base = specifier.startsWith(".")
    ? normalize(path.posix.join(path.posix.dirname(fromFile), specifier))
    : normalize(specifier);
  const candidates = [base, `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}.mjs`, `${base}/index.ts`, `${base}/index.js`];
  return candidates.find((candidate) => existsSync(path.join(root, candidate))) || normalize(path.posix.normalize(base));
}
