import { describe, expect, it } from "vitest";
import { confirmedMediaFromResponse } from "./media-upload-contract";

describe("confirmedMediaFromResponse", () => {
  it("normalizes RemiNet's confirmed media array", () => {
    expect(confirmedMediaFromResponse({
      success: true,
      media: [{
        url: "https://media.remilia.net/share.png",
        mime_type: "image/png",
        media_id: 189,
        width: 1200,
        height: 900,
      }],
    })).toEqual({
      url: "https://media.remilia.net/share.png",
      mimeType: "image/png",
      mediaId: 189,
      width: 1200,
      height: 900,
    });
  });

  it("rejects an empty confirmation instead of allowing a text-only send", () => {
    expect(confirmedMediaFromResponse({ success: true, media: [] })).toBeNull();
    expect(confirmedMediaFromResponse({ success: true, media: [{ url: "https://media.remilia.net/share.png" }] })).toBeNull();
  });
});
