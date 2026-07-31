import { createHash } from "node:crypto";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const candidateRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
export const mainRepositoryRoot = path.resolve(candidateRoot, "..", "..");

export function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function sha256File(filePath) {
  const bytes = await readFile(filePath);
  return createHash("sha256").update(bytes).digest("hex");
}

export async function fileSize(filePath) {
  return (await stat(filePath)).size;
}

export async function listFiles(root, options = {}) {
  const output = [];
  const ignored = new Set(options.ignoreDirectories ?? ["node_modules"]);

  async function visit(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (ignored.has(entry.name)) continue;
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolute);
      } else if (entry.isFile()) {
        output.push(absolute);
      }
    }
  }

  await visit(root);
  return output.sort();
}

export function relativeFromCandidate(filePath) {
  return path.relative(candidateRoot, filePath).replaceAll("\\", "/");
}

export function resolveCandidatePath(relativePath) {
  invariant(isSafeRelativePath(relativePath), `Unsafe candidate path: ${relativePath}`);
  const absolute = path.resolve(candidateRoot, relativePath);
  const boundary = `${candidateRoot}${path.sep}`;
  invariant(absolute === candidateRoot || absolute.startsWith(boundary), `Path escapes candidate: ${relativePath}`);
  return absolute;
}

export function isSafeRelativePath(value) {
  if (typeof value !== "string" || value.length === 0) return false;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(value)) return false;
  if (/^[\\/]/.test(value) || /^[A-Za-z]:/.test(value)) return false;
  return !value.split(/[\\/]/).includes("..");
}

export function clone(value) {
  return structuredClone(value);
}

function pointerParts(pointer) {
  invariant(typeof pointer === "string" && pointer.startsWith("/"), `Invalid JSON pointer: ${pointer}`);
  return pointer
    .slice(1)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"));
}

export function removeAtPointer(value, pointer) {
  const parts = pointerParts(pointer);
  const key = parts.pop();
  let target = value;
  for (const part of parts) target = target[part];
  delete target[key];
}

export function setAtPointer(value, pointer, replacement) {
  const parts = pointerParts(pointer);
  const key = parts.pop();
  let target = value;
  for (const part of parts) target = target[part];
  target[key] = replacement;
}

export function applyInvalidCase(baseline, fixtureCase) {
  const value = clone(baseline);
  if (fixtureCase.remove) removeAtPointer(value, fixtureCase.remove);
  if (fixtureCase.set) setAtPointer(value, fixtureCase.set.path, fixtureCase.set.value);
  return value;
}

export function jsonPointerGet(root, pointer) {
  if (pointer === "#") return root;
  invariant(pointer.startsWith("#/"), `Unsupported schema reference: ${pointer}`);
  return pointer
    .slice(2)
    .split("/")
    .map((part) => part.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, key) => value[key], root);
}

export function isDirectExecution(moduleUrl) {
  if (!process.argv[1]) return false;
  return path.resolve(fileURLToPath(moduleUrl)) === path.resolve(process.argv[1]);
}
