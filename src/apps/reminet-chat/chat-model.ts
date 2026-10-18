import type { RemiliaApiChatMessage } from "../../platform/auth/remilia-api";
import { normalizeOfficialChatMessage } from "./chat-rest";

export type ChatRuntimeRecord = Record<string, unknown>;

export type ApiUser = {
  id?: number;
  userId?: number;
  user_id?: number;
  handle?: string;
  userHandle?: string;
  user_handle?: string;
  username?: string;
  twitterHandle?: string;
  twitter_handle?: string;
  twitterUsername?: string;
  twitter_username?: string;
  twitterUrl?: string;
  twitter_url?: string;
  xHandle?: string;
  x_handle?: string;
  xUsername?: string;
  x_username?: string;
  xUrl?: string;
  x_url?: string;
  displayName?: string;
  display_name?: string;
  name?: string;
  profilePicUrl?: string;
  profile_pic_url?: string;
  pfpUrl?: string;
  pfp_url?: string;
  color?: number | string;
  theme?: string;
  connections?: unknown[];
  avatar_url?: string;
  avatar_url_small?: string;
};

export type MediaAttachment = {
  mediaId?: number | null;
  media_id?: number | null;
  url?: string | null;
  width?: number | null;
  height?: number | null;
  mimeType?: string | null;
  mime_type?: string | null;
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
  kind?: string;
  isAnimated?: boolean;
  is_animated?: boolean;
};

export type Reaction = {
  userId?: number;
  user_id?: number;
  user?: ApiUser | null;
  username?: string;
  handle?: string;
  name?: string;
  emoji?: string;
  count?: number;
};

export type MessageId = string;

export type ReplyReference = {
  id: MessageId;
  authorId?: number;
  author_id?: number;
  body?: string;
};

export type ApiMessage = {
  id: MessageId;
  chatId?: number;
  chat_id?: number;
  authorId?: number;
  author_id?: number;
  userId?: number;
  user_id?: number;
  body?: string;
  author?: ApiUser | null;
  createdAt?: number;
  created_at?: number;
  isDeleted?: boolean;
  is_deleted?: boolean;
  images?: MediaAttachment[] | null;
  video?: MediaAttachment | null;
  reactions?: Reaction[] | null;
  replyToMessageId?: MessageId | null;
  reply_to_message_id?: MessageId | null;
  inReplyToId?: MessageId;
  in_reply_to_id?: MessageId;
  replyTo?: ReplyReference | null;
  reply_to?: ReplyReference | null;
  inReplyTo?: ReplyReference | null;
  in_reply_to?: ReplyReference | null;
  media?: MediaAttachment[] | null;
  editedAt?: number;
  edited_at?: number;
};

export const SHOCKED_REACTION = "\u{1f62e}";
const REACTION_ALIASES = new Map([
  ["\u{1f62e}", SHOCKED_REACTION],
  ["\u{1f632}", SHOCKED_REACTION],
  ["\u{1f631}", SHOCKED_REACTION],
  ["\u{1f633}", SHOCKED_REACTION],
]);

export function normalizeChatMessage(id: unknown, value: ChatRuntimeRecord): ApiMessage | null {
  const normalizedId = messageIdOrNull(value.id ?? id);
  if (!normalizedId) return null;
  const author = value.author && typeof value.author === "object" ? value.author as ApiUser : null;
  return {
    id: normalizedId,
    chatId: numberOrUndefined(value.chatId ?? value.chat_id),
    chat_id: numberOrUndefined(value.chat_id ?? value.chatId),
    authorId: numberOrUndefined(value.authorId ?? value.author_id ?? value.userId ?? value.user_id),
    author_id: numberOrUndefined(value.author_id ?? value.authorId ?? value.user_id ?? value.userId),
    userId: numberOrUndefined(value.userId ?? value.user_id ?? value.authorId ?? value.author_id),
    user_id: numberOrUndefined(value.user_id ?? value.userId ?? value.author_id ?? value.authorId),
    body: typeof value.body === "string" ? value.body : "",
    author,
    createdAt: numberOrUndefined(value.createdAt ?? value.created_at),
    created_at: numberOrUndefined(value.created_at ?? value.createdAt),
    isDeleted: Boolean(value.isDeleted ?? value.is_deleted),
    is_deleted: Boolean(value.is_deleted ?? value.isDeleted),
    images: normalizeMediaList(value.images),
    video: normalizeMedia(value.video),
    media: normalizeMediaList(value.media),
    reactions: normalizeReactions(value.reactions),
    replyToMessageId: messageIdOrNull(value.replyToMessageId ?? value.reply_to_message_id ?? value.inReplyToId ?? value.in_reply_to_id),
    reply_to_message_id: messageIdOrNull(value.reply_to_message_id ?? value.replyToMessageId ?? value.in_reply_to_id ?? value.inReplyToId),
    inReplyToId: messageIdOrUndefined(value.inReplyToId ?? value.in_reply_to_id ?? value.replyToMessageId ?? value.reply_to_message_id),
    in_reply_to_id: messageIdOrUndefined(value.in_reply_to_id ?? value.inReplyToId ?? value.reply_to_message_id ?? value.replyToMessageId),
    replyTo: normalizeReplyReference(value.replyTo ?? value.replyToMessage ?? value.parentMessage),
    reply_to: normalizeReplyReference(value.reply_to ?? value.reply_to_message ?? value.parent_message),
    inReplyTo: normalizeReplyReference(value.inReplyTo ?? value.inReplyToMessage),
    in_reply_to: normalizeReplyReference(value.in_reply_to ?? value.in_reply_to_message),
    editedAt: numberOrUndefined(value.editedAt ?? value.edited_at),
    edited_at: numberOrUndefined(value.edited_at ?? value.editedAt),
  };
}

