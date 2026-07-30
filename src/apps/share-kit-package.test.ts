import { describe, expect, it } from "vitest";
import {
  extractTweetPngMedia,
  normalizeVisualTheme,
} from "../../examples/packages/first-party-replacements/tweetPng/src/content";

describe("Share Kit package compatibility", () => {
  it("retains legacy Tweet PNG booleans and normalizes new color defaults", () => {
    const settings = normalizeVisualTheme({
      tweetPngIncludeImages: false,
      tweetPngIncludeQuoteText: false,
      tweetPngIncludeQuoteImages: true,
      tweetPngBackgroundColor: "#ABCDEF",
      tweetPngFontColor: "invalid",
    });
    expect(settings.tweetPngIncludeImages).toBe(false);
    expect(settings.tweetPngIncludeQuoteText).toBe(false);
    expect(settings.tweetPngIncludeQuoteImages).toBe(true);
    expect(settings.tweetPngBackgroundColor).toBe("#abcdef");
    expect(settings.tweetPngFontColor).toBe("#20122f");
  });

  it("marks video posters for a play overlay while preserving ordinary images", () => {
    const photo = { currentSrc: "", src: "https://pbs.twimg.com/media/photo.jpg", closest: () => null } as unknown as HTMLImageElement;
    const video = { poster: "https://pbs.twimg.com/amplify_video_thumb/video.jpg", closest: () => null } as unknown as HTMLVideoElement;
    const post = {
      querySelectorAll(selector: string) {
        if (selector === '[data-testid="tweetPhoto"] img') return [photo];
        if (selector === "video[poster]") return [video];
        return [];
      },
    } as unknown as HTMLElement;
    expect(extractTweetPngMedia(post)).toEqual([
      { src: "https://pbs.twimg.com/media/photo.jpg", isVideo: false },
      { src: "https://pbs.twimg.com/amplify_video_thumb/video.jpg", isVideo: true },
    ]);
  });
});
