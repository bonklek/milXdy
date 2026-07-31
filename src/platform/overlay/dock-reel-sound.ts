import {
  DEFAULT_INTERFACE_SOUNDS_VOLUME,
  INTERFACE_SOUNDS_ENABLED_KEY,
  INTERFACE_SOUNDS_VOLUME_KEY,
} from "../settings/interface-sounds";

type ReelDirection = -1 | 1;

type ReelSoundVoice = {
  type: OscillatorType;
  startHz: number;
  endHz: number;
  delay: number;
  duration: number;
  level: number;
};

export const REEL_SOUND_MASTER_LEVEL = 0.55;

export function reelSoundVoices(direction: ReelDirection): ReelSoundVoice[] {
  const directionLift = direction < 0 ? 1.08 : 1;
  return [
    { type: "triangle", startHz: 82 * directionLift, endHz: 54 * directionLift, delay: 0, duration: 0.16, level: 0.34 },
    { type: "square", startHz: 126 * directionLift, endHz: 84 * directionLift, delay: 0.014, duration: 0.105, level: 0.12 },
    { type: "sawtooth", startHz: 196 * directionLift, endHz: 132 * directionLift, delay: 0.027, duration: 0.075, level: 0.055 },
  ];
}

export class DockReelSoundPlayer {
  #context: AudioContext | null = null;
  #enabled = true;
  #volume = DEFAULT_INTERFACE_SOUNDS_VOLUME;
  #listening = false;

  start(): void {
    if (this.#listening || typeof chrome === "undefined" || !chrome.storage?.local) return;
    this.#listening = true;
    void chrome.storage.local.get({
      [INTERFACE_SOUNDS_ENABLED_KEY]: true,
      [INTERFACE_SOUNDS_VOLUME_KEY]: DEFAULT_INTERFACE_SOUNDS_VOLUME,
    }).then((stored) => {
      this.#enabled = stored?.[INTERFACE_SOUNDS_ENABLED_KEY] !== false;
      this.#volume = normalizeVolume(stored?.[INTERFACE_SOUNDS_VOLUME_KEY]);
    }).catch(() => undefined);
    chrome.storage.onChanged.addListener(this.#handleStorageChange);
  }

  dispose(): void {
    if (this.#listening && typeof chrome !== "undefined") chrome.storage.onChanged.removeListener(this.#handleStorageChange);
    this.#listening = false;
    const context = this.#context;
    this.#context = null;
    if (context) void context.close().catch(() => undefined);
  }

  play(direction: ReelDirection): void {
    if (!this.#enabled || this.#volume <= 0) return;
    try {
      const AudioContextCtor = window.AudioContext
        || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const context = this.#context ?? new AudioContextCtor();
      this.#context = context;
      void this.#playWhenReady(context, direction);
    } catch {
      // Audio restrictions must never block reel navigation.
    }
  }

  async #playWhenReady(context: AudioContext, direction: ReelDirection): Promise<void> {
    try {
      if (context.state !== "running") await context.resume();
      if (context.state !== "running" || this.#context !== context || !this.#enabled || this.#volume <= 0) return;
      const now = context.currentTime;
      const master = context.createGain();
      const lowPass = context.createBiquadFilter();
      lowPass.type = "lowpass";
      lowPass.frequency.setValueAtTime(520, now);
      lowPass.Q.setValueAtTime(0.8, now);
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(Math.max(0.0001, this.#volume * REEL_SOUND_MASTER_LEVEL), now + 0.008);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.19);
      master.connect(lowPass).connect(context.destination);
      for (const voice of reelSoundVoices(direction)) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        const start = now + voice.delay;
        oscillator.type = voice.type;
        oscillator.frequency.setValueAtTime(voice.startHz, start);
        oscillator.frequency.exponentialRampToValueAtTime(voice.endHz, start + voice.duration);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(voice.level, start + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + voice.duration);
        oscillator.connect(gain).connect(master);
        oscillator.start(start);
        oscillator.stop(start + voice.duration + 0.01);
      }
    } catch {
      // Audio restrictions must never block reel navigation.
    }
  }

  readonly #handleStorageChange = (changes: Record<string, chrome.storage.StorageChange>, area: string): void => {
    if (area !== "local") return;
    if (changes[INTERFACE_SOUNDS_ENABLED_KEY]) this.#enabled = changes[INTERFACE_SOUNDS_ENABLED_KEY].newValue !== false;
    if (changes[INTERFACE_SOUNDS_VOLUME_KEY]) this.#volume = normalizeVolume(changes[INTERFACE_SOUNDS_VOLUME_KEY].newValue);
  };
}

function normalizeVolume(value: unknown): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.max(0, Math.min(1, numeric)) : DEFAULT_INTERFACE_SOUNDS_VOLUME;
}
