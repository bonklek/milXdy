import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { createDeterministicZip } from "../build/deterministic-zip.mjs";

const root = "tmp/verify-local-addon-workflow";
const addOnsRoot = `${root}/addons`;
const archive = `${root}/dev-note.zip`;
const selectionPath = `${root}/.milxdy-selection.json`;
await rm(root, { recursive: true, force: true });
await mkdir(`${addOnsRoot}/.cache`, { recursive: true });
await createDeterministicZip("examples/packages/local-dev/dev-note", archive);
const archiveBytes = await readFile(archive);
const sha256 = createHash("sha256").update(archiveBytes).digest("hex");
await copyFile(archive, `${addOnsRoot}/.cache/${sha256}.zip`);
await writeFile(selectionPath, JSON.stringify({
  schemaVersion: 1,
  catalog: { id: "workflow-verification" },
  packages: [{
    id: "dev-note",
    url: "https://github.com/bonklek/milXdy/releases/download/test/dev-note.zip",
    filename: "dev-note.zip",
    sha256,
    review: { identity: "local-workflow-verification", date: "2026-07-26" },
  }],
}, null, 2));

run(["prepare", `--selection=${selectionPath}`]);
const lock = JSON.parse(await readFile(`${addOnsRoot}/.state/selection-lock.json`, "utf8"));
assert.equal(lock.packages.length, 1);
assert.equal(lock.packages[0].id, "dev-note");
assert.equal(lock.packages[0].reviewTrusted, false);
assert.deepEqual(await readFile(`${addOnsRoot}/catalog/dev-note.zip`), archiveBytes);

const rejected = spawn(["apply", "--acknowledge-package-consent"]);
assert.notEqual(rejected.status, 0);
assert.match(`${rejected.stdout}\n${rejected.stderr}`, /catalog-review-untrusted/u);

run(["apply", "--allow-local-review", "--acknowledge-package-consent"]);
const status = JSON.parse(await readFile(`${addOnsRoot}/work/status.json`, "utf8"));
assert.equal(status.state, "built");
assert.equal(status.workflowStage, "reload");
assert.equal(status.packages.some((entry) => entry.id === "dev-note"), true);
assert.match(status.buildInstanceId, /^[a-f0-9]{24}$/u);
assert.match(status.compositionFingerprint, /^[a-f0-9]{64}$/u);
assert.equal(status.outputDirectory, `${addOnsRoot}/stable`);
assert.equal(JSON.parse(await readFile(`${addOnsRoot}/stable/local-addon-status.json`, "utf8")).buildId, status.buildId);

await rm(root, { recursive: true, force: true });
console.log("Local add-on selection Prepare/Apply workflow passed.");

function run(args) {
  const result = spawn(args);
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status ?? 1);
  }
}

function spawn(args) {
  return spawnSync(process.execPath, ["scripts/addons/manage-local-addons.mjs", ...args], {
    encoding: "utf8",
    env: { ...process.env, MILXDY_ADDON_MANAGER_TEST_ROOT: addOnsRoot },
  });
}
