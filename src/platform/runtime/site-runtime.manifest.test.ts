import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { APPROVED_RUNTIME_MATCHES } from "./site-runtime";

type RegistryApp = {
  id: string;
  siteScopes?: Array<{
    site: string;
    integration: string;
    fallback?: { mode?: string; note?: string };
  }>;
};

async function fixtures() {
  const [manifestSource, registrySource] = await Promise.all([
    readFile(new URL("../../../assets/extension/manifest.json", import.meta.url), "utf8"),
    readFile(new URL("../app-sdk/first-party-apps.json", import.meta.url), "utf8"),
  ]);
  return {
    manifest: JSON.parse(manifestSource) as { permissions?: string[]; content_scripts?: Array<{ js?: string[]; matches?: string[] }>; web_accessible_resources?: Array<{ matches?: string[] }> },
    registry: JSON.parse(registrySource) as RegistryApp[],
  };
}

function contentApps(registry: RegistryApp[], site: string): string[] {
  return registry
    .filter((app) => app.siteScopes?.some((scope) => scope.site === site && scope.integration === "contentScript"))
    .map((app) => app.id)
    .sort();
}

function backgroundApps(registry: RegistryApp[], site: string): string[] {
  return registry
    .filter((app) => app.siteScopes?.some((scope) => scope.site === site && scope.integration === "backgroundService"))
    .map((app) => app.id)
    .sort();
}

describe("multi-site manifest contract", () => {
  it("omits ambient browser-session and broad tab metadata permissions", async () => {
    const { manifest } = await fixtures();
    expect(manifest.permissions).not.toContain("cookies");
    expect(manifest.permissions).not.toContain("tabs");
    expect(manifest.permissions).toContain("activeTab");
    expect(manifest.permissions).toContain("scripting");
  });

  it("keeps executable and web-accessible matches aligned to the approved origins", async () => {
    const { manifest } = await fixtures();
    const runtime = manifest.content_scripts?.find((entry) => entry.js?.includes("content.js"));
    expect(runtime?.matches).toEqual(APPROVED_RUNTIME_MATCHES);
    for (const block of manifest.web_accessible_resources || []) {
      expect(block.matches).toEqual(APPROVED_RUNTIME_MATCHES);
    }
  });

  it("keeps RemiliaNET helpers separate from the shared UI content entry", async () => {
    const { manifest } = await fixtures();
    const bridge = manifest.content_scripts?.find((entry) => entry.js?.includes("reminetChatBridge.js"));
    const fastPath = manifest.content_scripts?.find((entry) => entry.js?.includes("reminetCraftFastPath.js"));
    expect(bridge?.matches).toEqual(["https://www.remilia.net/*"]);
    expect(fastPath?.matches).toEqual(["https://www.remilia.net/*"]);
  });

  it("keeps each non-X runtime limited to the accepted app set", async () => {
    const { registry } = await fixtures();
    expect(contentApps(registry, "x")).toEqual([
      "beetol",
      "composerTools",
      "linkBrowser",
      "miladychanSpotlight",
      "miladymaxxer",
      "music",
      "post-reading",
      "reminetChat",
      "remistats",
      "rootVisuals",
      "tweetPng",
      "wiki",
      "wikiSidebar",
    ]);
    expect(contentApps(registry, "remiliaNet")).toEqual([]);
    expect(backgroundApps(registry, "remiliaNet")).toEqual(["beetol", "reminetChat", "remistats"]);
    expect(contentApps(registry, "remiliaWiki")).toEqual(["post-reading"]);
    expect(contentApps(registry, "miladychan")).toEqual(["miladychanSpotlight"]);
  });

  it("requires explicit fallback disclosure on every non-X executable scope", async () => {
    const { registry } = await fixtures();
    const scopes = registry.flatMap((app) => (app.siteScopes || [])
      .filter((scope) => scope.site !== "x" && scope.integration === "contentScript")
      .map((scope) => ({ appId: app.id, ...scope })));
    expect(scopes).not.toHaveLength(0);
    for (const scope of scopes) {
      expect(scope.fallback?.mode, scope.appId).toMatch(/^(nativeSite|externalPage|none)$/);
      expect(scope.fallback?.note?.trim().length, scope.appId).toBeGreaterThan(0);
    }
  });
});
