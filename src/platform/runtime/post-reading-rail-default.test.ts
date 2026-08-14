import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { migratePostReadingRailDefault } from "./post-reading-rail-default";

function migrate(overrides: Partial<Parameters<typeof migratePostReadingRailDefault>[0]> = {}) {
  return migratePostReadingRailDefault({
    appId: "post-reading",
    enabled: true,
    available: true,
    hasDock: true,
    railSupported: true,
    railDefaultPinned: true,
    alreadyMigrated: false,
    pinnedAppIds: [],
    unpinnedAppIds: [],
    ...overrides,
  });
}

describe("Post-reading default rail migration", () => {
  it("keeps the built-in Post-reading enablement and rail defaults authoritative", async () => {
    const [registrySource, composerSource, enablementSource] = await Promise.all([
      readFile(new URL("../app-sdk/first-party-apps.json", import.meta.url), "utf8"),
      readFile(new URL("../../../scripts/packages/compose-local-app-packages.mjs", import.meta.url), "utf8"),
      readFile(new URL("../app-sdk/first-party-registry.ts", import.meta.url), "utf8"),
    ]);
    const registry = JSON.parse(registrySource) as Array<{
      id: string;
      defaultEnabled?: boolean;
      dock?: unknown;
      hub?: { rail?: { supported?: boolean; defaultPinned?: boolean } };
    }>;
    const postReading = registry.find((app) => app.id === "post-reading");

    expect(postReading?.defaultEnabled).toBe(true);
    expect(postReading?.dock).toBeTruthy();
    expect(postReading?.hub?.rail).toEqual({ supported: true, defaultPinned: true });
    expect(composerSource).toContain("manifest.hub = preserveFirstPartyRail(firstParty?.hub, manifest.hub);");
    expect(composerSource).toContain("else delete manifest.dock;");
    expect(enablementSource).toContain('return typeof value === "boolean" ? value : fallback;');
    expect(enablementSource).toContain('return enabledFromStoredValue(stored.enabled, defaultAppEnabled("post-reading"));');
  });

  it("pins Post-reading for fresh and existing enabled installations", () => {
    const fresh = migrate();
    const existing = migrate({
      pinnedAppIds: ["wikiSidebar"],
      unpinnedAppIds: ["post-reading", "composerTools"],
    });

    expect(fresh.changed).toBe(true);
    expect(fresh.migrated).toBe(true);
    expect([...fresh.pinnedAppIds]).toEqual(["post-reading"]);
    expect([...existing.pinnedAppIds]).toEqual(["wikiSidebar", "post-reading"]);
    expect([...existing.unpinnedAppIds]).toEqual(["composerTools"]);
  });

  it("preserves an explicit Post-reading disable for a later user enable", () => {
    const disabled = migrate({
      enabled: false,
      pinnedAppIds: ["wikiSidebar"],
      unpinnedAppIds: ["post-reading"],
    });

    expect(disabled.changed).toBe(false);
    expect(disabled.migrated).toBe(false);
    expect([...disabled.pinnedAppIds]).toEqual(["wikiSidebar"]);
    expect([...disabled.unpinnedAppIds]).toEqual(["post-reading"]);
  });

  it("runs once so a later explicit unpin remains user-owned", () => {
    const migrated = migrate({
      alreadyMigrated: true,
      pinnedAppIds: ["wikiSidebar"],
      unpinnedAppIds: ["post-reading"],
    });

    expect(migrated.changed).toBe(false);
    expect(migrated.migrated).toBe(true);
    expect([...migrated.pinnedAppIds]).toEqual(["wikiSidebar"]);
    expect([...migrated.unpinnedAppIds]).toEqual(["post-reading"]);
  });

  it("does not turn RemiliaNET Chat into a rail migration target", () => {
    const chat = migrate({ appId: "reminetChat", enabled: false });

    expect(chat.changed).toBe(false);
    expect(chat.migrated).toBe(false);
    expect(chat.pinnedAppIds.size).toBe(0);
  });
});
