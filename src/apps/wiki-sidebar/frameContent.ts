import readingControlsStyles from "./reading-controls.css";
import { icon } from "../post-reading/icons";
import { TextHighlightEngine } from "../post-reading/highlightEngine";

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

type WikiThemeMessage = {
  type: "wikiSidebar:theme";
  theme: "light" | "dark";
  enabled: boolean;
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
const THEME_STYLE_ID = "milxdy-wiki-sidebar-theme-style";
const EXPANDABLE_WIKI_CONTAINER_SELECTOR = [
  "details",
  '[role="tabpanel"]',
  ".tabber__section",
  ".tabbertab",
  ".mw-collapsible-content",
  ".collapse",
].join(", ");
let activeArticle: ActiveArticle | null = null;
let smoothVisualIndex = 0;
let smoothAnimationFrame: number | null = null;
let smoothAnimationTimer: number | null = null;
let activeSmoothToken: HTMLElement | null = null;
let pendingSmoothAnimation: { tokens: HTMLElement[]; token: HTMLElement; toIndex: number } | null = null;
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
let directReaderEnabled = window.top !== window;
const CALIBRATION_SAMPLE_LIMIT = 5;
const highlightEngine = new TextHighlightEngine();

if (WIKI_HOSTS.has(window.location.hostname.toLowerCase())) {
  bootWikiFrame(window.top !== window);
}

function bootWikiFrame(embedded: boolean): void {
  if (frameBooted) return;
  frameBooted = true;
  document.documentElement.dataset.milxdyWikiSurface = embedded ? "embedded" : "direct";
  if (embedded) {
    document.addEventListener("click", handleWikiFrameClick, true);
    document.addEventListener("mousedown", handleWikiFrameMouseHistoryButton, true);
    document.addEventListener("auxclick", handleWikiFrameMouseHistoryButton, true);
    document.addEventListener("submit", handleWikiFrameSubmit, true);
    window.addEventListener("pageshow", reportCurrentFrameUrl);
    window.addEventListener("message", handleParentMessage);
  } else {
    observeDirectReaderEnablement();
    document.addEventListener("wikiSidebar:reader-highlight", handleDirectReaderHighlight as EventListener);
    document.addEventListener("post-reading:wiki-reading-state", handleDirectReaderState as EventListener);
  }
  window.addEventListener("pageshow", refreshReadAloudButton);
  window.addEventListener("popstate", () => {
    clearReadHighlight();
    if (embedded) reportCurrentFrameUrl();
    refreshReadAloudButton();
  });
  window.addEventListener("hashchange", () => {
    clearReadHighlight();
    if (embedded) reportCurrentFrameUrl();
    refreshReadAloudButton();
  });
  whenWikiDomReady(() => {
    injectPostReadingStyles();
    refreshReadAloudButton();
    if (embedded) reportCurrentFrameUrl();
    new MutationObserver(refreshReadAloudButton).observe(document.documentElement, { childList: true, subtree: true });
  });
}

function refreshReadAloudButton(): void {
  if (!directReaderEnabled) {
    document.getElementById(READ_BUTTON_ID)?.remove();
    document.getElementById(READ_BUTTON_SLOT_ID)?.remove();
    return;
  }
  installReadAloudButton();
}

function observeDirectReaderEnablement(): void {
  void chrome.storage.sync.get({ enabled: true }).then((stored) => {
    directReaderEnabled = stored.enabled !== false;
    refreshReadAloudButton();
  }).catch(() => undefined);
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "sync" || !changes.enabled) return;
    directReaderEnabled = changes.enabled.newValue !== false;
    if (!directReaderEnabled) clearReadHighlight();
    refreshReadAloudButton();
  });
}

function handleDirectReaderHighlight(event: CustomEvent<unknown>): void {
  if (!isWikiParentMessage(event.detail) || event.detail.type === "wikiSidebar:theme") return;
  if (event.detail.type === "wikiSidebar:clearReadHighlight") clearReadHighlight();
  else applyHighlightBoundary(event.detail);
}

