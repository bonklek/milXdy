import { describe, expect, it } from "vitest";
import { HighlightProgressClock, type HighlightProgressState } from "./highlightProgress";

const stateAt = (charIndex: number | null): HighlightProgressState => ({
  status: "speaking",
  chunkIndex: 0,
  chunkStart: 0,
  charIndex,
  hasSyncedBoundaries: true,
});

describe("HighlightProgressClock", () => {
  it("keeps fresh native boundaries authoritative", () => {
    const clock = new HighlightProgressClock();
    clock.observe(stateAt(12), 100);
    expect(clock.resolveIndex(stateAt(12), 400, 10, 200)).toBe(12);
  });

  it("does not estimate ahead of a stalled native boundary", () => {
    const clock = new HighlightProgressClock();
    clock.observe(stateAt(0), 100);
    expect(clock.resolveIndex(stateAt(0), 600, 10, 200)).toBe(0);
    expect(clock.nextUpdateDelay(stateAt(0), 600)).toBeNull();
  });

  it("returns immediately to a resumed native boundary", () => {
    const clock = new HighlightProgressClock();
    const unsynced = { ...stateAt(null), hasSyncedBoundaries: false };
    clock.observe(unsynced, 100);
    expect(clock.resolveIndex(unsynced, 600, 10, 200)).toBe(5);
    clock.observe(stateAt(18), 650);
    expect(clock.resolveIndex(stateAt(18), 700, 10, 200)).toBe(18);
  });

  it("does not advance while paused", () => {
    const clock = new HighlightProgressClock();
    const unsynced = { ...stateAt(null), hasSyncedBoundaries: false };
    clock.observe(unsynced, 100);
    expect(clock.resolveIndex(unsynced, 600, 10, 200)).toBe(5);
    const paused = { ...unsynced, status: "paused" };
    clock.observe(paused, 600);
    expect(clock.resolveIndex(paused, 2_000, 10, 200)).toBe(5);
  });
});
