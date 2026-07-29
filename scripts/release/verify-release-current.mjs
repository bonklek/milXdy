import { readFile } from "node:fs/promises";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
const manifest = JSON.parse(await readFile("assets/extension/manifest.json", "utf8"));
const extensionVersion = String(packageJson.extensionVersion || packageJson.version || "").trim();
const releases = await readFile("docs/releases/RELEASES.md", "utf8");
const changelog = await readFile("CHANGELOG.md", "utf8");
const contributing = await readFile("CONTRIBUTING.md", "utf8");
const releaseGate = await readFile("scripts/release/verify-release-gates.mjs", "utf8");
const packageRelease = await readFile("scripts/release/package-release.mjs", "utf8");
const releaseChecksums = await readFile("scripts/release/verify-release-checksums.mjs", "utf8");
const releaseReproducible = await readFile("scripts/release/verify-reproducible-release.mjs", "utf8");
const releaseLock = await readFile("scripts/release/release-artifact-lock.mjs", "utf8");
const roadmap = await readFile("docs/roadmap/ROADMAP.md", "utf8");
const releaseNotes = await readFile(`docs/releases/RELEASE_NOTES_${packageJson.version}.md`, "utf8");

assertSemver(packageJson.version, "package.json version");
assertSemver(packageJson.appSdkVersion, "package.json appSdkVersion");
assertExtensionVersion(extensionVersion, "package.json extensionVersion");
assert(manifest.version === extensionVersion, "extension manifest template version must match package.json extensionVersion");
assert(packageJson.version === packageJson.appSdkVersion, "SDK-bearing release package version must match package.json appSdkVersion");
assert(typeof packageJson.scripts?.["verify:release"] === "string", "package scripts must include verify:release");
assert(typeof packageJson.scripts?.["verify:release:gates"] === "string", "package scripts must include verify:release:gates");
assert(typeof packageJson.scripts?.["verify:app-smoke"] === "string", "package scripts must include verify:app-smoke");
assert(typeof packageJson.scripts?.["verify:post-reading:distribution"] === "string", "package scripts must include verify:post-reading:distribution");
assert(typeof packageJson.scripts?.["verify:post-reading:standalone"] === "string", "package scripts must include verify:post-reading:standalone");
assert(typeof packageJson.scripts?.["verify:remistats-tooltip-escaping"] === "string", "package scripts must include verify:remistats-tooltip-escaping");
assert(packageJson.scripts["verify:release"] === "node scripts/release/verify-release-current.mjs", "verify:release must run the current release contract verifier");
assert(packageJson.scripts["verify:release:gates"] === "node scripts/release/verify-release-gates.mjs", "verify:release:gates must run the current release gate");
assert(packageJson.scripts["verify:app-smoke"] === "node scripts/smoke/app-smoke.mjs", "verify:app-smoke must run the current app smoke verifier");
assert(packageJson.scripts["verify:post-reading:distribution"] === "node scripts/verify/post-reading-distribution.mjs", "verify:post-reading:distribution must run the Post-reading distribution verifier");
assert(packageJson.scripts["verify:post-reading:standalone"] === packageJson.scripts["verify:post-reading:distribution"], "verify:post-reading:standalone must remain a compatibility alias for verify:post-reading:distribution");
assert(packageJson.scripts["verify:remistats-tooltip-escaping"] === "node scripts/verify/remistats-tooltip-escaping.mjs", "verify:remistats-tooltip-escaping must run the RemiStats tooltip escaping verifier");
assert(releaseGate.includes("scripts/release/verify-release-current.mjs"), "current release gate must run current release contracts");
assert(releaseGate.includes("scripts/build/build-profiles.mjs"), "current release gate must rebuild profile outputs");
assert(releaseGate.includes("scripts/verify/filesystem-layout.mjs"), "current release gate must verify filesystem layout");
assert(releaseGate.includes("scripts/build/build-post-reading-distribution.mjs"), "current release gate must rebuild Post-reading distribution output");
assert(releaseGate.includes("scripts/verify/post-reading-distribution.mjs"), "current release gate must verify Post-reading distribution contracts");
assert(releaseGate.includes("scripts/verify/remistats-tooltip-escaping.mjs"), "current release gate must verify RemiStats tooltip escaping");
assert(releaseGate.includes("scripts/smoke/app-smoke.mjs"), "current release gate must run current app smoke");
assert(!releaseGate.includes("[\"App smoke\", [\"scripts/smoke/app-smoke-020.mjs\"]]"), "current release gate must not use the historical app smoke script as its App smoke gate");
assert(releaseGate.includes("scripts/release/package-release.mjs"), "current release gate must package release archives");
assert(releaseGate.includes("scripts/release/verify-reproducible-release.mjs"), "current release gate must verify reproducible release archives");
assert(releaseGate.includes("scripts/verify/firefox-lint.mjs"), "current release gate must run Firefox lint through the warning classifier");
assert(releaseGate.includes("withReleaseArtifactLock"), "current release gate must hold the release artifact lock across package/checksum/repro subprocesses");
assert(packageRelease.includes("withReleaseArtifactLock") && packageRelease.includes("publishFileAtomically") && packageRelease.includes("writeFileAtomically"), "release packaging must lock and atomically publish archives/checksum manifests");
assert(!packageRelease.includes("await rm(archive") && !packageRelease.includes("await rm(checksumFile"), "release packaging must not remove published release archive or checksum paths before replacing them");
assert(packageRelease.includes('startsWith("user-downloads/")'), "release packaging must reject user-download web-accessible resource prefixes");
assert(releaseChecksums.includes("withReleaseArtifactLock"), "release checksum verification must take the release artifact lock while reading shared artifacts");
assert(releaseReproducible.includes("withReleaseArtifactLock"), "release reproducibility verification must take the release artifact lock while reading shared artifacts");
assert(releaseLock.includes("tmp") && releaseLock.includes("release-artifacts.lock") && releaseLock.includes("process.kill(pid, 0)"), "release artifact lock must be checkout-local and detect stale owner processes");
assert(releases.includes("npm run verify:release:gates"), "release docs must use the current version-neutral release gate");
assert(releases.includes("npm.cmd run verify:release:gates"), "release docs must include the Windows current release gate command");
assert(!releases.includes("`verify:release:gates:020` is the canonical release readiness gate"), "release docs must not call the historical 0.2.0 gate canonical");
assert(contributing.includes("npm run verify:release:gates"), "contributing docs must point release prep at the current release gate");
assert(
  ["Planned", "Upcoming", "Released"].some((status) => roadmap.includes(`${status}: ${packageJson.version}`)),
  "roadmap must include the package version as planned, upcoming, or released",
);
assert(releaseNotes.includes(`# milXdy ${packageJson.version}`), "current release notes heading must match package version");
assert(changelog.includes(`## ${packageJson.version}`), "changelog must include the package version heading");

console.log(`Current release contract verification passed for extension ${extensionVersion} (package ${packageJson.version}, App SDK ${packageJson.appSdkVersion}).`);

function assertSemver(value, label) {
  assert(typeof value === "string" && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(value), `${label} must be semver-like`);
}

function assertExtensionVersion(value, label) {
  assert(typeof value === "string" && /^\d+(?:\.\d+){0,3}$/.test(value), `${label} must be a browser extension version`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
