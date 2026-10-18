import { describe, expect, it } from "vitest";
import { FIRST_PARTY_APPS } from "../platform/app-sdk/first-party-registry";
import { createAppStorageFacade, type AppStorageBackend } from "../platform/app-sdk/app-storage";
import { AudioCueVolumes, type AudioCue } from "./audio-cue-volumes";
import { AudioGroups, migrateXChatSoundPreference } from "./audio-groups";
describe("sound preferences through declared runtime storage", () => {
  it.each([
    ["rootVisuals", ["post", "sidebar", "newPosts", "x", "xChatSend", "xChatMessage"]],
    ["miladymaxxer", ["maxxer"]],
    ["reminetChat", ["chatSend", "chatReact", "chatReactToMe", "chatMessage", "chatPoke"]],
  ] as const)("loads %s gains using only its declared App SDK keys", async (id, cues) => {
    const app = FIRST_PARTY_APPS.find(app => app.id === id)!;
    const unsubscribed: boolean[] = [], disposals: (() => void)[] = [];
    const saved: Record<string, unknown> = {};
    const backend: AppStorageBackend = {
      get: async (_area, defaults) => ({ ...defaults, ...saved }),
      set: async (_area, values) => { Object.assign(saved, values); }, remove: async () => {},
      onChanged: () => () => { unsubscribed.push(true); },
    };
    const storage = createAppStorageFacade(id, app.storageKeys || {}, backend);
    if (id === "rootVisuals") {
      await migrateXChatSoundPreference(storage.local, storage.sync);
      await new AudioGroups().start(dispose => disposals.push(dispose), storage.local);
    }
    const volumes = new AudioCueVolumes(cues as readonly AudioCue[]);
    await volumes.start(dispose => disposals.push(dispose), storage.local);
    expect(volumes.get(cues[0])).toBe(1);
    disposals.forEach(dispose => dispose()); expect(unsubscribed).toHaveLength(disposals.length);
  });
});

describe("late sound preference snapshots", () => {
  it("never overwrites repeated live cue edits with an old snapshot or rereads", async () => {
    let loaded!: (values: Record<string, unknown>) => void;
    let changed!: (values: Record<string, { newValue: unknown }>) => void;
    let dispose = () => {}, reads = 0;
    const volumes = new AudioCueVolumes(["post", "sidebar"]);
    const pending = volumes.start(value => { dispose = value; }, {
      get: async <T extends Record<string, unknown>>(_defaults: T) => { reads++; return await new Promise<Record<string, unknown>>(resolve => { loaded = resolve; }) as T; },
      set: async () => {}, remove: async () => {}, onChanged: listener => { changed = listener; return () => {}; },
    });
    changed({ "milxdy.audio.volume.post": { newValue: 0 } });
    changed({ "milxdy.audio.volume.post": { newValue: 1.8 } });
    loaded({ "milxdy.audio.volume.post": .2, "milxdy.audio.volume.sidebar": .7 }); await pending;
    expect(volumes.get("post")).toBe(1.8); expect(volumes.get("sidebar")).toBe(.7); expect(reads).toBe(1);
    dispose(); changed({ "milxdy.audio.volume.post": { newValue: .4 } }); expect(volumes.get("post")).toBe(1.8);
  });
});
