export type HighlightTokenMode = "word" | "smooth";

export type HighlightTextSegment = {
  text: string;
  included: boolean;
};

export type HighlightTextSegmentLayout = HighlightTextSegment & {
  uncountedPrefix: string;
  parts: Array<{
    text: string;
    start: number;
    token: boolean;
  }>;
};

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
  interrupted?: boolean;
  pendingToIndex?: number;
  boundaryIndex?: number;
  catchUpActive?: boolean;
};

export type TextHighlightEngineOptions = {
  onSmoothAnimation?: (diagnostic: SmoothAnimationDiagnostic) => void;
};

type PendingSmoothAnimation = {
  tokens: HTMLElement[];
  token: HTMLElement;
  toIndex: number;
};

const originalHtmlByElement = new WeakMap<HTMLElement, string>();

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
  private catchUpUntil = 0;
  private readonly onSmoothAnimation?: (diagnostic: SmoothAnimationDiagnostic) => void;

  constructor(options: TextHighlightEngineOptions = {}) {
    this.onSmoothAnimation = options.onSmoothAnimation;
  }

  captureOriginalElement(element: HTMLElement): void {
    if (originalHtmlByElement.has(element)) return;
    originalHtmlByElement.set(element, element.innerHTML);
    element.dataset.postReadingOriginalHtml = "true";
  }

  prepareTokens(element: HTMLElement, mode: HighlightTokenMode, options: PrepareTokenOptions = {}): HTMLElement[] {
    const selector = tokenSelector(mode);
    const existing = Array.from(element.querySelectorAll<HTMLElement>(selector));
    if (existing.length > 0) return existing;
    this.resetTokenizationForMode(element, mode);
    this.captureOriginalElement(element);
    element.dataset.postReadingHighlightMode = mode;

    if (typeof options.textOverride === "string") {
      return this.prepareTextOverrideTokens(element, mode, options.textOverride, options.smoothReadableLength === true);
    }

    const tokens: HTMLElement[] = [];
    const textNodes = collectTextNodes(element);
    let tokenIndex = 0;
    const layouts = layoutHighlightTextSegments(textNodes.map((node) => ({
      text: node.textContent || "",
      included: options.includeTextNode?.(node) !== false,
    })), mode);

    for (const [nodeIndex, node] of textNodes.entries()) {
      const layout = layouts[nodeIndex];
      if (!layout.included || layout.parts.length === 0) continue;

      const fragment = document.createDocumentFragment();
      if (layout.uncountedPrefix) fragment.appendChild(document.createTextNode(layout.uncountedPrefix));
      for (const part of layout.parts) {
        if (!part.token) {
          fragment.appendChild(document.createTextNode(part.text));
          continue;
        }
        const span = createHighlightToken(part.text, mode, tokenIndex++, part.start, options.smoothReadableLength === true);
        tokens.push(span);
        fragment.appendChild(span);
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
    const originalHtml = originalHtmlByElement.get(element);
    if (originalHtml !== undefined) {
      element.innerHTML = originalHtml;
      originalHtmlByElement.delete(element);
    } else {
      this.clearElement(element);
    }
    delete element.dataset.postReadingOriginalHtml;
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

  paintSmoothAt(tokens: HTMLElement[], cursorIndex: number): void {
    this.clearSmoothAnimation();
    this.snapSmoothAt(tokens, cursorIndex);
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
    const interrupted = this.recordBoundaryInterruption(relativeIndex);
    if (interrupted) {
      this.clearSmoothAnimation({ completePending: true });
      this.activeSmoothToken = null;
    }

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
      this.snapSmoothAt(tokens, relativeIndex);
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
    this.animateSmoothRange(tokens, currentToken, visualStart, animationEnd, duration, interrupted, relativeIndex);
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
    this.catchUpUntil = 0;
    void rangeElement;
  }

  suspendSmoothTracking(relativeIndex: number): void {
    this.clearSmoothAnimation();
    this.smoothVisualIndex = 0;
    this.activeSmoothToken = null;
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
    if (this.lastRelativeIndex !== null && relativeIndex > this.lastRelativeIndex) {
      const elapsedMs = this.boundaryElapsedMs(boundaryElapsedTime, now);
      const charDelta = relativeIndex - this.lastRelativeIndex;
      const observed = elapsedMs !== null && elapsedMs > 0 ? charDelta / (elapsedMs / 1000) : null;
      if (elapsedMs !== null && elapsedMs > 0) this.lastBoundaryIntervalMs = elapsedMs;
      if (observed !== null && Number.isFinite(observed) && observed > 1 && observed < 80) {
        this.calibratedCharsPerSecond = this.calibratedCharsPerSecond * 0.72 + observed * 0.28;
      }
    }
    this.lastBoundaryAt = now;
    this.lastRelativeIndex = relativeIndex;
    this.lastBoundaryElapsedTime = typeof boundaryElapsedTime === "number" && Number.isFinite(boundaryElapsedTime)
      ? boundaryElapsedTime
      : null;
  }

  private recordBoundaryInterruption(relativeIndex: number): { pendingToIndex: number; boundaryIndex: number } | null {
    const pending = this.pendingSmoothAnimation;
    if (!pending) return null;
    if (relativeIndex < pending.toIndex) return null;
    this.catchUpUntil = performance.now() + 1600;
    return { pendingToIndex: pending.toIndex, boundaryIndex: relativeIndex };
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
      const readableLength = Math.max(1, tokenReadableLength(token));
      const readableEnd = start + readableLength;
      if (readableEnd <= cursor) {
        token.dataset.postReadingSmoothFilled = "true";
        setSmoothFillImmediate(token, 100);
      } else if (cursor >= start && cursor < readableEnd) {
        delete token.dataset.postReadingSmoothFilled;
        setSmoothFillImmediate(token, rangeFillPercentForToken(token, cursor));
      } else {
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
    interrupted: { pendingToIndex: number; boundaryIndex: number } | null = null,
    boundaryIndex: number | null = null,
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
    this.onSmoothAnimation?.({
      tokenCount: tokens.length,
      animatedTokenCount: animatedTokens.length,
      durationMs,
      interrupted: Boolean(interrupted),
      pendingToIndex: interrupted?.pendingToIndex,
      boundaryIndex: interrupted?.boundaryIndex ?? boundaryIndex ?? undefined,
      catchUpActive: this.catchUpActive(),
    });

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
    const cps = Math.max(4, this.calibratedCharsPerSecond);
    return Math.round((Math.max(0, length) / cps) * 1000);
  }

  private estimateSmoothFillDurationMs(length: number): number {
    return Math.max(80, Math.min(1200, this.estimateTokenDurationMs(length)));
  }

  private catchUpActive(): boolean {
    return this.catchUpUntil > performance.now();
  }
}

export function estimateHighlightTokenCount(text: string): number {
  return splitSmoothParts(text).length;
}

export function layoutHighlightTextSegments(
  segments: HighlightTextSegment[],
  mode: HighlightTokenMode,
): HighlightTextSegmentLayout[] {
  const layouts: HighlightTextSegmentLayout[] = [];
  let cursor = 0;
  let skippedText = false;
  let countedTextEndsWithWhitespace = false;

  for (const segment of segments) {
    if (!segment.included) {
      skippedText = true;
      layouts.push({ ...segment, uncountedPrefix: "", parts: [] });
      continue;
    }

    const uncountedPrefix = skippedText && countedTextEndsWithWhitespace
      ? segment.text.match(/^\s+/)?.[0] || ""
      : "";
    const text = uncountedPrefix ? segment.text.slice(uncountedPrefix.length) : segment.text;
    skippedText = false;
    const parts: HighlightTextSegmentLayout["parts"] = [];
    if (!text.trim()) {
      cursor += text.length;
      if (text) countedTextEndsWithWhitespace = /\s$/.test(text);
      layouts.push({ ...segment, uncountedPrefix, parts });
      continue;
    }

    for (const part of splitHighlightParts(text, mode)) {
      const token = !(mode === "word" && /^\s+$/.test(part));
      parts.push({ text: part, start: cursor, token });
      cursor += part.length;
      countedTextEndsWithWhitespace = /\s$/.test(part);
    }
    layouts.push({ ...segment, uncountedPrefix, parts });
  }

  return layouts;
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
  token.style.removeProperty("transition");
  if (percent === null || !Number.isFinite(percent)) token.style.removeProperty("--post-reading-fill-duration");
}
