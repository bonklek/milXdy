import { createAppPresetService } from "../../src/platform/settings/app-presets";
import { createPopupPresetController } from "../../src/extension/popup/preset-controller";
import { FIRST_PARTY_APPS } from "../../src/platform/app-sdk/first-party-registry";
import { presetValue, type PresetStorage } from "../../src/platform/settings/preset-transaction";
const test = globalThis as typeof globalThis & { presetFixture: Record<string, unknown> };
const values: Record<string, Record<string, unknown>> = { local: {}, sync: {} };
let failSync = false;
const storage = Object.fromEntries(["local", "sync"].map(area => [area, {
  get: async (keys: string[] | string | Record<string, unknown>) => {
    const list = typeof keys === "string" ? [keys] : Array.isArray(keys) ? keys : Object.keys(keys);
    return { ...(typeof keys === "object" && !Array.isArray(keys) ? keys : {}), ...Object.fromEntries(list.filter(key => Object.hasOwn(values[area], key)).map(key => [key, values[area][key]])) };
  },
  set: async (patch: Record<string, unknown>) => { if (area === "sync" && failSync) { failSync = false; throw new Error("fixture injected failure"); } Object.assign(values[area], structuredClone(patch)); },
  remove: async (keys: string[]) => keys.forEach(key => delete values[area][key]),
}])) as PresetStorage;
(globalThis as any).chrome = { storage };
const host = document.createElement("section"); host.style.cssText = "padding:12px"; document.body.prepend(host);
const app = createAppPresetService({ storage, apps: () => FIRST_PARTY_APPS.filter(app => app.available !== false && app.setEnabled), blocked: () => false, active: () => true, refresh: async () => undefined, parent: () => host });
const popup = createPopupPresetController(storage, async () => undefined);
function action(text: string, run: () => Promise<unknown>) {
  const button = document.createElement("button"); button.type = "button"; button.textContent = text;
  button.onclick = () => void run(); host.append(button); return button;
}
action("Review all apps", () => app.apply("full"));
action("Saved setups", () => app.restore());
action("Review appearance and audio", () => popup.apply("Review appearance and audio profile", async () => [
  { area: "local", key: "theme", label: "Appearance", value: presetValue({ profile: "max", disableMaxxer: false }) },
  { area: "sync", key: "soundsEnabled", label: "RemiStats sound feedback", value: presetValue(true) },
  { area: "sync", key: "soundVolume", label: "RemiStats volume", value: presetValue(.75) },
  { area: "sync", key: "endOfTweetDing", label: "Post-reading completion ding", value: presetValue(true) },
]));
test.presetFixture = { values, fail: () => failSync = true };
