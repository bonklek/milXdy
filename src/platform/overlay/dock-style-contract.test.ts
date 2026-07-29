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
      .toBe("58029b756625f68d8168e3135350ab7610a32590bee5cd5a955fc2fde2956085");
  });

  it.each([
    ".milxdy-overlay-dock-rail",
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
