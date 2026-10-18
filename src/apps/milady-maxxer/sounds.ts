import type { AppStorageArea } from "../../platform/app-sdk/app-platform";
import { AudioCueVolumes } from "../../lib/audio-cue-volumes";
const cueVolumes = new AudioCueVolumes(["maxxer"]);
import {
  MEDIA_ELEMENTS,
  INTERACTIVE_ELEMENT,
  LAYERS,
} from "./selectors";
import type { ExtensionSettings } from "./shared/types";

// Module-level settings reference, updated by content.ts via setSoundSettings()
let settings: ExtensionSettings = { mode: "off", whitelistHandles: [], miladyListHandles: [], includeRemiStatsBeetles: true, hideNonMiladyOrBeetlePosts: false, soundEnabled: false, showLevelBadge: true, cardTheme: "full" };

export function setSoundSettings(next: ExtensionSettings): void {
  settings = next;
}

function isMaxxerDisabled(): boolean {
  return document.documentElement.dataset.milxdyVisualDisableMaxxer === "true";
}

function isMaxxerActive(): boolean {
  return settings.mode !== "off" && !isMaxxerDisabled();
}

let audioContext: AudioContext | null = null;
const soundsAttached = new WeakSet<HTMLElement>();
const soundSurfaces = new WeakSet<HTMLElement>();
let gestureListenersAttached = false;
let surfaceSoundDelegatesAttached = false;
let globalMediaHoverDelegateAttached = false;
type SoundDocumentEventMap = {
  click: MouseEvent;
  keydown: KeyboardEvent;
  mousedown: MouseEvent;
  mouseover: MouseEvent;
};
type SoundDocumentEventType = keyof SoundDocumentEventMap;
type SoundDocumentListener<Type extends SoundDocumentEventType> = (event: SoundDocumentEventMap[Type]) => void;
type SoundDocumentEventEntry = {
  capture: boolean;
  dispatcher: EventListener;
  listeners: Set<EventListener>;
};
const soundDocumentEvents = new Map<string, SoundDocumentEventEntry>();

function addSoundDocumentListener<Type extends SoundDocumentEventType>(
  type: Type,
  listener: SoundDocumentListener<Type>,
  options: AddEventListenerOptions,
  addDisposable: (disposable: () => void) => void,
): void {
  const capture = options.capture === true;
  const key = `${type}:${capture ? "capture" : "bubble"}`;
  let entry = soundDocumentEvents.get(key);
  if (!entry) {
    const listeners = new Set<EventListener>();
    const dispatcher: EventListener = (event) => {
      for (const current of Array.from(listeners)) current(event);
    };
    document.addEventListener(type, dispatcher, options);
    entry = { capture, dispatcher, listeners };
    soundDocumentEvents.set(key, entry);
  }

  const eventListener = listener as EventListener;
  entry.listeners.add(eventListener);
  addDisposable(() => {
    const current = soundDocumentEvents.get(key);
    if (!current) return;
    current.listeners.delete(eventListener);
    if (current.listeners.size > 0) return;
    document.removeEventListener(type, current.dispatcher, current.capture);
    soundDocumentEvents.delete(key);
  });
}

// Eagerly create & resume AudioContext on first user gesture so it's
// ready for non-gesture sounds (MutationObserver callbacks, etc.)
function ensureAudioContext(): void {
  if (!isMaxxerActive() || !settings.soundEnabled) return;
  if (audioContext && audioContext.state === "running") return;
  if (!audioContext) {
    try {
      audioContext = new AudioContext();
    } catch {
      return;
    }
  }
  if (audioContext.state === "suspended") {
    void audioContext.resume();
  }
}

