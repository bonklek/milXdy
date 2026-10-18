import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioCueVolumes, audioCueVolumeKey, normalizeCueVolume } from "./audio-cue-volumes";
afterEach(() => vi.unstubAllGlobals());
describe("saved cue volume preferences", () => {
  it("keeps zero mute and clamps malformed or out-of-range values", () => {
    expect(normalizeCueVolume(0)).toBe(0);
    expect(normalizeCueVolume(-1)).toBe(0);
    expect(normalizeCueVolume(1.5)).toBe(1.5);
    expect(normalizeCueVolume(2)).toBe(2);
    expect(normalizeCueVolume(3)).toBe(2);
    expect(normalizeCueVolume("garbage")).toBe(1);
    expect(normalizeCueVolume(undefined)).toBe(1);
  });
  it("loads scoped gains, observes live edits, and removes its listener on disposal", async () => {
    const listeners = new Set<(changes: Record<string, chrome.storage.StorageChange>, area: string) => void>();
    const get = vi.fn(async () => ({ [audioCueVolumeKey("maxxer")]: 0.3 }));
    vi.stubGlobal("chrome", { storage: { local: { get }, onChanged: { addListener: (fn: never) => listeners.add(fn), removeListener: (fn: never) => listeners.delete(fn) } } });
    const prefs = new AudioCueVolumes(["maxxer"]);
    let dispose = () => {};
    await prefs.start(fn => { dispose = fn; });
    expect(get).toHaveBeenCalledWith({ [audioCueVolumeKey("maxxer")]: null });
    expect(prefs.get("maxxer")).toBe(0.3);
    for (const listener of listeners) listener({ [audioCueVolumeKey("maxxer")]: { newValue: 0 } }, "local");
    expect(prefs.get("maxxer")).toBe(0);
    for (const listener of listeners) listener({ [audioCueVolumeKey("maxxer")]: { newValue: 1.8 } }, "sync");
    expect(prefs.get("maxxer")).toBe(0);
    for (const listener of listeners) listener({ [audioCueVolumeKey("maxxer")]: { newValue: 1.8 } }, "local");
    expect(prefs.get("maxxer")).toBe(1.8);
    dispose();
    expect(listeners.size).toBe(0);
  });
});
