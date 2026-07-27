import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./styles.ts", import.meta.url), "utf8");

describe("Post-reading Smooth Fill stylesheet", () => {
  it("uses the v0.2 background transition contract without typed fill registration", () => {
    expect(source).toContain("transition: background var(--post-reading-fill-duration) linear");
    expect(source).not.toContain("@property --post-reading-fill");
    expect(source).not.toContain("transition: --post-reading-fill");
  });
});
