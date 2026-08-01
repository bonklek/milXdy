import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const packageRoot = "examples/packages/local-dev/tweet-composer-kit";

describe("Composer Kit Remibooru closeout copy", () => {
  it("describes explicit attachment and canonical opening without auto-posting", async () => {
    const source = await readFile(`${packageRoot}/src/content.js`, "utf8");
    const catalog = await readFile("catalog/data/catalog.json", "utf8");
    const inventory = await readFile("docs/contributors/ADD_ONS_CATALOG_INVENTORY.md", "utf8");

    expect(source).toContain("Click a thumbnail to attach it; double-click to open its canonical post.");
    expect(source).toContain("Thumbnail attached to the composer. It has not been posted.");
    expect(catalog).toContain("explicitly attach a sanitized thumbnail to the initiating composer");
    expect(inventory).toContain("explicit host-owned thumbnail attachment action");
  });

  it("records the rejected link-cache prototype and bounded no-cache replacement", async () => {
    const log = await readFile(`${packageRoot}/AUTHORING_LOG.md`, "utf8");
    const manifest = JSON.parse(await readFile(`${packageRoot}/milxdy.app.json`, "utf8"));
    const query = manifest.remoteQueries.find((entry: { id?: string }) => entry.id === "remibooru-reactions");

    expect(log).toContain("link-only X-post cache prototype was evaluated and rejected");
    expect(log).toContain("bounded, no-cache Remibooru queries");
    expect(log).toMatch(/It is deferred, not\s+partially shipped under #17\./);
    expect(query.cache).toEqual({ policy: "none" });
    expect(query.resultActions).toContain("attachToInitiatingComposer");
  });
});
