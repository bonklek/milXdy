import type { PostReadingSettings, SpeechState, SpeechStatus } from "./shared/types";
import { createTtsEngine, type TtsEngine, type TtsSession } from "./ttsEngines";

type Listener = (state: SpeechState) => void;
type SpeechChunk = {
  text: string;
  offset: number;
};
export type BoundarySupport = "supported" | "unsupported" | "unknown";

export class SpeechController {
  private settings: PostReadingSettings;
  private listeners = new Set<Listener>();
  private engine: TtsEngine;
  private session: TtsSession | null = null;
  private chunks: SpeechChunk[] = [];
  private index = 0;
  private generation = 0;
  private pendingAbort: AbortController | null = null;
  private primingAbort: AbortController | null = null;
  private currentStartPrimed = false;
  private activeHasSyncedBoundaries = false;
  private activeStarted = false;
  private startWatchdog: number | null = null;
  private state: SpeechState = {
    status: "idle",
    title: "",
    text: "",
    error: null,
    chunkIndex: 0,
    chunkCount: 0,
    chunkStart: null,
    charIndex: null,
    charLength: null,
    boundaryElapsedTime: null,
    hasSyncedBoundaries: false,
    hasStarted: false,
  };
  private onEnded: (() => void) | null = null;
  private onObservedBoundary: ((voiceURI: string) => void) | null = null;
  private observedVoiceURI: string | null = null;

  constructor(settings: PostReadingSettings) {
    this.settings = settings;
    this.engine = createTtsEngine(settings);
  }

  setSettings(settings: PostReadingSettings): void {
    this.settings = settings;
    this.engine = createTtsEngine(settings);
  }

