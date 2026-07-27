import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "./shared/defaults";
import { SpeechController, splitSpeechText } from "./speech";
import type { TtsEngine } from "./ttsEngines";

describe("splitSpeechText", () => {
  it("keeps short text in one transport chunk", () => {
    expect(splitSpeechText("A short paragraph.")).toEqual([{ text: "A short paragraph.", offset: 0 }]);
  });

  it("caps ordered transport chunks without defining UI navigation", () => {
    const text = Array.from(
      { length: 40 },
      (_, index) => `Sentence ${index + 1} has enough readable words to exercise paragraph navigation.`,
    ).join(" ");
    const chunks = splitSpeechText(text, 25);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 1200)).toBe(true);
    expect(chunks[0]?.offset).toBe(25);
    expect(chunks.every((chunk, index) => index === 0 || chunk.offset > chunks[index - 1]!.offset)).toBe(true);
  });
});

describe("SpeechController movement", () => {
  it("preserves paused state when jumping to an exact reading boundary", async () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    const originalUtterance = Object.getOwnPropertyDescriptor(globalThis, "SpeechSynthesisUtterance");
    const pause = vi.fn();
    const speechSynthesis = {
      cancel: vi.fn(),
      getVoices: () => [],
      pause,
      resume: vi.fn(),
      speak: vi.fn(),
    };
    class FakeUtterance {
      onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      rate = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;

      constructor(readonly text: string) {}
    }

    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", {
      configurable: true,
      value: FakeUtterance,
    });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { speechSynthesis, SpeechSynthesisUtterance: FakeUtterance },
    });

    try {
      const controller = new SpeechController({ ...DEFAULT_SETTINGS });
      controller.speak("First sentence. Second sentence.", "Post");
      controller.pauseOrResume();
      expect(controller.getState().status).toBe("paused");

      controller.jumpToCharIndex(16);
      expect(controller.getState().status).toBe("paused");
      expect(controller.getState().charIndex).toBe(16);

      await Promise.resolve();
      await Promise.resolve();
      expect(controller.getState().status).toBe("paused");
    } finally {
      if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
      else Reflect.deleteProperty(globalThis, "window");
      if (originalUtterance) Object.defineProperty(globalThis, "SpeechSynthesisUtterance", originalUtterance);
      else Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
    }
  });
});

describe("SpeechController selected-voice priming", () => {
  it("waits for an isolated prime, then queues the real utterance on a later task", async () => {
    let finishPrime: (() => void) | undefined;
    const speak = vi.fn(async () => ({ pause: vi.fn(), resume: vi.fn(), stop: vi.fn(), hasSyncedBoundaries: false }));
    const engine: TtsEngine = {
      id: "web-speech",
      label: "Test",
      capabilities: { voices: true, boundaryEvents: true, seek: false },
      primeSelectedVoice: vi.fn(() => new Promise<void>((resolve) => { finishPrime = resolve; })),
      speak,
    };
    const controller = new SpeechController({ ...DEFAULT_SETTINGS });
    (controller as unknown as { engine: TtsEngine }).engine = engine;

    controller.speak("First real post.", "Post");
    expect(engine.primeSelectedVoice).toHaveBeenCalledOnce();
    expect(speak).not.toHaveBeenCalled();
    expect(controller.getState().isPriming).toBe(true);

    finishPrime?.();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(speak).toHaveBeenCalledOnce();
    expect(controller.getState().isPriming).toBe(false);
  });

  it("does not queue stale real speech when stopped during priming", async () => {
    let finishPrime: (() => void) | undefined;
    const speak = vi.fn(async () => ({ pause: vi.fn(), resume: vi.fn(), stop: vi.fn(), hasSyncedBoundaries: false }));
    const engine: TtsEngine = {
      id: "web-speech",
      label: "Test",
      capabilities: { voices: true, boundaryEvents: true, seek: false },
      primeSelectedVoice: vi.fn((_settings, signal) => new Promise<void>((resolve) => {
        finishPrime = resolve;
        signal?.addEventListener("abort", resolve, { once: true });
      })),
      speak,
    };
    const controller = new SpeechController({ ...DEFAULT_SETTINGS });
    (controller as unknown as { engine: TtsEngine }).engine = engine;

    controller.speak("A post that must not revive.", "Post");
    controller.stop();
    finishPrime?.();
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(speak).not.toHaveBeenCalled();
  });
});
