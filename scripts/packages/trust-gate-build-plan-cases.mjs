import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export function createBuildPlanCases({ composer, builder, buildTmpRoot, failures, notes, toPosix, safeFixtureName }) {
  async function composeBuildPlan(label, options = {}) {
    const fixtureRoot = path.join(buildTmpRoot, label, "packages");
    await mkdir(path.dirname(fixtureRoot), { recursive: true });
    const packageDir = path.join(fixtureRoot, "tweetPng");
    const packagePath = options.packagePath || path.join("examples/packages/first-party-replacements", "tweetPng");
    if (!options.packagePath) {
      await mkdir(packageDir, { recursive: true });
    }
    const planPath = path.join(buildTmpRoot, label, "build-plan.json");
    const result = spawnSync(process.execPath, [
      composer,
      `--package=${toPosix(packagePath)}`,
      `--plan-out=${toPosix(planPath)}`,
      "--allow-local-review",
      "--acknowledge-package-consent",
      "--acknowledge-first-party-replacement",
      ...(options.extraArgs || []),
    ], {
      encoding: "utf8",
    });
    const output = `${result.stdout || ""}${result.stderr || ""}`;
    if ((result.status ?? 1) !== 0) {
      failures.push(`${label}: unable to compose build plan\n${output}`);
      return null;
    }
    const plan = JSON.parse(await readFile(planPath, "utf8"));
    plan.outputDir = toPosix(path.join(buildTmpRoot, label, "out"));
    return plan;
  }

  async function runBuildPlanCase(label, basePlan, mutatePlan, expectedStatus, expectedText) {
    if (!basePlan) return;
    const plan = JSON.parse(JSON.stringify(basePlan));
    mutatePlan(plan);
    const planPath = path.join(buildTmpRoot, `${safeFixtureName(label).replaceAll("_", "-")}.json`);
    await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
    const build = spawnSync(process.execPath, [
      builder,
      "--target=chromium",
      `--local-app-plan=${toPosix(planPath)}`,
    ], {
      encoding: "utf8",
    });
    const output = `${build.stdout || ""}${build.stderr || ""}`;
    const actualStatus = build.status ?? 1;
    if (actualStatus !== expectedStatus) {
      failures.push(`${label}: expected exit ${expectedStatus}, got ${actualStatus}\n${output}`);
      return;
    }
    if (expectedText && !output.includes(expectedText)) {
      failures.push(`${label}: expected output to include ${JSON.stringify(expectedText)}\n${output}`);
      return;
    }
    notes.push(`${label}: ok`);
  }
  return { composeBuildPlan, runBuildPlanCase };
}
