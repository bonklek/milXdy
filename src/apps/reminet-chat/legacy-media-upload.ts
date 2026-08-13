import {
  LEGACY_CONFIRM_TIMEOUT_MS,
  LEGACY_MEDIA_CONFIRM_URL,
  LEGACY_MEDIA_UPLOAD_URL,
  LEGACY_RESPONSE_MAX_BYTES,
  LEGACY_UPLOAD_TIMEOUT_MS,
  estimatedBase64Bytes,
  isAllowedLegacyMediaType,
  isExactLegacyHttpEndpoint,
  maxLegacyAttachmentBytes,
  parseLegacyConfirmedMedia,
  parseLegacyUploadToken,
  publicLegacyFailure,
  type LegacyAdapterFailure,
  type LegacyMediaUploadRequest,
  type LegacyMediaUploadOutcome,
} from "./legacy-adapters";

export type LegacyMediaUploadDependencies = Readonly<{
  fetch: typeof fetch;
  accessToken: string;
}>;

type DecodedLegacyAttachment = Readonly<{
  contentType: string;
  bytes: Uint8Array<ArrayBuffer>;
}>;

const GENERIC_FILE_EXTENSIONS: Readonly<Record<string, string>> = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/gif": "gif",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
});

export async function executeLegacyMediaUpload(
  request: LegacyMediaUploadRequest,
  dependencies: LegacyMediaUploadDependencies,
): Promise<LegacyMediaUploadOutcome> {
  const decoded = decodeLegacyAttachmentDataUrl(request);
  if (!decoded.ok) return decoded;

  const form = new FormData();
  const extension = GENERIC_FILE_EXTENSIONS[decoded.attachment.contentType] || "bin";
  const blob = new Blob([decoded.attachment.bytes], { type: decoded.attachment.contentType });
  form.append("file", blob, `attachment.${extension}`);

  const uploaded = await requestLegacyJson(
    dependencies.fetch,
    LEGACY_MEDIA_UPLOAD_URL,
    { method: "POST", headers: { Authorization: `Bearer ${dependencies.accessToken}` }, body: form },
    LEGACY_UPLOAD_TIMEOUT_MS,
    "LEGACY_UPLOAD_TIMEOUT",
    "LEGACY_UPLOAD_REJECTED",
    "LEGACY_UPLOAD_RESPONSE_INVALID",
  );
  if (!uploaded.ok) return uploaded;
  const token = parseLegacyUploadToken(uploaded.data);
  if (!token) return publicLegacyFailure("LEGACY_UPLOAD_RESPONSE_INVALID", false);

  const confirmed = await requestLegacyJson(
    dependencies.fetch,
    LEGACY_MEDIA_CONFIRM_URL,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${dependencies.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ tokens: [token] }),
    },
    LEGACY_CONFIRM_TIMEOUT_MS,
    "LEGACY_CONFIRM_TIMEOUT",
    "LEGACY_CONFIRM_REJECTED",
    "LEGACY_CONFIRM_RESPONSE_INVALID",
  );
  if (!confirmed.ok) return confirmed;
  const media = parseLegacyConfirmedMedia(confirmed.data, request.mimeType);
  if (!media) return publicLegacyFailure("LEGACY_CONFIRM_RESPONSE_INVALID", false);
  return { ok: true, media };
}

