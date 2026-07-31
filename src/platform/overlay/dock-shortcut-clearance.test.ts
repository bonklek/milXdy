import { describe, expect, it } from "vitest";
import { calculateHostShortcutRailMaxHeight } from "./dock-view";

describe("dock host shortcut clearance", () => {
  it("caps the rail and its protruding scroll indicator above the earliest host shortcut", () => {
    expect(calculateHostShortcutRailMaxHeight(34, [596, 529])).toBe(465);
  });

  it("does not impose a dynamic cap when no shortcut is visible", () => {
    expect(calculateHostShortcutRailMaxHeight(34, [])).toBeNull();
  });

  it("collapses safely instead of returning a negative height", () => {
    expect(calculateHostShortcutRailMaxHeight(80, [70])).toBe(0);
  });
});
