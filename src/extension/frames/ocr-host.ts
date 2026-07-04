import { createWorker } from "tesseract.js";

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

type OcrRequest = {
  type: "post-reading-ocr-request";
  id: string;
  authToken: string;
  src: string;
};

type OcrCancelRequest = {
  type: "post-reading-ocr-cancel";
  id: string;
  authToken: string;
};

type OcrInitMessage = {
  type: "post-reading-ocr-init";
  authToken: string;
};

type FetchBlobResponse = {
  ok?: unknown;
  status?: unknown;
  error?: unknown;
  contentType?: unknown;
  base64?: unknown;
};

type OcrCandidate = {
  text: string;
  confidence: number;
  validWords: string[];
  tokenCount: number;
  quality: OcrQuality;
};

type OcrQuality = {
  score: number;
  visibleCount: number;
  letterOrDigitRatio: number;
  validWordRatio: number;
  weirdRatio: number;
  oneCharacterTokenRatio: number;
  averageTokenLength: number;
};

let workerPromise: Promise<TesseractWorker> | null = null;
const canceledRequests = new Set<string>();
let parentAuthToken = "";
let parentTargetOrigin = "";

announceReady();

window.addEventListener("message", (event: MessageEvent<OcrInitMessage | OcrRequest | OcrCancelRequest>) => {
  if (event.source !== window.parent) return;
  if (!event.data) return;
  if (event.data.type === "post-reading-ocr-init") {
    if (!isAllowedParentOrigin(event.origin) || typeof event.data.authToken !== "string" || event.data.authToken.length < 16) return;
    parentAuthToken = event.data.authToken;
    parentTargetOrigin = event.origin;
    return;
  }
  if (!isAuthenticatedParentRequest(event)) return;
  if (event.data.type === "post-reading-ocr-cancel") {
    canceledRequests.add(event.data.id);
    return;
  }
  if (event.data.type !== "post-reading-ocr-request") return;
  canceledRequests.delete(event.data.id);
  void recognize(event.data, event.source as Window | null, event.origin);
});

async function recognize(request: OcrRequest, target: Window | null, targetOrigin: string): Promise<void> {
  if (!target) return;
  let lastProgress = 0;
  const sendProgress = (status: string, value: number | null) => {
    if (canceledRequests.has(request.id)) return;
    if (value !== null) lastProgress = Math.max(lastProgress, value);
    progress(target, targetOrigin, request.id, status, value === null ? null : lastProgress);
  };
  try {
    sendProgress("Loading OCR", 0.08);
    const worker = await withTimeout(getWorker((status, value) => {
      sendProgress(status, value);
    }), 20000, "OCR worker timed out");

    sendProgress("Loading image", 0.35);
    if (canceledRequests.has(request.id)) return;
    const blob = await fetchImageBlob(request.src);
    sendProgress("Reading image text", 0.55);
    if (canceledRequests.has(request.id)) return;
    const result = await withTimeout(worker.recognize(blob, {}, { blocks: true, text: true }), 30000, "OCR recognition timed out");
    if (canceledRequests.has(request.id)) return;
    sendProgress("Finishing OCR", 1);
    target.postMessage({ type: "post-reading-ocr-result", id: request.id, text: filterOcrText(result.data) }, targetOrigin);
  } catch (error) {
    if (canceledRequests.has(request.id)) return;
    target.postMessage({ type: "post-reading-ocr-error", id: request.id, error: errorMessage(error) }, targetOrigin);
  } finally {
    canceledRequests.delete(request.id);
  }
}

function isAuthenticatedParentRequest(event: MessageEvent<OcrRequest | OcrCancelRequest | OcrInitMessage>): event is MessageEvent<OcrRequest | OcrCancelRequest> {
  return parentAuthToken !== ""
    && event.origin === parentTargetOrigin
    && isAllowedParentOrigin(event.origin)
    && (event.data.type === "post-reading-ocr-request" || event.data.type === "post-reading-ocr-cancel")
    && event.data.authToken === parentAuthToken;
}

function isAllowedParentOrigin(origin: string): boolean {
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && (
      url.hostname === "x.com"
      || url.hostname === "twitter.com"
      || url.hostname === "wiki.remilia.org"
      || url.hostname === "remilia.wiki"
    );
  } catch {
    return false;
  }
}

function getWorker(onProgress: (status: string, progress: number | null) => void): Promise<TesseractWorker> {
  if (!workerPromise) {
    const base = chrome.runtime.getURL("ocr");
    workerPromise = createWorker("eng", 1, {
      workerPath: `${base}/worker.min.js`,
      corePath: `${base}/core`,
      langPath: `${base}/lang`,
      workerBlobURL: false,
      logger: (message) => {
        const status = typeof message.status === "string" ? titleCase(message.status) : "Loading OCR";
        const rawValue = typeof message.progress === "number" ? message.progress : null;
        const value = rawValue === null ? null : 0.08 + Math.max(0, Math.min(1, rawValue)) * 0.27;
        onProgress(status, value);
      },
    }).catch((error) => {
      workerPromise = null;
      throw error;
    });
  }
  return workerPromise;
}

