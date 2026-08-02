import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  createCraftActivationController,
  createLocalChatMarkerDismissals,
  hammerSlotIsAvailable,
  keyboardPlacementRequested,
  nextAvailableCraftingSlot,
  sacrificeSlotIsAvailable,
} from "./reminet-craft-fast-path-logic";

function activationHarness(placeResult = true) {
  vi.useFakeTimers();
  const inspected: string[] = [];
  const placed: string[] = [];
  const controller = createCraftActivationController<string>({
    delayMs: 320,
    now: () => 1_000,
    schedule: (handler, delayMs) => setTimeout(handler, delayMs) as unknown as number,
    cancel: (timer) => clearTimeout(timer),
    inspect: (item) => inspected.push(item),
    place: (item) => {
      placed.push(item);
      return placeResult;
    },
  });
  return {
    controller,
    inspected,
    placed,
  };
}

describe("RemiNet crafting placement behavior", () => {
  it("delays one click for inspection and uses the second click only for placement", () => {
    const harness = activationHarness();
    expect(harness.controller.pointerDown("green")).toBe("inspection-pending");
    expect(harness.inspected).toEqual([]);
    expect(harness.placed).toEqual([]);

    vi.advanceTimersByTime(320);
    expect(harness.inspected).toEqual(["green"]);
    expect(harness.placed).toEqual([]);

    expect(harness.controller.pointerDown("hammer")).toBe("inspection-pending");
    expect(harness.controller.pointerDown("hammer")).toBe("placed");
    expect(harness.placed).toEqual(["hammer"]);
    expect(harness.inspected).toEqual(["green"]);
    vi.useRealTimers();
  });

  it("falls back to inspection when a double-click has no safe destination", () => {
    const harness = activationHarness(false);
    harness.controller.pointerDown("occupied-item");
    expect(harness.controller.pointerDown("occupied-item")).toBe("inspected");
    expect(harness.placed).toEqual(["occupied-item"]);
    expect(harness.inspected).toEqual(["occupied-item"]);
    vi.useRealTimers();
  });

  it("selects only an empty compatible slot and never replaces a full row", () => {
    expect(nextAvailableCraftingSlot(
      ["input1", "input2", "input3"],
      { input1: "green", input2: null, input3: "blue" },
    )).toBe("input2");
    expect(nextAvailableCraftingSlot(
      ["input1", "input2", "input3"],
      { input1: "green", input2: "red", input3: "blue" },
    )).toBeNull();
    expect(nextAvailableCraftingSlot([], { input1: null })).toBeNull();
  });

  it("does not replace occupied hammer or sacrifice slots", () => {
    expect(hammerSlotIsAvailable(null)).toBe(true);
    expect(hammerSlotIsAvailable("hammer_gold")).toBe(false);
    expect(sacrificeSlotIsAvailable(null)).toBe(true);
    expect(sacrificeSlotIsAvailable("green")).toBe(false);
  });

  it("offers Shift+Enter placement without consuming ordinary Enter or repeats", () => {
    expect(keyboardPlacementRequested({ key: "Enter", shiftKey: true, repeat: false })).toBe(true);
    expect(keyboardPlacementRequested({ key: "Enter", shiftKey: false, repeat: false })).toBe(false);
    expect(keyboardPlacementRequested({ key: " ", shiftKey: true, repeat: false })).toBe(false);
    expect(keyboardPlacementRequested({ key: "Enter", shiftKey: true, repeat: true })).toBe(false);

    const harness = activationHarness();
    expect(harness.controller.keyboardPlace("blue")).toBe("placed");
    expect(harness.placed).toEqual(["blue"]);
    expect(harness.inspected).toEqual([]);
    vi.useRealTimers();
  });

  it("never invokes a craft or submit action during inspection or placement", () => {
    const craft = vi.fn();
    const harness = activationHarness();
    harness.controller.pointerDown("item");
    harness.controller.pointerDown("item");
    expect(craft).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("removes only occupied material and hammer selections through native store actions", async () => {
    const source = await readFile(new URL("./reminet-craft-fast-path.ts", import.meta.url), "utf8");

    expect(source).toContain('document.addEventListener("contextmenu"');
    expect(source).toContain('typeof record.removeFromSlot === "function"');
    expect(source).toContain('typeof record.clearHammer === "function"');
    expect(source).toContain("if (!slotId || !store.craftingSlots[slotId]) return");
    expect(source).toContain("store.removeFromSlot(slotId)");
    expect(source).toContain("smashSlots[0] !== hammerSlot || !store.selectedHammer");
    expect(source).toContain("store.clearHammer()");
  });
});

describe("RemiNet chat marker dismissal", () => {
  it("persists locally across a marker remount without hiding messages", () => {
    const dismissals = createLocalChatMarkerDismissals();
    expect(dismissals.isDismissed("last-read")).toBe(false);
    dismissals.dismiss("last-read");
    expect(dismissals.isDismissed("last-read")).toBe(true);
    expect(dismissals.isDismissed("present")).toBe(false);
  });

  it("keeps dismissal document-local and free of network or storage mutation", async () => {
    const source = await readFile(new URL("./reminet-craft-fast-path.ts", import.meta.url), "utf8");
    expect(source).toContain("Dismiss chat position marker");
    expect(source).toContain(":hover .milxdy-last-read-dismiss");
    expect(source).toContain(":focus-within .milxdy-last-read-dismiss");
    expect(source).not.toContain("chrome.storage");
    expect(source).not.toContain("fetch(");
    expect(source).not.toContain("/api/beetle/action/craft");
  });
});
