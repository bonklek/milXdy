import { access, readFile } from "node:fs/promises";
import path from "node:path";
import {
  invariant,
  isDirectExecution,
  listFiles,
  mainRepositoryRoot,
} from "./lib.mjs";

const forbiddenBuildMarkers = [
  "publication-candidates",
  "milxdy-visual-elements",
  "asset.schema.json",
  "milxdy.tokens.json",
  "ASSET_AND_CONTRIBUTION_POLICY.md",
  "visual-assets.lock.json",
];

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function checkReleaseExclusion() {
  const buildScriptPath = path.join(mainRepositoryRoot, "scripts", "build", "build-extension.mjs");
  const packageScriptPath = path.join(mainRepositoryRoot, "scripts", "release", "package-release.mjs");
  const releaseBuildsPath = path.join(mainRepositoryRoot, "scripts", "release", "release-builds.mjs");
  const scripts = [
    await readFile(buildScriptPath, "utf8"),
    await readFile(packageScriptPath, "utf8"),
    await readFile(releaseBuildsPath, "utf8"),
  ];
  const errors = [];

  for (const [index, script] of scripts.entries()) {
    if (/publication-candidates|milxdy-visual-elements/.test(script)) {
      errors.push(`release/build script ${index + 1} references the publication candidate`);
    }
  }
  if (!scripts[1].includes("createZip(build.dir")) {
    errors.push("release packager no longer archives the declared build directory");
  }

  const distRoot = path.join(mainRepositoryRoot, "dist");
  let inspectedBuildFiles = 0;
  if (await exists(distRoot)) {
    const files = await listFiles(distRoot);
    inspectedBuildFiles = files.length;
    for (const file of files) {
      const relative = path.relative(distRoot, file).replaceAll("\\", "/");
      if (forbiddenBuildMarkers.some((marker) => relative.includes(marker))) {
        errors.push(`dist/${relative}: visual source library leaked into extension build`);
      }
    }
  }

  invariant(errors.length === 0, `Release exclusion check failed:\n${errors.join("\n")}`);
  return {
    scripts: scripts.length,
    inspectedBuildFiles,
    artifactState: inspectedBuildFiles > 0 ? "built output inspected" : "static allowlist proof only",
  };
}

if (isDirectExecution(import.meta.url)) {
  const summary = await checkReleaseExclusion();
  console.log(
    `Checked ${summary.scripts} release/build scripts; ${summary.artifactState}` +
    (summary.inspectedBuildFiles ? ` (${summary.inspectedBuildFiles} files).` : "."),
  );
}
