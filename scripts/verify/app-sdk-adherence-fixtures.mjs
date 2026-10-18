import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { collectAdherence, compareBaseline, inspectSource } from "./app-sdk-adherence-graph.mjs";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "sdk-adherence-fixture-"));
try {
  fs.mkdirSync(path.join(root, "src/apps/pilot"), { recursive: true });
  fs.mkdirSync(path.join(root, "src/platform"), { recursive: true });
  fs.writeFileSync(path.join(root, "src/apps/pilot/entry.ts"), 'export * from "./helper.js"; import type { Host } from "../../platform/host.js";');
  fs.writeFileSync(path.join(root, "src/apps/pilot/helper.ts"), '// chrome.storage.local.get({})\nexport function boot(context) { chrome["storage"].local.get({}); context.scheduler.timeout(() => {}, 1); }');
  fs.writeFileSync(path.join(root, "src/platform/host.ts"), 'chrome.storage.local.get({});');
  const result = collectAdherence(root, [{ id: "pilot", entryPoint: "src/apps/pilot/entry.ts" }]);
  assert.equal(result.files.length, 2);
  assert.equal(result.observations.length, 1, "transitive storage survives an unrelated scheduler declaration; comments and type imports do not count");
  const observation = result.observations[0];
  const entry = { ...observation, count: 1, owner: "pilot", reason: "migration", removeWhen: "context storage" };
  assert.equal(compareBaseline(result.observations, { exceptions: [] }).failures.length, 1);
  assert.equal(compareBaseline(result.observations, { exceptions: [entry] }).failures.length, 0);
  assert.equal(compareBaseline([...result.observations, observation], { exceptions: [entry] }).failures.length, 1);
  assert.equal(compareBaseline([], { exceptions: [entry] }).reductions.length, 1);
  const effects = inspectSource('window.manager = new Audio(); export function boot() { window.ready = true; }', 'content.ts').observations;
  assert.equal(effects.filter((finding) => finding.rule === "module-effect").length, 2);
  assert.equal(inspectSource('/* chrome.runtime.getURL("x") */ const text = "chrome.storage.local.get()";', 'content.ts').observations.length, 0);
  assert.equal(inspectSource('import { type Host } from "./host";', 'content.ts').imports.length, 0);
  const immediate = inspectSource('(() => { chrome.storage.local.get({}); })();', 'content.ts').observations;
  assert.equal(immediate.filter((finding) => finding.rule === "browser-storage").length, 1);
  assert.equal(immediate.filter((finding) => finding.rule === "module-effect").length, 1);
  const scheduling = inspectSource('function boot(context) { context.scheduler.idle(() => {}); setInterval(() => {}, 1); }', 'content.ts').observations;
  assert.equal(scheduling.filter((finding) => finding.rule === "native-scheduling").length, 1);
  console.log("SDK adherence fixtures passed: transitive imports, type-only exclusion, comments, effects, new debt, increases and reductions.");
} finally {
  fs.rmSync(root, { recursive: true, force: true });
}
