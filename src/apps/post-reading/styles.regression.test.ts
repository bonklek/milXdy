import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./styles.ts", import.meta.url), "utf8");

describe("Post-reading Smooth Fill stylesheet", () => {
  it("leaves fill timing to the single JavaScript cursor without typed fill registration", () => {
    expect(source).toContain("transition: none");
    expect(source).not.toContain("@property --post-reading-fill");
    expect(source).not.toContain("transition: --post-reading-fill");
  });
});
