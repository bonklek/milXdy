import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("Post-Factory reviewed maker handoff", () => {
  it("keeps source and built package callbacks on the same result-aware random path", async () => {
    const [source, built] = await Promise.all([
      read("../../../examples/packages/local-dev/tweet-composer-kit/src/content.js"),
      read("../../../examples/packages/local-dev/tweet-composer-kit/dist/content.js"),
    ]);

    for (const packageCode of [source, built]) {
      expect(packageCode).toContain("const mode = random.checked ||");
      expect(packageCode).toMatch(/!topInput\.value\.trim\(\) && !bottomInput\.value\.trim\(\)\)? \? "randomMeme" : "captioned"/u);
      expect(packageCode).toContain("const { ok, error } = await launchExternalHandoff(maker.handoffId");
      expect(packageCode).toContain("could not generate an image");
      expect(packageCode).toContain("added the generated image to the active composer");
    }
  });

  it("retains exact declarations, sender checks, page execution, result validation, and composer insertion", async () => {
    const [manifestText, contentRuntime, background, pageAdapter] = await Promise.all([
      read("../../../examples/packages/local-dev/tweet-composer-kit/milxdy.app.json"),
      read("../../platform/runtime/content-runtime.ts"),
      read("./index.ts"),
      read("./external-handoff-page-adapters.ts"),
    ]);
    const manifest = JSON.parse(manifestText) as {
      externalHandoffs: Array<{ adapter: string; target: string; modes: string[] }>;
      permissions: { hosts: string[] };
      background?: { messageTypes?: string[] };
    };

    expect(manifest.externalHandoffs.filter((handoff) => handoff.adapter === "remilia-maker"))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ target: "milady", modes: ["captioned", "randomMeme"] }),
        expect.objectContaining({ target: "remilio", modes: ["captioned", "randomMeme"] }),
        expect.objectContaining({ target: "bonkler", modes: ["captioned", "randomMeme"] }),
        expect.objectContaining({ target: "kagami", modes: ["captioned", "randomMeme"] }),
      ]));
    expect(manifest.permissions.hosts).toEqual([
      "https://maker.remilia.org/*",
      "https://remibooru.com/*",
      "https://cult.inc/*",
    ]);
    expect(manifest.background?.messageTypes || []).not.toContain("milxdy:externalHandoff");

    expect(contentRuntime).toContain("if (!navigator.userActivation?.isActive)");
    expect(contentRuntime).toContain('(app.externalHandoffs || []).find((candidate) => candidate.id === id)');
    expect(contentRuntime).toContain('type: "milxdy:externalHandoff"');
    expect(contentRuntime).toContain('await attachImageToComposer(composerScope, response.imageDataUrl, "remilia-maker.png")');

    expect(background).toContain('type: "milxdy:externalHandoff"');
    expect(background).toContain("if (!isXContentScriptSender(sender)) return unsupportedSender()");
    expect(background).toContain("declaration.adapter !== message.adapter || declaration.target !== message.target");
    expect(background).toContain("const targetUrl = externalHandoffUrl(message.adapter, message.target)");
    expect(background).toContain("chrome.tabs.create({ url: targetUrl.href, active: false })");
    expect(background).toContain('world: "MAIN"');
    expect(background).toContain("if (!isSafeMakerImageDataUrl(result.imageDataUrl))");
    expect(background).toContain("await chrome.tabs.remove(generatedMakerTabId).catch(() => undefined)");
    expect(background).toContain('error: "The maker image could not be generated."');

    expect(pageAdapter).toContain('document.querySelector<HTMLInputElement>("#tokenIDDisplay")');
    expect(pageAdapter).toContain("selectedTokenId !== previousTokenId");
    expect(pageAdapter).toContain("tokenInput.value.trim()");
    expect(pageAdapter).toContain("display?.currentlyDisplaying === false");
    expect(pageAdapter).toContain("await display.drawSelectedLayers(false, true)");
  });
});
