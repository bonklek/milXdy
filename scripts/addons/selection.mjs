import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { copyFile, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const PACKAGE_ID = /^[a-z][a-z0-9-]{1,63}$/u;
const FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}\.zip$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

export async function loadSelection(selectionPath, policyPath, reviewsPath) {
  const [selectionBytes, policy, trustedReviews] = await Promise.all([
    readFile(selectionPath),
    readJsonRequired(policyPath),
    readJsonRequired(reviewsPath),
  ]);
  const selection = JSON.parse(selectionBytes.toString("utf8"));
  validateSelection(selection, policy);
  const trusted = new Set((trustedReviews.reviews || []).map(reviewKey));
  return {
    selection,
    selectionSha256: sha256Buffer(selectionBytes),
    policy,
    packages: selection.packages.map((entry) => ({
      ...entry,
      reviewTrusted: trusted.has(reviewKey({
        id: entry.id,
        sha256: entry.sha256,
        reviewedBy: entry.review.identity,
        reviewedAt: entry.review.date,
      })),
    })),
  };
}

export function validateSelection(selection, policy) {
  if (!selection || typeof selection !== "object" || Array.isArray(selection)) throw selectionError("selection-schema", "Selection must be an object.");
  const allowedTop = new Set(["schemaVersion", "catalog", "packages"]);
  for (const key of Object.keys(selection)) if (!allowedTop.has(key)) throw selectionError("selection-schema", `Unknown selection field: ${key}`);
  if (selection.schemaVersion !== 1) throw selectionError("selection-schema", "Unsupported selection schemaVersion.");
  if (selection.catalog !== undefined) {
    if (!selection.catalog || typeof selection.catalog !== "object" || Array.isArray(selection.catalog)) throw selectionError("selection-schema", "catalog must be an object.");
    const allowedCatalog = new Set(["id", "generatedAt"]);
    for (const key of Object.keys(selection.catalog)) if (!allowedCatalog.has(key)) throw selectionError("selection-schema", `Unknown catalog field: ${key}`);
    if (typeof selection.catalog.id !== "string" || !selection.catalog.id.trim() || selection.catalog.id.length > 100) throw selectionError("selection-schema", "catalog.id is required.");
    if (selection.catalog.generatedAt !== undefined && !Number.isFinite(Date.parse(selection.catalog.generatedAt))) throw selectionError("selection-schema", "catalog.generatedAt must be a date-time.");
  }
  if (!Array.isArray(selection.packages) || selection.packages.length > 100) throw selectionError("selection-schema", "packages must be an array with at most 100 entries.");
  const ids = new Set();
  const filenames = new Set();
  const allowedHosts = new Set(policy.allowedDownloadHosts || []);
  for (const entry of selection.packages) {
    const allowedPackage = new Set(["id", "url", "filename", "sha256", "review"]);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) throw selectionError("selection-schema", "Each package must be an object.");
    for (const key of Object.keys(entry)) if (!allowedPackage.has(key)) throw selectionError("selection-schema", `Unknown package field: ${key}`);
    if (!PACKAGE_ID.test(entry.id || "")) throw selectionError("selection-schema", `Invalid package id: ${entry.id || "<missing>"}`);
    if (!FILENAME.test(entry.filename || "") || path.basename(entry.filename) !== entry.filename) throw selectionError("selection-filename", `Invalid ZIP filename for ${entry.id}.`);
    if (!SHA256.test(entry.sha256 || "")) throw selectionError("selection-hash", `Invalid SHA-256 for ${entry.id}.`);
    validateUrl(entry.url, allowedHosts, entry.id);
    if (!entry.review || typeof entry.review !== "object" || Array.isArray(entry.review) || Object.keys(entry.review).some((key) => key !== "identity" && key !== "date")
      || typeof entry.review.identity !== "string" || !entry.review.identity.trim() || entry.review.identity.length > 120 || !isCalendarDate(entry.review.date)) {
      throw selectionError("selection-review", `Invalid review identity/date for ${entry.id}.`);
    }
    if (ids.has(entry.id)) throw selectionError("selection-duplicate-id", `Duplicate package id: ${entry.id}`);
    if (filenames.has(entry.filename.toLowerCase())) throw selectionError("selection-duplicate-filename", `Duplicate package filename: ${entry.filename}`);
    ids.add(entry.id);
    filenames.add(entry.filename.toLowerCase());
  }
}

