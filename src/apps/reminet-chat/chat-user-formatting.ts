import { absoluteRemiliaMediaUrl, isRemiliaMediaUrl } from "../../platform/media/remilia-media-allowlist";
import type { ApiMessage, ApiUser, MediaAttachment } from "./chat-model";

type RuntimeRecord = Record<string, unknown>;

export function displayName(user: ApiUser | null, authorId: number, message: ApiMessage): string {
  const handleValue = remiliaHandle(user);
  return user?.displayName || user?.display_name || user?.name || handleValue || (message.id.startsWith("local:") ? "You" : `User ${authorId || "?"}`);
}

export function remiliaUserColor(user: ApiUser | null): string {
  const hue = remiliaUserHue(user);
  return hue === null ? "" : `hsl(${hue}, 60%, 45%)`;
}

function remiliaUserHue(user: ApiUser | null): number | null {
  const raw = user?.color;
  if (typeof raw === "number" && Number.isFinite(raw)) return normalizeHue(raw);
  if (typeof raw === "string" && /^\d+(\.\d+)?$/.test(raw.trim())) return normalizeHue(Number(raw));
  return null;
}

function normalizeHue(value: number): number {
  return ((Math.round(value) % 360) + 360) % 360;
}

export function remiliaHandle(user: ApiUser | null): string {
  return user?.handle || user?.userHandle || user?.user_handle || user?.username || "";
}

export function avatarUrl(user: ApiUser | null): string {
  return user?.profilePicUrl || user?.profile_pic_url || user?.pfpUrl || user?.pfp_url || user?.avatar_url || user?.avatar_url_small || "";
}

export function connectedXHandle(user: ApiUser | null): string {
  const direct = user?.twitterHandle
    || user?.twitter_handle
    || user?.twitterUsername
    || user?.twitter_username
    || user?.xHandle
    || user?.x_handle
    || user?.xUsername
    || user?.x_username
    || handleFromUrl(user?.twitterUrl || user?.twitter_url || user?.xUrl || user?.x_url);
  if (direct) return cleanXHandle(direct);
  const record = objectValue(user);
  const nestedHandle = findNestedXHandle(record);
  if (nestedHandle) return nestedHandle;
  const deepHandle = findDeepXHandle(record);
  if (deepHandle) return deepHandle;
  for (const item of user?.connections || []) {
    const record = objectValue(item);
    const provider = String(record.provider || record.type || record.platform || record.service || record.kind || "").toLowerCase();
    if (!/twitter|x/.test(provider)) continue;
    const handle = stringOrUndefined(record.handle
      ?? record.username
      ?? record.userName
      ?? record.user_name
      ?? record.screenName
      ?? record.screen_name
      ?? record.nickname
      ?? record.name
      ?? handleFromUrl(stringOrUndefined(record.url ?? record.href ?? record.profileUrl ?? record.profile_url)));
    if (handle) return cleanXHandle(handle);
  }
  return "";
}

export function findDeepXHandle(value: unknown, depth = 0): string {
  if (!value || typeof value !== "object" || depth > 4) return "";
  const record = value as RuntimeRecord;
  const direct = stringOrUndefined(record.twitterHandle
    ?? record.twitter_handle
    ?? record.twitterUsername
    ?? record.twitter_username
    ?? record.xHandle
    ?? record.x_handle
    ?? record.xUsername
    ?? record.x_username
    ?? record.screenName
    ?? record.screen_name
    ?? handleFromUrl(stringOrUndefined(record.twitterUrl ?? record.twitter_url ?? record.xUrl ?? record.x_url ?? record.url ?? record.href)));
  if (direct) return cleanXHandle(direct);

  const provider = String(record.provider || record.type || record.platform || record.service || record.kind || record.network || "").toLowerCase();
  if (/twitter|^x$/.test(provider)) {
    const handle = stringOrUndefined(record.handle
      ?? record.username
      ?? record.userName
      ?? record.user_name
      ?? record.name
      ?? record.nickname
      ?? handleFromUrl(stringOrUndefined(record.url ?? record.href ?? record.profileUrl ?? record.profile_url)));
    if (handle) return cleanXHandle(handle);
  }

  for (const [key, nested] of Object.entries(record)) {
    if (!/(twitter|x|social|connection|account|profile|links?)/i.test(key) && depth > 0) continue;
    if (Array.isArray(nested)) {
      for (const item of nested) {
        const handle = findDeepXHandle(item, depth + 1);
        if (handle) return handle;
      }
      continue;
    }
    const handle = findDeepXHandle(nested, depth + 1);
    if (handle) return handle;
  }
  return "";
}

function findNestedXHandle(record: RuntimeRecord): string {
  for (const key of ["twitter", "x", "twitterAccount", "twitter_account", "xAccount", "x_account", "socials", "social"]) {
    const value = record[key];
    if (!value || typeof value !== "object") continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        const itemRecord = objectValue(item);
        const provider = String(itemRecord.provider || itemRecord.type || itemRecord.platform || itemRecord.service || itemRecord.kind || "").toLowerCase();
        if (!/twitter|x/.test(provider)) continue;
        const handle = handleFromSocialRecord(itemRecord);
        if (handle) return handle;
      }
      continue;
    }
    const handle = handleFromSocialRecord(value as RuntimeRecord);
    if (handle) return handle;
  }
  return "";
}

function handleFromSocialRecord(record: RuntimeRecord): string {
  const handle = stringOrUndefined(record.handle
    ?? record.username
    ?? record.userName
    ?? record.user_name
    ?? record.screenName
    ?? record.screen_name
    ?? record.nickname
    ?? record.name
    ?? handleFromUrl(stringOrUndefined(record.url ?? record.href ?? record.profileUrl ?? record.profile_url)));
  return handle ? cleanXHandle(handle) : "";
}

function handleFromUrl(value: string | undefined): string {
  if (!value) return "";
  const match = value.match(/(?:twitter\.com|x\.com)\/@?([^/?#]+)/i);
  return match ? match[1] : "";
}

function cleanXHandle(value: string): string {
  return value.replace(/^@/, "").replace(/^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\//i, "").split(/[/?#]/)[0];
}

export function cleanUsername(value: string): string {
  return value.trim().replace(/^[@~]/, "").replace(/[^a-zA-Z0-9_-]/g, "");
}

function objectValue(value: unknown): RuntimeRecord {
  return value && typeof value === "object" ? value as RuntimeRecord : {};
}

function stringOrUndefined(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}
