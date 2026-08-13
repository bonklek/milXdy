import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("site-aware content bootstrap", () => {
  it("keeps X-only page services behind the X runtime boundary", async () => {
    const source = await readFile(new URL("./content-runtime.ts", import.meta.url), "utf8");
    for (const service of [
      "injectTweetScaffoldStyles();",
      "installComposerActionHost();",
      "installReplyActionHost();",
      "installContextualPostActionHost();",
      "installContextMediaActionHost();",
      "subscribeTwitterSurfaces(handleSurface)",
    ]) {
      expect(source).toContain(service);
    }
    expect(source).toContain("if (isXRuntime()) {");
    expect(source).toContain("if (isXRuntime()) state.unsubscribeSurfaces = subscribeTwitterSurfaces(handleSurface);");
    expect(source).toContain("if (!isXRuntime()) return;");
  });

  it("gives every loaded app the validated site context", async () => {
    const source = await readFile(new URL("./content-runtime.ts", import.meta.url), "utf8");
    expect(source).toContain("site: state.site");
    expect(source).toContain("routeScopeMatches(app, state.site, route.pathname)");
    expect(source).toContain("surfacesForApp(app, state.site)");
    expect(source).toContain("loadTriggersForApp(app, state.site)");
  });

  it("wires direct Wiki article reading without enabling top-level frame navigation interception", async () => {
    const source = await readFile(new URL("../../apps/wiki-sidebar/frameContent.ts", import.meta.url), "utf8");
    expect(source).toContain("WIKI_HOSTS.has(window.location.hostname.toLowerCase())");
    expect(source).toContain("bootWikiFrame(window.top !== window)");
    expect(source).toContain('document.dispatchEvent(new CustomEvent("post-reading:read-document"');
    expect(source).toContain('document.addEventListener("wikiSidebar:reader-highlight"');
    expect(source).toContain('chrome.storage.sync.get({ enabled: true })');
    expect(source).toContain("if (embedded) {");
    expect(source).toContain('document.addEventListener("click", handleWikiFrameClick, true)');
  });
});
