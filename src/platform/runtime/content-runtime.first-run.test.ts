import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("first-run Apps & Features invocation", () => {
  it("keeps the first-run choice persistent without surprise-opening the Hub", async () => {
    const source = await readFile(new URL("./content-runtime.ts", import.meta.url), "utf8");

    expect(source).not.toContain("maybeOpenFirstRunHub");
    expect(source).toContain('void safeLocalSet({ [FIRST_RUN_STATUS_KEY]: status });');
    expect(source).toContain('skip.addEventListener("click", () => completeFirstRun("skipped"))');
  });
});
