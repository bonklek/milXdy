import { spawnSync } from "node:child_process";
import path from "node:path";
import { candidateRoot } from "./lib.mjs";

const commands = [
  ["tools/validate.mjs"],
  ["tools/check-links.mjs"],
  ["tools/check-policy.mjs"],
  ["tools/check-path-leaks.mjs"],
  ["tools/check-release-exclusion.mjs"],
  ["--test", "tests/validator.test.mjs"],
];

for (const args of commands) {
  const result = spawnSync(process.execPath, args, {
    cwd: candidateRoot,
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("All visual-elements candidate checks passed.");
