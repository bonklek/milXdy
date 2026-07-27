import type { PostReadingSettings } from "./shared/types";

export type TtsBoundary = {
  charIndex: number;
  charLength: number | null;
  elapsedTime?: number;
};

export type TtsEngineCapabilities = {
  voices: boolean;
  boundaryEvents: boolean;
  seek: boolean;
};

export type TtsRequest = {
  text: string;
  settings: PostReadingSettings;
  signal?: AbortSignal;
  onStart: () => void;
  onBoundary: (boundary: TtsBoundary) => void;
  onEnd: () => void;
  onError: (message: string) => void;
};

export type TtsSession = {
  pause: () => void;
  resume: () => void;
  stop: () => void;
  hasSyncedBoundaries: boolean;
  seekToCharIndex?: (charIndex: number) => void;
};

export type TtsEngine = {
  id: string;
  label: string;
  capabilities: TtsEngineCapabilities;
  speak: (request: TtsRequest) => Promise<TtsSession>;
  getVoices?: () => SpeechSynthesisVoice[];
  getPreferredVoice?: () => SpeechSynthesisVoice | null;
  probeBoundarySupport?: (voice: SpeechSynthesisVoice, signal?: AbortSignal) => Promise<boolean>;
  primeSelectedVoice?: (settings: PostReadingSettings, signal?: AbortSignal) => Promise<void>;
};

const primedVoiceUris = new Set<string>();

type CustomSpeechResponse = {
  audioUrl?: unknown;
  audioBase64?: unknown;
  audioContentType?: unknown;
  boundaries?: unknown;
};

type CustomBoundary = {
  charIndex: number;
  charLength: number | null;
  elapsedTime: number;
};

const MAX_CUSTOM_TTS_AUDIO_BYTES = 20 * 1024 * 1024;
const CUSTOM_TTS_AUDIO_TYPES = new Set(["audio/mpeg", "audio/mp3", "audio/wav", "audio/ogg", "audio/webm", "audio/mp4"]);

export class WebSpeechEngine implements TtsEngine {
  readonly id = "web-speech";
  readonly label = "Browser Web Speech";
  readonly capabilities = {
    voices: true,
    boundaryEvents: true,
    seek: false,
  };

  constructor(private chooseVoice: (voices: SpeechSynthesisVoice[], selectedVoiceURI: string | null, autoVoice: boolean) => SpeechSynthesisVoice | null) {}

  async speak(request: TtsRequest): Promise<TtsSession> {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      throw new Error("Speech synthesis is not available in this browser.");
    }

    const utterance = new SpeechSynthesisUtterance(request.text);
    const speechSynthesis = window.speechSynthesis;
    utterance.rate = request.settings.speed;
    utterance.volume = request.settings.volume;
    const voice = this.chooseVoice(this.getVoices(), request.settings.voiceURI, request.settings.autoVoice);
    if (voice) utterance.voice = voice;
    let stopped = false;
    let started = false;
    let startFallback: number | null = null;
    const acknowledgeStart = () => {
      if (stopped || started) return;
      started = true;
      if (startFallback !== null) window.clearTimeout(startFallback);
      startFallback = null;
      request.onStart();
    };
    const abortPlayback = () => {
      stopped = true;
      if (startFallback !== null) window.clearTimeout(startFallback);
      window.speechSynthesis.cancel();
    };
    request.signal?.addEventListener("abort", abortPlayback, { once: true });
    utterance.onboundary = (event) => {
      if (stopped) return;
      if (!Number.isFinite(event.charIndex) || event.charIndex < 0) return;
      request.onBoundary({
        charIndex: event.charIndex,
        charLength: typeof event.charLength === "number" && event.charLength > 0 ? event.charLength : null,
        elapsedTime: event.elapsedTime,
      });
    };
    utterance.onstart = acknowledgeStart;
    utterance.onend = () => {
      request.signal?.removeEventListener("abort", abortPlayback);
      if (!stopped) request.onEnd();
    };
    utterance.onerror = () => {
      request.signal?.removeEventListener("abort", abortPlayback);
      if (!stopped) request.onError("Speech playback failed.");
    };

