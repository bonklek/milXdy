import fs from "node:fs";
import { collectAdherence, compareBaseline } from "./app-sdk-adherence-graph.mjs";
import { verifyHostActions, verifyStorageResources } from "../packages/local-app-capability-validation.mjs";

const registry = JSON.parse(fs.readFileSync("src/platform/app-sdk/first-party-apps.json", "utf8"));
const baseline = JSON.parse(fs.readFileSync("scripts/verify/app-sdk-adherence-baseline.json", "utf8"));
const result = collectAdherence(process.cwd(), registry);
const comparison = compareBaseline(result.observations, baseline);
for (const app of registry) {
  const fail = (message) => comparison.failures.push(message);
  verifyHostActions(app.id, app, fail);
  verifyStorageResources(app.id, app, fail);
}
console.log(`SDK adherence graph: ${registry.length} registered apps, ${result.files.length} reachable source files, ${result.observations.length} known migration observations.`);
for (const failure of comparison.failures) console.error(failure);
for (const reduction of comparison.reductions) console.log(`Tighten resolved exception: ${reduction}`);
if (comparison.failures.length || comparison.reductions.length) process.exitCode = 1;
else console.log("SDK adherence ratchet passed. Existing exceptions are migration work, not public SDK certification.");
