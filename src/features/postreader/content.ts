import { extractReadablePost, formatReadablePost } from "./extractText";
import { fetchEmbeddedQuote, fetchFullQuote } from "./fullQuote";
import { icon } from "./icons";
import { recognizeImageText, type OcrImage } from "./ocr";
import { MiniPlayer } from "./player";
import { ACTION_BUTTONS, POSTREADER_BUTTON, QUOTE_TWEET, TWEET, TWEET_PHOTO, TWEET_TEXT } from "./selectors";
import type { PostreaderSettings, ReadablePost } from "./shared/types";
import { playEndDing } from "./sounds";
import { SpeechController } from "./speech";
import { injectStyles } from "./styles";
import { loadSettings, loadVoiceBoundarySupport, observeSettings, saveSettings, saveVoiceBoundarySupport } from "./storage";
import { scheduleTwitterScan, subscribeTwitterSurfaces } from "../../shared/twitterScanner";

const processed = new WeakMap<HTMLElement, string>();
let settings: PostreaderSettings;
let speech: SpeechController;
let player: MiniPlayer;
let currentTweet: HTMLElement | null = null;
const pendingTweets = new Set<HTMLElement>();
let scanScheduled = false;
let userScrolledAt = 0;
let highlightedBodies = new Set<HTMLElement>();
let currentHighlightTargets: HighlightTarget[] = [];
let currentOcrSpeechRanges: Array<{ start: number; end: number }> = [];
let activeHighlightTarget: HighlightTarget | null = null;
let lastBoundaryAt: number | null = null;
let lastRelativeIndex: number | null = null;
let lastChunkIndex: number | null = null;
let calibratedCharsPerSecond = 13;
let smoothAnimationFrame: number | null = null;
let smoothVisualIndex = 0;
let currentOcrRunAbort: AbortController | null = null;
let currentOcrImageAbort: AbortController | null = null;
let currentQuoteFetchAbort: AbortController | null = null;
let currentFullQuoteBody: HTMLElement | null = null;
let activeReadRunId = 0;

type HighlightTarget = {
  body: HTMLElement;
  kind: "quote" | "main";
  start: number;
  end: number;
  text: string;
};

void boot();

async function boot(): Promise<void> {
  injectStyles();
  settings = await loadSettings();
  speech = new SpeechController(settings);
  player = new MiniPlayer(settings, {
    onPauseResume: () => speech.pauseOrResume(),
    onStop: () => {
      cancelOcr();
      clearFullQuotePreview();
      speech.stop();
    },
    onNext: () => nextTweetOrQuotingText(),
    onPrevious: () => playAdjacent(-1),
    onNextChunk: () => skipOcrOrNextChunk(),
    onPreviousChunk: () => previousChunkAndResyncHighlight(),
    onSettingsChange: (next) => {
      settings = next;
      speech.applySettings(next);
      player.updateSettings(next);
      void saveSettings(next);
    },
    onBoundarySupportChange: (results) => {
      void saveVoiceBoundarySupport(results);
    },
    getVoices: () => speech.getVoices(),
    getPreferredVoice: () => speech.getPreferredVoice(),
    probeBoundarySupport: (voice) => speech.probeBoundarySupport(voice),
  });
  void loadVoiceBoundarySupport().then((results) => player.setBoundarySupport(results));
  speech.subscribe((state) => {
    player.updateState(state);
    updateHighlight(state);
  });
  speech.onComplete(() => {
    if (settings.endOfTweetDing) void playEndDing(settings.volume);
    if (settings.autoplayNext) {
      window.setTimeout(() => playAdjacent(1), 150);
    }
  });

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => player.refreshVoices();
  }

  observeSettings((next) => {
    const placementChanged = settings.buttonPlacement !== next.buttonPlacement;
    clearBodyHighlight();
    settings = next;
    speech.applySettings(next);
    player.updateSettings(next);
    if (placementChanged) removeReadButtons();
    scheduleTwitterScan();
  });

  window.addEventListener("scroll", () => {
    userScrolledAt = Date.now();
  }, { passive: true });
  window.addEventListener("keydown", handleKeydown, true);

  subscribeTwitterSurfaces((surface) => {
    if (surface.kind !== "tweet") return;
    pendingTweets.add(surface.element);
    scheduleScan();
  });
  scheduleTwitterScan();
}

function scheduleScan(): void {
  if (scanScheduled) return;
  scanScheduled = true;
  queueMicrotask(() => {
    scanScheduled = false;
    processTweets();
  });
}

function processTweets(): void {
  if (!settings.enabled) return;
  const tweets = Array.from(pendingTweets);
  pendingTweets.clear();
  for (const tweet of tweets) {
    if (!tweet.isConnected) continue;
    processTweet(tweet);
  }
}

function removeReadButtons(): void {
  for (const button of Array.from(document.querySelectorAll(POSTREADER_BUTTON))) {
    button.remove();
  }
}

function processTweet(tweet: HTMLElement): void {
  if (tweet.querySelector(POSTREADER_BUTTON)) return;
  const readable = extractReadablePost(tweet, settings);
  const signature = readable ? formatReadablePost(readable, settings) : "";
  if (!signature) return;
  processed.set(tweet, signature);

  const button = createReadButton(tweet);
  const anchor = settings.buttonPlacement === "actions" ? null : findButtonAnchor(tweet);
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(button, anchor.nextSibling);
  } else {
    const footer = findLikelyActionRow(tweet);
    if (footer) footer.appendChild(button);
  }
}

function createReadButton(tweet: HTMLElement): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "postreader-button";
  button.dataset.postreaderButton = "true";
  button.setAttribute("aria-label", "Read aloud");
  button.title = "Read aloud";
  button.innerHTML = icon("speaker");
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    playTweet(tweet);
  });
  return button;
}

