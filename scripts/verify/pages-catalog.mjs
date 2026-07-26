import { readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const read = (file) => readFile(path.join(root, file), "utf8");
const failures = [];
const notes = [];

const requiredFiles = [
  "pages/index.html",
  "pages/assets/catalog.js",
  "pages/assets/onboarding.css",
  "catalog/index.html",
  "catalog/add-ons/index.html",
  "catalog/assets/catalog.js",
  "catalog/assets/selection.js",
  "catalog/assets/styles.css",
  "catalog/data/catalog.json",
  "catalog/data/catalog.schema.json",
  "scripts/addons/catalog-policy.json",
  "scripts/addons/trusted-catalog-reviews.json",
  "scripts/build/build-pages-catalog.mjs",
  "docs/ADD_ONS_CATALOG.md",
  ".github/workflows/pages-catalog.yml",
];

const contents = new Map();
for (const file of requiredFiles) {
  try {
    contents.set(file, await read(file));
  } catch {
    failures.push(`missing required catalog file: ${file}`);
  }
}

let catalog;
let catalogPolicy;
let trustedReviews;
try {
  catalog = JSON.parse(contents.get("catalog/data/catalog.json") || "");
} catch (error) {
  failures.push(`catalog/data/catalog.json is invalid JSON: ${error.message}`);
}
try {
  catalogPolicy = JSON.parse(contents.get("scripts/addons/catalog-policy.json") || "");
  trustedReviews = JSON.parse(contents.get("scripts/addons/trusted-catalog-reviews.json") || "");
} catch (error) {
  failures.push(`catalog trust policy JSON is invalid: ${error.message}`);
}

if (catalog) {
  if (catalog.schemaVersion !== 1) failures.push("catalog schemaVersion must be 1");
  if (!["preview", "live"].includes(catalog.catalogStatus)) failures.push("catalogStatus must be preview or live");
  if (!Array.isArray(catalog.sections)) failures.push("catalog sections must be an array");

  const sections = new Map((catalog.sections || []).map((section) => [section.id, section]));
  const requiredSections = new Map([
    ["official", "Official milXdy add-ons"],
    ["approved-external", "Approved external add-ons"],
  ]);
  for (const [id, name] of requiredSections) {
    if (!sections.has(id)) failures.push(`catalog must include the ${id} section`);
    if (sections.get(id)?.name !== name) failures.push(`catalog section ${id} must be named ${name}`);
  }
  for (const id of sections.keys()) {
    if (!["official", "approved-external"].includes(id)) failures.push(`unsupported catalog section: ${id}`);
  }

  const ids = new Set();
  const allowedDownloadHosts = new Set(catalogPolicy?.allowedDownloadHosts || []);
  const trustedReviewKeys = new Set((trustedReviews?.reviews || []).map((entry) => [entry.id, entry.sha256, entry.reviewedBy, entry.reviewedAt].join("\n")));
  let publishedCount = 0;
  for (const section of catalog.sections || []) {
    if (!section.name || !section.description || !Array.isArray(section.packages)) {
      failures.push(`section ${section.id || "<unknown>"} requires name, description, and packages`);
      continue;
    }
    for (const pkg of section.packages) {
      if (!/^[a-z0-9]+(?:[.-][a-z0-9]+)*$/.test(pkg.id || "")) failures.push(`invalid package id: ${pkg.id || "<missing>"}`);
      if (ids.has(pkg.id)) failures.push(`duplicate package id: ${pkg.id}`);
      ids.add(pkg.id);
      if (!pkg.name || !pkg.summary || !pkg.publisher) failures.push(`${pkg.id}: name, summary, and publisher are required`);
      if (!["planned", "under-review", "published"].includes(pkg.availability)) failures.push(`${pkg.id}: invalid availability`);
      if (!pkg.review || !["not-started", "in-progress", "approved"].includes(pkg.review.status)) failures.push(`${pkg.id}: invalid review status`);
      if (pkg.review?.status === "approved" && (!pkg.review.reviewedBy || !/^\d{4}-\d{2}-\d{2}$/.test(pkg.review.reviewedAt || ""))) {
        failures.push(`${pkg.id}: approved review records require reviewedBy and an ISO review date`);
      }
      if (section.id === "approved-external" && pkg.review?.status !== "approved") {
        failures.push(`${pkg.id}: approved-external records must have approved review status`);
      }
      for (const field of ["capabilities", "privacy", "permissions"]) {
        if (!Array.isArray(pkg[field])) failures.push(`${pkg.id}: ${field} must be an array`);
      }

      if (pkg.availability === "published") {
        publishedCount += 1;
        if (pkg.review?.status !== "approved") failures.push(`${pkg.id}: published packages must have approved review status`);
        try {
          if (new URL(pkg.sourceUrl).protocol !== "https:") failures.push(`${pkg.id}: published packages require an HTTPS source URL`);
        } catch {
          failures.push(`${pkg.id}: published packages require a valid HTTPS source URL`);
        }
        if (!pkg.download) {
          failures.push(`${pkg.id}: published packages require verified download metadata`);
        } else {
          try {
            const downloadUrl = new URL(pkg.download.url);
            if (downloadUrl.protocol !== "https:") failures.push(`${pkg.id}: download URL must use HTTPS`);
            if (!allowedDownloadHosts.has(downloadUrl.hostname.toLowerCase())) failures.push(`${pkg.id}: download URL host is not allowed by the local catalog policy`);
          } catch {
            failures.push(`${pkg.id}: download URL is invalid`);
          }
          if (!/^[A-Za-z0-9._-]+\.zip$/.test(pkg.download.filename || "")) failures.push(`${pkg.id}: download filename must be a simple .zip filename`);
          if (!/^[a-f0-9]{64}$/.test(pkg.download.sha256 || "")) failures.push(`${pkg.id}: download sha256 must be 64 lowercase hex characters`);
          const reviewKey = [pkg.id, pkg.download.sha256, pkg.review.reviewedBy, pkg.review.reviewedAt].join("\n");
          if (!trustedReviewKeys.has(reviewKey)) failures.push(`${pkg.id}: published package review is not pinned in trusted-catalog-reviews.json`);
        }
      } else if (pkg.download !== null) {
        failures.push(`${pkg.id}: unpublished packages must use download: null`);
      }
    }
  }
  notes.push(`catalog metadata: ${ids.size} package record(s), ${publishedCount} published`);
}

const index = contents.get("catalog/index.html") || "";
for (const phrase of [
  "No runtime ZIP install.",
  "Download selection file",
  "local-app-packages/",
  "dist/chromium-local-apps/",
]) {
  if (!index.includes(phrase)) failures.push(`catalog index is missing required disclosure or workflow text: ${phrase}`);
}

const onboarding = contents.get("pages/index.html") || "";
for (const phrase of [
  "milXdy · Setup and guides",
  "Install in four steps",
  "Lite, Balanced, and Full",
  "Add-ons Catalog",
  'href="addons/"',
  "No add-ons are published yet.",
]) {
  if (!onboarding.includes(phrase)) failures.push(`Pages onboarding is missing required content: ${phrase}`);
}
if ((onboarding.match(/__PAGES_ASSET_VERSION__/g) || []).length < 2) {
  failures.push("Pages onboarding assets must use the generated deployment cache key");
}

const legacyRootCatalog = contents.get("pages/assets/catalog.js") || "";
if (!legacyRootCatalog.includes('searchParams.set("view", "onboarding")') || !legacyRootCatalog.includes("location.replace")) {
  failures.push("Pages must redirect the catalog's former root script to a cache-busted onboarding URL");
}

for (const file of ["catalog/index.html", "catalog/add-ons/index.html"]) {
  if ((contents.get(file)?.match(/__PAGES_ASSET_VERSION__/g) || []).length < 2) {
    failures.push(`${file} assets must use the generated deployment cache key`);
  }
}

const onboardingStyles = contents.get("pages/assets/onboarding.css") || "";
for (const phrase of ["onboarding-tabs", "onboarding-hero", "setup-options", "feature-list", "addons-strip"]) {
  if (!onboardingStyles.includes(phrase)) failures.push(`Pages onboarding styles are missing: ${phrase}`);
}
for (const phrase of ["milxdy-logo-square-bevel.png", "workflow-steps", "catalog-window", "tabs", ">Steps</p>"]) {
  if (!index.includes(phrase)) failures.push(`catalog index is missing established milXdy UI reference: ${phrase}`);
}

const styles = contents.get("catalog/assets/styles.css") || "";
for (const phrase of ["--milxdy-surface", "--milxdy-surface-2", "--milxdy-rn-blue", "--milxdy-green-soft", "--milxdy-page-bg", "border-radius: 6px", "prefers-color-scheme: dark"]) {
  if (!styles.includes(phrase)) failures.push(`catalog styles are missing established X-facing token or geometry: ${phrase}`);
}

const detail = contents.get("catalog/add-ons/index.html") || "";
if (!detail.includes("addon-detail")) failures.push("detail page mount is missing");

const script = contents.get("catalog/assets/catalog.js") || "";
for (const phrase of ["catalog.json", "add-ons/?id=", "isPublishedDownload", "selectionJson", ".milxdy-selection.json"]) {
  if (!script.includes(phrase)) failures.push(`catalog renderer is missing required behavior: ${phrase}`);
}
const { selectionFor } = await import(new URL("../../catalog/assets/selection.js", import.meta.url));
const selectionFixture = selectionFor([
  { id: "z-package", download: { url: "https://github.com/z.zip", filename: "z.zip", sha256: "z".repeat(64) }, review: { reviewedBy: "Z", reviewedAt: "2026-07-26" } },
  { id: "a-package", download: { url: "https://github.com/a.zip", filename: "a.zip", sha256: "a".repeat(64) }, review: { reviewedBy: "A", reviewedAt: "2026-07-25" } },
]);
if (selectionFixture.schemaVersion !== 1 || selectionFixture.catalog.id !== "milxdy-github-catalog") failures.push("catalog selection serializer is missing stable schema/catalog identity");
if (selectionFixture.packages.map((entry) => entry.id).join(",") !== "a-package,z-package") failures.push("catalog selection serializer must sort package IDs deterministically");
if (selectionFixture.packages[0].review.identity !== "A" || selectionFixture.packages[0].review.date !== "2026-07-25") failures.push("catalog selection serializer must preserve review identity/date");
if (script.includes("window.setTimeout") || script.includes("Starting ${downloads.length} browser download")) {
  failures.push("catalog renderer must emit one selection file instead of orchestrating browser multi-downloads");
}

const workflow = contents.get(".github/workflows/pages-catalog.yml") || "";
if (!/^on:\s*\n\s+workflow_dispatch:/m.test(workflow)) failures.push("Pages workflow must be manual-only with workflow_dispatch");
for (const forbidden of ["push:", "pull_request:", "schedule:", "release:"]) {
  if (workflow.includes(forbidden)) failures.push(`Pages workflow must not include automatic trigger: ${forbidden}`);
}
if (!workflow.includes("build-pages-catalog.mjs") || !workflow.includes("tmp/pages-catalog-site")) {
  failures.push("Pages workflow must build and upload the staged onboarding site and catalog with checked-in brand assets");
}

const buildScript = contents.get("scripts/build/build-pages-catalog.mjs") || "";
for (const phrase of ["PAGES_ASSET_VERSION", "GITHUB_SHA", 'path.join(outputDir, "data")', 'path.join(outputDir, "assets", "styles.css")']) {
  if (!buildScript.includes(phrase)) failures.push(`Pages build is missing cache-safe migration handling: ${phrase}`);
}

const docs = contents.get("docs/ADD_ONS_CATALOG.md") || "";
if (!docs.includes("intentionally manual-only")) failures.push("catalog docs must explain the manual-only deployment gate");

if (failures.length) {
  console.error("Pages catalog verification failed:");
  failures.forEach((failure) => console.error(`  - ${failure}`));
  process.exit(1);
}

console.log("Pages catalog verification passed.");
notes.forEach((note) => console.log(`  ${note}`));
console.log("  onboarding root and /addons catalog sources: present");
console.log("  official and approved-external sections: present");
console.log("  download, security, local-build, and manual-deployment gates: present");
