import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("composer action click lifecycle", () => {
  it("routes clicks through one stable capture listener rather than transient toolbar nodes", async () => {
    const source = await readFile(new URL("./content-runtime.ts", import.meta.url), "utf8");

    expect(source).toContain('document.addEventListener("click", onComposerActionClick, true)');
    expect(source).toContain('document.removeEventListener("click", onComposerActionClick, true)');
    expect(source).toContain('event.stopImmediatePropagation()');
    expect(source).not.toContain('button.addEventListener("click", (event) =>');
    expect(source).not.toContain('drafts.addEventListener("click"');
  });

  it("keeps toggle state on the composer owner when X replaces the button node", async () => {
    const source = await readFile(new URL("./content-runtime.ts", import.meta.url), "utf8");

    expect(source).toContain("milxdyComposerActionOwner");
    expect(source).toContain("activeComposerAction.ownerId === ownerId");
    expect(source).toContain("pendingComposerAction.ownerId === ownerId");
    expect(source).toContain("activeComposerAction.button = button");
    expect(source).toContain("pendingComposerAction.button = button");
  });

  it("opens package panels without waiting for optional package stylesheets", async () => {
    const source = await readFile(new URL("./content-runtime.ts", import.meta.url), "utf8");
    const openComposerAction = source.slice(
      source.indexOf("async function openComposerAction"),
      source.indexOf("function closeComposerActionPanel"),
    );

    expect(openComposerAction).toContain("void installComposerActionPackageStyles(app, shadow).catch");
    expect(openComposerAction).not.toContain("await installComposerActionPackageStyles(app, shadow)");
    expect(openComposerAction).toContain('fallback: "host-style"');
    expect(source).toContain("shadow.append(hostStyle)");
    expect(source).toContain("shadow.append(stylesheet)");
  });
});
