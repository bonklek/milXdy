import { verifyFamilyBundles, verifyCorruptBundles, makeQaAtlas, verifyTraitDiffs } from "./remilia-pet-import-fixtures.mjs";
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
  await verifyFamilyBundles({ families, fixtures, temp, scripts, runPython, assert });

  const { entries, request } = await verifyCorruptBundles({ python, fixtures, temp, scripts, pythonOptions, assert });

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
  await verifyTraitDiffs(baseRequest, { temp, scripts, runPython, assert });

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
