import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { transform } from "esbuild";
describe("extracted production reskin stylesheet", () => {
  it("contains evaluated CSS rather than JavaScript template implementation", async () => {
    const css = readFileSync(resolve(process.cwd(), "src/platform/visuals/reskin.css"), "utf8");
    expect(css).not.toMatch(/\$\{|\b(?:export\s+const|const\s+\w+\s*=)|`/u);
    expect((await transform(css, { loader: "css" })).warnings).toEqual([]);
  });
});
