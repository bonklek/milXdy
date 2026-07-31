export type OpaqueMediaHandleRecord = {
  appId: string;
  actionId: string;
  mimeType: string;
  bytes: Uint8Array;
  width: number | null;
  height: number | null;
  altAvailable: boolean;
  expiresAt: number;
};
export const OPAQUE_MEDIA_HANDLE_TTL_MS = 5 * 60_000;

/** In-memory, one-use host storage. Package code never sees image bytes or URLs. */
export class OpaqueMediaHandleStore {
  #records = new Map<string, OpaqueMediaHandleRecord>();
  #claimed = new Set<string>();
  #sequence = 0;

  create(record: Omit<OpaqueMediaHandleRecord, "expiresAt">, now = Date.now()): string {
    this.prune(now);
    const handle = `media.${++this.#sequence}.${crypto.randomUUID()}`;
    this.#records.set(handle, { ...record, expiresAt: now + OPAQUE_MEDIA_HANDLE_TTL_MS });
    return handle;
  }

  restore(handle: string, record: OpaqueMediaHandleRecord, now = Date.now()): boolean {
    if (!/^media\.\d+\.[0-9a-f-]+$/iu.test(handle) || record.expiresAt < now) return false;
    this.#records.set(handle, record);
    return true;
  }

  claim(handle: string, appId: string, actionId: string, now = Date.now()): OpaqueMediaHandleRecord | null {
    const record = this.#records.get(handle);
    if (!record || this.#claimed.has(handle) || record.expiresAt < now || record.appId !== appId || record.actionId !== actionId) return null;
    this.#claimed.add(handle);
    return record;
  }

  release(handle: string): void {
    this.#claimed.delete(handle);
  }

  consume(handle: string): void {
    this.#claimed.delete(handle);
    this.#records.delete(handle);
  }

  clear(): void {
    this.#claimed.clear();
    this.#records.clear();
  }

  prune(now = Date.now()): void {
    for (const [handle, record] of this.#records) if (record.expiresAt < now) this.consume(handle);
  }
}

export function validateMediaContributionTags(value: unknown, maxTags: number, maxTagLength: number): string[] | null {
  if (!Array.isArray(value) || value.length > maxTags) return null;
  const tags = value.map((tag) => typeof tag === "string" ? tag.trim() : "");
  if (tags.some((tag) => !tag || tag.length > maxTagLength || !/^[\p{L}\p{N}][\p{L}\p{N} _.-]*$/u.test(tag))) return null;
  if (new Set(tags).size !== tags.length) return null;
  return tags;
}

export function remibooruUploadSizeBucket(bytes: number): string {
  const mb = 1024 * 1024;
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown";
  if (bytes < mb) return "under_1_mb";
  if (bytes < 5 * mb) return "1_to_5_mb";
  if (bytes < 10 * mb) return "5_to_10_mb";
  if (bytes <= 25 * mb) return "10_to_25_mb";
  return "over_25_mb";
}
