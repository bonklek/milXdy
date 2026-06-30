export type HighlightTokenMode = "word" | "smooth";

type PrepareTokenOptions = {
  includeTextNode?: (node: Text) => boolean;
  textOverride?: string;
  smoothReadableLength?: boolean;
};

type SmoothPaintOptions = {
  charLength?: number | null;
  snapToCurrent?: boolean;
  textLength?: number;
  boundaryElapsedTime?: number | null;
  anchor?: "boundary" | "midpoint";
  leadToNextToken?: boolean;
};

type SmoothAnimationDiagnostic = {
  tokenCount: number;
  animatedTokenCount: number;
  durationMs: number;
};

export type TextHighlightEngineOptions = {
  onSmoothAnimation?: (diagnostic: SmoothAnimationDiagnostic) => void;
};

type PendingSmoothAnimation = {
  tokens: HTMLElement[];
  token: HTMLElement;
  toIndex: number;
};

const CALIBRATION_SAMPLE_LIMIT = 5;

export class TextHighlightEngine {
  private smoothVisualIndex = 0;
  private smoothAnimationFrame: number | null = null;
  private smoothAnimationTimer: number | null = null;
  private activeSmoothToken: HTMLElement | null = null;
  private pendingSmoothAnimation: PendingSmoothAnimation | null = null;
  private lastBoundaryAt: number | null = null;
  private lastBoundaryIntervalMs: number | null = null;
  private lastBoundaryElapsedTime: number | null = null;
  private lastRelativeIndex: number | null = null;
  private calibratedCharsPerSecond = 13;
  private baselineCharsPerSecond = 13;
  private calibrationSamples = 0;
  private calibrationLocked = false;
  private readonly onSmoothAnimation?: (diagnostic: SmoothAnimationDiagnostic) => void;

  constructor(options: TextHighlightEngineOptions = {}) {
    this.onSmoothAnimation = options.onSmoothAnimation;
  }

  prepareTokens(element: HTMLElement, mode: HighlightTokenMode, options: PrepareTokenOptions = {}): HTMLElement[] {
    const selector = tokenSelector(mode);
    const existing = Array.from(element.querySelectorAll<HTMLElement>(selector));
    if (existing.length > 0) return existing;
    this.resetTokenizationForMode(element, mode);
    if (!element.dataset.postReadingOriginalHtml) element.dataset.postReadingOriginalHtml = element.innerHTML;
    element.dataset.postReadingHighlightMode = mode;

    if (typeof options.textOverride === "string") {
      return this.prepareTextOverrideTokens(element, mode, options.textOverride, options.smoothReadableLength === true);
    }

    const tokens: HTMLElement[] = [];
    const textNodes = collectTextNodes(element);
    let tokenIndex = 0;
    let textCursor = 0;
    let skippedText = false;
    let countedTextEndsWithWhitespace = false;

    for (const node of textNodes) {
      if (options.includeTextNode && !options.includeTextNode(node)) {
        skippedText = true;
        continue;
      }
      const originalText = node.textContent || "";
      const uncountedPrefix = skippedText && countedTextEndsWithWhitespace
        ? originalText.match(/^\s+/)?.[0] || ""
        : "";
      const text = uncountedPrefix ? originalText.slice(uncountedPrefix.length) : originalText;
      skippedText = false;
      if (!text.trim()) {
        textCursor += text.length;
        if (text) countedTextEndsWithWhitespace = /\s$/.test(text);
        continue;
      }

      const fragment = document.createDocumentFragment();
      if (uncountedPrefix) fragment.appendChild(document.createTextNode(uncountedPrefix));
      for (const part of splitHighlightParts(text, mode)) {
        if (/^\s+$/.test(part) && mode === "word") {
          fragment.appendChild(document.createTextNode(part));
          textCursor += part.length;
          countedTextEndsWithWhitespace = true;
          continue;
        }
        const span = createHighlightToken(part, mode, tokenIndex++, textCursor, options.smoothReadableLength === true);
        tokens.push(span);
        fragment.appendChild(span);
        textCursor += part.length;
        countedTextEndsWithWhitespace = /\s$/.test(part);
      }
      node.parentNode?.replaceChild(fragment, node);
    }

    return tokens;
  }

  clearElement(element: HTMLElement): void {
    this.clearSmoothAnimation();
    for (const word of Array.from(element.querySelectorAll<HTMLElement>('[data-post-reading-word="true"]'))) {
      delete word.dataset.postReadingCurrentWord;
    }
    for (const word of Array.from(element.querySelectorAll<HTMLElement>('[data-post-reading-smooth-word="true"]'))) {
      delete word.dataset.postReadingSmoothFilled;
      setSmoothFillImmediate(word, null);
    }
  }