export function officialChatMessageRecord(message: RemiliaApiChatMessage): ChatRuntimeRecord {
  const official = normalizeOfficialChatMessage(message);
  return {
    id: official.id,
    chat_id: 1,
    author: officialIdentityToApiUser(official.author),
    body: official.text,
    created_at: official.createdAt,
    edited_at: official.editedAt,
    reply_to_message_id: official.replyToId,
    media: official.media,
    reactions: official.reactions,
  };
}

export function officialIdentityToApiUser(identity: RemiliaApiChatMessage["author"]): ApiUser {
  return {
    handle: identity.handle,
    username: identity.handle,
    userHandle: identity.handle,
    displayName: identity.display_name,
    display_name: identity.display_name,
    avatar_url: identity.avatar_url,
    avatar_url_small: identity.avatar_url_small,
    profilePicUrl: identity.avatar_url,
    pfpUrl: identity.avatar_url,
  };
}

export function normalizeReactionEmoji(value: unknown): string {
  if (typeof value !== "string") return "";
  const normalized = value.trim().replace(/\ufe0f/g, "");
  return REACTION_ALIASES.get(normalized) || normalized;
}

export function messageIdOrNull(value: unknown): MessageId | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return /^\d{1,32}$/.test(normalized) || /^local:\d+$/.test(normalized) ? normalized : null;
}

export function messageIdOrUndefined(value: unknown): MessageId | undefined {
  return messageIdOrNull(value) ?? undefined;
}

export function legacyMessageId(id: MessageId): number | string {
  const numeric = Number(id);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : id;
}

function normalizeMediaList(value: unknown): MediaAttachment[] | null {
  if (!Array.isArray(value)) return null;
  return value.map(normalizeMedia).filter((item): item is MediaAttachment => Boolean(item));
}

export function normalizeMedia(value: unknown): MediaAttachment | null {
  if (!value || typeof value !== "object") return null;
  const record = value as ChatRuntimeRecord;
  return {
    mediaId: numberOrNull(record.mediaId ?? record.media_id),
    media_id: numberOrNull(record.media_id ?? record.mediaId),
    url: stringOrNull(record.url ?? record.src ?? record.mediaUrl ?? record.media_url ?? record.videoUrl ?? record.video_url ?? record.sourceUrl ?? record.source_url),
    width: numberOrNull(record.width),
    height: numberOrNull(record.height),
    mimeType: stringOrNull(record.mimeType ?? record.mime_type),
    mime_type: stringOrNull(record.mime_type ?? record.mimeType),
    thumbnailUrl: stringOrNull(record.thumbnailUrl ?? record.thumbnail_url ?? record.thumbUrl ?? record.thumb_url ?? record.posterUrl ?? record.poster_url),
    thumbnail_url: stringOrNull(record.thumbnail_url ?? record.thumbnailUrl ?? record.thumb_url ?? record.thumbUrl ?? record.poster_url ?? record.posterUrl),
    kind: stringOrUndefined(record.kind),
    isAnimated: Boolean(record.isAnimated ?? record.is_animated),
    is_animated: Boolean(record.is_animated ?? record.isAnimated),
  };
}

function normalizeReactions(value: unknown): Reaction[] | null {
  if (!Array.isArray(value)) return null;
  return value.map((item) => {
    const record = objectValue(item);
    const userValue = record.user ?? record.author ?? record.profile;
    const user = userValue && typeof userValue === "object" ? userValue as ApiUser : null;
    return {
      userId: numberOrUndefined(record.userId ?? record.user_id),
      user_id: numberOrUndefined(record.user_id ?? record.userId),
      user,
      username: stringOrUndefined(record.username ?? record.userName ?? record.user_name ?? record.handle),
      handle: stringOrUndefined(record.handle ?? record.userHandle ?? record.user_handle),
      name: stringOrUndefined(record.name ?? record.displayName ?? record.display_name),
      emoji: normalizeReactionEmoji(stringOrUndefined(record.emoji ?? record.reaction)),
      count: Math.max(1, Math.floor(numberOrUndefined(record.count) ?? 1)),
    };
  }).filter((item) => item.emoji);
}

function normalizeReplyReference(value: unknown): ReplyReference | null {
  const record = objectValue(value);
  const id = messageIdOrNull(record.id ?? record.messageId ?? record.message_id);
  if (!id) return null;
  const authorId = numberOrUndefined(record.authorId ?? record.author_id ?? record.userId ?? record.user_id);
  return { id, authorId, author_id: authorId, body: stringOrUndefined(record.body ?? record.text ?? record.message) || "" };
}

function objectValue(value: unknown): ChatRuntimeRecord {
  return value && typeof value === "object" ? value as ChatRuntimeRecord : {};
}

function numberOrUndefined(value: unknown): number | undefined {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function numberOrNull(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value ? value : null;
}
