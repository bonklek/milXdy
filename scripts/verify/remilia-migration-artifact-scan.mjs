import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDeterministicZip } from "../build/deterministic-zip.mjs";
import { listZipEntries, readZipEntry, scanContent } from "../release/verify-remilia-migration-artifacts.mjs";

const root = await mkdtemp(join(tmpdir(), "milxdy-remilia-artifact-scan-"));

try {
  const allowedRoutes = [
    "const callback = 'https://example.chromiumapp.org/remilia-oauth';",
    "const header = 'Authorization: Bearer <access_token>';",
    "const clientSecret = 'YOUR_CLIENT_SECRET';",
    "const migration = 'browser-session authentication is removed';",
    "const pokeUrl = apiUrl(`/users/${encoded}/poke`);",
    "const profileUrl = apiUrl('/users/public-profile');",
  ].join("\n");
  scanContent("source.zip", "src/apps/remistats/official-api.ts", Buffer.from(allowedRoutes));
  scanContent("built.zip", "background.js", Buffer.from(allowedRoutes));

  const rejected = [
    ["private key", "-----BEGIN PRIVATE KEY-----\nfixture\n-----END PRIVATE KEY-----"],
    ["JWT-like credential", "eyJhbGciOiJSUzI1NiJ9.abcdefghijklmnop.qrstuvwxyz012345"],
    ["bearer credential", "Authorization: Bearer abcdefghijklmnopqrstuvwxyz"],
    ["client secret assignment", "REMILIA_CLIENT_SECRET=fixture-secret-value"],
    ["Windows machine path", "C:\\Users\\private-user\\project"],
    ["Windows machine path", "c:/users/PRIVATE-USER/project"],
    ["UNC machine path", String.raw`\\qa-host\private-share\project`],
    ["UNC machine path", String.raw`\\QA-HOST\PRIVATE-SHARE\PROJECT`],
    ["file URL", "file:///Users/private-user/project"],
    ["file URL", "FILE:///c:/Users/private-user/project"],
    ["file URL", "file://qa-host/private-share/project"],
    ["user-home path", "~/private-project/source"],
    ["user-home path", String.raw`~\private-project\source`],
    ["macOS machine path", "/Users/private-user/project"],
    ["macOS machine path", "/Users/PRIVATE-USER/Project"],
    ["Linux machine path", "/home/private-user/project"],
    ["Linux machine path", "/home/PRIVATE-USER/Project"],
    ["Codex worktree path", ".codex/worktrees/abcd/project"],
    ["retired browser-session UI", "Retry session"],
    ["retired browser-session UI", "Open RemiliaNET"],
  ];

  for (const [label, value] of rejected) {
    for (const [archive, entry] of [["source.zip", "src/fixture.js"], ["built.zip", "background.js"]]) {
      assert.throws(
        () => scanContent(archive, entry, Buffer.from(value)),
        (error) => error instanceof Error && error.message.includes(label),
        `expected ${label} fixture to fail in ${entry}`,
      );
    }
  }

  const source = join(root, "source");
  const archive = join(root, "fixture.zip");
  await mkdir(join(source, "nested"), { recursive: true });
  await writeFile(join(source, "manifest.json"), '{"name":"fixture"}\n');
  await writeFile(join(source, "nested", "popup.js"), "export const safe = true;\n");
  await createDeterministicZip(source, archive);
  const zip = await readFile(archive);
  const entries = listZipEntries(zip);
  assert.deepEqual(entries.map((entry) => entry.fileName), ["manifest.json", "nested/popup.js"]);
  for (const entry of entries) {
    assert.equal(typeof entry.dataOffset, "number");
    assert.equal(entry.compressionMethod, 8);
    assert.equal(readZipEntry(zip, entry).length, entry.uncompressedSize);
  }

  const wrongCrc = { ...entries[0], crc32: entries[0].crc32 ^ 1 };
  assert.throws(() => readZipEntry(zip, wrongCrc), /ZIP CRC mismatch/);

  const unsafeZip = Buffer.from(zip);
  const safeName = Buffer.from("nested/popup.js");
  const unsafeName = Buffer.from("../evil/file.js");
  for (let offset = unsafeZip.indexOf(safeName); offset !== -1; offset = unsafeZip.indexOf(safeName, offset + safeName.length)) {
    unsafeName.copy(unsafeZip, offset);
  }
  assert.throws(() => listZipEntries(unsafeZip), /unsafe ZIP entry path/);

  console.log("Remilia migration artifact scan fixtures passed.");
} finally {
  await rm(root, { recursive: true, force: true });
}
