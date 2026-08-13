import { createBackgroundNetworkDeadlineSignal, registerBackgroundMessageHandlers, runNetworkTask } from "../../platform/background/router";
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

type GenerateAudioExportMessage = {
  type: "post-reading:generateAudioExport";
  requestId: string;
  endpoint: string;
  text: string;
  rate: number;
  volume: number;
  voiceURI: string | null;
};

type CancelAudioExportMessage = {
  type: "post-reading:cancelAudioExport";
  requestId: string;
};

type FetchResourceMessage = FetchJsonMessage | FetchTextMessage | FetchBlobMessage;
type BackgroundMessage = FetchResourceMessage | GenerateAudioExportMessage | CancelAudioExportMessage;
const MAX_JSON_RESPONSE_BYTES = 512 * 1024;
const MAX_TEXT_RESPONSE_BYTES = 2 * 1024 * 1024;
const MAX_BLOB_RESPONSE_BYTES = 8 * 1024 * 1024;
const RESPONSE_TOO_LARGE_ERROR = "RESPONSE_TOO_LARGE";
const MAX_AUDIO_EXPORT_BYTES = 50 * 1024 * 1024;
const MAX_AUDIO_EXPORT_ENVELOPE_BYTES = Math.ceil((MAX_AUDIO_EXPORT_BYTES * 4) / 3) + 1024 * 1024;
const activeAudioExports = new Map<string, AbortController>();
const canceledAudioExports = new Set<string>();

registerBackgroundMessageHandlers([{
  type: "post-reading:fetch",
  matches: isBackgroundMessage,
  handle: handlePostReadingBackgroundMessage,
}]);

export async function handlePostReadingBackgroundMessage(message: BackgroundMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  if (message.type === "post-reading:generateAudioExport") return generateAudioExport(message, sender);
  if (message.type === "post-reading:cancelAudioExport") return cancelAudioExport(message, sender);
  return fetchPostReadingResource(message, sender);
}

