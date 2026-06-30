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
  private activeHasSyncedBoundaries = true;
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
    hasSyncedBoundaries: true,
  };
  private onEnded: (() => void) | null = null;

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

  speak(text: string, title: string): void {
    this.stopActiveSession();
    this.index = 0;
    this.chunks = splitText(text);
    this.activeHasSyncedBoundaries = this.engine.capabilities.boundaryEvents;
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
    this.chunks = splitText(remaining, startAt + trimOffset);
    this.activeHasSyncedBoundaries = this.engine.capabilities.boundaryEvents;
    this.setState(pauseAfterStart ? "paused" : "speaking", title, text, null, startAt + trimOffset, null);
    this.startCurrentChunk(title, text, pauseAfterStart);
  }

  nextChunk(): void {
    this.jumpChunk(1);
  }

  jumpToCharIndex(charIndex: number): void {
    if (!this.state.text) return;
    this.restartFrom(this.state.text, this.state.title || "Post-reading", charIndex, false, true);
  }

  previousChunk(): void {
    this.jumpChunk(-1);
  }

  pauseOrResume(): void {
    if (this.state.status === "paused") {
      const restartAt = this.state.charIndex ?? this.state.chunkStart ?? 0;
      this.restartFrom(this.state.text, this.state.title || "Post-reading", restartAt, false, true);
    } else if (this.state.status === "speaking") {
      const pauseAt = this.state.charIndex ?? this.state.chunkStart ?? null;
      const charLength = this.state.charLength;
      const boundaryElapsedTime = this.state.boundaryElapsedTime;
      const title = this.state.title;
      const text = this.state.text;
      this.stopActiveSession();
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
    const generation = ++this.generation;
    this.engine.speak({
      text: chunk.text,
      settings: this.settings,
      onBoundary: (event) => {
        if (generation !== this.generation) return;
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
      if (generation !== this.generation) {
        session.stop();
        return;
      }
      this.session = session;
      this.activeHasSyncedBoundaries = session.hasSyncedBoundaries;
      this.setState(this.state.status, title, fullText, null, this.state.charIndex, this.state.charLength, this.state.boundaryElapsedTime);
      if (pauseAfterStart || this.state.status === "paused") {
        session.pause();
      }
    }).catch((error) => {
      if (generation !== this.generation) return;
      const message = error instanceof Error ? error.message : "Speech playback failed.";
      this.setState("error", title, fullText, message);
    });
  }

  private stopActiveSession(): void {
    this.generation += 1;
    this.session?.stop();
    this.session = null;
    this.activeHasSyncedBoundaries = this.engine.capabilities.boundaryEvents;
  }

  hasSyncedBoundaries(): boolean {
    return this.activeHasSyncedBoundaries;
  }

  private setState(
    status: SpeechStatus,
    title: string,
    text: string,
    error: string | null,
    charIndex: number | null = null,
    charLength: number | null = null,
    boundaryElapsedTime: number | null = null,
  ): void {
    this.state = {
      status,
      title,
      text,
      error,
      chunkIndex: this.chunks.length > 0 ? this.index + 1 : 0,
      chunkCount: this.chunks.length,
      chunkStart: this.chunks[this.index]?.offset ?? null,
      charIndex,
      charLength,
      boundaryElapsedTime,
      hasSyncedBoundaries: this.hasSyncedBoundaries(),
    };
    for (const listener of this.listeners) listener(this.state);
  }
}

function splitText(text: string, absoluteOffset = 0): SpeechChunk[] {
  const normalized = text.trim();
  if (!normalized) return [];
  const leadingTrim = text.search(/\S/);
  const baseOffset = absoluteOffset + (leadingTrim >= 0 ? leadingTrim : 0);
  if (normalized.length <= 220) return [{ text: normalized, offset: baseOffset }];

  const chunks: SpeechChunk[] = [];
  let remaining = normalized;
  let offset = baseOffset;
  while (remaining.length > 0) {
    const slice = remaining.slice(0, 220);
    const boundary = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "), slice.lastIndexOf(", "));
    const end = boundary > 80 ? boundary + 1 : Math.min(220, remaining.length);
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
