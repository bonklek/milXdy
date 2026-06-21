import {
  MEDIA_ELEMENTS,
  INTERACTIVE_ELEMENT,
  POST_BUTTONS,
  TWEET_COMPOSER,
  DM_CONTAINER,
  DM_CONVERSATION_PANEL,
  DM_MESSAGE,
  DM_COMPOSER_FORM,
  LAYERS,
} from "./selectors";
import type { ExtensionSettings } from "./shared/types";

// Module-level settings reference, updated by content.ts via setSoundSettings()
let settings: ExtensionSettings = { mode: "off", whitelistHandles: [], miladyListHandles: [], includeRemiStatsBeetles: true, soundEnabled: false, showLevelBadge: true, cardTheme: "full" };

export function setSoundSettings(next: ExtensionSettings): void {
  settings = next;
}

let audioContext: AudioContext | null = null;
const soundsAttached = new WeakSet<HTMLElement>();
let dmListenersAttached = false;

// Eagerly create & resume AudioContext on first user gesture so it's
// ready for non-gesture sounds (MutationObserver callbacks, etc.)
function ensureAudioContext(): void {
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

// Bootstrap: listen for any user gesture to unlock audio
document.addEventListener("click", ensureAudioContext, { once: false, passive: true, capture: true });
document.addEventListener("keydown", ensureAudioContext, { once: false, passive: true, capture: true });
document.addEventListener("mousedown", ensureAudioContext, { once: false, passive: true, capture: true });


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

function playSendSound(): void {
  if (!settings.soundEnabled) return;
  lastUserInteraction = Date.now();
  // Thup - tight percussive tap, no resonance
  playTone(250, 0.025, "square", 0.06, 0, 0.005);
}

function playMessageBlip(): void {
  if (!settings.soundEnabled) return;
  // Pip - subtle high tap
  playTone(1200, 0.08, "sine", 0.06, 0, 0.02);
  setTimeout(() => playTone(1500, 0.06, "sine", 0.04, 0, 0.015), 30);
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
  if (soundsAttached.has(tweet)) return;
  soundsAttached.add(tweet);

  const isMilady = () => tweet.dataset.miladymaxxerEffect === "milady";

  tweet.addEventListener("mouseenter", () => {
    if (settings.mode !== "off") {
      playHoverSound(isMilady());
    }
  }, { passive: true });

  tweet.addEventListener("click", (e) => {
    if (settings.mode !== "off") {
      const target = e.target as HTMLElement;
      // Only play on interactive elements
      if (target.closest(INTERACTIVE_ELEMENT)) {
        playClickSound(isMilady());
      }
    }
  }, { passive: true });

  // Media hover sounds
  const mediaElements = tweet.querySelectorAll<HTMLElement>(MEDIA_ELEMENTS);
  for (const media of Array.from(mediaElements)) {
    if (soundsAttached.has(media)) continue;
    soundsAttached.add(media);
    media.addEventListener("mouseenter", () => {
      if (settings.mode !== "off") {
        playMediaHoverSound(isMilady());
      }
    }, { passive: true });
  }
}

// Global media hover sounds — attaches a subtle pip to ALL media on the page,
// regardless of whether the tweet was processed by the milady detection system.
export function attachGlobalMediaHoverSounds(): void {
  if (settings.mode === "off") return;

  const mediaElements = document.querySelectorAll<HTMLElement>(MEDIA_ELEMENTS);
  for (const media of Array.from(mediaElements)) {
    if (soundsAttached.has(media)) continue;
    soundsAttached.add(media);
    media.addEventListener("mouseenter", () => {
      if (settings.mode !== "off" && settings.soundEnabled && getAudioContext(true)) {
        // Very subtle, short pip — quieter and shorter than the milady media hover
        playTone(500, 0.05, "sine", 0.02);
      }
    }, { passive: true });
  }
}

export function attachPostButtonSound(): void {
  if (settings.mode === "off") return;

  // Regular tweet buttons
  const postButtons = document.querySelectorAll<HTMLElement>(POST_BUTTONS);

  for (const button of Array.from(postButtons)) {
    if (soundsAttached.has(button)) continue;
    soundsAttached.add(button);

    button.addEventListener("click", () => {
      if (settings.mode !== "off") {
        playSendSound();
      }
    }, { passive: true });
  }
}

// Global DM sound handlers - set up once
export function attachDMSounds(): void {
  if (dmListenersAttached) return;
  dmListenersAttached = true;

  // Document-level click handler for all DM interactions
  document.addEventListener("click", (e) => {
    if (settings.mode === "off") return;

    const target = e.target as HTMLElement;
    const button = target.closest("button") as HTMLElement | null;

    // Check for send button (inside dm-composer-form or by aria-label)
    if (button) {
      const testId = button.getAttribute("data-testid") || "";
      const ariaLabel = button.getAttribute("aria-label") || "";

      // DM send: button inside the composer form, or explicit send labels
      const inComposerForm = button.closest(DM_COMPOSER_FORM);
      if (inComposerForm && (testId.includes("send") || ariaLabel.includes("Send") ||
          button.getAttribute("type") === "submit")) {
        playSendSound();
        return;
      }

      // Also catch any send button by testid/aria-label outside composer
      if (testId.includes("send") || testId.includes("Send") ||
          ariaLabel.includes("Send") || ariaLabel === "Send") {
        playSendSound();
        return;
      }
    }

    // No click sounds in DM conversations — too noisy
  }, { passive: true, capture: true });

  // Document-level keydown for Enter to send in DM composer
  document.addEventListener("keydown", (e) => {
    if (settings.mode === "off") return;
    if (e.key !== "Enter" || e.shiftKey) return;

    const target = e.target as HTMLElement;
    const testId = target.getAttribute("data-testid") || "";

    // Direct match: dm-composer-textarea
    if (testId === "dm-composer-textarea") {
      playSendSound();
      return;
    }

    // Fallback: any textbox inside DM page that isn't the tweet composer
    const inDMPage = window.location.pathname.includes("/messages");
    const isTextbox = target.getAttribute("role") === "textbox" || target.isContentEditable;
    const notTweetComposer = !target.closest(TWEET_COMPOSER);

    if (inDMPage && isTextbox && notTweetComposer) {
      playSendSound();
    }
  }, { passive: true, capture: true });

  // Hover sound on chat list items and DM links
  document.addEventListener("mouseover", (e) => {
    if (settings.mode === "off") return;
    if (!getAudioContext(true)) return;

    const target = e.target as HTMLElement;
    const inDMs = window.location.pathname.includes("/messages") ||
                  window.location.pathname.includes("/i/chat");
    if (!inDMs) return;

    // Chat list items: links inside dm-container that navigate to a conversation
    const chatLink = target.closest('a[href*="/messages/"], a[href*="/i/chat/"]') as HTMLElement | null;
    if (chatLink && !soundsAttached.has(chatLink)) {
      soundsAttached.add(chatLink);
      playTone(600, 0.04, "sine", 0.03, 0, 0.01);
    }
  }, { passive: true });

}


// Poll for new DM messages by tracking seen message UUIDs.
// Self-starting: runs a global 500ms interval that checks if we're on a DM page.
// Suppresses the pip for 2s after any user interaction to avoid false positives
// caused by Twitter regenerating DOM nodes with new UUIDs on re-render.
const seenMessageIds = new Set<string>();
let dmPollStarted = false;
let wasInDMs = false;
let lastUserInteraction = 0;

export function observeIncomingMessages(): void {
  if (dmPollStarted) return;
  dmPollStarted = true;

  // Track sends to suppress false pips (Twitter re-renders on send create new UUIDs)
  const markSend = () => { lastUserInteraction = Date.now(); };
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) markSend();
  }, { passive: true, capture: true });

  setInterval(() => {
    const inDMs = window.location.pathname.includes("/messages") ||
                  window.location.pathname.includes("/i/chat");

    if (!inDMs) {
      if (wasInDMs) {
        seenMessageIds.clear();
        wasInDMs = false;
      }
      return;
    }

    // Seed on first poll after entering DMs
    if (!wasInDMs) {
      wasInDMs = true;
      lastUserInteraction = Date.now();
      for (const msg of Array.from(document.querySelectorAll(DM_MESSAGE))) {
        const id = msg.getAttribute("data-testid");
        if (id) seenMessageIds.add(id);
      }
      return;
    }

    if (!settings.soundEnabled || settings.mode === "off") return;
    if (document.hidden) return;

    // Suppress pip for 2s after user interaction (Twitter re-renders create new UUIDs)
    if (Date.now() - lastUserInteraction < 2000) {
      // Still update the seen set so we don't false-trigger after cooldown
      for (const msg of Array.from(document.querySelectorAll(DM_MESSAGE))) {
        const id = msg.getAttribute("data-testid");
        if (id) seenMessageIds.add(id);
      }
      return;
    }

    let hasNew = false;
    for (const msg of Array.from(document.querySelectorAll(DM_MESSAGE))) {
      const id = msg.getAttribute("data-testid");
      if (id && !seenMessageIds.has(id)) {
        seenMessageIds.add(id);
        hasNew = true;
      }
    }

    if (hasNew) {
      playMessageBlip();
    }
  }, 250);
}
