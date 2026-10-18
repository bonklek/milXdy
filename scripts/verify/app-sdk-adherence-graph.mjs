import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

// These checks describe migration debt, not a security sandbox or proof of portability.
export const RULES = {
  "browser-storage": "Inject declared context.storage access and own subscriptions with the activation lifecycle.",
  "browser-assets": "Resolve packaged assets through context.resolveAssetUrl or an injected asset adapter.",
  "browser-messaging": "Use declared host messaging; retain reviewed frame/stream bridges with sender validation.",
  "private-platform-import": "Replace private platform imports with an approved public capability or package-owned adapter.",
  "legacy-context": "Use bounded surface rescans or a declared host action instead of private runtime hooks.",
  "native-scheduling": "Use activation-scoped context.scheduler, or document and test a necessary animation/timing adapter.",
  "document-observer": "Use shared surfaces or constrain an app observer to its owned container and activation.",
  "module-effect": "Move browser mutations and resource creation from module evaluation into boot/dispose.",
};

function accessName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return `${accessName(node.expression)}.${node.name.text}`;
  if (ts.isElementAccessExpression(node) && node.argumentExpression && ts.isStringLiteralLike(node.argumentExpression)) {
    return `${accessName(node.expression)}.${node.argumentExpression.text}`;
  }
  return "";
}

export function inspectSource(source, file) {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const observations = [];
  const imports = [];
  const recorded = new Set();
  const add = (rule, node) => {
    const position = node.getStart(ast);
    const key = `${rule}:${position}`;
    if (recorded.has(key)) return;
    recorded.add(key);
    observations.push({ rule, file, line: ast.getLineAndCharacterOfPosition(position).line + 1 });
  };
  function visit(node, deferred = false) {
    // Function bodies are deferred, but calls in variable initializers and IIFEs execute on import.
    const nextDeferred = deferred || ts.isFunctionLike(node);
    if ((ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly)
      || (ts.isExportDeclaration(node) && !node.isTypeOnly)) {
      const specifier = node.moduleSpecifier;
      const runtimeBindings = !ts.isImportDeclaration(node) || !node.importClause?.namedBindings
        || !ts.isNamedImports(node.importClause.namedBindings) || node.importClause.name
        || node.importClause.namedBindings.elements.some((element) => !element.isTypeOnly);
      if (specifier && ts.isStringLiteralLike(specifier) && runtimeBindings) imports.push({ specifier: specifier.text, node });
    }
    if (ts.isCallExpression(node)) {
      const name = accessName(node.expression);
      if (/^(chrome|browser)\.storage\.(local|sync)\.(get|set|remove|clear)$/.test(name)
        || /^(chrome|browser)\.storage\.onChanged\.(addListener|removeListener)$/.test(name)) add("browser-storage", node);
      if (/^(chrome|browser)\.runtime\.getURL$/.test(name)) add("browser-assets", node);
      if (/^(chrome|browser)\.runtime\.(sendMessage|connect)$/.test(name)) add("browser-messaging", node);
      if (/\.(scheduleScan|loadAppById)$/.test(name)) add("legacy-context", node);
      if (/^(?:(?:window|globalThis)\.)?(setTimeout|setInterval|requestIdleCallback)$/.test(name)) add("native-scheduling", node);
      if (/\.observe$/.test(name) && /^(document|document\.body|document\.documentElement)$/.test(accessName(node.arguments[0] ?? node))) add("document-observer", node);
      if (!deferred && /^(document\..*\.(append|appendChild|prepend|setAttribute)|window\.addEventListener|(?:chrome|browser)\.storage\..*|setInterval|setTimeout)$/.test(name)) add("module-effect", node);
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteralLike(node.arguments[0])) {
        imports.push({ specifier: node.arguments[0].text, node });
      }
      // An immediately invoked function is evaluated now, unlike an exported callback.
      let callee = node.expression;
      while (ts.isParenthesizedExpression(callee)) callee = callee.expression;
      if (!deferred && (ts.isArrowFunction(callee) || ts.isFunctionExpression(callee))) {
        visit(callee.body, false);
      }
    }
    if (!deferred && ts.isNewExpression(node) && /^(Worker|SharedWorker|Audio|WebSocket|MutationObserver)$/.test(accessName(node.expression))) add("module-effect", node);
    if (!deferred && ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken
      && /^(window\.|document\.)/.test(accessName(node.left))) add("module-effect", node);
    ts.forEachChild(node, (child) => visit(child, nextDeferred));
  }
  visit(ast);
  return { observations, imports: imports.map(({ specifier, node }) => ({ specifier, line: ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1 })) };
}

function resolveImport(root, importer, specifier) {
  if (!specifier.startsWith(".")) return null;
  const base = path.resolve(root, path.dirname(importer), specifier);
  const candidates = [base, base.replace(/\.js$/, ".ts"), `${base}.ts`, `${base}.tsx`, `${base}.js`, `${base}/index.ts`, `${base}/index.js`];
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null;
}

export function collectAdherence(root, registry) {
  const observations = [];
  const files = new Set();
  for (const app of registry) {
    const seen = new Set();
    const queue = [app.entryPoint].filter(Boolean);
    while (queue.length) {
      const file = queue.shift();
      if (seen.has(file) || !/\.[cm]?[jt]sx?$/.test(file) || /\.(test|spec)\./.test(file)) continue;
      seen.add(file);
      files.add(file);
      const result = inspectSource(fs.readFileSync(path.join(root, file), "utf8"), file);
      observations.push(...result.observations.map((finding) => ({ app: app.id, ...finding })));
      for (const dependency of result.imports) {
        const resolved = resolveImport(root, file, dependency.specifier);
        if (!resolved) continue;
        const relative = path.relative(root, resolved).split(path.sep).join("/");
        if (relative.startsWith("src/platform/")) {
          observations.push({ app: app.id, file, rule: "private-platform-import", line: dependency.line });
          continue; // Browser work in the host is not app-owned debt.
        }
        if (!relative.startsWith("../") && !relative.startsWith("node_modules/")) queue.push(relative);
      }
    }
  }
  return { files: [...files].sort(), observations };
}

export function compareBaseline(observations, baseline) {
  const actual = new Map();
  for (const finding of observations) {
    const key = `${finding.app}:${finding.file}:${finding.rule}`;
    const item = actual.get(key) ?? { ...finding, count: 0 };
    item.count++;
    actual.set(key, item);
  }
  const failures = [];
  const allowances = new Map();
  for (const entry of baseline.exceptions) {
    const key = `${entry.app}:${entry.file}:${entry.rule}`;
    if (allowances.has(key)) failures.push(`Duplicate exception: ${key}`);
    if (!RULES[entry.rule] || !entry.owner || !entry.reason || !entry.removeWhen || !Number.isInteger(entry.count) || entry.count < 1) failures.push(`Invalid exception: ${key}`);
    allowances.set(key, entry);
  }
  for (const [key, item] of actual) {
    if (item.count > (allowances.get(key)?.count ?? 0)) failures.push(`${key}:${item.line}: ${item.count} occurrence(s), allowed ${allowances.get(key)?.count ?? 0}`);
  }
  const reductions = [...allowances].filter(([key, entry]) => (actual.get(key)?.count ?? 0) < entry.count)
    .map(([key, entry]) => `${key}: ${entry.count} -> ${actual.get(key)?.count ?? 0}`);
  return { failures, reductions };
}
