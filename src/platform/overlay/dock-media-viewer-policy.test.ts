import { describe, expect, it } from "vitest";
import { isHostMediaViewerPath } from "./dock-view";

describe("dock host media viewer policy", () => {
  it("recognizes X photo viewer paths without hiding ordinary routes", () => {
    expect(isHostMediaViewerPath("/bonklek/status/123/photo/1")).toBe(true);
    expect(isHostMediaViewerPath("/bonklek/status/123/photo/2?tagged=1")).toBe(true);
    expect(isHostMediaViewerPath("/bonklek/status/123")).toBe(false);
  });
});
