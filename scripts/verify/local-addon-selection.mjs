import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { loadSelection, stageSelectionPackages, validateSelection, verifyMaterializedSelection } from "../addons/selection.mjs";

const root = "tmp/verify-local-addon-selection";
const cache = `${root}/cache`;
const staging = `${root}/staging`;
await rm(root, { recursive: true, force: true });
await mkdir(cache, { recursive: true });

const bytes = Buffer.from("pinned archive fixture");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const policy = {
  schemaVersion: 1,
  allowedDownloadHosts: ["github.com", "release-assets.githubusercontent.com"],
  maxArchiveBytes: 1024,
  maxRedirects: 2,
  downloadTimeoutMs: 1000,
};
const selection = {
  schemaVersion: 1,
  catalog: { id: "verify" },
  packages: [{
    id: "dev-note",
    url: "https://github.com/example/releases/download/v1/dev-note.zip",
    filename: "dev-note.zip",
    sha256,
    review: { identity: "verify-reviewer", date: "2026-07-26" },
  }],
};

validateSelection(selection, policy);
assert.throws(() => validateSelection({ ...selection, packages: [{ ...selection.packages[0], url: "http://github.com/file.zip" }] }, policy), /allowed HTTPS/u);
assert.throws(() => validateSelection({ ...selection, packages: [{ ...selection.packages[0], url: "https://example.com/file.zip" }] }, policy), /allowed HTTPS/u);
assert.throws(() => validateSelection({ ...selection, packages: [{ ...selection.packages[0], filename: "..\\evil.zip" }] }, policy), /Invalid ZIP filename/u);
assert.throws(() => validateSelection({ ...selection, packages: [selection.packages[0], { ...selection.packages[0] }] }, policy), /Duplicate package id/u);

await writeFile(`${root}/selection.json`, JSON.stringify(selection));
await writeFile(`${root}/policy.json`, JSON.stringify(policy));
await writeFile(`${root}/reviews.json`, JSON.stringify({
  schemaVersion: 1,
  reviews: [{ id: "dev-note", sha256, reviewedBy: "verify-reviewer", reviewedAt: "2026-07-26" }],
}));
const loaded = await loadSelection(`${root}/selection.json`, `${root}/policy.json`, `${root}/reviews.json`);
assert.equal(loaded.packages[0].reviewTrusted, true);
await writeFile(`${cache}/${sha256}.zip`, bytes);
await stageSelectionPackages(loaded, { cacheDirectory: cache, stagingDirectory: staging });
assert.deepEqual(await readFile(`${staging}/dev-note.zip`), bytes);
await verifyMaterializedSelection(loaded.packages, staging);
await writeFile(`${staging}/dev-note.zip`, "tampered");
await assert.rejects(() => verifyMaterializedSelection(loaded.packages, staging), /hash mismatch/u);

await rm(root, { recursive: true, force: true });
console.log("Local add-on catalog selection verification passed.");
