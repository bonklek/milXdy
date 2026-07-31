import { spawnSync } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  createStoredZip,
  listStoredZip,
  stableJson,
} from "../../examples/packages/local-dev/tweet-composer-kit/src/custom-pet-contract.js";

const python = process.env.PYTHON || "python";
const skillRoot = "assets/user-downloads/remilia-pet/remilia-maker-pet-import";
const scripts = path.join(skillRoot, "scripts");
const fixtures = "examples/fixtures/remilia-pet-request";
const temp = path.join("tmp", `remilia-pet-import-verify-${process.pid}`);
const families = ["milady", "remilio", "bonkler", "kagami"];

await rm(temp, { recursive: true, force: true });
await mkdir(temp, { recursive: true });
try {
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
    assert(identity.family === family && identity.bodyCompletion, `${family}: incomplete identity brief`);
    assert(handoff.delegateSkill === "hatch-pet", `${family}: adapter did not delegate to hatch-pet`);
    assert(handoff.runtimeRows.length === 11, `${family}: hatch handoff missing rows`);
    assert(/^[a-f0-9]{64}$/.test(provenance.inputFingerprint), `${family}: invalid provenance fingerprint`);
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
  console.log("Remilia Maker Pet Import verification passed for all four families.");
} finally {
  await rm(temp, { recursive: true, force: true });
}

function runPython(args) {
  const result = spawnSync(python, args, {
    encoding: "utf8",
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${python} ${args.join(" ")} exited with ${result.status}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
