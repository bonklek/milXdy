import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { PNG } from "pngjs";
import {
  createStoredZip,
  listStoredZip,
  stableJson,
} from "../../packages/maintainer/pets-maker/src/custom-pet-contract.js";

export async function verifyFamilyBundles({ families, fixtures, temp, scripts, runPython, assert }) {
  const familyReviews = JSON.parse(
    await readFile("docs/evidence/custom-pet-mvp/maker-family-semantic-reviews.json", "utf8"),
  );
  assert(
    familyReviews.status === "approved" && familyReviews.publicationActionAuthorized === false,
    "family semantic-review evidence is incomplete or authorizes publication",
  );
  for (const family of families) {
    const review = familyReviews.families?.[family];
    assert(review?.status === "approved", `${family}: family sample review is not approved`);
    assert(
      /^[a-f0-9]{64}$/.test(review.source?.atlasSha256),
      `${family}: family sample review does not bind its atlas hash`,
    );
  }
  for (const family of families) {
    const bundle = path.join(fixtures, family, "remilia-pet-request.zip");
    const validation = path.join(temp, `${family}-validation.json`);
    const selected = path.join(temp, `${family}-template.json`);
    const run = path.join(temp, family);
    runPython([
      path.join(scripts, "validate_bundle.py"),
      bundle,
      "--json-out",
      validation,
    ]);
    runPython([
      path.join(scripts, "select_template.py"),
      "--bundle",
      bundle,
      "--json-out",
      selected,
    ]);
    runPython([
      path.join(scripts, "prepare_import.py"),
      bundle,
      "--output-dir",
      run,
    ]);
    const validationJson = JSON.parse(await readFile(validation, "utf8"));
    const selectedJson = JSON.parse(await readFile(selected, "utf8"));
    const identity = JSON.parse(await readFile(path.join(run, "identity-brief.json"), "utf8"));
    const handoff = JSON.parse(await readFile(path.join(run, "hatch-pet-handoff.json"), "utf8"));
    const provenance = JSON.parse(await readFile(path.join(run, "provenance.json"), "utf8"));
    assert(validationJson.ok === true, `${family}: bundle validation did not pass`);
    assert(validationJson.templateId === `${family}-v1`, `${family}: wrong validated template`);
    assert(selectedJson.templateId === `${family}-v1`, `${family}: wrong selected template`);
    assert(selectedJson.motionProfile.runtimeRows.length === 11, `${family}: missing runtime rows`);
    assert(
      selectedJson.manifest.geometry.alphaRegistration?.baseline === 0.976,
      `${family}: template does not separate atlas alpha registration from conceptual landmarks`,
    );
    assert(identity.family === family && identity.bodyCompletion, `${family}: incomplete identity brief`);
    assert(
      identity.policyContract?.path === "references/trait-policies.json" &&
        /^[a-f0-9]{64}$/.test(identity.policyContract.sha256) &&
        identity.traits.every((trait) => trait.evidence?.policySha256 === identity.policyContract.sha256),
      `${family}: identity brief is not traceable to the versioned trait policy`,
    );
    assert(handoff.delegateSkill === "hatch-pet", `${family}: adapter did not delegate to hatch-pet`);
    assert(handoff.runtimeRows.length === 11, `${family}: hatch handoff missing rows`);
    assert(/^[a-f0-9]{64}$/.test(provenance.inputFingerprint), `${family}: invalid provenance fingerprint`);
    assert(
      provenance.adapterVersion === 2 &&
        provenance.policyVersion === 1 &&
        provenance.policySha256 === identity.policyContract.sha256,
      `${family}: provenance does not bind the adapter and policy versions`,
    );
    assert(
      provenance.localDataPolicy.rawBundleCached === false &&
        provenance.localDataPolicy.finalValidatedAtlasCache === "user-selected-local-directory-only",
      `${family}: local cache privacy policy is incomplete`,
    );
  }
}

