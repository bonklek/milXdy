import { FIRST_PARTY_APPS } from "../../platform/app-sdk/first-party-registry";
import { describe, expect, it } from "vitest";
import type { AppSettingDefinition } from "../../platform/app-sdk/app-platform";
import { appSoundSettings, bundledAppEntries, bundledSettingPatch, bundledSettingValue, normalizeBundledSetting } from "./bundled-app-settings";

const setting: AppSettingDefinition = {
  id: "sample.enabled", label: "Enabled", scope: "app", location: "appsAndFeatures",
  storage: { area: "local", key: "sample.preferences", property: "enabled" },
  defaultValue: true, control: { type: "toggle" }, reset: { behavior: "restoreDefault" },
};
describe("bundled settings storage", () => {
  it("preserves unrelated preferences when changing one object property", () => {
    const original = { enabled: true, volume: 1.5, theme: "dark" };
    expect(bundledSettingPatch(setting, original, false)).toEqual({ ...original, enabled: false });
    expect(original.enabled).toBe(true);
  });
  it("preserves false and zero rather than replacing them with defaults", () => {
    expect(bundledSettingValue(setting, { enabled: false })).toBe(false);
    expect(bundledSettingValue(setting, { enabled: 0 })).toBe(0);
    expect(bundledSettingValue(setting, {})).toBe(true);
  });
  it("replaces standalone keys without wrapping their values", () => {
    const standalone = { ...setting, storage: { area: "sync" as const, key: "sample.enabled" } };
    expect(bundledSettingPatch(standalone, true, false)).toBe(false);
    expect(bundledSettingValue(standalone, false)).toBe(false);
  });
  it("keeps numeric gains above one and clamps to the declared range", () => {
    const volume = { ...setting, defaultValue: 1, control: { type: "slider" as const, min: 0, max: 2 } };
    expect(normalizeBundledSetting(volume, "1.5")).toBe(1.5);
    expect(normalizeBundledSetting(volume, "3")).toBe(2);
    expect(normalizeBundledSetting(volume, "invalid")).toBe(1);
  });
  it("uses null for the browser's default voice", () => {
    const voice = { ...setting, defaultValue: null, control: { type: "select" as const, dynamicOptions: { provider: "webSpeechVoices" as const, valueField: "voiceURI" as const, labelField: "name" as const } } };
    expect(normalizeBundledSetting(voice, "")).toBe(null);
    expect(normalizeBundledSetting(voice, "chosen-voice")).toBe("chosen-voice");
  });
  it("restores typed option values instead of storing their string representations", () => {
    const select = { ...setting, control: { type: "select" as const, options: [{ label: "Off", value: false }, { label: "Two", value: 2 }] } };
    expect(normalizeBundledSetting(select, "false")).toBe(false);
    expect(normalizeBundledSetting(select, "2")).toBe(2);
  });
});

describe("bundled app inventory", () => {
  it("groups both Wiki features into one card without losing either feature's settings", () => {
    const entries = bundledAppEntries(FIRST_PARTY_APPS);
    expect(entries.some(app => app.id === "wikiSidebar")).toBe(false);
    const wiki = entries.find(app => app.id === "wiki")!;
    expect(wiki.name).toBe("Remilia Wiki");
    const expected = FIRST_PARTY_APPS.filter(app => ["wiki", "wikiSidebar"].includes(app.id)).flatMap(app => app.settings ?? []).map(setting => setting.id);
    expect(wiki.settings!.map(setting => setting.id)).toEqual(expected);
    expect(entries).toHaveLength(FIRST_PARTY_APPS.length - 1);
  });
});

describe("app sound ownership", () => {
  it("uses SDK audio metadata even when a package setting is not named sound", () => {
    const app = { ...FIRST_PARTY_APPS[0]!, settings: [{ ...setting, id: "sample.notifications.enabled", presets: ["audio" as const] }] };
    expect(appSoundSettings(app)).toEqual(app.settings);
  });
  it("keeps Read Aloud playback separate from its notification sound", () => {
    const reader = FIRST_PARTY_APPS.find(app => app.id === "post-reading")!;
    expect(appSoundSettings(reader).map(setting => setting.id)).toEqual(["post-reading.endOfTweetDing"]);
  });
  it("declares every chat sound and its independent volume in the same app manifest", () => {
    const chat = FIRST_PARTY_APPS.find(app => app.id === "reminetChat")!;
    for (const cue of ["send", "message", "poke", "react", "reactToMe"]) {
      const settings = appSoundSettings(chat);
      expect(settings.some(setting => setting.id === `reminetChat.sounds.${cue}`)).toBe(true);
      const volume = settings.find(setting => setting.id === `reminetChat.sounds.${cue}.volume`)!;
      expect(chat.storageKeys.local).toContain(volume.storage.key);
      expect(volume.control.max).toBe(2);
    }
  });
});