    // Chrome can preserve the global paused flag after canceling an utterance.
    // A newly queued utterance then remains pending forever while the controller
    // optimistically reports "speaking". Clear that stale state before enqueueing.
    window.speechSynthesis.resume();
    window.speechSynthesis.speak(utterance);
    // Some Chromium voices speak without dispatching onstart. The synthesizer's
    // own live state is a bounded fallback acknowledgement, never a boundary.
    startFallback = window.setTimeout(() => {
      if (!stopped && speechSynthesis.speaking) acknowledgeStart();
    }, 120);

    return {
      hasSyncedBoundaries: false,
      pause: () => window.speechSynthesis.pause(),
      resume: () => window.speechSynthesis.resume(),
      stop: () => {
        stopped = true;
        if (startFallback !== null) window.clearTimeout(startFallback);
        request.signal?.removeEventListener("abort", abortPlayback);
        window.speechSynthesis.cancel();
      },
    };
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!("speechSynthesis" in window)) return [];
    return window.speechSynthesis.getVoices();
  }

  async primeSelectedVoice(settings: PostReadingSettings, signal?: AbortSignal): Promise<void> {
    const browserWindow = globalThis.window;
    if (!browserWindow || !("speechSynthesis" in browserWindow) || !("SpeechSynthesisUtterance" in browserWindow) || signal?.aborted) return;
    // A partial Web Speech shim cannot be primed safely. Browsers expose these
    // live state flags; their absence means leave the normal utterance alone.
    if (typeof browserWindow.speechSynthesis.speaking !== "boolean" && typeof browserWindow.speechSynthesis.pending !== "boolean") return;
    const voice = this.chooseVoice(this.getVoices(), settings.voiceURI, settings.autoVoice);
    const key = voice?.voiceURI || "default";
    if (primedVoiceUris.has(key)) return;
    await new Promise<void>((resolve) => {
      const utterance = new browserWindow.SpeechSynthesisUtterance("one two three four");
      utterance.voice = voice || null;
      // Chromium may not initialize a voice at near-zero volume. This is the
      // lowest level already proven by the manual boundary probe.
      utterance.volume = 0.05;
      utterance.rate = 2.5;
      let settled = false;
      let boundaries = 0;
      let lastIndex = -1;
      const schedule = globalThis.window?.setTimeout || globalThis.setTimeout;
      const cancelSchedule = globalThis.window?.clearTimeout || globalThis.clearTimeout;
      const finish = () => {
        if (settled) return;
        settled = true;
        cancelSchedule(timeout);
        signal?.removeEventListener("abort", finish);
        browserWindow.speechSynthesis.cancel();
        schedule(resolve, 0);
      };
      const timeout = schedule(finish, 750);
      utterance.onboundary = (event) => {
        if (event.charIndex > lastIndex) {
          lastIndex = event.charIndex;
          boundaries += 1;
          if (boundaries >= 2) finish();
        }
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      signal?.addEventListener("abort", finish, { once: true });
      browserWindow.speechSynthesis.cancel();
      browserWindow.speechSynthesis.resume();
      browserWindow.speechSynthesis.speak(utterance);
    });
    if (!signal?.aborted) primedVoiceUris.add(key);
  }
}

export class CustomHttpTtsEngine implements TtsEngine {
  readonly id = "custom-http";
  readonly label = "Custom HTTP endpoint";
  readonly capabilities = {
    voices: false,
    boundaryEvents: false,
    seek: true,
  };

