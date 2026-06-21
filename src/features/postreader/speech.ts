import type { PostreaderSettings, SpeechState, SpeechStatus } from "./shared/types";

type Listener = (state: SpeechState) => void;
type SpeechChunk = {
  text: string;
  offset: number;
};
export type BoundarySupport = "supported" | "unsupported" | "unknown";

export class SpeechController {
  private settings: PostreaderSettings;
  private listeners = new Set<Listener>();
  private utterances: SpeechSynthesisUtterance[] = [];
  private chunks: SpeechChunk[] = [];
  private index = 0;
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
  };
  private onEnded: (() => void) | null = null;
  private suppressNextEnd = false;

  constructor(settings: PostreaderSettings) {
    this.settings = settings;
  }

  setSettings(settings: PostreaderSettings): void {
    this.settings = settings;
  }

  applySettings(settings: PostreaderSettings): void {
    const previous = this.settings;
    const shouldRestart = (
      previous.speed !== settings.speed ||
      previous.volume !== settings.volume ||
      previous.voiceURI !== settings.voiceURI ||
      previous.autoVoice !== settings.autoVoice
    ) && (this.state.status === "speaking" || this.state.status === "paused") && this.state.text;

    const wasPaused = this.state.status === "paused";
    const restartAt = this.state.charIndex ?? this.chunks[this.index]?.offset ?? 0;
    const title = this.state.title;
    const text = this.state.text;
    this.settings = settings;

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
    if (!("speechSynthesis" in window)) return [];
    return window.speechSynthesis.getVoices();
  }

  getPreferredVoice(): SpeechSynthesisVoice | null {
    return choosePreferredVoice(this.getVoices(), this.settings.voiceURI);
  }

  async probeBoundarySupport(voice: SpeechSynthesisVoice): Promise<boolean> {
    return probeVoiceBoundarySupport(voice);
  }

  onComplete(callback: (() => void) | null): void {
    this.onEnded = callback;
  }

  speak(text: string, title: string): void {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      this.setState("error", title, text, "Speech synthesis is not available in this browser.");
      return;
    }

    window.speechSynthesis.cancel();
    this.index = 0;
    this.chunks = splitText(text);
    this.utterances = this.chunks.map((chunk) => this.createUtterance(chunk, title, text));
    if (this.utterances.length === 0) {
      this.setState("idle", title, text, null);
      return;
    }
    this.setState("speaking", title, text, null);
    window.speechSynthesis.speak(this.utterances[this.index]);
  }

  private restartFrom(text: string, title: string, charIndex: number, pauseAfterStart: boolean, exact = false): void {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    const startAt = Math.max(0, Math.min(text.length, exact ? charIndex : findRestartBoundary(text, charIndex)));
    const remaining = text.slice(startAt).trimStart();
    if (!remaining) {
      this.stop();
      this.onEnded?.();
      return;
    }
    const trimOffset = text.slice(startAt).length - remaining.length;
    this.suppressNextEnd = true;
    window.speechSynthesis.cancel();
    this.index = 0;
    this.chunks = splitText(remaining, startAt + trimOffset);
    this.utterances = this.chunks.map((chunk) => this.createUtterance(chunk, title, text));
    this.setState(pauseAfterStart ? "paused" : "speaking", title, text, null, startAt + trimOffset, null);
    window.setTimeout(() => {
      this.suppressNextEnd = false;
      if (this.utterances[0]) {
        window.speechSynthesis.speak(this.utterances[0]);
        if (pauseAfterStart) window.speechSynthesis.pause();
      }
    }, 0);
  }

  nextChunk(): void {
    this.jumpChunk(1);
  }

  jumpToCharIndex(charIndex: number): void {
    if (!this.state.text) return;
    this.restartFrom(this.state.text, this.state.title || "Postreader", charIndex, false, true);
  }

  previousChunk(): void {
    this.jumpChunk(-1);
  }

  pauseOrResume(): void {
    if (!("speechSynthesis" in window)) return;
    if (window.speechSynthesis.paused || this.state.status === "paused") {
      window.speechSynthesis.resume();
      this.setState("speaking", this.state.title, this.state.text, null);
    } else if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      this.setState("paused", this.state.title, this.state.text, null);
    } else if (this.state.text) {
      this.speak(this.state.text, this.state.title || "Postreader");
    }
  }

  stop(): void {
    this.suppressNextEnd = true;
    this.utterances = [];
    this.chunks = [];
    this.index = 0;
    this.setState("idle", "", "", null);
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    window.setTimeout(() => {
      this.suppressNextEnd = false;
    }, 0);
  }

  private jumpChunk(direction: 1 | -1): void {
    if (!("speechSynthesis" in window) || this.utterances.length === 0) return;
    const nextIndex = Math.min(this.utterances.length - 1, Math.max(0, this.index + direction));
    if (nextIndex === this.index && direction > 0) {
      this.onEnded?.();
      return;
    }
    this.suppressNextEnd = true;
    window.speechSynthesis.cancel();
    this.index = nextIndex;
    this.setState("speaking", this.state.title, this.state.text, null, this.chunks[this.index]?.offset ?? null, null);
    window.setTimeout(() => {
      this.suppressNextEnd = false;
      window.speechSynthesis.speak(this.utterances[this.index]);
    }, 0);
  }

  private createUtterance(chunk: SpeechChunk, title: string, fullText: string): SpeechSynthesisUtterance {
    const utterance = new SpeechSynthesisUtterance(chunk.text);
    utterance.rate = this.settings.speed;
    utterance.volume = this.settings.volume;
    const voice = choosePreferredVoice(this.getVoices(), this.settings.voiceURI, this.settings.autoVoice);
    if (voice) utterance.voice = voice;

    utterance.onboundary = (event) => {
      const charIndex = chunk.offset + event.charIndex;
      const charLength = typeof event.charLength === "number" && event.charLength > 0 ? event.charLength : null;
      this.setState("speaking", title, fullText, null, charIndex, charLength);
    };

    utterance.onend = () => {
      if (this.suppressNextEnd) return;
      this.index += 1;
      if (this.index < this.utterances.length) {
        this.setState("speaking", title, fullText, null);
        window.speechSynthesis.speak(this.utterances[this.index]);
        return;
      }
      this.setState("idle", title, fullText, null);
      this.onEnded?.();
    };

    utterance.onerror = () => {
      if (this.suppressNextEnd) return;
      this.setState("error", title, fullText, "Speech playback failed.");
    };

    return utterance;
  }

  private setState(
    status: SpeechStatus,
    title: string,
    text: string,
    error: string | null,
    charIndex: number | null = null,
    charLength: number | null = null,
  ): void {
    this.state = {
      status,
      title,
      text,
      error,
      chunkIndex: this.utterances.length > 0 ? this.index + 1 : 0,
      chunkCount: this.utterances.length,
      chunkStart: this.chunks[this.index]?.offset ?? null,
      charIndex,
      charLength,
    };
    for (const listener of this.listeners) listener(this.state);
  }
}

