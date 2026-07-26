import assert from "node:assert/strict";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { applyNextHandoff, readHandoffStatus, submitHandoff } from "../qa/qa-handoff.mjs";

const packageJson = JSON.parse(await readFile("package.json", "utf8"));
assert.match(packageJson.scripts?.["qa:submit"] || "", /qa-handoff\.mjs submit/u);
assert.match(packageJson.scripts?.["qa:apply-next"] || "", /qa-handoff\.mjs apply-next/u);
assert.match(packageJson.scripts?.["qa:status"] || "", /qa-handoff\.mjs status/u);

const root = resolve("tmp/qa-handoff-verifier");
const host = resolve(root, "host");
const implementation = resolve(root, "implementation");
const stateRoot = resolve(root, "state");
await rm(root, { recursive: true, force: true });
await mkdir(host, { recursive: true });

try {
  git(host, "init");
  git(host, "config", "user.name", "QA Handoff Verifier");
  git(host, "config", "user.email", "qa-handoff@example.invalid");
  git(host, "config", "core.autocrlf", "false");
  await writeFile(resolve(host, "app.txt"), "base\n");
  await writeFile(resolve(host, "remove.txt"), "remove me\n");
  git(host, "add", "app.txt", "remove.txt");
  git(host, "commit", "-m", "base");
  git(host, "worktree", "add", "-b", "feature", implementation);

  await writeFile(resolve(implementation, "app.txt"), "feature\n");
  await writeFile(resolve(implementation, "added.txt"), "staged addition\n");
  await rm(resolve(implementation, "remove.txt"));
  git(implementation, "add", "added.txt", "remove.txt");
  const submitted = await submitHandoff({ cwd: implementation, stateRoot });
  assert.deepEqual(
    submitted.changes.map(({ status, path }) => ({ status, path })),
    [
      { status: "A", path: "added.txt" },
      { status: "M", path: "app.txt" },
      { status: "D", path: "remove.txt" },
    ],
  );
  assert.equal((await readHandoffStatus({ cwd: implementation, stateRoot })).pendingIntegrity, "ok");
  await assert.rejects(submitHandoff({ cwd: implementation, stateRoot }), /already pending/u);

  const built = await applyNextHandoff({
    cwd: host,
    stateRoot,
    checkWatcher: false,
    async buildRunner() {
      assert.equal(await readFile(resolve(host, "app.txt"), "utf8"), "feature\n", "build must see the submitted source");
      assert.equal(await readFile(resolve(host, "added.txt"), "utf8"), "staged addition\n");
      await assert.rejects(readFile(resolve(host, "remove.txt")), /ENOENT/u);
      return { buildId: "test-build" };
    },
  });
  assert.equal(built.status, "built");
  assert.equal(built.buildId, "test-build");
  assert.equal(await readFile(resolve(host, "app.txt"), "utf8"), "base\n", "successful apply must restore QA host source");
  assert.equal(await readFile(resolve(host, "remove.txt"), "utf8"), "remove me\n");
  await assert.rejects(readFile(resolve(host, "added.txt")), /ENOENT/u);
  assert.equal((await readHandoffStatus({ cwd: host, stateRoot })).pending, null);

  await submitHandoff({ cwd: implementation, stateRoot });
  await writeFile(resolve(host, "app.txt"), "host overlap\n");
  await assert.rejects(
    applyNextHandoff({ cwd: host, stateRoot, checkWatcher: false, buildRunner: async () => ({}) }),
    /Overlap at app\.txt/u,
  );
  assert.equal(await readFile(resolve(host, "app.txt"), "utf8"), "host overlap\n", "overlap rejection must not alter host source");
  git(host, "checkout", "--", "app.txt");

  await assert.rejects(
    applyNextHandoff({
      cwd: host,
      stateRoot,
      checkWatcher: false,
      async buildRunner() {
        throw new Error("deliberate build failure");
      },
    }),
    /previous QA output was preserved.*deliberate build failure/u,
  );
  assert.equal(await readFile(resolve(host, "app.txt"), "utf8"), "base\n", "failed build must restore QA host source");
  assert.equal((await readHandoffStatus({ cwd: host, stateRoot })).pendingIntegrity, "ok", "failed build must keep the handoff pending");

  await writeFile(resolve(implementation, "untracked.txt"), "not included\n");
  await assert.rejects(submitHandoff({ cwd: implementation, stateRoot, replace: true }), /Untracked files are not included.*untracked\.txt/u);
} finally {
  await rm(root, { recursive: true, force: true });
}

console.log("QA worktree handoff verification passed.");

function git(cwd, ...args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8", windowsHide: true });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`git ${args[0]} failed: ${result.stderr.trim()}`);
  return result.stdout;
}
