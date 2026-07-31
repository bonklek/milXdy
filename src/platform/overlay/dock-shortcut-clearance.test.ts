import { describe, expect, it } from "vitest";
import { calculateHostShortcutRailMaxHeight, calculateReelViewportHeight, isStaticDockItem } from "./dock-view";

describe("dock host shortcut clearance", () => {
  it("caps the self-contained reel above the earliest host shortcut", () => {
    expect(calculateHostShortcutRailMaxHeight(34, [596, 529])).toBe(483);
  });

  it("does not impose a dynamic cap when no shortcut is visible", () => {
    expect(calculateHostShortcutRailMaxHeight(34, [])).toBeNull();
  });

  it("collapses safely instead of returning a negative height", () => {
    expect(calculateHostShortcutRailMaxHeight(80, [70])).toBe(0);
  });

  it("quantizes the reel viewport to whole 48px items and 4px gaps", () => {
    expect(calculateReelViewportHeight(484, 10)).toBe(360);
    expect(calculateReelViewportHeight(483, 10)).toBe(308);
    expect(calculateReelViewportHeight(999, 3)).toBe(152);
  });

  it("shows no partial reel item when there is not room for one", () => {
    expect(calculateReelViewportHeight(119, 10)).toBe(0);
  });

  it("keeps only Hide All and the four-dot Apps menu outside the reel", () => {
    expect(isStaticDockItem("milxdyHideAll")).toBe(true);
    expect(isStaticDockItem("milxdyHub")).toBe(true);
    expect(isStaticDockItem("reminet-chat")).toBe(false);
    expect(isStaticDockItem("milxdyAddOnsCatalog")).toBe(false);
  });
});