export function decodeLegacyAttachmentDataUrl(
  request: LegacyMediaUploadRequest,
): Readonly<{ ok: true; attachment: DecodedLegacyAttachment }> | LegacyAdapterFailure {
  const declaredMimeType = request.mimeType.toLowerCase();
  if (!isAllowedLegacyMediaType(declaredMimeType)) {
    return publicLegacyFailure("UNSUPPORTED_ATTACHMENT_TYPE", false);
  }
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/]*={0,2})$/u.exec(request.dataUrl);
  if (!match) return publicLegacyFailure("INVALID_ATTACHMENT", false);
  const contentType = match[1].toLowerCase();
  if (contentType !== declaredMimeType) return publicLegacyFailure("ATTACHMENT_TYPE_MISMATCH", false);
  const base64 = match[2];
  if (base64.length === 0 || estimatedBase64Bytes(base64) === 0) return publicLegacyFailure("INVALID_ATTACHMENT", false);
  const maxBytes = maxLegacyAttachmentBytes(contentType);
  if (estimatedBase64Bytes(base64) > maxBytes) return publicLegacyFailure("ATTACHMENT_TOO_LARGE", false);
  try {
    const binary = atob(base64);
    if (binary.length > maxBytes) return publicLegacyFailure("ATTACHMENT_TOO_LARGE", false);
    const bytes = new Uint8Array(new ArrayBuffer(binary.length));
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return { ok: true, attachment: { contentType, bytes } };
  } catch {
    return publicLegacyFailure("INVALID_ATTACHMENT", false);
  }
}

async function requestLegacyJson(
  fetchImpl: typeof fetch,
  endpoint: string,
  init: RequestInit,
  timeoutMs: number,
  timeoutError: "LEGACY_UPLOAD_TIMEOUT" | "LEGACY_CONFIRM_TIMEOUT",
  rejectedError: "LEGACY_UPLOAD_REJECTED" | "LEGACY_CONFIRM_REJECTED",
  invalidError: "LEGACY_UPLOAD_RESPONSE_INVALID" | "LEGACY_CONFIRM_RESPONSE_INVALID",
): Promise<Readonly<{ ok: true; data: unknown }> | LegacyAdapterFailure> {
  if (!isExactLegacyHttpEndpoint(endpoint, endpoint)) return publicLegacyFailure(invalidError, false);
  const deadline = new AbortController();
  const timer = setTimeout(() => deadline.abort(new DOMException("Legacy adapter deadline exceeded", "TimeoutError")), timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetchImpl(endpoint, {
        ...init,
        credentials: "omit",
        headers: {
          Accept: "application/json",
          ...(init.headers || {}),
        },
        redirect: "error",
        referrerPolicy: "no-referrer",
        signal: deadline.signal,
      });
    } catch (error) {
      if (deadline.signal.aborted || (error instanceof DOMException && error.name === "TimeoutError")) {
        return publicLegacyFailure(timeoutError, true);
      }
      return publicLegacyFailure(rejectedError, true);
    }
    if (!response.ok) return publicLegacyFailure(rejectedError, response.status >= 500 || response.status === 429);
    const finalUrl = response.url || endpoint;
    if (!isExactLegacyHttpEndpoint(finalUrl, endpoint)) return publicLegacyFailure(invalidError, false);
    const contentType = (response.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("application/json")) return publicLegacyFailure(invalidError, false);
    let bytes: Uint8Array<ArrayBuffer> | null;
    try {
      bytes = await readCappedResponseBytes(response, LEGACY_RESPONSE_MAX_BYTES);
    } catch {
      return deadline.signal.aborted
        ? publicLegacyFailure(timeoutError, true)
        : publicLegacyFailure(rejectedError, true);
    }
    if (!bytes) return publicLegacyFailure(invalidError, false);
    try {
      return { ok: true, data: JSON.parse(new TextDecoder().decode(bytes)) };
    } catch {
      return publicLegacyFailure(invalidError, false);
    }
  } finally {
    clearTimeout(timer);
  }
}

async function readCappedResponseBytes(response: Response, maxBytes: number): Promise<Uint8Array<ArrayBuffer> | null> {
  const contentLength = Number(response.headers.get("content-length") || "");
  if (Number.isFinite(contentLength) && contentLength > maxBytes) return null;
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.byteLength <= maxBytes ? bytes : null;
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel("Legacy response exceeds byte limit");
        return null;
      }
      chunks.push(new Uint8Array(value));
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(new ArrayBuffer(total));
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return combined;
}