async function playTweet(tweet: HTMLElement): Promise<void> {
  clearBodyHighlight();
  clearFullQuotePreview();
  resetBoundaryCalibration();
  cancelOcr();
  const readRunId = ++activeReadRunId;
  if (settings.expandShowMore) await expandTweetText(tweet);
  if (readRunId !== activeReadRunId) return;
  const readable = extractReadablePost(tweet, settings);
  if (!readable) return;
  currentTweet = tweet;
  markActiveButton(tweet);
  await enrichFullQuote(readable);
  if (readRunId !== activeReadRunId) return;
  readable.imageTexts = await extractOcrTexts(tweet);
  if (readRunId !== activeReadRunId) return;
  const text = formatReadablePost(readable, settings);
  currentHighlightTargets = findHighlightTargets(tweet, text, readable);
  currentOcrSpeechRanges = findOcrSpeechRanges(text, readable.imageTexts);
  speech.speak(text, readable.authorDisplayName);
  tweet.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function skipOcrOrNextChunk(): void {
  if (currentQuoteFetchAbort) {
    currentQuoteFetchAbort.abort();
    return;
  }
  if (currentOcrImageAbort) {
    currentOcrImageAbort.abort();
    return;
  }
  if (skipActiveOcrSpeechRange()) return;
  speech.nextChunk();
  resyncHighlightAfterSpeechJump();
}

function previousChunkAndResyncHighlight(): void {
  speech.previousChunk();
  resyncHighlightAfterSpeechJump();
}

function resyncHighlightAfterSpeechJump(): void {
  clearSmoothAnimation();
  activeHighlightTarget = null;
  lastChunkIndex = null;
  lastBoundaryAt = null;
  lastRelativeIndex = null;
  smoothVisualIndex = 0;
  window.setTimeout(() => {
    updateHighlight(speech.getState());
  }, 0);
}

function skipActiveOcrSpeechRange(): boolean {
  const state = speech.getState();
  const currentIndex = state.charIndex ?? state.chunkStart;
  if (currentIndex === null || currentOcrSpeechRanges.length === 0) return false;
  const activeIndex = currentOcrSpeechRanges.findIndex((range) => currentIndex >= range.start && currentIndex < range.end);
  if (activeIndex < 0) return false;
  const nextRange = currentOcrSpeechRanges[activeIndex + 1];
  const target = nextRange?.start ?? currentOcrSpeechRanges[activeIndex].end + 1;
  speech.jumpToCharIndex(target);
  return true;
}

function cancelOcr(): void {
  activeReadRunId += 1;
  currentQuoteFetchAbort?.abort();
  currentOcrImageAbort?.abort();
  currentOcrRunAbort?.abort();
  currentQuoteFetchAbort = null;
  currentOcrImageAbort = null;
  currentOcrRunAbort = null;
  player?.updateOcrStatus(null);
}

async function enrichFullQuote(readable: ReadablePost): Promise<void> {
  const shouldFetchFullQuote = settings.fetchFullQuotes || settings.fullQuoteDisplay !== "hidden";
  if (!shouldFetchFullQuote) return;
  if (readable.quote?.text) {
    renderFullQuotePreview(readable.quote.text, "Quoted post preview");
  }
  if (!readable.quote) return;
  if (!readable.quote.url && !readable.url) {
    showTransientOcrStatus("No quoted post link found");
    return;
  }
  const abort = new AbortController();
  currentQuoteFetchAbort = abort;
  let keepTransientStatus = false;
  player.updateOcrStatus({ imageIndex: 0, imageCount: 1, status: quoteFetchStatus(readable.quote.url || readable.url || ""), progress: 0.2 });
  try {
    const embeddedQuote = readable.url ? await fetchEmbeddedQuote(readable.url, abort.signal) : null;
    if (embeddedQuote?.text && !looksLikeCurrentPostText(embeddedQuote.text, readable.text)) {
      readable.quote.authorDisplayName = embeddedQuote.authorDisplayName;
      readable.quote.text = embeddedQuote.text;
      readable.quote.url = embeddedQuote.url;
      renderFullQuotePreview(embeddedQuote.text, embeddedQuote.truncated ? "Quoted post preview" : "Full quoted post");
      keepTransientStatus = true;
      showTransientOcrStatus(embeddedQuote.truncated ? "Fetched quoted post preview" : "Fetched full quoted post");
    } else if (readable.quote.url) {
      const result = await fetchFullQuote(readable.quote.url, abort.signal);
      const directText = result.text;
      if (directText && directText !== readable.quote.text && !looksLikeCurrentPostText(directText, readable.text)) {
        readable.quote.text = directText;
        renderFullQuotePreview(directText, "Full quoted post");
        keepTransientStatus = true;
        showTransientOcrStatus("Fetched full quoted post");
      } else if (directText && looksLikeCurrentPostText(directText, readable.text)) {
        keepTransientStatus = true;
        showTransientOcrStatus("Quoted post link matched current post");
      } else {
        keepTransientStatus = true;
        showTransientOcrStatus(fullQuoteStatusText(result.status));
      }
    } else if (readable.url) {
      keepTransientStatus = true;
      showTransientOcrStatus("Quoted post text unavailable");
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      console.warn("Postreader quoted post fetch failed", error);
    }
  } finally {
    if (currentQuoteFetchAbort === abort) {
      currentQuoteFetchAbort = null;
      if (!keepTransientStatus) player.updateOcrStatus(null);
    }
  }
}

function fullQuoteStatusText(status: string): string {
  if (status === "http-error") return "Quoted post fetch failed";
  if (status === "no-text") return "Quoted post text unavailable";
  if (status === "bad-url") return "Quoted post link unavailable";
  return "Full quoted post unavailable";
}

function quoteFetchStatus(url: string): string {
  const id = url.match(/\/status\/(\d+)/)?.[1];
  return id ? `Fetching quoted post ${id}` : "Fetching quoted post";
}

function looksLikeCurrentPostText(fetchedText: string, currentText: string): boolean {
  const fetched = comparableText(fetchedText);
  const current = comparableText(currentText);
  if (!fetched || !current) return false;
  if (fetched === current) return true;
  if (current.length >= 32 && fetched.includes(current)) return true;
  if (fetched.length >= 32 && current.includes(fetched)) return true;
  return false;
}

function comparableText(value: string): string {
  return value.toLowerCase().replace(/https?:\/\/\S+/g, "").replace(/\s+/g, " ").trim();
}

function renderFullQuotePreview(fullText: string, labelText: string): void {
  if (!currentTweet || settings.fullQuoteDisplay === "hidden") return;
  clearFullQuotePreview();
  const quoteBody = getVisibleQuoteTweetBody(currentTweet);
  const quoteCard = findQuoteCard(currentTweet, quoteBody);
  if (!quoteCard) return;

  const preview = document.createElement("div");
  preview.className = "postreader-full-quote";
  preview.dataset.postreaderFullQuote = "true";
  preview.dataset.mode = settings.fullQuoteDisplay;

  const label = document.createElement("div");
  label.className = "postreader-full-quote-label";
  label.textContent = labelText;
  const body = document.createElement("div");
  body.className = "postreader-full-quote-body";
  body.dataset.postreaderFullQuoteBody = "true";
  renderFormattedFullQuoteText(body, fullText);
  requestWikiHyperlinks(body);
  preview.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  preview.append(label, body);

  if (settings.fullQuoteDisplay === "scroll") {
    quoteBody?.setAttribute("data-postreader-preview-hidden", "true");
  }
  quoteCard.append(preview);
  currentFullQuoteBody = body;
}

function requestWikiHyperlinks(container: HTMLElement): void {
  document.dispatchEvent(new CustomEvent("remilia-wiki-hyperlink:process-container", {
    detail: { container },
  }));
}

function renderFormattedFullQuoteText(container: HTMLElement, text: string): void {
  container.replaceChildren();
  const blocks = text.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) {
    container.textContent = text;
    return;
  }

  for (const [blockIndex, block] of blocks.entries()) {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length > 1 && lines.every((line) => isBulletLine(line))) {
      const list = document.createElement("ul");
      list.className = "postreader-full-quote-list";
      for (const [lineIndex, line] of lines.entries()) {
        const item = document.createElement("li");
        item.textContent = line;
        list.append(item);
        if (lineIndex < lines.length - 1) list.append(document.createTextNode("\n"));
      }
      container.append(list);
      if (blockIndex < blocks.length - 1) container.append(document.createTextNode("\n\n"));
      continue;
    }

    for (const [index, line] of lines.entries()) {
      const paragraph = document.createElement("p");
      paragraph.className = "postreader-full-quote-paragraph";
      paragraph.textContent = line;
      container.append(paragraph);
      if (index < lines.length - 1) container.append(document.createTextNode("\n"));
      if (index < lines.length - 1) paragraph.dataset.tight = "true";
    }
    if (blockIndex < blocks.length - 1) container.append(document.createTextNode("\n\n"));
  }
}

