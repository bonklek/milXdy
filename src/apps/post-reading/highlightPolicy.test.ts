import { describe, expect, it } from "vitest";
import { isSmoothHighlightDiscontinuity, resolveContinuousHighlightMode } from "./highlightPolicy";

describe("continuous Post-reading highlighting", () => {
  it("keeps normal smooth text on one continuous renderer", () => {
    expect(resolveContinuousHighlightMode("smooth", "balanced", 1200, 180)).toEqual({
      mode: "smooth",
      reason: "configured",
    });
  });

  it("falls back to word highlighting before smooth tokenization becomes excessive", () => {
    expect(resolveContinuousHighlightMode("smooth", "balanced", 1600, 220).mode).toBe("word");
    expect(resolveContinuousHighlightMode("smooth", "quality", 2300, 300).mode).toBe("word");
  });

  it("does not reset completed fill for a contiguous transport chunk handoff", () => {
    expect(isSmoothHighlightDiscontinuity(1180, 1200, 13, true)).toBe(false);
  });

  it("still resets for backward and non-transport jumps", () => {
    expect(isSmoothHighlightDiscontinuity(400, 120, 13, false)).toBe(true);
    expect(isSmoothHighlightDiscontinuity(100, 300, 13, false)).toBe(true);
  });
});
