import { describe, expect, it } from "vitest";
import { normalizeDrafts, normalizeWatchedThreads, imageUrl, sortThreads } from "./portal-data";
import type { ChanThread } from "./portal-contract";

describe("portal persisted data boundaries", () => {
  it("retains legacy drafts while normalizing invalid destinations and bounded labels", () => {
    const draft = { board: "milady", threadId: -1, name: "x".repeat(120), body: "kept locally", updatedAt: NaN };
    const normalized = normalizeDrafts(draft);
    expect(normalized).toEqual([{ board: "milady", threadId: null, name: "x".repeat(100), subject: "", body: "kept locally", updatedAt: 0 }]);
    expect(normalizeDrafts({ drafts: [null, draft, { board: "milady" }] })).toEqual(normalized);
  });

  it("rejects unsupported watched boards and duplicates without inventing unread counts", () => {
    const threads = [
      { board: "milady", threadId: 2, watchedAt: 4, seenPostCount: -1, latestPostCount: 3 },
      { board: "milady", threadId: 2, watchedAt: 9, title: "duplicate" },
      { board: "unsupported", threadId: 3 },
      { board: "remilio", threadId: 1, watchedAt: 8, seenPostCount: 0, latestPostCount: "5" },
    ];
    expect(normalizeWatchedThreads({ threads })).toEqual([
      { board: "remilio", threadId: 1, title: "No. 1", watchedAt: 8, seenPostCount: 0, latestPostCount: null },
      { board: "milady", threadId: 2, title: "No. 2", watchedAt: 4, seenPostCount: null, latestPostCount: 3 },
    ]);
  });

  it("keeps sticky ordering without mutating the fetched list", () => {
    const makeThread = (id: number, sticky: boolean, activity: number): ChanThread => ({
      id, sticky, activity, time: 0, body: "", post_count: 0, image_count: 0,
      update_time: 0, bump_time: 0, subject: "", board: "milady",
    });
    const threads = [makeThread(1, false, 100), makeThread(2, true, 1), makeThread(3, false, 200)];
    expect(sortThreads(threads).map((thread) => thread.id)).toEqual([2, 3, 1]);
    expect(threads.map((thread) => thread.id)).toEqual([1, 2, 3]);
    expect(imageUrl({ sha1: "abc", file_type: 14, thumb_type: 1 }, "src")).toBe("");
    expect(imageUrl({ sha1: "abc", file_type: 14, thumb_type: 1 }, "thumb")).toBe("https://boards.miladychan.org/assets/images/thumb/abc.png");
  });
});
