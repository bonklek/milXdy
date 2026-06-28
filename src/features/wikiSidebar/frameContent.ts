import { icon } from "../post-reading/icons";

type WikiSidebarOpenTabMessage = {
  type: "wikiSidebar:openTab";
  url: string;
};

type WikiSidebarNavigationMessage = {
  type: "wikiSidebar:navigation";
  url: string;
};

type WikiSidebarNavigateInFrameMessage = {
  type: "wikiSidebar:navigateInFrame";
  url: string;
};

type WikiSidebarHistoryMessage = {
  type: "wikiSidebar:history";
  direction: "back" | "forward";
};

type WikiSidebarReadAloudRequestMessage = {
  type: "wikiSidebar:readAloudRequest";
  articleId: string;
  title: string;
  text: string;
};

type WikiHighlightMessage = {
  type: "wikiSidebar:highlightBoundary" | "wikiSidebar:clearReadHighlight";
  articleId?: string;
  charIndex?: number;
  charLength?: number | null;
  boundaryElapsedTime?: number | null;
  mode?: "off" | "word" | "smooth";
  autoScroll?: boolean;
  speechRate?: number;
  status?: string;
};

type ArticleRange = {
  element: HTMLElement;
  start: number;
  end: number;
  text: string;
};

type ActiveArticle = {
  id: string;
  title: string;
  text: string;
  ranges: ArticleRange[];
};

const WIKI_HOSTS = new Set(["wiki.remilia.org", "remilia.wiki"]);
const SPECIAL_PAGES_ALLOWED_IN_FRAME = new Set(["special:random", "special:search"]);
const READ_BUTTON_ID = "milxdy-wiki-read-aloud";
const READ_BUTTON_SLOT_ID = "milxdy-wiki-read-aloud-slot";
const STYLE_ID = "milxdy-wiki-post-reading-style";
let activeArticle: ActiveArticle | null = null;
let smoothVisualIndex = 0;
let smoothAnimationFrame: number | null = null;
let smoothAnimationTimer: number | null = null;
let smoothAnimationTokens: HTMLElement[] = [];
let lastAutoScrolledLineTop: number | null = null;
let lastBoundaryAt: number | null = null;
let lastRelativeIndex: number | null = null;
let lastBoundaryElapsedTime: number | null = null;
let activeSmoothRangeElement: HTMLElement | null = null;
let calibratedCharsPerSecond = 13;
let baselineCharsPerSecond = 13;
let calibrationSamples = 0;
let calibrationLocked = false;
let frameBooted = false;
const CALIBRATION_SAMPLE_LIMIT = 5;

if (window.top !== window) {
  bootWikiFrame();
}

function bootWikiFrame(): void {
  if (frameBooted) return;
  frameBooted = true;
  document.addEventListener("click", handleWikiFrameClick, true);
  document.addEventListener("mousedown", handleWikiFrameMouseHistoryButton, true);
  document.addEventListener("auxclick", handleWikiFrameMouseHistoryButton, true);
  document.addEventListener("submit", handleWikiFrameSubmit, true);
  window.addEventListener("pageshow", reportCurrentFrameUrl);
  window.addEventListener("pageshow", installReadAloudButton);
  window.addEventListener("popstate", () => {
    clearReadHighlight();
    reportCurrentFrameUrl();
    installReadAloudButton();
  });
  window.addEventListener("hashchange", () => {
    clearReadHighlight();
    reportCurrentFrameUrl();
    installReadAloudButton();
  });
  window.addEventListener("message", handleParentMessage);
  whenWikiDomReady(() => {
    injectPostReadingStyles();
    installReadAloudButton();
    reportCurrentFrameUrl();
    new MutationObserver(() => installReadAloudButton()).observe(document.documentElement, { childList: true, subtree: true });
  });
}

function whenWikiDomReady(callback: () => void): void {
  if (document.head && document.documentElement) {
    callback();
    return;
  }
  document.addEventListener("DOMContentLoaded", callback, { once: true });
}

