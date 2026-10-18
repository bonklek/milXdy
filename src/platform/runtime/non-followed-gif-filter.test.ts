import { describe, expect, it } from "vitest";
import { load } from "cheerio";
import { nonFollowedGifPost } from "./non-followed-gif-filter";

function post(html: string): HTMLElement {
  const $ = load(`<article data-testid="tweet">${html}</article>`);
  const cache = new Map<object, unknown>();
  const adapt = (node: any): any => {
    if (!node) return null;
    if (cache.has(node)) return cache.get(node);
    const el = {
      getAttribute: (name: string) => $(node).attr(name) ?? null,
      querySelector: (selector: string) => adapt($(node).find(selector).get(0)),
      querySelectorAll: (selector: string) => $(node).find(selector).toArray().map(adapt),
      closest: (selector: string) => adapt($(node).closest(selector).get(0)),
      contains: (other: any) => $(node).find('*').toArray().some((child) => adapt(child) === other),
      get textContent() { return $(node).text(); },
    };
    cache.set(node, el);
    return el;
  };
  return adapt($('article').get(0));
}

describe("non-followed GIF feed filter", () => {
  it("filters a GIF with text and GIF-only posts", () => {
    for (const text of ['', '<div data-testid="tweetText">Readable caption</div>']) {
      expect(nonFollowedGifPost(post(`<div data-testid="User-Name" data-following="false"></div>${text}<video src="https://video.twimg.com/tweet_video/example.mp4"></video>`))).toBe(true);
    }
  });
  it("preserves followed, unknown, ambiguous, and non-GIF posts", () => {
    for (const follow of ['true', '', 'maybe']) {
      expect(nonFollowedGifPost(post(`<div data-testid="User-Name" data-following="${follow}"></div><img src="https://example.org/a.gif">`))).toBe(false);
    }
    expect(nonFollowedGifPost(post('<div data-testid="User-Name" data-following="false"></div><video src="https://video.twimg.com/ext_tw_video/example.mp4"></video>'))).toBe(false);
    expect(nonFollowedGifPost(post('<div data-testid="User-Name" data-following="false"><button data-testid="123-unfollow"></button></div><img src="https://example.org/a.gif">'))).toBe(false);
  });
  it("uses explicit GIF labels and author-specific follow controls", () => {
    expect(nonFollowedGifPost(post('<div data-testid="User-Name"><button data-testid="123-follow"></button></div><div data-testid="videoPlayer"><span>GIF</span><video></video></div>'))).toBe(true);
  });
  it("never confuses quoted accounts, quoted media, or body Follow text with the author", () => {
    expect(nonFollowedGifPost(post('<div data-testid="quoteTweet"><div data-testid="User-Name" data-following="false"></div></div><img src="https://example.org/a.gif">'))).toBe(false);
    expect(nonFollowedGifPost(post('<div data-testid="User-Name" data-following="false"></div><div data-testid="quoteTweet"><img src="https://example.org/a.gif"></div>'))).toBe(false);
    expect(nonFollowedGifPost(post('<div data-testid="User-Name"></div><button data-testid="456-follow">Follow</button><img src="https://example.org/a.gif">'))).toBe(false);
  });
});