function isBulletLine(line: string): boolean {
  return /^[\-*•]\s+/.test(line);
}

function findQuoteCard(tweet: HTMLElement, quoteBody: HTMLElement | null): HTMLElement | null {
  return quoteBody?.closest<HTMLElement>(QUOTE_TWEET)
    || quoteBody?.closest<HTMLElement>('a[href*="/status/"], div[role="link"]')
    || Array.from(tweet.querySelectorAll<HTMLElement>('a[href*="/status/"], div[role="link"]')).find((element) => {
      if (element.closest('[data-testid="User-Name"]')) return false;
      return Boolean(element.querySelector(TWEET_TEXT));
    })
    || quoteBody?.parentElement
    || null;
}

function clearFullQuotePreview(): void {
  for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-postreader-full-quote="true"]'))) {
    element.remove();
  }
  for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-postreader-preview-hidden="true"]'))) {
    element.removeAttribute("data-postreader-preview-hidden");
  }
  currentFullQuoteBody = null;
}

async function extractOcrTexts(tweet: HTMLElement): Promise<string[]> {
  if (!settings.includeImageOcr) return [];
  player.updateOcrStatus({ imageIndex: 0, imageCount: 1, status: "Checking images for OCR", progress: 0.02 });
  const images = findOcrImages(tweet);
  if (images.length === 0) {
    showTransientOcrStatus("No attached image found for OCR");
    return [];
  }

  const runAbort = new AbortController();
  currentOcrRunAbort = runAbort;
  const texts: string[] = [];
  let failureStatus: string | null = null;
  player.updateOcrStatus({ imageIndex: 0, imageCount: images.length, status: "Found image for OCR", progress: 0.04 });

  try {
    for (const [index, image] of images.entries()) {
      if (runAbort.signal.aborted) break;
      const imageAbort = new AbortController();
      currentOcrImageAbort = imageAbort;
      const combinedSignal = combineAbortSignals(runAbort.signal, imageAbort.signal);
      const text = await recognizeImageText(image, index, images.length, combinedSignal, (progress) => {
        if (!combinedSignal.aborted) player.updateOcrStatus(normalizeOcrProgress(progress));
      }).catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError" && imageAbort.signal.aborted && !runAbort.signal.aborted) {
          player.updateOcrStatus({ imageIndex: index, imageCount: images.length, status: "Skipped image OCR", progress: 1 });
          return "";
        }
        throw error;
      }).finally(() => {
        if (currentOcrImageAbort === imageAbort) currentOcrImageAbort = null;
      });
      if (text) texts.push(text);
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      console.warn("Postreader OCR failed", error);
      failureStatus = ocrErrorMessage(error);
    }
  } finally {
    if (currentOcrRunAbort === runAbort) {
      currentOcrRunAbort = null;
      currentOcrImageAbort = null;
      if (failureStatus) {
        showTransientOcrStatus(failureStatus);
      } else {
        player.updateOcrStatus(null);
      }
    }
  }

  return runAbort.signal.aborted ? [] : texts;
}

function combineAbortSignals(runSignal: AbortSignal, imageSignal: AbortSignal): AbortSignal {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (runSignal.aborted || imageSignal.aborted) {
    abort();
  } else {
    runSignal.addEventListener("abort", abort, { once: true });
    imageSignal.addEventListener("abort", abort, { once: true });
  }
  return controller.signal;
}

