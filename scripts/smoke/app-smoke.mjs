import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const releaseGate = await readFile("scripts/release/verify-release-gates.mjs", "utf8");

assert(packageJson.version !== "0.2.0", "current app smoke is for the active release line; use verify:app-smoke:020 for 0.2.0 evidence");
assert(typeof packageJson.scripts?.["verify:app-smoke"] === "string", "package scripts must include verify:app-smoke");
assert(typeof packageJson.scripts?.["verify:app-smoke:020"] === "string", "package scripts must retain verify:app-smoke:020");
assert(releaseGate.includes("scripts/smoke/app-smoke.mjs"), "current release gate must run the current app smoke verifier");

const historical = spawnSync(process.execPath, ["scripts/smoke/app-smoke-020.mjs"], {
  cwd: process.cwd(),
  stdio: "inherit",
  windowsHide: true,
});
if (historical.error) throw historical.error;
if (historical.status !== 0) process.exit(historical.status ?? 1);

console.log(`Current app smoke verification passed for ${packageJson.version}.`);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