function announceReady(): void {
  let count = 0;
  const send = () => {
    window.parent.postMessage({ type: "post-reading-ocr-ready" }, "*");
    count += 1;
    if (count >= 20) window.clearInterval(interval);
  };
  const interval = window.setInterval(send, 250);
  send();
}

async function fetchImageBlob(src: string): Promise<Blob> {
  if (!isAllowedOcrImageUrl(src)) {
    throw new Error("Unsupported OCR image URL");
  }
  try {
    const response = await fetch(src, { credentials: "omit" });
    if (!response.ok) throw new Error(`Could not load image for OCR: ${response.status}`);
    return await response.blob();
  } catch (error) {
    return fetchImageBlobViaBackground(src, error);
  }
}

async function fetchImageBlobViaBackground(src: string, originalError: unknown): Promise<Blob> {
  const response = await chrome.runtime.sendMessage({ type: "post-reading:fetchBlob", url: src }) as FetchBlobResponse | undefined;
  if (!response?.ok || typeof response.base64 !== "string") {
    const fallback = response?.error ? String(response.error) : errorMessage(originalError);
    throw new Error(`Could not load image for OCR: ${fallback}`);
  }
  const contentType = typeof response.contentType === "string" ? response.contentType : "application/octet-stream";
  return new Blob([base64ToArrayBuffer(response.base64)], { type: contentType });
}

function isAllowedOcrImageUrl(src: string): boolean {
  try {
    const url = new URL(src);
    return url.protocol === "https:" && url.hostname === "pbs.twimg.com" && url.pathname.startsWith("/media/");
  } catch {
    return false;
  }
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const buffer = new ArrayBuffer(binary.length);
  const bytes = new Uint8Array(buffer);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return buffer;
}

function progress(target: Window, targetOrigin: string, id: string, status: string, value: number | null): void {
  target.postMessage({ type: "post-reading-ocr-progress", id, status, progress: value }, targetOrigin);
}

function filterOcrText(page: Tesseract.Page): string {
  const blocks = page.blocks || [];
  const accepted = blocks
    .map(blockToCandidate)
    .filter(isAcceptableBlockCandidate);

  const text = normalizeText(accepted.map((block) => block.text).join(" "));
  if (!isLikelyReadableOcr(text, accepted.flatMap((block) => block.validWords))) return fallbackOcrText(page);
  if (!passesFinalQualityGate(text, accepted)) return fallbackOcrText(page);
  return text;
}

function fallbackOcrText(page: Tesseract.Page): string {
  const text = normalizeText(page.text || "");
  if (!isLikelyReadableRawOcr(text)) return "";
  const blocks = page.blocks || [];
  const validWords = blocks.flatMap((block) => collectValidWords(block));
  const confidence = averageConfidence(blocks);
  const quality = scoreOcrQuality(text, validWords);
  if (!passesRawFallbackQualityGate(text, confidence, validWords, quality)) return "";
  return text;
}

function blockToCandidate(block: Tesseract.Block): OcrCandidate {
  const text = normalizeText(block.text || "");
  const validWords = collectValidWords(block);
  const quality = scoreOcrQuality(text, validWords);
  return {
    text,
    confidence: block.confidence ?? 0,
    validWords,
    tokenCount: tokenCount(text),
    quality,
  };
}

function isAcceptableBlockCandidate(candidate: OcrCandidate): boolean {
  if (!candidate.text || candidate.confidence < 55) return false;
  if (candidate.validWords.length < 2) return false;
  if (candidate.quality.score < 0.58) return false;
  if (candidate.quality.validWordRatio < 0.5) return false;
  if (candidate.quality.letterOrDigitRatio < 0.55) return false;
  if (candidate.quality.weirdRatio > 0.08) return false;
  if (candidate.quality.oneCharacterTokenRatio > 0.25) return false;
  return true;
}

function passesFinalQualityGate(text: string, candidates: OcrCandidate[]): boolean {
  if (text.length < 8 || candidates.length === 0) return false;
  const validWords = candidates.flatMap((candidate) => candidate.validWords);
  const quality = scoreOcrQuality(text, validWords);
  const weightedConfidence = weightedAverageConfidence(candidates);
  if (weightedConfidence < 58) return false;
  if (quality.score < 0.62) return false;
  if (quality.validWordRatio < 0.52) return false;
  if (quality.letterOrDigitRatio < 0.6) return false;
  if (quality.weirdRatio > 0.06) return false;
  if (quality.oneCharacterTokenRatio > 0.22) return false;
  return true;
}

