import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import {
  BODY_COMPLETION_CATALOG,
  createStoredZip,
  makePetRequest,
  sha256Hex,
  stableJson,
  validatePetRequest,
} from "../../packages/maintainer/pets-maker/src/custom-pet-contract.js";

const python = process.env.PYTHON || "python";
const sourceRootArg = valueFor("--source-root") || process.env.REMILIA_PETS_ROOT;
const jsonOutArg = valueFor("--json-out");
const expectedArg = valueFor("--expected");
const hatchPetRoot = path.resolve(
  valueFor("--hatch-pet-root") ||
    process.env.HATCH_PET_SKILL_ROOT ||
    path.join(homedir(), ".codex", "skills", "hatch-pet"),
);
if (!sourceRootArg) {
  throw new Error("Pass --source-root=<read-only-remilia-pets-root> or set REMILIA_PETS_ROOT.");
}

const sourceRoot = path.resolve(sourceRootArg);
const atlas = withinSource("pets", "mildred", "spritesheet.webp");
const petManifest = withinSource("pets", "mildred", "pet.json");
const contactSheet = withinSource("previews", "mildred-contact-sheet.png");
const directionSheet = withinSource("previews", "mildred-look-directions.png");
const license = withinSource("LICENSE");
const semanticEvidencePath =
  "docs/evidence/custom-pet-mvp/milady-semantic-review.json";
const adapterRoot =
  "assets/user-downloads/remilia-pet/remilia-maker-pet-import";
const adapterScripts = path.join(adapterRoot, "scripts");
const temp = path.resolve("tmp", `remilia-pet-real-integration-${process.pid}`);
const run = path.join(temp, "run");
const qa = path.join(run, "qa");
const avatar = path.join(temp, "avatar.png");
const bundle = path.join(temp, "remilia-pet-request.zip");
const requestPath = path.join(temp, "request.json");
const cache = path.join(temp, "cache");

