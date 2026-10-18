import { describe, expect, it } from "vitest";
import { reducedMotionHighlightMode } from "./content";

describe("Post-reading reduced motion", () => {
  it("uses static word highlighting when smooth highlighting is configured", () => {
    expect(reducedMotionHighlightMode("smooth", true)).toBe("word");
    expect(reducedMotionHighlightMode("smooth", false)).toBe("smooth");
    expect(reducedMotionHighlightMode("off", true)).toBe("off");
  });
});
