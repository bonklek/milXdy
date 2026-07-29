import { describe, expect, it, vi } from "vitest";
import { dockItemIdAtPoint } from "./dock-dom-utils";

describe("dock hit testing", () => {
  it("uses pointer coordinates instead of the capture-retargeted event target", () => {
    const closest = vi.fn(() => ({ dataset: { itemId: "target" } }));
    const hitTest = vi.fn(() => ({ closest }) as unknown as HTMLElement);
    expect(dockItemIdAtPoint(hitTest, { clientX: 14, clientY: 28 })).toBe("target");
    expect(hitTest).toHaveBeenCalledWith(14, 28);
    expect(closest).toHaveBeenCalledWith("[data-item-id]");
  });

  it("returns null when no dock item occupies the pointer coordinates", () => {
    expect(dockItemIdAtPoint(() => null, { clientX: 0, clientY: 0 })).toBeNull();
  });
});
