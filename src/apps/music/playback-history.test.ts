import { describe, expect, it } from "vitest";
import { PlaybackHistoryTracker } from "./playback-history";

describe("PlaybackHistoryTracker", () => {
  it("retraces shuffled playback and preserves forward history", () => {
    const history = new PlaybackHistoryTracker();
    history.record("a");
    history.record("d");
    history.record("b");

    const back = history.peek(-1);
    expect(back).toEqual({ trackId: "d", cursor: 1 });
    history.commit(back!.cursor);

    expect(history.peek(1)).toEqual({ trackId: "b", cursor: 2 });
  });

  it("discards forward history after choosing a different track", () => {
    const history = new PlaybackHistoryTracker();
    history.record("a");
    history.record("d");
    history.record("b");
    history.commit(history.peek(-1)!.cursor);

    history.record("c");

    expect(history.peek(1)).toBeNull();
    expect(history.peek(-1)?.trackId).toBe("d");
  });
});