function normalizeOcrProgress(progress: { imageIndex: number; imageCount: number; status: string; progress: number | null }): typeof progress {
  if (progress.progress === null) return progress;
  return { ...progress, progress: Math.max(0, Math.min(1, progress.progress)) };
}

function ocrErrorMessage(error: unknown): string {
  if (error instanceof DOMException) return `OCR failed: ${error.name}${error.message ? ` - ${error.message}` : ""}`;
  if (error instanceof Error && error.message) return `OCR failed: ${error.message.slice(0, 80)}`;
  return "OCR failed";
}

function findOcrImages(tweet: HTMLElement): OcrImage[] {
  const values = new Map<string, OcrImage>();
  for (const media of Array.from(tweet.querySelectorAll<HTMLElement>(TWEET_PHOTO))) {
    for (const image of Array.from(media.querySelectorAll<HTMLImageElement>("img[src]"))) {
      addOcrImage(values, image);
    }
  }
  if (values.size === 0) {
    for (const image of Array.from(tweet.querySelectorAll<HTMLImageElement>("img[src]"))) {
      addOcrImage(values, image);
    }
  }
  return Array.from(values.values());
}

function addOcrImage(values: Map<string, OcrImage>, image: HTMLImageElement): void {
  const src = image.currentSrc || image.src;
  if (!isLikelyTweetAttachment(image, src)) return;
  values.set(normalizeImageSrc(src), { src: normalizeImageSrc(src), alt: image.alt || "" });
}