  restoreOriginalElement(element: HTMLElement): void {
    if (element.dataset.postReadingOriginalHtml) {
      element.innerHTML = element.dataset.postReadingOriginalHtml;
      delete element.dataset.postReadingOriginalHtml;
    } else {
      this.clearElement(element);
    }
    delete element.dataset.postReadingHighlightMode;
  }

  findCurrentToken(tokens: HTMLElement[], relativeIndex: number, charLength: number | null): HTMLElement | null {
    if (tokens.length === 0) return null;
    const sorted = [...tokens].sort((left, right) => tokenStart(left) - tokenStart(right));
    if (charLength !== null && charLength > 0) {
      const midpoint = relativeIndex + Math.max(0, Math.floor((charLength - 1) / 2));
      const tokenAtMidpoint = findTokenContaining(sorted, midpoint);
      if (tokenAtMidpoint) return tokenAtMidpoint;
    }
    const tokenAtBoundary = findTokenContaining(sorted, relativeIndex);
    if (tokenAtBoundary) return tokenAtBoundary;
    return findNearestToken(sorted, relativeIndex);
  }

  paintWord(tokens: HTMLElement[], relativeIndex: number, charLength: number | null): HTMLElement | null {
    const current = this.findCurrentToken(tokens, relativeIndex, charLength);
    for (const token of tokens) {
      if (token === current) token.dataset.postReadingCurrentWord = "true";
      else delete token.dataset.postReadingCurrentWord;
    }
    return current;
  }

  paintSmooth(tokens: HTMLElement[], relativeIndex: number, options: SmoothPaintOptions = {}): HTMLElement | null {
    if (tokens.length === 0) return null;
    this.updateBoundaryCalibration(relativeIndex, options.boundaryElapsedTime);
    const textLength = options.textLength ?? inferTextLength(tokens);
    const currentToken = options.anchor === "midpoint"
      ? this.findCurrentToken(tokens, relativeIndex, options.charLength ?? null)
      : this.findCurrentToken(tokens, relativeIndex, null);
    if (!currentToken) {
      this.snapSmoothAt(tokens, Math.min(textLength, Math.max(this.smoothVisualIndex, relativeIndex)));
      return null;
    }

    const currentTokenStart = tokenStart(currentToken);
    const currentTokenEnd = Math.min(textLength, currentTokenStart + tokenReadableLength(currentToken));
    if (currentTokenEnd <= currentTokenStart) return currentToken;
    const animationEnd = options.leadToNextToken
      ? Math.min(
          textLength,
          Math.max(
            currentTokenEnd,
            this.findNextBoundaryIndex(tokens, relativeIndex),
            relativeIndex + Math.round(this.calibratedCharsPerSecond * 0.18),
          ),
        )
      : currentTokenEnd;

    if (
      this.pendingSmoothAnimation?.token === currentToken
      && this.activeSmoothToken === currentToken
      && (!options.leadToNextToken || this.pendingSmoothAnimation.toIndex >= animationEnd)
    ) {
      return currentToken;
    }
    if (this.activeSmoothToken === currentToken) {
      if (options.snapToCurrent && relativeIndex > this.smoothVisualIndex) {
        this.snapSmoothAt(tokens, relativeIndex);
      }
      if (options.leadToNextToken && animationEnd > this.smoothVisualIndex) {
        this.clearSmoothAnimation({ completePending: true });
      } else {
        return currentToken;
      }
    }

    const tokenChanged = this.activeSmoothToken !== null && this.activeSmoothToken !== currentToken;
    this.clearSmoothAnimation({ completePending: tokenChanged });

    if (options.snapToCurrent) {
      this.smoothVisualIndex = Math.max(this.smoothVisualIndex, relativeIndex);
      this.snapSmoothAt(tokens, this.smoothVisualIndex);
    }

    const visualStart = Math.max(
      this.smoothVisualIndex,
      currentTokenStart,
      Math.min(relativeIndex, currentTokenEnd - 1),
    );
    if (visualStart >= animationEnd) {
      this.snapSmoothAt(tokens, animationEnd);
      return currentToken;
    }

    const duration = this.estimateSmoothFillDurationMs(animationEnd - visualStart);
    this.snapSmoothAt(tokens, visualStart);
    this.activeSmoothToken = currentToken;
    this.animateSmoothRange(tokens, currentToken, visualStart, animationEnd, duration);
    return currentToken;
  }