export async function probeVoiceBoundarySupport(voice: SpeechSynthesisVoice): Promise<boolean> {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance("Postreader checks whether this voice reports steady word timing for smooth highlighting.");
    utterance.voice = voice;
    utterance.rate = 1.15;
    utterance.volume = 0.05;
    let wordLikeBoundaries = 0;
    let lastCharIndex = -1;
    let settled = false;
    const hasEnoughBoundaries = () => wordLikeBoundaries >= 3;
    const finish = (result: boolean) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      try {
        window.speechSynthesis.cancel();
      } catch {}
      resolve(result);
    };
    const timeout = window.setTimeout(() => finish(hasEnoughBoundaries()), 5000);
    utterance.onboundary = (event) => {
      if (typeof event.charIndex !== "number" || event.charIndex <= lastCharIndex) return;
      lastCharIndex = event.charIndex;
      const name = typeof event.name === "string" ? event.name.toLowerCase() : "";
      if (!name || name === "word" || name === "sentence") {
        wordLikeBoundaries += 1;
      }
    };
    utterance.onend = () => finish(hasEnoughBoundaries());
    utterance.onerror = () => finish(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  });
}

export function choosePreferredVoice(
  voices: SpeechSynthesisVoice[],
  selectedVoiceURI: string | null,
  autoVoice = true,
): SpeechSynthesisVoice | null {
  if (selectedVoiceURI) {
    const selected = voices.find((voice) => voice.voiceURI === selectedVoiceURI);
    if (selected) return selected;
  }
  if (!autoVoice) return null;

  const english = voices.filter((voice) => /^en[-_]/i.test(voice.lang) || /^en$/i.test(voice.lang));
  const candidates = english.length > 0 ? english : voices;
  const ranked = [
    /Google US English/i,
    /Google UK English Female/i,
    /Google UK English/i,
    /Microsoft Aria/i,
    /Microsoft Jenny/i,
    /Samantha/i,
    /Alex/i,
  ];

  for (const pattern of ranked) {
    const match = candidates.find((voice) => pattern.test(voice.name) || pattern.test(voice.voiceURI));
    if (match) return match;
  }

  return candidates.find((voice) => voice.default) || candidates[0] || null;
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
