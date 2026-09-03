import { describe, expect, it } from "vitest";
import type { RemiliaApiChatMessage } from "../../platform/auth/remilia-api";
import {
  legacyMessageId,
  messageIdOrNull,
  normalizeChatMessage,
  officialChatMessageRecord,
} from "./chat-model";

describe("RemiNet Chat normalized message model", () => {
  it("preserves 32-digit ids across official replies and dedup keys", () => {
    const message: RemiliaApiChatMessage = {
      id: "90071992547409931234567890123456",
      author: { handle: "alice", display_name: "Alice", avatar_url: "https://cdn.remilia.net/alice.png" },
      text: "edited reply",
      created_at: 100,
      edited_at: 120,
      reply_to_id: "90071992547409931234567890123455",
      media: [{ kind: "image", url: "https://cdn.remilia.net/a.png", width: 640, height: 480 }],
      reactions: [{ emoji: "🔥", count: 4 }],
    };

    expect(normalizeChatMessage(message.id, officialChatMessageRecord(message))).toMatchObject({
      id: message.id,
      author: { handle: "alice", displayName: "Alice" },
      body: "edited reply",
      edited_at: 120,
      reply_to_message_id: message.reply_to_id,
      media: [{ kind: "image", width: 640, height: 480 }],
      reactions: [{ emoji: "🔥", count: 4 }],
    });
  });

  it("canonicalizes safe legacy ids without truncating official ids", () => {
    expect(messageIdOrNull(42)).toBe("42");
    expect(messageIdOrNull("90071992547409931234567890123456")).toBe("90071992547409931234567890123456");
    expect(legacyMessageId("42")).toBe(42);
    expect(legacyMessageId("90071992547409931234567890123456")).toBe("90071992547409931234567890123456");
  });
});
