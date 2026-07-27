import { afterEach, describe, expect, it, vi } from "vitest";
import { TextHighlightEngine } from "./highlightEngine";
import { DEFAULT_SETTINGS } from "./shared/defaults";
import { SpeechController } from "./speech";

type FakeUtterance = {
  onboundary: ((event: SpeechSynthesisEvent) => void) | null;
};

let originalWindow: PropertyDescriptor | undefined;
let originalUtterance: PropertyDescriptor | undefined;

afterEach(() => {
  if (originalWindow) Object.defineProperty(globalThis, "window", originalWindow);
  else Reflect.deleteProperty(globalThis, "window");
  if (originalUtterance) Object.defineProperty(globalThis, "SpeechSynthesisUtterance", originalUtterance);
  else Reflect.deleteProperty(globalThis, "SpeechSynthesisUtterance");
  originalWindow = undefined;
  originalUtterance = undefined;
});

function token(start: number, text: string): HTMLElement {
  const properties = new Map<string, string>();
  return {
    dataset: {
      postReadingLength: String(text.length),
      postReadingStart: String(start),
    },
    isConnected: true,
    style: {
      getPropertyValue: (name: string) => properties.get(name) ?? "",
      removeProperty: (name: string) => {
        const previous = properties.get(name) ?? "";
        properties.delete(name);
        return previous;
      },
      setProperty: (name: string, value: string) => properties.set(name, value),
    } as unknown as CSSStyleDeclaration,
    textContent: text,
  } as unknown as HTMLElement;
}

describe("Post-reading startup highlight delivery", () => {
  it("delivers rapid startup states in order before a later boundary can catch up", () => {
    originalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
    originalUtterance = Object.getOwnPropertyDescriptor(globalThis, "SpeechSynthesisUtterance");
    const queuedAnimationFrames: FrameRequestCallback[] = [];
    const speechSynthesis = {
      cancel: vi.fn(),
      getVoices: () => [],
      pause: vi.fn(),
      resume: vi.fn(),
      speak: vi.fn(),
    };
    class BrowserUtterance {
      onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      rate = 1;
      volume = 1;
      voice: SpeechSynthesisVoice | null = null;

      constructor(readonly text: string) {}
    }
    Object.defineProperty(globalThis, "SpeechSynthesisUtterance", { configurable: true, value: BrowserUtterance });
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        SpeechSynthesisUtterance: BrowserUtterance,
        cancelAnimationFrame: vi.fn(),
        requestAnimationFrame: (callback: FrameRequestCallback) => {
          queuedAnimationFrames.push(callback);
          return queuedAnimationFrames.length;
        },
        setTimeout,
        clearTimeout,
        speechSynthesis,
      },
    });

    const controller = new SpeechController({ ...DEFAULT_SETTINGS });
    const engine = new TextHighlightEngine();
    const first = token(0, "one ");
    const second = token(4, "two ");
    const third = token(8, "three");
    const tokens = [first, second, third];
    const deliveredIndexes: number[] = [];
    const activeTokens: HTMLElement[] = [];

    controller.subscribe((state) => {
      if (state.status !== "speaking") return;
      const index = state.charIndex ?? state.chunkStart ?? 0;
      deliveredIndexes.push(index);
      const active = engine.paintSmooth(tokens, index, { textLength: 13 });
      if (active) activeTokens.push(active);
    });
    controller.speak("one two three", "Post");
    const utterance = speechSynthesis.speak.mock.calls[0]?.[0] as FakeUtterance;

    utterance.onboundary?.({ charIndex: 0, charLength: 3, elapsedTime: 0 } as SpeechSynthesisEvent);
    utterance.onboundary?.({ charIndex: 4, charLength: 3, elapsedTime: 0.2 } as SpeechSynthesisEvent);
    utterance.onboundary?.({ charIndex: 8, charLength: 5, elapsedTime: 0.4 } as SpeechSynthesisEvent);

    expect(queuedAnimationFrames).toHaveLength(3);
    expect(deliveredIndexes).toEqual([0, 0, 4, 8]);
    expect(activeTokens).toEqual([first, first, second, third]);
    expect(first.dataset.postReadingSmoothFilled).toBe("true");
    expect(second.dataset.postReadingSmoothFilled).toBe("true");
    expect(third.style.getPropertyValue("--post-reading-fill")).toBe("0%");
  });
});