export async function verifyCorruptBundles({ python, fixtures, temp, scripts, pythonOptions, assert }) {
  const validZip = await readFile(path.join(fixtures, "milady", "remilia-pet-request.zip"));
  const entries = listStoredZip(validZip);
  const request = JSON.parse(new TextDecoder().decode(entries[1].bytes));
  request.imageSha256 = "0".repeat(64);
  const corruptZip = createStoredZip([
    { name: "avatar.png", bytes: entries[0].bytes },
    { name: "request.json", bytes: new TextEncoder().encode(stableJson(request)) },
  ]);
  const corruptPath = path.join(temp, "corrupt-hash.zip");
  await writeFile(corruptPath, corruptZip);
  const rejected = spawnSync(python, [path.join(scripts, "validate_bundle.py"), corruptPath], {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  assert(rejected.status !== 0, "corrupt image hash was accepted");
  assert(
    `${rejected.stdout}\n${rejected.stderr}`.includes("SHA-256 mismatch"),
    "corrupt image hash rejection was not actionable",
  );

  const duplicateRequest = new TextDecoder().decode(entries[1].bytes).replace(
    /\{\s*/u,
    '{"schemaVersion":1,',
  );
  const duplicateZip = createStoredZip([
    { name: "avatar.png", bytes: entries[0].bytes },
    { name: "request.json", bytes: new TextEncoder().encode(duplicateRequest) },
  ]);
  const duplicatePath = path.join(temp, "duplicate-field.zip");
  await writeFile(duplicatePath, duplicateZip);
  const duplicateResult = spawnSync(
    python,
    [path.join(scripts, "validate_bundle.py"), duplicatePath],
    pythonOptions(),
  );
  assert(duplicateResult.status !== 0, "duplicate request field was accepted");
  assert(
    `${duplicateResult.stdout}\n${duplicateResult.stderr}`.includes("duplicate field: schemaVersion"),
    "duplicate request field rejection was not actionable",
  );

  const corruptPng = Buffer.from(entries[0].bytes);
  const idatTypeOffset = corruptPng.indexOf(Buffer.from("IDAT", "ascii"));
  assert(idatTypeOffset > 0, "fixture PNG has no IDAT chunk");
  corruptPng[idatTypeOffset + 4] ^= 0x01;
  const corruptPngRequest = JSON.parse(new TextDecoder().decode(entries[1].bytes));
  corruptPngRequest.imageSha256 = createHash("sha256").update(corruptPng).digest("hex");
  const corruptPngZip = createStoredZip([
    { name: "avatar.png", bytes: corruptPng },
    { name: "request.json", bytes: new TextEncoder().encode(stableJson(corruptPngRequest)) },
  ]);
  const corruptPngPath = path.join(temp, "corrupt-png-crc.zip");
  await writeFile(corruptPngPath, corruptPngZip);
  const corruptPngResult = spawnSync(
    python,
    [path.join(scripts, "validate_bundle.py"), corruptPngPath],
    pythonOptions(),
  );
  assert(corruptPngResult.status !== 0, "corrupt PNG chunk was accepted");
  assert(
    `${corruptPngResult.stdout}\n${corruptPngResult.stderr}`.includes("CRC-32 mismatch"),
    "corrupt PNG rejection was not actionable",
  );
  return { entries, request };
}

export function makeQaAtlas({
  includeHairExpansion = false,
  clipped = false,
  adjacentFault = false,
  loopFault = false,
} = {}) {
  const png = new PNG({ width: 1536, height: 2288 });
  const frameCounts = [6, 8, 8, 4, 5, 8, 6, 6, 6, 8, 8];
  for (let row = 0; row < frameCounts.length; row += 1) {
    for (let column = 0; column < frameCounts[row]; column += 1) {
      let offsetX = 0;
      if (row === 0 && adjacentFault && column === 2) offsetX = 30;
      if (row === 0 && loopFault && column === 5) offsetX = 20;
      fillRect(png, column * 192 + 78 + offsetX, row * 208 + 38, 36, 157, [40, 90, 180, 255]);
      if (includeHairExpansion && row === 0 && column === 0) {
        fillRect(png, column * 192 + 30, row * 208 + 38, 11, 35, [120, 50, 170, 255]);
      }
    }
  }
  fillRect(png, 6 * 192 + 78, 38, 36, 157, [40, 90, 180, 255]);
  if (clipped) {
    fillRect(png, 0, 80, 4, 24, [255, 20, 20, 255]);
  }
  return png;
}

export function fillRect(png, left, top, width, height, rgba) {
  for (let y = top; y < top + height; y += 1) {
    for (let x = left; x < left + width; x += 1) {
      const offset = (png.width * y + x) << 2;
      png.data[offset] = rgba[0];
      png.data[offset + 1] = rgba[1];
      png.data[offset + 2] = rgba[2];
      png.data[offset + 3] = rgba[3];
    }
  }
}

export async function verifyTraitDiffs(baseRequest, { temp, scripts, runPython, assert }) {
  const cases = [
    {
      name: "exact",
      mutate: () => {},
      classification: "exact-match",
      action: "reuse-validated-atlas-candidate",
    },
    {
      name: "non-pet",
      mutate: (request) => {
        request.traitPolicy.background = "omit-updated";
      },
      classification: "non-pet-only",
      action: "reuse-validated-atlas-candidate",
    },
    {
      name: "small",
      mutate: (request) => {
        request.traits.eyes.assetId = "fixture-eyes-2";
      },
      classification: "small-appearance-change",
      action: "targeted-row-edits",
    },
    {
      name: "major",
      mutate: (request) => {
        request.traits.hair.assetId = "fixture-major-hair";
      },
      classification: "major-silhouette-change",
      action: "regenerate-character-imagery",
    },
  ];
  const previous = path.join(temp, "diff-previous.json");
  await writeFile(previous, `${JSON.stringify(baseRequest, null, 2)}\n`);
  for (const fixture of cases) {
    const currentRequest = structuredClone(baseRequest);
    fixture.mutate(currentRequest);
    const current = path.join(temp, `diff-${fixture.name}.json`);
    const output = path.join(temp, `diff-${fixture.name}-plan.json`);
    await writeFile(current, `${JSON.stringify(currentRequest, null, 2)}\n`);
    runPython([
      path.join(scripts, "plan_trait_diff.py"),
      "--previous",
      previous,
      "--current",
      current,
      "--json-out",
      output,
    ]);
    const result = JSON.parse(await readFile(output, "utf8"));
    assert(
      result.classification === fixture.classification && result.action === fixture.action,
      `${fixture.name}: trait diff was misclassified`,
    );
  }
}
