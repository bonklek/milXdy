import { describe, expect, it } from "vitest";
import type { MilxdyAppManifest } from "../app-sdk/app-platform";
import { eligibleContextualPostActions } from "./contextual-post-actions";

function shareKit(overrides: Partial<MilxdyAppManifest> = {}): MilxdyAppManifest {
  return {
    id: "tweetPng",
    name: "Share Kit",
    version: "0.2.4",
    description: "fixture",
    contentEntry: "local-apps/tweetPng/dist/content.js",
    defaultEnabled: true,
    storageKeys: { local: ["milxdy.shareKit.enabled", "milxdy.settings.visualTheme"] },
    surfaces: [],
    cost: { startup: "moderate", perSurface: "cheap", network: "none", worker: "none", domWrite: "large" },
    loadTriggers: ["userAction"],
    package: {},
    isEnabled: async () => true,
    contextualPostActions: [{ id: "reviewPng", label: "Review with Share Kit", placement: "shareMenu" }],
    ...overrides,
  };
}

describe("contextual replacement eligibility", () => {
  it("offers the migrated action after upgrade when the stable package id is enabled", () => {
    expect(eligibleContextualPostActions([shareKit()], new Set(["tweetPng"]))).toHaveLength(1);
  });

  it("keeps a disabled package out of the share menu without touching declared settings", () => {
    const app = shareKit();
    expect(eligibleContextualPostActions([app], new Set())).toEqual([]);
    expect(app.storageKeys.local).toContain("milxdy.settings.visualTheme");
  });

  it("does not expose a broken fallback action when the package is absent", () => {
    expect(eligibleContextualPostActions([shareKit({ available: false, contextualPostActions: undefined })], new Set(["tweetPng"]))).toEqual([]);
  });

  it("suppresses an old/new duplicate with the same stable action identity", () => {
    const first = shareKit();
    const duplicate = shareKit({ name: "Legacy Tweet PNG" });
    expect(eligibleContextualPostActions([first, duplicate], new Set(["tweetPng"]))).toHaveLength(1);
  });
});
