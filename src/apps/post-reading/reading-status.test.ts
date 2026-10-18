import { afterEach, describe, expect, it, vi } from "vitest";
import { createReadingAnnouncer, finiteProgress } from "./reading-status";
import { readingMotionPolicy, reducedMotionHighlightMode } from "./motion-policy";
const schedule = (callback: () => void, delay: number) => { const id = setTimeout(callback, delay); return () => clearTimeout(id); };
afterEach(() => vi.useRealTimers());
describe("coalesced reader announcements", () => {
  it("publishes only the newest semantic status in a burst and deduplicates repeated keys", async () => {
    vi.useFakeTimers(); const publish = vi.fn(); const announcer = createReadingAnnouncer(publish, schedule);
    for (let index = 0; index < 40; index++) announcer.say(`OCR ${index}`, `ocr:${Math.floor(index / 25)}`);
    expect(publish).not.toHaveBeenCalled(); await vi.advanceTimersByTimeAsync(900);
    expect(publish).toHaveBeenCalledExactlyOnceWith("OCR 25", false);
    announcer.say("OCR 39", "ocr:1"); await vi.advanceTimersByTimeAsync(900); expect(publish).toHaveBeenCalledOnce();
  });
  it("drops an obsolete queued pause when reading resumes before the coalescing window", async () => {
    vi.useFakeTimers(); const publish = vi.fn(); const announcer = createReadingAnnouncer(publish, schedule);
    announcer.say("Reading", "speech:speaking"); await vi.advanceTimersByTimeAsync(900);
    announcer.say("Paused", "speech:paused"); announcer.say("Reading", "speech:speaking"); await vi.advanceTimersByTimeAsync(900);
    expect(publish).toHaveBeenCalledExactlyOnceWith("Reading", false);
  });
  it("announces a repeated failure once, cancels stale progress and allows recovery", async () => {
    vi.useFakeTimers(); const publish = vi.fn(); const announcer = createReadingAnnouncer(publish, schedule);
    announcer.say("Recognizing image", "ocr:start"); announcer.say("OCR failed. Try again.", "ocr:error", true); announcer.say("OCR failed. Try again.", "ocr:error", true);
    await vi.advanceTimersByTimeAsync(900); expect(publish).toHaveBeenCalledExactlyOnceWith("OCR failed. Try again.", true);
    announcer.say("Reading selected text", "speech:speaking"); await vi.advanceTimersByTimeAsync(900);
    expect(publish).toHaveBeenLastCalledWith("Reading selected text", false);
  });
  it("never publishes deferred status after disposal", async () => {
    vi.useFakeTimers(); const publish = vi.fn(); const announcer = createReadingAnnouncer(publish, schedule);
    announcer.say("Preparing voice", "speech:preparing"); announcer.dispose(); announcer.say("Late error", "speech:error", true); await vi.advanceTimersByTimeAsync(2000); expect(publish).not.toHaveBeenCalled();
  });
  it("cancels pending OCR but preserves a speech announcement", async () => {
    vi.useFakeTimers(); const publish = vi.fn(); const announcer = createReadingAnnouncer(publish, schedule);
    announcer.say("OCR progress", "ocr:start"); announcer.cancel("ocr:"); await vi.advanceTimersByTimeAsync(1000); expect(publish).not.toHaveBeenCalled();
    announcer.say("Reading selected text", "speech:speaking"); announcer.cancel("ocr:"); await vi.advanceTimersByTimeAsync(1000); expect(publish).toHaveBeenCalledExactlyOnceWith("Reading selected text", false);
  });
  it("exposes only finite bounded numeric percentages", () => {
    expect([NaN, Infinity, -Infinity, null, undefined].map(finiteProgress)).toEqual([null, null, null, null, null]);
    expect([-1, 0, 0.234, 1, 5].map(finiteProgress)).toEqual([0, 0, 23, 100, 100]);
  });
});
describe("central reader motion policy", () => {
  it("always honors reduced motion without a configured smooth override", () => {
    expect(readingMotionPolicy(true)).toEqual({ scrollBehavior: "instant", smoothHighlight: false });
    expect(reducedMotionHighlightMode("smooth", true)).toBe("word");
    expect(reducedMotionHighlightMode("off", true)).toBe("off");
    expect(readingMotionPolicy(false)).toEqual({ scrollBehavior: "smooth", smoothHighlight: true });
  });
});
