import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFile(new URL(path, import.meta.url), "utf8");

describe("Post-Factory reviewed maker handoff", () => {
  it("keeps source and built package callbacks on the same explicit selection path", async () => {
    const [source, built] = await Promise.all([
      read("../../../packages/maintainer/tweet-composer-kit/src/content.js"),
      read("../../../packages/maintainer/tweet-composer-kit/dist/content.js"),
    ]);

    for (const packageCode of [source, built]) {
      expect(packageCode).toContain("resolveMakerDispatch(selection, externalHandoffs)");
      expect(packageCode).toContain("Choose a maker and mode to generate.");
      expect(packageCode).toContain("const { ok, error } = await launchExternalHandoff(dispatch.handoffId");
      expect(packageCode).toContain("mode: dispatch.mode");
      expect(packageCode).not.toContain('|| (!topInput.value.trim() && !bottomInput.value.trim()) ? "randomMeme"');
      expect(packageCode).toContain('const verb = dispatch.handoffId === "cheeseworld-deepfry" ? "replace the composer image" : "generate an image"');
      expect(packageCode).toContain('const result = dispatch.handoffId === "cheeseworld-deepfry" ? "replaced the initiating composer image" : "added the generated image to the active composer"');
    }
  });

  it("retains exact declarations, sender checks, page execution, result validation, and composer insertion", async () => {
    const [manifestText, contentRuntime, composerServices, background, pageAdapter, tabLifecycle] = await Promise.all([
      read("../../../packages/maintainer/tweet-composer-kit/milxdy.app.json"),
      read("../../platform/runtime/content-runtime.ts"),
      read("../../platform/runtime/composer-action-panel.ts"),
      read("./index.ts"),
      read("./external-handoff-page-adapters.ts"),
      read("./external-handoff-tabs.ts"),
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

    expect(contentRuntime).toContain("createComposerActionServices({");
    expect(contentRuntime).toContain("safeRuntimeMessage<Result>(message)");
    expect(composerServices).toContain("if (!navigator.userActivation?.isActive)");
    expect(composerServices).toContain('(dependencies.app.externalHandoffs || []).find((candidate) => candidate.id === id)');
    expect(composerServices).toContain('if (mode !== "captioned" && mode !== "randomMeme")');
    expect(composerServices).not.toContain('options?.mode || "captioned"');
    expect(composerServices).toContain('type: "milxdy:externalHandoff"');
    expect(composerServices).toContain('await attachImageToComposer(dependencies, composerScope, response.imageDataUrl, "remilia-maker.png")');

    expect(background).toContain('type: "milxdy:externalHandoff"');
    expect(background).toContain("if (!isXContentScriptSender(sender)) return unsupportedSender()");
    expect(background).toContain("declaration.adapter !== message.adapter || declaration.target !== message.target");
    expect(background).toContain("const targetUrl = externalHandoffUrl(message.adapter, message.target)");
    expect(background).toContain("externalHandoffTabs.create(targetUrl.href)");
    expect(tabLifecycle).toContain("chrome.tabs.create({ url:url.href, active:false })");
    expect(background).toContain('world: "MAIN"');
    expect(background).toContain("if (!isSafeMakerImageDataUrl(result.imageDataUrl))");
    expect(background).toContain("await externalHandoffTabs.close(generatedMakerTabId).catch(() => undefined)");
    expect(tabLifecycle).toContain("await chrome.tabs.remove(id)");
    expect(background).toContain('error: "The maker image could not be generated."');

    expect(pageAdapter).toContain('document.querySelector<HTMLInputElement>("#tokenIDDisplay")');
    expect(pageAdapter).toContain("selectedTokenId !== previousTokenId");
    expect(pageAdapter).toContain("tokenInput.value.trim()");
    expect(pageAdapter).toContain("display?.currentlyDisplaying === false");
    expect(pageAdapter).toContain("await display.drawSelectedLayers(false, true)");
  });
});
