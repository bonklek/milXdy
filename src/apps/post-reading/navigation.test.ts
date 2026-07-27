import { describe, expect, it } from "vitest";
import {
  findAdjacentLineStart,
  findExplicitPostTarget,
  findVisibleAutoplayTarget,
  jumpToAdjacentSpeechBoundary,
  postNavigationAvailability,
  readableLineStarts,
  readableSpeechBoundaryStarts,
  shouldRestartCurrentPost,
} from "./navigation";

describe("Post-reading line navigation", () => {
  const text = "Author said \"First line.\n\nSecond line.\n\n  Third line.\"";

  it("finds non-empty readable line starts", () => {
    expect(readableLineStarts(text)).toEqual([0, 26, 42]);
  });

  it("moves forward to the next readable line", () => {
    expect(findAdjacentLineStart(text, 4, 1)).toBe(26);
    expect(findAdjacentLineStart(text, 26, 1)).toBe(42);
    expect(findAdjacentLineStart(text, 45, 1)).toBeNull();
  });

  it("moves backward to the previous readable line", () => {
    expect(findAdjacentLineStart(text, 45, -1)).toBe(26);
    expect(findAdjacentLineStart(text, 26, -1)).toBe(0);
    expect(findAdjacentLineStart(text, 4, -1)).toBeNull();
  });

  it("falls back to sentence starts for a continuous paragraph", () => {
    const paragraph = "First sentence. Second sentence! Third sentence?";
    expect(readableSpeechBoundaryStarts(paragraph)).toEqual([0, 16, 33]);
    expect(findAdjacentLineStart(paragraph, 4, 1)).toBe(16);
    expect(findAdjacentLineStart(paragraph, 20, -1)).toBe(0);
  });

  it("falls back to stable chunks for long text without sentence punctuation", () => {
    const paragraph = Array.from({ length: 90 }, (_, index) => `word${index}`).join(" ");
    const starts = readableSpeechBoundaryStarts(paragraph);
    expect(starts.length).toBeGreaterThan(1);
    expect(starts[0]).toBe(0);
    expect(starts.every((start, index) => index === 0 || start > starts[index - 1]!)).toBe(true);
  });

  it("invokes the shared jump and immediate resynchronization behavior", () => {
    const jumps: number[] = [];
    let resyncs = 0;
    const state = {
      status: "paused",
      text: "First sentence. Second sentence. Third sentence.",
      charIndex: 2,
      chunkStart: 0,
    };
    const controller = {
      getState: () => state,
      jumpToCharIndex: (index: number) => {
        jumps.push(index);
        state.charIndex = index;
      },
    };

    expect(jumpToAdjacentSpeechBoundary(controller, 1, () => { resyncs += 1; })).toBe(16);
    expect(jumpToAdjacentSpeechBoundary(controller, 1, () => { resyncs += 1; })).toBe(33);
    expect(jumpToAdjacentSpeechBoundary(controller, -1, () => { resyncs += 1; })).toBe(16);
    expect(jumps).toEqual([16, 33, 16]);
    expect(resyncs).toBe(3);
  });
});

describe("Post-reading post navigation", () => {
  const before = { id: "before" };
  const current = { id: "current" };
  const after = { id: "after" };
  const belowViewport = { id: "below" };
  const ordered = [before, current, after, belowViewport];
  const visible = [before, after];

  it("uses the ordered timeline for explicit next and previous navigation", () => {
    expect(findExplicitPostTarget(ordered, current, 1)).toBe(after);
    expect(findExplicitPostTarget(ordered, current, -1)).toBe(before);
    expect(findExplicitPostTarget(ordered, after, 1)).toBe(belowViewport);
  });

  it("never selects the current post when it is absent from the supplied collection", () => {
    const detached = { id: "detached" };
    expect(findExplicitPostTarget(ordered, detached, 1)).toBe(before);
    expect(findExplicitPostTarget(ordered, detached, -1)).toBe(belowViewport);
    expect(findExplicitPostTarget([current], current, 1)).toBeNull();
  });

  it("keeps visible autoplay separate from explicit navigation", () => {
    expect(findVisibleAutoplayTarget(visible, current)).toBe(before);
    expect(findExplicitPostTarget(ordered, current, 1)).toBe(after);
    expect(findVisibleAutoplayTarget([current, after], current)).toBe(after);
  });

  it("honors eligibility filtering and the previous-post restart threshold", () => {
    expect(findExplicitPostTarget(ordered, current, 1, (post) => post !== after)).toBe(belowViewport);
    expect(shouldRestartCurrentPost(14)).toBe(true);
    expect(shouldRestartCurrentPost(0)).toBe(false);
    expect(shouldRestartCurrentPost(null)).toBe(false);
  });

  it("exposes unavailable post arrows while retaining previous restart availability", () => {
    expect(postNavigationAvailability([current], current, 0)).toEqual({ previous: false, next: false });
    expect(postNavigationAvailability([current], current, 4)).toEqual({ previous: true, next: false });
    expect(postNavigationAvailability(ordered, current, 0)).toEqual({ previous: true, next: true });
  });
});
