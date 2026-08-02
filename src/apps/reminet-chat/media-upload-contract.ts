export type ConfirmedMedia = {
  url: string | null;
  mimeType: string | null;
  mediaId: number;
  width: number | null;
  height: number | null;
};

export function confirmedMediaFromResponse(value: unknown): ConfirmedMedia | null {
  const response = objectValue(value);
  const media = Array.isArray(response.media) ? objectValue(response.media[0]) : {};
  const mediaId = finiteNumber(media.media_id ?? media.mediaId);
  if (mediaId === null) return null;
  return {
    url: nonEmptyString(media.url),
    mimeType: nonEmptyString(media.mime_type ?? media.mimeType),
    mediaId,
    width: finiteNumber(media.width),
    height: finiteNumber(media.height),
  };
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function finiteNumber(value: unknown): number | null {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}
