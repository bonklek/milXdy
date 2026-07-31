import { describe, expect, it } from "vitest";
import { shouldUseComposerSurface } from "./content";

describe("composer tools surface policy", () => {
  it("supports ordinary post composers", () => {
    expect(shouldUseComposerSurface({ hasSupportedMarker: true, isDmComposer: false, targetIsExcluded: false })).toBe(true);
  });

  it("supports explicit DM composer markers even when X renders them as an input-like editor", () => {
    expect(shouldUseComposerSurface({ hasSupportedMarker: true, isDmComposer: true, targetIsExcluded: true })).toBe(true);
  });

  it("continues to exclude ordinary inputs and search fields", () => {
    expect(shouldUseComposerSurface({ hasSupportedMarker: false, isDmComposer: false, targetIsExcluded: true })).toBe(false);
  });
});