  applySettings(settings: PostReadingSettings): void {
    const previous = this.settings;
    const shouldRestart = (
      previous.speed !== settings.speed ||
      previous.volume !== settings.volume ||
      previous.voiceURI !== settings.voiceURI ||
      previous.autoVoice !== settings.autoVoice ||
      previous.ttsEngine !== settings.ttsEngine ||
      previous.customTtsEndpoint !== settings.customTtsEndpoint ||
      previous.customTtsTimingMode !== settings.customTtsTimingMode
    ) && (this.state.status === "speaking" || this.state.status === "paused") && this.state.text;

    const wasPaused = this.state.status === "paused";
    const restartAt = this.state.charIndex ?? this.chunks[this.index]?.offset ?? 0;
    const title = this.state.title;
    const text = this.state.text;
    this.settings = settings;
    this.engine = createTtsEngine(settings);

    if (!shouldRestart) return;

    this.restartFrom(text, title, restartAt, wasPaused);
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  getState(): SpeechState {
    return this.state;
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.engine.getVoices?.() ?? [];
  }

  getPreferredVoice(): SpeechSynthesisVoice | null {
    return this.engine.getPreferredVoice?.() ?? null;
  }

  async probeBoundarySupport(voice: SpeechSynthesisVoice, signal?: AbortSignal): Promise<boolean> {
    return this.engine.probeBoundarySupport?.(voice, signal) ?? false;
  }

  onComplete(callback: (() => void) | null): void {
    this.onEnded = callback;
  }

  onBoundaryObserved(callback: ((voiceURI: string) => void) | null): void {
    this.onObservedBoundary = callback;
  }

  speak(text: string, title: string): void {
    this.stopActiveSession();
    this.index = 0;
    this.chunks = splitSpeechText(text);
    this.activeHasSyncedBoundaries = false;
    this.activeStarted = false;
    this.currentStartPrimed = false;
    if (this.chunks.length === 0) {
      this.setState("idle", title, text, null);
      return;
    }
    this.setState("speaking", title, text, null);
    this.startCurrentChunk(title, text);
  }

  private restartFrom(text: string, title: string, charIndex: number, pauseAfterStart: boolean, exact = false): void {
    const startAt = Math.max(0, Math.min(text.length, exact ? charIndex : findRestartBoundary(text, charIndex)));
    const remaining = text.slice(startAt).trimStart();
    if (!remaining) {
      this.stop();
      this.onEnded?.();
      return;
    }
    const trimOffset = text.slice(startAt).length - remaining.length;
    this.stopActiveSession();
    this.index = 0;
    this.chunks = splitSpeechText(remaining, startAt + trimOffset);
    this.activeHasSyncedBoundaries = false;
    this.activeStarted = false;
    this.currentStartPrimed = false;
    this.setState(pauseAfterStart ? "paused" : "speaking", title, text, null, startAt + trimOffset, null);
    const restartGeneration = this.generation;
    // Web Speech must observe cancel before its replacement is queued.
    // A macrotask also keeps stale cancellation callbacks from reviving it.
    (window.setTimeout || globalThis.setTimeout)(() => {
      if (restartGeneration !== this.generation) return;
      this.startCurrentChunk(title, text, pauseAfterStart);
    }, 0);
  }

  nextChunk(): void {
    this.jumpChunk(1);
  }

  jumpToCharIndex(charIndex: number): void {
    if (!this.state.text) return;
    const wasPaused = this.state.status === "paused";
    this.restartFrom(this.state.text, this.state.title || "Post-reading", charIndex, wasPaused, true);
  }

  previousChunk(): void {
    this.jumpChunk(-1);
  }

  pauseOrResume(): void {
    if (this.state.status === "paused") {
      this.session?.resume();
      this.setState("speaking", this.state.title, this.state.text, null, this.state.charIndex, this.state.charLength, this.state.boundaryElapsedTime);
    } else if (this.state.status === "speaking") {
      const pauseAt = this.state.charIndex ?? this.state.chunkStart ?? null;
      const charLength = this.state.charLength;
      const boundaryElapsedTime = this.state.boundaryElapsedTime;
      const title = this.state.title;
      const text = this.state.text;
      this.session?.pause();
      this.setState("paused", title, text, null, pauseAt, charLength, boundaryElapsedTime);
    } else if (this.state.text) {
      this.speak(this.state.text, this.state.title || "Post-reading");
    }
  }

  stop(): void {
    this.stopActiveSession();
    this.chunks = [];
    this.index = 0;
    this.setState("idle", "", "", null);
  }

  private jumpChunk(direction: 1 | -1): void {
    if (this.chunks.length === 0) return;
    const nextIndex = Math.min(this.chunks.length - 1, Math.max(0, this.index + direction));
    if (nextIndex === this.index && direction > 0) {
      this.onEnded?.();
      return;
    }
    this.stopActiveSession();
    this.index = nextIndex;
    this.setState("speaking", this.state.title, this.state.text, null, this.chunks[this.index]?.offset ?? null, null);
    this.startCurrentChunk(this.state.title, this.state.text);
  }

  private startCurrentChunk(title: string, fullText: string, pauseAfterStart = false): void {
    const chunk = this.chunks[this.index];
    if (!chunk) return;
    if (this.index === 0 && !this.currentStartPrimed && this.engine.primeSelectedVoice) {
      this.currentStartPrimed = true;
      // The probe deliberately produces no post highlight progress, but the
      // player must make this short initialization visible.
      this.setState("speaking", title, fullText, null, this.state.charIndex ?? chunk.offset, null, null, true);
      const primeGeneration = ++this.generation;
      const primingAbort = new AbortController();
      this.primingAbort = primingAbort;
      void this.engine.primeSelectedVoice(this.settings, primingAbort.signal).finally(() => {
        if (this.primingAbort === primingAbort) this.primingAbort = null;
        if (primingAbort.signal.aborted || primeGeneration !== this.generation) return;
        (globalThis.window?.setTimeout || globalThis.setTimeout)(() => {
          if (primeGeneration === this.generation && !primingAbort.signal.aborted) this.startCurrentChunk(title, fullText, pauseAfterStart);
        }, 0);
      });
      return;
    }
    const generation = ++this.generation;
    const pendingAbort = new AbortController();
    this.pendingAbort = pendingAbort;
    this.engine.speak({
      text: chunk.text,
      settings: this.settings,
      signal: pendingAbort.signal,
      onStart: () => {
        if (generation !== this.generation) return;
        this.activeStarted = true;
        this.clearStartWatchdog();
        this.setState(this.state.status, title, fullText, null, this.state.charIndex, this.state.charLength, this.state.boundaryElapsedTime);
      },
      onBoundary: (event) => {
        if (generation !== this.generation) return;
        this.activeStarted = true;
        this.activeHasSyncedBoundaries = true;
        const voiceURI = this.engine.getPreferredVoice?.()?.voiceURI || null;
        if (voiceURI && this.observedVoiceURI !== voiceURI) {
          this.observedVoiceURI = voiceURI;
          this.onObservedBoundary?.(voiceURI);
        }
        this.clearStartWatchdog();
        const charIndex = chunk.offset + event.charIndex;
        this.setState(this.state.status === "paused" ? "paused" : "speaking", title, fullText, null, charIndex, event.charLength, event.elapsedTime ?? null);
      },
      onEnd: () => {
        if (generation !== this.generation) return;
        this.index += 1;
        if (this.index < this.chunks.length) {
          this.setState("speaking", title, fullText, null);
          this.startCurrentChunk(title, fullText);
          return;
        }
        this.setState("idle", title, fullText, null);
        this.onEnded?.();
      },
      onError: (message) => {
        if (generation !== this.generation) return;
        this.setState("error", title, fullText, message);
      },
    }).then((session) => {
      if (this.pendingAbort === pendingAbort) this.pendingAbort = null;
      if (generation !== this.generation) {
        session.stop();
        return;
      }
      this.session = session;
      this.activeHasSyncedBoundaries = session.hasSyncedBoundaries && this.activeHasSyncedBoundaries;
      this.setState(this.state.status, title, fullText, null, this.state.charIndex, this.state.charLength, this.state.boundaryElapsedTime);
      this.startWatchdog = (window.setTimeout || globalThis.setTimeout)(() => {
        if (generation !== this.generation || this.activeStarted) return;
        this.setState("error", title, fullText, "Speech playback did not start.");
        this.stopActiveSession();
      }, 5_000);
      if (pauseAfterStart || this.state.status === "paused") {
        session.pause();
      }
    }).catch((error) => {
      if (this.pendingAbort === pendingAbort) this.pendingAbort = null;
      if (generation !== this.generation) return;
      const message = error instanceof Error ? error.message : "Speech playback failed.";
      this.setState("error", title, fullText, message);
    });
  }

  private stopActiveSession(): void {
    this.generation += 1;
    this.primingAbort?.abort();
    this.primingAbort = null;
    this.pendingAbort?.abort();
    this.pendingAbort = null;
    this.session?.stop();
    this.session = null;
    this.clearStartWatchdog();
    this.activeHasSyncedBoundaries = false;
    this.activeStarted = false;
    this.observedVoiceURI = null;
  }

  hasSyncedBoundaries(): boolean {
    return this.activeHasSyncedBoundaries;
  }

  private clearStartWatchdog(): void {
    if (this.startWatchdog !== null) (window.clearTimeout || globalThis.clearTimeout)(this.startWatchdog);
    this.startWatchdog = null;
  }

  private setState(
    status: SpeechStatus,
    title: string,
    text: string,
    error: string | null,
    charIndex: number | null = null,
    charLength: number | null = null,
    boundaryElapsedTime: number | null = null,
    isPriming = false,
  ): void {
    this.state = {
      status,
      title,
      text,
      error,
      chunkIndex: this.chunks.length > 0 ? this.index + 1 : 0,
      chunkCount: this.chunks.length,
      chunkStart: this.chunks[this.index]?.offset ?? null,
      charIndex: typeof charIndex === "number" && Number.isFinite(charIndex) && charIndex >= 0 ? charIndex : null,
      charLength,
      boundaryElapsedTime,
      hasSyncedBoundaries: this.hasSyncedBoundaries(),
      hasStarted: this.activeStarted,
      isPriming,
    };
    for (const listener of this.listeners) listener(this.state);
  }
}

export function splitSpeechText(text: string, absoluteOffset = 0): SpeechChunk[] {
  const normalized = text.trim();
  if (!normalized) return [];
  const leadingTrim = text.search(/\S/);
  const baseOffset = absoluteOffset + (leadingTrim >= 0 ? leadingTrim : 0);
  const maxChunkLength = 1200;
  const minBoundaryLength = 650;
  if (normalized.length <= maxChunkLength) return [{ text: normalized, offset: baseOffset }];

  const chunks: SpeechChunk[] = [];
  let remaining = normalized;
  let offset = baseOffset;
  while (remaining.length > 0) {
    if (remaining.length <= maxChunkLength) {
      const finalText = remaining.trim();
      const localTrim = remaining.search(/\S/);
      if (finalText) chunks.push({ text: finalText, offset: offset + Math.max(0, localTrim) });
      break;
    }
    const slice = remaining.slice(0, maxChunkLength);
    const paragraphBoundary = slice.lastIndexOf("\n\n");
    const sentenceBoundary = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
    const softBoundary = Math.max(paragraphBoundary, sentenceBoundary);
    const fallbackBoundary = slice.lastIndexOf(", ");
    const boundary = softBoundary > minBoundaryLength
      ? softBoundary
      : fallbackBoundary > minBoundaryLength
        ? fallbackBoundary
        : maxChunkLength;
    const end = boundary < maxChunkLength ? boundary + 1 : Math.min(maxChunkLength, remaining.length);
    const rawChunk = remaining.slice(0, end);
    const chunkText = rawChunk.trim();
    const localTrim = rawChunk.search(/\S/);
    if (chunkText) chunks.push({ text: chunkText, offset: offset + Math.max(0, localTrim) });
    const nextRemaining = remaining.slice(end);
    offset += end + (nextRemaining.match(/^\s+/)?.[0].length ?? 0);
    remaining = nextRemaining.trimStart();
  }
  return chunks;
}

function findRestartBoundary(text: string, charIndex: number): number {
  const left = text.slice(0, charIndex);
  const sentence = Math.max(left.lastIndexOf(". "), left.lastIndexOf("! "), left.lastIndexOf("? "));
  if (sentence >= 0 && charIndex - sentence < 160) return sentence + 2;
  const word = left.search(/\S+\s*$/);
  return word >= 0 ? word : charIndex;
}
