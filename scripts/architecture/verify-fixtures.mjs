import assert from "node:assert/strict";
import { verifyArchitecture } from "./architecture-policy.mjs";
import { classifyArchitecturePath } from "./architecture-model.mjs";

const baseline = {
  limits: { fileSoft: 300, fileHard: 500, fileEmergency: 800, functionSoft: 40, functionHard: 80 },
  oversizedFiles: {}, oversizedFunctions: {}, uncheckedProduction: [], wildcardAppEntries: [], waivers: [],
};

rejects("platform to feature", file("src/platform/runtime/x.ts", "platform", "../../features/alpha/domain/rule", "src/features/alpha/domain/rule.ts"), "platform code cannot import feature");
rejects("contract to Node builtin", file("packages/app-contracts/src/unsafe.ts", "contracts", "crypto", null), "contract import escapes its package: crypto");
rejects("contract to external package", file("packages/app-contracts/src/unsafe.ts", "contracts", "left-pad", null), "contract import escapes its package: left-pad");
rejects("resolved cross-feature relative import", file("src/features/alpha/application/use.ts", "feature-application", "../../beta/domain/rule", "src/features/beta/domain/rule.ts"), "cross-feature internal import");
rejects("domain to adapter", file("src/features/alpha/domain/rule.ts", "feature-domain", "../adapters/chrome", "src/features/alpha/adapters/chrome.ts"), "forbidden domain dependency");
rejects("application to UI", file("src/features/alpha/application/use.ts", "feature-application", "../ui/view", "src/features/alpha/ui/view.ts"), "forbidden application dependency");
rejects("adapter to UI", file("src/features/alpha/adapters/chrome.ts", "feature-adapters", "../ui/view", "src/features/alpha/ui/view.ts"), "forbidden adapters dependency");
rejects("UI to platform", file("src/features/alpha/ui/view.ts", "feature-ui", "../../../platform/runtime/content-runtime", "src/platform/runtime/content-runtime.ts"), "forbidden ui dependency");
rejects("bare Node builtin", file("src/features/alpha/domain/rule.ts", "feature-domain", "crypto", null), "cannot import Node API crypto");
rejects("bare Node builtin subpath", file("src/features/alpha/application/use.ts", "feature-application", "assert/strict", null), "cannot import Node API assert/strict");
rejects("feature wildcard entry", { ...file("src/features/alpha/index.ts", "other"), wildcardExports: ["./domain"] }, "must use explicit named exports");
for (const authority of ["globalThis", "self", "fetch", "localStorage", "indexedDB", "chrome", "process"]) {
  rejects(`domain ambient ${authority}`, { ...file("src/features/alpha/domain/rule.ts", "feature-domain"), ambientGlobals: { [authority]: 1 } }, `ambient ${authority}`);
}
rejects("UI ambient Chrome", { ...file("src/features/alpha/ui/view.ts", "feature-ui"), ambientGlobals: { chrome: 1 } }, "ui code cannot use ambient chrome");
rejects("new unchecked production", { ...file("src/new.js", "other"), checked: false, projects: [] }, "not checked by an environment TypeScript project");
assert.equal(classifyArchitecturePath("packages/app-sdk/src/index.ts"), "public-sdk", "future packaged SDK sources must be classified as public SDK");
rejects("future packaged public SDK to runtime", file(
  "packages/app-sdk/src/index.ts",
  classifyArchitecturePath("packages/app-sdk/src/index.ts"),
  "../../../src/platform/runtime/content-runtime",
  "src/platform/runtime/content-runtime.ts",
), "public SDK cannot import internal runtime implementation");
rejects("unsupported feature-root implementation", file("src/features/alpha/helper.ts", "other"), "executable feature code must live in domain, application, adapters, ui, or the explicit index entrypoint");
const featureRootTest = { ...file("src/features/alpha/helper.test.ts", "other"), test: true };
assert.deepEqual(verifyArchitecture({ files: [featureRootTest] }, baseline).failures, [], "feature tests may remain colocated without becoming production layer bypasses");

const shrunkFile = file("src/legacy.ts", "other");
shrunkFile.logicalLines = 600;
rejectsWithBaseline("shrunk debt requires an exact lower ceiling", shrunkFile, {
  ...baseline,
  oversizedFiles: { [shrunkFile.path]: 650 },
}, "size improved to 600; lower its stale baseline ceiling 650");

const regrownFile = file("src/legacy.ts", "other");
regrownFile.logicalLines = 620;
rejectsWithBaseline("regrowth after baseline tightening", regrownFile, {
  ...baseline,
  oversizedFiles: { [regrownFile.path]: 600 },
}, "oversized file grew from ceiling 600 to 620 logical lines");

const relocatedFunction = file("src/legacy.ts", "other");
relocatedFunction.functions = [{ id: "largeTask#1", name: "largeTask", startLine: 900, logicalLines: 90 }];
const relocationResult = verifyArchitecture({ files: [relocatedFunction] }, {
  ...baseline,
  oversizedFunctions: { "src/legacy.ts:largeTask#1": 90 },
});
assert.deepEqual(relocationResult.failures, [], `function relocation must not change its stable debt identity: ${relocationResult.failures.join(" | ")}`);

const emergencyFile = file("src/emergency.ts", "other");
emergencyFile.logicalLines = 900;
rejectsWithBaseline("emergency debt without waiver", emergencyFile, {
  ...baseline,
  oversizedFiles: { [emergencyFile.path]: 900 },
}, "emergency-size debt requires a complete waiver");

console.log("Architecture negative fixtures passed.");

function rejects(label, subject, expected) {
  rejectsWithBaseline(label, subject, baseline, expected);
}

function rejectsWithBaseline(label, subject, subjectBaseline, expected) {
  const result = verifyArchitecture({ files: [subject] }, subjectBaseline);
  assert(result.failures.some((failure) => failure.includes(expected)), `${label}: expected ${expected}; got ${result.failures.join(" | ")}`);
}

function file(path, scope, specifier, resolvedPath) {
  return {
    path, scope, test: false, checked: true, projects: ["fixture"], logicalLines: 1, physicalLines: 1,
    functions: [], imports: specifier ? [specifier] : [], resolvedImports: specifier ? [{ specifier, path: resolvedPath }] : [],
    wildcardExports: [], ambientGlobals: {},
  };
}
