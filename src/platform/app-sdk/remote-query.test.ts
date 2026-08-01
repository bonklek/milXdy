import { describe, expect, it } from "vitest";
import { REMOTE_QUERY_RESULT_TTL_MS, RemoteQueryResultStore, remibooruQueryUrl, sanitizeRemibooruPosts } from "./remote-query";

describe("reviewed Remibooru query adapter", () => {
  it("builds only the reviewed posts route and repeated facet parameters", () => {
    expect(remibooruQueryUrl({ resource: "posts", limit: 2, facets: ["milady", "reaction"] }, 24)?.href)
      .toBe("https://remibooru.com/api/v1/posts?limit=2&facet=milady&facet=reaction");
  });

  it("rejects oversized pages and arbitrary resources", () => {
    expect(remibooruQueryUrl({ resource: "posts", limit: 25 }, 24)).toBeNull();
    expect(remibooruQueryUrl({ resource: "other" as "posts" }, 24)).toBeNull();
  });

  it("drops original media URLs and keeps only reviewed canonical and thumbnail URLs", () => {
    const page = sanitizeRemibooruPosts({ posts: [{
      id: "post-1", postUrl: "https://remibooru.com/posts/post-1",
      thumbnail: { url: "https://remibooru.com/media/thumbs/post-1/image.webp" },
      media: { contentType: "image/webp", width: 100, height: 100, isGif: false, originalUrl: "https://elsewhere.invalid/raw" },
      uploader: { handle: "author" }, facets: [{ kind: "text", value: "milady", category: "general" }],
    }], nextCursor: "next" });
    expect(page).toEqual({ items: [{
      id: "post-1", postUrl: "https://remibooru.com/posts/post-1", thumbnailUrl: "https://remibooru.com/media/thumbs/post-1/image.webp",
      media: { contentType: "image/webp", width: 100, height: 100, isGif: false },
      facets: [{ kind: "text", value: "milady", category: "general" }], attribution: { label: "Remibooru", uploader: "author" },
    }], nextCursor: "next" });
  });

  it("rejects a post page that attempts to return a third-party thumbnail", () => {
    expect(sanitizeRemibooruPosts({ posts: [{
      id: "post-1", postUrl: "https://remibooru.com/posts/post-1",
      thumbnail: { url: "https://elsewhere.invalid/thumb.webp" },
      media: { contentType: "image/webp", width: 100, height: 100, isGif: false }, facets: [],
    }] })).toBeNull();
  });

  it("resolves only recent sanitized results in the initiating query scope", () => {
    const page = sanitizeRemibooruPosts({ posts: [{
      id: "post-1", postUrl: "https://remibooru.com/posts/post-1",
      thumbnail: { url: "https://remibooru.com/media/thumbs/post-1/image.webp" },
      media: { contentType: "image/webp", width: 100, height: 100, isGif: false }, facets: [],
    }] });
    expect(page).not.toBeNull();
    const store = new RemoteQueryResultStore();
    store.remember("tab-1:app:query", page!, 1_000);
    expect(store.resolve("tab-1:app:query", "post-1", 1_001))
      .toBe("https://remibooru.com/media/thumbs/post-1/image.webp");
    expect(store.resolve("tab-2:app:query", "post-1", 1_001)).toBeNull();
    expect(store.resolve("tab-1:app:query", "invented", 1_001)).toBeNull();
    expect(store.resolve("tab-1:app:query", "post-1", 1_000 + REMOTE_QUERY_RESULT_TTL_MS)).toBeNull();
  });

  it("restores only an unexpired sanitized result page", () => {
    const page = sanitizeRemibooruPosts({ posts: [{
      id: "post-1", postUrl: "https://remibooru.com/posts/post-1",
      thumbnail: { url: "https://remibooru.com/media/thumbs/post-1/image.webp" },
      media: { contentType: "image/webp", width: 100, height: 100, isGif: false }, facets: [],
    }] });
    expect(page).not.toBeNull();
    const store = new RemoteQueryResultStore();
    expect(store.restore("tab-1:app:query", page!, 1_000 + REMOTE_QUERY_RESULT_TTL_MS, 1_001)).toBe(true);
    expect(store.resolve("tab-1:app:query", "post-1", 1_002)).toBe("https://remibooru.com/media/thumbs/post-1/image.webp");
    expect(store.restore("tab-1:app:query", page!, 1_000 + REMOTE_QUERY_RESULT_TTL_MS, 1_000 + REMOTE_QUERY_RESULT_TTL_MS)).toBe(false);
  });
});
