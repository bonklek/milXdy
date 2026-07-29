import { readFileSync } from "node:fs";
import path from "node:path";
import { inventoryRepository } from "./architecture-model.mjs";
import { verifyArchitecture } from "./architecture-policy.mjs";

const root = process.cwd();
const baseline = JSON.parse(readFileSync(path.join(root, "architecture-baseline.json"), "utf8"));
const inventory = inventoryRepository(root, baseline);
const result = verifyArchitecture(inventory, baseline);

for (const warning of result.warnings) console.warn(`Architecture warning: ${warning}`);
if (result.failures.length > 0) {
  console.error("Architecture verification failed:");
  for (const failure of result.failures) console.error(`  - ${failure}`);
  process.exit(1);
}

console.log("Architecture verification passed.");
console.log(`  production files: ${inventory.summary.productionFiles}`);
console.log(`  files over 500 logical lines (baselined): ${inventory.summary.filesOver500}`);
console.log(`  unchecked production files (baselined): ${inventory.summary.uncheckedProductionFiles}`);
