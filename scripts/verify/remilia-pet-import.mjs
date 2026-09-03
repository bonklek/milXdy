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

const python = process.env.PYTHON || "python";
const skillRoot = "assets/user-downloads/remilia-pet/remilia-maker-pet-import";
const scripts = path.join(skillRoot, "scripts");
const fixtures = "examples/fixtures/remilia-pet-request";
const temp = path.join("tmp", `remilia-pet-import-verify-${process.pid}`);
const families = ["milady", "remilio", "bonkler", "kagami"];

await rm(temp, { recursive: true, force: true });
await mkdir(temp, { recursive: true });
try {
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

  const templateCopy = path.join(temp, "templates");
  await cp(path.join(skillRoot, "assets", "templates"), templateCopy, { recursive: true });
  const invalidMotionPath = path.join(templateCopy, "motion-profile-v1.json");
  const invalidMotion = JSON.parse(await readFile(invalidMotionPath, "utf8"));
  delete invalidMotion.runtimeRows[0].phases;
  await writeFile(invalidMotionPath, `${JSON.stringify(invalidMotion, null, 2)}\n`);
  const invalidTemplate = spawnSync(
    python,
    [
      "-c",
      [
        "import sys",
        `sys.path.insert(0, ${JSON.stringify(path.resolve(scripts))})`,
        "from pathlib import Path",
        "from select_template import select_template",
        "select_template('milady', 1, Path(sys.argv[1]))",
      ].join("; "),
      path.resolve(templateCopy),
    ],
    pythonOptions(),
  );
  assert(invalidTemplate.status !== 0, "motion template without a full phase sequence was accepted");
  assert(
    `${invalidTemplate.stdout}\n${invalidTemplate.stderr}`.includes("invalid phase sequence"),
    "invalid motion-template rejection was not actionable",
  );

  for (const mismatch of [
    {
      name: "unsupported-family",
      mutate: (candidate) => { candidate.templateFamily = "unknown"; },
      expected: "Unsupported templateFamily: unknown",
    },
    {
      name: "unsupported-template-version",
      mutate: (candidate) => { candidate.templateVersion = 2; },
      expected: "Only templateVersion 1 is supported",
    },
  ]) {
    const mismatchedRequest = structuredClone(request);
    mismatchedRequest.imageSha256 = createHash("sha256").update(entries[0].bytes).digest("hex");
    mismatch.mutate(mismatchedRequest);
    const mismatchedZip = createStoredZip([
      { name: "avatar.png", bytes: entries[0].bytes },
      { name: "request.json", bytes: new TextEncoder().encode(stableJson(mismatchedRequest)) },
    ]);
    const mismatchPath = path.join(temp, `${mismatch.name}.zip`);
    await writeFile(mismatchPath, mismatchedZip);
    const mismatchResult = spawnSync(
      python,
      [path.join(scripts, "validate_bundle.py"), mismatchPath],
      pythonOptions(),
    );
    assert(mismatchResult.status !== 0, `${mismatch.name} bundle was accepted`);
    assert(
      `${mismatchResult.stdout}\n${mismatchResult.stderr}`.includes(mismatch.expected),
      `${mismatch.name} rejection was not actionable`,
    );
  }

  const miladyRun = path.join(temp, "milady");
  const atlas = makeQaAtlas({ includeHairExpansion: true });
  const atlasPath = path.join(temp, "synthetic-v2-atlas.png");
  await writeFile(atlasPath, PNG.sync.write(atlas));
  const qaDir = path.join(miladyRun, "qa");
  runPython([
    path.join(scripts, "compare_pose_envelope.py"),
    "--atlas",
    atlasPath,
    "--selected-template",
    path.join(miladyRun, "selected-template.json"),
    "--identity-brief",
    path.join(miladyRun, "identity-brief.json"),
    "--output-dir",
    qaDir,
  ]);
  const qa = JSON.parse(await readFile(path.join(qaDir, "deterministic-qa.json"), "utf8"));
  const semantic = JSON.parse(await readFile(path.join(qaDir, "semantic-review.json"), "utf8"));
  assert(
    qa.status === "passed" &&
      qa.counts.runtimeFrames === 73 &&
      qa.counts.reservedFrames === 1 &&
      qa.counts.measuredFrames === 74,
    "valid synthetic v2 atlas failed QA",
  );
  assert(
    qa.template.activeExpansionZones.includes("hair"),
    "authoritative hair trait did not activate its expansion zone",
  );
  assert(
    semantic.status === "pending" && semantic.checks.identity === null,
    "deterministic QA improperly approved semantic review",
  );
  await writeFile(path.join(qaDir, "diagnostics", "row-99-frame-99.png"), "stale");
  semantic.status = "approved";
  semantic.deterministicQaSha256 = "0".repeat(64);
  semantic.reviewer = "stale-review-fixture";
  semantic.reviewedAt = "1999-01-01T00:00:00.000Z";
  semantic.checks = Object.fromEntries(
    Object.keys(semantic.checks).map((key) => [key, true]),
  );
  await writeFile(path.join(qaDir, "semantic-review.json"), `${JSON.stringify(semantic, null, 2)}\n`);
  runPython([
    path.join(scripts, "compare_pose_envelope.py"),
    "--atlas",
    atlasPath,
    "--selected-template",
    path.join(miladyRun, "selected-template.json"),
    "--identity-brief",
    path.join(miladyRun, "identity-brief.json"),
    "--output-dir",
    qaDir,
  ]);
  const refreshedSemantic = JSON.parse(
    await readFile(path.join(qaDir, "semantic-review.json"), "utf8"),
  );
  assert(
    refreshedSemantic.status === "pending" && refreshedSemantic.reviewer === null,
    "a semantic approval bound to stale deterministic QA was preserved",
  );
  assert(
    !(await readdir(path.join(qaDir, "diagnostics"))).includes("row-99-frame-99.png"),
    "a stale frame diagnostic survived a deterministic QA rerun",
  );

  const noExpansionDir = path.join(temp, "qa-no-expansion");
  const noExpansion = spawnSync(
    python,
    [
      path.join(scripts, "compare_pose_envelope.py"),
      "--atlas",
      atlasPath,
      "--selected-template",
      path.join(miladyRun, "selected-template.json"),
      "--output-dir",
      noExpansionDir,
    ],
    pythonOptions(),
  );
  assert(noExpansion.status === 1, "undeclared hair envelope expansion was accepted");
  const noExpansionQa = JSON.parse(
    await readFile(path.join(noExpansionDir, "deterministic-qa.json"), "utf8"),
  );
  assert(
    noExpansionQa.failures.some((failure) => failure.check === "permitted-envelope"),
    "undeclared expansion failure did not identify the permitted envelope",
  );

  const clipped = makeQaAtlas({ clipped: true });
  const clippedPath = path.join(temp, "clipped-v2-atlas.png");
  await writeFile(clippedPath, PNG.sync.write(clipped));
  const clippedDir = path.join(temp, "qa-clipped");
  const clippedResult = spawnSync(
    python,
    [
      path.join(scripts, "compare_pose_envelope.py"),
      "--atlas",
      clippedPath,
      "--selected-template",
      path.join(miladyRun, "selected-template.json"),
      "--identity-brief",
      path.join(miladyRun, "identity-brief.json"),
      "--output-dir",
      clippedDir,
    ],
    pythonOptions(),
  );
  assert(clippedResult.status === 1, "edge-clipped frame was accepted");
  const clippedQa = JSON.parse(await readFile(path.join(clippedDir, "deterministic-qa.json"), "utf8"));
  const clippingFailure = clippedQa.failures.find(
    (failure) => failure.check === "clipping-edge-alpha",
  );
  assert(
    clippingFailure?.diagnosticArtifact &&
      clippingFailure.templateId === "milady-v1" &&
      clippingFailure.templateVersion === 1 &&
      clippingFailure.threshold.maximum === 0,
    "clipping failure evidence is incomplete",
  );

  for (const motionFault of [
    { name: "adjacent", option: "adjacentFault", check: "adjacent-centroid-continuity" },
    { name: "loop", option: "loopFault", check: "loop-closure" },
  ]) {
    const faultyAtlas = makeQaAtlas({ [motionFault.option]: true });
    const faultyPath = path.join(temp, `${motionFault.name}-motion-fault.png`);
    const faultyDir = path.join(temp, `qa-${motionFault.name}-motion-fault`);
    await writeFile(faultyPath, PNG.sync.write(faultyAtlas));
    const faultyResult = spawnSync(
      python,
      [
        path.join(scripts, "compare_pose_envelope.py"),
        "--atlas",
        faultyPath,
        "--selected-template",
        path.join(miladyRun, "selected-template.json"),
        "--identity-brief",
        path.join(miladyRun, "identity-brief.json"),
        "--output-dir",
        faultyDir,
      ],
      pythonOptions(),
    );
    assert(faultyResult.status === 1, `${motionFault.name} motion fault was accepted`);
    const faultyQa = JSON.parse(
      await readFile(path.join(faultyDir, "deterministic-qa.json"), "utf8"),
    );
    const motionFailure = faultyQa.failures.find(
      (failure) => failure.check === motionFault.check,
    );
    assert(
      motionFailure?.diagnosticArtifact &&
        motionFailure.templateVersion === 1 &&
        faultyQa.sequenceChecks.some(
          (check) => check.check === motionFault.check && check.passed === false,
        ),
      `${motionFault.name} motion failure evidence is incomplete`,
    );
  }

  const baseRequest = JSON.parse(
    await readFile(path.join(fixtures, "milady", "request.json"), "utf8"),
  );
  await verifyTraitDiffs(baseRequest);

  const cacheDir = path.join(temp, "cache");
  const firstPlanPath = path.join(temp, "resume-plan-first.json");
  runPython([
    path.join(scripts, "cache_resume.py"),
    "plan",
    "--run-dir",
    miladyRun,
    "--cache-dir",
    cacheDir,
    "--json-out",
    firstPlanPath,
  ]);
  const firstPlan = JSON.parse(await readFile(firstPlanPath, "utf8"));
  assert(firstPlan.action === "generate-all-rows", "fresh run did not plan all rows");

  const runStatePath = path.join(miladyRun, "run-state.json");
  const runState = JSON.parse(await readFile(runStatePath, "utf8"));
  runState.rows[0].status = "completed";
  runState.rows[0].contentSha256 = "not-a-content-hash";
  await writeFile(runStatePath, `${JSON.stringify(runState, null, 2)}\n`);
  const invalidRowPath = path.join(temp, "resume-plan-invalid-row.json");
  runPython([
    path.join(scripts, "cache_resume.py"),
    "plan",
    "--run-dir",
    miladyRun,
    "--cache-dir",
    cacheDir,
    "--json-out",
    invalidRowPath,
  ]);
  const invalidRow = JSON.parse(await readFile(invalidRowPath, "utf8"));
  assert(
    invalidRow.action === "generate-all-rows" &&
      invalidRow.nextRow.index === 0 &&
      invalidRow.nextRow.invalidationReason === "completed-row-content-hash-invalid",
    "an invalid completed-row hash was trusted for resume",
  );
  runState.rows[0].contentSha256 = "1".repeat(64);
  await writeFile(runStatePath, `${JSON.stringify(runState, null, 2)}\n`);
  const interruptedPath = path.join(temp, "resume-plan-interrupted.json");
  runPython([
    path.join(scripts, "cache_resume.py"),
    "plan",
    "--run-dir",
    miladyRun,
    "--cache-dir",
    cacheDir,
    "--json-out",
    interruptedPath,
  ]);
  const interrupted = JSON.parse(await readFile(interruptedPath, "utf8"));
  assert(
    interrupted.action === "resume-interrupted-run" && interrupted.nextRow.index === 1,
    "interrupted run did not resume at the first unfinished row",
  );

  const rejectedStore = spawnSync(
    python,
    [
      path.join(scripts, "cache_resume.py"),
      "store",
      "--run-dir",
      miladyRun,
      "--atlas",
      atlasPath,
      "--cache-dir",
      cacheDir,
    ],
    pythonOptions(),
  );
  assert(
    rejectedStore.status !== 0 &&
      `${rejectedStore.stdout}\n${rejectedStore.stderr}`.includes(
        "semantic review must be separately approved",
      ),
    "cache accepted an atlas before separate semantic approval",
  );

  const deterministicBytes = await readFile(path.join(qaDir, "deterministic-qa.json"));
  semantic.status = "approved";
  semantic.deterministicQaSha256 = createHash("sha256").update(deterministicBytes).digest("hex");
  semantic.reviewer = "sanitized-contract-fixture";
  semantic.reviewedAt = "2000-01-01T00:00:00.000Z";
  semantic.checks = Object.fromEntries(
    Object.keys(semantic.checks).map((key) => [key, true]),
  );
  semantic.notes = "Synthetic geometry fixture approval for cache-contract verification only.";
  await writeFile(path.join(qaDir, "semantic-review.json"), `${JSON.stringify(semantic, null, 2)}\n`);
  semantic.checks.motionQuality = false;
  await writeFile(path.join(qaDir, "semantic-review.json"), `${JSON.stringify(semantic, null, 2)}\n`);
  const rejectedIncompleteReview = spawnSync(
    python,
    [
      path.join(scripts, "cache_resume.py"),
      "store",
      "--run-dir",
      miladyRun,
      "--atlas",
      atlasPath,
      "--cache-dir",
      cacheDir,
    ],
    pythonOptions(),
  );
  assert(
    rejectedIncompleteReview.status !== 0 &&
      `${rejectedIncompleteReview.stdout}\n${rejectedIncompleteReview.stderr}`.includes(
        "must pass every required semantic check",
      ),
    "cache accepted an approval with a failed semantic check",
  );
  semantic.checks.motionQuality = true;
  await writeFile(path.join(qaDir, "semantic-review.json"), `${JSON.stringify(semantic, null, 2)}\n`);
  runPython([
    path.join(scripts, "cache_resume.py"),
    "store",
    "--run-dir",
    miladyRun,
    "--atlas",
    atlasPath,
    "--cache-dir",
    cacheDir,
  ]);
  const exactPath = path.join(temp, "resume-plan-exact.json");
  runPython([
    path.join(scripts, "cache_resume.py"),
    "plan",
    "--run-dir",
    miladyRun,
    "--cache-dir",
    cacheDir,
    "--json-out",
    exactPath,
  ]);
  const exact = JSON.parse(await readFile(exactPath, "utf8"));
  assert(exact.action === "reuse-validated-atlas", "exact validated rerun was not reused");

  const provenance = JSON.parse(await readFile(path.join(miladyRun, "provenance.json"), "utf8"));
  const cacheEntryPath = path.join(cacheDir, provenance.inputFingerprint, "cache-entry.json");
  const cacheEntry = JSON.parse(await readFile(cacheEntryPath, "utf8"));
  cacheEntry.adapterVersion = "tampered-adapter";
  await writeFile(cacheEntryPath, `${JSON.stringify(cacheEntry, null, 2)}\n`);
  const invalidatedPath = path.join(temp, "resume-plan-invalidated-cache.json");
  runPython([
    path.join(scripts, "cache_resume.py"),
    "plan",
    "--run-dir",
    miladyRun,
    "--cache-dir",
    cacheDir,
    "--json-out",
    invalidatedPath,
  ]);
  const invalidated = JSON.parse(await readFile(invalidatedPath, "utf8"));
  assert(
    invalidated.action !== "reuse-validated-atlas" &&
      invalidated.cacheEntryRejection === "adapter-version-mismatch",
    "cache provenance did not invalidate an adapter-version change",
  );
  cacheEntry.adapterVersion = provenance.adapterVersion;
  cacheEntry.atlasFile = "../private-input.png";
  await writeFile(cacheEntryPath, `${JSON.stringify(cacheEntry, null, 2)}\n`);
  const unsafePath = path.join(temp, "resume-plan-unsafe-cache-path.json");
  runPython([
    path.join(scripts, "cache_resume.py"),
    "plan",
    "--run-dir",
    miladyRun,
    "--cache-dir",
    cacheDir,
    "--json-out",
    unsafePath,
  ]);
  const unsafe = JSON.parse(await readFile(unsafePath, "utf8"));
  assert(
    unsafe.action !== "reuse-validated-atlas" &&
      unsafe.cacheEntryRejection === "cached-atlas-path-unsafe",
    "cache reuse accepted an atlas path outside its fingerprint directory",
  );
  cacheEntry.atlasFile = "validated-atlas.png";
  await writeFile(cacheEntryPath, `${JSON.stringify(cacheEntry, null, 2)}\n`);

  const recoveryCache = path.join(temp, "recovery-cache");
  const recoveryEntry = path.join(recoveryCache, provenance.inputFingerprint);
  await mkdir(recoveryEntry, { recursive: true });
  await writeFile(
    path.join(recoveryEntry, "validated-atlas.png"),
    await readFile(atlasPath),
  );
  const recoveryResultPath = path.join(temp, "cache-recovery-result.json");
  runPython([
    path.join(scripts, "cache_resume.py"),
    "store",
    "--run-dir",
    miladyRun,
    "--atlas",
    atlasPath,
    "--cache-dir",
    recoveryCache,
    "--json-out",
    recoveryResultPath,
  ]);
  const recovery = JSON.parse(await readFile(recoveryResultPath, "utf8"));
  assert(
    recovery.status === "stored" &&
      JSON.parse(await readFile(path.join(recoveryEntry, "cache-entry.json"), "utf8")).atlasSha256 ===
        cacheEntry.atlasSha256,
    "an interrupted cache write did not recover deterministically",
  );

  console.log(
    "Remilia Maker Pet Import verification passed for four families, deterministic QA, trait diff, and cache/resume.",
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}

function runPython(args) {
  const result = spawnSync(python, args, {
    ...pythonOptions(),
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${python} ${args.join(" ")} exited with ${result.status}`);
  }
}

function pythonOptions() {
  return {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  };
}

function makeQaAtlas({
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

function fillRect(png, left, top, width, height, rgba) {
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

async function verifyTraitDiffs(baseRequest) {
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
