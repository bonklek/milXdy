import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  extractTweetPngCashtag,
  extractTweetPngMedia,
  findTweetPngQuoteElement,
  normalizeVisualTheme,
  tweetPngMediaRemovalKey,
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

  it("updates color previews from live input and offers explicit offline recovery controls", () => {
    expect(packageSource).toContain('input.type === "color" ? "input" : "change"');
    expect(packageSource).toMatch(/data-action="reconnect"[^>]*href="https:\/\/www\.remilia\.net\/"[^>]*>Reconnect<\/a>/u);
    expect(packageSource).toMatch(/data-action="refresh"[^>]*>Refresh<\/button>/u);
    expect(packageSource).toContain("window.location.reload()");
    expect(packageSource).not.toContain('data-action="reminet"');
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

  it("selects the enclosing QRT card instead of its nested photo link", () => {
    let post: HTMLElement;
    const quoteCard = {
      querySelector: (selector: string) => selector === '[data-testid="User-Name"]' ? {} : null,
    } as unknown as HTMLElement;
    const mainText = {
      closest: (selector: string) => selector === 'article[data-testid="tweet"]' ? post : null,
    } as unknown as HTMLElement;
    const quoteText = {
      closest: (selector: string) => {
        if (selector === 'article[data-testid="tweet"]') return post;
        if (selector === 'div[role="link"], a[href*="/status/"]') return quoteCard;
        return null;
      },
    } as unknown as HTMLElement;
    const photoLink = {
      href: "https://x.com/John_Hudson/status/2082852180977999924/photo/1",
      closest: () => post,
      querySelector: () => ({}),
    } as unknown as HTMLElement;
    post = {
      matches: (selector: string) => selector === 'article[data-testid="tweet"]',
      querySelector: () => null,
      querySelectorAll(selector: string) {
        if (selector === '[data-testid="tweetText"]') return [mainText, quoteText];
        if (selector === 'div[role="link"]') return [quoteCard];
        if (selector === 'a[href*="/status/"]') return [photoLink];
        return [];
      },
    } as unknown as HTMLElement;

    expect(findTweetPngQuoteElement(post, "https://x.com/dnlklr/status/2082893132304392245")).toBe(quoteCard);
  });

  it("offers an accessible per-image removal control for post and QRT media", () => {
    expect(tweetPngMediaRemovalKey("post", "https://pbs.twimg.com/media/image.jpg"))
      .toBe("post:https://pbs.twimg.com/media/image.jpg");
    expect(tweetPngMediaRemovalKey("quote", "https://pbs.twimg.com/media/image.jpg"))
      .toBe("quote:https://pbs.twimg.com/media/image.jpg");
    expect(packageSource).toContain('className = "milxdy-tweet-png-remove-media"');
    expect(packageSource).toContain('remove.setAttribute("aria-label", `Remove ${label} image ${item.index + 1}`)');
    expect(packageSource).toContain("excludedMedia.add(key)");
    expect(packageSource).toContain('updatePreview("Image removed from this PNG.")');
  });
});
