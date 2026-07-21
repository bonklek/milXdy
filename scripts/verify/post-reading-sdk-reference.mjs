import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const workspace = process.cwd();
const referenceRepo = path.resolve(process.env.POST_READING_REPO || path.join(workspace, "..", "post-reading-sdk"));
const stageRoot = path.resolve("tmp/post-reading-sdk-reference");
const packageRoot = path.join(stageRoot, "post-reading");
const compositionRoot = path.join(stageRoot, "composition");
const planPath = path.join(compositionRoot, "build-plan.json");
const packageInput = "tmp/post-reading-sdk-reference/post-reading";
const compositionInput = "tmp/post-reading-sdk-reference/composition";
const planInput = "tmp/post-reading-sdk-reference/composition/build-plan.json";
const replacementPolicies = JSON.parse(await readFile("scripts/packages/local-app-first-party-replacements.json", "utf8"));
const referencePolicy = replacementPolicies.replacements?.find((candidate) => candidate.id === "post-reading");
if (!referencePolicy?.sourceUrl || !referencePolicy?.sourceCommit) {
  throw new Error("Post-reading replacement policy must pin sourceUrl and sourceCommit");
}
const expectedSourceUrl = referencePolicy.sourceUrl;

if (!existsSync(path.join(referenceRepo, "package.json"))) {
  throw new Error(`Post-reading checkout not found at ${referenceRepo}. Set POST_READING_REPO to its path.`);
}

const remote = run("git", ["config", "--get", "remote.origin.url"], referenceRepo, true).stdout.trim();
if (!remoteMatches(remote, expectedSourceUrl)) {
  throw new Error(`Post-reading origin ${remote || "<missing>"} does not match ${expectedSourceUrl}`);
}
const sourceCommit = run("git", ["rev-parse", "HEAD"], referenceRepo, true).stdout.trim();
if (sourceCommit !== referencePolicy.sourceCommit) {
  throw new Error(`Post-reading checkout ${sourceCommit} does not match pinned commit ${referencePolicy.sourceCommit}`);
}

try {
  run(process.execPath, ["scripts/build-milxdy-package.mjs"], referenceRepo);
  run(process.execPath, ["scripts/verify-milxdy-package.mjs"], referenceRepo);

  const externalCompatibility = JSON.parse(await readFile(path.join(referenceRepo, "milxdy.compatibility.json"), "utf8"));
  const localCompatibility = JSON.parse(await readFile("sdk/references/post-reading.compatibility.json", "utf8"));
  assertEqual(externalCompatibility, localCompatibility, "Post-reading compatibility contract drifted from the milXdy mirror");

  await rm(stageRoot, { recursive: true, force: true });
  await mkdir(stageRoot, { recursive: true });
  await cp(path.join(referenceRepo, "dist", "milxdy-package"), packageRoot, { recursive: true });

  const stagedManifestPath = path.join(packageRoot, "milxdy.app.json");
  const stagedContentPath = path.join(packageRoot, "dist", "content.js");
  const stagedManifest = JSON.parse(await readFile(stagedManifestPath, "utf8"));
  const stagedContent = await readFile(stagedContentPath);
  stagedManifest.review.sourceUrl = "https://github.com/example/untrusted-post-reading";
  await writeFile(stagedManifestPath, `${JSON.stringify(stagedManifest, null, 2)}\n`);
  expectFailure(composerArgs(true), workspace, "does not match policy sourceUrl");
  await cp(path.join(referenceRepo, "dist", "milxdy-package", "milxdy.app.json"), stagedManifestPath);
  await writeFile(stagedContentPath, Buffer.concat([stagedContent, Buffer.from("\n// tampered\n")]));
  expectFailure(composerArgs(true), workspace, "does not match policy hash");
  await writeFile(stagedContentPath, stagedContent);

  run(process.execPath, composerArgs(false), workspace);

  const composition = JSON.parse(await readFile(path.join(compositionRoot, "composition-report.json"), "utf8"));
  const referenceTrust = composition.trustDecisions?.find((candidate) => candidate.packageId === "post-reading");
  if (!referenceTrust || referenceTrust.sensitiveApiFindings?.length !== 0) {
    throw new Error("Post-reading reference must compose without sensitive package API exceptions");
  }

  const plan = JSON.parse(await readFile(planPath, "utf8"));
  plan.outputDir = "tmp/post-reading-sdk-reference/chromium";
  await writeFile(planPath, `${JSON.stringify(plan, null, 2)}\n`);
  run(process.execPath, [
    "scripts/build/build-extension.mjs",
    "--target=chromium",
    `--local-app-plan=${planInput}`,
  ], workspace);

  console.log(`Post-reading external App SDK reference verified from ${referenceRepo}`);
} finally {
  await rm(stageRoot, { recursive: true, force: true });
}

function run(command, args, cwd, capture = false) {
  const result = spawnSync(command, args, { cwd, encoding: capture ? "utf8" : undefined, stdio: capture ? "pipe" : "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit ${result.status}`);
  return result;
}

function composerArgs(checkOnly) {
  return [
    "scripts/packages/compose-local-app-packages.mjs",
    `--package=${packageInput}`,
    `--out-dir=${compositionInput}`,
    `--plan-out=${planInput}`,
    ...(checkOnly ? ["--check"] : []),
    "--acknowledge-first-party-replacement",
    "--acknowledge-package-consent",
  ];
}

function expectFailure(args, cwd, expectedText) {
  const result = spawnSync(process.execPath, args, { cwd, encoding: "utf8" });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  if ((result.status ?? 0) === 0 || !output.includes(expectedText)) {
    throw new Error(`Expected rejected package containing ${JSON.stringify(expectedText)}\n${output}`);
  }
}

function remoteMatches(actual, expected) {
  const normalize = (value) => value.trim().replace(/^git@github\.com:/, "https://github.com/").replace(/\.git$/, "").toLowerCase();
  return normalize(actual) === normalize(expected);
}

function assertEqual(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(message);
}

function toPosix(value) {
  return value.replaceAll("\\", "/");
}
