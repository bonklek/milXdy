import { afterEach, describe, expect, it, vi } from "vitest";
import { AUDIO_GROUP_KEYS, AudioGroups, migrateXChatSoundPreference } from "./audio-groups";
afterEach(() => vi.unstubAllGlobals());
function storage(legacy: Record<string, unknown> = { soundEnabled: true, mode: "milady" }, initial: Record<string, unknown> = {}) {
  const stored = { ...initial };
  const syncGet = vi.fn(async () => legacy);
  const listeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>();
  vi.stubGlobal("chrome", { storage: { local: { get: vi.fn(async () => ({ ...stored })), set: vi.fn(async (values: Record<string, unknown>) => Object.assign(stored, values)) }, sync: { get: syncGet }, onChanged: { addListener: (fn: never) => listeners.add(fn), removeListener: (fn: never) => listeners.delete(fn) } } });
  return { stored, syncGet, listeners };
}
describe("native audio parent preferences", () => {
  it("carries existing native chat enablement out of Maxxer once", async () => {
    const f = storage(); await migrateXChatSoundPreference();
    expect(f.stored[AUDIO_GROUP_KEYS.xChatSend]).toBe(true);
  });
  it.each([{ soundEnabled: false, mode: "milady" }, { soundEnabled: true, mode: "off" }])("preserves legacy mute at migration", async legacy => {
    const f = storage(legacy); await migrateXChatSoundPreference();
    expect(f.stored[AUDIO_GROUP_KEYS.xChatSend]).toBe(false);
  });
  it("preserves a disabled Maxxer appearance setting during migration", async () => {
    const f = storage(undefined, { "milxdy.settings.visualTheme": { disableMaxxer: true } });
    await migrateXChatSoundPreference(); expect(f.stored[AUDIO_GROUP_KEYS.xChatSend]).toBe(false);
  });
  it("never overwrites an independently saved chat preference", async () => {
    const f = storage({ soundEnabled: false, mode: "off" }, { [AUDIO_GROUP_KEYS.xChat]: true });
    await migrateXChatSoundPreference(); expect(f.syncGet).not.toHaveBeenCalled(); expect(f.stored[AUDIO_GROUP_KEYS.xChatSend]).toBe(true);
  });
  it("folds the removed parent mute and gain into events only once", async () => {
    const f = storage(undefined, { [AUDIO_GROUP_KEYS.xChat]: false,
      [AUDIO_GROUP_KEYS.xChatSend]: true, "milxdy.audio.volume.xChat": .4,
      "milxdy.audio.volume.xChatSend": .25 });
    await migrateXChatSoundPreference();
    expect(f.stored[AUDIO_GROUP_KEYS.xChatSend]).toBe(false);
    expect(f.stored["milxdy.audio.volume.xChatSend"]).toBeCloseTo(.1);
    f.stored[AUDIO_GROUP_KEYS.xChatSend] = true;
    await migrateXChatSoundPreference();
    expect(f.stored[AUDIO_GROUP_KEYS.xChatSend]).toBe(true);
    expect(f.stored["milxdy.audio.volume.xChatSend"]).toBeCloseTo(.1);
  });
  it("observes parent mute without rewriting child event preferences", async () => {
    const f = storage(undefined, { [AUDIO_GROUP_KEYS.xChatSend]: true });
    const groups = new AudioGroups(); let dispose = () => {};
    await groups.start(fn => { dispose = fn; });
    for (const listener of f.listeners) listener({ [AUDIO_GROUP_KEYS.x]: { newValue: false } }, "local");
    expect(groups.enabled("x")).toBe(false); expect(groups.enabled("xChatSend")).toBe(true);
    expect(f.stored[AUDIO_GROUP_KEYS.xChatSend]).toBe(true); dispose(); expect(f.listeners.size).toBe(0);
  });
});
