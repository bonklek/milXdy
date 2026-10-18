import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Beetol read-only panel audio", () => {
  it("retains neutral panel feedback without action-success or crunch effects", async () => {
    const source = await readFile(new URL("./content.js", import.meta.url), "utf8");

    expect(source).toContain("function playDefaultActionSound()");
    expect(source).toContain("playDefaultActionSound();");
    expect(source).not.toContain("playSuccessfulActionSound");
    expect(source).not.toContain("playCrunchCompleteSound");
    expect(source).not.toContain("ticket-crunch-cell.wav");
  });
});
