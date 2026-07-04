import { spawnSync } from "node:child_process";
import { mkdtemp, cp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const composer = path.resolve("scripts/packages/compose-local-app-packages.mjs");
const builder = path.resolve("scripts/build/build-extension.mjs");
const composerSource = await readFile(composer, "utf8");
const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const appSdkDocs = await readFile("docs/APP_SDK.md", "utf8");
const exampleReadme = await readFile("examples/packages/first-party-replacements/README.md", "utf8");
const tmpRoot = await mkdtemp(path.join(os.tmpdir(), "milxdy-local-app-trust-"));
const workspaceTmpParent = path.join("tmp", "local-app-trust-gates");
await mkdir(workspaceTmpParent, { recursive: true });
const buildTmpRoot = await mkdtemp(path.join(workspaceTmpParent, "case-"));
const failures = [];
const notes = [];

try {
  const fixturesDir = path.join(tmpRoot, "fixtures");
  await cp("examples/packages/first-party-replacements", fixturesDir, { recursive: true });

  const localPackage = await copyPackage("tweetPng", "local-package");
  const localManifest = await readManifest(localPackage);
  localManifest.review = { status: "local", notes: ["Trust-gate verifier fixture."] };
  await writeManifest(localPackage, localManifest);
  runCase("local review is rejected by default", [
    "--check",
    `--package=${localPackage}`,
  ], 1, "--allow-local-review");

  runCase("privileged package consent is rejected without acknowledgement", [
    "--check",
    `--packages-dir=${fixturesDir}`,
  ], 1, "--acknowledge-package-consent");

  runCase("reviewed first-party replacement requires explicit acknowledgement", [
    "--check",
    `--packages-dir=${fixturesDir}`,
    "--acknowledge-package-consent",
  ], 1, "--acknowledge-first-party-replacement");

  runCase("reviewed examples pass with consent and replacement acknowledgements", [
    "--check",
    "--packages-dir=examples/packages/first-party-replacements",
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], 0, "first-party-id-replacement");
  runCase("composer handoff includes required local-app build acknowledgements", [
    "--packages-dir=examples/packages/first-party-replacements",
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], 0, "--acknowledge-first-party-replacement --acknowledge-package-consent");
  assertPackageScriptDoesNotAcknowledgeLocalAppTrust();
  runLocalBuilderCase("bare local app builder prints explicit fallback acknowledgement guidance", [], 1, "--acknowledge-first-party-replacement");

  runCase("copied first-party replacement is rejected without trusted source root", [
    "--check",
    `--packages-dir=${fixturesDir}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], 1, "repo-owned first-party replacement policy match");

  for (const builtInId of ["beetol", "reminetChat"]) {
    const selfAttestedReplacement = await copyLocalPackage("dev-note", `self-attested-${builtInId}`);
    const selfAttestedManifest = await readManifest(selfAttestedReplacement);
    selfAttestedManifest.id = builtInId;
    selfAttestedManifest.review = {
      status: "reviewed",
      reviewedBy: "local-app-trust-gate-verifier",
      reviewedAt: "2026-07-04",
      notes: ["Synthetic self-attested first-party replacement fixture."],
    };
    await writeManifest(selfAttestedReplacement, selfAttestedManifest);
    runCase(`self-attested reviewed ${builtInId} first-party replacement is rejected`, [
      "--check",
      `--package=${selfAttestedReplacement}`,
      "--acknowledge-package-consent",
      "--acknowledge-first-party-replacement",
    ], 1, "repo-owned first-party replacement policy match");
  }

  const missingEnablementPackage = await copyLocalPackage("dev-note", "missing-enablement-package");
  const missingEnablementManifest = await readManifest(missingEnablementPackage);
  delete missingEnablementManifest.settings;
  missingEnablementManifest.storageKeys = { local: [] };
  await writeManifest(missingEnablementPackage, missingEnablementManifest);
  await runRejectedComposerCaseWithoutPlan("novel package without enablement is rejected before plan emission", [
    `--package=${missingEnablementPackage}`,
    "--allow-local-review",
    "--acknowledge-package-consent",
  ], "novel local package must declare a toggle setting with role \"enablement\"");

  const privilegedDefaultPackage = await copyLocalPackage("dev-note", "privileged-default-package");
  const privilegedDefaultManifest = await readManifest(privilegedDefaultPackage);
  privilegedDefaultManifest.privacy = {
    ...privilegedDefaultManifest.privacy,
    consentRequired: true,
    permissionNotes: ["Synthetic consent-required enablement default fixture."],
  };
  privilegedDefaultManifest.settings[0].defaultValue = true;
  await writeManifest(privilegedDefaultPackage, privilegedDefaultManifest);
  await runRejectedComposerCaseWithoutPlan("privileged package enablement setting cannot default true", [
    `--package=${privilegedDefaultPackage}`,
    "--allow-local-review",
    "--acknowledge-package-consent",
  ], "privileged or consent-required local packages must not default enablement settings to true");

  const builtInStorageClaimPackage = await copyLocalPackage("dev-note", "built-in-storage-claim-package");
  const builtInStorageClaimManifest = await readManifest(builtInStorageClaimPackage);
  builtInStorageClaimManifest.storageKeys.local = ["beetol.accessToken"];
  builtInStorageClaimManifest.settings[0] = {
    ...builtInStorageClaimManifest.settings[0],
    id: "dev-note.enabled",
    storage: { area: "local", key: "beetol.accessToken" },
  };
  await writeManifest(builtInStorageClaimPackage, builtInStorageClaimManifest);
  await runRejectedComposerCaseWithoutPlan("novel package cannot claim beetol access token storage", [
    `--package=${builtInStorageClaimPackage}`,
    "--allow-local-review",
    "--acknowledge-package-consent",
  ], "generated settings controls must not expose auth, session, token");

  const builtInCollisionPackage = await copyLocalPackage("dev-note", "built-in-collision-package");
  const builtInCollisionManifest = await readManifest(builtInCollisionPackage);
  builtInCollisionManifest.storageKeys.local = ["milxdy.remistats.beetol.enabled"];
  builtInCollisionManifest.settings[0] = {
    ...builtInCollisionManifest.settings[0],
    storage: { area: "local", key: "milxdy.remistats.beetol.enabled" },
  };
  await writeManifest(builtInCollisionPackage, builtInCollisionManifest);
  await runRejectedComposerCaseWithoutPlan("novel package cannot claim built-in enablement storage", [
    `--package=${builtInCollisionPackage}`,
    "--allow-local-review",
    "--acknowledge-package-consent",
  ], "collides with built-in registry storage");

  for (const [fixtureName, storageKey] of [
    ["token-setting-package", "milxdy.local.dev-note.sessionToken"],
    ["session-setting-package", "milxdy.local.dev-note.session"],
    ["cookie-setting-package", "milxdy.local.dev-note.cookie"],
    ["api-key-setting-package", "milxdy.local.dev-note.apiKey"],
    ["path-setting-package", "milxdy.local.dev-note.localPath"],
    ["cache-setting-package", "milxdy.local.dev-note.privateCache"],
  ]) {
    const sensitiveStoragePackage = await copyLocalPackage("dev-note", fixtureName);
    const sensitiveStorageManifest = await readManifest(sensitiveStoragePackage);
    sensitiveStorageManifest.storageKeys.local = [storageKey];
    sensitiveStorageManifest.settings[0] = {
      ...sensitiveStorageManifest.settings[0],
      storage: { area: "local", key: storageKey },
    };
    await writeManifest(sensitiveStoragePackage, sensitiveStorageManifest);
    await runRejectedComposerCaseWithoutPlan(`${storageKey} generated setting storage is rejected`, [
      `--package=${sensitiveStoragePackage}`,
      "--allow-local-review",
      "--acknowledge-package-consent",
    ], "generated settings controls must not expose auth, session, token");
  }

  const sourceOnlyPackage = await copyLocalPackage("dev-note", "source-only-package");
  const sourceOnlyManifest = await readManifest(sourceOnlyPackage);
  sourceOnlyManifest.contentEntry = "dist/content.ts";
  await writeFile(path.join(sourceOnlyPackage, "dist", "content.ts"), [
    "export function boot() {}",
    "",
  ].join("\n"));
  await writeManifest(sourceOnlyPackage, sourceOnlyManifest);
  await runRejectedComposerCaseWithoutPlan("source-only content entry is rejected before plan emission", [
    `--package=${sourceOnlyPackage}`,
    "--allow-local-review",
    "--acknowledge-package-consent",
  ], "contentEntry must be an executable .js or .mjs module");

  const builtInMessagePackage = await copyPackage("tweetPng", "built-in-message-package");
  const builtInMessageManifest = await readManifest(builtInMessagePackage);
  builtInMessageManifest.id = "localBeetolMessageClaim";
  builtInMessageManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-03",
    notes: ["Synthetic reviewed fixture for built-in background namespace collision coverage."],
  };
  builtInMessageManifest.background = { messageTypes: ["beetol:*"] };
  builtInMessageManifest.privacy = {
    ...builtInMessageManifest.privacy,
    permissionNotes: ["Declares a synthetic background message namespace for verifier coverage."],
    consentRequired: true,
  };
  await writeManifest(builtInMessagePackage, builtInMessageManifest);
  await writeFile(path.join(builtInMessagePackage, "dist", "content.js"), [
    "export async function renderTweetPng(context) {",
    "  await context.sendMessage({ type: \"beetol:action\", action: \"claimUBC\" });",
    "}",
    "",
  ].join("\n"));
  runCase("local package cannot claim built-in beetol background namespace", [
    "--check",
    `--package=${builtInMessagePackage}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], 1, "must use the package-owned namespace localBeetolMessageClaim:*");

  const builtInServicePackage = await copyPackage("tweetPng", "built-in-service-package");
  const builtInServiceManifest = await readManifest(builtInServicePackage);
  builtInServiceManifest.id = "localRemiliaAuthClaim";
  builtInServiceManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-03",
    notes: ["Synthetic reviewed fixture for built-in background service collision coverage."],
  };
  builtInServiceManifest.background = { services: ["remiliaAuth"] };
  builtInServiceManifest.privacy = {
    ...builtInServiceManifest.privacy,
    permissionNotes: ["Declares a synthetic background service for verifier coverage."],
    consentRequired: true,
  };
  await writeManifest(builtInServicePackage, builtInServiceManifest);
  runCase("local package cannot claim built-in background service", [
    "--check",
    `--package=${builtInServicePackage}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], 1, "background.services is not supported for local packages yet");

  const invalidHostPackage = await copyPackage("tweetPng", "invalid-host-package");
  const invalidHostManifest = await readManifest(invalidHostPackage);
  invalidHostManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-03",
    notes: ["Synthetic invalid host pattern fixture for composer coverage."],
  };
  invalidHostManifest.permissions = {
    ...(invalidHostManifest.permissions || {}),
    hosts: ["https://x.com/path/*"],
  };
  invalidHostManifest.siteScopes = (invalidHostManifest.siteScopes || []).map((scope) => ({
    ...scope,
    hosts: ["https://x.com/path/*"],
  }));
  invalidHostManifest.privacy = {
    ...invalidHostManifest.privacy,
    permissionNotes: ["Declares an intentionally invalid host pattern for verifier coverage."],
    consentRequired: true,
  };
  await writeManifest(invalidHostPackage, invalidHostManifest);
  await runRejectedComposerCaseWithoutPlan("invalid site scope hosts fail before plan emission", [
    `--package=${invalidHostPackage}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], "invalid site scope host pattern https://x.com/path/*");

  const broadHostPackage = await copyPackage("tweetPng", "broad-host-package");
  const broadHostManifest = await readManifest(broadHostPackage);
  broadHostManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-03",
    notes: ["Synthetic broad host pattern fixture for composer coverage."],
  };
  broadHostManifest.permissions = {
    ...(broadHostManifest.permissions || {}),
    hosts: ["*://*/*"],
  };
  broadHostManifest.siteScopes = (broadHostManifest.siteScopes || []).map((scope) => ({
    ...scope,
    hosts: ["*://*/*"],
  }));
  broadHostManifest.privacy = {
    ...broadHostManifest.privacy,
    permissionNotes: ["Declares an intentionally broad host pattern for verifier coverage."],
    consentRequired: true,
  };
  await writeManifest(broadHostPackage, broadHostManifest);
  await runRejectedComposerCaseWithoutPlan("broad wildcard hosts fail before plan emission", [
    `--package=${broadHostPackage}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], "invalid permission host pattern *://*/*");

  const blockedPackage = await copyPackage("tweetPng", "blocked-package");
  const blockedManifest = await readManifest(blockedPackage);
  blockedManifest.review = { status: "blocked", notes: ["Trust-gate verifier fixture."] };
  await writeManifest(blockedPackage, blockedManifest);
  runCase("blocked review status is always rejected", [
    "--check",
    `--package=${blockedPackage}`,
    "--allow-local-review",
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], 1, "blocked packages cannot be composed");

  for (const packageId of ["../brand", "x/../../brand", ".", "..", "C:\\brand", "C:/brand"]) {
    const unsafeIdPackage = await copyPackage("tweetPng", `unsafe-id-${safeFixtureName(packageId)}`);
    const unsafeIdManifest = await readManifest(unsafeIdPackage);
    unsafeIdManifest.id = packageId;
    unsafeIdManifest.review = {
      status: "reviewed",
      reviewedBy: "local-app-trust-gate-verifier",
      reviewedAt: "2026-07-03",
      notes: ["Synthetic unsafe package id fixture for namespace coverage."],
    };
    await writeManifest(unsafeIdPackage, unsafeIdManifest);
    runCase(`unsafe package id ${JSON.stringify(packageId)} is rejected`, [
      "--check",
      `--package=${unsafeIdPackage}`,
      "--acknowledge-package-consent",
      "--acknowledge-first-party-replacement",
    ], 1, "safe package identifier");
  }

  const escapedPackage = await copyPackage("tweetPng", "escaped-folder-package");
  const escapedManifest = await readManifest(escapedPackage);
  escapedManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-03",
    notes: ["Synthetic symlink escape fixture for folder package coverage."],
  };
  await writeManifest(escapedPackage, escapedManifest);
  const escapedTarget = path.join(tmpRoot, "outside-package-root");
  await mkdir(path.join(escapedTarget, "dist"), { recursive: true });
  await writeFile(path.join(escapedTarget, "dist", "content.js"), [
    "export function boot() {}",
    "export function open() {}",
    "export function close() {}",
    "",
  ].join("\n"));
  await rm(path.join(escapedPackage, "dist"), { recursive: true, force: true });
  await symlink(path.join(escapedTarget, "dist"), path.join(escapedPackage, "dist"), process.platform === "win32" ? "junction" : "dir");
  runCase("folder package junction escapes are rejected before hashing", [
    "--check",
    `--package=${escapedPackage}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], 1, "escapes package root");

  const sensitivePackage = await copyLocalPackage("dev-note", "sensitive-package");
  const sensitiveManifest = await readManifest(sensitivePackage);
  sensitiveManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-03",
    notes: ["Synthetic reviewed exception fixture for scanner coverage."],
  };
  await writeManifest(sensitivePackage, sensitiveManifest);
  await writeFile(path.join(sensitivePackage, "dist", "content.js"), [
    "export async function boot() {",
    "  await chrome.runtime.sendMessage({ type: \"dev-note:export\" });",
    "  await chrome[\"runtime\"].sendMessage({ type: \"dev-note:export\" });",
    "  const c = chrome;",
    "  await c.runtime.sendMessage({ type: \"dev-note:export\" });",
    "  const port = chrome.runtime.connect({ name: \"dev-note\" });",
    "  const bracketPort = chrome[\"runtime\"].connect({ name: \"dev-note\" });",
    "  const aliasPort = c.runtime.connect({ name: \"dev-note\" });",
    "  bracketPort.disconnect();",
    "  aliasPort.disconnect();",
    "  port.disconnect();",
    "}",
    "",
  ].join("\n"));
  runCase("direct runtime messaging is rejected without a reviewed exception acknowledgement", [
    "--check",
    `--package=${sensitivePackage}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], 1, "--allow-sensitive-package-apis");
  runCase("reviewed direct runtime messaging cannot be acknowledged", [
    "--check",
    `--package=${sensitivePackage}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
    "--allow-sensitive-package-apis",
  ], 1, "runtime messaging/port API findings cannot be authorized");

  const commentTokenRuntimePackage = await copyLocalPackage("dev-note", "comment-token-runtime-sensitive-package");
  const commentTokenRuntimeManifest = await readManifest(commentTokenRuntimePackage);
  commentTokenRuntimeManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-04",
    notes: ["Synthetic reviewed exception fixture for comment-token runtime scanner coverage."],
  };
  await writeManifest(commentTokenRuntimePackage, commentTokenRuntimeManifest);
  await writeFile(path.join(commentTokenRuntimePackage, "dist", "content.js"), [
    "export async function boot() {",
    "  await chrome/* scanner probe */.runtime.sendMessage({ type: \"beetol:logout\" });",
    "  await chrome",
    "    /* newline scanner probe */",
    "    .runtime",
    "    .sendMessage({ type: \"beetol:authStatus\" });",
    "  const port = browser",
    "    // line-comment scanner probe",
    "    .runtime",
    "    /* block-comment scanner probe */",
    "    .connect({ name: \"dev-note\" });",
    "  port.disconnect();",
    "}",
    "",
  ].join("\n"));
  runCase("comment-token direct runtime messaging is rejected by the sensitive API scan", [
    "--check",
    `--package=${commentTokenRuntimePackage}`,
    "--acknowledge-package-consent",
  ], 1, "--allow-sensitive-package-apis");
  runCase("comment-token direct runtime messaging cannot be acknowledged", [
    "--check",
    `--package=${commentTokenRuntimePackage}`,
    "--acknowledge-package-consent",
    "--allow-sensitive-package-apis",
  ], 1, "runtime messaging/port API findings cannot be authorized");

  const decoderRuntimePackage = await copyLocalPackage("dev-note", "decoder-runtime-sensitive-package");
  const decoderRuntimeManifest = await readManifest(decoderRuntimePackage);
  decoderRuntimeManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-04",
    notes: ["Synthetic reviewed exception fixture for atob runtime scanner coverage."],
  };
  await writeManifest(decoderRuntimePackage, decoderRuntimeManifest);
  await writeFile(path.join(decoderRuntimePackage, "dist", "content.js"), [
    "export async function boot() {",
    "  const c = globalThis[atob(\"Y2hyb21l\")];",
    "  await c.runtime.sendMessage({ type: \"beetol:authStatus\" });",
    "  const b = globalThis[atob(\"YnJvd3Nlcg==\")];",
    "  const port = b.runtime.connect({ name: \"dev-note\" });",
    "  port.disconnect();",
    "}",
    "",
  ].join("\n"));
  runCase("atob-decoded chrome/browser runtime messaging is rejected by the sensitive API scan", [
    "--check",
    `--package=${decoderRuntimePackage}`,
    "--acknowledge-package-consent",
  ], 1, "--allow-sensitive-package-apis");
  runCase("atob-decoded chrome/browser runtime messaging cannot be acknowledged", [
    "--check",
    `--package=${decoderRuntimePackage}`,
    "--acknowledge-package-consent",
    "--allow-sensitive-package-apis",
  ], 1, "runtime messaging/port API findings cannot be authorized");

  const reviewableSensitivePackage = await copyLocalPackage("dev-note", "reviewable-sensitive-package");
  const reviewableSensitiveManifest = await readManifest(reviewableSensitivePackage);
  reviewableSensitiveManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-04",
    notes: ["Synthetic reviewed exception fixture for non-runtime scanner coverage."],
  };
  await writeManifest(reviewableSensitivePackage, reviewableSensitiveManifest);
  await writeFile(path.join(reviewableSensitivePackage, "dist", "content.js"), [
    "export async function boot() {",
    "  await chrome.storage.local.get(null);",
    "}",
    "",
  ].join("\n"));
  runCase("reviewed non-runtime sensitive API exception requires explicit acknowledgement", [
    "--check",
    `--package=${reviewableSensitivePackage}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], 1, "--allow-sensitive-package-apis");
  runCase("reviewed non-runtime sensitive API exception can be acknowledged", [
    "--check",
    `--package=${reviewableSensitivePackage}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
    "--allow-sensitive-package-apis",
  ], 0, "Local app composition check passed.");

  const evasiveSensitivePackage = await copyLocalPackage("dev-note", "evasive-sensitive-package");
  const evasiveSensitiveManifest = await readManifest(evasiveSensitivePackage);
  evasiveSensitiveManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-03",
    notes: ["Synthetic reviewed exception fixture for bracket and alias scanner coverage."],
  };
  await writeManifest(evasiveSensitivePackage, evasiveSensitiveManifest);
  await writeFile(path.join(evasiveSensitivePackage, "dist", "content.js"), [
    "export async function boot() {",
    "  const cr = globalThis['ch' + 'rome'];",
    "  void cr.storage.local.get(null);",
    "  const g = globalThis;",
    "  await g[\"ch\" + \"rome\"][\"run\" + \"time\"][\"send\" + \"Message\"]({ type: \"beetol:action\", action: \"claimUBC\" });",
    "  const computedSocket = g[\"ch\" + \"rome\"][\"run\" + \"time\"][\"con\" + \"nect\"]({ name: \"reminetChat:socket\" });",
    "  const { runtime } = chrome;",
    "  await runtime.sendMessage({ type: \"dev-note:export\" });",
    "  const { runtime: browserRuntime } = globalThis[\"browser\"];",
    "  await browserRuntime.connect({ name: \"tweetPng\" }).disconnect();",
    "  await chrome[\"runtime\"].sendMessage({ type: \"dev-note:export\" });",
    "  await globalThis[\"chrome\"][\"runtime\"].sendMessage({ type: \"dev-note:export\" });",
    "  await window.chrome.runtime.sendMessage({ type: \"dev-note:export\" });",
    "  await self[\"chrome\"][String(\"runtime\")].sendMessage({ type: \"dev-note:export\" });",
    "  const c = chrome;",
    "  await c.runtime.sendMessage({ type: \"dev-note:export\" });",
    "  const runtimeAlias = chrome[String(\"runtime\")];",
    "  await runtimeAlias.sendMessage({ type: \"dev-note:export\" });",
    "  const bracketPort = chrome[\"runtime\"].connect({ name: \"dev-note\" });",
    "  const computedPort = chrome[String(\"runtime\")].connect({ name: \"dev-note\" });",
    "  const aliasPort = c.runtime.connect({ name: \"dev-note\" });",
    "  computedSocket.disconnect();",
    "  bracketPort.disconnect();",
    "  computedPort.disconnect();",
    "  aliasPort.disconnect();",
    "}",
    "",
  ].join("\n"));
  runCase("bracket and alias runtime messaging is rejected by the sensitive API scan", [
    "--check",
    `--package=${evasiveSensitivePackage}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ], 1, "--allow-sensitive-package-apis");
  runCase("bracket and alias runtime messaging cannot be acknowledged", [
    "--check",
    `--package=${evasiveSensitivePackage}`,
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
    "--allow-sensitive-package-apis",
  ], 1, "runtime messaging/port API findings cannot be authorized");

  const arrayJoinRuntimePackage = await copyLocalPackage("dev-note", "array-join-runtime-sensitive-package");
  const arrayJoinRuntimeManifest = await readManifest(arrayJoinRuntimePackage);
  arrayJoinRuntimeManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-04",
    notes: ["Synthetic reviewed exception fixture for array-join runtime scanner coverage."],
  };
  await writeManifest(arrayJoinRuntimePackage, arrayJoinRuntimeManifest);
  await writeFile(path.join(arrayJoinRuntimePackage, "dist", "content.js"), [
    "export async function boot() {",
    "  await globalThis[[\"c\", \"hrome\"].join(\"\")][[\"r\", \"untime\"].join(\"\")][[\"sendM\", \"essage\"].join(\"\")]({ type: \"beetol:authStatus\" });",
    "}",
    "",
  ].join("\n"));
  runCase("row 128 array-join chrome runtime sendMessage probe is rejected by the sensitive API scan", [
    "--check",
    `--package=${arrayJoinRuntimePackage}`,
    "--acknowledge-package-consent",
  ], 1, "--allow-sensitive-package-apis");
  runCase("row 128 array-join chrome runtime sendMessage probe cannot be acknowledged", [
    "--check",
    `--package=${arrayJoinRuntimePackage}`,
    "--acknowledge-package-consent",
    "--allow-sensitive-package-apis",
  ], 1, "runtime messaging/port API findings cannot be authorized");

  const concatenatedRuntimePackage = await copyLocalPackage("dev-note", "concatenated-runtime-sensitive-package");
  const concatenatedRuntimeManifest = await readManifest(concatenatedRuntimePackage);
  concatenatedRuntimeManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-04",
    notes: ["Synthetic reviewed exception fixture for concatenated runtime scanner coverage."],
  };
  await writeManifest(concatenatedRuntimePackage, concatenatedRuntimeManifest);
  await writeFile(path.join(concatenatedRuntimePackage, "dist", "content.js"), [
    "export async function boot() {",
    "  const port = globalThis[\"bro\" + \"w\" + \"ser\"][\"ru\" + \"nti\" + \"me\"][\"co\" + \"nn\" + \"ect\"]({ name: \"dev-note\" });",
    "  port.disconnect();",
    "}",
    "",
  ].join("\n"));
  runCase("arbitrary concatenated browser runtime connect probe is rejected by the sensitive API scan", [
    "--check",
    `--package=${concatenatedRuntimePackage}`,
    "--acknowledge-package-consent",
  ], 1, "--allow-sensitive-package-apis");
  runCase("arbitrary concatenated browser runtime connect probe cannot be acknowledged", [
    "--check",
    `--package=${concatenatedRuntimePackage}`,
    "--acknowledge-package-consent",
    "--allow-sensitive-package-apis",
  ], 1, "runtime messaging/port API findings cannot be authorized");

  const reflectComputedPackage = await copyLocalPackage("dev-note", "reflect-computed-sensitive-package");
  const reflectComputedManifest = await readManifest(reflectComputedPackage);
  reflectComputedManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-04",
    notes: ["Synthetic reviewed exception fixture for Reflect.get scanner coverage."],
  };
  await writeManifest(reflectComputedPackage, reflectComputedManifest);
  await writeFile(path.join(reflectComputedPackage, "dist", "content.js"), [
    "export async function boot() {",
    "  const api = Reflect.get(globalThis, [\"ch\", \"rome\"].join(\"\"));",
    "  await api.runtime.sendMessage({ type: \"beetol:action\", action: \"claimUBC\" });",
    "  await Reflect.get(globalThis, [\"ch\", \"rome\"].join(\"\")).runtime.sendMessage({ type: \"beetol:action\", action: \"claimUBC\" });",
    "}",
    "",
  ].join("\n"));
  runCase("Reflect.get computed runtime messaging cannot be acknowledged", [
    "--check",
    `--package=${reflectComputedPackage}`,
    "--acknowledge-package-consent",
    "--allow-sensitive-package-apis",
  ], 1, "runtime messaging/port API findings cannot be authorized");

  const variableComputedPackage = await copyLocalPackage("dev-note", "variable-computed-sensitive-package");
  const variableComputedManifest = await readManifest(variableComputedPackage);
  variableComputedManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-04",
    notes: ["Synthetic reviewed exception fixture for variable-held computed scanner coverage."],
  };
  await writeManifest(variableComputedPackage, variableComputedManifest);
  await writeFile(path.join(variableComputedPackage, "dist", "content.js"), [
    "export async function boot() {",
    "  const runtimeName = \"runtime\";",
    "  const sendName = \"sendMessage\";",
    "  const connectName = \"connect\";",
    "  const extensionApi = globalThis[\"chrome\"];",
    "  await extensionApi[runtimeName][sendName]({ type: \"beetol:action\", action: \"claimUBC\" });",
    "  const variablePort = extensionApi[runtimeName][connectName]({ name: \"reminetChat:socket\" });",
    "  variablePort.disconnect();",
    "}",
    "",
  ].join("\n"));
  runCase("variable-held computed runtime messaging is rejected by the sensitive API scan", [
    "--check",
    `--package=${variableComputedPackage}`,
    "--acknowledge-package-consent",
  ], 1, "--allow-sensitive-package-apis");
  runCase("variable-held computed runtime messaging cannot be acknowledged", [
    "--check",
    `--package=${variableComputedPackage}`,
    "--acknowledge-package-consent",
    "--allow-sensitive-package-apis",
  ], 1, "runtime messaging/port API findings cannot be authorized");

  const escapedStringRuntimePackage = await copyLocalPackage("dev-note", "escaped-string-runtime-sensitive-package");
  const escapedStringRuntimeManifest = await readManifest(escapedStringRuntimePackage);
  escapedStringRuntimeManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-04",
    notes: ["Synthetic reviewed exception fixture for row 132 escaped string scanner coverage."],
  };
  await writeManifest(escapedStringRuntimePackage, escapedStringRuntimeManifest);
  await writeFile(path.join(escapedStringRuntimePackage, "dist", "content.js"), [
    "export async function boot(context) {",
    "  const c = globalThis[\"chr\\u006fme\"];",
    "  const stored = await c.storage.local.get(\"beetol.accessToken\");",
    "  await c.runtime.sendMessage({ type: \"milxdy:checkUpdate\", leaked: stored[\"beetol.accessToken\"] });",
    "  context.recordDiagnostic(\"unicodeBypass\", { ok: true });",
    "}",
    "",
  ].join("\n"));
  runCase("row 132 escaped chrome runtime sendMessage payload is rejected by the sensitive API scan", [
    "--check",
    `--package=${escapedStringRuntimePackage}`,
    "--acknowledge-package-consent",
  ], 1, "--allow-sensitive-package-apis");
  runCase("row 132 escaped chrome runtime sendMessage payload cannot be acknowledged", [
    "--check",
    `--package=${escapedStringRuntimePackage}`,
    "--acknowledge-package-consent",
    "--allow-sensitive-package-apis",
  ], 1, "runtime messaging/port API findings cannot be authorized");

  const templateEscapedRuntimePackage = await copyLocalPackage("dev-note", "template-escaped-runtime-sensitive-package");
  const templateEscapedRuntimeManifest = await readManifest(templateEscapedRuntimePackage);
  templateEscapedRuntimeManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-04",
    notes: ["Synthetic reviewed exception fixture for template escaped string scanner coverage."],
  };
  await writeManifest(templateEscapedRuntimePackage, templateEscapedRuntimeManifest);
  await writeFile(path.join(templateEscapedRuntimePackage, "dist", "content.js"), [
    "export async function boot() {",
    "  await globalThis[\"chr\\u006fme\"][\"runt\\u0069me\"][\"send\\u004dessage\"]({ type: \"milxdy:checkUpdate\" });",
    "  const api = globalThis[`br\\u006f\\u0077ser`];",
    "  const chainedApi = api;",
    "  const runtimeName = `runt\\u0069me`;",
    "  const sendName = `send\\u004dessage`;",
    "  const connectName = \"con\\x6eect\";",
    "  await chainedApi[runtimeName][sendName]({ type: \"milxdy:checkUpdate\" });",
    "  const port = chainedApi[runtimeName][connectName]({ name: \"reminetChat:socket\" });",
    "  await chainedApi[`st\\u006frage`].local.get(`beetol.accessToken`);",
    "  port.disconnect();",
    "}",
    "",
  ].join("\n"));
  runCase("template escaped browser runtime sendMessage payload is rejected by the sensitive API scan", [
    "--check",
    `--package=${templateEscapedRuntimePackage}`,
    "--acknowledge-package-consent",
  ], 1, "--allow-sensitive-package-apis");
  runCase("template escaped browser runtime sendMessage payload cannot be acknowledged", [
    "--check",
    `--package=${templateEscapedRuntimePackage}`,
    "--acknowledge-package-consent",
    "--allow-sensitive-package-apis",
  ], 1, "runtime messaging/port API findings cannot be authorized");

  const charCodeComputedPackage = await copyLocalPackage("dev-note", "char-code-computed-sensitive-package");
  const charCodeComputedManifest = await readManifest(charCodeComputedPackage);
  charCodeComputedManifest.review = {
    status: "reviewed",
    reviewedBy: "local-app-trust-gate-verifier",
    reviewedAt: "2026-07-04",
    notes: ["Synthetic reviewed exception fixture for character-code computed scanner coverage."],
  };
  await writeManifest(charCodeComputedPackage, charCodeComputedManifest);
  await writeFile(path.join(charCodeComputedPackage, "dist", "content.js"), [
    "export async function boot() {",
    "  const api = globalThis[String.fromCharCode(99, 104, 114, 111, 109, 101)];",
    "  await api.runtime.sendMessage({ type: \"milxdy:checkUpdate\" });",
    "  await globalThis[String.fromCharCode(0x63, 0x68, 0x72, 0x6f, 0x6d, 0x65)].runtime.sendMessage({ type: \"milxdy:checkUpdate\" });",
    "}",
    "",
  ].join("\n"));
  runCase("character-code computed runtime messaging is rejected by the sensitive API scan", [
    "--check",
    `--package=${charCodeComputedPackage}`,
    "--acknowledge-package-consent",
  ], 1, "--allow-sensitive-package-apis");
  runCase("character-code computed runtime messaging cannot be acknowledged", [
    "--check",
    `--package=${charCodeComputedPackage}`,
    "--acknowledge-package-consent",
    "--allow-sensitive-package-apis",
  ], 1, "runtime messaging/port API findings cannot be authorized");

  const numericCharCodeProbes = [
    {
      fixtureName: "hex-char-code-runtime-sensitive-package",
      label: "compact hex String.fromCharCode chrome runtime sendMessage probe",
      source: "await globalThis[String.fromCharCode(0x63,0x68,0x72,0x6f,0x6d,0x65)].runtime.sendMessage({ type: \"milxdy:checkUpdate\" });",
    },
    {
      fixtureName: "binary-char-code-runtime-sensitive-package",
      label: "binary String.fromCharCode browser runtime connect probe",
      source: "globalThis[String.fromCharCode(0b1100010, 0b1110010, 0b1101111, 0b1110111, 0b1110011, 0b1100101, 0b1110010)].runtime.connect({ name: \"reminetChat:socket\" }).disconnect();",
    },
    {
      fixtureName: "octal-char-code-runtime-sensitive-package",
      label: "octal String.fromCharCode browser runtime sendMessage probe",
      source: "await globalThis[String.fromCharCode(0o142, 0o162, 0o157, 0o167, 0o163, 0o145, 0o162)].runtime.sendMessage({ type: \"milxdy:checkUpdate\" });",
    },
    {
      fixtureName: "separator-char-code-runtime-sensitive-package",
      label: "numeric-separator String.fromCharCode chrome runtime connect probe",
      source: "globalThis[String.fromCharCode(9_9, 10_4, 11_4, 11_1, 10_9, 10_1)].runtime.connect({ name: \"reminetChat:socket\" }).disconnect();",
    },
  ];
  for (const probe of numericCharCodeProbes) {
    const probePackage = await copyLocalPackage("dev-note", probe.fixtureName);
    const probeManifest = await readManifest(probePackage);
    probeManifest.review = {
      status: "reviewed",
      reviewedBy: "local-app-trust-gate-verifier",
      reviewedAt: "2026-07-04",
      notes: [`Synthetic reviewed exception fixture for ${probe.label}.`],
    };
    await writeManifest(probePackage, probeManifest);
    await writeFile(path.join(probePackage, "dist", "content.js"), [
      "export async function boot() {",
      `  ${probe.source}`,
      "}",
      "",
    ].join("\n"));
    runCase(`${probe.label} is rejected by the sensitive API scan`, [
      "--check",
      `--package=${probePackage}`,
      "--acknowledge-package-consent",
    ], 1, "--allow-sensitive-package-apis");
    runCase(`${probe.label} cannot be acknowledged`, [
      "--check",
      `--package=${probePackage}`,
      "--acknowledge-package-consent",
      "--allow-sensitive-package-apis",
    ], 1, "runtime messaging/port API findings cannot be authorized");
  }

  const tsEntryPackage = await copyLocalPackage("dev-note", "typescript-content-entry-package");
  const tsEntryManifest = await readManifest(tsEntryPackage);
  tsEntryManifest.contentEntry = "src/extension/content/index.ts";
  await mkdir(path.join(tsEntryPackage, "src"), { recursive: true });
  await writeFile(path.join(tsEntryPackage, "src", "content.ts"), [
    "export async function boot() {",
    "  return undefined;",
    "}",
    "",
  ].join("\n"));
  await writeManifest(tsEntryPackage, tsEntryManifest);
  runCase("untranspiled TypeScript content entries are rejected before custom build emission", [
    "--check",
    `--package=${tsEntryPackage}`,
    "--allow-local-review",
    "--acknowledge-package-consent",
  ], 1, "contentEntry must be an executable .js or .mjs module");

  const workspaceSensitivePackage = path.join(buildTmpRoot, "sensitive-source", "dev-note");
  await cp(reviewableSensitivePackage, workspaceSensitivePackage, { recursive: true });
  const sensitiveBuildPlan = await composeBuildPlan("sensitive-plan", {
    packagePath: workspaceSensitivePackage,
    extraArgs: ["--allow-sensitive-package-apis"],
  });
  await runBuildPlanCase("builder rejects forged sensitive API scan removal", sensitiveBuildPlan, (plan) => {
    plan.outputDir = toPosix(path.join(buildTmpRoot, "forged-sensitive-scan-out"));
    for (const diagnostic of plan.diagnostics || []) {
      if (diagnostic.packageId !== "dev-note") continue;
      diagnostic.payloadScan.findings = [];
      diagnostic.trust.sensitiveApiFindings = [];
      diagnostic.trust.sensitiveApiExceptionAcknowledged = false;
    }
  }, 1, "no longer passes composer trust gates");

  const validPlan = await composeBuildPlan("valid-plan");
  assertGeneratedCopyTargets(validPlan);
  assertGeneratedRuntimeMetadata(validPlan);
  const absolutePlan = await composeBuildPlan("absolute-package-plan", { packagePath: path.resolve("examples/packages/first-party-replacements/tweetPng") });
  assertGeneratedCopyTargets(absolutePlan);
  assertGeneratedRuntimeMetadata(absolutePlan);
  if (path.isAbsolute(absolutePlan.packageSources[0].root)) {
    fail("absolute package input should be recorded as a build-plan-safe relative root for workspace-contained packages");
  }
  await runBuildPlanCase("workspace absolute package input composes into a buildable relative plan", absolutePlan, (plan) => {
    plan.outputDir = toPosix(path.join(buildTmpRoot, "absolute-package-out"));
  }, 0, "Local app custom Chromium build emitted.");
  for (const protectedOutDir of ["src", "public", "scripts", ".git", "examples", "."]) {
    runCase(`composer out dir ${JSON.stringify(protectedOutDir)} is rejected before cleanup`, [
      "--check",
      `--out-dir=${protectedOutDir}`,
      `--package=${localPackage}`,
    ], 1, "--out-dir");
    await runBuildPlanCase(`build plan output dir ${JSON.stringify(protectedOutDir)} is rejected before cleanup`, validPlan, (plan) => {
      plan.outputDir = protectedOutDir;
    }, 1, "outputDir");
  }
  await runBuildPlanCase("tampered output directory is rejected", validPlan, (plan) => {
    plan.outputDir = "../outside-local-app-build";
  }, 1, "outputDir");
  await runBuildPlanCase("absolute package root is rejected", validPlan, (plan) => {
    plan.packageCopyMap[0].fromRoot = path.resolve(plan.packageCopyMap[0].fromRoot);
  }, 1, "fromRoot");
  await runBuildPlanCase("widened package root is rejected", validPlan, (plan) => {
    const originalRoot = plan.packageCopyMap[0].fromRoot;
    plan.packageCopyMap[0].fromRoot = toPosix(path.dirname(originalRoot));
    plan.packageCopyMap[0].from = `${path.basename(originalRoot)}/${plan.packageCopyMap[0].from}`;
  }, 1, "declared package root");
  await runBuildPlanCase("traversing package source is rejected", validPlan, (plan) => {
    plan.packageCopyMap[0].from = "../milxdy.app.json";
  }, 1, "from");
  await runBuildPlanCase("traversing package destination is rejected", validPlan, (plan) => {
    plan.packageCopyMap[0].to = "../escaped.js";
  }, 1, "to");
  await runBuildPlanCase("first-party-looking package destination is rejected", validPlan, (plan) => {
    plan.packageCopyMap[0].to = "features/escaped.js";
  }, 1, "local-apps/tweetPng/");
  await runBuildPlanCase("tampered package source id is rejected", validPlan, (plan) => {
    plan.packageSources[0].packageId = "../brand";
  }, 1, "safe package identifier");
  await runBuildPlanCase("tampered package copy id is rejected", validPlan, (plan) => {
    plan.packageCopyMap[0].packageId = "x/../../brand";
  }, 1, "safe package identifier");
  await runBuildPlanCase("tampered selected package id is rejected", validPlan, (plan) => {
    plan.selectedPackageIds[0] = ".";
  }, 1, "safe package identifier");
  await runBuildPlanCase("tampered local app metadata id is rejected", validPlan, (plan) => {
    const app = plan.apps.find((candidate) => candidate.id === "tweetPng");
    app.id = "C:\\brand";
  }, 1, "safe package identifier");
  await runBuildPlanCase("missing package file hash is rejected", validPlan, (plan) => {
    delete plan.packageCopyMap[0].sha256;
  }, 1, "SHA-256");
  await runBuildPlanCase("mismatched package file hash is rejected", validPlan, (plan) => {
    plan.outputDir = toPosix(path.join(buildTmpRoot, "hash-mismatch-out"));
    plan.packageCopyMap[0].sha256 = "0".repeat(64);
  }, 1, "hash mismatch");
  await runBuildPlanCase("tampered first-party replacement trust policy is rejected", validPlan, (plan) => {
    plan.diagnostics[0].trust.firstPartyReplacementPolicy.allowed = false;
  }, 1, "verified first-party replacement trust decision");
  await runBuildPlanCase("tampered first-party replacement package hash is rejected", validPlan, (plan) => {
    plan.diagnostics[0].packageSha256 = "0".repeat(64);
  }, 1, "first-party replacement hash");
  await runBuildPlanCase("tampered local app content entry is rejected", validPlan, (plan) => {
    const app = plan.apps.find((candidate) => candidate.id === "tweetPng");
    app.contentEntry = "local-apps/tweetPng/injected.js";
  }, 1, "content entry outside the composer copy map");
  await runBuildPlanCase("tampered content entry web accessibility removal is rejected", validPlan, (plan) => {
    const app = plan.apps.find((candidate) => candidate.id === "tweetPng");
    for (const entry of plan.webAccessibleAssets || []) {
      entry.resources = (entry.resources || []).filter((resource) => resource !== app.contentEntry);
    }
  }, 1, "runtime-imported contentEntry");
  await runBuildPlanCase("tampered local app package asset is rejected", validPlan, (plan) => {
    const app = plan.apps.find((candidate) => candidate.id === "tweetPng");
    app.package.assets.push("local-apps/tweetPng/injected.js");
  }, 1, "package asset outside the composer copy map");
  await runBuildPlanCase("tampered host permission expansion is rejected", validPlan, (plan) => {
    plan.manifestPermissions.addedHostPermissions.push("https://evil.example/*");
    plan.manifestPermissions.host_permissions.push("https://evil.example/*");
  }, 1, "manifest permission expansion");
  await runBuildPlanCase("tampered direct host permission is rejected", validPlan, (plan) => {
    plan.manifestPermissions.host_permissions.push("https://evil.example/*");
  }, 1, "host permission is outside composer diagnostics");
  await runBuildPlanCase("tampered web-accessible resource is rejected", validPlan, (plan) => {
    plan.webAccessibleAssets[0].resources.push("local-apps/tweetPng/injected.js");
  }, 1, "web-accessible resource is outside the composer copy map");
  assertStaticCoverage(
    "zip inflated length is checked after decompression",
    "inflated.byteLength !== entry.uncompressedSize",
  );
  assertStaticCoverage(
    "local package storage keys are compared against the built-in registry",
    "builtInRegistryStorageKeys(registryApps)",
  );
  assertStaticCoverage(
    "generated settings reject sensitive storage names",
    "sensitiveGeneratedStorageNeedles",
  );
  assertDocumentedDefaultCommand("APP_SDK local builder default includes first-party replacement acknowledgement", appSdkDocs, "build:local-apps:chromium");
  assertDocumentedDefaultCommand("example README local builder default includes first-party replacement acknowledgement", exampleReadme, "build:local-apps:chromium");
  assertDocumentedDefaultCommand("APP_SDK local composer default includes first-party replacement acknowledgement", appSdkDocs, "compose:local-apps");
  assertDocumentedDefaultCommand("example README local composer default includes first-party replacement acknowledgement", exampleReadme, "compose:local-apps");
} finally {
  await rm(tmpRoot, { recursive: true, force: true });
  await rm(buildTmpRoot, { recursive: true, force: true });
}

printResults();
if (failures.length > 0) process.exit(1);

async function copyPackage(packageId, fixtureName) {
  const destinationRoot = path.join(tmpRoot, fixtureName);
  const destination = path.join(destinationRoot, packageId);
  await cp(path.join("examples/packages/first-party-replacements", packageId), destination, { recursive: true });
  return destination;
}

async function copyLocalPackage(packageId, fixtureName) {
  const destinationRoot = path.join(tmpRoot, fixtureName);
  const destination = path.join(destinationRoot, packageId);
  await cp(path.join("examples/packages/local-dev", packageId), destination, { recursive: true });
  return destination;
}

async function readManifest(packageDir) {
  return JSON.parse(await readFile(path.join(packageDir, "milxdy.app.json"), "utf8"));
}

async function writeManifest(packageDir, manifest) {
  await writeFile(path.join(packageDir, "milxdy.app.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}

function runCase(label, args, expectedStatus, expectedText) {
  const result = spawnSync(process.execPath, [composer, ...args], {
    encoding: "utf8",
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const actualStatus = result.status ?? 1;
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

function runLocalBuilderCase(label, args, expectedStatus, expectedText) {
  const result = spawnSync(process.execPath, ["scripts/build/build-local-apps.mjs", ...args], {
    encoding: "utf8",
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  const actualStatus = result.status ?? 1;
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

async function runRejectedComposerCaseWithoutPlan(label, args, expectedText) {
  const caseDir = path.join(buildTmpRoot, safeFixtureName(label));
  const planPath = path.join(caseDir, "build-plan.json");
  await mkdir(caseDir, { recursive: true });
  runCase(label, [
    `--out-dir=${toPosix(caseDir)}`,
    `--plan-out=${toPosix(planPath)}`,
    ...args,
  ], 1, expectedText);
  try {
    await readFile(planPath, "utf8");
    failures.push(`${label}: composer emitted a build plan for a rejected package`);
  } catch {
    notes.push(`${label}: no build plan emitted`);
  }
}

function assertStaticCoverage(label, expectedText) {
  if (!composerSource.includes(expectedText)) {
    failures.push(`${label}: expected composer source to include ${JSON.stringify(expectedText)}`);
    return;
  }
  notes.push(`${label}: ok`);
}

function assertDocumentedDefaultCommand(label, source, scriptName) {
  const pattern = new RegExp(`pnpm\\.cmd run ${scriptName} -- --allow-local-review --acknowledge-package-consent --acknowledge-first-party-replacement`);
  if (!pattern.test(source)) {
    failures.push(`${label}: expected docs to include the clean-checkout fallback command with --acknowledge-first-party-replacement`);
    return;
  }
  notes.push(`${label}: ok`);
}

function assertPackageScriptDoesNotAcknowledgeLocalAppTrust() {
  const script = packageJson.scripts?.["build:local-apps:chromium"] || "";
  const forbiddenFlags = [
    "--allow-local-review",
    "--acknowledge-package-consent",
    "--acknowledge-first-party-replacement",
  ];
  const leakedFlag = forbiddenFlags.find((flag) => script.includes(flag));
  if (leakedFlag) {
    failures.push(`build:local-apps:chromium must not silently pass ${leakedFlag}; callers must type trust acknowledgements explicitly`);
    return;
  }
  notes.push("build:local-apps:chromium package script leaves trust acknowledgements explicit: ok");
}

function assertGeneratedCopyTargets(plan) {
  if (!plan) return;
  for (const item of plan.packageCopyMap || []) {
    const expectedPrefix = `local-apps/${item.packageId}/`;
    if (!item.to.startsWith(expectedPrefix)) {
      failures.push(`generated local app copy target stays in package namespace: expected ${item.to} to start with ${expectedPrefix}`);
      return;
    }
  }
  notes.push("generated local app copy targets stay in package namespaces: ok");
}

function assertGeneratedRuntimeMetadata(plan) {
  if (!plan) return;
  const webResources = new Set((plan.webAccessibleAssets || []).flatMap((entry) => entry.resources || []));
  if (webResources.has("local-app-composition.json")) {
    failures.push("generated web-accessible resources exclude local-app-composition.json: leaked inspection artifact");
    return;
  }
  for (const app of plan.apps || []) {
    if (!app.localPackage) continue;
    if (app.$schema !== undefined) {
      failures.push(`generated runtime metadata strips authoring $schema: ${app.id} leaked $schema`);
      return;
    }
    if (!webResources.has(app.contentEntry)) {
      failures.push(`generated runtime metadata exposes contentEntry through WAR: ${app.id} missing ${app.contentEntry}`);
      return;
    }
  }
  notes.push("generated runtime metadata strips authoring $schema: ok");
  notes.push("generated WAR resources expose content entries and hide inspection metadata: ok");
}

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

function toPosix(value) {
  return value.replaceAll("\\", "/");
}

function safeFixtureName(value) {
  return value.replace(/[^A-Za-z0-9._-]/g, "_").replace(/^[.-]+$/u, "dot") || "empty";
}

function printResults() {
  console.log("Local app package trust-gate verification");
  console.log(`  cases checked: ${notes.length + failures.length}`);
  if (notes.length > 0) {
    console.log("  notes:");
    for (const note of notes) console.log(`  - ${note}`);
  }
  if (failures.length > 0) {
    console.error(`  failures: ${failures.length}`);
    for (const failure of failures) console.error(`  - ${failure}`);
    return;
  }
  console.log("  failures: none");
  console.log("Local app package trust-gate verification passed.");
}
