import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  extractTweetPngCashtag,
  extractTweetPngMedia,
  normalizeVisualTheme,
  tweetPngVisibleLineCount,
} from "../../examples/packages/first-party-replacements/tweetPng/src/content";

describe("Share Kit package compatibility", () => {
  const packageSource = readFileSync("examples/packages/first-party-replacements/tweetPng/src/content.ts", "utf8");

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

  it("updates color previews from live input while retaining the legacy Share caption", () => {
    expect(packageSource).toContain('input.type === "color" ? "input" : "change"');
    expect(packageSource).toMatch(/data-action="reminet"[^>]*>Share<\/button>/u);
    expect(packageSource).not.toContain(">Share to RemiNet</button>");
  });

  it("keeps every text baseline that fits before the portrait cap", () => {
    expect(tweetPngVisibleLineCount(182, 278, 48)).toBe(3);
    expect(tweetPngVisibleLineCount(182, 181, 48)).toBe(0);
    expect(packageSource).toContain("TWEET_PNG_MAX_ASPECT_RATIO = 2.25");
  });

  it("extracts the local vector and labels from a cashtag attachment", () => {
    const leaf = (text: string) => ({
      textContent: text,
      querySelector: () => null,
    });
    const chart = {
      outerHTML: '<svg width="476" height="170" viewBox="0 0 476 170"><path d="M0 10 L476 0"/></svg>',
      getAttribute: (name: string) => name === "viewBox" ? "0 0 476 170" : null,
    };
    const card = {
      querySelectorAll(selector: string) {
        if (selector === "span") return [
          leaf("Ethereum"),
          leaf("ETH · Crypto"),
          leaf("$1,924.02"),
          leaf("$297.66 (+18.30%)"),
          leaf("Jul 29 at 2:07 PM · 1M"),
          leaf("$1,918.39"),
        ];
        if (selector === "svg") return [chart];
        return [];
      },
      querySelector(selector: string) {
        return selector === "img" ? { currentSrc: "", src: "https://abs.twimg.com/ethereum.png" } : null;
      },
    };
    const navigation = {
      closest: () => null,
      querySelector: () => card,
    };
    const post = {
      querySelectorAll: () => [navigation],
    } as unknown as HTMLElement;

    expect(extractTweetPngCashtag(post)).toMatchObject({
      name: "Ethereum",
      market: "ETH · Crypto",
      price: "$1,924.02",
      change: "$297.66 (+18.30%)",
      timestamp: "Jul 29 at 2:07 PM · 1M",
      currentPrice: "$1,918.39",
      iconUrl: "https://abs.twimg.com/ethereum.png",
    });
    expect(extractTweetPngCashtag(post)?.chartUrl).toContain(encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg"'));
  });
});
