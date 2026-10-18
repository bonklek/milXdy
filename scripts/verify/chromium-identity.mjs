import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { basename, relative, resolve } from "node:path";
import { cp, readFile, readdir, rm, stat } from "node:fs/promises";
import { buildQaOnce } from "../qa/qa-reload.mjs";

const profile = JSON.parse(await readFile("assets/extension/profiles/chromium.json", "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const extensionVersion = String(packageJson.extensionVersion || packageJson.version || "").trim();
const testRoot = resolve(`tmp/chromium-identity-${process.pid}`);
const firstOutput = resolve(testRoot, "first");
const secondOutput = resolve(testRoot, "second");
const qaOutput = resolve(testRoot, "qa");
const releaseQaOutput = resolve(testRoot, "release-qa");
const reinstallOutput = resolve(testRoot, "reinstalled-elsewhere");
assert.equal(profile.schemaVersion, 1);
assert.equal(profile.channel, "production");
assert.equal(profile.target, "chromium");
assert.equal(profile.name, "milXdy");
assert.equal(profile.identityPermission, "identity");
assert.equal(profile.extensionId, extensionIdFromManifestKey(profile.manifestKey));
assert.equal(profile.extensionId, "idlmhjcedjkmbkndigbiobfjadhlmgki");
assert.equal(profile.remiliaLogin.clientId, "tpa-milxdy");
assert.equal(profile.remiliaLogin.issuerUri, "https://www.remilia.net/oidc/realms/remilia");
assert.equal(profile.remiliaLogin.redirectPath, "remilia-oauth");
assert.equal(profile.remiliaLogin.redirectUri, `https://${profile.extensionId}.chromiumapp.org/remilia-oauth`);
assert.equal(Object.hasOwn(packageJson.scripts, "build:chromium:beta"), false);
assert.equal(Object.hasOwn(packageJson.scripts, "qa:build:beta"), false);

await rm(testRoot, { recursive: true, force: true });
try {
  await runBuild(firstOutput);
  const first = await readIdentity(firstOutput);
  assertReleaseIdentity(first);
  await scanArtifact(firstOutput);
  await cp(firstOutput, reinstallOutput, { recursive: true });
  assert.deepEqual(await readIdentity(reinstallOutput), first, "relocation preserves the registered identity and login callback");
  await scanArtifact(reinstallOutput);
  await rm(firstOutput, { recursive: true, force: true });
  await rm(reinstallOutput, { recursive: true, force: true });
  await runBuild(secondOutput);
  assertReleaseIdentity(await readIdentity(secondOutput));
  assert.deepEqual(await readIdentity(secondOutput), first, "normal builds retain the same identity and Login contract");
  await scanArtifact(secondOutput);
  await rm(secondOutput, { recursive: true, force: true });

  await buildQaOnce({outputDir: relative(resolve("."), qaOutput).replaceAll("\\", "/"), quiet: true, replaceForeignOutput: true});
  const qaManifest = JSON.parse(await readFile(resolve(qaOutput, "manifest.json"), "utf8"));
  const qaProvenance = JSON.parse(await readFile(resolve(qaOutput, "qa-build.json"), "utf8"));
  assert.equal(qaManifest.name, "milXdy QA");
  assert.notEqual(qaManifest.key, profile.manifestKey, "developer QA must remain separate from the registered release identity");
  assert.notEqual(qaProvenance.extensionId, profile.extensionId);
  assert.equal(qaProvenance.build.channel, "qa");
  assert.equal((qaManifest.permissions || []).includes("identity"), false);
  assert.equal(await exists(resolve(qaOutput, "remilia-login-client.json")), false);
  await rm(qaOutput, { recursive: true, force: true });

  await buildQaOnce({outputDir: relative(resolve("."), releaseQaOutput).replaceAll("\\", "/"), buildChannel: "production", quiet: true, replaceForeignOutput: true});
  const qaRelease = await readIdentity(releaseQaOutput);
  const provenance = JSON.parse(await readFile(resolve(releaseQaOutput, "qa-build.json"), "utf8"));
  assert.equal(qaRelease.manifest.name, "milXdy Release QA");
  assert.equal(qaRelease.manifest.key, profile.manifestKey);
  assert.equal(provenance.extensionId, profile.extensionId);
  assert.equal(provenance.build.channel, "production");
  assert.deepEqual(qaRelease.login, first.login);
  await scanArtifact(releaseQaOutput);
} finally { await rm(testRoot, { recursive: true, force: true }); }
console.log(`Chromium release identity verification passed for ${profile.extensionId} (${profile.remiliaLogin.redirectUri}).`);

async function runBuild(outputDir) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, ["scripts/build/build-extension.mjs", "--target=chromium", "--profile=full", `--output-dir=${relative(resolve("."), outputDir).replaceAll("\\", "/")}`], {cwd: resolve("."), stdio: "inherit", windowsHide: true});
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? resolvePromise() : reject(new Error(`Chromium release build exited ${signal || code}.`)));
  });
}
async function readIdentity(outputDir) {
  return {manifest: JSON.parse(await readFile(resolve(outputDir, "manifest.json"), "utf8")), login: JSON.parse(await readFile(resolve(outputDir, "remilia-login-client.json"), "utf8"))};
}
function assertReleaseIdentity({manifest, login}) {
  assert.equal(manifest.name, "milXdy");
  assert.equal(manifest.version, extensionVersion);
  assert.equal(manifest.version_name, extensionVersion);
  assert.equal(manifest.key, profile.manifestKey);
  assert.equal(extensionIdFromManifestKey(manifest.key), profile.extensionId);
  assert.equal((manifest.permissions || []).includes("identity"), true);
  assert.equal(manifest.action?.default_title, "milXdy");
  assert.deepEqual(login, {schemaVersion: 1, channel: "production", clientType: "public", clientId: profile.remiliaLogin.clientId, issuerUri: profile.remiliaLogin.issuerUri, authorizationScope: "openid", extensionId: profile.extensionId, redirectPath: profile.remiliaLogin.redirectPath, redirectUri: profile.remiliaLogin.redirectUri});
}

