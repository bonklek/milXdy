import { describe, expect, it, vi } from "vitest";
import { createPresetQueue, loadSavedPresets, planPreset, planSavedPreset, presetValue, SAVED_PRESETS_KEY, type PresetStorage, type PresetTarget } from "./preset-transaction";
import { presetPreviewLines } from "./preset-review";

function fixture(initial: { local?: Record<string, unknown>; sync?: Record<string, unknown> } = {}) {
  const values = { local: structuredClone(initial.local || {}), sync: structuredClone(initial.sync || {}) };
  let step = 0;
  const fail = new Set<number>();
  const storage = Object.fromEntries((["local", "sync"] as const).map(area => [area, {
    get: vi.fn(async (keys: string[]) => Object.fromEntries(keys.filter(key => Object.hasOwn(values[area], key)).map(key => [key, structuredClone(values[area][key])]))),
    set: vi.fn(async (next: Record<string, unknown>) => { if (fail.has(++step)) throw new Error("write failed"); Object.assign(values[area], structuredClone(next)); }),
    remove: vi.fn(async (keys: string[]) => { if (fail.has(++step)) throw new Error("remove failed"); keys.forEach(key => delete values[area][key]); }),
  }])) as unknown as PresetStorage;
  return { storage, values, fail };
}
const targets: PresetTarget[] = [
  { area: "local", key: "appearance", label: "Appearance", value: presetValue({ profile: "max", disableMaxxer: false }) },
  { area: "sync", key: "soundsEnabled", label: "RemiStats sounds", value: presetValue(true) },
];
const initial = { local: { appearance: { profile: "min", disableMaxxer: true }, unrelated: "kept" }, sync: { soundsEnabled: false, privateKey: "never copied" } };

describe("reviewed preset transaction", () => {
  it("cancel performs zero writes, including custom saves", async () => {
    const { storage, values } = fixture(initial);
    const result = await createPresetQueue(storage)({ kind: "Test", build: () => planPreset(storage, targets), review: async () => "cancel" });
    expect(result.status).toBe("cancelled"); expect(values).toEqual(initial);
    expect(storage.local.set).not.toHaveBeenCalled(); expect(storage.sync.set).not.toHaveBeenCalled();
  });
  it.each([1, 2])("restores exact original values after write-stage %s rejects", async stage => {
    const { storage, values, fail } = fixture(initial); fail.add(stage);
    const result = await createPresetQueue(storage)({ kind: "Test", build: () => planPreset(storage, targets), review: async () => "apply" });
    expect(result).toMatchObject({ status: "failed", restored: true }); expect(values).toEqual(initial);
  });
  it("restores missing keys by removing them and handles final verification failure", async () => {
    const { storage, values } = fixture({ local: { unrelated: "kept" } });
    const result = await createPresetQueue(storage)({ kind: "Test", build: () => planPreset(storage, targets), review: async () => "apply", verify: async () => { throw new Error("derived enablement mismatch"); } });
    expect(result.restored).toBe(true); expect(values).toEqual({ local: { unrelated: "kept" }, sync: {} });
  });
  it("reports incomplete recovery honestly and keeps the original safe settings available", async () => {
    const { storage, values, fail } = fixture(initial); fail.add(2); fail.add(3);
    const result = await createPresetQueue(storage)({ kind: "Test", build: () => planPreset(storage, targets), review: async () => "apply" });
    expect(result).toMatchObject({ status: "failed", restored: false });
    expect(result.recovery?.map(target => target.key)).toEqual(["appearance", "soundsEnabled"]);
    expect(JSON.stringify(result.recovery)).not.toContain("privateKey"); expect(values.local.appearance).toEqual(targets[0].value.value);
  });
  it("saves a restorable custom configuration before applying and preserves unrelated private data", async () => {
    const { storage, values } = fixture(initial); const run = createPresetQueue(storage);
    await run({ kind: "Test", build: () => planPreset(storage, targets), review: async () => "save" });
    const saved = (await loadSavedPresets(storage))[0]; expect(saved.kind).toBe("Test");
    expect(JSON.stringify(saved)).not.toContain("privateKey");
    await run({ kind: "Test", build: () => planSavedPreset(storage, saved, targets), review: async () => "apply" });
    expect(values.local.appearance).toEqual(initial.local.appearance); expect(values.sync).toEqual(initial.sync);
    expect(values.local[SAVED_PRESETS_KEY]).toHaveLength(1);
  });
  it("refuses to mutate after settings change during review", async () => {
    const { storage, values } = fixture(initial);
    const result = await createPresetQueue(storage)({ kind: "Test", build: () => planPreset(storage, targets), review: async () => { values.sync.soundsEnabled = "changed elsewhere"; return "apply"; } });
    expect(result.status).toBe("failed"); expect(values.local).toEqual(initial.local); expect(values.sync.soundsEnabled).toBe("changed elsewhere");
    expect(storage.local.set).not.toHaveBeenCalled();
  });
  it("queues review and reads fresh state after a previous operation finishes", async () => {
    const { storage, values } = fixture(initial); const run = createPresetQueue(storage); const seen: unknown[] = [];
    let release!: () => void; const gate = new Promise<void>(resolve => release = resolve);
    const first = run({ kind: "Test", build: () => planPreset(storage, targets), review: async () => { await gate; return "apply"; } });
    const second = run({ kind: "Test", build: () => planPreset(storage, [{ ...targets[1], value: presetValue(false) }]), review: async changes => { seen.push(changes[0].before.value); return "apply"; } });
    await Promise.resolve(); expect(seen).toEqual([]); release(); await Promise.all([first, second]);
    expect(seen).toEqual([true]); expect(values.sync.soundsEnabled).toBe(false);
  });
  it("rejects malformed saved records and ignores targets outside the allowed surface", async () => {
    const { storage } = fixture({ local: { [SAVED_PRESETS_KEY]: [{ id: "broken", name: "X", kind: "Test", createdAt: "now", targets: [null] }] } });
    expect(await loadSavedPresets(storage)).toEqual([]);
    const saved = { id: "ok", name: "X", kind: "Test", createdAt: "2026-10-17T20:00:00.000Z", targets: [ { area: "local", key: "authToken", label: "Secret", value: presetValue("bad") }, targets[0]] };
    const planned = await planSavedPreset(storage, saved as never, targets);
    expect(planned.map(t => t.key)).toEqual(["appearance"]);
  });
  it("previews every nested visual and audio change in readable language", () => {
    expect(presetPreviewLines([{ ...targets[0], before: presetValue(initial.local.appearance) }, { ...targets[1], before: presetValue(false) }])).toEqual([
      "Appearance · Profile: Min → Max", "Appearance · Disable Maxxer: On → Off", "RemiStats sounds: Off → On",
    ]);
  });
});