  async speak(request: TtsRequest): Promise<TtsSession> {
    const endpoint = normalizeLocalTtsEndpoint(request.settings.customTtsEndpoint);
    if (!endpoint) throw new Error("Custom TTS endpoint is not configured.");

    const abort = new AbortController();
    const onRequestAbort = () => abort.abort();
    request.signal?.addEventListener("abort", onRequestAbort, { once: true });
    const deadline = window.setTimeout(() => abort.abort(), 30_000);
    let payload: ReturnType<typeof normalizeCustomResponse>;
    try {
      const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: request.text,
        rate: request.settings.speed,
        volume: request.settings.volume,
        voiceURI: request.settings.voiceURI,
      }),
      signal: abort.signal,
      });
      if (!response.ok) throw new Error(`Custom TTS endpoint returned HTTP ${response.status}.`);
      payload = normalizeCustomResponse(await response.json());
    } finally {
      window.clearTimeout(deadline);
      request.signal?.removeEventListener("abort", onRequestAbort);
    }
    if (request.signal?.aborted) {
      if (payload.revokeUrl) URL.revokeObjectURL(payload.audioUrl);
      throw new DOMException("Speech canceled", "AbortError");
    }
    const audio = new Audio(payload.audioUrl);
    audio.volume = request.settings.volume;
    const timers = new Set<number>();
    let stopped = false;
    let startedAt = 0;
    let pausedAt = 0;

    const clearTimers = () => {
      for (const timer of timers) window.clearTimeout(timer);
      timers.clear();
    };
    const scheduleBoundaries = (fromElapsed = 0) => {
      clearTimers();
      startedAt = performance.now() - fromElapsed * 1000;
      for (const boundary of payload.boundaries) {
        if (boundary.elapsedTime < fromElapsed) continue;
        const delay = Math.max(0, (boundary.elapsedTime - fromElapsed) * 1000);
        const timer = window.setTimeout(() => {
          timers.delete(timer);
          if (!stopped) request.onBoundary(boundary);
        }, delay);
        timers.add(timer);
      }
    };
    const currentElapsed = () => Math.max(0, (performance.now() - startedAt) / 1000);

    audio.addEventListener("ended", () => {
      if (stopped) return;
      clearTimers();
      request.onEnd();
    });
    audio.addEventListener("error", () => {
      if (stopped) return;
      clearTimers();
      request.onError("Custom TTS audio playback failed.");
    });

    const cancelPendingPlayback = () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (payload.revokeUrl) URL.revokeObjectURL(payload.audioUrl);
    };
    let startDeadline: number | null = null;
    let rejectPendingPlayback: (() => void) | null = null;
    const pendingPlaybackAbort = new Promise<never>((_, reject) => {
      const rejectCanceled = () => {
        cancelPendingPlayback();
        reject(new DOMException("Speech canceled", "AbortError"));
      };
      rejectPendingPlayback = rejectCanceled;
      request.signal?.addEventListener("abort", rejectCanceled, { once: true });
      startDeadline = window.setTimeout(() => {
        cancelPendingPlayback();
        reject(new Error("Custom TTS audio playback timed out"));
      }, 15_000);
    });
    try {
      await Promise.race([audio.play(), pendingPlaybackAbort]);
    } catch (error) {
      cancelPendingPlayback();
      throw error;
    } finally {
      if (startDeadline !== null) window.clearTimeout(startDeadline);
      if (rejectPendingPlayback) request.signal?.removeEventListener("abort", rejectPendingPlayback);
    }
    request.onStart();
    scheduleBoundaries(0);

    return {
      hasSyncedBoundaries: request.settings.customTtsTimingMode === "engine" && payload.boundaries.length > 0,
      pause: () => {
        if (stopped) return;
        pausedAt = currentElapsed();
        audio.pause();
        clearTimers();
      },
      resume: () => {
        if (stopped) return;
        void audio.play();
        scheduleBoundaries(pausedAt);
      },
      stop: () => {
        stopped = true;
        abort.abort();
        clearTimers();
        audio.pause();
        audio.removeAttribute("src");
        audio.load();
        if (payload.revokeUrl) URL.revokeObjectURL(payload.audioUrl);
      },
      seekToCharIndex: (charIndex) => {
        const boundary = payload.boundaries.find((entry) => entry.charIndex >= charIndex);
        if (!boundary || !Number.isFinite(audio.duration)) return;
        audio.currentTime = Math.min(audio.duration, Math.max(0, boundary.elapsedTime));
        scheduleBoundaries(audio.currentTime);
        request.onBoundary(boundary);
      },
    };
  }
}

export function createTtsEngine(settings: PostReadingSettings): TtsEngine {
  if (settings.ttsEngine === "custom-http") return new CustomHttpTtsEngine();
  const engine: TtsEngine = new WebSpeechEngine(choosePreferredVoice);
  engine.getPreferredVoice = () => choosePreferredVoice(engine.getVoices?.() ?? [], settings.voiceURI, settings.autoVoice);
  engine.probeBoundarySupport = probeVoiceBoundarySupport;
  return engine;
}

