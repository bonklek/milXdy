import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

const firstPartyRegistry = JSON.parse(await readFile("src/platform/app-sdk/first-party-apps.json", "utf8"));
const firstPartyIds = new Set(firstPartyRegistry.map((app) => app.id));
const args = process.argv.slice(2).filter((arg) => arg !== "--");
const selectedInputs = args.filter((arg) => arg.startsWith("--package=") || arg.startsWith("--packages-dir="));
if (selectedInputs.length === 0) {
  console.error("verify:local-app-package requires --package=<path> or --packages-dir=<path>.");
  console.error("It intentionally does not fall back to examples/packages/first-party-replacements.");
  process.exit(1);
}

const forbiddenPassThrough = new Set(["--check", "--json"]);
const passThrough = args.filter((arg) => (
  !forbiddenPassThrough.has(arg)
  && !arg.startsWith("--out-dir=")
  && !arg.startsWith("--plan-out=")
));
const tempDir = path.join("tmp", `local-app-package-verify-${process.pid}-${Date.now()}`);
const planPath = path.join(tempDir, "build-plan.json");
try {
  await mkdir(tempDir, { recursive: true });
  const result = spawnSync(process.execPath, [
    "scripts/packages/compose-local-app-packages.mjs",
    `--out-dir=${tempDir}`,
    `--plan-out=${planPath}`,
    ...passThrough,
  ], {
    encoding: "utf8",
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);

  const plan = JSON.parse(await readFile(planPath, "utf8"));
  const generatedErrors = verifyGeneratedPlan(plan);
  if (generatedErrors.length > 0) {
    console.error("Generated local package metadata verification failed:");
    for (const error of generatedErrors) console.error(`  - ${error}`);
    process.exit(1);
  }

  console.log("Generated local package metadata verification passed.");
  for (const app of localApps(plan)) {
    const setting = enablementSetting(app);
    const enablement = setting
      ? `${setting.storage.area}.${setting.storage.key}${setting.storage.property ? `.${setting.storage.property}` : ""}`
      : "none";
    console.log(`  - ${app.id}: defaultEnabled=${app.defaultEnabled}, enablement=${enablement}`);
  }
} finally {
  await rm(tempDir, { recursive: true, force: true });
}

function verifyGeneratedPlan(plan) {
  const errors = [];
  if (plan?.composer !== "milxdy-local-app-composer" || plan.schemaVersion !== 1) {
    return ["composer did not emit a local app build plan"];
  }
  for (const app of localApps(plan)) {
    const webResources = new Set((plan.webAccessibleAssets || []).flatMap((entry) => entry.resources || []));
    const novelPackage = !firstPartyIds.has(app.id);
    if (!app.localPackage) errors.push(`${app.id}: generated registry metadata is missing localPackage`);
    if (app.$schema !== undefined) errors.push(`${app.id}: generated metadata leaked authoring-only $schema`);
    if (app.entryName !== undefined || app.entryPoint !== undefined || app.assets !== undefined || app.requiredOutputs !== undefined) {
      errors.push(`${app.id}: generated metadata leaked first-party build-only fields`);
    }
    if (!/\.m?js$/i.test(app.contentEntry || "")) {
      errors.push(`${app.id}: local package contentEntry must be an executable .js or .mjs module`);
    }
    if (!webResources.has(app.contentEntry)) {
      errors.push(`${app.id}: runtime-imported contentEntry must be web-accessible in the custom build manifest`);
    }
    if (webResources.has("local-app-composition.json")) {
      errors.push("local-app-composition.json must not be web-accessible");
    }
    const setting = enablementSetting(app);
    if (novelPackage && !setting) {
      errors.push(`${app.id}: novel local package must declare a toggle setting with role "enablement" so Apps & Features can control it`);
      continue;
    }
    if (novelPackage && app.defaultEnabled !== false) {
      errors.push(`${app.id}: novel local package samples must defaultEnabled false so enablement is an explicit user action`);
    }
    if (!setting) continue;
    if (app.defaultEnabled === false && setting.defaultValue === true) {
      errors.push(`${app.id}:${setting.id}: enablement setting defaultValue must not override defaultEnabled false`);
    }
    const declaredKeys = app.storageKeys?.[setting.storage.area] || [];
    if (!declaredKeys.includes(setting.storage.key)) {
      errors.push(`${app.id}:${setting.id}: enablement storage key must be declared in storageKeys.${setting.storage.area}`);
    }
  }
  return errors;
}

function localApps(plan) {
  return (plan.apps || []).filter((app) => app?.localPackage);
}

function enablementSetting(app) {
  return (app.settings || []).find((setting) => (
    setting.role === "enablement"
    && setting.control?.type === "toggle"
    && (setting.storage?.area === "local" || setting.storage?.area === "sync")
    && typeof setting.storage?.key === "string"
    && setting.storage.key.length > 0
  ));
}
