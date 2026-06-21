export type OcrProgress = {
  imageIndex: number;
  imageCount: number;
  status: string;
  progress: number | null;
};

export type OcrImage = {
  src: string;
  alt: string;
};

type OcrRequest = {
  type: "postreader-ocr-request";
  id: string;
  src: string;
};

type OcrCancelRequest = {
  type: "postreader-ocr-cancel";
  id: string;
};

type OcrHostMessage =
  | {
      type: "postreader-ocr-ready";
    }
  | {
      type: "postreader-ocr-progress";
      id: string;
      status: string;
      progress: number | null;
    }
  | {
      type: "postreader-ocr-result";
      id: string;
      text: string;
    }
  | {
      type: "postreader-ocr-error";
      id: string;
      error: string;
    };

let hostFrame: HTMLIFrameElement | null = null;
let hostReadyPromise: Promise<HTMLIFrameElement> | null = null;
let requestCounter = 0;
const cache = new Map<string, string>();

export async function recognizeImageText(
  image: OcrImage,
  imageIndex: number,
  imageCount: number,
  signal: AbortSignal,
  onProgress: (progress: OcrProgress) => void,
): Promise<string> {
  const cached = cache.get(image.src);
  if (cached !== undefined) return cached;

  throwIfAborted(signal);
  onProgress({ imageIndex, imageCount, status: "Loading OCR host", progress: 0.05 });
  const frame = await withAbort(withTimeout(ensureHostFrameReady(), 15000, "OCR host did not load"), signal);
  throwIfAborted(signal);
  const id = `ocr-${Date.now()}-${++requestCounter}`;
  let lastProgress = 0.05;

  const text = await withTimeout(new Promise<string>((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      signal.removeEventListener("abort", onAbort);
    };
    const onAbort = () => {
      cleanup();
      postToHost(frame, { type: "postreader-ocr-cancel", id });
      reject(new DOMException("OCR skipped", "AbortError"));
    };
    const onMessage = (event: MessageEvent<OcrHostMessage>) => {
      if (event.source !== frame.contentWindow || !event.data || event.data.type === "postreader-ocr-ready" || event.data.id !== id) return;
      if (event.data.type === "postreader-ocr-progress") {
        const value = event.data.progress === null ? null : Math.max(lastProgress, event.data.progress);
        if (value !== null) lastProgress = value;
        onProgress({ imageIndex, imageCount, status: event.data.status, progress: value });
        return;
      }
      cleanup();
      if (event.data.type === "postreader-ocr-result") {
        resolve(cleanOcrText(event.data.text));
      } else {
        reject(new Error(event.data.error || "OCR failed"));
      }
    };

    window.addEventListener("message", onMessage);
    signal.addEventListener("abort", onAbort);
    throwIfAborted(signal);
    postToHost(frame, { type: "postreader-ocr-request", id, src: image.src });
  }), 45000, "OCR timed out");

  cache.set(image.src, text);
  return text;
}

function ensureHostFrame(): HTMLIFrameElement {
  if (hostFrame?.isConnected) return hostFrame;
  const frame = document.createElement("iframe");
  frame.src = chrome.runtime.getURL("ocr.html");
  frame.title = "Postreader OCR host";
  frame.hidden = true;
  frame.style.display = "none";
  frame.setAttribute("aria-hidden", "true");
  document.documentElement.appendChild(frame);
  hostFrame = frame;
  return frame;
}

function ensureHostFrameReady(): Promise<HTMLIFrameElement> {
  if (hostFrame?.isConnected && hostFrame.dataset.postreaderOcrReady === "true") {
    return Promise.resolve(hostFrame);
  }
  if (hostReadyPromise) return hostReadyPromise;
  const frame = ensureHostFrame();
  hostReadyPromise = new Promise((resolve, reject) => {
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      frame.removeEventListener("error", onError);
    };
    const onError = () => {
      cleanup();
      hostReadyPromise = null;
      reject(new Error("OCR host failed to load"));
    };
    const onMessage = (event: MessageEvent<OcrHostMessage>) => {
      if (event.source !== frame.contentWindow || !event.data || event.data.type !== "postreader-ocr-ready") return;
      frame.dataset.postreaderOcrReady = "true";
      cleanup();
      resolve(frame);
    };
    window.addEventListener("message", onMessage);
    frame.addEventListener("error", onError, { once: true });
  });
  return hostReadyPromise;
}

function postToHost(frame: HTMLIFrameElement, request: OcrRequest | OcrCancelRequest): void {
  frame.contentWindow?.postMessage(request, extensionOrigin());
}

function extensionOrigin(): string {
  return new URL(chrome.runtime.getURL("")).origin;
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

async function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  throwIfAborted(signal);
  return new Promise<T>((resolve, reject) => {
    const cleanup = () => signal.removeEventListener("abort", onAbort);
    const onAbort = () => {
      cleanup();
      reject(new DOMException("OCR skipped", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        cleanup();
        resolve(value);
      },
      (error) => {
        cleanup();
        reject(error);
      },
    );
  });
}

function cleanOcrText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw new DOMException("OCR skipped", "AbortError");
}
