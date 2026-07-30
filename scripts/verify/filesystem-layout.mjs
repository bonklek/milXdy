import { existsSync, readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const failures = [];

const requiredDirs = [
  "src/extension",
  "src/platform",
  "src/apps",
  "src/distributions",
  "assets/extension",
  "assets/apps",
  "assets/models",
  "assets/user-downloads/wiki-helper",
  "examples/packages/first-party-replacements",
  "examples/packages/local-dev",
  "scripts/build",
  "scripts/packages",
  "scripts/verify",
  "scripts/smoke",
  "scripts/release",
];

const forbiddenRoots = [
  "src/features",
  "src/entries",
  "src/shared",
  "src/standalone",
  "public",
  "examples/app-packages",
  "examples/local-app-packages",
];

for (const dir of requiredDirs) assert(existsSync(dir), `required filesystem root is missing: ${dir}`);
for (const dir of forbiddenRoots) assert(!directoryHasFiles(dir), `historical filesystem root must not contain files: ${dir}`);

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const registry = JSON.parse(await readFile("src/platform/app-sdk/first-party-apps.json", "utf8"));
const manifest = JSON.parse(await readFile("assets/extension/manifest.json", "utf8"));

for (const app of registry) {
  if (!app.entryPoint && app.available === false) continue;
  assert(typeof app.entryPoint === "string" && app.entryPoint.startsWith("src/apps/"), `${app.id}: entryPoint must live under src/apps`);
  assert(app.entryPoint.endsWith("/entry.ts"), `${app.id}: entryPoint must be an app-local entry.ts`);
  assert(existsSync(app.entryPoint), `${app.id}: app-local entryPoint is missing: ${app.entryPoint}`);
  for (const sheet of app.css || []) {
    assert(sheet.source?.startsWith("src/apps/"), `${app.id}: CSS source must live under src/apps`);
    assert(existsSync(sheet.source), `${app.id}: CSS source is missing: ${sheet.source}`);
  }
  assert(!(app.assets || []).includes("wiki-helper"), `${app.id}: wiki-helper must not be modeled as an app runtime asset`);
}

const distributionSources = sourceFiles("src/distributions");
for (const file of distributionSources) {
  const source = await readFile(file, "utf8");
  assert(!source.includes("src/distributions/post-reading") || file.includes("src/distributions/post-reading"), `${file}: app source must not import distribution wrappers`);
}
const postReadingAppSources = sourceFiles("src/apps/post-reading");
for (const file of postReadingAppSources) {
  const source = await readFile(file, "utf8");
  assert(!/from\s+["'][^"']*distributions\/post-reading|import\s*\([^)]*distributions\/post-reading/.test(source), `${file}: Post-reading app source must not import distribution wrappers`);
}

for (const command of Object.values(packageJson.scripts || {})) {
  assert(!/scripts\/(?:build|build-local-apps|build-post-reading|compose-local-app-packages|verify-[^/\s]+|release-builds|release-registry|package-release)\.mjs/.test(command), `package script still points at a flat scripts path: ${command}`);
}

const topLevelScripts = readdirSync("scripts", { withFileTypes: true }).filter((entry) => entry.isFile());
assert(topLevelScripts.length === 0, `scripts root must contain workflow folders only, found files: ${topLevelScripts.map((entry) => entry.name).join(", ")}`);

const manifestResources = (manifest.web_accessible_resources || []).flatMap((entry) => entry.resources || []);
for (const resource of manifestResources) {
  assert(!String(resource).startsWith("wiki-helper/"), `wiki-helper must not be web-accessible: ${resource}`);
  assert(!String(resource).startsWith("user-downloads/"), `user downloads must not be web-accessible: ${resource}`);
}

assert(existsSync("assets/user-downloads/wiki-helper/remilia-wiki-article-writer.zip"), "Wiki Helper ZIP must live under assets/user-downloads/wiki-helper");

if (failures.length > 0) {
  console.error("Filesystem layout verification failed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Filesystem layout verification passed.");

function sourceFiles(root) {
  if (!existsSync(root)) return [];
  const files = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const file = path.join(root, entry.name);
    if (entry.isDirectory()) files.push(...sourceFiles(file));
    else if (/\.[cm]?[jt]sx?$/.test(entry.name)) files.push(normalizePosix(file));
  }
  return files;
}

function directoryHasFiles(root) {
  if (!existsSync(root)) return false;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (entry.isFile()) return true;
    if (entry.isDirectory() && directoryHasFiles(path.join(root, entry.name))) return true;
  }
  return false;
}

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function normalizePosix(value) {
  return value.replaceAll("\\", "/");
}
