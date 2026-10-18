import type { AppStorageArea, AppStorageChanges } from "../platform/app-sdk/app-platform";
import { audioCueVolumeKey, normalizeCueVolume } from "./audio-cue-volumes";
export const AUDIO_GROUP_KEYS = {
  x: "milxdy.audio.x.enabled", xChat: "milxdy.audio.xChat.enabled",
  xChatSend: "milxdy.audio.xChat.send.enabled", xChatMessage: "milxdy.audio.xChat.message.enabled",
} as const;
export type AudioGroup = keyof typeof AUDIO_GROUP_KEYS;
/** Fold the former chat parent into its two events once, preserving effective mute and gain. */
export async function migrateXChatSoundPreference(local: AppStorageArea, sync: AppStorageArea): Promise<void> {
  const marker = "milxdy.audio.xChat.eventsMigrated";
  const stored = await local.get<Record<string, unknown>>(Object.fromEntries([marker, ...Object.values(AUDIO_GROUP_KEYS),
    "milxdy.settings.visualTheme", "milxdy.audio.volume.xChat",
    "milxdy.audio.volume.xChatSend", "milxdy.audio.volume.xChatMessage"].map(key => [key, null])));
  if (stored[marker] === true) return;
  let enabled = stored[AUDIO_GROUP_KEYS.xChat] !== false;
  if (stored[AUDIO_GROUP_KEYS.xChat] == null) {
    const legacy = await sync.get({ soundEnabled: true, mode: "milady" });
    const theme = stored["milxdy.settings.visualTheme"] as { disableMaxxer?: boolean } | undefined;
    enabled = legacy.soundEnabled !== false && legacy.mode !== "off" && theme?.disableMaxxer !== true;
  }
  if ((await local.get<Record<string, unknown>>({ [marker]: null }))[marker] === true) return;
  const changes: Record<string, unknown> = { [marker]: true };
  const chatVolume = normalizeCueVolume(stored["milxdy.audio.volume.xChat"]);
  for (const event of ["xChatSend", "xChatMessage"] as const) {
    changes[AUDIO_GROUP_KEYS[event]] = enabled && stored[AUDIO_GROUP_KEYS[event]] !== false;
    changes[audioCueVolumeKey(event)] = Number((chatVolume * normalizeCueVolume(stored[audioCueVolumeKey(event)])).toFixed(6));
  }
  await local.set(changes);
}
export class AudioGroups {
  private values = new Map<AudioGroup, boolean>();
  enabled(group: AudioGroup): boolean { return this.values.get(group) ?? true; }
  async start(addDisposable: (dispose: () => void) => void, storage: AppStorageArea): Promise<void> {
    const groups = Object.keys(AUDIO_GROUP_KEYS) as AudioGroup[];
    const changed = new Set<AudioGroup>();
    let active = true;
    const listener = (changes: AppStorageChanges) => {
      if (!active) return;
      for (const group of groups) if (changes[AUDIO_GROUP_KEYS[group]]) {
        changed.add(group); this.values.set(group, changes[AUDIO_GROUP_KEYS[group]]!.newValue !== false);
      }
    };
    const unsubscribe = storage.onChanged(listener);
    addDisposable(() => { active = false; unsubscribe(); });
    const stored = await storage.get(Object.fromEntries(Object.values(AUDIO_GROUP_KEYS).map(key => [key, null])));
    if (active) for (const group of groups) if (!changed.has(group)) this.values.set(group, stored[AUDIO_GROUP_KEYS[group]] !== false);
  }
}
