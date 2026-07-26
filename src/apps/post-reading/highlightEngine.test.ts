import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TextHighlightEngine,
  type TextHighlightEngineOptions,
} from "./highlightEngine";

type SmoothDiagnostic = Parameters<
  NonNullable<TextHighlightEngineOptions["onSmoothAnimation"]>
>[0];

let originalWindowDescriptor: PropertyDescriptor | undefined;

beforeEach(() => {
  vi.useFakeTimers();
  originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

  const browserWindow = {
    requestAnimationFrame: (callback: FrameRequestCallback) =>
      globalThis.setTimeout(() => callback(performance.now()), 0) as unknown as number,
    cancelAnimationFrame: (handle: number) => globalThis.clearTimeout(handle),
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
  } as unknown as Window;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: browserWindow,
  });
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();

  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
  } else {
    Reflect.deleteProperty(globalThis, "window");
  }
});

function token(start: number, text: string): HTMLElement {
  const properties = new Map<string, string>();
  const style = {
    getPropertyValue: (name: string) => properties.get(name) ?? "",
    removeProperty: (name: string) => {
      const previous = properties.get(name) ?? "";
      properties.delete(name);
      return previous;
    },
    setProperty: (name: string, value: string) => {
      properties.set(name, value);
    },
  } as unknown as CSSStyleDeclaration;

  return {
    dataset: {
      postReadingStart: String(start),
      postReadingLength: String(text.length),
    },
    isConnected: true,
    style,
    textContent: text,
  } as unknown as HTMLElement;
}