await rm(temp, { recursive: true, force: true });
await mkdir(temp, { recursive: true });
try {
  const licenseText = await readFile(license, "utf8");
  assert(
    /viral public license/iu.test(licenseText),
    "read-only source does not declare the expected VPL license",
  );
  const reviewed = JSON.parse(await readFile(semanticEvidencePath, "utf8"));
  await verifyReviewedSource(reviewed);

  const avatarPreparationPath = path.join(temp, "avatar-preparation.json");
  runPython([
    "scripts/verify/prepare-remilia-pet-integration.py",
    "--atlas",
    atlas,
    "--output",
    avatar,
    "--json-out",
    avatarPreparationPath,
  ]);
  const avatarPreparation = JSON.parse(await readFile(avatarPreparationPath, "utf8"));
  const avatarBytes = await readFile(avatar);
  const imageSha256 = await sha256Hex(avatarBytes);
  assert(
    avatarPreparation.avatarSha256 === imageSha256,
    "integration avatar preparation hash mismatch",
  );

  const request = makePetRequest({
    templateFamily: "milady",
    imageSha256,
    traits: {
      race: { assetId: "mildred-neochibi-v1", label: "Mildred neochibi" },
      hair: {
        assetId: "mildred-green-hair-blue-bow-v1",
        label: "Green hair with oversized blue bow",
      },
      eyes: { assetId: "mildred-rose-eyes-v1", label: "Rosy vampire eyes" },
      glasses: { assetId: "none", label: "None" },
      shirt: {
        assetId: "mildred-vampire-costume-v1",
        label: "Dark cape costume with red and gold trim",
      },
      earrings: { assetId: "none", label: "None" },
    },
    bodyCompletion: {
      legCoverage: "covered",
      legColorVariant: "warm-light",
      bottom: {
        ...BODY_COMPLETION_CATALOG.bottoms.find(
          (item) => item.assetId === "maker-bottom-dress-pants-v1",
        ),
        colorVariant: "black",
      },
      footwear: {
        ...BODY_COMPLETION_CATALOG.footwear.find(
          (item) => item.assetId === "maker-footwear-boots-v1",
        ),
        colorVariant: "brown",
      },
    },
    petName: "Mildred",
    personality:
      "A calm, mischievous green-haired neochibi vampire with a large blue bow.",
  });
  delete request.bodyCompletion.bottom.label;
  delete request.bodyCompletion.bottom.compatibleLegCoverage;
  delete request.bodyCompletion.footwear.label;
  const contractValidation = await validatePetRequest(request, avatarBytes);
  assert(
    contractValidation.ok,
    `real integration request is invalid: ${contractValidation.errors.join("; ")}`,
  );
  const requestBytes = new TextEncoder().encode(stableJson(request));
  const bundleBytes = createStoredZip([
    { name: "avatar.png", bytes: avatarBytes },
    { name: "request.json", bytes: requestBytes },
  ]);
  await writeFile(requestPath, requestBytes);
  await writeFile(bundle, bundleBytes);

  const bundleValidationPath = path.join(temp, "bundle-validation.json");
  runPython([
    path.join(adapterScripts, "validate_bundle.py"),
    bundle,
    "--json-out",
    bundleValidationPath,
  ]);
  runPython([
    path.join(adapterScripts, "prepare_import.py"),
    bundle,
    "--output-dir",
    run,
  ]);
  const bundleValidation = JSON.parse(await readFile(bundleValidationPath, "utf8"));
  const provenance = JSON.parse(await readFile(path.join(run, "provenance.json"), "utf8"));
  const selected = JSON.parse(await readFile(path.join(run, "selected-template.json"), "utf8"));

  const hatchValidationPath = path.join(run, "hatch-pet-validation.json");
  runPython([
    path.join(hatchPetRoot, "scripts", "validate_atlas.py"),
    atlas,
    "--require-v2",
    "--json-out",
    hatchValidationPath,
  ]);
  const hatchValidation = JSON.parse(await readFile(hatchValidationPath, "utf8"));
  assert(hatchValidation.ok && hatchValidation.sprite_version_number === 2, "hatch-pet rejected the real atlas");

  runPython([
    path.join(adapterScripts, "compare_pose_envelope.py"),
    "--atlas",
    atlas,
    "--selected-template",
    path.join(run, "selected-template.json"),
    "--identity-brief",
    path.join(run, "identity-brief.json"),
    "--output-dir",
    qa,
  ]);
  const deterministicPath = path.join(qa, "deterministic-qa.json");
  const deterministicBytes = await readFile(deterministicPath);
  const deterministic = JSON.parse(deterministicBytes);
  assert(
    deterministic.status === "passed" &&
      deterministic.counts.failures === 0 &&
      deterministic.counts.runtimeFrames === 73 &&
      deterministic.counts.reservedFrames === 1,
    "Maker-template deterministic QA did not pass the real atlas",
  );

  const runSemanticReview = {
    ...reviewed,
    deterministicQaSha256: digest(deterministicBytes),
  };
  await writeFile(
    path.join(qa, "semantic-review.json"),
    `${JSON.stringify(runSemanticReview, null, 2)}\n`,
  );
  runPython([
    path.join(adapterScripts, "cache_resume.py"),
    "store",
    "--run-dir",
    run,
    "--atlas",
    atlas,
    "--cache-dir",
    cache,
  ]);
  const exactPlanPath = path.join(temp, "exact-resume-plan.json");
  runPython([
    path.join(adapterScripts, "cache_resume.py"),
    "plan",
    "--run-dir",
    run,
    "--cache-dir",
    cache,
    "--json-out",
    exactPlanPath,
  ]);
  const exactPlan = JSON.parse(await readFile(exactPlanPath, "utf8"));
  assert(exactPlan.action === "reuse-validated-atlas", "real exact rerun did not reuse its atlas");
  const cacheEntry = JSON.parse(
    await readFile(
      path.join(cache, provenance.inputFingerprint, "cache-entry.json"),
      "utf8",
    ),
  );
  assert(
    cacheEntry.privacy.rawBundleCached === false &&
      cacheEntry.privacy.requestSidecarCached === false &&
      cacheEntry.privacy.canonicalInputImageCached === false,
    "real cache entry retained private bundle inputs",
  );

  const summary = {
    schemaVersion: 1,
    issue: 190,
    status: "passed",
    source: {
      repository: "maintainer-local read-only remilia-pets snapshot",
      license: "Viral Public License",
      licenseSha256: await fileHash(license),
      petManifest: "pets/mildred/pet.json",
      petManifestSha256: await fileHash(petManifest),
      atlas: "pets/mildred/spritesheet.webp",
      atlasSha256: await fileHash(atlas),
      contactSheet: "previews/mildred-contact-sheet.png",
      contactSheetSha256: await fileHash(contactSheet),
      directionSheet: "previews/mildred-look-directions.png",
      directionSheetSha256: await fileHash(directionSheet),
      sourceMutated: false,
    },
    exportBundle: {
      fileCount: 2,
      schemaVersion: request.schemaVersion,
      templateFamily: request.templateFamily,
      bodyCompletionCatalogVersion: request.bodyCompletion.catalogVersion,
      bundleSha256: digest(bundleBytes),
      requestSha256: digest(requestBytes),
      avatarSha256: imageSha256,
      avatarPreparation: avatarPreparation.method,
    },
    adapter: {
      templateId: selected.templateId,
      templateSha256: selected.provenance.combinedTemplateSha256,
      inputFingerprint: provenance.inputFingerprint,
      delegateSkill: "hatch-pet",
    },
    hatchPet: {
      ok: hatchValidation.ok,
      spriteVersionNumber: hatchValidation.sprite_version_number,
      dimensions: [hatchValidation.width, hatchValidation.height],
      transparentRgbResiduePixels: hatchValidation.transparent_rgb_residue_pixels,
    },
    deterministicQa: {
      status: deterministic.status,
      failures: deterministic.counts.failures,
      measuredFrames: deterministic.counts.measuredFrames,
      runtimeFrames: deterministic.counts.runtimeFrames,
      reservedFrames: deterministic.counts.reservedFrames,
      sequenceChecks: deterministic.counts.sequenceChecks,
      activeExpansionZones: deterministic.template.activeExpansionZones,
      annotatedAtlasProduced: Boolean(deterministic.diagnostics.annotatedAtlas),
    },
    semanticReview: {
      status: reviewed.status,
      evidenceSha256: await fileHash(semanticEvidencePath),
      checks: Object.fromEntries(
        Object.entries(reviewed.checks).map(([key, value]) => [key, value.status]),
      ),
      separateFromDeterministicQa: true,
    },
    cacheResume: {
      exactRerunAction: exactPlan.action,
      rawBundleCached: cacheEntry.privacy.rawBundleCached,
      requestSidecarCached: cacheEntry.privacy.requestSidecarCached,
      canonicalInputImageCached: cacheEntry.privacy.canonicalInputImageCached,
      finalValidatedAtlasCached: cacheEntry.privacy.finalValidatedAtlasCached,
    },
    safety: {
      userImageUsed: false,
      uploaded: false,
      published: false,
      installed: false,
      autoPosted: false,
      rightsInferred: false,
    },
  };
  assert(
    bundleValidation.bundleSha256 === summary.exportBundle.bundleSha256,
    "bundle validator and integration summary disagree",
  );
  const encoded = `${JSON.stringify(summary, null, 2)}\n`;
  if (expectedArg) {
    const expected = JSON.parse(await readFile(path.resolve(expectedArg), "utf8"));
    assert(
      JSON.stringify(expected) === JSON.stringify(summary),
      `integrated evidence differs from ${expectedArg}`,
    );
  }
  if (jsonOutArg) {
    const jsonOut = path.resolve(jsonOutArg);
    await mkdir(path.dirname(jsonOut), { recursive: true });
    await writeFile(jsonOut, encoded);
  }
  process.stdout.write(encoded);
} finally {
  await rm(temp, { recursive: true, force: true });
}

