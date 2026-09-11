import { describe, expect, it } from "vitest";
import { createAppResetPlan, resetConfirmationMessage } from "./app-reset-plan";
import registry from "../app-sdk/first-party-apps.json";
import type { MilxdyAppManifest } from "../app-sdk/app-platform";

const base = (overrides: Record<string, unknown> = {}) => ({ id: "wiki", name: "Wiki", storageKeys: { local: [] }, settings: [], ...overrides }) as any;

describe("app reset planning", () => {
  it("preserves the bundled Wiki aliases, deny terms, later items and Maxxer handle lists", () => {
    const apps = registry as unknown as MilxdyAppManifest[];
    for (const id of ["wiki", "miladymaxxer"]) {
      const app = apps.find((candidate) => candidate.id === id)!;
      const plan = createAppResetPlan(app, apps);
      const authored = app.storageResources!.filter((resource) => resource.kind === "authoredData");
      expect(authored.length).toBeGreaterThan(0);
      for (const resource of authored) {
        expect(plan.preservedResources).toContainEqual(expect.objectContaining({ area: resource.area, key: resource.key }));
        expect(plan.localKeys).not.toContain(resource.key);
        expect(plan.syncKeys).not.toContain(resource.key);
      }
      expect(resetConfirmationMessage(app, plan)).toContain("preserved");
    }
  });
  it("keeps legacy setting defaults while preserving unrepresented declared keys", () => {
    const app = base({ storageKeys: { local: ["settings", "aliases"] }, settings: [{ id: "enabled", storage: { area: "local", key: "settings" }, defaultValue: true, reset: { behavior: "restoreDefault" } }] });
    const plan = createAppResetPlan(app, [app]);
    expect(plan.settingDefaults).toEqual([expect.objectContaining({ key: "settings", value: true })]);
    expect(plan.localKeys).toEqual([]);
    expect(plan.preservedResources).toEqual([expect.objectContaining({ key: "aliases", reason: "noDestructiveResetPolicy" })]);
  });

  it("derives authored warnings only after safe explicit reset planning", () => {
    const app = base({ storageKeys: { local: ["aliases"] }, storageResources: [{ area: "local", key: "aliases", kind: "authoredData", reset: "reset" }] });
    const plan = createAppResetPlan(app, [app]);
    expect(plan.localKeys).toEqual(["aliases"]);
    expect(resetConfirmationMessage(app, plan)).toContain("This also deletes saved app data you created.");
    const shared = createAppResetPlan(app, [app, base({ id: "other", storageKeys: { local: ["aliases"] } })]);
    expect(shared.localKeys).toEqual([]);
    expect(resetConfirmationMessage(app, shared)).not.toContain("deletes saved app data");
  });

  it("warns when an explicit authored setting is reset and skips missing defaults", () => {
    const app = base({
      storageKeys: { local: ["aliases"] },
      storageResources: [{ area: "local", key: "aliases", kind: "authoredData", reset: "reset" }],
      settings: [{ id: "aliases", storage: { area: "local", key: "aliases", property: "terms" }, reset: { behavior: "restoreDefault" } }],
    });
    const plan = createAppResetPlan(app, [app]);
    expect(plan.propertyDefaults).toEqual([]);
    expect(plan.skippedSettings).toEqual([expect.objectContaining({ reason: "missingDefaultValue" })]);

    app.settings[0].defaultValue = [];
    const resetPlan = createAppResetPlan(app, [app]);
    expect(resetConfirmationMessage(app, resetPlan)).toContain("This also deletes saved app data you created.");
  });
});
