import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, rm } from "node:fs/promises";

/** Ship the reviewed creation tools in normal full Chromium installs too.
 * Explicit custom selections remain authoritative, including empty selections.
 * Composition verifies current package/manifest pins and all capability gates.
 */
export async function resolveCreationPlan({ target, profile, explicitPlan, outputDir }) {
  if (explicitPlan) return JSON.parse(await readFile(explicitPlan, "utf8"));
  if (target !== "chromium" || profile !== "full") return null;
  await mkdir("tmp", { recursive: true });
  const staging = await mkdtemp("tmp/default-creation-");
  try {
    const planPath = `${staging}/build-plan.json`;
    const result = spawnSync(process.execPath, [
      "scripts/packages/compose-local-app-packages.mjs",
      "--package=packages/maintainer/tweet-composer-kit",
      "--package=examples/packages/first-party-replacements/tweetPng",
      "--acknowledge-package-consent", "--acknowledge-first-party-replacement",
      `--out-dir=${staging}`, `--plan-out=${planPath}`, `--build-output-dir=${outputDir}`,
    ], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8" });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Reviewed creation defaults failed validation: ${result.stderr || result.stdout}`);
    const plan = JSON.parse(await readFile(planPath, "utf8"));
    for (const id of ["tweet-composer-kit", "tweetPng"]) {
      const app = plan.apps.find(app => app.id === id);
      const review = plan.diagnostics.find(item => item.packageId === id);
      if (!app?.available || !app.defaultEnabled || review?.trust?.reviewStatus !== "reviewed") {
        throw new Error(`Creation default ${id} must be available, default-enabled and exactly reviewed.`);
      }
    }
    return plan;
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

export function defaultBrowserOutputDir(target, profile, channel) {
  const targetChannel = channel === "qa" ? `${target}-qa` : target;
  return profile === "full" ? `dist/${targetChannel}` : `dist/${targetChannel}-${profile}`;
}
