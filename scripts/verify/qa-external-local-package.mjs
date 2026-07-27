import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const root = await mkdtemp(path.join(os.tmpdir(), "milxdy-external-package-"));
const externalPackage = path.join(root, "dev-note");
const qaOutput = path.join(root, "milXdy-QA", "chromium");

try {
  await cp("examples/packages/local-dev/dev-note", externalPackage, { recursive: true });
  const manifestPath = path.join(externalPackage, "milxdy.app.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.packageKind = "app";
  manifest.surfaces = ["composerAction"];
  manifest.loadTriggers = ["userAction"];
  manifest.composerAction = { label: "Developer Note", presentation: "anchoredPanel" };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const entryPath = path.join(externalPackage, "dist", "content.js");
  await writeFile(entryPath, `${await readFile(entryPath, "utf8")}\nexport function onComposerAction({ panel }) { panel.textContent = "External composer fixture"; }\n`);
  run([
    "scripts/qa/qa-reload.mjs",
    "--once",
    `--publish-dir=${qaOutput}`,
    `--local-app-package=${externalPackage}`,
    "--allow-local-review",
    "--acknowledge-package-consent",
  ]);

  const provenance = JSON.parse(await readFile(path.join(qaOutput, "qa-build.json"), "utf8"));
  assert.equal(provenance.composition.state, "external-local-package");
  assert.match(provenance.composition.fingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(provenance.composition.packages.length, 1);
  const composed = provenance.composition.packages[0];
  assert.equal(composed.id, "dev-note");
  assert.equal(composed.version, "0.1.0");
  for (const key of ["manifestSha256", "contentSha256", "packageSha256"]) assert.match(composed[key], /^[a-f0-9]{64}$/u);
  assert.equal(JSON.stringify(provenance).includes(externalPackage), false);
  assert.equal(provenance.output, "shared-qa-chromium", "QA provenance must use a stable shared-output identity instead of a local path");
  assert.equal(Object.hasOwn(provenance, "worktree"), false, "QA provenance must not retain a local worktree path");
  const compositionReport = await readFile("tmp/qa-local-app-composition/composition-report.json", "utf8");
  assert.equal(compositionReport.includes(externalPackage), false);

  // The generated registry is compiled into content.js. Checking this runtime
  // bundle catches a plan/provenance-only integration that never reaches Apps
  // & Features, which is the registry consumed by the content runtime.
  const runtimeRegistry = await readFile(path.join(qaOutput, "content.js"), "utf8");
  assert.match(
    runtimeRegistry,
    /id:\s*"dev-note"[\s\S]{0,1500}?packageKind:\s*"app"[\s\S]{0,1500}?role:\s*"enablement"/u,
    "staged external composer app must be compiled into the runtime app registry with its generated enablement control",
  );

  run(["scripts/qa/qa-reload.mjs", "--once", `--publish-dir=${qaOutput}`, "--return-to-baseline"]);
  const baseline = JSON.parse(await readFile(path.join(qaOutput, "qa-build.json"), "utf8"));
  assert.equal(baseline.composition.state, "release-baseline");
  assert.equal(baseline.extensionId, provenance.extensionId);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("External local-package QA composition verification passed.");

function run(args) {
  const result = spawnSync(process.execPath, args, { encoding: "utf8" });
  if (result.status === 0) return;
  process.stderr.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  throw new Error(`Verification command failed: ${args.join(" ")}`);
}