function handleDirectReaderState(event: CustomEvent<unknown>): void {
  const detail = event.detail && typeof event.detail === "object" ? event.detail as Record<string, unknown> : null;
  if (detail?.active === false) clearReadHighlight();
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
  if (window.top === window) {
    document.dispatchEvent(new CustomEvent("post-reading:read-document", {
      detail: { id: message.articleId, title: message.title, text: message.text, source: "wiki" },
    }));
    return;
  }
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
  if (!element.hidden && element.getAttribute("aria-hidden") !== "true" && rect.width > 0 && rect.height > 0) return true;
  const container = element.closest<HTMLElement>(EXPANDABLE_WIKI_CONTAINER_SELECTOR);
  return Boolean(container && wikiContainerIsHidden(container) && wikiContainerController(container));
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
  if (event.source !== window.parent || !isWikiParentMessage(event.data)) return;
  if (event.data.type === "wikiSidebar:theme") {
    applySidebarTheme(event.data);
    return;
  }
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
  revealWikiReadingRange(range.element);
  for (const item of activeArticle.ranges) {
    if (item !== range) clearBlockHighlight(item.element);
  }
  const relativeIndex = Math.max(0, Math.min(range.text.length, charIndex - range.start));
  if (message.mode === "word") {
    const tokens = prepareTokenizedBlock(range.element, "word");
    const current = highlightEngine.paintWord(tokens, relativeIndex, message.charLength ?? null);
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
    highlightEngine.paintSmooth(tokens, relativeIndex, {
      charLength: message.charLength ?? null,
      textLength: range.text.length,
      snapToCurrent: true,
      boundaryElapsedTime: message.boundaryElapsedTime,
    });
    followReadingLine(findNearestToken(tokens, relativeIndex), message.autoScroll !== false);
    return;
  }
  paintSmoothTokens(tokens, relativeIndex, range.text.length, rangeChanged, message.charLength ?? null, message.boundaryElapsedTime ?? null);
  lastRelativeIndex = relativeIndex;
  followReadingLine(findNearestToken(tokens, relativeIndex), message.autoScroll !== false);
}

function revealWikiReadingRange(element: HTMLElement): void {
  const containers = ancestorExpandableWikiContainers(element);
  for (const container of containers.reverse()) {
    if (container instanceof HTMLDetailsElement) {
      container.open = true;
      continue;
    }
    if (!wikiContainerIsHidden(container)) continue;
    wikiContainerController(container)?.click();
  }
}

function ancestorExpandableWikiContainers(element: HTMLElement): HTMLElement[] {
  const containers: HTMLElement[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body) {
    if (current.matches(EXPANDABLE_WIKI_CONTAINER_SELECTOR)) containers.push(current);
    current = current.parentElement;
  }
  return containers;
}

function wikiContainerIsHidden(container: HTMLElement): boolean {
  if (container instanceof HTMLDetailsElement) return !container.open;
  if (container.hidden || container.getAttribute("aria-hidden") === "true") return true;
  if (container.classList.contains("mw-collapsed")) return true;
  if (container.classList.contains("collapse") && !container.classList.contains("show")) return true;
  const style = getComputedStyle(container);
  return style.display === "none" || style.visibility === "hidden" || container.getClientRects().length === 0;
}

function wikiContainerController(container: HTMLElement): HTMLElement | null {
  if (container instanceof HTMLDetailsElement) return container.querySelector<HTMLElement>(":scope > summary") || container;
  const collapsible = container.closest<HTMLElement>(".mw-collapsible");
  if (collapsible) {
    const toggle = collapsible.querySelector<HTMLElement>(":scope > .mw-collapsible-toggle, .mw-collapsible-toggle");
    if (toggle && safeWikiControllerElement(toggle)) return toggle;
  }
  if (container.id) {
    const id = container.id;
    const hash = `#${id}`;
    const controller = Array.from(document.querySelectorAll<HTMLElement>(
      '[aria-controls], [data-target], [data-bs-target], a[href^="#"]',
    )).find((candidate) => (
      safeWikiControllerCandidate(candidate, id, hash) && (
        (candidate.getAttribute("aria-controls") || "").split(/\s+/).includes(id)
        || candidate.getAttribute("data-target") === hash
        || candidate.getAttribute("data-bs-target") === hash
        || candidate.getAttribute("href") === hash
      )
    ));
    if (controller) return controller;
  }
  const labelledBy = container.getAttribute("aria-labelledby");
  if (labelledBy) {
    const label = document.getElementById(labelledBy);
    if (label instanceof HTMLElement && safeWikiControllerElement(label)) return label;
  }
  if (container.classList.contains("tabbertab")) {
    const tabber = container.closest<HTMLElement>(".tabberlive, .tabber");
    const panels = tabber ? Array.from(tabber.querySelectorAll<HTMLElement>(":scope > .tabbertab, :scope > .tabber__section")) : [];
    const index = panels.indexOf(container);
    const candidate = index >= 0 ? tabber?.querySelectorAll<HTMLElement>(".tabbernav a, .tabber__tabs [role=tab]")[index] : null;
    if (candidate && safeWikiControllerElement(candidate)) return candidate;
  }
  return null;
}

