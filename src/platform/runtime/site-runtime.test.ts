import { describe, expect, it } from "vitest";
import type { MilxdyAppManifest } from "../app-sdk/app-platform";
import {
  APPROVED_RUNTIME_MATCHES,
  appsForRuntimeSite,
  loadTriggersForApp,
  resolveRuntimeSite,
  routeScopeMatches,
  surfacesForApp,
} from "./site-runtime";

function location(value: string) {
  const url = new URL(value);
  return { protocol: url.protocol, hostname: url.hostname, origin: url.origin, pathname: url.pathname };
}

function app(overrides: Partial<MilxdyAppManifest> = {}): MilxdyAppManifest {
  return {
    id: "test",
    name: "Test",
    version: "1.0.0",
    description: "Test app",
    contentEntry: "features/test.js",
    defaultEnabled: true,
    storageKeys: {},
    surfaces: ["overlayApp"],
    siteScopes: [{
      site: "remiliaNet",
      hosts: ["https://www.remilia.net/*"],
      integration: "contentScript",
      surfaces: ["route", "overlayApp"],
      routes: [{ type: "prefix", path: "/chat", surface: "route" }],
      loadTriggers: ["dockOpen"],
      fallback: { mode: "nativeSite", url: "https://www.remilia.net/", note: "Use the native site." },
    }],
    cost: { startup: "cheap", perSurface: "cheap", network: "none", worker: "none", domWrite: "small" },
    loadTriggers: ["startup"],
    package: {},
    isEnabled: async () => true,
    ...overrides,
  };
}

describe("site runtime policy", () => {
  it("recognizes only the reviewed HTTPS origins", () => {
    expect(resolveRuntimeSite(location("https://x.com/home"))).toMatchObject({ id: "x", mode: "fullRail" });
    expect(resolveRuntimeSite(location("https://www.remilia.net/chat"))).toMatchObject({ id: "remiliaNet", mode: "appLauncher" });
    expect(resolveRuntimeSite(location("https://remilia.wiki/Test"))).toMatchObject({ id: "remiliaWiki", mode: "featureOnly" });
    expect(resolveRuntimeSite(location("https://boards.miladychan.org/milady/1"))).toMatchObject({ id: "miladychan", mode: "appLauncher" });
    expect(resolveRuntimeSite(location("https://remilia.net/"))).toBeNull();
    expect(resolveRuntimeSite(location("http://www.remilia.net/"))).toBeNull();
    expect(resolveRuntimeSite(location("https://related.remilia.net/"))).toBeNull();
  });

  it("keeps the manifest match list exact and least privilege", () => {
    expect(APPROVED_RUNTIME_MATCHES).toEqual([
      "https://x.com/*",
      "https://twitter.com/*",
      "https://www.remilia.net/*",
      "https://remilia.wiki/*",
      "https://wiki.remilia.org/*",
      "https://boards.miladychan.org/*",
    ]);
  });

  it("selects only explicit content-script scopes for the current site", () => {
    const site = resolveRuntimeSite(location("https://www.remilia.net/"));
    expect(site).not.toBeNull();
    const backgroundOnly = app({
      id: "background",
      siteScopes: [{ site: "remiliaNet", hosts: ["https://www.remilia.net/*"], integration: "backgroundService", surfaces: ["overlayApp"] }],
    });
    const xOnly = app({
      id: "x-only",
      siteScopes: [{ site: "x", hosts: ["https://x.com/*"], integration: "contentScript", surfaces: ["overlayApp"] }],
    });
    expect(appsForRuntimeSite([app(), backgroundOnly, xOnly], site!)).toHaveLength(1);
  });

  it("uses site-specific surfaces, triggers, and route patterns", () => {
    const site = resolveRuntimeSite(location("https://www.remilia.net/chat/42"))!;
    const scoped = app();
    expect(surfacesForApp(scoped, site)).toEqual(["route", "overlayApp"]);
    expect(loadTriggersForApp(scoped, site)).toEqual(["dockOpen"]);
    expect(routeScopeMatches(scoped, site, "/chat/42")).toBe(true);
    expect(routeScopeMatches(scoped, site, "/profile/42")).toBe(false);
  });
});
