import { legacyMessageId, type MediaAttachment, type MessageId } from "./chat-model";
import {
  LEGACY_CHAT_ID,
  type LegacyAdapterErrorCode,
  type LegacyMediaReference,
  type LegacyMediaSubmitMutation,
} from "./legacy-adapters";

export function legacyReplyId(replyToId: MessageId | undefined): number | null {
  if (!replyToId) return null;
  const candidate = legacyMessageId(replyToId);
  return typeof candidate === "number" ? candidate : null;
}

export function legacyMediaSubmitMutation(
  text: string,
  replyToId: number | null,
  attachments: readonly MediaAttachment[],
): LegacyMediaSubmitMutation | null {
  const mediaIds = attachments
    .map((media) => media.mediaId ?? media.media_id ?? null)
    .filter((id): id is number => typeof id === "number" && Number.isSafeInteger(id) && id > 0);
  if (mediaIds.length !== attachments.length || mediaIds.length < 1) return null;
  return {
    type: "submit",
    payload: {
      chat_id: LEGACY_CHAT_ID,
      text,
      ...(replyToId === null ? {} : { in_reply_to_id: replyToId }),
      media_ids: mediaIds,
    },
  };
}

export function legacyMediaAttachment(media: LegacyMediaReference): MediaAttachment {
  return {
    mediaId: media.mediaId,
    media_id: media.mediaId,
    url: media.url,
    mimeType: media.mimeType,
    mime_type: media.mimeType,
    width: media.width,
    height: media.height,
  };
}

export function legacyMediaFailureMessage(error: LegacyAdapterErrorCode): string {
  if (error === "AUTH_REQUIRED") return "Connect Remilia to send media.";
  if (error === "ATTACHMENT_TOO_LARGE") return "The selected attachment is too large.";
  if (error === "UNSUPPORTED_ATTACHMENT_TYPE" || error === "ATTACHMENT_TYPE_MISMATCH" || error === "INVALID_ATTACHMENT") {
    return "The selected attachment is not supported.";
  }
  if (error === "LEGACY_MEDIA_SUBMIT_UNAVAILABLE" || error === "LEGACY_MEDIA_SUBMIT_REJECTED") {
    return "The legacy media sender is unavailable. Your message and attachments were kept.";
  }
  return "The legacy media upload failed. Your message and attachments were kept.";
}
