import { readFileSync } from "node:fs";
import path from "node:path";
import { createBaselineTemplate, inventoryRepository } from "./architecture-model.mjs";

const root = process.cwd();
const baselinePath = path.join(root, "architecture-baseline.json");
let baseline = {};
try {
  baseline = JSON.parse(readFileSync(baselinePath, "utf8"));
} catch {
  // Inventory remains useful before the first baseline is committed.
}

const inventory = inventoryRepository(root, baseline);
const output = process.argv.includes("--baseline-template") ? createBaselineTemplate(inventory) : inventory;
console.log(JSON.stringify(output, null, 2));