it("refuses the 21st custom save without evicting a configuration or applying anything", async () => {
  const saved = Array.from({ length: 20 }, (_, index) => ({ id: String(index), name: `Custom ${index}`, kind: "Test", createdAt: "2026-10-17T20:00:00.000Z", targets }));
  const { storage, values } = fixture({ local: { [SAVED_PRESETS_KEY]: saved }, sync: {} });
  const before = structuredClone(values);
  const result = await createPresetQueue(storage)({ kind: "Test", build: () => planPreset(storage, targets), review: async () => "save" });
  expect(result.message).toContain("20 saved configurations are full"); expect(values).toEqual(before);
});

it.each([
  ["milxdy.settings.visualTheme", "not-an-object"],
  ["milxdy.settings.visualTheme", { profile: "max", disableMaxxer: "false" }],
  ["milxdy.settings.visualTheme", { profile: "unknown" }],
  ["mode", { value: "off" }],
  ["mode", ["milady"]],
  ["milxdy.settings.reskinProfile", ["max"]],
  ["milxdy.performance.mode", ["full"]],
  ["milxdy.apps.firstRun.status", ["complete"]],
  ["milxdy.settings.theme", ["dark"]],
  ["remiliaWikiHyperlink.settings", { enabled: "true", sidebarEnabled: false }],
  ["milxdy.apps.railPinned", ["ok", 123]],
])("rejects incompatible saved %s values before review or writes", async (key, value) => {
  const { storage } = fixture();
  const area = key === "mode" ? "sync" : "local";
  const saved = { id: "custom", name: "Custom", kind: "Test", createdAt: "2026-10-17T20:00:00.000Z", targets: [{ area, key, label: key, value: presetValue(value) }] };
  await expect(planSavedPreset(storage, saved as never, [{ area, key, label: key, value: presetValue({}) }])).rejects.toThrow("incompatible");
  expect(storage.local.set).not.toHaveBeenCalled(); expect(storage.sync.set).not.toHaveBeenCalled();
});


it("does not claim restoration if reconciliation changes restored storage", async () => {
  const { storage, values } = fixture(initial);
  let reconciliation = 0;
  const result = await createPresetQueue(storage)({ kind: "Test", build: () => planPreset(storage, targets), review: async () => "apply", reconcile: async () => {
    if (++reconciliation === 1) throw new Error("activation failed");
    values.sync.soundsEnabled = true;
  } });
  expect(result).toMatchObject({ status: "failed", restored: false });
  expect(result.recovery?.map(target => target.key)).toEqual(["appearance", "soundsEnabled"]);
});
