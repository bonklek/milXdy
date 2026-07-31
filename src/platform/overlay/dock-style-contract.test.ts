import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { DOCK_ROOT_ID, DOCK_STYLE_ID } from "./dock-dom-contract";

const styles = readFileSync(new URL("./dock.css", import.meta.url), "utf8");

describe("dock DOM and style compatibility", () => {
  it("keeps the established root/style ids and exact cumulative stylesheet", () => {
    expect(DOCK_ROOT_ID).toBe("milxdy-overlay-dock-root");
    expect(DOCK_STYLE_ID).toBe("milxdy-overlay-dock-style");
    const runtimeStyles = `${styles.replace(/\r\n/g, "\n").replace(/\n$/, "")}\n  `;
    expect(createHash("sha256").update(runtimeStyles).digest("hex"))
      .toBe("8902245cd22be70e207523e9ec59283888ac7293ce5aee6ef5af78a3c0b06e79");
  });

  it("joins and centers the rail side controls", () => {
    expect(styles).toContain("margin: 0 0 -2px");
    expect(styles).toContain("place-items: center");
    expect(styles).toContain('.milxdy-overlay-dock-side-control[data-side="left"]::before');
    expect(styles).toContain('.milxdy-overlay-dock-side-control[data-side="right"]::before');
  });

  it("lets the right rail crop above X's floating shortcut controls", () => {
    expect(styles).toContain("--milxdy-dock-host-shortcut-max-height");
    expect(styles).toContain("overflow-y: auto");
  });

  it("uses a whole-item reel with buttons instead of a visible scrollbar", () => {
    expect(styles).toContain(".milxdy-overlay-dock-static");
    expect(styles).toContain(".milxdy-overlay-dock-reel-control");
    expect(styles).toContain("scroll-snap-type: y mandatory");
    expect(styles).toContain("scrollbar-width: none");
    expect(styles).toContain("milxdy-dock-reel-tile");
  });

  it.each([
    ".milxdy-overlay-dock-rail",
    ".milxdy-overlay-dock-static",
    ".milxdy-overlay-dock-reel-viewport",
    ".milxdy-overlay-dock-reel-control",
    ".milxdy-overlay-dock-side-controls",
    ".milxdy-overlay-dock-item",
    ".milxdy-overlay-dock-icon",
    ".milxdy-overlay-dock-badge",
    ".milxdy-overlay-dock-settings",
    "[data-reorder=\"true\"]",
    "[data-item-id=\"milxdyAddOnsCatalog\"]",
  ])("retains selector %s", (selector) => {
    expect(styles).toContain(selector);
  });
});
