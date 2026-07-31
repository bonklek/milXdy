import { describe, expect, it } from "vitest";
import { deriveComposerKeywordSuggestions } from "./composer-keyword-suggestions";

describe("deriveComposerKeywordSuggestions", () => {
  it("returns bounded ranked tokens without exposing raw draft structure", () => {
    expect(deriveComposerKeywordSuggestions("Milady reaction\nMilady sunset bonkler", { maxItems: 3, maxLength: 64 }))
      .toEqual(["milady", "reaction", "sunset"]);
  });

  it("removes links, mentions, stop words, and duplicates", () => {
    expect(deriveComposerKeywordSuggestions("This is @user https://x.com/x kagami KAGAMI art", { maxItems: 5, maxLength: 64 }))
      .toEqual(["kagami", "art"]);
  });

  it("enforces the public five-item and per-token bounds", () => {
    expect(deriveComposerKeywordSuggestions("abcdefgh alpha beta gamma delta epsilon zeta", { maxItems: 99, maxLength: 4 }))
      .toEqual(["abcd", "alph", "beta", "gamm", "delt"]);
  });
});