function withinSource(...segments) {
  const candidate = path.resolve(sourceRoot, ...segments);
  if (!candidate.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error(`source path escaped the read-only root: ${candidate}`);
  }
  return candidate;
}

async function verifyReviewedSource(reviewed) {
  assert(reviewed.status === "approved", "semantic evidence is not approved");
  for (const check of Object.values(reviewed.checks || {})) {
    assert(check.status === "passed", "semantic evidence contains an unpassed check");
  }
  const expected = reviewed.source;
  assert(expected.licenseSha256 === (await fileHash(license)), "reviewed license hash changed");
  assert(expected.petManifestSha256 === (await fileHash(petManifest)), "reviewed pet manifest changed");
  assert(expected.atlasSha256 === (await fileHash(atlas)), "reviewed atlas changed");
  assert(expected.contactSheetSha256 === (await fileHash(contactSheet)), "reviewed contact sheet changed");
  assert(expected.directionSheetSha256 === (await fileHash(directionSheet)), "reviewed direction sheet changed");
}

function runPython(args) {
  const result = spawnSync(python, args, {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `${python} ${args.join(" ")} exited with ${result.status}\n${result.stdout}\n${result.stderr}`,
    );
  }
}

function valueFor(name) {
  const prefix = `${name}=`;
  return process.argv.find((argument) => argument.startsWith(prefix))?.slice(prefix.length);
}

async function fileHash(file) {
  return digest(await readFile(file));
}

function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