  resetSmoothTokenFill(tokens: HTMLElement[]): void {
    this.activeSmoothToken = null;
    for (const token of tokens) {
      delete token.dataset.postReadingSmoothFilled;
      setSmoothFillImmediate(token, null);
    }
  }

  clearSmoothAnimation(options: { completePending?: boolean } = {}): void {
    const pending = this.pendingSmoothAnimation;
    this.pendingSmoothAnimation = null;
    if (this.smoothAnimationFrame !== null) {
      window.cancelAnimationFrame(this.smoothAnimationFrame);
      this.smoothAnimationFrame = null;
    }
    if (this.smoothAnimationTimer !== null) {
      window.clearTimeout(this.smoothAnimationTimer);
      this.smoothAnimationTimer = null;
    }
    if (options.completePending && pending && pending.tokens.some((token) => token.isConnected)) {
      this.snapSmoothAt(pending.tokens, pending.toIndex);
    }
  }

  resetSmoothTracking(rangeElement?: HTMLElement | null): void {
    this.clearSmoothAnimation();
    this.smoothVisualIndex = 0;
    this.activeSmoothToken = null;
    this.lastBoundaryAt = null;
    this.lastBoundaryIntervalMs = null;
    this.lastBoundaryElapsedTime = null;
    this.lastRelativeIndex = null;
    this.calibratedCharsPerSecond = this.baselineCharsPerSecond;
    this.calibrationSamples = 0;
    this.calibrationLocked = false;
    void rangeElement;
  }

  suspendSmoothTracking(relativeIndex: number): void {
    this.clearSmoothAnimation();
    this.lastBoundaryAt = null;
    this.lastBoundaryIntervalMs = null;
    this.lastRelativeIndex = relativeIndex;
    this.lastBoundaryElapsedTime = null;
  }

  updateBaselineReadingSpeed(speed: unknown): void {
    const numeric = typeof speed === "number" && Number.isFinite(speed) ? speed : 1;
    this.baselineCharsPerSecond = 13 * Math.max(0.5, numeric);
    if (this.lastBoundaryAt === null) this.calibratedCharsPerSecond = this.baselineCharsPerSecond;
  }

  findNextBoundaryIndex(tokens: HTMLElement[], relativeIndex: number): number {
    const sorted = [...tokens].sort((left, right) => tokenStart(left) - tokenStart(right));
    const current = findNearestToken(sorted, relativeIndex);
    if (!current) return relativeIndex;
    const currentIndex = sorted.indexOf(current);
    for (const token of sorted.slice(currentIndex + 1)) {
      if (token.dataset.postReadingTokenKind !== "space") return tokenStart(token);
    }
    return tokenStart(current) + tokenReadableLength(current);
  }

  private prepareTextOverrideTokens(
    element: HTMLElement,
    mode: HighlightTokenMode,
    text: string,
    useReadableLength: boolean,
  ): HTMLElement[] {
    element.textContent = "";
    const tokens: HTMLElement[] = [];
    let cursor = 0;
    let index = 0;
    for (const part of splitHighlightParts(text, mode)) {
      if (/^\s+$/.test(part) && mode === "word") {
        element.append(document.createTextNode(part));
        cursor += part.length;
        continue;
      }
      const span = createHighlightToken(part, mode, index++, cursor, useReadableLength);
      tokens.push(span);
      element.append(span);
      cursor += part.length;
    }
    return tokens;
  }

  private resetTokenizationForMode(element: HTMLElement, mode: HighlightTokenMode): void {
    if (!element.dataset.postReadingHighlightMode || element.dataset.postReadingHighlightMode === mode) return;
    this.restoreOriginalElement(element);
  }

  private updateBoundaryCalibration(relativeIndex: number, boundaryElapsedTime: unknown): void {
    const now = performance.now();
    if (!this.calibrationLocked && this.lastRelativeIndex !== null && relativeIndex > this.lastRelativeIndex) {
      const elapsedMs = this.boundaryElapsedMs(boundaryElapsedTime, now);
      const charDelta = relativeIndex - this.lastRelativeIndex;
      const observed = elapsedMs !== null && elapsedMs > 0 ? charDelta / (elapsedMs / 1000) : null;
      if (elapsedMs !== null && elapsedMs > 0) this.lastBoundaryIntervalMs = elapsedMs;
      if (elapsedMs !== null && observed !== null && this.isUsefulSpeedSample(observed, charDelta, elapsedMs)) {
        this.calibratedCharsPerSecond = this.calibrationSamples === 0
          ? observed
          : this.calibratedCharsPerSecond * 0.68 + observed * 0.32;
        this.calibrationSamples += 1;
        if (this.calibrationSamples >= CALIBRATION_SAMPLE_LIMIT) this.calibrationLocked = true;
      }
    }
    this.lastBoundaryAt = now;
    this.lastRelativeIndex = relativeIndex;
    this.lastBoundaryElapsedTime = typeof boundaryElapsedTime === "number" && Number.isFinite(boundaryElapsedTime)
      ? boundaryElapsedTime
      : null;
  }

