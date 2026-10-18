import type { AppStorageArea, AppStorageChanges } from "../platform/app-sdk/app-platform";
export const AUDIO_CUES = ["maxxer", "chatSend", "chatReact", "chatReactToMe", "chatMessage", "chatPoke", "post", "sidebar", "newPosts", "x", "xChat", "xChatSend", "xChatMessage"] as const;
export type AudioCue = typeof AUDIO_CUES[number];
export const audioCueVolumeKey = (cue: AudioCue): string => `milxdy.audio.volume.${cue}`;
export function normalizeCueVolume(value: unknown, fallback = 1): number {
  if (value === undefined || value === null || value === "") return fallback;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(2, numeric)) : fallback;
}
/** Independent saved gains: disabling a cue never resets its preference. */
export class AudioCueVolumes {
  constructor(private cues: readonly AudioCue[] = AUDIO_CUES) {}
  private values = new Map<AudioCue, number>();
  get(cue: AudioCue): number { return this.values.get(cue) ?? 1; }
  async start(addDisposable: (dispose: () => void) => void, storage: AppStorageArea): Promise<void> {
    let active = true;
    const changed = new Set<AudioCue>();
    const listener = (changes: AppStorageChanges) => {
      if (!active) return;
      for (const cue of this.cues) {
        const change = changes[audioCueVolumeKey(cue)];
        if (change) { changed.add(cue); this.values.set(cue, normalizeCueVolume(change.newValue)); }
      }
    };
    const unsubscribe = storage.onChanged(listener);
    addDisposable(() => { active = false; unsubscribe(); });
    const stored = await storage.get(Object.fromEntries(this.cues.map(cue => [audioCueVolumeKey(cue), null])));
    if (!active) return;
    // Live edits win per cue, including repeated edits while the initial snapshot is pending.
    for (const cue of this.cues) if (!changed.has(cue)) this.values.set(cue, normalizeCueVolume(stored[audioCueVolumeKey(cue)]));
  }
}
