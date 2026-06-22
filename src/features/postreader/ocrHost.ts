import { createWorker } from "tesseract.js";

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

type OcrRequest = {
  type: "postreader-ocr-request";
  id: string;
  src: string;
};

type OcrCancelRequest = {
  type: "postreader-ocr-cancel";
  id: string;
};

let workerPromise: Promise<TesseractWorker> | null = null;
const canceledRequests = new Set<string>();

announceReady();

window.addEventListener("message", (event: MessageEvent<OcrRequest | OcrCancelRequest>) => {
  if (event.source !== window.parent) return;
  if (!event.data) return;
  if (event.data.type === "postreader-ocr-cancel") {
    canceledRequests.add(event.data.id);
    return;
  }
  if (event.data.type !== "postreader-ocr-request") return;
  canceledRequests.delete(event.data.id);
  void recognize(event.data, event.source as Window | null);
});

async function recognize(request: OcrRequest, target: Window | null): Promise<void> {
  if (!target) return;
  let lastProgress = 0;
  const sendProgress = (status: string, value: number | null) => {
    if (canceledRequests.has(request.id)) return;
    if (value !== null) lastProgress = Math.max(lastProgress, value);
    progress(target, request.id, status, value === null ? null : lastProgress);
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
    target.postMessage({ type: "postreader-ocr-result", id: request.id, text: filterOcrText(result.data) }, "*");
  } catch (error) {
    if (canceledRequests.has(request.id)) return;
    target.postMessage({ type: "postreader-ocr-error", id: request.id, error: errorMessage(error) }, "*");
  } finally {
    canceledRequests.delete(request.id);
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
    window.parent.postMessage({ type: "postreader-ocr-ready" }, "*");
    count += 1;
    if (count >= 20) window.clearInterval(interval);
  };
  const interval = window.setInterval(send, 250);
  send();
}

async function fetchImageBlob(src: string): Promise<Blob> {
  const response = await fetch(src, { credentials: "omit" });
  if (!response.ok) throw new Error(`Could not load image for OCR: ${response.status}`);
  return response.blob();
}

function progress(target: Window, id: string, status: string, value: number | null): void {
  target.postMessage({ type: "postreader-ocr-progress", id, status, progress: value }, "*");
}

function filterOcrText(page: Tesseract.Page): string {
  const blocks = page.blocks || [];
  const accepted = blocks
    .map((block) => ({
      text: normalizeText(block.text || ""),
      confidence: block.confidence ?? 0,
      validWords: collectValidWords(block),
    }))
    .filter((block) => {
      if (!block.text || block.confidence < 45) return false;
      if (block.validWords.length < 2) return false;
      return validWordRatio(block.text, block.validWords) >= 0.45;
    });

  const text = normalizeText(accepted.map((block) => block.text).join(" "));
  if (!isLikelyReadableOcr(text, accepted.flatMap((block) => block.validWords))) return fallbackOcrText(page);
  return text;
}

function fallbackOcrText(page: Tesseract.Page): string {
  const text = normalizeText(page.text || "");
  if (!isLikelyReadableRawOcr(text)) return "";
  return text;
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

function validWordRatio(text: string, validWords: string[]): number {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  return validWords.length / tokens.length;
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
