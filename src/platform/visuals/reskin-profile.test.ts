import { describe, expect, it } from "vitest";
import { PROFILE_AUDIO_PRESETS, normalizeVisualTheme, remiliaHueAccent, resolveXProfileAccent } from "./reskin-profile";

describe("profile companion behavior presets", () => {
  it("enables poke-on-Like for Medium and Max without enabling it for Minimal", () => {
    expect(PROFILE_AUDIO_PRESETS.moderate.remistatsLikeAutoPoke).toBe(true);
    expect(PROFILE_AUDIO_PRESETS.max.remistatsLikeAutoPoke).toBe(true);
    expect(PROFILE_AUDIO_PRESETS.min.remistatsLikeAutoPoke).toBe(false);
  });
});

describe("custom appearance colors", () => {
  it("round trips named-color values through visual theme serialization", () => {
    const theme = normalizeVisualTheme({ interfaceAccentColor: "#12ABCD", tweetPngBorderPalette: "#E65432", tweetPngBackgroundColor: "#F0F1F2", tweetPngFontColor: "#112233" });
    expect(normalizeVisualTheme(JSON.parse(JSON.stringify(theme)))).toMatchObject({ interfaceAccentColor: "#12abcd", tweetPngBorderPalette: "#e65432", tweetPngBackgroundColor: "#f0f1f2", tweetPngFontColor: "#112233" });
  });
  it("rejects malformed colors and preserves automatic theme accents", () => {
    expect(normalizeVisualTheme({ interfaceAccentColor: "url(example)", tweetPngBorderPalette: "red; color: black" })).toMatchObject({ interfaceAccentColor: "", tweetPngBorderPalette: "purple" });
    expect(normalizeVisualTheme({ interfaceAccentColor: "" }).interfaceAccentColor).toBe("");
  });
});

describe("RemiliaNET profile accent", () => {
  it("accepts red hue zero and rejects invalid values", () => {
    expect(remiliaHueAccent(0)).toBe("#b23434");
    expect(remiliaHueAccent(360)).toBe(remiliaHueAccent(0));
    expect(remiliaHueAccent(NaN)).toBe("");
    expect(remiliaHueAccent("red")).toBe("");
  });
  it("limits profile accent on X to Full appearance", () => {
    for (const profile of ["min", "moderate"] as const) expect(resolveXProfileAccent(normalizeVisualTheme({ profile }), "#b23434")).toBe("");
    expect(resolveXProfileAccent(normalizeVisualTheme({ profile:"max" }), "#b23434")).toBe("#b23434");
    expect(resolveXProfileAccent(normalizeVisualTheme({ profile:"max" }), "bad css")).toBe("");
  });
});

describe("profile color preference", () => {
  it("defaults old Full themes to profile color and retains an explicit opt-out", () => {
    expect(normalizeVisualTheme({profile:"max"}).useRemiliaProfileColor).toBe(true);
    const theme = normalizeVisualTheme({profile:"max",useRemiliaProfileColor:false,interfaceAccentColor:"#1267AB"});
    expect(normalizeVisualTheme(JSON.parse(JSON.stringify(theme)))).toEqual(theme);
    expect(resolveXProfileAccent(theme,"#b23434")).toBe("#1267ab");
    expect(resolveXProfileAccent({...theme,interfaceAccentColor:""},"#b23434")).toBe("");
    expect(resolveXProfileAccent({...theme,useRemiliaProfileColor:true},"#b23434")).toBe("#b23434");
  });
});

describe("advanced media appearance", () => {
  it("derives numeric values from legacy shape and spacing settings", () => {
    expect(normalizeVisualTheme({ pfpShape:"square", squareMedia:false, quoteMediaGap:true })).toMatchObject({ mediaAdvanced:false, pfpRounding:0, mediaRounding:16, quoteSpacing:12 });
    expect(normalizeVisualTheme({ pfpShape:"circle" }).pfpRounding).toBe(100);
  });
  it("clamps sliders and preserves saved advanced values", () => {
    const theme = normalizeVisualTheme({ mediaAdvanced:true, pfpRounding:62, mediaRounding:150, quoteSpacing:50 });
    expect(theme).toMatchObject({ mediaAdvanced:true, pfpRounding:62, mediaRounding:100, quoteSpacing:32 });
    expect(normalizeVisualTheme(JSON.parse(JSON.stringify(theme)))).toEqual(theme);
  });
});
