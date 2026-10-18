import { describe, expect, it } from "vitest";
import { settingStateHelp } from "./settings-state-help";
describe("state-aware setting guidance", () => {
  it("uses present-tense descriptions and negation without losing caveats", () => {
    const text = "Show the request indicator. Numbered unread badges remain visible either way.";
    expect(settingStateHelp("visualHideMessageRequestDot", true, text)).toBe("Shows the request indicator. Numbered unread badges remain visible either way.");
    expect(settingStateHelp("visualHideMessageRequestDot", false, text)).toBe("Does not show the request indicator. Numbered unread badges remain visible either way.");
  });
  it("describes actions conditional on liking or poking in both states", () => {
    expect(settingStateHelp("remistats.likeAutoPoke", true, "When you click…")).toBe("Pokes the author on RemiliaNET when you like a post on X.");
    expect(settingStateHelp("remistats.pokeAutoLike", false, "After a poke…")).toBe("Does not like the post on X after a successful RemiliaNET poke.");
  });
  it("replaces default-state wording and instructions that contradict the current state", () => {
    expect(settingStateHelp("post-reading.fetchFullQuotes", true, "Off by default.")).not.toContain("Off by default");
    expect(settingStateHelp("wiki.maxLinksPerPostEnabled", false, "Use the limit. Turn off for no maximum.")).toBe("Does not limit wiki links per post to the saved maximum.");
  });
  it("explains the selected alternative for binary controls", () => {
    expect(settingStateHelp("visualSquareMedia", false, "Remove rounding.")).toContain("keeps images, videos, and quote cards rounded");
    expect(settingStateHelp("visualTweetPngIncludeDate", false, "Show the date.")).toContain("shows a link instead");
    expect(settingStateHelp("post-reading.useHandles", true, "Choose names or handles.")).toBe("Reads @handles instead of display names.");
  });
  it("preserves informational text and availability explanations", () => {
    expect(settingStateHelp("unknown", false, "Requires a connection.")).toBe("Requires a connection.");
  });
});
