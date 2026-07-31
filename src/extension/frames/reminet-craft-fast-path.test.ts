import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("RemiNet crafting and Last read helpers", () => {
  it("drives the registered local placement path at the target slot centre", async () => {
    const source = await readFile(new URL("./reminet-craft-fast-path.ts", import.meta.url), "utf8");

    expect(source).toContain("crafting-module__smash-input-slots");
    expect(source).toContain("isEmptySlot(destination)");
    expect(source).toContain("destination.getBoundingClientRect()");
    expect(source).toContain("clientX");
    expect(source).toContain("clientY");
    expect(source).toContain("crafting-module__input-slot--5");
    expect(source).toContain("document.addEventListener(\"click\"");
    expect(source).toContain("new DragEvent");
    expect(source).not.toContain("/api/beetle/action/craft");
  });

  it("keeps Last read dismissal local to the current document", async () => {
    const source = await readFile(new URL("./reminet-craft-fast-path.ts", import.meta.url), "utf8");

    expect(source).toContain("lastReadDismissedForDocument");
    expect(source).toContain("Dismiss Last read marker");
    expect(source).toContain("message-list__jump-to-last-read");
    expect(source).toContain("marker.remove()");
    expect(source).not.toContain("chrome.storage");
    expect(source).not.toContain("fetch(");
  });
});