describe("TextHighlightEngine smooth mode", () => {
  it("fills completed history, partially fills the current token, and leaves future tokens empty", () => {
    const engine = new TextHighlightEngine();
    const first = token(0, "abcd");
    const current = token(4, "efgh");
    const future = token(8, "ijkl");

    engine.paintSmooth([first, current, future], 6, {
      snapToCurrent: true,
      textLength: 12,
    });

    expect(first.dataset.postReadingSmoothFilled).toBe("true");
    expect(first.style.getPropertyValue("--post-reading-fill")).toBe("100%");
    expect(current.dataset.postReadingSmoothFilled).toBeUndefined();
    expect(current.style.getPropertyValue("--post-reading-fill")).toBe("50%");
    expect(future.dataset.postReadingSmoothFilled).toBeUndefined();
    expect(future.style.getPropertyValue("--post-reading-fill")).toBe("");
  });

  it("changes the fill through the timed animation path", () => {
    const diagnostics: SmoothDiagnostic[] = [];
    const engine = new TextHighlightEngine({
      onSmoothAnimation: (diagnostic) => diagnostics.push(diagnostic),
    });
    const current = token(0, "smooth");

    engine.paintSmooth([current], 0, { textLength: 6 });

    expect(current.style.getPropertyValue("--post-reading-fill")).toBe("0%");
    expect(current.style.getPropertyValue("--post-reading-fill-duration")).toBe("0ms");

    vi.advanceTimersByTime(1);

    expect(current.style.getPropertyValue("--post-reading-fill")).toBe("100%");
    expect(Number.parseInt(current.style.getPropertyValue("--post-reading-fill-duration"), 10)).toBeGreaterThanOrEqual(80);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({
      animatedTokenCount: 1,
      boundaryIndex: 0,
      interrupted: false,
    });
  });

  it("advances continuously from an in-word position instead of snapping at a boundary", () => {
    const engine = new TextHighlightEngine();
    const current = token(0, "abcdefghij");

    engine.paintSmooth([current], 2, { textLength: 10 });

    expect(current.style.getPropertyValue("--post-reading-fill")).toBe("20%");

    vi.advanceTimersByTime(1);

    expect(current.style.getPropertyValue("--post-reading-fill")).toBe("100%");
    const duration = Number.parseInt(
      current.style.getPropertyValue("--post-reading-fill-duration"),
      10,
    );
    expect(duration).toBeGreaterThanOrEqual(80);
    expect(duration).toBeLessThanOrEqual(1200);
  });

  it("completes an overtaken pending range and begins the next range", () => {
    const diagnostics: SmoothDiagnostic[] = [];
    const engine = new TextHighlightEngine({
      onSmoothAnimation: (diagnostic) => diagnostics.push(diagnostic),
    });
    const first = token(0, "First");
    const second = token(6, "Second");

    engine.paintSmooth([first, second], 0, { textLength: 12 });
    engine.paintSmooth([first, second], 6, { textLength: 12 });

    expect(first.dataset.postReadingSmoothFilled).toBe("true");
    expect(first.style.getPropertyValue("--post-reading-fill")).toBe("100%");
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[1]).toMatchObject({
      animatedTokenCount: 1,
      boundaryIndex: 6,
      interrupted: true,
      pendingToIndex: 5,
    });

    vi.advanceTimersByTime(1);

    expect(second.style.getPropertyValue("--post-reading-fill")).toBe("100%");
    expect(Number.parseInt(second.style.getPropertyValue("--post-reading-fill-duration"), 10)).toBeGreaterThanOrEqual(80);
  });

  it("repaints backward resynchronization without stale future fill", () => {
    const engine = new TextHighlightEngine();
    const first = token(0, "abcd");
    const second = token(4, "efgh");
    const third = token(8, "ijkl");
    const tokens = [first, second, third];

    engine.paintSmooth(tokens, 8, { snapToCurrent: true, textLength: 12 });
    vi.advanceTimersByTime(1);
    expect(third.style.getPropertyValue("--post-reading-fill")).toBe("100%");

    engine.resetSmoothTokenFill(tokens);
    engine.resetSmoothTracking();
    engine.paintSmooth(tokens, 2, { snapToCurrent: true, textLength: 12 });

    expect(first.style.getPropertyValue("--post-reading-fill")).toBe("50%");
    expect(second.style.getPropertyValue("--post-reading-fill")).toBe("");
    expect(third.style.getPropertyValue("--post-reading-fill")).toBe("");
    expect(second.dataset.postReadingSmoothFilled).toBeUndefined();
    expect(third.dataset.postReadingSmoothFilled).toBeUndefined();
  });

  it("freezes at the paused cursor and resumes from that exact fill", () => {
    const engine = new TextHighlightEngine();
    const first = token(0, "abcdefgh");
    const second = token(8, "ijklmnop");
    const tokens = [first, second];

    engine.paintSmooth(tokens, 0, { leadToNextToken: true, textLength: 16 });
    vi.advanceTimersByTime(1);
    expect(first.style.getPropertyValue("--post-reading-fill")).toBe("100%");

    engine.suspendSmoothTracking(3);
    engine.paintSmooth(tokens, 3, { snapToCurrent: true, textLength: 16 });
    expect(first.style.getPropertyValue("--post-reading-fill")).toBe("37.5%");
    expect(second.style.getPropertyValue("--post-reading-fill")).toBe("");

    engine.paintSmooth(tokens, 3, { leadToNextToken: true, textLength: 16 });
    vi.advanceTimersByTime(1);
    expect(first.style.getPropertyValue("--post-reading-fill")).toBe("100%");
    expect(Number.parseInt(first.style.getPropertyValue("--post-reading-fill-duration"), 10)).toBeGreaterThanOrEqual(80);
  });
});

describe("TextHighlightEngine word mode", () => {
  it("advances the current-word marker as the boundary moves", () => {
    const engine = new TextHighlightEngine();
    const first = token(0, "One");
    const second = token(4, "two");
    const third = token(8, "three");
    const tokens = [first, second, third];

    expect(engine.paintWord(tokens, 0, 3)).toBe(first);
    expect(first.dataset.postReadingCurrentWord).toBe("true");

    expect(engine.paintWord(tokens, 4, 3)).toBe(second);
    expect(first.dataset.postReadingCurrentWord).toBeUndefined();
    expect(second.dataset.postReadingCurrentWord).toBe("true");
    expect(third.dataset.postReadingCurrentWord).toBeUndefined();
  });
});
