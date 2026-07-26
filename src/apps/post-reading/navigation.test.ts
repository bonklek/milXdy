import { describe, expect, it } from "vitest";
import { findAdjacentLineStart, readableLineStarts } from "./navigation";

describe("Post-reading line navigation", () => {
  const text = "Author said \"First line.\n\nSecond line.\n\n  Third line.\"";

  it("finds non-empty readable line starts", () => {
    expect(readableLineStarts(text)).toEqual([0, 26, 42]);
  });

  it("moves forward to the next readable line", () => {
    expect(findAdjacentLineStart(text, 4, 1)).toBe(26);
    expect(findAdjacentLineStart(text, 26, 1)).toBe(42);
    expect(findAdjacentLineStart(text, 45, 1)).toBeNull();
  });

  it("moves backward to the previous readable line", () => {
    expect(findAdjacentLineStart(text, 45, -1)).toBe(26);
    expect(findAdjacentLineStart(text, 26, -1)).toBe(0);
    expect(findAdjacentLineStart(text, 4, -1)).toBeNull();
  });

  it("does not invent navigation boundaries for a single line", () => {
    expect(findAdjacentLineStart("One continuous line", 4, 1)).toBeNull();
  });
});
