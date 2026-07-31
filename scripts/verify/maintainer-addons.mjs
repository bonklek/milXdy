import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { appendFile, cp, readFile, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const first = build();
const firstHash = sha256(await readFile("packages/maintainer/composerTools/dist/content.js"));
const second = build();
const secondHash = sha256(await readFile("packages/maintainer/composerTools/dist/content.js"));
assert.equal(firstHash, secondHash, "maintainer package bundle must be byte-for-byte deterministic");
assert.match(first, /composerTools: [a-f0-9]{64}/u);
assert.match(second, /composerTools: [a-f0-9]{64}/u);

const [manifest, firstPartyApps, catalog, replacementPolicy, trustedReviews, bundle] = await Promise.all([
  readJson("packages/maintainer/composerTools/milxdy.app.json"),
  readJson("src/platform/app-sdk/first-party-apps.json"),
  readJson("catalog/data/catalog.json"),
  readJson("scripts/packages/local-app-first-party-replacements.json"),
  readJson("scripts/addons/trusted-catalog-reviews.json"),
  readFile("packages/maintainer/composerTools/dist/content.js", "utf8"),
]);
const builtIn = firstPartyApps.find((entry) => entry.id === "composerTools");
const record = catalog.sections.flatMap((section) => section.packages).find((entry) => entry.id === "composerTools");
const replacement = replacementPolicy.replacements.find((entry) => entry.id === "composerTools");
const trusted = trustedReviews.reviews.find((entry) => entry.id === "composerTools");

assert.equal(manifest.id, builtIn.id);
assert.equal(manifest.version, builtIn.version);
assert.equal(manifest.packageKind, builtIn.packageKind);
assert.deepEqual(manifest.storageKeys, builtIn.storageKeys);
assert.deepEqual(manifest.settings, builtIn.settings);
assert.deepEqual(manifest.siteScopes, builtIn.siteScopes);
assert.equal(manifest.defaultEnabled, builtIn.defaultEnabled);
assert.equal(manifest.review.status, "reviewed");
assert.equal(record.availability, "under-review");
assert.equal(record.artifact.path, "packages/maintainer/composerTools");
assert.equal(record.artifact.packageSha256, replacement.packageSha256);
assert.equal(record.artifact.packageSha256, trusted.packageSha256);
assert.equal(record.version, trusted.version);
assert.equal(record.review.reviewedBy, trusted.reviewedBy);
assert.equal(record.review.reviewedAt, trusted.reviewedAt);
assert.match(bundle, /dm-composer/u);
assert.match(bundle, /SearchBox_Search_Input/u);
assert.match(bundle, /removeEventListener\("beforeinput"/u);
assert.doesNotMatch(bundle, /fetch\(|XMLHttpRequest|chrome\.runtime|browser\.runtime/u);

const composition = spawnSync(process.execPath, [
  "scripts/packages/compose-local-app-packages.mjs",
  "--check",
  "--packages-dir=packages/maintainer",
  "--acknowledge-package-consent",
  "--acknowledge-first-party-replacement",
], { encoding: "utf8" });
if (composition.status !== 0) {
  process.stdout.write(composition.stdout || "");
  process.stderr.write(composition.stderr || "");
  process.exit(composition.status ?? 1);
}
assert.match(composition.stdout, /accepted: 1/u);
assert.match(composition.stdout, /sensitiveApiFindings=0/u);

const trustRoot = "tmp/verify-maintainer-addons";
await rm(trustRoot, { recursive: true, force: true });
await cp("packages/maintainer/composerTools", `${trustRoot}/not-catalog/composerTools`, { recursive: true });
const wrongRoot = compose(`${trustRoot}/not-catalog`);
assert.notEqual(wrongRoot.status, 0);
assert.match(`${wrongRoot.stdout}\n${wrongRoot.stderr}`, /does not match policy root/u);

await cp("packages/maintainer/composerTools", `${trustRoot}/catalog-staging/composerTools`, { recursive: true });
await appendFile(`${trustRoot}/catalog-staging/composerTools/dist/content.js`, "\n// tampered\n");
const tampered = compose(`${trustRoot}/catalog-staging`);
assert.notEqual(tampered.status, 0);
assert.match(`${tampered.stdout}\n${tampered.stderr}`, /does not match policy hash/u);
await rm(trustRoot, { recursive: true, force: true });

console.log("Maintainer add-on package verification passed.");

function build() {
  const result = spawnSync(process.execPath, ["scripts/packages/build-maintainer-addons.mjs"], { encoding: "utf8" });
  if (result.status !== 0) {
    process.stdout.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    process.exit(result.status ?? 1);
  }
  return result.stdout;
}

function compose(packagesDirectory) {
  return spawnSync(process.execPath, [
    "scripts/packages/compose-local-app-packages.mjs",
    "--check",
    `--packages-dir=${packagesDirectory}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], { encoding: "utf8" });
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