  private isUsefulSpeedSample(observed: number, charDelta: number, elapsedMs: number): boolean {
    if (!Number.isFinite(observed) || observed <= 0) return false;
    if (charDelta < 3 || elapsedMs <= 0) return false;
    const lower = this.baselineCharsPerSecond * 0.45;
    const upper = this.baselineCharsPerSecond * 2.4;
    return observed >= lower && observed <= upper;
  }

  private boundaryElapsedMs(boundaryElapsedTime: unknown, now: number): number | null {
    if (typeof boundaryElapsedTime === "number" && Number.isFinite(boundaryElapsedTime) && this.lastBoundaryElapsedTime !== null) {
      const elapsed = (boundaryElapsedTime - this.lastBoundaryElapsedTime) * 1000;
      if (elapsed > 0) return elapsed;
    }
    if (this.lastBoundaryAt !== null) return now - this.lastBoundaryAt;
    return null;
  }

  private snapSmoothAt(tokens: HTMLElement[], cursorIndex: number): void {
    const cursor = Math.max(this.smoothVisualIndex, cursorIndex);
    this.smoothVisualIndex = cursor;
    for (const token of tokens) {
      const start = tokenStart(token);
      const length = Math.max(1, tokenLength(token));
      const readableLength = Math.max(1, tokenReadableLength(token));
      const readableEnd = start + readableLength;
      const end = start + length;
      if (end <= cursor) {
        token.dataset.postReadingSmoothFilled = "true";
        setSmoothFillImmediate(token, 100);
      } else if (cursor >= start && cursor < readableEnd) {
        delete token.dataset.postReadingSmoothFilled;
        setSmoothFillImmediate(token, rangeFillPercentForToken(token, cursor));
      } else if (tokenStart(token) >= cursor) {
        delete token.dataset.postReadingSmoothFilled;
        setSmoothFillImmediate(token, null);
      }
    }
  }

  private animateSmoothRange(
    tokens: HTMLElement[],
    token: HTMLElement,
    fromIndex: number,
    toIndex: number,
    durationMs: number,
  ): void {
    this.clearSmoothAnimation({ completePending: false });
    if (durationMs <= 0 || toIndex <= fromIndex) {
      this.snapSmoothAt(tokens, toIndex);
      return;
    }
    this.pendingSmoothAnimation = { tokens, token, toIndex };
    const animatedTokens = tokens.filter((item) => {
      const start = tokenStart(item);
      const end = start + tokenLength(item);
      return end > fromIndex && start < toIndex;
    });
    this.onSmoothAnimation?.({ tokenCount: tokens.length, animatedTokenCount: animatedTokens.length, durationMs });

    this.smoothAnimationFrame = window.requestAnimationFrame(() => {
      this.smoothAnimationFrame = null;
      if (!tokens.some((item) => item.isConnected)) return;
      this.smoothVisualIndex = Math.max(this.smoothVisualIndex, toIndex);
      for (const item of animatedTokens) {
        item.style.setProperty("--post-reading-fill-duration", `${durationMs}ms`);
        item.style.setProperty("--post-reading-fill", `${rangeFillPercentForToken(item, toIndex)}%`);
        if (tokenStart(item) + tokenReadableLength(item) <= toIndex) item.dataset.postReadingSmoothFilled = "true";
        else delete item.dataset.postReadingSmoothFilled;
      }
    });

    this.smoothAnimationTimer = window.setTimeout(() => {
      this.smoothAnimationTimer = null;
      this.pendingSmoothAnimation = null;
      if (!tokens.some((item) => item.isConnected)) return;
      this.snapSmoothAt(tokens, toIndex);
    }, durationMs + 24);
  }

  private estimateTokenDurationMs(length: number): number {
    const cps = Math.max(0.001, this.calibratedCharsPerSecond);
    return Math.round((Math.max(0, length) / cps) * 1000);
  }

  private estimateSmoothFillDurationMs(length: number): number {
    const tokenDuration = Math.max(35, Math.min(1200, this.estimateTokenDurationMs(length)));
    if (this.lastBoundaryIntervalMs === null) return tokenDuration;
    const cadenceDuration = Math.round(Math.max(35, Math.min(900, this.lastBoundaryIntervalMs * 0.86)));
    return Math.max(35, Math.min(tokenDuration, cadenceDuration));
  }
}

