import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  candidateRoot,
  invariant,
  isDirectExecution,
  listFiles,
  relativeFromCandidate,
} from "./lib.mjs";

const textExtensions = new Set([".md", ".html", ".css", ".js", ".mjs", ".json"]);
const externalPattern = /^(?:[A-Za-z][A-Za-z0-9+.-]*:|\/\/)/;

function stripQueryAndFragment(target) {
  const hashIndex = target.indexOf("#");
  const queryIndex = target.indexOf("?");
  const end = [hashIndex, queryIndex].filter((index) => index >= 0).reduce((min, index) => Math.min(min, index), target.length);
  return {
    file: target.slice(0, end),
    fragment: hashIndex >= 0 ? target.slice(hashIndex + 1) : "",
  };
}

function githubSlug(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/<[^>]+>/g, "")
    .replace(/[^\p{L}\p{N}\s-]/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

async function markdownAnchors(filePath) {
  const text = await readFile(filePath, "utf8");
  const anchors = new Set();
  for (const match of text.matchAll(/^#{1,6}\s+(.+)$/gm)) anchors.add(githubSlug(match[1]));
  return anchors;
}

function collectTargets(filePath, text) {
  const extension = path.extname(filePath).toLowerCase();
  const targets = [];

  if (extension === ".md") {
    for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)) {
      targets.push(match[1].replace(/^<|>$/g, ""));
    }
  }

  if (extension === ".html") {
    for (const match of text.matchAll(/\b(?:href|src)=["']([^"']+)["']/gi)) targets.push(match[1]);
  }

  if (extension === ".css") {
    for (const match of text.matchAll(/@import\s+(?:url\()?["']([^"']+)["']/gi)) targets.push(match[1]);
    for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)) targets.push(match[1]);
  }

  if (extension === ".js" || extension === ".mjs") {
    for (const match of text.matchAll(/\bfetch\(\s*["']([^"']+)["']/g)) targets.push(match[1]);
    for (const match of text.matchAll(/\bfrom\s+["']([^"']+)["']/g)) targets.push(match[1]);
  }

  if (extension === ".json") {
    try {
      const value = JSON.parse(text);
      if (typeof value.$schema === "string") targets.push(value.$schema);
    } catch {
      // JSON syntax is reported by the schema/fixture validation pass.
    }
  }

  return targets;
}

export async function checkLinks() {
  const files = (await listFiles(candidateRoot)).filter((file) => textExtensions.has(path.extname(file).toLowerCase()));
  const errors = [];
  let checked = 0;

  for (const source of files) {
    const text = await readFile(source, "utf8");
    for (const rawTarget of collectTargets(source, text)) {
      if (!rawTarget || rawTarget.startsWith("#") || externalPattern.test(rawTarget) || rawTarget.startsWith("data:")) continue;
      const target = decodeURIComponent(rawTarget);
      const { file, fragment } = stripQueryAndFragment(target);
      if (!file) continue;
      checked += 1;
      const resolved = path.resolve(path.dirname(source), file);
      if (!(resolved === candidateRoot || resolved.startsWith(`${candidateRoot}${path.sep}`))) {
        errors.push(`${relativeFromCandidate(source)} -> ${rawTarget}: escapes candidate repository`);
        continue;
      }
      try {
        const info = await import("node:fs/promises").then(({ stat }) => stat(resolved));
        if (!info.isFile()) errors.push(`${relativeFromCandidate(source)} -> ${rawTarget}: target is not a file`);
        if (fragment && path.extname(resolved).toLowerCase() === ".md") {
          const anchors = await markdownAnchors(resolved);
          if (!anchors.has(fragment.toLowerCase())) {
            errors.push(`${relativeFromCandidate(source)} -> ${rawTarget}: Markdown fragment not found`);
          }
        }
      } catch {
        errors.push(`${relativeFromCandidate(source)} -> ${rawTarget}: target does not exist`);
      }
    }
  }

  invariant(errors.length === 0, `Local link check failed:\n${errors.join("\n")}`);
  return { files: files.length, links: checked };
}

if (isDirectExecution(import.meta.url)) {
  const summary = await checkLinks();
  console.log(`Checked ${summary.links} local links across ${summary.files} text files.`);
}
