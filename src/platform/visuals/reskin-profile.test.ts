import { describe, expect, it } from "vitest";
import { PROFILE_AUDIO_PRESETS } from "./reskin-profile";

describe("profile companion behavior presets", () => {
  it("enables poke-on-Like for Medium and Max without enabling it for Minimal", () => {
    expect(PROFILE_AUDIO_PRESETS.moderate.remistatsLikeAutoPoke).toBe(true);
    expect(PROFILE_AUDIO_PRESETS.max.remistatsLikeAutoPoke).toBe(true);
    expect(PROFILE_AUDIO_PRESETS.min.remistatsLikeAutoPoke).toBe(false);
  });
});
