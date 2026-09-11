import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const packageRoot = "examples/packages/local-dev/tweet-composer-kit";

describe("Post-Factory Remibooru closeout copy", () => {
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

  it("uses one explicit public publish action with an honest native fallback", async () => {
    const source = await readFile(`${packageRoot}/src/content.js`, "utf8");
    const manifestSource = await readFile(`${packageRoot}/milxdy.app.json`, "utf8");
    const runtime = await readFile("src/platform/runtime/content-runtime.ts", "utf8");
    const contextFlow = await readFile("src/platform/runtime/context-media-action-panel.ts", "utf8");

    expect(source).toContain("Publish to public Remibooru");
    expect(source).toContain('textContent: "Publish to Remibooru"');
    expect(source).toContain('href: "https://remibooru.com/upload"');
    expect(source).toContain('textContent: "Open native uploader"');
    expect(source).toContain('textContent: "Public destination: remibooru.com"');
    expect(source).toContain("let published = false");
    expect(source).toContain("published = true");
    expect(source).toContain("publishing || published || tags.length === 0");
    expect(source).not.toMatch(/right(?:s)? to contribute/iu);
    expect(manifestSource).not.toMatch(/rights acknowledgement|rights confirmation/iu);
    expect(runtime).not.toContain("Confirm that you have the right");
    expect(contextFlow).toContain('type: "milxdy:mediaContributionSubmit"');
    expect(contextFlow).toContain("Open Remibooru's native uploader");
    expect(contextFlow.indexOf("document.body.append(panel)")).toBeLessThan(contextFlow.indexOf('type: "milxdy:contextMediaPrepare"'));
  });

  it("declares only the reviewed contribution adapter and its required remote privacy boundary", async () => {
    const manifest = JSON.parse(await readFile(`${packageRoot}/milxdy.app.json`, "utf8"));
    const contributions = manifest.mediaContributions.filter((entry: { adapter?: string }) => entry.adapter === "remibooru");

    expect(contributions).toEqual([{
      id: "remibooru-contribute",
      label: "Contribute to Remibooru",
      adapter: "remibooru",
      contextMediaActionId: "remibooru-contribute",
      maxTags: 12,
      maxTagLength: 64,
    }]);
    expect(manifest.permissions.hosts.filter((host: string) => host === "https://remibooru.com/*")).toHaveLength(1);
    expect(manifest.privacy.privacyLabels).toContain("remote-api");
    expect(manifest.privacy.consentRequired).toBe(true);
    expect(manifest.privacy.remoteServices.join(" ")).toContain("Remibooru");
  });
});
