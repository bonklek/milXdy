import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { basename, relative, resolve } from "node:path";
import { cp, readFile, readdir, rm, stat } from "node:fs/promises";
import { buildQaOnce } from "../qa/qa-reload.mjs";

const profilePath = "assets/extension/profiles/chromium-beta.json";
const profile = JSON.parse(await readFile(profilePath, "utf8"));
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const templateManifest = JSON.parse(await readFile("assets/extension/manifest.json", "utf8"));
const qaBuilder = await readFile("scripts/qa/qa-reload.mjs", "utf8");
const extensionVersion = String(packageJson.extensionVersion || packageJson.version || "").trim();
const testRoot = resolve(`tmp/chromium-beta-identity-${process.pid}`);
const firstOutput = resolve(testRoot, "first");
const secondOutput = resolve(testRoot, "second");
const productionOutput = resolve(testRoot, "production");
const qaOutput = resolve(testRoot, "qa");
const betaQaOutput = resolve(testRoot, "beta-qa");
const reinstallOutput = resolve(testRoot, "reinstalled-elsewhere");

assert.equal(profile.schemaVersion, 1);
assert.equal(profile.channel, "beta");
assert.equal(profile.target, "chromium");
assert.equal(profile.name, "milXdy Beta");
assert.equal(profile.identityPermission, "identity");
assert.equal(profile.extensionId, extensionIdFromManifestKey(profile.manifestKey));
assert.equal(profile.remiliaLogin.clientId, "tpa-milxdy");
assert.equal(profile.remiliaLogin.issuerUri, "https://www.remilia.net/oidc/realms/remilia");
assert.equal(profile.remiliaLogin.redirectPath, "remilia-oauth");
assert.equal(
  profile.remiliaLogin.redirectUri,
  `https://${profile.extensionId}.chromiumapp.org/${profile.remiliaLogin.redirectPath}`,
);
assert.equal(Object.hasOwn(templateManifest, "key"), false, "production manifest template must stay keyless");
assert.equal((templateManifest.permissions || []).includes("identity"), false, "production manifest template must not inherit beta permissions");
assert.match(qaBuilder, /`--channel=\$\{buildChannel\}`/u, "QA builds must pass an explicit selected channel to the extension builder");

await rm(testRoot, { recursive: true, force: true });
try {
  await runBuild("beta", firstOutput);
  await runBuild("beta", secondOutput);
  await runBuild("production", productionOutput);
  await buildQaOnce({
    outputDir: relative(resolve("."), qaOutput).replaceAll("\\", "/"),
    quiet: true,
    replaceForeignOutput: true,
  });
  await buildQaOnce({
    outputDir: relative(resolve("."), betaQaOutput).replaceAll("\\", "/"),
    buildChannel: "beta",
    quiet: true,
    replaceForeignOutput: true,
  });
  await cp(firstOutput, reinstallOutput, { recursive: true });

  const first = await readIdentity(firstOutput);
  const second = await readIdentity(secondOutput);
  const reinstalled = await readIdentity(reinstallOutput);
  for (const candidate of [first, second, reinstalled]) assertBetaIdentity(candidate);
  assert.deepEqual(second, first, "repeated beta builds must emit the exact same identity and Login contract");
  assert.deepEqual(reinstalled, first, "copying the unpacked beta to another directory must retain its identity and redirect URI");

  const productionManifest = JSON.parse(await readFile(resolve(productionOutput, "manifest.json"), "utf8"));
  assert.equal(Object.hasOwn(productionManifest, "key"), false, "production artifact must not carry the beta key");
  assert.equal((productionManifest.permissions || []).includes("identity"), false, "production artifact must not carry the beta-only identity permission");
  assert.equal(await exists(resolve(productionOutput, "remilia-login-client.json")), false, "production artifact must not carry the beta Login client");

  const qaManifest = JSON.parse(await readFile(resolve(qaOutput, "manifest.json"), "utf8"));
  const qaProvenance = JSON.parse(await readFile(resolve(qaOutput, "qa-build.json"), "utf8"));
  assert.equal(qaManifest.name, "milXdy QA");
  assert.notEqual(qaManifest.key, profile.manifestKey, "QA and beta identities must remain distinct");
  assert.notEqual(qaProvenance.extensionId, profile.extensionId, "QA and beta extension ids must remain distinct");
  assert.equal(await exists(resolve(qaOutput, "remilia-login-client.json")), false, "QA artifact must not carry the beta Login client");

  const betaQaManifest = JSON.parse(await readFile(resolve(betaQaOutput, "manifest.json"), "utf8"));
  const betaQaProvenance = JSON.parse(await readFile(resolve(betaQaOutput, "qa-build.json"), "utf8"));
  const betaQaLogin = JSON.parse(await readFile(resolve(betaQaOutput, "remilia-login-client.json"), "utf8"));
  assert.equal(betaQaManifest.name, "milXdy Beta QA");
  assert.equal(betaQaManifest.key, profile.manifestKey, "beta QA must retain the registered beta manifest identity");
  assert.equal(betaQaProvenance.extensionId, profile.extensionId, "beta QA must run under the registered beta extension id");
  assert.equal(betaQaProvenance.build.channel, "beta");
  assert.deepEqual(betaQaLogin, first.login, "beta QA must retain the public Login client contract");

  await scanArtifact(firstOutput);
  await scanArtifact(secondOutput);
  await scanArtifact(reinstallOutput);
  await scanArtifact(betaQaOutput);
} finally {
  await rm(testRoot, { recursive: true, force: true });
}

console.log(`Chromium beta identity verification passed for ${profile.extensionId} (${profile.remiliaLogin.redirectUri}).`);

async function runBuild(channel, outputDir) {
  await new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [
      "scripts/build/build-extension.mjs",
      "--target=chromium",
      "--profile=full",
      `--channel=${channel}`,
      `--output-dir=${relative(resolve("."), outputDir).replaceAll("\\", "/")}`,
    ], { cwd: resolve("."), stdio: "inherit", windowsHide: true });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0
      ? resolvePromise()
      : reject(new Error(`Chromium ${channel} build exited ${signal ? `for signal ${signal}` : `with code ${code}`}.`)));
  });
}

async function readIdentity(outputDir) {
  return {
    manifest: JSON.parse(await readFile(resolve(outputDir, "manifest.json"), "utf8")),
    login: JSON.parse(await readFile(resolve(outputDir, "remilia-login-client.json"), "utf8")),
  };
}

function assertBetaIdentity({ manifest, login }) {
  assert.equal(manifest.name, profile.name);
  assert.equal(manifest.version, extensionVersion);
  assert.equal(manifest.version_name, `${extensionVersion} Beta`);
  assert.equal(manifest.key, profile.manifestKey);
  assert.equal(extensionIdFromManifestKey(manifest.key), profile.extensionId);
  assert.equal((manifest.permissions || []).includes("identity"), true);
  assert.equal(manifest.action?.default_title, profile.name);
  assert.deepEqual(login, {
    schemaVersion: 1,
    channel: "beta",
    clientType: "public",
    clientId: profile.remiliaLogin.clientId,
    issuerUri: profile.remiliaLogin.issuerUri,
    authorizationScope: "openid",
    extensionId: profile.extensionId,
    redirectPath: profile.remiliaLogin.redirectPath,
    redirectUri: profile.remiliaLogin.redirectUri,
  });
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