export function initializeSoundRuntime(addDisposable: (disposable: () => void) => void = () => undefined, storage?: AppStorageArea): void {
  if (gestureListenersAttached) return;
  gestureListenersAttached = true;
  if (storage) void cueVolumes.start(addDisposable, storage);
  addSoundDocumentListener("click", ensureAudioContext, { passive: true, capture: true }, addDisposable);
  addSoundDocumentListener("keydown", ensureAudioContext, { passive: true, capture: true }, addDisposable);
  addSoundDocumentListener("mousedown", ensureAudioContext, { passive: true, capture: true }, addDisposable);
  addDisposable(() => {
    gestureListenersAttached = false;
    audioContext?.close?.().catch(() => undefined);
    audioContext = null;
  });
}

export function initializeSurfaceSoundRuntime(addDisposable: (disposable: () => void) => void = () => undefined): void {
  if (surfaceSoundDelegatesAttached) return;
  surfaceSoundDelegatesAttached = true;

  const mouseoverListener = (event: MouseEvent) => {
    if (!isMaxxerActive()) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target) return;
    const surface = closestSoundSurface(target);
    if (!surface) return;

    const media = target.closest<HTMLElement>(MEDIA_ELEMENTS);
    if (media && surface.contains(media)) {
      if (event.relatedTarget instanceof Node && media.contains(event.relatedTarget)) return;
      playMediaHoverSound(surface.dataset.miladymaxxerEffect === "milady");
      return;
    }

    if (event.relatedTarget instanceof Node && surface.contains(event.relatedTarget)) return;
    playHoverSound(surface.dataset.miladymaxxerEffect === "milady");
  };

  const clickListener = (event: MouseEvent) => {
    if (!isMaxxerActive()) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    if (!target?.closest(INTERACTIVE_ELEMENT)) return;
    const surface = closestSoundSurface(target);
    if (!surface) return;
    playClickSound(surface.dataset.miladymaxxerEffect === "milady");
  };

  addSoundDocumentListener("mouseover", mouseoverListener, { passive: true }, addDisposable);
  addSoundDocumentListener("click", clickListener, { passive: true }, addDisposable);
  addDisposable(() => {
    surfaceSoundDelegatesAttached = false;
  });
}


// AudioContext can only be created/resumed after a real user gesture (click/keydown).
// Hover events don't qualify, so pass hoverOnly=true to silently skip.
function getAudioContext(hoverOnly = false): AudioContext | null {
  if (!audioContext) {
    if (hoverOnly) return null;
    try {
      audioContext = new AudioContext();
    } catch {
      return null;
    }
  }
  if (audioContext.state === "suspended") {
    if (hoverOnly) return null;
    void audioContext.resume();
  }
  return audioContext;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume: number = 0.08,
  attack: number = 0.01,
  decay: number = 0.1,
): void {
  volume *= cueVolumes.get("maxxer");
  if (volume <= 0) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);

    // ADSR envelope for pleasant sound
    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, ctx.currentTime + attack);
    gainNode.gain.linearRampToValueAtTime(volume * 0.7, ctx.currentTime + attack + decay);
    gainNode.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    // Audio not available, fail silently
  }
}

function playChord(frequencies: number[], duration: number, volume: number = 0.05): void {
  for (const freq of frequencies) {
    playTone(freq, duration, "sine", volume);
  }
}

// Sound presets
function playHoverSound(isMilady: boolean): void {
  if (!settings.soundEnabled) return;
  // Try to get existing context; hover can't create one but we check if it's ready
  if (!audioContext || audioContext.state !== "running") return;
  if (isMilady) {
    // Sparkly high chime for milady
    playTone(1200, 0.12, "sine", 0.06);
    setTimeout(() => playTone(1500, 0.1, "sine", 0.04), 30);
  } else {
    // Subtle soft tone for non-milady
    playTone(400, 0.08, "sine", 0.03);
  }
}

function playClickSound(isMilady: boolean): void {
  if (!settings.soundEnabled) return;
  if (isMilady) {
    // Satisfying gold coin / chime sound
    playChord([523.25, 659.25, 783.99], 0.2, 0.05); // C5, E5, G5 major chord
    setTimeout(() => playTone(1046.5, 0.15, "sine", 0.04), 50); // C6 sparkle
  } else {
    // Simple click
    playTone(300, 0.06, "triangle", 0.04);
  }
}