function passesRawFallbackQualityGate(text: string, confidence: number, validWords: string[], quality: OcrQuality): boolean {
  if (text.length < 12) return false;
  if (validWords.length < 3) return false;
  if (confidence < 62) return false;
  if (quality.score < 0.72) return false;
  if (quality.validWordRatio < 0.65) return false;
  if (quality.letterOrDigitRatio < 0.72) return false;
  if (quality.weirdRatio > 0.03) return false;
  if (quality.oneCharacterTokenRatio > 0.12) return false;
  return true;
}

function collectValidWords(block: Tesseract.Block): string[] {
  const words: string[] = [];
  for (const paragraph of block.paragraphs || []) {
    for (const line of paragraph.lines || []) {
      for (const word of line.words || []) {
        const text = normalizeText(word.text || "");
        if (word.confidence >= 50 && isReadableWord(text)) words.push(text);
      }
    }
  }
  return words;
}

function scoreOcrQuality(text: string, validWords: string[]): OcrQuality {
  const tokens = splitTokens(text);
  const visibleCount = (text.match(/[^\s]/g) || []).length;
  const lettersOrDigits = (text.match(/[\p{L}\p{N}]/gu) || []).length;
  const weird = (text.match(/[|{}[\]~^_=<>\\]/g) || []).length;
  const oneCharacterTokens = tokens.filter((token) => token.length === 1).length;
  const tokenCharacters = tokens.reduce((sum, token) => sum + token.length, 0);
  const letterOrDigitRatio = visibleCount === 0 ? 0 : lettersOrDigits / visibleCount;
  const validRatio = tokens.length === 0 ? 0 : Math.min(1, validWords.length / tokens.length);
  const weirdRatio = visibleCount === 0 ? 1 : weird / visibleCount;
  const oneCharacterTokenRatio = tokens.length === 0 ? 1 : oneCharacterTokens / tokens.length;
  const averageTokenLength = tokens.length === 0 ? 0 : tokenCharacters / tokens.length;
  const tokenLengthScore = Math.max(0, Math.min(1, averageTokenLength / 4));
  const score = Math.max(0, Math.min(1,
    letterOrDigitRatio * 0.32
    + validRatio * 0.34
    + tokenLengthScore * 0.16
    + (1 - Math.min(1, weirdRatio / 0.12)) * 0.1
    + (1 - Math.min(1, oneCharacterTokenRatio / 0.35)) * 0.08,
  ));
  return {
    score,
    visibleCount,
    letterOrDigitRatio,
    validWordRatio: validRatio,
    weirdRatio,
    oneCharacterTokenRatio,
    averageTokenLength,
  };
}

function tokenCount(text: string): number {
  return splitTokens(text).length;
}

function splitTokens(text: string): string[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  return tokens.map((token) => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")).filter(Boolean);
}

function weightedAverageConfidence(candidates: OcrCandidate[]): number {
  const totalTokens = candidates.reduce((sum, candidate) => sum + candidate.tokenCount, 0);
  if (totalTokens === 0) return 0;
  return candidates.reduce((sum, candidate) => sum + candidate.confidence * candidate.tokenCount, 0) / totalTokens;
}

function averageConfidence(blocks: Tesseract.Block[]): number {
  if (blocks.length === 0) return 0;
  const values = blocks.map((block) => block.confidence ?? 0);
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function isLikelyReadableOcr(text: string, validWords: string[]): boolean {
  if (validWords.length < 2) return false;
  if (text.length < 8) return false;
  const letters = (text.match(/\p{L}/gu) || []).length;
  const visible = (text.match(/[^\s]/g) || []).length;
  if (visible === 0 || letters / visible < 0.45) return false;
  const weird = (text.match(/[|{}[\]~^_=<>\\]/g) || []).length;
  return weird / visible < 0.12;
}

function isLikelyReadableRawOcr(text: string): boolean {
  if (text.length < 2) return false;
  const visible = (text.match(/[^\s]/g) || []).length;
  if (visible === 0) return false;
  const letters = (text.match(/\p{L}/gu) || []).length;
  const digits = (text.match(/\p{N}/gu) || []).length;
  if (letters + digits < 2) return false;
  if ((letters + digits) / visible < 0.25) return false;
  const weird = (text.match(/[|{}[\]~^_=<>\\]/g) || []).length;
  return weird / visible < 0.35;
}

function isReadableWord(value: string): boolean {
  if (value.length < 2) return false;
  if (!/\p{L}/u.test(value)) return false;
  if (/^[^\p{L}\p{N}]+$/u.test(value)) return false;
  return true;
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim();
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: number | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout !== null) window.clearTimeout(timeout);
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof DOMException) return `${error.name}${error.message ? ` - ${error.message}` : ""}`;
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase());
}
