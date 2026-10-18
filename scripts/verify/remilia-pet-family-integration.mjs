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
const petsRoot = path.resolve(valueFor("--pets-root") || path.join(homedir(), ".codex", "pets"));
const expectedArg = valueFor("--expected");
const jsonOutArg = valueFor("--json-out");
const hatchPetRoot = path.resolve(
  valueFor("--hatch-pet-root") ||
    process.env.HATCH_PET_SKILL_ROOT ||
    path.join(homedir(), ".codex", "skills", "hatch-pet"),
);
const adapterRoot = "assets/user-downloads/remilia-pet/remilia-maker-pet-import";
const adapterScripts = path.join(adapterRoot, "scripts");
const reviewPath = "docs/evidence/custom-pet-mvp/maker-family-semantic-reviews.json";
const temp = path.resolve("tmp", `remilia-pet-family-integration-${process.pid}`);
const samples = [
  {
    family: "remilio",
    pet: "moxie",
    traits: {
      race: { assetId: "sample-devil-neochibi-v1", label: "Coral devil neochibi" },
      hair: { assetId: "sample-black-bob-v1", label: "Black bob with straight bangs" },
      eyes: { assetId: "sample-reflective-eyes-v1", label: "Large reflective eyes" },
      glasses: { assetId: "none", label: "None" },
      shirt: { assetId: "sample-green-hoodie-v1", label: "Plain green hoodie" },
      earrings: { assetId: "none", label: "None" },
    },
    legCoverage: "exposed",
    bottom: "maker-bottom-shorts-v1",
    bottomColor: "black",
    footwear: "maker-footwear-sneakers-v1",
    footwearColor: "black",
  },
  {
    family: "bonkler",
    pet: "wiggum",
    traits: {
      race: { assetId: "sample-neochibi-v1", label: "Warm neochibi" },
      hair: { assetId: "sample-blond-bob-v1", label: "Blond bob" },
      eyes: { assetId: "sample-fanged-face-v1", label: "Tiny fangs" },
      glasses: { assetId: "sample-angular-glasses-v1", label: "Angular black glasses" },
      shirt: { assetId: "sample-grey-graphic-tee-v1", label: "Grey graphic tee" },
      earrings: { assetId: "sample-silver-charm-v1", label: "Dangling silver charm" },
    },
    legCoverage: "exposed",
    bottom: "maker-bottom-shorts-v1",
    bottomColor: "black",
    footwear: "maker-footwear-sneakers-v1",
    footwearColor: "white",
  },
  {
    family: "kagami",
    pet: "yumi",
    traits: {
      race: { assetId: "sample-wintry-neochibi-v1", label: "Wintry neochibi" },
      hair: { assetId: "sample-dusty-blue-bob-v1", label: "Dusty blue bob" },
      eyes: { assetId: "sample-composed-eyes-v1", label: "Composed eyes" },
      glasses: { assetId: "none", label: "None" },
      shirt: { assetId: "sample-grey-jacket-v1", label: "Plain grey jacket with red shoulders" },
      earrings: { assetId: "sample-pink-bow-earpieces-v1", label: "Pink bow earpieces" },
    },
    legCoverage: "covered",
    bottom: "maker-bottom-dress-pants-v1",
    bottomColor: "black",
    footwear: "maker-footwear-boots-v1",
    footwearColor: "black",
  },
];