export function playCatchSound(): void {
  if (!settings.soundEnabled) return;
  // Bright, satisfying single catch tone — gold coin with sparkle
  playTone(659.25, 0.15, "sine", 0.07); // E5
  setTimeout(() => playTone(880, 0.2, "sine", 0.06), 60); // A5
  setTimeout(() => playTone(1318.5, 0.25, "sine", 0.04), 140); // E6 sparkle
}

export function playLogoHoverSound(): void {
  if (!settings.soundEnabled || !getAudioContext(true)) return;
  playTone(1200, 0.12, "sine", 0.04);
  setTimeout(() => playTone(1500, 0.1, "sine", 0.03), 30);
}

export function playLogoTune(): void {
  if (!settings.soundEnabled) return;
  // 3-note polyphonic uplift — bright and short
  playChord([523.25, 659.25], 0.15, 0.05); // C5+E5
  setTimeout(() => playChord([659.25, 783.99], 0.15, 0.05), 100); // E5+G5
  setTimeout(() => playChord([783.99, 1046.5], 0.2, 0.04), 200); // G5+C6
}

export function playLetterPip(index: number): void {
  if (!settings.soundEnabled) return;
  // Tiny high pip, pitch rises slightly per letter
  const baseFreq = 1400 + index * 60;
  playTone(baseFreq, 0.04, "sine", 0.04, 0, 0.01);
}

export function playLevelUpSound(): void {
  if (!settings.soundEnabled) return;
  // Ascending arpeggio — progression feel
  playTone(523.25, 0.12, "sine", 0.06); // C5
  setTimeout(() => playTone(659.25, 0.12, "sine", 0.06), 80); // E5
  setTimeout(() => playTone(783.99, 0.12, "sine", 0.06), 160); // G5
  setTimeout(() => playChord([1046.5, 1318.5], 0.3, 0.04), 240); // C6+E6 chord
}

function playMediaHoverSound(isMilady: boolean): void {
  if (!settings.soundEnabled || !getAudioContext(true)) return;
  if (isMilady) {
    // Soft shimmer for milady media
    playTone(800, 0.1, "sine", 0.04);
    setTimeout(() => playTone(1000, 0.08, "sine", 0.03), 40);
  } else {
    // Very subtle for non-milady
    playTone(300, 0.06, "sine", 0.02);
  }
}

export function attachSoundEvents(tweet: HTMLElement): void {
  soundSurfaces.add(tweet);
}

// Global media hover sounds — attaches a subtle pip to ALL media on the page,
// regardless of whether the tweet was processed by the milady detection system.
export function attachGlobalMediaHoverSounds(addDisposable: (disposable: () => void) => void = () => undefined): void {
  if (globalMediaHoverDelegateAttached) return;
  globalMediaHoverDelegateAttached = true;
  const mouseoverListener = (event: MouseEvent) => {
    if (!isMaxxerActive() || !settings.soundEnabled || !getAudioContext(true)) return;
    const target = event.target instanceof HTMLElement ? event.target : null;
    const media = target?.closest<HTMLElement>(MEDIA_ELEMENTS);
    if (!media || closestSoundSurface(media)) return;
    if (event.relatedTarget instanceof Node && media.contains(event.relatedTarget)) return;
    // Very subtle, short pip: quieter and shorter than the milady media hover.
    playTone(500, 0.05, "sine", 0.02);
  };
  addSoundDocumentListener("mouseover", mouseoverListener, { passive: true }, addDisposable);
  addDisposable(() => {
    globalMediaHoverDelegateAttached = false;
  });
        // Very subtle, short pip — quieter and shorter than the milady media hover
}

function closestSoundSurface(target: HTMLElement): HTMLElement | null {
  for (let node: HTMLElement | null = target; node; node = node.parentElement) {
    if (soundSurfaces.has(node)) return node;
  }
  return null;
}
