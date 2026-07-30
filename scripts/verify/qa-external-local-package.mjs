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
  manifest.surfaces = ["composerAction", "replyAction"];
  manifest.loadTriggers = ["userAction"];
  manifest.siteScopes = manifest.siteScopes.map((scope) => ({ ...scope, surfaces: ["composerAction", "replyAction"] }));
  manifest.composerAction = { label: "Developer Note", presentation: "anchoredPanel", icon: "dev-note-icon.svg" };
  manifest.hostComposerActions = ["nativeDrafts"];
  manifest.storageKeys.local = [...new Set([...(manifest.storageKeys.local || []), "milxdy.local.dev-note.replyPhrases"])];
  manifest.settings.push({
    id: "dev-note.replyPhrases",
    label: "Reply phrases",
    scope: "app",
    location: "appsAndFeatures",
    storage: { area: "local", key: "milxdy.local.dev-note.replyPhrases" },
    defaultValue: [],
    control: { type: "textList", maxItems: 5, maxLength: 120, placeholder: "Add a phrase" },
    reset: { behavior: "restoreDefault" },
  });
  manifest.replyAction = { templates: [{ id: "starter", label: "Starter reply", text: "Starter reply", sendAfterInsert: true }, { id: "custom", label: "Custom", storageListKey: "milxdy.local.dev-note.replyPhrases" }] };
  manifest.css = [{ id: "developer-note.styles", path: "dev-note.css" }];
  manifest.package.assets.push({ id: "developer-note.styles", path: "dev-note.css", kind: "style", webAccessible: false });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(externalPackage, "dev-note.css"), ".developer-note { color: canvastext; }\n");
  await writeFile(path.join(externalPackage, "dev-note-icon.svg"), '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><path d="M0 0h1v1H0z"/></svg>\n');
  manifest.package.assets.push({ id: "developer-note.icon", path: "dev-note-icon.svg", kind: "icon", webAccessible: true });
  manifest.package.webAccessibleAssets.push("dev-note-icon.svg");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const entryPath = path.join(externalPackage, "dist", "content.js");
  await writeFile(entryPath, `${await readFile(entryPath, "utf8")}\nexport function onComposerAction({ panel }) { panel.textContent = "External composer fixture"; }\nexport function onReplyAction({ panel, openNativeReply, templates, selectTemplate }) { panel.replaceChildren(); const nativeReply = document.createElement("button"); nativeReply.textContent = "Send a reply"; nativeReply.addEventListener("click", openNativeReply); panel.append(nativeReply); for (const template of templates) { const row = document.createElement("button"); row.textContent = template.label; row.addEventListener("click", () => selectTemplate(template.id)); panel.append(row); } }\n`);
  const mixedPackageArgs = [
    "scripts/qa/qa-reload.mjs",
    "--once",
    `--publish-dir=${qaOutput}`,
    `--local-app-package=${externalPackage}`,
    "--local-app-package=examples/packages/first-party-replacements/tweetPng",
    "--allow-local-review",
    "--acknowledge-package-consent",
  ];
  const watchModeComposition = runResult(mixedPackageArgs.filter((arg) => arg !== "--once"));
  assert.notEqual(watchModeComposition.status, 0, "mixed external composition must remain one-shot only");
  assert.match(`${watchModeComposition.stdout}\n${watchModeComposition.stderr}`, /one-shot only/u);
  const incompatibleBaseline = runResult([...mixedPackageArgs, "--return-to-baseline"]);
  assert.notEqual(incompatibleBaseline.status, 0, "mixed external composition must reject return-to-baseline");
  assert.match(`${incompatibleBaseline.stdout}\n${incompatibleBaseline.stderr}`, /cannot be combined/u);
  const missingReplacementAcknowledgement = runResult(mixedPackageArgs);
  assert.notEqual(missingReplacementAcknowledgement.status, 0, "mixed QA composition must fail without first-party replacement acknowledgement");
  assert.match(`${missingReplacementAcknowledgement.stdout}\n${missingReplacementAcknowledgement.stderr}`, /--acknowledge-first-party-replacement/u);
  run([...mixedPackageArgs, "--acknowledge-first-party-replacement"]);

  const provenance = JSON.parse(await readFile(path.join(qaOutput, "qa-build.json"), "utf8"));
  assert.equal(provenance.composition.state, "external-local-package");
  assert.match(provenance.composition.fingerprint, /^[a-f0-9]{64}$/u);
  assert.equal(provenance.composition.packages.length, 2);
  const composed = provenance.composition.packages.find((entry) => entry.id === "dev-note");
  assert.ok(composed, "explicit external package must be present in QA provenance");
  assert.equal(composed.id, "dev-note");
  assert.equal(composed.version, "0.1.0");
  for (const key of ["manifestSha256", "contentSha256", "packageSha256"]) assert.match(composed[key], /^[a-f0-9]{64}$/u);
  const shareKit = provenance.composition.packages.find((entry) => entry.id === "tweetPng");
  assert.ok(shareKit, "reviewed Share Kit replacement must be present in QA provenance");
  assert.equal(shareKit.version, "0.2.4");
  for (const key of ["manifestSha256", "contentSha256", "packageSha256"]) assert.match(shareKit[key], /^[a-f0-9]{64}$/u);
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
  assert.match(runtimeRegistry, /replyAction:\s*\{\s*templates:/u, "staged external reply action must reach the runtime registry");
  assert.match(runtimeRegistry, /sendAfterInsert:\s*true/u, "staged external reply action must preserve its explicit send opt-in");
  assert.match(runtimeRegistry, /hostComposerActions:\s*\["nativeDrafts"\]/u, "staged external apps must preserve declared host companion actions");
  assert.match(runtimeRegistry, /storageListKey:\s*"milxdy\.local\.dev-note\.replyPhrases"/u, "staged external reply actions must preserve bounded storage-list templates");
  assert.match(runtimeRegistry, /composerAction:[\s\S]{0,240}?icon:\s*"local-apps\/dev-note\/dev-note-icon\.svg"/u, "staged external composer icons must be rebased to the package output prefix");
  assert.match(
    runtimeRegistry,
    /id:\s*"tweetPng"[\s\S]{0,600}?name:\s*"Share Kit"[\s\S]{0,600}?available:\s*true/u,
    "reviewed Share Kit replacement must be compiled into the runtime registry as available",
  );
  assert.doesNotMatch(
    runtimeRegistry,
    /id:\s*"tweetPng"[\s\S]{0,800}?unavailableReason:\s*"Share Kit is not included/u,
    "composed Share Kit metadata must not retain the base-build unavailable reason",
  );
  assert.match(runtimeRegistry, /contextualPostActions:[\s\S]{0,260}?label:\s*"Review with Share Kit"/u, "Share Kit contextual action must reach the runtime registry");
  const builtManifest = JSON.parse(await readFile(path.join(qaOutput, "manifest.json"), "utf8"));
  const webResources = builtManifest.web_accessible_resources.flatMap((entry) => entry.resources || []);
  assert.ok(webResources.includes("local-apps/dev-note/dev-note.css"), "declared composer CSS must be web-accessible so the host-owned shadow panel can load it");
  assert.ok(webResources.includes("local-apps/tweetPng/assets/tweet-png-icon.svg"), "Share Kit contextual icon must be web-accessible");
  assert.equal(await readFile(path.join(qaOutput, "local-apps", "tweetPng", "dist", "content.js"), "utf8").then((source) => source.length > 0), true, "Share Kit content package must be emitted");

  run(["scripts/qa/qa-reload.mjs", "--once", `--publish-dir=${qaOutput}`, "--return-to-baseline"]);
  const baseline = JSON.parse(await readFile(path.join(qaOutput, "qa-build.json"), "utf8"));
  assert.equal(baseline.composition.state, "release-baseline");
  assert.equal(baseline.extensionId, provenance.extensionId);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("External local-package QA composition verification passed.");

function run(args) {
  const result = runResult(args);
  if (result.status === 0) return;
  process.stderr.write(result.stdout || "");
  process.stderr.write(result.stderr || "");
  throw new Error(`Verification command failed: ${args.join(" ")}`);
}

function runResult(args) {
  return spawnSync(process.execPath, args, { encoding: "utf8" });
}
