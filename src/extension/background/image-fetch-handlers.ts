import { parseAllowedUrl, type UrlAllowRule } from "../../platform/browser/url-allowlist";

type NetworkFetch = (input: RequestInfo | URL, init?: RequestInit, label?: string) => Promise<Response>;

export const MUSIC_IMAGE_RULES: readonly UrlAllowRule[] = [
  { origin: "https://pbs.twimg.com" },
  { origin: "https://boards.miladychan.org" },
];

export const MILADY_MAKER_BANNER_RULES: readonly UrlAllowRule[] = [
  { origin: "https://miladymaker.net", pathPattern: /^\/banners\/nft\/\d+\.png$/ },
];

export const WIKI_IMAGE_RULES: readonly UrlAllowRule[] = [
  { origin: "https://wiki.remilia.org", pathPrefix: "/images/" },
  { origin: "https://remilia.wiki", pathPrefix: "/images/" },
];

export const MAX_IMAGE_RESPONSE_BYTES = 5 * 1024 * 1024;

export const IMAGE_TOO_LARGE_ERROR = "IMAGE_TOO_LARGE";

export async function fetchMusicImageDataUrl(url: string, budgetedFetch: NetworkFetch): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, MUSIC_IMAGE_RULES);
  if (!parsed) return { ok: false, status: 0, error: "Unsupported image URL." };
  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "music:image");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "image/png";
    if (!/^image\//i.test(contentType)) return { ok: false, status: response.status, error: "Unsupported image type." };
    const bytes = await readCappedResponseBytes(response, MAX_IMAGE_RESPONSE_BYTES);
    return { ok: true, status: response.status, dataUrl: `data:${contentType};base64,${base64Encode(bytes)}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function fetchImageDataUrl(url: string, budgetedFetch: NetworkFetch): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, MILADY_MAKER_BANNER_RULES);
  if (!parsed) {
    return { ok: false, error: "UNSUPPORTED_IMAGE_URL" };
  }

  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "milxdy:imageDataUrl");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "image/png";
    if (!/^image\/png\b/i.test(contentType)) return { ok: false, error: "UNSUPPORTED_IMAGE_TYPE" };
    const bytes = await readCappedResponseBytes(response, MAX_IMAGE_RESPONSE_BYTES);
    return { ok: true, dataUrl: `data:${contentType};base64,${base64Encode(bytes)}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

export async function fetchWikiImageDataUrl(url: string, budgetedFetch: NetworkFetch): Promise<Record<string, unknown>> {
  const parsed = parseAllowedUrl(url, WIKI_IMAGE_RULES);
  if (!parsed) return { ok: false, status: 0, error: "Unsupported wiki image URL." };
  try {
    const response = await budgetedFetch(parsed.href, { credentials: "omit" }, "wiki:image");
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "image/png";
    if (!/^image\//i.test(contentType)) return { ok: false, status: response.status, error: "Unsupported image type." };
    const bytes = await readCappedResponseBytes(response, MAX_IMAGE_RESPONSE_BYTES);
    return { ok: true, status: response.status, dataUrl: `data:${contentType};base64,${base64Encode(bytes)}` };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

export function base64Encode(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function readCappedResponseBytes(response: Response, maxBytes: number): Promise<Uint8Array> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number.parseInt(declaredLength, 10);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) throw new Error(IMAGE_TOO_LARGE_ERROR);
  }
  if (!response.body) throw new Error(IMAGE_TOO_LARGE_ERROR);

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(IMAGE_TOO_LARGE_ERROR);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}
