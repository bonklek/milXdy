import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
if (args.includes("--check")) {
  throw new Error("build-local-apps does not accept --check because it needs a generated build plan. Use pnpm.cmd run verify:local-app-composer for check-only validation.");
}
if (args.length === 0 && !existsSync("local-app-packages")) {
  console.error("The default checked-in local app examples replace first-party app IDs and declare privileged package surfaces.");
  console.error("Run pnpm.cmd run build:local-apps:chromium -- --allow-local-review --acknowledge-package-consent --acknowledge-first-party-replacement to build that explicit fallback.");
  process.exit(1);
}

const outDir = readArg("--out-dir") ?? "tmp/local-app-composition";
const planOut = readArg("--plan-out") ?? path.join(outDir, "build-plan.json");
const composeArgs = [
  "scripts/packages/compose-local-app-packages.mjs",
  ...args,
  args.some((arg) => arg.startsWith("--plan-out=")) ? null : `--plan-out=${planOut}`,
].filter(Boolean);

run(composeArgs);
run([
  "scripts/build/build-extension.mjs",
  "--target=chromium",
  `--local-app-plan=${planOut}`,
]);

function run(commandArgs) {
  const result = spawnSync(process.execPath, commandArgs, {
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function readArg(name) {
  const prefix = `${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}
