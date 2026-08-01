import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("RemiNet crafting and Last read helpers", () => {
  it("drives Remilia's registered React DnD manager at the target slot centre", async () => {
    const source = await readFile(new URL("./reminet-craft-fast-path.ts", import.meta.url), "utf8");

    expect(source).toContain("crafting-module__smash-input-slots");
    expect(source).toContain("destination.getBoundingClientRect()");
    expect(source).toContain("item.getBoundingClientRect()");
    expect(source).toContain("function handlerIdFor");
    expect(source).toContain("function dndManagerFor");
    expect(source).toContain('handlerIdFor(item, "S")');
    expect(source).toContain('handlerIdFor(destination, "T")');
    expect(source).toContain("actions.beginDrag([sourceId]");
    expect(source).toContain("actions.hover([targetId]");
    expect(source).toContain("actions.drop()");
    expect(source).toContain("actions.endDrag()");
    expect(source).toContain("data-milxdy-reminet-craft-placement");
    expect(source).toContain('status("dropped")');
    expect(source).toContain("if (!placeCraftingItem(item)) click(item)");
    expect(source).toContain("crafting-module__input-slot--5");
    expect(source).toContain("nextCraftingReplacementSlot");
    expect(source).toContain("function nextAssemblySlot");
    expect(source).toContain("slots.find(isEmptySlot)");
    expect(source).toContain("(next + 1) % slots.length");
    expect(source).toContain("top: .2rem; right: .2rem");
    expect(source).toContain("border-radius: 0");
    expect(source).not.toContain("transform: translate(100%, -50%)");
    expect(source).toContain("document.addEventListener(\"click\"");
    expect(source).not.toContain("new DragEvent");
    expect(source).not.toContain("new MouseEvent");
    expect(source).not.toContain("/api/beetle/action/craft");
  });

  it("keeps Last read and Jump to present dismissal local to the current document", async () => {
    const source = await readFile(new URL("./reminet-craft-fast-path.ts", import.meta.url), "utf8");

    expect(source).toContain("dismissedChatPositionMarkers");
    expect(source).toContain("Dismiss chat position marker");
    expect(source).toContain("message-list__jump-to-last-read");
    expect(source).toContain("message-list__jump-to-present");
    expect(source).toContain("milxdy-last-read-marker--dismissed");
    expect(source).not.toContain("marker.remove()");
    expect(source).not.toContain("chrome.storage");
    expect(source).not.toContain("fetch(");
  });
});