function installReadAloudButton(): void {
  const anchor = findReadButtonAnchor();
  if (!anchor) return;
  const button = ensureReadButton();
  if (anchor.matches("ul, ol")) {
    let slot = document.getElementById(READ_BUTTON_SLOT_ID) as HTMLLIElement | null;
    if (!slot) {
      slot = document.createElement("li");
      slot.id = READ_BUTTON_SLOT_ID;
      slot.className = "page-actions-menu__list-item milxdy-wiki-read-aloud-slot";
    }
    if (slot.parentElement !== anchor) anchor.append(slot);
    if (button.parentElement !== slot) slot.replaceChildren(button);
    return;
  }
  document.getElementById(READ_BUTTON_SLOT_ID)?.remove();
  if (button.parentElement !== anchor) anchor.append(button);
}

function ensureReadButton(): HTMLButtonElement {
  const existing = document.getElementById(READ_BUTTON_ID);
  if (existing instanceof HTMLButtonElement) return existing;
  existing?.remove();
  const button = document.createElement("button");
  button.id = READ_BUTTON_ID;
  button.type = "button";
  button.className = "cdx-button cdx-button--size-large cdx-button--icon-only cdx-button--weight-quiet milxdy-wiki-read-aloud";
  button.title = "Read aloud";
  button.setAttribute("aria-label", "Read aloud");
  button.innerHTML = icon("speaker");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    requestReadAloud();
  });
  return button;
}

function findReadButtonAnchor(): HTMLElement | null {
  const selectors = [
    "#p-views.page-actions-menu__list",
    ".page-actions-menu__list",
    ".page-actions-menu ul",
    ".minerva__tab-container",
    ".vector-page-toolbar",
    "#p-views ul",
    "#p-cactions ul",
    ".pre-content.heading-holder",
    ".mw-first-heading",
    "h1",
  ];
  for (const selector of selectors) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element) continue;
    if (/^(h1)$/i.test(element.tagName) || element.classList.contains("mw-first-heading")) {
      const wrapper = document.createElement("span");
      wrapper.className = "milxdy-wiki-read-aloud-heading-slot";
      element.insertAdjacentElement("afterend", wrapper);
      return wrapper;
    }
    return element;
  }
  return document.body;
}

function requestReadAloud(): void {
  const article = extractReadableArticle();
  if (!article) return;
  activeArticle = article;
  smoothVisualIndex = 0;
  const message: WikiSidebarReadAloudRequestMessage = {
    type: "wikiSidebar:readAloudRequest",
    articleId: article.id,
    title: article.title,
    text: article.text,
  };
  void chrome.runtime.sendMessage(message).catch(() => undefined);
}

function extractReadableArticle(): ActiveArticle | null {
  const root = document.querySelector<HTMLElement>("#mw-content-text .mw-parser-output")
    || document.querySelector<HTMLElement>("#mw-content-text")
    || document.querySelector<HTMLElement>("main .content")
    || document.querySelector<HTMLElement>("main")
    || document.body;
  const title = (document.querySelector<HTMLElement>("h1, .mw-first-heading")?.innerText || document.title || "Remilia Wiki")
    .replace(/\s+-\s+Remilia Wiki\s*$/i, "")
    .trim() || "Remilia Wiki";
  const blocks = Array.from(root.querySelectorAll<HTMLElement>("h2, h3, h4, p, li, blockquote"))
    .filter(isReadableBlock);
  const ranges: ArticleRange[] = [];
  const parts: string[] = [];
  let cursor = 0;
  for (const block of blocks) {
    const text = normalizeBlockText(block.innerText || block.textContent || "");
    if (!text) continue;
    if (parts.length > 0) {
      parts.push("\n\n");
      cursor += 2;
    }
    const start = cursor;
    parts.push(text);
    cursor += text.length;
    ranges.push({ element: block, start, end: cursor, text });
  }
  const text = parts.join("").trim();
  if (!text) return null;
  return {
    id: `${location.pathname}${location.search}:${text.length}:${hashString(text.slice(0, 4000))}`,
    title,
    text,
    ranges,
  };
}

