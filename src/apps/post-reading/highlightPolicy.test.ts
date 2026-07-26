import { describe, expect, it } from "vitest";
import { isSmoothHighlightDiscontinuity, resolveContinuousHighlightMode } from "./highlightPolicy";

describe("continuous Post-reading highlighting", () => {
  it("keeps normal smooth text on one continuous renderer", () => {
    expect(resolveContinuousHighlightMode("smooth", "balanced", 1200, 180)).toEqual({
      mode: "smooth",
      reason: "configured",
    });
  });

  it("keeps an explicit smooth selection for long text and fast mode", () => {
    expect(resolveContinuousHighlightMode("smooth", "fast", 1600, 220).mode).toBe("smooth");
    expect(resolveContinuousHighlightMode("smooth", "quality", 23_000, 3_000).mode).toBe("smooth");
  });

  it("preserves explicit word and off selections", () => {
    expect(resolveContinuousHighlightMode("word", "quality", 200, 30).mode).toBe("word");
    expect(resolveContinuousHighlightMode("off", "fast", 200, 30).mode).toBe("off");
  });

  it("does not reset completed fill for a contiguous transport chunk handoff", () => {
    expect(isSmoothHighlightDiscontinuity(1180, 1200, 13, true)).toBe(false);
  });

  it("still resets for backward and non-transport jumps", () => {
    expect(isSmoothHighlightDiscontinuity(400, 120, 13, false)).toBe(true);
    expect(isSmoothHighlightDiscontinuity(100, 300, 13, false)).toBe(true);
  });
});
