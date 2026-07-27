import { afterEach, describe, expect, it, vi } from "vitest";
import type { PostReadingSettings } from "./shared/types";
import { WebSpeechEngine } from "./ttsEngines";

class FakeUtterance {
  rate = 1;
  volume = 1;
  voice: SpeechSynthesisVoice | null = null;
  onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(readonly text: string) {}
}

afterEach(() => vi.unstubAllGlobals());

describe("WebSpeechEngine", () => {
  it("clears a stale global pause before queueing speech", async () => {
    const calls: string[] = [];
    const speechSynthesis = {
      cancel: vi.fn(() => calls.push("cancel")),
      getVoices: vi.fn(() => []),
      pause: vi.fn(() => calls.push("pause")),
      resume: vi.fn(() => calls.push("resume")),
      speak: vi.fn(() => calls.push("speak")),
    };
    vi.stubGlobal("window", {
      speechSynthesis,
      SpeechSynthesisUtterance: FakeUtterance,
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    });
    vi.stubGlobal("SpeechSynthesisUtterance", FakeUtterance);

    const engine = new WebSpeechEngine(() => null);
    await engine.speak({
      text: "Reader playback should start.",
      settings: { speed: 1, volume: 1, voiceURI: null, autoVoice: true } as PostReadingSettings,
      onBoundary: vi.fn(),
      onStart: vi.fn(),
      onEnd: vi.fn(),
      onError: vi.fn(),
    });

    expect(calls).toEqual(["resume", "speak"]);
  });
});
