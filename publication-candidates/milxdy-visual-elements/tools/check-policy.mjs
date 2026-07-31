import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import {
  candidateRoot,
  invariant,
  isDirectExecution,
  listFiles,
  readJson,
  relativeFromCandidate,
  sha256File,
} from "./lib.mjs";

const binaryExtensions = new Set([
  ".avif",
  ".gif",
  ".ico",
  ".jpeg",
  ".jpg",
  ".mp3",
  ".ogg",
  ".otf",
  ".png",
  ".ttf",
  ".wav",
  ".webp",
  ".woff",
  ".woff2",
  ".zip",
]);

const forbiddenSvgPatterns = [
  /<script\b/i,
  /<foreignObject\b/i,
  /\son[a-z]+\s*=/i,
  /\b(?:href|xlink:href)\s*=\s*["'](?:https?:|\/\/|javascript:|data:text\/html)/i,
  /<animate(?:Motion|Transform)?\b/i,
  /javascript:/i,
];

const runtimeDirectories = ["catalog", "examples", "recipes", "tokens"];

export async function checkPolicy() {
  const catalog = await readJson(path.join(candidateRoot, "catalog.json"));
  const rootLicense = path.join(candidateRoot, "LICENSE");
  const licenseHash = await sha256File(rootLicense);
  const errors = [];

  if (catalog.repositoryLicense.id !== "VPL") errors.push("repository license ID must be VPL");
  if (catalog.repositoryLicense.sha256 !== licenseHash) errors.push("repository license hash differs from root LICENSE");

  const licenseCopies = (await listFiles(candidateRoot)).filter((file) =>
    relativeFromCandidate(file).endsWith("LICENSES/VPL.txt")
  );
  for (const file of licenseCopies) {
    if (await sha256File(file) !== licenseHash) errors.push(`${relativeFromCandidate(file)}: VPL text differs`);
  }

  const assetFiles = await readdir(path.join(candidateRoot, "assets"));
  if (catalog.entries.length === 0 && assetFiles.some((name) => name !== "README.md")) {
    errors.push("assets/: empty production catalog may contain only README.md");
  }

  const manifestFiles = await readdir(path.join(candidateRoot, "manifests"));
  if (catalog.entries.length === 0 && manifestFiles.some((name) => name !== "README.md")) {
    errors.push("manifests/: empty production catalog may contain only README.md");
  }

  for (const [index, entry] of catalog.entries.entries()) {
    if (/^fixtures\//.test(entry.manifestPath) || (entry.decisionPath && /^fixtures\//.test(entry.decisionPath))) {
      errors.push(`catalog entry ${index}: production references a fixture`);
    }
  }

  const allFiles = await listFiles(candidateRoot);
  for (const file of allFiles) {
    const relative = relativeFromCandidate(file);
    const extension = path.extname(file).toLowerCase();
    if (binaryExtensions.has(extension) && !relative.startsWith("assets/")) {
      errors.push(`${relative}: publication binaries must be reviewed and stored below assets/`);
    }
    if (extension === ".svg") {
      const svg = await readFile(file, "utf8");
      for (const pattern of forbiddenSvgPatterns) {
        if (pattern.test(svg)) errors.push(`${relative}: unsafe SVG pattern ${pattern}`);
      }
    }
  }

  for (const directory of runtimeDirectories) {
    const files = await listFiles(path.join(candidateRoot, directory));
    for (const file of files) {
      const extension = path.extname(file).toLowerCase();
      if (![".css", ".html", ".js", ".mjs"].includes(extension)) continue;
      const text = await readFile(file, "utf8");
      if (/url\(\s*["']?https?:\/\//i.test(text)) {
        errors.push(`${relativeFromCandidate(file)}: remote CSS asset URL`);
      }
      if (/\b(?:fetch|import)\s*\(\s*["']https?:\/\//i.test(text)) {
        errors.push(`${relativeFromCandidate(file)}: remote runtime fetch/import`);
      }
      if (/\b(?:src|href)=["']https?:\/\//i.test(text)) {
        errors.push(`${relativeFromCandidate(file)}: remote runtime source`);
      }
    }
  }

  invariant(errors.length === 0, `Policy check failed:\n${errors.join("\n")}`);
  return {
    catalogEntries: catalog.entries.length,
    licenseCopies: licenseCopies.length,
    svgFiles: allFiles.filter((file) => path.extname(file).toLowerCase() === ".svg").length,
    binaryFiles: allFiles.filter((file) => binaryExtensions.has(path.extname(file).toLowerCase())).length,
  };
}

if (isDirectExecution(import.meta.url)) {
  const summary = await checkPolicy();
  console.log(
    `Checked policy for ${summary.catalogEntries} production entries, ${summary.licenseCopies} VPL copies, ` +
    `${summary.svgFiles} SVG files, and ${summary.binaryFiles} binary files.`,
  );
}