function isLikelyTweetAttachment(image: HTMLImageElement, src: string): boolean {
  if (!/^https:\/\/pbs\.twimg\.com\//i.test(src)) return false;
  if (/\/profile_images\//i.test(src)) return false;
  if (/\/emoji\//i.test(src)) return false;
  if (isVideoThumbnail(image)) return false;
  if (image.closest('[data-testid="User-Name"], [data-testid="card.wrapper"]')) return false;
  const rect = image.getBoundingClientRect();
  const width = Math.max(rect.width, image.naturalWidth || 0, image.width || 0);
  const height = Math.max(rect.height, image.naturalHeight || 0, image.height || 0);
  return width >= 80 && height >= 80;
}

function isVideoThumbnail(image: HTMLImageElement): boolean {
  const container = image.closest<HTMLElement>('[data-testid*="video" i], [aria-label*="video" i], [aria-label*="play" i], [role="button"]');
  if (!container) return false;
  const text = `${container.getAttribute("aria-label") || ""} ${container.textContent || ""}`.toLowerCase();
  return /\b(video|play|watch)\b|(\d{1,2}:)?\d{1,2}:\d{2}/.test(text);
}

function normalizeImageSrc(src: string): string {
  try {
    const url = new URL(src);
    if (url.hostname === "pbs.twimg.com" && url.pathname.startsWith("/media/")) {
      url.searchParams.set("name", "large");
    }
    return url.toString();
  } catch {
    return src;
  }
}

function showTransientOcrStatus(status: string): void {
  player.updateOcrStatus({ imageIndex: 0, imageCount: 1, status, progress: null });
  window.setTimeout(() => {
    if (!currentOcrRunAbort) player.updateOcrStatus(null);
  }, 1400);
}

function playAdjacent(direction: 1 | -1): void {
  const tweets = visibleTweets();
  if (tweets.length === 0) return;
  const currentIndex = currentTweet ? tweets.indexOf(currentTweet) : -1;
  const candidates = direction === 1 ? tweets.slice(currentIndex + 1) : tweets.slice(0, Math.max(0, currentIndex)).reverse();
  const next = candidates.find((tweet) => !settings.skipPromotedPosts || !isPromotedTweet(tweet));
  if (next) {
    playTweet(next);
    next.scrollIntoView({ block: "center", behavior: "smooth" });
    return;
  }
  if (direction === 1 && settings.autoplayMode === "autoscroll" && Date.now() - userScrolledAt > 750) {
    window.scrollBy({ top: Math.round(window.innerHeight * 0.8), behavior: "smooth" });
    window.setTimeout(() => {
      scheduleScan();
      const refreshed = visibleTweets();
      const candidate = refreshed.find((tweet) => tweet !== currentTweet && tweet.getBoundingClientRect().top > 0 && (!settings.skipPromotedPosts || !isPromotedTweet(tweet)));
      if (candidate) playTweet(candidate);
    }, 900);
  }
}

function nextTweetOrQuotingText(): void {
  if (jumpFromQuoteToMainText()) return;
  playAdjacent(1);
}

function jumpFromQuoteToMainText(): boolean {
  const state = speech.getState();
  if (state.status !== "speaking" && state.status !== "paused") return false;
  const currentIndex = state.charIndex ?? state.chunkStart;
  if (currentIndex === null) return false;
  const active = currentHighlightTargets.find((target) => currentIndex >= target.start && currentIndex <= target.end);
  if (active?.kind !== "quote") return false;
  const main = currentHighlightTargets.find((target) => target.kind === "main");
  if (!main) return false;
  speech.jumpToCharIndex(main.start);
  resyncHighlightAfterSpeechJump();
  currentTweet?.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (event.key === "Escape") {
    cancelOcr();
    speech.stop();
    event.preventDefault();
    event.stopPropagation();
    return;
  }
  if (target?.closest('input, textarea, select, [contenteditable="true"]')) return;
  const keybind = eventToKeybind(event);
  if (!keybind) return;

  const normalized = normalizeKeybind(keybind);
  const actions: Array<[string, () => void]> = [
    [settings.keyNextTweet, () => nextTweetOrQuotingText()],
    [settings.keyPreviousTweet, () => playAdjacent(-1)],
    [settings.keyNextChunk, () => skipOcrOrNextChunk()],
    [settings.keyPreviousChunk, () => previousChunkAndResyncHighlight()],
    [settings.keySkipOcr, () => skipOcrOrNextChunk()],
    [settings.keyPlayPause, () => speech.pauseOrResume()],
  ];
  const action = actions.find(([candidate]) => normalizeKeybind(candidate) === normalized)?.[1];
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  action();
}

function eventToKeybind(event: KeyboardEvent): string | null {
  const key = normalizeKey(event.key);
  if (!key) return null;
  const parts = [];
  if (event.ctrlKey) parts.push("Ctrl");
  if (event.altKey) parts.push("Alt");
  if (event.shiftKey) parts.push("Shift");
  if (event.metaKey) parts.push("Meta");
  parts.push(key);
  return parts.join("+");
}

function normalizeKey(key: string): string | null {
  if (["Control", "Alt", "Shift", "Meta"].includes(key)) return null;
  if (key === " ") return "Space";
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function normalizeKeybind(value: string): string {
  return value.split("+").map((part) => normalizeKeybindPart(part.trim())).filter(Boolean).join("+");
}

function normalizeKeybindPart(value: string): string {
  const lower = value.toLowerCase();
  if (lower === "control" || lower === "ctrl") return "Ctrl";
  if (lower === "option" || lower === "alt") return "Alt";
  if (lower === "shift") return "Shift";
  if (lower === "cmd" || lower === "command" || lower === "meta") return "Meta";
  if (lower === "space" || value === " ") return "Space";
  return value.length === 1 ? value.toUpperCase() : value;
}

function visibleTweets(): HTMLElement[] {
  const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
  return Array.from(document.querySelectorAll<HTMLElement>(TWEET)).filter((tweet) => {
    const rect = tweet.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < viewportHeight;
  });
}

function isPromotedTweet(tweet: HTMLElement): boolean {
  const text = (tweet.innerText || tweet.textContent || "").toLowerCase();
  return /\bpromoted\b/.test(text) || /\bad\b/.test(text);
}

function findButtonAnchor(tweet: HTMLElement): HTMLElement | null {
  if (settings.buttonPlacement === "top") {
    const grok = findGrokButton(tweet);
    return grok || findTopControl(tweet);
  }
  if (settings.buttonPlacement === "auto") {
    const grok = findGrokButton(tweet);
    if (grok) return grok;
    const top = findTopControl(tweet);
    if (top) return top;
  }
  const buttons = Array.from(tweet.querySelectorAll<HTMLElement>(ACTION_BUTTONS));
  return buttons.at(-1) || null;
}

function findGrokButton(tweet: HTMLElement): HTMLElement | null {
  return Array.from(tweet.querySelectorAll<HTMLElement>('button, [role="button"], a')).find((button) => {
    return (button.getAttribute("aria-label") || "").toLowerCase().includes("grok");
  }) || null;
}

function findTopControl(tweet: HTMLElement): HTMLElement | null {
  const userName = tweet.querySelector<HTMLElement>('[data-testid="User-Name"]');
  if (!userName) return null;
  const header = userName.closest<HTMLElement>('[data-testid="User-Name"]')?.parentElement?.parentElement;
  const controls = Array.from((header || tweet).querySelectorAll<HTMLElement>('button, [role="button"], a')).filter((element) => {
    if (element.closest(POSTREADER_BUTTON)) return false;
    if (element.closest('[data-testid="reply"], [data-testid="retweet"], [data-testid="like"], [data-testid="share"]')) return false;
    return element.getBoundingClientRect().width > 0;
  });
  return controls.at(-1) || null;
}

function findLikelyActionRow(tweet: HTMLElement): HTMLElement | null {
  const reply = tweet.querySelector<HTMLElement>('[data-testid="reply"]');
  return reply?.parentElement?.parentElement || reply?.parentElement || null;
}

async function expandTweetText(tweet: HTMLElement): Promise<void> {
  const buttons = Array.from(tweet.querySelectorAll<HTMLElement>('button, [role="button"]'));
  const showMore = buttons.find((button) => {
    const text = (button.innerText || button.textContent || "").trim().toLowerCase();
    const label = (button.getAttribute("aria-label") || "").trim().toLowerCase();
    return text === "show more" || label === "show more";
  });
  if (!showMore) return;
  showMore.click();
  await new Promise((resolve) => window.setTimeout(resolve, 250));
}

function markActiveButton(tweet: HTMLElement): void {
  for (const article of Array.from(document.querySelectorAll<HTMLElement>(TWEET))) {
    article.dataset.postreaderActive = article === tweet ? "true" : "false";
    article.dataset.postreaderActiveBackground = String(article === tweet && settings.activeTweetHighlight);
  }
  for (const button of Array.from(document.querySelectorAll<HTMLButtonElement>(POSTREADER_BUTTON))) {
    button.setAttribute("aria-pressed", button.closest(TWEET) === tweet ? "true" : "false");
  }
}

function updateHighlight(state: { status: string; chunkIndex: number; chunkStart: number | null; charIndex: number | null; charLength: number | null }): void {
  if (state.status === "idle") {
    clearBodyHighlight();
    clearActiveTweets();
    lastChunkIndex = null;
    return;
  }
  if (state.status === "error") {
    clearHighlightVisuals();
    clearActiveTweets();
    lastChunkIndex = null;
    return;
  }
  if (currentTweet) {
    currentTweet.dataset.postreaderActive = "true";
    currentTweet.dataset.postreaderActiveBackground = String(settings.activeTweetHighlight);
  }
  if (!currentTweet || settings.bodyHighlightMode === "off") return;
  if (currentHighlightTargets.length === 0) {
    return;
  }
  const chunkChanged = lastChunkIndex !== null && state.chunkIndex !== lastChunkIndex;
  lastChunkIndex = state.chunkIndex;
  const absoluteIndex = state.charIndex ?? state.chunkStart;
  if (absoluteIndex === null) return;

  const target = findActiveHighlightTarget(absoluteIndex);
  if (!target) {
    return;
  }
  const body = target.body;
  const relativeIndex = absoluteIndex - target.start;
  const targetChanged = activeHighlightTarget !== target;
  activateHighlightTarget(target);

  if (settings.bodyHighlightMode === "word") {
    const words = prepareWordBody(body);
    const currentWord = findNearestToken(words, relativeIndex);
    for (const word of words) word.dataset.postreaderCurrentWord = String(word === currentWord);
    scrollFullQuoteWordIntoView(currentWord);
    return;
  }

  const words = prepareSmoothBody(body);
  const currentWord = findNearestToken(words, relativeIndex);
  const highlightJumped = targetChanged || didHighlightJump(relativeIndex, chunkChanged);
  const previousIndex = highlightJumped ? null : lastRelativeIndex;
  updateBoundaryCalibration(relativeIndex);
  paintSmoothTokens(words, currentWord, relativeIndex, previousIndex, target.text.length, highlightJumped);
  scrollFullQuoteWordIntoView(currentWord);
}

function didHighlightJump(relativeIndex: number, chunkChanged: boolean): boolean {
  if (chunkChanged || lastRelativeIndex === null) return true;
  if (relativeIndex < lastRelativeIndex) return true;
  const expectedLead = Math.max(18, calibratedCharsPerSecond * 1.25);
  return relativeIndex - lastRelativeIndex > expectedLead;
}

function clearActiveTweets(): void {
  for (const article of Array.from(document.querySelectorAll<HTMLElement>(TWEET))) {
    article.dataset.postreaderActive = "false";
    article.dataset.postreaderActiveBackground = "false";
  }
}

function getTweetBodies(tweet: HTMLElement): HTMLElement[] {
  return Array.from(tweet.querySelectorAll<HTMLElement>(TWEET_TEXT));
}

function getMainTweetBody(tweet: HTMLElement): HTMLElement | null {
  const bodies = getTweetBodies(tweet);
  return bodies.find((body) => !body.closest(QUOTE_TWEET)) || bodies[0] || null;
}

function getQuoteTweetBody(tweet: HTMLElement): HTMLElement | null {
  const injected = tweet.querySelector<HTMLElement>('[data-postreader-full-quote-body="true"]');
  if (injected) return injected;
  return getVisibleQuoteTweetBody(tweet);
}

function getVisibleQuoteTweetBody(tweet: HTMLElement): HTMLElement | null {
  const bodies = Array.from(tweet.querySelectorAll<HTMLElement>(TWEET_TEXT));
  return bodies.find((body) => Boolean(body.closest(QUOTE_TWEET))) || bodies.find((_, index) => index > 0) || null;
}

function clearBodyHighlight(): void {
  clearHighlightVisuals();
  for (const body of highlightedBodies) {
    if (isFullQuoteBody(body)) {
      delete body.dataset.postreaderOriginalHtml;
      continue;
    }
    if (body.dataset.postreaderOriginalHtml) {
      body.innerHTML = body.dataset.postreaderOriginalHtml;
      delete body.dataset.postreaderOriginalHtml;
    }
  }
  highlightedBodies = new Set();
  activeHighlightTarget = null;
  currentHighlightTargets = [];
}

function clearHighlightVisuals(): void {
  clearSmoothAnimation();
  for (const word of Array.from(document.querySelectorAll<HTMLElement>('[data-postreader-word="true"]'))) {
    delete word.dataset.postreaderCurrentWord;
  }
  for (const word of Array.from(document.querySelectorAll<HTMLElement>('[data-postreader-smooth-word="true"]'))) {
    delete word.dataset.postreaderSmoothFilled;
    word.style.removeProperty("--postreader-fill");
    word.style.removeProperty("--postreader-fill-duration");
  }
  activeHighlightTarget = null;
}

function scrollFullQuoteWordIntoView(word: HTMLElement | null): void {
  if (!word) return;
  const container = word.closest<HTMLElement>('.postreader-full-quote[data-mode="scroll"] .postreader-full-quote-body');
  if (!container) return;
  const wordRect = word.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offset = wordRect.top - containerRect.top - container.clientHeight / 2 + wordRect.height / 2;
  container.scrollTop += offset;
}

function saveOriginalBody(body: HTMLElement): void {
  if (isFullQuoteBody(body)) {
    highlightedBodies.add(body);
    return;
  }
  if (!body.dataset.postreaderOriginalHtml) {
    body.dataset.postreaderOriginalHtml = body.innerHTML;
  }
  highlightedBodies.add(body);
}

function prepareSmoothBody(body: HTMLElement): HTMLElement[] {
  const existing = Array.from(body.querySelectorAll<HTMLElement>('[data-postreader-smooth-word="true"]'));
  if (existing.length > 0) return existing;
  return prepareTokenizedBody(body, "smooth");
}

function prepareWordBody(body: HTMLElement): HTMLElement[] {
  const existing = Array.from(body.querySelectorAll<HTMLElement>('[data-postreader-word="true"]'));
  if (existing.length > 0) return existing;
  return prepareTokenizedBody(body, "word");
}

function prepareTokenizedBody(body: HTMLElement, mode: "word" | "smooth"): HTMLElement[] {
  saveOriginalBody(body);
  const words: HTMLElement[] = [];
  let index = 0;
  let textCursor = 0;
  const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.TEXT_NODE && node.textContent) textNodes.push(node as Text);
  }

  for (const node of textNodes) {
    if (!node.textContent?.trim()) {
      textCursor += node.textContent?.length || 0;
      continue;
    }
    const fragment = document.createDocumentFragment();
    const parts = mode === "smooth"
      ? buildSmoothParts(node.textContent || "")
      : node.textContent?.match(/\S+|\s+/g) || [];
    for (const part of parts) {
      if (/^\s+$/.test(part) && mode === "word") {
        fragment.appendChild(document.createTextNode(part));
        textCursor += part.length;
      } else {
        const span = document.createElement("span");
        if (mode === "word") {
          span.dataset.postreaderWord = "true";
        } else {
          span.dataset.postreaderSmoothWord = "true";
          span.dataset.postreaderTokenKind = /^\s+$/.test(part) ? "space" : "word";
        }
        span.dataset.postreaderWordIndex = String(index++);
        span.dataset.postreaderStart = String(textCursor);
        span.dataset.postreaderLength = String(part.length);
        span.textContent = part;
        words.push(span);
        fragment.appendChild(span);
        textCursor += part.length;
      }
    }
    node.parentNode?.replaceChild(fragment, node);
  }
  return words;
}

function findHighlightTargets(tweet: HTMLElement, spokenText: string, post: ReadablePost): HighlightTarget[] {
  const targets: HighlightTarget[] = [];
  const quoteBody = post.quote ? getQuoteTweetBody(tweet) : null;
  const quoteRange = post.quote && quoteBody ? findBodyRange(spokenText, post.quote.text, "first") : null;
  if (quoteBody && quoteRange) {
    targets.push({ body: quoteBody, kind: "quote", ...quoteRange });
  }

  const mainBody = post.text ? getMainTweetBody(tweet) : null;
  const mainRange = post.text && mainBody ? findBodyRange(spokenText, post.text, "last") : null;
  if (mainBody && mainRange) {
    targets.push({ body: mainBody, kind: "main", ...mainRange });
  }

  return targets.sort((left, right) => left.start - right.start);
}

function findOcrSpeechRanges(spokenText: string, imageTexts: string[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let cursor = 0;
  for (const text of imageTexts) {
    const clean = text.trim();
    if (!clean) continue;
    const quoted = `"${clean}"`;
    const quotedStart = spokenText.indexOf(quoted, cursor);
    const start = quotedStart >= 0 ? quotedStart : spokenText.indexOf(clean, cursor);
    if (start < 0) continue;
    const textStart = quotedStart >= 0 ? quotedStart + 1 : start;
    const textEnd = textStart + clean.length;
    const segmentStart = findOcrSegmentStart(spokenText, start);
    ranges.push({ start: segmentStart, end: textEnd + (quotedStart >= 0 ? 1 : 0) });
    cursor = textEnd;
  }
  return ranges;
}

function findOcrSegmentStart(spokenText: string, textStart: number): number {
  const prefixStart = spokenText.lastIndexOf(" image says ", textStart);
  if (prefixStart < 0) return textStart;
  const sentenceStart = Math.max(
    spokenText.lastIndexOf(". ", prefixStart),
    spokenText.lastIndexOf("! ", prefixStart),
    spokenText.lastIndexOf("? ", prefixStart),
  );
  return sentenceStart >= 0 ? sentenceStart + 2 : prefixStart;
}

function findActiveHighlightTarget(charIndex: number): HighlightTarget | null {
  return currentHighlightTargets.find((target) => charIndex >= target.start && charIndex <= target.end) || null;
}

function activateHighlightTarget(target: HighlightTarget): void {
  if (activeHighlightTarget === target) return;
  restoreInactiveHighlightBodies(target.body);
  activeHighlightTarget = target;
  lastBoundaryAt = null;
  lastRelativeIndex = null;
  smoothVisualIndex = 0;
  resetSmoothTokenFill(Array.from(target.body.querySelectorAll<HTMLElement>('[data-postreader-smooth-word="true"]')));
}

function restoreInactiveHighlightBodies(activeBody: HTMLElement): void {
  for (const body of Array.from(highlightedBodies)) {
    if (body === activeBody) continue;
    if (isFullQuoteBody(body)) {
      for (const word of Array.from(body.querySelectorAll<HTMLElement>('[data-postreader-word="true"]'))) {
        delete word.dataset.postreaderCurrentWord;
      }
      highlightedBodies.delete(body);
      continue;
    }
    if (body.dataset.postreaderOriginalHtml) {
      body.innerHTML = body.dataset.postreaderOriginalHtml;
      delete body.dataset.postreaderOriginalHtml;
    }
    highlightedBodies.delete(body);
  }
}

function isFullQuoteBody(body: HTMLElement): boolean {
  return Boolean(body.closest('[data-postreader-full-quote="true"]'));
}

function findBodyRange(spokenText: string, bodyText: string, occurrence: "first" | "last"): { start: number; end: number; text: string } | null {
  const text = bodyText.trim();
  if (!text) return null;
  const quoted = `"${text}"`;
  const quotedStart = occurrence === "first" ? spokenText.indexOf(quoted) : spokenText.lastIndexOf(quoted);
  let start = quotedStart >= 0 ? quotedStart + 1 : occurrence === "first" ? spokenText.indexOf(text) : spokenText.lastIndexOf(text);
  if (start < 0) {
    start = findNormalizedRangeStart(spokenText, text, occurrence);
  }
  if (start < 0) return null;
  return { start, end: start + text.length, text };
}

function findNormalizedRangeStart(haystack: string, needle: string, occurrence: "first" | "last"): number {
  const collapsedNeedle = needle.replace(/\s+/g, " ").trim();
  if (!collapsedNeedle) return -1;
  const pattern = collapsedNeedle
    .split(" ")
    .map((part) => escapeRegExp(part))
    .join("\\s+");
  const match = haystack.match(new RegExp(pattern, "g"));
  if (!match || match.length === 0) return -1;
  const selected = occurrence === "first" ? match[0] : match[match.length - 1];
  return occurrence === "first" ? haystack.indexOf(selected) : haystack.lastIndexOf(selected);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function findNearestToken(words: HTMLElement[], relativeIndex: number): HTMLElement | null {
  let nearest: HTMLElement | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const word of words) {
    const start = Number(word.dataset.postreaderStart || 0);
    const length = Number(word.dataset.postreaderLength || word.textContent?.length || 0);
    const end = start + length;
    if (relativeIndex >= start && relativeIndex <= end) return word;
    const distance = relativeIndex < start ? start - relativeIndex : relativeIndex - end;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = word;
    }
  }
  return nearest || words[0] || null;
}

function paintSmoothTokens(
  tokens: HTMLElement[],
  currentToken: HTMLElement | null,
  relativeIndex: number,
  previousRelativeIndex: number | null,
  textLength: number,
  snapToCurrent = false,
): void {
  clearSmoothAnimation();
  if (snapToCurrent) {
    smoothVisualIndex = relativeIndex;
    resetSmoothTokenFill(tokens);
    paintSmoothAt(tokens, relativeIndex);
  }
  const animationStart = previousRelativeIndex === null ? relativeIndex : Math.max(0, Math.min(previousRelativeIndex, relativeIndex));
  const visualStart = Math.max(animationStart, Math.min(relativeIndex, smoothVisualIndex));
  const predictedNextBoundary = findNextBoundaryIndex(tokens, relativeIndex);
  const minimumLead = Math.round(calibratedCharsPerSecond * 0.18);
  const animationEnd = Math.min(textLength, Math.max(visualStart, predictedNextBoundary, relativeIndex + minimumLead));
  const duration = Math.max(80, estimateTokenDurationMs(Math.max(1, animationEnd - visualStart || tokenLength(currentToken))));
  paintSmoothAt(tokens, visualStart);
  animateSmoothRange(tokens, visualStart, animationEnd, duration);
}

function resetSmoothTokenFill(tokens: HTMLElement[]): void {
  for (const token of tokens) {
    delete token.dataset.postreaderSmoothFilled;
    token.style.removeProperty("--postreader-fill");
    token.style.removeProperty("--postreader-fill-duration");
  }
}

function paintSmoothAt(tokens: HTMLElement[], cursorIndex: number): void {
  smoothVisualIndex = Math.max(smoothVisualIndex, cursorIndex);
  for (const token of tokens) {
    const start = Number(token.dataset.postreaderStart || 0);
    const length = tokenLength(token);
    const end = start + length;

    if (end <= cursorIndex) {
      token.dataset.postreaderSmoothFilled = "true";
      token.style.removeProperty("--postreader-fill");
      token.style.removeProperty("--postreader-fill-duration");
      continue;
    }

    delete token.dataset.postreaderSmoothFilled;

    if (cursorIndex >= start && cursorIndex < end) {
      const value = rangeFillPercentForToken(token, cursorIndex);
      token.style.setProperty("--postreader-fill-duration", "0ms");
      token.style.setProperty("--postreader-fill", `${value}%`);
    } else {
      token.style.removeProperty("--postreader-fill-duration");
      token.style.removeProperty("--postreader-fill");
    }
  }
}

function animateSmoothRange(tokens: HTMLElement[], fromIndex: number, toIndex: number, durationMs: number): void {
  const startedAt = performance.now();
  const step = (now: number) => {
    if (!tokens.some((token) => token.isConnected)) return;
    const progress = Math.min(1, (now - startedAt) / Math.max(1, durationMs));
    const cursor = fromIndex + (toIndex - fromIndex) * progress;
    paintSmoothAt(tokens, cursor);
    if (progress < 1) {
      smoothAnimationFrame = window.requestAnimationFrame(step);
    } else {
      smoothAnimationFrame = null;
    }
  };
  smoothAnimationFrame = window.requestAnimationFrame(step);
}

function clearSmoothAnimation(): void {
  if (smoothAnimationFrame !== null) {
    window.cancelAnimationFrame(smoothAnimationFrame);
    smoothAnimationFrame = null;
  }
}

function updateBoundaryCalibration(relativeIndex: number): void {
  const now = performance.now();
  if (lastBoundaryAt !== null && lastRelativeIndex !== null && relativeIndex > lastRelativeIndex) {
    const elapsedSeconds = Math.max(0.05, (now - lastBoundaryAt) / 1000);
    const observed = (relativeIndex - lastRelativeIndex) / elapsedSeconds;
    if (Number.isFinite(observed) && observed > 1 && observed < 80) {
      calibratedCharsPerSecond = calibratedCharsPerSecond * 0.72 + observed * 0.28;
    }
  }
  lastBoundaryAt = now;
  lastRelativeIndex = relativeIndex;
}

function resetBoundaryCalibration(): void {
  lastBoundaryAt = null;
  lastRelativeIndex = null;
  calibratedCharsPerSecond = 13 * Math.max(0.5, settings.speed);
  smoothVisualIndex = 0;
}

function estimateTokenDurationMs(length: number): number {
  const cps = Math.max(4, calibratedCharsPerSecond);
  return Math.max(60, Math.min(1200, Math.round((Math.max(1, length) / cps) * 1000)));
}

function buildSmoothParts(text: string): string[] {
  const raw = text.match(/\s*[\p{L}\p{N}_'-]+[^\s\p{L}\p{N}_'-]*|\s+|[^\s\p{L}\p{N}_'-]+/gu) || [];
  const parts: string[] = [];
  for (const part of raw) {
    if (!part) continue;
    const last = parts[parts.length - 1];
    if (/^\s+$/.test(part) && last && !/\s$/.test(last)) {
      parts[parts.length - 1] += part;
    } else {
      parts.push(part);
    }
  }
  return parts;
}

function tokenStart(token: HTMLElement | null): number {
  return Number(token?.dataset.postreaderStart || 0);
}

function tokenLength(token: HTMLElement | null): number {
  return Number(token?.dataset.postreaderLength || token?.textContent?.length || 0);
}

function rangeFillPercentForToken(token: HTMLElement, rangeIndex: number): number {
  const start = tokenStart(token);
  const length = Math.max(1, tokenLength(token));
  return Math.max(0, Math.min(100, ((rangeIndex - start) / length) * 100));
}

function findNextBoundaryIndex(tokens: HTMLElement[], relativeIndex: number): number {
  const sorted = [...tokens].sort((left, right) => tokenStart(left) - tokenStart(right));
  const current = findNearestToken(sorted, relativeIndex);
  if (!current) return relativeIndex;
  const currentIndex = sorted.indexOf(current);
  for (const token of sorted.slice(currentIndex + 1)) {
    if (token.dataset.postreaderTokenKind !== "space") {
      return tokenStart(token);
    }
  }
  return tokenStart(current) + tokenLength(current);
}
