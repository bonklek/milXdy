import type { PostReadingSettings } from "./shared/types";
import { hasKnownSyncedBoundaries } from "./voiceSupport";

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
  probeBoundarySupport?: (voice: SpeechSynthesisVoice) => Promise<boolean>;
};

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
    utterance.rate = request.settings.speed;
    utterance.volume = request.settings.volume;
    const voice = this.chooseVoice(this.getVoices(), request.settings.voiceURI, request.settings.autoVoice);
    if (voice) utterance.voice = voice;
    const startsWithKnownSyncedBoundaries = hasKnownSyncedBoundaries(voice);

    let stopped = false;
    utterance.onboundary = (event) => {
      if (stopped) return;
      request.onBoundary({
        charIndex: event.charIndex,
        charLength: typeof event.charLength === "number" && event.charLength > 0 ? event.charLength : null,
        elapsedTime: event.elapsedTime,
      });
    };
    utterance.onend = () => {
      if (!stopped) request.onEnd();
    };
    utterance.onerror = () => {
      if (!stopped) request.onError("Speech playback failed.");
    };

    window.speechSynthesis.speak(utterance);

    return {
      hasSyncedBoundaries: startsWithKnownSyncedBoundaries,
      pause: () => window.speechSynthesis.pause(),
      resume: () => window.speechSynthesis.resume(),
      stop: () => {
        stopped = true;
        window.speechSynthesis.cancel();
      },
    };
  }

  getVoices(): SpeechSynthesisVoice[] {
    if (!("speechSynthesis" in window)) return [];
    return window.speechSynthesis.getVoices();
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
    const endpoint = request.settings.customTtsEndpoint?.trim();
    if (!endpoint) throw new Error("Custom TTS endpoint is not configured.");

    const abort = new AbortController();
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

    const payload = normalizeCustomResponse(await response.json());
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

    await audio.play();
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

export async function probeVoiceBoundarySupport(voice: SpeechSynthesisVoice): Promise<boolean> {
  if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return false;
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

function normalizeCustomResponse(value: unknown): { audioUrl: string; boundaries: CustomBoundary[]; revokeUrl: boolean } {
  const raw = value && typeof value === "object" ? value as CustomSpeechResponse : {};
  const audioUrl = typeof raw.audioUrl === "string" ? raw.audioUrl : null;
  const audioBase64 = typeof raw.audioBase64 === "string" ? raw.audioBase64 : null;
  if (!audioUrl && !audioBase64) throw new Error("Custom TTS response must include audioUrl or audioBase64.");
  const boundaries = Array.isArray(raw.boundaries)
    ? raw.boundaries.map(normalizeCustomBoundary).filter((entry): entry is CustomBoundary => Boolean(entry))
    : [];
  boundaries.sort((left, right) => left.elapsedTime - right.elapsedTime);

  if (audioUrl) return { audioUrl, boundaries, revokeUrl: false };

  const contentType = typeof raw.audioContentType === "string" ? raw.audioContentType : "audio/mpeg";
  const bytes = Uint8Array.from(atob(audioBase64!), (char) => char.charCodeAt(0));
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: contentType }));
  return { audioUrl: blobUrl, boundaries, revokeUrl: true };
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
