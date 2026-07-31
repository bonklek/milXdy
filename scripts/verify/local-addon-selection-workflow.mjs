import assert from "node:assert/strict";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const root = "tmp/verify-local-addon-workflow";
const addOnsRoot = `${root}/addons`;
const catalogPath = `${root}/catalog.json`;
const selectionPath = `${root}/.milxdy-selection.json`;
await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });

const catalog = JSON.parse(await readFile("catalog/data/catalog.json", "utf8"));
const shareKit = catalog.sections[0].packages.find((pkg) => pkg.id === "tweetPng");
await writeFile(catalogPath, JSON.stringify(catalog));
const selection = {
  schemaVersion: 2,
  catalog: { id: catalog.catalogId, revision: catalog.revision },
  build: { target: "chromium", recipeId: "maintainer-local-v1" },
  packages: [{
    id: shareKit.id,
    version: shareKit.version,
    packageSha256: shareKit.artifact.packageSha256,
  }],
};
await writeFile(selectionPath, JSON.stringify(selection, null, 2));

const invalidSelectionPath = `${root}/invalid-selection.json`;
await writeFile(invalidSelectionPath, JSON.stringify({
  ...selection,
  catalog: { ...selection.catalog, revision: "stale" },
}));
await mkdir(`${addOnsRoot}/.state`, { recursive: true });
await mkdir(`${addOnsRoot}/.stable-backup`, { recursive: true });
await writeFile(`${addOnsRoot}/.stable-backup/recovered.txt`, "stable");
await mkdir(`${addOnsRoot}/.catalog-backup`, { recursive: true });
await writeFile(`${addOnsRoot}/.catalog-backup/recovered.txt`, "catalog");
await writeFile(`${addOnsRoot}/.state/build-promotion.json`, JSON.stringify({ schemaVersion: 1, state: "backed-up" }));
await writeFile(`${addOnsRoot}/.state/catalog-promotion.json`, JSON.stringify({ schemaVersion: 1, state: "backed-up" }));
const invalidPrepare = spawn(["prepare", `--selection=${invalidSelectionPath}`]);
assert.notEqual(invalidPrepare.status, 0);
assert.equal(await readFile(`${addOnsRoot}/stable/recovered.txt`, "utf8"), "stable");
assert.equal(await readFile(`${addOnsRoot}/catalog/recovered.txt`, "utf8"), "catalog");
const invalidStatus = JSON.parse(await readFile(`${addOnsRoot}/work/status.json`, "utf8"));
assert.equal(invalidStatus.failureClass, "selection-catalog-revision");
assert.equal(invalidStatus.workflowStage, "select");

run(["prepare", `--selection=${selectionPath}`]);
const lock = JSON.parse(await readFile(`${addOnsRoot}/.state/selection-lock.json`, "utf8"));
assert.equal(lock.schemaVersion, 2);
assert.equal(lock.packages.length, 1);
assert.equal(lock.packages[0].id, "tweetPng");
assert.equal(lock.packages[0].reviewTrusted, true);
assert.equal(lock.packages[0].artifact.path, "examples/packages/first-party-replacements/tweetPng");
assert.equal(JSON.parse(await readFile(`${addOnsRoot}/catalog/tweetPng/milxdy.app.json`, "utf8")).id, "tweetPng");

const denied = spawn(["apply"]);
assert.notEqual(denied.status, 0);
assert.match(`${denied.stdout}\n${denied.stderr}`, /acknowledge-first-party-replacement|acknowledge-package-consent/u);
assert.equal(JSON.parse(await readFile(`${addOnsRoot}/work/status.json`, "utf8")).failureClass, "composition");

run(["apply", "--acknowledge-package-consent", "--acknowledge-first-party-replacement"]);
const status = JSON.parse(await readFile(`${addOnsRoot}/work/status.json`, "utf8"));
assert.equal(status.state, "built");
assert.equal(status.workflowStage, "reload");
assert.equal(status.packages.some((entry) => entry.id === "tweetPng"), true);
assert.match(status.buildInstanceId, /^[a-f0-9]{24}$/u);
assert.match(status.compositionFingerprint, /^[a-f0-9]{64}$/u);
assert.equal(status.outputDirectory, `${addOnsRoot}/stable`);
assert.equal(JSON.parse(await readFile(`${addOnsRoot}/stable/local-addon-status.json`, "utf8")).buildId, status.buildId);

const emptySelectionPath = `${root}/empty-selection.json`;
await writeFile(emptySelectionPath, JSON.stringify({ ...selection, packages: [] }));
run(["prepare", `--selection=${emptySelectionPath}`]);
const emptyLock = JSON.parse(await readFile(`${addOnsRoot}/.state/selection-lock.json`, "utf8"));
assert.equal(emptyLock.packages.length, 0);
assert.deepEqual(await readdir(`${addOnsRoot}/catalog`), []);

await rm(root, { recursive: true, force: true });
console.log("Local maintainer selection Prepare/Apply workflow passed.");

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
    env: {
      ...process.env,
      MILXDY_ADDON_MANAGER_TEST_ROOT: addOnsRoot,
      MILXDY_ADDON_MANAGER_CATALOG_PATH: catalogPath,
    },
  });
}
