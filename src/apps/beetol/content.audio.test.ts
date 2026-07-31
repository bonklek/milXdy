import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Beetol crunch audio", () => {
  it("plays each junk-crunch cell at 80% of its original gain", async () => {
    const source = await readFile(new URL("./content.js", import.meta.url), "utf8");

    expect(source).toContain("const CRUNCH_CELL_GAIN = 0.624;");
    expect(source).toContain("gain.gain.value = CRUNCH_CELL_GAIN;");
    expect(0.78 * 0.8).toBeCloseTo(0.624);
  });
});