function safeWikiControllerCandidate(candidate: HTMLElement, id: string, hash: string): boolean {
  if (!safeWikiControllerElement(candidate)) return false;
  if (candidate instanceof HTMLAnchorElement) {
    if (candidate.getAttribute("href") !== hash) return false;
    return (candidate.getAttribute("aria-controls") || "").split(/\s+/).includes(id)
      || candidate.matches('[role="tab"], .tabber__tab, .tabbernav a')
      || candidate.getAttribute("data-target") === hash
      || candidate.getAttribute("data-bs-target") === hash;
  }
  return true;
}

function safeWikiControllerElement(candidate: HTMLElement): boolean {
  if (candidate instanceof HTMLAnchorElement) {
    const href = candidate.getAttribute("href");
    return Boolean(href?.startsWith("#") && href.length > 1);
  }
  return candidate.matches('button, [role="tab"], [role="button"], .tabber__tab, .mw-collapsible-toggle');
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
  highlightEngine.clearElement(element);
  lastAutoScrolledLineTop = null;
}

function restoreOriginalBlock(element: HTMLElement): void {
  highlightEngine.restoreOriginalElement(element);
}

function prepareTokenizedBlock(element: HTMLElement, mode: "word" | "smooth"): HTMLElement[] {
  return highlightEngine.prepareTokens(element, mode, {
    textOverride: normalizeBlockText(element.innerText || element.textContent || ""),
    smoothReadableLength: true,
  });
}

function findCurrentToken(tokens: HTMLElement[], relativeIndex: number, charLength: number | null): HTMLElement | null {
  return highlightEngine.findCurrentToken(tokens, relativeIndex, charLength);
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
  textLength: number,
  snapToCurrent = false,
  charLength: number | null = null,
  boundaryElapsedTime: number | null = null,
): void {
  highlightEngine.paintSmooth(tokens, relativeIndex, {
    charLength,
    textLength,
    snapToCurrent,
    boundaryElapsedTime,
  });
}

