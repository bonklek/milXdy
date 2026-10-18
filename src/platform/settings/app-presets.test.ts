import { afterEach, describe, expect, it, vi } from "vitest";
import { FIRST_PARTY_APPS } from "../app-sdk/first-party-registry";
import { VISUAL_THEME_KEY, VISUAL_PRESETS } from "../visuals/reskin-profile";
import { buildAppPresetTargets, createAppPresetService } from "./app-presets";
import { createPresetQueue, planPreset, type PresetStorage } from "./preset-transaction";

const ui = vi.hoisted(() => ({ review: vi.fn(async () => "apply"), result: vi.fn<(...args: any[]) => void>() }));
vi.mock("./preset-review", () => ({ reviewPreset: ui.review, showPresetResult: ui.result, chooseSavedPreset: vi.fn() }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });
function realStorage() {
  const values: Record<string, Record<string, unknown>> = { local: { [VISUAL_THEME_KEY]: { ...VISUAL_PRESETS.moderate, disableMaxxer: true }, "remiliaWikiHyperlink.settings": { linkColor: "#123456", enabled: false, sidebarEnabled: true } }, sync: { mode: "off", unrelated: "kept" } };
  const storage = Object.fromEntries(["local", "sync"].map(area => [area, {
    get: async (keys: string[] | string | Record<string, unknown>) => {
      if (typeof keys === "string") return Object.hasOwn(values[area], keys) ? { [keys]: structuredClone(values[area][keys]) } : {};
      const list = Array.isArray(keys) ? keys : Object.keys(keys);
      return { ...(!Array.isArray(keys) ? keys : {}), ...Object.fromEntries(list.filter(key => Object.hasOwn(values[area], key)).map(key => [key, structuredClone(values[area][key])])) };
    },
    set: async (patch: Record<string, unknown>) => { Object.assign(values[area], structuredClone(patch)); },
    remove: async (keys: string[]) => { keys.forEach(key => delete values[area][key]); },
  }])) as PresetStorage;
  vi.stubGlobal("chrome", { storage }); return { values, storage };
}
describe("actual registry preset convergence", () => {
  it("applies full and lite with shared wiki keys and Maxxer visual-disable state", async () => {
    const { storage, values } = realStorage(); const run = createPresetQueue(storage);
    const apps = FIRST_PARTY_APPS.filter(app => app.available !== false && app.setEnabled);
    for (const preset of ["full", "lite"] as const) {
      const result = await run({ kind: "Apps", build: async () => planPreset(storage, await buildAppPresetTargets(storage, apps, preset, () => false)), review: async () => "apply", verify: async () => {
        for (const app of apps) expect(await app.isEnabled(), app.id).toBe(app.hub?.presets.includes(preset) === true);
      } });
      expect(result.status).toBe("applied");
    }
    expect((values.local["remiliaWikiHyperlink.settings"] as Record<string, unknown>).linkColor).toBe("#123456");
    expect(values.sync.unrelated).toBe("kept");
  });
  it("keeps performance-blocked apps off and their rail pins absent", async () => {
    const { storage } = realStorage();
    const apps = FIRST_PARTY_APPS.filter(app => app.available !== false && app.setEnabled);
    const targets = await buildAppPresetTargets(storage, apps, "full", app => app.id === "music");
    const music = targets.find(t => t.key === "milxdy.music.enabled"); expect(music?.value.value).toBe(false);
    expect(targets.find(t => t.key === "milxdy.apps.railPinned")?.value.value).not.toContain("music");
  });
});


it("rolls back and reports incomplete app recovery if reconciliation fails", async () => {
  const { storage, values } = realStorage();
  const service = createAppPresetService({ storage, apps: () => FIRST_PARTY_APPS.filter(app => app.available !== false && app.setEnabled), blocked: () => false,
    active: () => true, parent: () => ({} as HTMLElement), refresh: async () => { throw new Error("runtime refresh failure"); } });
  await service.apply("full");
  expect(values.local["milxdy.performance.mode"]).toBeUndefined();
  const result = ui.result.mock.calls.at(-1)?.[0];
  expect(result).toMatchObject({ status: "failed", restored: false });
  expect(result.message).toContain("apps could not be restored"); expect(result.message).toContain("Reload this page");
});

it.each(["applied", "cancelled", "failed"] as const)("reports exact bounded preset targets and %s outcome", async outcome => {
  const { storage } = realStorage();
  const apps = FIRST_PARTY_APPS.filter(app => app.available !== false && app.setEnabled);
  const diagnostic = vi.fn();
  if (outcome === "cancelled") ui.review.mockResolvedValueOnce("cancel");
  let refreshes = 0;
  const service = createAppPresetService({ storage, apps: () => apps, blocked: app => app.id === "music", active: () => true,
    parent: () => ({} as HTMLElement), diagnostic, refresh: async () => { if (outcome === "failed" && ++refreshes === 1) throw new Error("activation failed"); } });
  await service.apply("full");
  const data = diagnostic.mock.calls[0]?.[0];
  const enabled = apps.filter(app => app.hub?.presets.includes("full") && app.id !== "music").map(app => app.id);
  const disabled = apps.filter(app => !enabled.includes(app.id)).map(app => app.id);
  expect(data).toEqual({ preset: "full", outcome, restored: outcome === "failed", enabledTargetApps: enabled, enabledTargetCount: enabled.length,
    disabledTargetApps: disabled, disabledTargetCount: disabled.length, blockedTargetApps: ["music"], blockedTargetCount: 1 });
  expect(JSON.stringify(data)).not.toContain("#123456");
});
