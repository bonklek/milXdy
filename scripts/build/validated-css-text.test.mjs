import { strict as assert } from "node:assert";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { validateCssText, validatedCssTextPlugin } from "./validated-css-text.mjs";

test("valid scoped CSS is preserved byte for byte", async () => {
  const css = 'article[data-testid="tweet"] :has(time) > div { display: contents !important; }';
  assert.equal(await validateCssText(css, "fixture.css"), css);
});
test("template source and malformed CSS cannot enter a build as opaque text", async () => {
  for (const css of ['${header}:has(time) > div {display:contents!important}', 'const header = `article`;', 'article { color: red;']) {
    await assert.rejects(validateCssText(css, "fixture.css"), /unevaluated JavaScript|invalid stylesheet/);
  }
});
test("the esbuild plugin rejects corrupted imports and preserves valid text imports", async () => {
  const dir = await mkdtemp(join(tmpdir(), "validated-css-"));
  try {
    const path = join(dir, "theme.css");
    const options = { stdin: { contents: 'import css from "./theme.css"; console.log(css);', resolveDir: dir }, bundle: true, write: false, logLevel: "silent", plugins: [validatedCssTextPlugin()] };
    await writeFile(path, '${header}:has(time) > div {display:contents!important}');
    await assert.rejects(build(options), /unevaluated JavaScript/);
    await writeFile(path, 'article { color: red; }');
    assert.match((await build(options)).outputFiles[0].text, /article \{ color: red; \}/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