export function estimateHighlightTokenCount(text: string): number {
  return splitSmoothParts(text).length;
}

export function tokenStart(token: HTMLElement | null): number {
  return Number(token?.dataset.postReadingStart || 0);
}

export function tokenLength(token: HTMLElement | null): number {
  return Number(token?.dataset.postReadingLength || token?.textContent?.length || 0);
}

export function tokenReadableLength(token: HTMLElement | null): number {
  return Number(token?.dataset.postReadingReadableLength || tokenLength(token));
}

function tokenSelector(mode: HighlightTokenMode): string {
  return mode === "word" ? '[data-post-reading-word="true"]' : '[data-post-reading-smooth-word="true"]';
}

function collectTextNodes(element: HTMLElement): Text[] {
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE && node.textContent) textNodes.push(node as Text);
  }
  return textNodes;
}

function createHighlightToken(
  text: string,
  mode: HighlightTokenMode,
  index: number,
  start: number,
  useReadableLength: boolean,
): HTMLElement {
  const span = document.createElement("span");
  if (mode === "word") {
    span.dataset.postReadingWord = "true";
  } else {
    span.dataset.postReadingSmoothWord = "true";
    span.dataset.postReadingTokenKind = /^\s+$/.test(text) ? "space" : "word";
    if (useReadableLength) span.dataset.postReadingReadableLength = String(readableTokenLength(text));
  }
  span.dataset.postReadingWordIndex = String(index);
  span.dataset.postReadingStart = String(start);
  span.dataset.postReadingLength = String(text.length);
  span.textContent = text;
  return span;
}

function splitHighlightParts(text: string, mode: HighlightTokenMode): string[] {
  return mode === "smooth" ? splitSmoothParts(text) : text.match(/\S+|\s+/g) || [];
}

function splitSmoothParts(text: string): string[] {
  const raw = text.match(/[\p{L}\p{N}_'-]+[^\s\p{L}\p{N}_'-]*(?:[\s\u00a0]+)?|[^\s\p{L}\p{N}_'-]+(?:[\s\u00a0]+)?|[\s\u00a0]+/gu) || [];
  const parts: string[] = [];
  for (const part of raw) {
    if (!part) continue;
    const last = parts[parts.length - 1];
    if (/^\s+$/.test(part) && last && !/\s$/.test(last)) parts[parts.length - 1] += part;
    else parts.push(part);
  }
  return parts;
}

function readableTokenLength(value: string): number {
  const match = value.match(/[\s\u00a0]+$/);
  return Math.max(1, value.length - (match?.[0].length || 0));
}

function findTokenContaining(tokens: HTMLElement[], index: number): HTMLElement | null {
  return tokens.find((token) => {
    if (token.dataset.postReadingTokenKind === "space") return false;
    const start = tokenStart(token);
    const end = start + tokenReadableLength(token);
    return index >= start && index < end;
  }) || null;
}

function findNearestToken(tokens: HTMLElement[], relativeIndex: number): HTMLElement | null {
  let nearest: HTMLElement | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const token of tokens) {
    if (token.dataset.postReadingTokenKind === "space") continue;
    const start = tokenStart(token);
    const end = start + tokenReadableLength(token);
    if (relativeIndex >= start && relativeIndex <= end) return token;
    const distance = relativeIndex < start ? start - relativeIndex : relativeIndex - end;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = token;
    }
  }
  return nearest || tokens[0] || null;
}

function inferTextLength(tokens: HTMLElement[]): number {
  const last = tokens[tokens.length - 1] || null;
  return tokenStart(last) + tokenLength(last);
}

function rangeFillPercentForToken(token: HTMLElement, cursorIndex: number): number {
  const start = tokenStart(token);
  const length = Math.max(1, tokenReadableLength(token));
  return Math.max(0, Math.min(100, ((cursorIndex - start) / length) * 100));
}

function setSmoothFillImmediate(token: HTMLElement, percent: number | null): void {
  token.style.setProperty("transition", "none");
  token.style.setProperty("--post-reading-fill-duration", "0ms");
  if (percent === null || !Number.isFinite(percent)) token.style.removeProperty("--post-reading-fill");
  else token.style.setProperty("--post-reading-fill", `${Math.max(0, Math.min(100, percent))}%`);
  void token.offsetWidth;
  token.style.removeProperty("transition");
  if (percent === null || !Number.isFinite(percent)) token.style.removeProperty("--post-reading-fill-duration");
}