export async function probeVoiceBoundarySupport(voice: SpeechSynthesisVoice, signal?: AbortSignal): Promise<boolean> {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
  if (signal?.aborted) return false;
  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance("Post-reading checks whether this voice reports steady word timing for smooth highlighting.");
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
      signal?.removeEventListener("abort", onAbort);
      try {
        window.speechSynthesis.cancel();
      } catch {}
      resolve(result);
    };
    const onAbort = () => finish(false);
    signal?.addEventListener("abort", onAbort);
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
    window.speechSynthesis.resume();
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

function normalizeCustomResponse(value: unknown): { audioUrl: string; boundaries: CustomBoundary[]; revokeUrl: boolean } {
  const raw = value && typeof value === "object" ? value as CustomSpeechResponse : {};
  const audioUrl = typeof raw.audioUrl === "string" ? raw.audioUrl : null;
  const audioBase64 = typeof raw.audioBase64 === "string" ? raw.audioBase64 : null;
  if (!audioUrl && !audioBase64) throw new Error("Custom TTS response must include audioUrl or audioBase64.");
  const boundaries = Array.isArray(raw.boundaries)
    ? raw.boundaries.map(normalizeCustomBoundary).filter((entry): entry is CustomBoundary => Boolean(entry))
    : [];
  boundaries.sort((left, right) => left.elapsedTime - right.elapsedTime);

  if (audioUrl) return { audioUrl: normalizeLocalTtsAudioUrl(audioUrl), boundaries, revokeUrl: false };

  const contentType = normalizeCustomAudioContentType(raw.audioContentType);
  const estimatedBytes = estimateBase64Bytes(audioBase64!);
  if (estimatedBytes > MAX_CUSTOM_TTS_AUDIO_BYTES) throw new Error("Custom TTS audio response is too large.");
  const bytes = Uint8Array.from(atob(audioBase64!), (char) => char.charCodeAt(0));
  if (bytes.byteLength > MAX_CUSTOM_TTS_AUDIO_BYTES) throw new Error("Custom TTS audio response is too large.");
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  return { audioUrl: blobUrl, boundaries, revokeUrl: true };
}

function normalizeLocalTtsEndpoint(value: string | null | undefined): string {
  const raw = value?.trim();
  if (!raw) return "";
  const url = parseLocalHttpUrl(raw, "Custom TTS endpoint");
  return url.href;
}

function normalizeLocalTtsAudioUrl(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith("blob:")) return trimmed;
  const url = parseLocalHttpUrl(trimmed, "Custom TTS audio URL");
  return url.href;
}

function parseLocalHttpUrl(value: string, label: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid loopback HTTP URL.`);
  }
  const hostname = url.hostname.toLowerCase();
  const isLoopback = hostname === "localhost"
    || hostname === "127.0.0.1"
    || hostname === "::1"
    || hostname === "[::1]";
  if (url.protocol !== "http:" || !isLoopback || url.username || url.password) {
    throw new Error(`${label} must use http://localhost, http://127.0.0.1, or http://[::1].`);
  }
  return url;
}

function normalizeCustomAudioContentType(value: unknown): string {
  const contentType = typeof value === "string" ? value.split(";")[0].trim().toLowerCase() : "audio/mpeg";
  if (!CUSTOM_TTS_AUDIO_TYPES.has(contentType)) {
    throw new Error("Custom TTS audio response uses an unsupported content type.");
  }
  return contentType;
}

function estimateBase64Bytes(value: string): number {
  const normalized = value.replace(/\s+/g, "");
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((normalized.length * 3) / 4) - padding);
}

function normalizeCustomBoundary(value: unknown): CustomBoundary | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const charIndex = typeof raw.charIndex === "number" ? raw.charIndex : null;
  const elapsedTime = typeof raw.elapsedTime === "number" ? raw.elapsedTime : typeof raw.time === "number" ? raw.time : null;
  if (charIndex === null || elapsedTime === null || charIndex < 0 || elapsedTime < 0) return null;
  const charLength = typeof raw.charLength === "number" && raw.charLength > 0 ? raw.charLength : null;
  return { charIndex, charLength, elapsedTime };
}
