import { registerBackgroundMessageHandlers, runNetworkTask } from "../../platform/background/router";
import { isAllowedPublishTwitterOembedUrl, isAllowedXStatusUrl } from "./urlPolicy";

type FetchJsonMessage = {
  type: "post-reading:fetchJson";
  url: string;
};

type FetchTextMessage = {
  type: "post-reading:fetchText";
  url: string;
};

type FetchBlobMessage = {
  type: "post-reading:fetchBlob";
  url: string;
};

type BackgroundMessage = FetchJsonMessage | FetchTextMessage | FetchBlobMessage;
const MAX_JSON_RESPONSE_BYTES = 512 * 1024;
const MAX_TEXT_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_BLOB_RESPONSE_BYTES = 8 * 1024 * 1024;
const RESPONSE_TOO_LARGE_ERROR = "RESPONSE_TOO_LARGE";

registerBackgroundMessageHandlers([{
  type: "post-reading:fetch",
  matches: isBackgroundMessage,
  handle: fetchPostReadingResource,
}]);

async function fetchPostReadingResource(message: BackgroundMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  try {
    if (!isAllowedPostReadingSender(message, sender)) {
      return { ok: false, status: 0, error: "UNSUPPORTED_SENDER" };
    }
    if (!isAllowedFetchMessage(message)) {
      return { ok: false, status: 0, error: "UNSUPPORTED_URL" };
    }
    const response = await runNetworkTask(
      (signal) => fetch(message.url, { credentials: "omit", signal }),
      message.type,
    );
    if (!response.ok) return { ok: false, status: response.status, error: `HTTP ${response.status}` };
    const contentType = response.headers.get("content-type") || "";
    const maxBytes = maxResponseBytes(message);
    if (!isAllowedResponseContentType(message, contentType)) {
      return { ok: false, status: response.status, error: "UNSUPPORTED_CONTENT_TYPE", contentType };
    }
    if (!isAllowedResponseSize(response, maxBytes)) {
      return { ok: false, status: response.status, error: RESPONSE_TOO_LARGE_ERROR };
    }
    if (message.type === "post-reading:fetchJson") {
      const text = await readCappedText(response, maxBytes);
      return { ok: true, data: JSON.parse(text) };
    }
    if (message.type === "post-reading:fetchBlob") {
      const buffer = await readCappedArrayBuffer(response, maxBytes);
      return { ok: true, contentType: contentType || "application/octet-stream", base64: arrayBufferToBase64(buffer) };
    }
    return { ok: true, text: await readCappedText(response, maxBytes) };
  } catch (error) {
    return { ok: false, status: 0, error: error instanceof Error ? error.message : String(error) };
  }
}

function isAllowedPostReadingSender(message: BackgroundMessage, sender: chrome.runtime.MessageSender): boolean {
  if (message.type === "post-reading:fetchBlob") return isPostReadingOcrFrameSender(sender);
  return isXContentScriptSender(sender);
}

function isXContentScriptSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  if (typeof sender.tab?.id !== "number") return false;
  if (sender.frameId !== undefined && sender.frameId !== 0) return false;
  const source = sender.url || sender.origin || sender.tab.url || "";
  try {
    const url = new URL(source);
    return url.protocol === "https:" && (url.hostname === "x.com" || url.hostname === "twitter.com");
  } catch {
    return false;
  }
}

function maxResponseBytes(message: BackgroundMessage): number {
  if (message.type === "post-reading:fetchJson") return MAX_JSON_RESPONSE_BYTES;
  if (message.type === "post-reading:fetchBlob") return MAX_BLOB_RESPONSE_BYTES;
  return MAX_TEXT_RESPONSE_BYTES;
}

function isAllowedResponseContentType(message: BackgroundMessage, contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  if (message.type === "post-reading:fetchJson") return normalized.startsWith("application/json") || normalized.startsWith("text/javascript");
  if (message.type === "post-reading:fetchBlob") return normalized.startsWith("image/");
  return normalized.startsWith("text/html")
    || normalized.startsWith("application/xhtml+xml");
}

function isAllowedResponseSize(response: Response, maxBytes: number): boolean {
  const length = Number(response.headers.get("content-length") || "");
  return !Number.isFinite(length) || length <= maxBytes;
}

async function readCappedText(response: Response, maxBytes: number): Promise<string> {
  const buffer = await readCappedArrayBuffer(response, maxBytes);
  return new TextDecoder().decode(buffer);
}

async function readCappedArrayBuffer(response: Response, maxBytes: number): Promise<ArrayBuffer> {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength) {
    const parsedLength = Number.parseInt(declaredLength, 10);
    if (Number.isFinite(parsedLength) && parsedLength > maxBytes) throw new Error(RESPONSE_TOO_LARGE_ERROR);
  }
  if (!response.body) {
    throw new Error(RESPONSE_TOO_LARGE_ERROR);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => undefined);
        throw new Error(RESPONSE_TOO_LARGE_ERROR);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}

function isPostReadingOcrFrameSender(sender: chrome.runtime.MessageSender): boolean {
  if (sender.id !== chrome.runtime.id) return false;
  if (typeof sender.frameId !== "number" || sender.frameId <= 0) return false;
  const source = sender.url || sender.origin || "";
  try {
    const url = new URL(source);
    const ocrUrl = new URL(chrome.runtime.getURL("ocr.html"));
    return url.origin === ocrUrl.origin && url.pathname === ocrUrl.pathname;
  } catch {
    return false;
  }
}

function isBackgroundMessage(message: unknown): message is BackgroundMessage {
  if (!message || typeof message !== "object") return false;
  const record = message as Record<string, unknown>;
  return (
    record.type === "post-reading:fetchJson"
    || record.type === "post-reading:fetchText"
    || record.type === "post-reading:fetchBlob"
  ) && typeof record.url === "string";
}

function isAllowedFetchMessage(message: BackgroundMessage): boolean {
  let url: URL;
  try {
    url = new URL(message.url);
  } catch {
    return false;
  }

  if (message.type === "post-reading:fetchJson") {
    if (url.protocol !== "https:") return false;
    if (url.hostname === "cdn.syndication.twimg.com") return url.pathname === "/tweet-result";
    if (url.hostname === "publish.twitter.com") return isAllowedPublishTwitterOembedUrl(url);
    return false;
  }

  if (message.type === "post-reading:fetchBlob") {
    return url.protocol === "https:"
      && url.hostname === "pbs.twimg.com"
      && url.pathname.startsWith("/media/");
  }

  if (url.protocol !== "https:") return false;
  if (url.hostname === "x.com" || url.hostname === "twitter.com") return isAllowedXStatusUrl(url.toString());
  return false;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}