export async function stageSelectionPackages(loaded, { cacheDirectory, stagingDirectory }) {
  await mkdir(cacheDirectory, { recursive: true });
  await rm(stagingDirectory, { recursive: true, force: true });
  await mkdir(stagingDirectory, { recursive: true });
  for (const entry of loaded.packages) {
    const cached = path.join(cacheDirectory, `${entry.sha256}.zip`);
    if (!await fileMatchesHash(cached, entry.sha256)) {
      await rm(cached, { force: true });
      await downloadPinned(entry.url, cached, entry.sha256, loaded.policy);
    }
    await copyFile(cached, path.join(stagingDirectory, entry.filename));
  }
}

export async function verifyMaterializedSelection(packages, directory) {
  for (const entry of packages) {
    if (!await fileMatchesHash(path.join(directory, entry.filename), entry.sha256)) {
      throw selectionError("materialized-hash", `Materialized ZIP hash mismatch for ${entry.id}.`);
    }
  }
}

export async function sha256File(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function downloadPinned(urlValue, destination, expectedSha256, policy) {
  const allowedHosts = new Set(policy.allowedDownloadHosts || []);
  let current = urlValue;
  for (let redirect = 0; redirect <= Number(policy.maxRedirects || 0); redirect += 1) {
    validateUrl(current, allowedHosts, "download");
    const response = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(Number(policy.downloadTimeoutMs || 60000)),
      headers: { "user-agent": "milXdy-local-addon-manager" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === Number(policy.maxRedirects || 0)) throw selectionError("download-redirect", `Unsafe or excessive redirect for ${urlValue}.`);
      current = new URL(location, current).toString();
      continue;
    }
    if (!response.ok) throw selectionError("download-http", `Download returned HTTP ${response.status}: ${current}`);
    const declaredLength = Number(response.headers.get("content-length") || 0);
    const maxBytes = Number(policy.maxArchiveBytes || 104857600);
    if (declaredLength > maxBytes) throw selectionError("download-size", `Archive exceeds ${maxBytes} bytes.`);
    const bytes = await readLimitedBody(response, maxBytes);
    const actual = sha256Buffer(bytes);
    if (actual !== expectedSha256) throw selectionError("download-hash", `Downloaded ZIP SHA-256 mismatch; expected ${expectedSha256}, got ${actual}.`);
    const temporary = `${destination}.partial`;
    await writeFile(temporary, bytes);
    await rename(temporary, destination);
    return;
  }
}

function validateUrl(value, allowedHosts, label) {
  let url;
  try { url = new URL(value); } catch { throw selectionError("selection-url", `Invalid HTTPS URL for ${label}.`); }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443") || !allowedHosts.has(url.hostname.toLowerCase())) {
    throw selectionError("selection-url", `URL for ${label} must use an allowed HTTPS catalog host.`);
  }
}

async function fileMatchesHash(filePath, expected) {
  if (!existsSync(filePath)) return false;
  const info = await stat(filePath);
  return info.isFile() && await sha256File(filePath) === expected;
}

async function readLimitedBody(response, maxBytes) {
  if (!response.body) return Buffer.alloc(0);
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw selectionError("download-size", `Archive exceeds ${maxBytes} bytes.`);
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks, total);
}

function isCalendarDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === value;
}

function reviewKey(entry) {
  return [entry.id, entry.sha256, entry.reviewedBy, entry.reviewedAt].join("\n");
}

function sha256Buffer(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function readJsonRequired(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

export function selectionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}
