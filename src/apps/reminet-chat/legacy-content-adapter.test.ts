import { describe, expect, it } from "vitest";
import { legacyMediaFailureMessage, legacyMediaSubmitMutation, legacyReplyId } from "./legacy-content-adapter";

describe("legacy content adapter", () => {
  it("builds only media-bearing legacy submits with numeric reply IDs", () => {
    expect(legacyReplyId("42")).toBe(42);
    expect(legacyReplyId("local:1")).toBeNull();
    expect(legacyMediaSubmitMutation("caption", 42, [{ mediaId: 7 }])).toEqual({
      type: "submit",
      payload: { chat_id: 1, text: "caption", in_reply_to_id: 42, media_ids: [7] },
    });
    expect(legacyMediaSubmitMutation("text", null, [])).toBeNull();
  });

  it("maps private adapter failures to fixed user-facing copy", () => {
    expect(legacyMediaFailureMessage("LEGACY_UPLOAD_REJECTED")).toBe(
      "The legacy media upload failed. Your message and attachments were kept.",
    );
    expect(legacyMediaFailureMessage("LEGACY_MEDIA_SUBMIT_REJECTED")).toBe(
      "The legacy media sender is unavailable. Your message and attachments were kept.",
    );
  });
});