function isReadableBlock(element: HTMLElement): boolean {
  if (!element.isConnected) return false;
  if (element.hidden || element.getAttribute("aria-hidden") === "true") return false;
  if (element.closest([
    "script",
    "style",
    "noscript",
    "table",
    "figure",
    ".navbox",
    ".metadata",
    ".reference",
    ".references",
    ".reflist",
    ".mw-editsection",
    ".toc",
    "#toc",
    ".catlinks",
    ".printfooter",
    ".mw-footer",
    ".ambox",
    ".infobox",
  ].join(","))) return false;
  const text = normalizeBlockText(element.innerText || element.textContent || "");
  if (text.length < 2) return false;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function normalizeBlockText(value: string): string {
  return value
    .replace(/\[\s*(?:edit|source|citation needed)\s*\]/gi, "")
    .replace(/\s*\[\d+\]\s*/g, " ")
    .replace(/[ \t\r\f\v]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function handleParentMessage(event: MessageEvent): void {
  if (event.source !== window.parent || !isWikiHighlightMessage(event.data)) return;
  if (event.data.type === "wikiSidebar:clearReadHighlight") {
    clearReadHighlight();
    return;
  }
  applyHighlightBoundary(event.data);
}

function applyHighlightBoundary(message: WikiHighlightMessage): void {
  if (!activeArticle || message.articleId !== activeArticle.id || typeof message.charIndex !== "number") return;
  if (message.mode === "off") {
    clearReadHighlight();
    return;
  }
  const charIndex = message.charIndex;
  const range = activeArticle.ranges.find((item) => charIndex >= item.start && charIndex <= item.end);
  if (!range) return;
  for (const item of activeArticle.ranges) {
    if (item !== range) clearBlockHighlight(item.element);
  }
  const relativeIndex = Math.max(0, Math.min(range.text.length, charIndex - range.start));
  if (message.mode === "word") {
    const tokens = prepareTokenizedBlock(range.element, "word");
    const current = findCurrentToken(tokens, relativeIndex, message.charLength ?? null);
    for (const token of tokens) token.dataset.postReadingCurrentWord = String(token === current);
    followReadingLine(current, message.autoScroll !== false);
    return;
  }
  const tokens = prepareTokenizedBlock(range.element, "smooth");
  updateBaselineReadingSpeed(message.speechRate);
  const rangeChanged = activeSmoothRangeElement !== range.element;
  if (rangeChanged || relativeIndex < (lastRelativeIndex ?? 0)) {
    resetSmoothTracking(range.element);
  }
  if (message.status && message.status !== "speaking") {
    suspendSmoothTrackingAt(relativeIndex);
    snapSmoothAt(tokens, relativeIndex);
    followReadingLine(findNearestToken(tokens, relativeIndex), message.autoScroll !== false);
    return;
  }
  const previousRelativeIndex = lastRelativeIndex;
  updateBoundaryCalibration(relativeIndex, message.boundaryElapsedTime);
  paintSmoothTokens(tokens, relativeIndex, previousRelativeIndex, range.text.length, rangeChanged);
  followReadingLine(findNearestToken(tokens, relativeIndex), message.autoScroll !== false);
}

function clearReadHighlight(): void {
  clearSmoothAnimation();
  lastAutoScrolledLineTop = null;
  if (activeArticle) {
    for (const range of activeArticle.ranges) restoreOriginalBlock(range.element);
  } else {
    for (const element of Array.from(document.querySelectorAll<HTMLElement>("[data-post-reading-original-html]"))) {
      restoreOriginalBlock(element);
    }
  }
  activeArticle = null;
  resetSmoothTracking(null);
}

function clearBlockHighlight(element: HTMLElement): void {
  clearSmoothAnimation();
  lastAutoScrolledLineTop = null;
  for (const word of Array.from(element.querySelectorAll<HTMLElement>('[data-post-reading-word="true"]'))) {
    delete word.dataset.postReadingCurrentWord;
  }
  for (const word of Array.from(element.querySelectorAll<HTMLElement>('[data-post-reading-smooth-word="true"]'))) {
    delete word.dataset.postReadingSmoothFilled;
    word.style.removeProperty("--post-reading-fill");
    word.style.removeProperty("--post-reading-fill-duration");
  }
}

function restoreOriginalBlock(element: HTMLElement): void {
  if (element.dataset.postReadingOriginalHtml) {
    element.innerHTML = element.dataset.postReadingOriginalHtml;
    delete element.dataset.postReadingOriginalHtml;
  } else {
    clearBlockHighlight(element);
  }
  delete element.dataset.postReadingHighlightMode;
}

function prepareTokenizedBlock(element: HTMLElement, mode: "word" | "smooth"): HTMLElement[] {
  const selector = mode === "word" ? '[data-post-reading-word="true"]' : '[data-post-reading-smooth-word="true"]';
  const existing = Array.from(element.querySelectorAll<HTMLElement>(selector));
  if (existing.length > 0) return existing;
  if (element.dataset.postReadingHighlightMode && element.dataset.postReadingHighlightMode !== mode) {
    restoreOriginalBlock(element);
  }
  if (!element.dataset.postReadingOriginalHtml) element.dataset.postReadingOriginalHtml = element.innerHTML;
  element.dataset.postReadingHighlightMode = mode;
  const text = normalizeBlockText(element.innerText || element.textContent || "");
  element.textContent = "";
  const parts = mode === "smooth" ? buildSmoothParts(text) : text.match(/\S+|\s+/g) || [];
  const tokens: HTMLElement[] = [];
  let cursor = 0;
  let index = 0;
  for (const part of parts) {
    if (/^\s+$/.test(part) && mode === "word") {
      element.append(document.createTextNode(part));
      cursor += part.length;
      continue;
    }
    const span = document.createElement("span");
    if (mode === "word") span.dataset.postReadingWord = "true";
    else {
      span.dataset.postReadingSmoothWord = "true";
      span.dataset.postReadingTokenKind = /^\s+$/.test(part) ? "space" : "word";
    }
    span.dataset.postReadingWordIndex = String(index++);
    span.dataset.postReadingStart = String(cursor);
    span.dataset.postReadingLength = String(part.length);
    if (mode === "smooth") {
      span.dataset.postReadingReadableLength = String(readableTokenLength(part));
    }
    span.textContent = part;
    tokens.push(span);
    element.append(span);
    cursor += part.length;
  }
  return tokens;
}

function findCurrentToken(tokens: HTMLElement[], relativeIndex: number, charLength: number | null): HTMLElement | null {
  if (charLength !== null && charLength > 0) {
    const midpoint = relativeIndex + Math.max(0, Math.floor((charLength - 1) / 2));
    const token = tokens.find((item) => midpoint >= tokenStart(item) && midpoint < tokenStart(item) + tokenLength(item));
    if (token) return token;
  }
  return findNearestToken(tokens, relativeIndex);
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
  return nearest;
}

function paintSmoothTokens(
  tokens: HTMLElement[],
  relativeIndex: number,
  previousRelativeIndex: number | null,
  textLength: number,
  snapToCurrent = false,
): void {
  clearSmoothAnimation();
  if (snapToCurrent) {
    smoothVisualIndex = relativeIndex;
    resetSmoothTokenFill(tokens);
  }
  const currentToken = findCurrentToken(tokens, relativeIndex, null);
  if (!currentToken) {
    snapSmoothAt(tokens, Math.min(textLength, relativeIndex));
    return;
  }
  const animationStart = previousRelativeIndex === null ? relativeIndex : Math.max(0, Math.min(previousRelativeIndex, relativeIndex));
  const visualStart = Math.max(animationStart, Math.min(relativeIndex, smoothVisualIndex));
  const predictedNextBoundary = findNextBoundaryIndex(tokens, relativeIndex);
  const minimumLead = Math.max(4, Math.round(calibratedCharsPerSecond * 0.24));
  const animationEnd = Math.min(textLength, Math.max(visualStart, predictedNextBoundary, relativeIndex + minimumLead));
  const duration = estimateTokenDurationMs(Math.max(1, animationEnd - visualStart || tokenLength(currentToken)));
  snapSmoothAt(tokens, visualStart);
  animateSmoothRange(tokens, visualStart, animationEnd, duration);
}

function resetSmoothTokenFill(tokens: HTMLElement[]): void {
  for (const token of tokens) {
    delete token.dataset.postReadingSmoothFilled;
    setSmoothFillImmediate(token, null);
  }
}

function paintSmoothAt(tokens: HTMLElement[], cursorIndex: number): void {
  applySmoothAt(tokens, cursorIndex, false);
}

function snapSmoothAt(tokens: HTMLElement[], cursorIndex: number): void {
  applySmoothAt(tokens, cursorIndex, true);
}

function applySmoothAt(tokens: HTMLElement[], cursorIndex: number, forceComplete: boolean): void {
  const cursor = forceComplete ? cursorIndex : Math.max(smoothVisualIndex, cursorIndex);
  smoothVisualIndex = cursor;
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
      setSmoothFillImmediate(token, Math.max(0, Math.min(100, ((cursor - start) / readableLength) * 100)));
    } else {
      delete token.dataset.postReadingSmoothFilled;
      setSmoothFillImmediate(token, null);
    }
  }
}

function animateSmoothRange(tokens: HTMLElement[], fromIndex: number, toIndex: number, durationMs: number): void {
  if (durationMs <= 0 || toIndex <= fromIndex) {
    snapSmoothAt(tokens, toIndex);
    return;
  }
  const animatedTokens = tokens.filter((token) => {
    const start = tokenStart(token);
    const end = start + tokenLength(token);
    return end > fromIndex && start < toIndex;
  });
  smoothAnimationTokens = animatedTokens;
  smoothAnimationFrame = window.requestAnimationFrame(() => {
    smoothAnimationFrame = null;
    if (!tokens.some((token) => token.isConnected)) return;
    smoothVisualIndex = Math.max(smoothVisualIndex, toIndex);
    for (const token of animatedTokens) {
      const end = tokenStart(token) + tokenLength(token);
      token.style.setProperty("--post-reading-fill-duration", `${durationMs}ms`);
      token.style.setProperty("--post-reading-fill", `${rangeFillPercentForToken(token, toIndex)}%`);
      if (end <= toIndex) token.dataset.postReadingSmoothFilled = "true";
      else delete token.dataset.postReadingSmoothFilled;
    }
  });
  smoothAnimationTimer = window.setTimeout(() => {
    smoothAnimationTimer = null;
    if (!tokens.some((token) => token.isConnected)) return;
    snapSmoothAt(tokens, toIndex);
    smoothAnimationTokens = [];
  }, durationMs + 24);
}

function updateBoundaryCalibration(relativeIndex: number, boundaryElapsedTime: unknown): void {
  const now = performance.now();
  if (!calibrationLocked && lastRelativeIndex !== null && relativeIndex > lastRelativeIndex) {
    const elapsedMs = boundaryElapsedMs(boundaryElapsedTime, now);
    const charDelta = relativeIndex - lastRelativeIndex;
    const observed = elapsedMs !== null && elapsedMs > 0 ? charDelta / (elapsedMs / 1000) : null;
    if (elapsedMs !== null && observed !== null && isUsefulSpeedSample(observed, charDelta, elapsedMs)) {
      calibratedCharsPerSecond = calibrationSamples === 0
        ? observed
        : calibratedCharsPerSecond * 0.68 + observed * 0.32;
      calibrationSamples += 1;
      if (calibrationSamples >= CALIBRATION_SAMPLE_LIMIT) calibrationLocked = true;
    }
  }
  lastBoundaryAt = now;
  lastRelativeIndex = relativeIndex;
  lastBoundaryElapsedTime = typeof boundaryElapsedTime === "number" && Number.isFinite(boundaryElapsedTime) ? boundaryElapsedTime : null;
}

function isUsefulSpeedSample(observed: number, charDelta: number, elapsedMs: number): boolean {
  if (!Number.isFinite(observed) || observed <= 0) return false;
  if (charDelta < 3 || elapsedMs <= 0) return false;
  const lower = baselineCharsPerSecond * 0.45;
  const upper = baselineCharsPerSecond * 2.4;
  return observed >= lower && observed <= upper;
}

function boundaryElapsedMs(boundaryElapsedTime: unknown, now: number): number | null {
  if (typeof boundaryElapsedTime === "number" && Number.isFinite(boundaryElapsedTime) && lastBoundaryElapsedTime !== null) {
    const elapsed = (boundaryElapsedTime - lastBoundaryElapsedTime) * 1000;
    if (elapsed > 0) return elapsed;
  }
  if (lastBoundaryAt !== null) return now - lastBoundaryAt;
  return null;
}

function suspendSmoothTrackingAt(relativeIndex: number): void {
  clearSmoothAnimation();
  lastBoundaryAt = null;
  lastRelativeIndex = relativeIndex;
  lastBoundaryElapsedTime = null;
}

function clearSmoothAnimation(): void {
  if (smoothAnimationFrame !== null) {
    window.cancelAnimationFrame(smoothAnimationFrame);
    smoothAnimationFrame = null;
  }
  if (smoothAnimationTimer !== null) {
    window.clearTimeout(smoothAnimationTimer);
    smoothAnimationTimer = null;
  }
  for (const token of smoothAnimationTokens) {
    const fill = token.style.getPropertyValue("--post-reading-fill").trim();
    setSmoothFillImmediate(token, fill.endsWith("%") ? Number(fill.slice(0, -1)) : null);
  }
  smoothAnimationTokens = [];
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

function resetSmoothTracking(rangeElement: HTMLElement | null): void {
  clearSmoothAnimation();
  smoothVisualIndex = 0;
  lastBoundaryAt = null;
  lastRelativeIndex = null;
  lastBoundaryElapsedTime = null;
  activeSmoothRangeElement = rangeElement;
  calibratedCharsPerSecond = baselineCharsPerSecond;
  calibrationSamples = 0;
  calibrationLocked = false;
}

function updateBaselineReadingSpeed(speed: unknown): void {
  const numeric = typeof speed === "number" && Number.isFinite(speed) ? speed : 1;
  baselineCharsPerSecond = 13 * Math.max(0.5, numeric);
  if (lastBoundaryAt === null) calibratedCharsPerSecond = baselineCharsPerSecond;
}

function rangeFillPercentForToken(token: HTMLElement, cursorIndex: number): number {
  const start = tokenStart(token);
  const length = Math.max(1, tokenReadableLength(token));
  return Math.max(0, Math.min(100, ((cursorIndex - start) / length) * 100));
}

function followReadingLine(token: HTMLElement | null, enabled: boolean): void {
  if (!enabled || !token) return;
  const rect = token.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  const lineTop = Math.round(rect.top);
  if (lastAutoScrolledLineTop !== null && Math.abs(lineTop - lastAutoScrolledLineTop) < Math.max(4, rect.height * 0.5)) return;

  const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
  if (viewportHeight <= 0) return;
  const upperBand = viewportHeight * 0.26;
  const lowerBand = viewportHeight * 0.58;
  let delta = 0;
  if (rect.top > lowerBand) {
    delta = rect.top - viewportHeight * 0.42;
  } else if (rect.top < upperBand) {
    delta = rect.top - viewportHeight * 0.34;
  }
  if (Math.abs(delta) < 1) return;
  lastAutoScrolledLineTop = lineTop;
  window.scrollBy({ top: Math.round(delta), left: 0, behavior: "smooth" });
}

function buildSmoothParts(text: string): string[] {
  const raw = text.match(/[\p{L}\p{N}_'-]+[^\s\p{L}\p{N}_'-]*(?:[\s\u00a0]+)?|[^\s\p{L}\p{N}_'-]+(?:[\s\u00a0]+)?|[\s\u00a0]+/gu) || [];
  const parts: string[] = [];
  for (const part of raw) {
    const last = parts[parts.length - 1];
    if (/^\s+$/.test(part) && last && !/\s$/.test(last)) parts[parts.length - 1] += part;
    else parts.push(part);
  }
  return parts;
}

function tokenStart(token: HTMLElement | null): number {
  return Number(token?.dataset.postReadingStart || 0);
}

function tokenLength(token: HTMLElement | null): number {
  return Number(token?.dataset.postReadingLength || token?.textContent?.length || 0);
}

function tokenReadableLength(token: HTMLElement | null): number {
  return Number(token?.dataset.postReadingReadableLength || tokenLength(token));
}

function readableTokenLength(value: string): number {
  const match = value.match(/[\s\u00a0]+$/);
  return Math.max(1, value.length - (match?.[0].length || 0));
}

function estimateTokenDurationMs(length: number): number {
  const cps = Math.max(0.001, calibratedCharsPerSecond);
  return Math.round((Math.max(0, length) / cps) * 1000);
}

function findNextBoundaryIndex(tokens: HTMLElement[], relativeIndex: number): number {
  const sorted = [...tokens].sort((left, right) => tokenStart(left) - tokenStart(right));
  const current = findNearestToken(sorted, relativeIndex);
  if (!current) return relativeIndex;
  const currentIndex = sorted.indexOf(current);
  for (const token of sorted.slice(currentIndex + 1)) {
    if (token.dataset.postReadingTokenKind !== "space") return tokenStart(token);
  }
  return tokenStart(current) + tokenReadableLength(current);
}

function isWikiHighlightMessage(value: unknown): value is WikiHighlightMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.type === "wikiSidebar:highlightBoundary" || record.type === "wikiSidebar:clearReadHighlight";
}

function hashString(value: string): string {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function injectPostReadingStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  if (!document.head) {
    whenWikiDomReady(injectPostReadingStyles);
    return;
  }
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .milxdy-wiki-read-aloud,
    .milxdy-wiki-read-aloud-heading-slot .milxdy-wiki-read-aloud {
      width: 34px;
      height: 34px;
      border: 0;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #54595d;
      background: transparent;
      cursor: pointer;
      padding: 0;
      vertical-align: middle;
    }
    .milxdy-wiki-read-aloud-slot {
      display: list-item;
      list-style: none;
      margin: 0;
      padding: 0;
    }
    .milxdy-wiki-read-aloud:hover,
    .milxdy-wiki-read-aloud:focus-visible {
      color: rgb(199, 102, 147);
      background: rgba(199, 102, 147, 0.12);
    }
    .milxdy-wiki-read-aloud svg {
      width: 18px;
      height: 18px;
      pointer-events: none;
    }
    .milxdy-wiki-read-aloud-heading-slot {
      display: inline-flex;
      margin: 4px 0 8px;
    }
    @property --post-reading-fill {
      syntax: "<percentage>";
      inherits: false;
      initial-value: 0%;
    }
    [data-post-reading-word="true"][data-post-reading-current-word="true"] {
      background: rgba(199, 102, 147, 0.18);
      border-radius: 4px;
      box-decoration-break: clone;
      -webkit-box-decoration-break: clone;
    }
    [data-post-reading-smooth-word="true"] {
      --post-reading-fill-color: rgba(199, 102, 147, 0.24);
      --post-reading-fill: 0%;
      --post-reading-fill-duration: 160ms;
      display: inline;
      white-space: pre-wrap;
      background: linear-gradient(90deg, var(--post-reading-fill-color) var(--post-reading-fill), transparent var(--post-reading-fill));
      border-radius: 0;
      box-decoration-break: slice;
      -webkit-box-decoration-break: slice;
      margin: -0.1em 0 -0.16em;
      padding: 0.1em 0 0.16em;
      transition: --post-reading-fill var(--post-reading-fill-duration) linear;
    }
    [data-post-reading-smooth-word="true"][data-post-reading-smooth-filled="true"] {
      --post-reading-fill: 100%;
    }
    [data-post-reading-smooth-word="true"][data-post-reading-token-kind="space"] {
      border-radius: 0;
      margin-left: -0.02em;
      margin-right: -0.02em;
    }
  `;
  document.head.append(style);
}

function handleWikiFrameClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest<HTMLAnchorElement>("a[href]");
  if (!link) return;

  const url = parseUrl(link.href);
  if (!url) return;
  if (!shouldOpenOutsideFrame(url, link)) {
    event.preventDefault();
    event.stopPropagation();
    navigateInSidebarFrame(url.href);
    return;
  }

  event.preventDefault();
  event.stopPropagation();
  void openOutsideFrame(url.href);
}

function reportCurrentFrameUrl(): void {
  void reportFrameNavigation(window.location.href);
}

function reportFrameNavigation(url: string): void {
  const message: WikiSidebarNavigationMessage = { type: "wikiSidebar:navigation", url };
  void chrome.runtime.sendMessage(message).catch(() => undefined);
}

function navigateInSidebarFrame(url: string): void {
  const message: WikiSidebarNavigateInFrameMessage = { type: "wikiSidebar:navigateInFrame", url };
  void chrome.runtime.sendMessage(message).catch(() => undefined);
}

function navigateSidebarHistory(direction: "back" | "forward"): void {
  const message: WikiSidebarHistoryMessage = { type: "wikiSidebar:history", direction };
  void chrome.runtime.sendMessage(message).catch(() => undefined);
}

function handleWikiFrameMouseHistoryButton(event: MouseEvent): void {
  if (event.button !== 3 && event.button !== 4) return;
  event.preventDefault();
  event.stopPropagation();
  navigateSidebarHistory(event.button === 3 ? "back" : "forward");
}

function handleWikiFrameSubmit(event: SubmitEvent): void {
  const form = event.target instanceof HTMLFormElement ? event.target : null;
  if (!form) return;

  const url = formNavigationUrl(form, event.submitter);
  if (!url) return;

  event.preventDefault();
  event.stopPropagation();
  if (!shouldOpenOutsideFrame(url)) {
    navigateInSidebarFrame(url.href);
    return;
  }
  void openOutsideFrame(url.href);
}

function formNavigationUrl(form: HTMLFormElement, submitter: SubmitEvent["submitter"]): URL | null {
  const action = parseUrl(form.action || window.location.href);
  if (!action) return null;
  const method = (form.method || "get").toLowerCase();
  if (method !== "get") return action;
  const formData = new FormData(form);
  if ((submitter instanceof HTMLButtonElement || submitter instanceof HTMLInputElement) && submitter.name) {
    formData.append(submitter.name, submitter.value);
  }
  action.search = "";
  for (const [name, value] of formData.entries()) {
    if (typeof value === "string") action.searchParams.append(name, value);
  }
  return action;
}

function shouldOpenOutsideFrame(url: URL, link?: HTMLAnchorElement): boolean {
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (!WIKI_HOSTS.has(url.hostname)) return true;
  if (link?.target && link.target.toLowerCase() !== "_self") return true;
  if (url.searchParams.get("mobileaction") === "toggle_view_desktop") return true;

  const action = url.searchParams.get("action");
  if (action && action !== "view") return true;

  const title = wikiTitle(url).toLowerCase();
  if (!title.startsWith("special:")) return false;
  return !SPECIAL_PAGES_ALLOWED_IN_FRAME.has(title);
}

function wikiTitle(url: URL): string {
  const queryTitle = url.searchParams.get("title");
  if (queryTitle) return normalizeWikiTitle(queryTitle);
  return normalizeWikiTitle(url.pathname.replace(/^\/+/, ""));
}

function normalizeWikiTitle(value: string): string {
  try {
    return decodeURIComponent(value).replace(/_/g, " ").trim();
  } catch {
    return value.replace(/_/g, " ").trim();
  }
}

function parseUrl(value: string): URL | null {
  try {
    return new URL(value, window.location.href);
  } catch {
    return null;
  }
}

async function openOutsideFrame(url: string): Promise<void> {
  const message: WikiSidebarOpenTabMessage = { type: "wikiSidebar:openTab", url };
  try {
    const response = await chrome.runtime.sendMessage(message) as { ok?: unknown } | undefined;
    if (response?.ok === true) return;
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}