await rm(temp, { recursive: true, force: true });
await mkdir(temp, { recursive: true });
try {
  const reviews = JSON.parse(await readFile(reviewPath, "utf8"));
  const results = [];
  for (const sample of samples) {
    const reviewed = reviews.families[sample.family];
    assert(reviewed?.status === "approved", `${sample.family}: semantic review is not approved`);
    const sourceDir = withinPetsRoot(sample.pet);
    const atlas = path.join(sourceDir, "spritesheet.webp");
    const petManifest = path.join(sourceDir, "pet.json");
    const pet = JSON.parse((await readFile(petManifest, "utf8")).replace(/^\uFEFF/u, ""));
    assert(pet.spriteVersionNumber === 2, `${sample.pet}: source pet is not v2`);
    const runRoot = path.join(temp, sample.family);
    const avatar = path.join(runRoot, "avatar.png");
    const preparationPath = path.join(runRoot, "avatar-preparation.json");
    runPython([
      "scripts/verify/prepare-remilia-pet-integration.py",
      "--atlas", atlas,
      "--output", avatar,
      "--json-out", preparationPath,
    ]);
    const avatarBytes = await readFile(avatar);
    const imageSha256 = await sha256Hex(avatarBytes);
    const request = makePetRequest({
      templateFamily: sample.family,
      imageSha256,
      traits: sample.traits,
      bodyCompletion: {
        legCoverage: sample.legCoverage,
        legColorVariant: "warm-light",
        bottom: {
          ...BODY_COMPLETION_CATALOG.bottoms.find((item) => item.assetId === sample.bottom),
          colorVariant: sample.bottomColor,
        },
        footwear: {
          ...BODY_COMPLETION_CATALOG.footwear.find((item) => item.assetId === sample.footwear),
          colorVariant: sample.footwearColor,
        },
      },
      petName: pet.displayName,
      personality: pet.description,
    });
    delete request.bodyCompletion.bottom.label;
    delete request.bodyCompletion.bottom.compatibleLegCoverage;
    delete request.bodyCompletion.footwear.label;
    const requestValidation = await validatePetRequest(request, avatarBytes);
    assert(requestValidation.ok, `${sample.family}: ${requestValidation.errors.join("; ")}`);
    const requestBytes = new TextEncoder().encode(stableJson(request));
    const bundleBytes = createStoredZip([
      { name: "avatar.png", bytes: avatarBytes },
      { name: "request.json", bytes: requestBytes },
    ]);
    const bundle = path.join(runRoot, "remilia-pet-request.zip");
    await writeFile(bundle, bundleBytes);
    const prepared = path.join(runRoot, "prepared");
    runPython([path.join(adapterScripts, "prepare_import.py"), bundle, "--output-dir", prepared]);
    const selected = JSON.parse(await readFile(path.join(prepared, "selected-template.json"), "utf8"));
    const qa = path.join(runRoot, "qa");
    runPython([
      path.join(adapterScripts, "compare_pose_envelope.py"),
      "--atlas", atlas,
      "--selected-template", path.join(prepared, "selected-template.json"),
      "--identity-brief", path.join(prepared, "identity-brief.json"),
      "--output-dir", qa,
    ]);
    const deterministicPath = path.join(qa, "deterministic-qa.json");
    const deterministic = JSON.parse(await readFile(deterministicPath, "utf8"));
    assert(deterministic.status === "passed" && deterministic.counts.failures === 0,
      `${sample.family}: deterministic template QA failed`);
    const visual = path.join(runRoot, "visual");
    await mkdir(visual, { recursive: true });
    const contactSheet = path.join(visual, "contact-sheet.png");
    const directionSheet = path.join(visual, "look-directions.png");
    const continuity = path.join(visual, "look-continuity.json");
    runPython([path.join(hatchPetRoot, "scripts", "make_contact_sheet.py"), atlas, "--output", contactSheet]);
    runPython([path.join(hatchPetRoot, "scripts", "make_direction_qa_sheet.py"), atlas, "--output", directionSheet]);
    runPython([path.join(hatchPetRoot, "scripts", "measure_direction_continuity.py"), atlas, "--json-out", continuity]);
    const actualHashes = {
      petManifestSha256: await fileHash(petManifest),
      atlasSha256: await fileHash(atlas),
      contactSheetSha256: await fileHash(contactSheet),
      directionSheetSha256: await fileHash(directionSheet),
      continuitySha256: await fileHash(continuity),
    };
    for (const [key, value] of Object.entries(actualHashes)) {
      assert(reviewed.source[key] === value, `${sample.family}: reviewed ${key} changed`);
    }
    results.push({
      family: sample.family,
      samplePet: sample.pet,
      source: { ...actualHashes, sourceMutated: false },
      bundle: {
        sha256: digest(bundleBytes),
        requestSha256: digest(requestBytes),
        avatarSha256: imageSha256,
      },
      adapter: {
        templateId: selected.templateId,
        combinedTemplateSha256: selected.provenance.combinedTemplateSha256,
        delegateSkill: "hatch-pet",
      },
      deterministicQa: {
        status: deterministic.status,
        failures: deterministic.counts.failures,
        runtimeFrames: deterministic.counts.runtimeFrames,
        reservedFrames: deterministic.counts.reservedFrames,
        evidenceSha256: digest(stableJson({
          ...deterministic,
          atlas: { ...deterministic.atlas, path: `pets/${sample.pet}/spritesheet.webp` },
        })),
      },
      semanticReview: { status: reviewed.status, evidenceFile: reviewPath },
      safety: { uploaded: false, published: false, installed: false, sourceMutated: false },
    });
  }
  const summary = { schemaVersion: 1, issue: 192, status: "passed", samples: results };
  const encoded = `${JSON.stringify(summary, null, 2)}\n`;
  if (expectedArg) {
    const expected = JSON.parse(await readFile(path.resolve(expectedArg), "utf8"));
    assert(JSON.stringify(expected) === JSON.stringify(summary), `integrated evidence differs from ${expectedArg}`);
  }
  if (jsonOutArg) {
    const output = path.resolve(jsonOutArg);
    await mkdir(path.dirname(output), { recursive: true });
    await writeFile(output, encoded);
  }
  process.stdout.write(encoded);
} finally {
  await rm(temp, { recursive: true, force: true });
}

function withinPetsRoot(pet) {
  const candidate = path.resolve(petsRoot, pet);
  assert(candidate.startsWith(`${petsRoot}${path.sep}`), `source path escaped pets root: ${candidate}`);
  return candidate;
}

function runPython(args) {
  const result = spawnSync(python, args, {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${python} ${args.join(" ")} exited with ${result.status}\n${result.stdout}\n${result.stderr}`);
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
