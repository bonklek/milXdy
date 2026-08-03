import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("composer companion icon parity", () => {
  it("gives Drafts a tight, centered footprint alongside the Factory icon", async () => {
    const source = await readFile(new URL("./content-runtime.ts", import.meta.url), "utf8");
    const draftsStyle = source.match(/\.milxdy-composer-drafts-icon \{[^}]+\}/u)?.[0] || "";

    expect(source).toContain('svg.setAttribute("viewBox", "3 2 18 20")');
    expect(draftsStyle).toContain("width: 20px; height: 20px; margin: 0;");
    expect(draftsStyle).toContain("stroke: currentColor; stroke-width: 1.8;");
    expect(draftsStyle).not.toContain("translateY");
  });

  it("labels the companion controls as Factory and Drafts without renaming the app", async () => {
    const manifest = JSON.parse(await readFile(
      new URL("../../../examples/packages/local-dev/tweet-composer-kit/milxdy.app.json", import.meta.url),
      "utf8",
    )) as { name?: string; composerAction?: { label?: string }; hostComposerActions?: string[] };

    expect(manifest.name).toBe("Post-Factory");
    expect(manifest.composerAction?.label).toBe("Factory");
    expect(manifest.hostComposerActions).toContain("nativeDrafts");
  });
});