async function scanArtifact(root) {
  const workspacePath = resolve(".").toLowerCase();
  const homePath = resolve(homedir()).toLowerCase();
  const accountName = basename(homedir()).toLowerCase();
  for (const file of await filesUnder(root)) {
    const normalized = file.replaceAll("\\", "/");
    assert.doesNotMatch(normalized, /\.(?:key|pem|p12|pfx)$/iu, `private-key container must not be packaged: ${normalized}`);
    if (!/\.(?:css|html|js|json|md|txt)$/iu.test(file)) continue;
    const content = await readFile(file, "utf8");
    const lower = content.toLowerCase();
    assert.equal(lower.includes("-----begin private key-----"), false, `${normalized}: private key PEM marker found`);
    assert.equal(lower.includes("-----begin rsa private key-----"), false, `${normalized}: RSA private key PEM marker found`);
    assert.equal(/\bclient_secret\b/u.test(lower), false, `${normalized}: client secret field found`);
    assert.equal(lower.includes(workspacePath), false, `${normalized}: workspace path found`);
    assert.equal(lower.includes(homePath), false, `${normalized}: home path found`);
    assert.equal(lower.includes(accountName), false, `${normalized}: local account name found`);
    assert.equal(
      /(?:[A-Za-z]:[\\/](?:Users[\\/][^\\/"'\s]+[\\/]|Documents[\\/])|\/(?:Users|home)\/[^/"'\s]+\/)/u.test(content),
      false,
      `${normalized}: machine path found`,
    );
  }
}

async function filesUnder(root) {
  const result = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) result.push(...await filesUnder(path));
    else if (entry.isFile()) result.push(path);
  }
  return result;
}

async function exists(path) {
  return stat(path).then(() => true, () => false);
}

function extensionIdFromManifestKey(key) {
  const digest = createHash("sha256").update(Buffer.from(key, "base64")).digest().subarray(0, 16);
  return Array.from(digest, (byte) => `${String.fromCharCode(97 + (byte >> 4))}${String.fromCharCode(97 + (byte & 15))}`).join("");
}
