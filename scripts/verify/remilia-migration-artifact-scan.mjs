import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDeterministicZip } from "../build/deterministic-zip.mjs";
import { listZipEntries, scanContent } from "../release/verify-remilia-migration-artifacts.mjs";

const root = await mkdtemp(join(tmpdir(), "milxdy-remilia-artifact-scan-"));

try {
  scanContent("safe.zip", "popup.js", Buffer.from([
    "const callback = 'https://example.chromiumapp.org/remilia-oauth';",
    "const header = 'Authorization: Bearer <access_token>';",
    "const clientSecret = 'YOUR_CLIENT_SECRET';",
    "const migration = 'browser-session authentication is removed';",
  ].join("\n")));

  const rejected = [
    ["private key", "-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----"],
    ["JWT-like credential", "eyJhbGciOiJSUzI1NiJ9.abcdefghijklmnop.qrstuvwxyz012345"],
    ["bearer credential", "Authorization: Bearer abcdefghijklmnopqrstuvwxyz"],
    ["client secret assignment", "REMILIA_CLIENT_SECRET=fixture-secret-value"],
    ["Windows machine path", "C:\\Users\\private-user\\project"],
    ["POSIX machine path", "/home/private-user/project"],
    ["Codex worktree path", ".codex/worktrees/abcd/project"],
    ["retired browser-session UI", "Retry session"],
    ["retired browser-session UI", "Open RemiliaNET"],
  ];

  for (const [label, value] of rejected) {
    assert.throws(
      () => scanContent("fixture.zip", "popup.js", Buffer.from(value)),
      (error) => error instanceof Error && error.message.includes(label),
      `expected ${label} fixture to fail`,
    );
  }

  const source = join(root, "source");
  const archive = join(root, "fixture.zip");
  await mkdir(join(source, "nested"), { recursive: true });
  await writeFile(join(source, "manifest.json"), '{"name":"fixture"}\n');
  await writeFile(join(source, "nested", "popup.js"), "export const safe = true;\n");
  await createDeterministicZip(source, archive);
  const zip = await readFile(archive);
  assert.deepEqual(listZipEntries(zip).map((entry) => entry.fileName), ["manifest.json", "nested/popup.js"]);
  for (const entry of listZipEntries(zip)) {
    assert.equal(typeof entry.dataOffset, "number");
    assert.equal(entry.compressionMethod, 8);
  }

  console.log("Remilia migration artifact scan fixtures passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
