import path from "node:path";

const allowedGeneratedOutputRoots = new Set(["dist", "tmp"]);

export function assertSafeGeneratedOutputDir(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label} must be a non-empty relative generated output path.`);
  }
  const normalizedValue = value.replaceAll("\\", "/");
  if (path.isAbsolute(value) || path.posix.isAbsolute(normalizedValue) || /^[A-Za-z]:/.test(normalizedValue)) {
    throw new Error(`${label} must be a relative generated output path.`);
  }
  if (/[\x00-\x1f\x7f]/u.test(normalizedValue)) {
    throw new Error(`${label} must not contain control characters.`);
  }
  const parts = normalizedValue.split("/");
  if (parts.includes("..") || parts.includes("")) {
    throw new Error(`${label} must not traverse directories.`);
  }
  const normalized = path.posix.normalize(normalizedValue);
  if (normalized === "." || normalized === ".." || normalized.startsWith("../")) {
    throw new Error(`${label} must not traverse directories.`);
  }
  const normalizedParts = normalized.split("/");
  if (normalizedParts.length < 2 || !allowedGeneratedOutputRoots.has(normalizedParts[0])) {
    throw new Error(`${label} must stay under dist/ or tmp/.`);
  }
  const workspaceRoot = path.resolve(".");
  const resolved = path.resolve(workspaceRoot, normalized);
  const relativePath = path.relative(workspaceRoot, resolved);
  if (relativePath === "" || relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error(`${label} must stay inside the workspace.`);
  }
  return normalized;
}
