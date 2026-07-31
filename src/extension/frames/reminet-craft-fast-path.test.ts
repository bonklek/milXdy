import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("RemiNet crafting and Last read helpers", () => {
  it("drives the registered local mouse placement path at the target slot centre", async () => {
    const source = await readFile(new URL("./reminet-craft-fast-path.ts", import.meta.url), "utf8");

    expect(source).toContain("crafting-module__smash-input-slots");
    expect(source).toContain("isEmptySlot(destination)");
    expect(source).toContain("destination.getBoundingClientRect()");
    expect(source).toContain("item.getBoundingClientRect()");
    expect(source).toContain("clientX");
    expect(source).toContain("clientY");
    expect(source).toContain("new MouseEvent");
    expect(source).toContain('event("mousedown", item, sourceX, sourceY, 1)');
    expect(source).toContain('event("mousemove", destination, clientX, clientY, 1)');
    expect(source).toContain('event("mouseup", destination, clientX, clientY, 0)');
    expect(source).toContain("crafting-module__input-slot--5");
    expect(source).toContain("top: .2rem; right: .2rem");
    expect(source).not.toContain("transform: translate(100%, -50%)");
    expect(source).toContain("document.addEventListener(\"click\"");
    expect(source).not.toContain("new DragEvent");
    expect(source).not.toContain("/api/beetle/action/craft");
  });

  it("keeps Last read and Jump to present dismissal local to the current document", async () => {
    const source = await readFile(new URL("./reminet-craft-fast-path.ts", import.meta.url), "utf8");

    expect(source).toContain("dismissedChatPositionMarkers");
    expect(source).toContain("Dismiss chat position marker");
    expect(source).toContain("message-list__jump-to-last-read");
    expect(source).toContain("message-list__jump-to-present");
    expect(source).toContain("marker.remove()");
    expect(source).not.toContain("chrome.storage");
    expect(source).not.toContain("fetch(");
  });
});