async function fetchPostReadingResource(message: FetchResourceMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  try {
    if (!isAllowedPostReadingSender(message, sender)) {
      return { ok: false, status: 0, error: "UNSUPPORTED_SENDER" };
    }
    if (!isAllowedFetchMessage(message)) {
      return { ok: false, status: 0, error: "UNSUPPORTED_URL" };
    }
    const response = await runNetworkTask(
      (signal) => fetch(message.url, {
        credentials: "omit",
        signal: AbortSignal.any([signal, createBackgroundNetworkDeadlineSignal()]),
      }),
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

async function generateAudioExport(message: GenerateAudioExportMessage, sender: chrome.runtime.MessageSender): Promise<Record<string, unknown>> {
  const senderKey = audioExportSenderKey(sender);
  if (!senderKey || !isValidRequestId(message.requestId)) return { ok: false, error: "UNSUPPORTED_SENDER" };
  const key = `${senderKey}:${message.requestId}`;
  if (canceledAudioExports.delete(key)) return { ok: false, error: "Audio generation canceled." };
  if (activeAudioExports.has(key)) return { ok: false, error: "Audio generation request is already active." };
  let endpoint: string;
  try {
    endpoint = normalizeLoopbackUrl(message.endpoint, "Custom TTS endpoint");
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  if (!isValidAudioExportPayload(message)) return { ok: false, error: "Custom TTS request is invalid." };
  const abort = new AbortController();
  activeAudioExports.set(key, abort);
  try {
    const payload = await fetchAudioExportEnvelope(endpoint, message, abort.signal);
    if (typeof payload.audioBase64 === "string" && payload.audioBase64.length > 0) {
      validateBase64Audio(payload.audioBase64);
      return {
        ok: true,
        audioBase64: payload.audioBase64,
        audioContentType: typeof payload.audioContentType === "string" ? payload.audioContentType : "audio/mpeg",
        boundaries: payload.boundaries,
      };
    }
    if (typeof payload.audioUrl !== "string" || payload.audioUrl.length === 0) {
      return { ok: false, error: "Custom TTS response must include audioBase64 or a loopback audioUrl." };
    }
    const audioUrl = normalizeLoopbackUrl(payload.audioUrl, "Custom TTS audio URL");
    const response = await runNetworkTask((signal) => fetch(audioUrl, {
      credentials: "omit",
      signal: AbortSignal.any([signal, abort.signal, createBackgroundNetworkDeadlineSignal()]),
    }), "post-reading:audioExportResult");
    if (!response.ok) return { ok: false, error: `Custom TTS audio URL returned HTTP ${response.status}.` };
    const buffer = await readCappedArrayBuffer(response, MAX_AUDIO_EXPORT_BYTES);
    return {
      ok: true,
      audioBase64: arrayBufferToBase64(buffer),
      audioContentType: response.headers.get("content-type") || (typeof payload.audioContentType === "string" ? payload.audioContentType : "audio/mpeg"),
      boundaries: payload.boundaries,
    };
  } catch (error) {
    if (abort.signal.aborted) return { ok: false, error: "Audio generation canceled." };
    return { ok: false, error: normalizeAudioExportError(error) };
  } finally {
    if (activeAudioExports.get(key) === abort) activeAudioExports.delete(key);
  }
}

function cancelAudioExport(message: CancelAudioExportMessage, sender: chrome.runtime.MessageSender): Record<string, unknown> {
  const senderKey = audioExportSenderKey(sender);
  if (!senderKey || !isValidRequestId(message.requestId)) return { ok: false, error: "UNSUPPORTED_SENDER" };
  const abort = activeAudioExports.get(`${senderKey}:${message.requestId}`);
  if (!abort) {
    rememberCanceledAudioExport(`${senderKey}:${message.requestId}`);
    return { ok: true, canceled: true };
  }
  abort.abort(new DOMException("Audio generation canceled", "AbortError"));
  return { ok: true, canceled: true };
}

function rememberCanceledAudioExport(key: string): void {
  canceledAudioExports.add(key);
  setTimeout(() => canceledAudioExports.delete(key), 60_000);
}

async function fetchAudioExportEnvelope(
  endpoint: string,
  message: GenerateAudioExportMessage,
  cancelSignal: AbortSignal,
): Promise<Record<string, unknown>> {
  const response = await runNetworkTask((signal) => fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "omit",
    body: JSON.stringify({ text: message.text, rate: message.rate, volume: message.volume, voiceURI: message.voiceURI }),
    signal: AbortSignal.any([signal, cancelSignal, createBackgroundNetworkDeadlineSignal()]),
  }), "post-reading:generateAudioExport");
  if (!response.ok) throw new Error(`Custom TTS endpoint returned HTTP ${response.status}.`);
  const text = await readCappedText(response, MAX_AUDIO_EXPORT_ENVELOPE_BYTES);
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("Custom TTS endpoint returned invalid JSON.");
  }
}

function audioExportSenderKey(sender: chrome.runtime.MessageSender): string | null {
  if (sender.id !== chrome.runtime.id || typeof sender.tab?.id !== "number" || (sender.frameId !== undefined && sender.frameId !== 0)) return null;
  const source = sender.url || sender.origin || sender.tab.url || "";
  try {
    const protocol = new URL(source).protocol;
    return protocol === "http:" || protocol === "https:" ? String(sender.tab.id) : null;
  } catch {
    return null;
  }
}

function isValidRequestId(value: string): boolean {
  return typeof value === "string" && /^[A-Za-z0-9-]{8,80}$/u.test(value);
}

function isValidAudioExportPayload(message: GenerateAudioExportMessage): boolean {
  return typeof message.text === "string" && message.text.length > 0 && message.text.length <= 200_000
    && typeof message.rate === "number" && Number.isFinite(message.rate) && message.rate >= 0.5 && message.rate <= 10
    && typeof message.volume === "number" && Number.isFinite(message.volume) && message.volume >= 0 && message.volume <= 1
    && (message.voiceURI === null || typeof message.voiceURI === "string");
}

function normalizeLoopbackUrl(value: string, label: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} must be a valid loopback HTTP URL.`);
  }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "http:" || (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]" && host !== "::1")) {
    throw new Error(`${label} must use http://localhost, http://127.0.0.1, or http://[::1].`);
  }
  if (url.username || url.password) throw new Error(`${label} must not contain credentials.`);
  return url.toString();
}

function validateBase64Audio(value: string): void {
  const estimated = Math.floor((value.length * 3) / 4) - (value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0);
  if (estimated > MAX_AUDIO_EXPORT_BYTES) throw new Error("Custom TTS audio response is too large.");
  try {
    atob(value);
  } catch {
    throw new Error("Custom TTS audio response contains invalid base64 data.");
  }
}

function normalizeAudioExportError(error: unknown): string {
  if (error instanceof DOMException && (error.name === "AbortError" || error.name === "TimeoutError")) {
    return error.name === "TimeoutError" ? "Custom TTS request timed out." : "Audio generation canceled.";
  }
  return error instanceof Error ? error.message : String(error);
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

function maxResponseBytes(message: FetchResourceMessage): number {
  if (message.type === "post-reading:fetchJson") return MAX_JSON_RESPONSE_BYTES;
  if (message.type === "post-reading:fetchBlob") return MAX_BLOB_RESPONSE_BYTES;
  return MAX_TEXT_RESPONSE_BYTES;
}

function isAllowedResponseContentType(message: FetchResourceMessage, contentType: string): boolean {
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
    || record.type === "post-reading:generateAudioExport"
    || record.type === "post-reading:cancelAudioExport"
  ) && ((record.type === "post-reading:generateAudioExport" || record.type === "post-reading:cancelAudioExport")
    ? typeof record.requestId === "string"
    : typeof record.url === "string");
}

function isAllowedFetchMessage(message: FetchResourceMessage): boolean {
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