function resetSmoothTokenFill(tokens: HTMLElement[]): void {
  highlightEngine.resetSmoothTokenFill(tokens);
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

function animateSmoothRange(tokens: HTMLElement[], token: HTMLElement, fromIndex: number, toIndex: number, durationMs: number): void {
  clearSmoothAnimation({ completePending: false });
  if (durationMs <= 0 || toIndex <= fromIndex) {
    snapSmoothAt(tokens, toIndex);
    return;
  }
  pendingSmoothAnimation = { tokens, token, toIndex };
  smoothAnimationFrame = window.requestAnimationFrame(() => {
    smoothAnimationFrame = null;
    if (!tokens.some((token) => token.isConnected)) return;
    smoothVisualIndex = Math.max(smoothVisualIndex, toIndex);
    token.style.setProperty("--post-reading-fill-duration", `${durationMs}ms`);
    token.style.setProperty("--post-reading-fill", `${rangeFillPercentForToken(token, toIndex)}%`);
    if (tokenStart(token) + tokenReadableLength(token) <= toIndex) token.dataset.postReadingSmoothFilled = "true";
    else delete token.dataset.postReadingSmoothFilled;
  });
  smoothAnimationTimer = window.setTimeout(() => {
    smoothAnimationTimer = null;
    pendingSmoothAnimation = null;
    if (!tokens.some((token) => token.isConnected)) return;
    snapSmoothAt(tokens, toIndex);
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
  highlightEngine.suspendSmoothTracking(relativeIndex);
  lastRelativeIndex = relativeIndex;
}

function clearSmoothAnimation(options: { completePending?: boolean } = {}): void {
  highlightEngine.clearSmoothAnimation(options);
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
  highlightEngine.resetSmoothTracking(rangeElement);
  lastRelativeIndex = null;
  activeSmoothRangeElement = rangeElement;
}

function updateBaselineReadingSpeed(speed: unknown): void {
  highlightEngine.updateBaselineReadingSpeed(speed);
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

function isWikiParentMessage(value: unknown): value is WikiHighlightMessage | WikiThemeMessage {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.type === "wikiSidebar:highlightBoundary"
    || record.type === "wikiSidebar:clearReadHighlight"
    || (record.type === "wikiSidebar:theme" && (record.theme === "light" || record.theme === "dark"));
}

function applySidebarTheme(message: WikiThemeMessage): void {
  const dark = message.enabled === true && message.theme === "dark";
  document.documentElement.dataset.milxdyWikiSidebarTheme = dark ? "dark" : "light";
  if (dark) {
    injectSidebarThemeStyles();
  }
}

function injectSidebarThemeStyles(): void {
  if (document.getElementById(THEME_STYLE_ID)) return;
  if (!document.head) {
    whenWikiDomReady(injectSidebarThemeStyles);
    return;
  }
  const style = document.createElement("style");
  style.id = THEME_STYLE_ID;
  style.textContent = `
    html[data-milxdy-wiki-sidebar-theme="dark"],
    html[data-milxdy-wiki-sidebar-theme="dark"] body {
      color-scheme: dark !important;
      background: #101116 !important;
      color: #eef0ff !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-page-container,
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-body,
    html[data-milxdy-wiki-sidebar-theme="dark"] .content,
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-body-content,
    html[data-milxdy-wiki-sidebar-theme="dark"] #content,
    html[data-milxdy-wiki-sidebar-theme="dark"] #mw-content-text,
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-parser-output,
    html[data-milxdy-wiki-sidebar-theme="dark"] .pre-content,
    html[data-milxdy-wiki-sidebar-theme="dark"] .page-heading,
    html[data-milxdy-wiki-sidebar-theme="dark"] .minerva__tab-container {
      background: #101116 !important;
      color: #eef0ff !important;
      border-color: #34384c !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] .header,
    html[data-milxdy-wiki-sidebar-theme="dark"] .minerva-header,
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-header,
    html[data-milxdy-wiki-sidebar-theme="dark"] .vector-header-container,
    html[data-milxdy-wiki-sidebar-theme="dark"] .vector-page-titlebar {
      background: #1b1d27 !important;
      color: #eef0ff !important;
      border-color: #34384c !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] h1,
    html[data-milxdy-wiki-sidebar-theme="dark"] h2,
    html[data-milxdy-wiki-sidebar-theme="dark"] h3,
    html[data-milxdy-wiki-sidebar-theme="dark"] h4,
    html[data-milxdy-wiki-sidebar-theme="dark"] h5,
    html[data-milxdy-wiki-sidebar-theme="dark"] h6,
    html[data-milxdy-wiki-sidebar-theme="dark"] p,
    html[data-milxdy-wiki-sidebar-theme="dark"] li,
    html[data-milxdy-wiki-sidebar-theme="dark"] td,
    html[data-milxdy-wiki-sidebar-theme="dark"] th,
    html[data-milxdy-wiki-sidebar-theme="dark"] figcaption {
      color: #eef0ff !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] a {
      color: #9cc2ff !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] a:visited {
      color: #d4b7ff !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] input,
    html[data-milxdy-wiki-sidebar-theme="dark"] textarea,
    html[data-milxdy-wiki-sidebar-theme="dark"] select,
    html[data-milxdy-wiki-sidebar-theme="dark"] button,
    html[data-milxdy-wiki-sidebar-theme="dark"] .cdx-button,
    html[data-milxdy-wiki-sidebar-theme="dark"] .cdx-text-input__input {
      background-color: #222533 !important;
      color: #eef0ff !important;
      border-color: #484e69 !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] table,
    html[data-milxdy-wiki-sidebar-theme="dark"] .wikitable,
    html[data-milxdy-wiki-sidebar-theme="dark"] .infobox,
    html[data-milxdy-wiki-sidebar-theme="dark"] .thumbinner,
    html[data-milxdy-wiki-sidebar-theme="dark"] .toc,
    html[data-milxdy-wiki-sidebar-theme="dark"] #toc {
      background-color: #191b24 !important;
      color: #eef0ff !important;
      border-color: #3f445c !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-parser-output blockquote,
    html[data-milxdy-wiki-sidebar-theme="dark"] code,
    html[data-milxdy-wiki-sidebar-theme="dark"] pre {
      background-color: #20232f !important;
      color: #eef0ff !important;
      border-color: #3f445c !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-editsection,
    html[data-milxdy-wiki-sidebar-theme="dark"] .reference,
    html[data-milxdy-wiki-sidebar-theme="dark"] .references,
    html[data-milxdy-wiki-sidebar-theme="dark"] .catlinks,
    html[data-milxdy-wiki-sidebar-theme="dark"] .printfooter,
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-footer {
      color: #bac0d9 !important;
      border-color: #34384c !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-footer,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer,
    html[data-milxdy-wiki-sidebar-theme="dark"] .minerva-footer,
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-body-footer,
    html[data-milxdy-wiki-sidebar-theme="dark"] .post-content.footer,
    html[data-milxdy-wiki-sidebar-theme="dark"] .last-modified-bar,
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-footer-container,
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-footer-info,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer-info,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer-places,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer-icons {
      background: #101116 !important;
      color: #bac0d9 !important;
      border-color: #34384c !important;
      box-shadow: none !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-footer h2,
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-footer h3,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer h2,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer h3,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer h2,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer h3,
    html[data-milxdy-wiki-sidebar-theme="dark"] .minerva-footer h2,
    html[data-milxdy-wiki-sidebar-theme="dark"] .minerva-footer h3,
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-footer li,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer li,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer li,
    html[data-milxdy-wiki-sidebar-theme="dark"] .minerva-footer li,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer-info li,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer-places li,
    html[data-milxdy-wiki-sidebar-theme="dark"] .last-modified-bar,
    html[data-milxdy-wiki-sidebar-theme="dark"] .last-modified-bar *,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer-info,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer-places,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer-license,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer-places-privacy,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer-places-desktop-toggle {
      color: #bac0d9 !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-footer ul,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer ul,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer ul,
    html[data-milxdy-wiki-sidebar-theme="dark"] .minerva-footer ul,
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-footer li,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer li,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer li,
    html[data-milxdy-wiki-sidebar-theme="dark"] .minerva-footer li {
      border-color: #34384c !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] .mw-footer a,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer a,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer a,
    html[data-milxdy-wiki-sidebar-theme="dark"] .minerva-footer a,
    html[data-milxdy-wiki-sidebar-theme="dark"] .last-modified-bar a,
    html[data-milxdy-wiki-sidebar-theme="dark"] #footer-places a,
    html[data-milxdy-wiki-sidebar-theme="dark"] .footer-places a {
      color: #9cc2ff !important;
    }
    html[data-milxdy-wiki-sidebar-theme="dark"] img,
    html[data-milxdy-wiki-sidebar-theme="dark"] video,
    html[data-milxdy-wiki-sidebar-theme="dark"] canvas {
      filter: none !important;
    }
  `;
  document.head.append(style);
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
  style.textContent = readingControlsStyles;
  document.head.append(style);
}

function handleWikiFrameClick(event: MouseEvent): void {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const target = event.target instanceof Element ? event.target : null;
  const link = target?.closest<HTMLAnchorElement>("a[href]");
  if (!link) return;
  if (isWikiDisclosureControl(link)) return;

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

function isWikiDisclosureControl(link: HTMLAnchorElement): boolean {
  const hashTarget = link.getAttribute("href");
  if (!hashTarget?.startsWith("#") || hashTarget.length < 2) return false;
  if (link.closest(".mw-collapsible-toggle")) return true;
  let targetId = hashTarget.slice(1);
  try {
    targetId = decodeURIComponent(targetId);
  } catch {
    return false;
  }
  const controlledIds = (link.getAttribute("aria-controls") || "").split(/\s+/).filter(Boolean);
  if (controlledIds.some((id) => document.getElementById(id)?.matches(EXPANDABLE_WIKI_CONTAINER_SELECTOR))) return true;
  const target = document.getElementById(targetId);
  if (target?.matches(EXPANDABLE_WIKI_CONTAINER_SELECTOR)) return true;
  return Boolean(link.matches('[role="tab"], .tabber__tab') || link.closest(".tabbernav, .tabber__tabs"));
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
