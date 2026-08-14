import { strict as assert } from "node:assert";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { createDeterministicZip } from "../build/deterministic-zip.mjs";
import { listZipEntries, readZipEntry, scanContent } from "../release/verify-remilia-migration-artifacts.mjs";

const root = await mkdtemp(join(tmpdir(), "milxdy-remilia-artifact-scan-"));

try {
  const allowedRoutes = [
    "const callback = 'https://example.chromiumapp.org/remilia-oauth';",
    "const header = 'Authorization: Bearer <access_token>';",
    "const clientSecret = 'YOUR_CLIENT_SECRET';",
    "const migration = 'browser-session authentication is removed';",
    "const boundary = 'milXdy does not reuse your website cookies or silently reconnect an old browser session';",
    "const reconnect = 'No browser session will be reused';",
    "const noSessionSignin = 'Do not use the browser session to sign in';",
    "const removedSessionSignin = 'Browser-session sign-in has been disabled';",
    "const noLoginReturn = 'Do not sign in on RemiliaNET, return to milXdy, or continue an existing session';",
    "const pokeUrl = apiUrl(`/users/${encoded}/poke`);",
    "const profileUrl = apiUrl('/users/public-profile');",
    "row.setAttribute('aria-label', 'Open RemiliaNET Chat in milXdy');",
    "const recoveryPanel = '<span>Remilia Chat authorization is required</span><button data-chat-action=\"retry-connection\">Reconnect Chat</button><a href=\"https://www.remilia.net/\">Open RemiliaNET</a>';",
    "const profileTitle = 'Open RemiliaNET profile';",
  ].join("\n");
  scanContent("source.zip", "src/apps/remistats/official-api.js", Buffer.from(allowedRoutes));
  scanContent("built.zip", "background.js", Buffer.from(allowedRoutes));
  const emscriptenEnvironment = 'var env={USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user"};';
  scanContent("built.zip", "ort/ort-wasm-simd-threaded.jsep.mjs", Buffer.from(emscriptenEnvironment));
  scanContent("built.zip", "features/music.js", Buffer.from(emscriptenEnvironment));
  scanContent("built.zip", "worker.js", Buffer.from(emscriptenEnvironment));
  scanContent("built.zip", "ocr/core/tesseract-core-lstm.js", Buffer.from(`${emscriptenEnvironment}x.mkdir("/home");x.mkdir("/home/web_user")`));

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
    ["macOS machine path", "/Users/private+user/project"],
    ["macOS machine path", "/Users/a<b/project"],
    ["macOS machine path", "/Users/private-user"],
    ["Linux machine path", "/home/private-user/project"],
    ["Linux machine path", "/home/PRIVATE-USER/Project"],
    ["Linux machine path", "/home/private@user/project"],
    ["Linux machine path", "/home/a<b/project"],
    ["Linux machine path", "/home/private-user"],
    ["macOS machine path", "file:///Users/private-user"],
    ["Linux machine path", "file:///home/private-user"],
    ["Linux machine path", 'var env={HOME:"/home/web_user"};'],
    ["Linux machine path", emscriptenEnvironment],
    ["Codex worktree path", ".codex/worktrees/abcd/project"],
    ["retired browser-session UI", "Retry session"],
    ["retired browser-session UI", "retry-session"],
    ["retired browser-session UI", "RemiliaNET browser-session authentication"],
    ["retired browser-session UI", "Detect the RemiliaNET browser session"],
    ["retired browser-session UI", "Restore the RemiliaNET session"],
    ["retired browser-session UI", "Reuse the RemiliaNET authToken cookie"],
    ["retired browser-session UI", "Open RemiliaNET"],
    ["retired browser-session UI", "Open RemiliaNET in a background tab"],
    ["retired browser-session UI", "Open RemiliaNET to sign in, then retry the session login"],
    ["retired browser-session UI", '<a href="https://www.remilia.net/">Open RemiliaNET</a> to reuse the browser-session login'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open RemiliaNET in a hidden tab</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open RemiliaNET</a> browser-session login state is reused for authentication'],
    ["retired browser-session UI", '<button aria-label="Open RemiliaNET Chat in milXdy">Reuse your existing browser session for login</button>'],
    ["retired browser-session UI", '<a title="Open RemiliaNET profile">Open in a background tab for session authentication</a>'],
    ["retired browser-session UI", "Use the browser session to sign in"],
    ["retired browser-session UI", "Use the browser-session for signin"],
    ["retired browser-session UI", "Use the RemiliaNET browser session to sign in"],
    ["retired browser-session UI", "Sign in on RemiliaNET, return to milXdy, and continue with the existing session"],
    ["retired browser-session UI", "milXdy does not store cookies; reuse the RemiliaNET browser session"],
    ["retired browser-session UI", "Do not store cookies; use the browser session to sign in"],
    ["retired browser-session UI", "Do not store cookies; sign in on RemiliaNET, return to milXdy, and continue the existing session"],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Help</a><a href="https://evil.example/">Open RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://evil.example/">Open RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://evil.example/" data-href="https://www.remilia.net/">Open RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://evil.example/" aria-href="https://www.remilia.net/">Open RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://evil.example/" href="https://www.remilia.net/">Open RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/" href="https://evil.example/">Open RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a>Open RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href=https://www.remilia.net/>Open RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href=https://evil.example/ href="https://www.remilia.net/">Open RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a HREF=https://evil.example/ href="https://www.remilia.net/">Open RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/" href=https://evil.example/>Open RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">open remilianet</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">OPEN REMILIANET</a>'],
    ["retired browser-session UI", `<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a title='fake href="https://www.remilia.net/"'>Open RemiliaNET</a>`],
    ["retired browser-session UI", `<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a title="fake href='https://www.remilia.net/'">Open RemiliaNET</a>`],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open <span>RemiliaNET</span></a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#32;RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&ensp;RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&emsp;RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&thinsp;RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&MediumSpace;RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&VeryThinSpace;RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&zwj; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&zwnj; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&NoBreak; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&InvisibleTimes; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#x200D; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#x200C; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#x2060; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#x2062; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#8290; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&shy; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#xAD; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open\u00ad RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#xFE0F; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open\ufe0f RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#x115F; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#x3164; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#x180B; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open\u180b RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open&#xFFF9; RemiliaNET</a>'],
    ["retired browser-session UI", '<span>Remilia Chat authorization is required</span><button data-chat-action="retry-connection">Reconnect Chat</button><a href="https://www.remilia.net/">Open\ufff9 RemiliaNET</a>'],
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
  for (const [archive, entry] of [["source.zip", "src/fixture.js"], ["built.zip", "background.js"]]) {
    for (const malformed of [
      "Open&#x110000;RemiliaNET",
      "Open&#55296;RemiliaNET",
      "Open&#999999999;RemiliaNET",
      "Open&#x20RemiliaNET",
      "Open&#;RemiliaNET",
    ]) {
      assert.throws(
        () => scanContent(archive, entry, Buffer.from(`<a href="https://www.remilia.net/">${malformed}</a>`)),
        /malformed anchor text detected/,
      );
    }
    scanContent(archive, entry, Buffer.from('<a href="https://example.com/">Other&#32;label</a>'));
    scanContent(archive, entry, Buffer.from('<a href="https://www.remilia.net/">Open λ RemiliaNET reference</a>'));
  }

  const reviewedRuntimeRejections = [
    ["ort/ort-wasm-evil.mjs", emscriptenEnvironment, /unreviewed runtime lookalike detected/],
    ["ort/ort-wasm-totally-unreviewed.mjs", emscriptenEnvironment, /unreviewed runtime lookalike detected/],
    ["ocr/core/tesseract-core-evil.js", emscriptenEnvironment, /unreviewed runtime lookalike detected/],
    ["ocr/core/tesseract-core-evil.wasm.js", emscriptenEnvironment, /unreviewed runtime lookalike detected/],
    ["worker.js", `${emscriptenEnvironment.slice(0, -2)}junk};`, /Linux machine path detected/],
    ["worker.js", `${emscriptenEnvironment.slice(0, -2)}+suffix};`, /Linux machine path detected/],
    ["worker.js", 'x.mkdir("/home");y.mkdir("/home/web_user")', /Linux machine path detected/],
    ["worker.js", 'var env={EVILUSER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user"};', /Linux machine path detected/],
    ["worker.js", 'var env={NOTUSER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user"};', /Linux machine path detected/],
    ["worker.js", '// {USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user"}', /Linux machine path detected/],
    ["worker.js", 'const fixture = \'{USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user"}\';', /Linux machine path detected/],
    ["worker.js", 'const fixture = `{USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user"}`;', /Linux machine path detected/],
  ];
  for (const [entry, value, expected] of reviewedRuntimeRejections) {
    assert.throws(
      () => scanContent("built.zip", entry, Buffer.from(value)),
      expected,
      `expected reviewed-runtime lookalike to fail in ${entry}`,
    );
  }
  assert.throws(
    () => scanContent("built.zip", "ort/ort-wasm-simd-threaded.jsep.mjs.bak", Buffer.from(emscriptenEnvironment)),
    /unreviewed runtime lookalike detected/,
  );
  assert.throws(
    () => scanContent("built.zip", "ORT/ort-wasm-evil.mjs", Buffer.from([0, 1, 2])),
    /unreviewed runtime lookalike detected/,
  );
  assert.throws(
    () => scanContent("built.zip", "OCR/core/tesseract-core-evil.wasm", Buffer.from([0, 1, 2])),
    /unreviewed runtime lookalike detected/,
  );
  for (const entry of [
    "assets/ort/ort-wasm-evil.mjs",
    "assets/ort/ort-wasm-simd-threaded.jsep.wasm",
    "assets/ocr/core/tesseract-core-evil.wasm",
  ]) {
    assert.throws(
      () => scanContent("built.zip", entry, Buffer.from([0, 1, 2])),
      /unreviewed runtime lookalike detected/,
    );
  }
  scanContent("built.zip", "worker.js", Buffer.from(`const fixture = \`${"${"}({USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user"})}\`;`));
  assert.throws(
    () => scanContent("built.zip", "worker.js", Buffer.from(`const fixture = \`${"${"}({USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user"})`)),
    /malformed JavaScript template nesting/,
  );

  const scalingToken = '({USER:"web_user",LOGNAME:"web_user",PATH:"/",PWD:"/",HOME:"/home/web_user"});';
  const smallScalingFixture = scalingToken.repeat(2_000);
  const largeScalingFixture = scalingToken.repeat(8_000);
  const smallStartedAt = performance.now();
  scanContent("built.zip", "worker.js", Buffer.from(smallScalingFixture));
  const smallElapsed = Math.max(performance.now() - smallStartedAt, 1);
  const largeStartedAt = performance.now();
  scanContent("built.zip", "worker.js", Buffer.from(largeScalingFixture));
  const largeElapsed = performance.now() - largeStartedAt;
  assert(
    largeElapsed < Math.max(2_000, smallElapsed * 12),
    `Emscripten path masking must remain near-linear (${smallElapsed.toFixed(1)}ms -> ${largeElapsed.toFixed(1)}ms)`,
  );

  const safeAnchor = '<a href="https://example.com/">Other label</a>';
  const smallAnchorFixture = safeAnchor.repeat(2_000);
  const largeAnchorFixture = safeAnchor.repeat(16_000);
  const smallAnchorStartedAt = performance.now();
  scanContent("built.zip", "background.js", Buffer.from(smallAnchorFixture));
  const smallAnchorElapsed = Math.max(performance.now() - smallAnchorStartedAt, 1);
  const largeAnchorStartedAt = performance.now();
  scanContent("built.zip", "background.js", Buffer.from(largeAnchorFixture));
  const largeAnchorElapsed = performance.now() - largeAnchorStartedAt;
  assert(
    largeAnchorElapsed < Math.max(3_000, smallAnchorElapsed * 16),
    `anchor normalization must remain near-linear (${smallAnchorElapsed.toFixed(1)}ms -> ${largeAnchorElapsed.toFixed(1)}ms)`,
  );
  assert.throws(
    () => scanContent("built.zip", "background.js", Buffer.from(safeAnchor.repeat(32_769))),
    /malformed anchor text detected/,
    "anchor normalization must fail closed at the global anchor cap",
  );

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
