import { describe, expect, it } from "vitest";
import { advanceIdlePreload } from "./content-runtime";

describe("content runtime progressive idle preload", () => {
  it("loads the second idle app when the first candidate is disabled", async () => {
    const checked: string[] = [];
    const loaded: string[] = [];
    const cursor = await advanceIdlePreload(["wiki", "remistats"], 0, async (app) => {
      checked.push(app);
      return app === "remistats";
    }, async (app) => { loaded.push(app); });
    expect(checked).toEqual(["wiki", "remistats"]);
    expect(loaded).toEqual(["remistats"]);
    expect(cursor).toBe(0);
  });
});
