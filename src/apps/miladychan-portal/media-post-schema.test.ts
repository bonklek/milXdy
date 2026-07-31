import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEDIA_DISCOVERY_BOARDS,
  IDENTITY_PROVENANCE_POLICY,
  MEDIA_POST_MARKER,
  normalizeMediaBoardAllowlist,
  parseTaggedMediaPost,
} from "./media-post-schema";

const provenance = {
  board: "music",
  postId: 42,
  postedAt: 1_700_000_000,
  authorLabel: "anonymous",
  nativeUrl: "https://boards.miladychan.org/music/42",
};

describe("Miladychan identifier-media post schema", () => {
  it("parses a visible music recommendation with public provenance", () => {
    const parsed = parseTaggedMediaPost(`${MEDIA_POST_MARKER}\nkind: music\nid: isrc:USABC1234567\ntitle: Example Track\ncreator: Example Artist\nsource: https://example.com/track\ncomment: listen to this`, provenance);
    expect(parsed).toMatchObject({
      kind: "music",
      identifier: "isrc:usabc1234567",
      title: "Example Track",
      sourceUrl: "https://example.com/track",
      provenance,
    });
  });

  it("rejects hidden, malformed, duplicate, and unsupported metadata", () => {
    expect(parseTaggedMediaPost("kind: music\nid: isrc:USABC1234567", provenance)).toBeNull();
    expect(parseTaggedMediaPost(`${MEDIA_POST_MARKER}\nkind: music\nkind: book\nid: isrc:USABC1234567\ntitle: x`, provenance)).toBeNull();
    expect(parseTaggedMediaPost(`${MEDIA_POST_MARKER}\nkind: music\nid: isrc:USABC1234567\ntitle: x\nwallet: 0x123`, provenance)).toBeNull();
    expect(parseTaggedMediaPost(`${MEDIA_POST_MARKER}\nkind: music\nid: isrc:broken\ntitle: x`, provenance)).toBeNull();
  });

  it("keeps board discovery opt-in and identity provenance non-verified", () => {
    expect(DEFAULT_MEDIA_DISCOVERY_BOARDS).toEqual([]);
    expect(normalizeMediaBoardAllowlist([" Music ", "music", "bad/path", "BOOKS"])).toEqual(["music", "books"]);
    expect(IDENTITY_PROVENANCE_POLICY.verified).toMatch(/No verified/i);
    expect(IDENTITY_PROVENANCE_POLICY.remiNetFriends).toMatch(/documented, consented/i);
  });
});
