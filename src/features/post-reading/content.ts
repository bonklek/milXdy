import { extractReadablePost, formatReadablePost, isReadableHyperlink } from "./extractText";
import { fetchEmbeddedQuote, fetchFullQuote } from "./fullQuote";
import { icon } from "./icons";
import { recognizeImageText, type OcrImage } from "./ocr";
import { MiniPlayer } from "./player";
import { ACTION_BUTTONS, POST_READING_BUTTON, QUOTE_TWEET, TWEET, TWEET_PHOTO, TWEET_TEXT } from "./selectors";
import type { BodyHighlightMode, PostReadingSettings, ReadablePost } from "./shared/types";
import { playEndDing } from "./sounds";
import { SpeechController } from "./speech";
import { injectStyles } from "./styles";
import { loadSettings, loadVoiceBoundarySupport, observeSettings, saveSettings, saveVoiceBoundarySupport } from "./storage";
import { createOverlayAppFrame, type OverlayAppFrame } from "../../shared/overlayAppFrame";
import type { TwitterSurface } from "../../shared/twitterScanner";
import { recordFeatureTiming } from "../../shared/performanceDiagnostics";
import type { AppRuntimeScheduler, MilxdyContentAppContext } from "../../shared/appPlatform";
import { createFallbackRuntimeScheduler } from "../../shared/runtimeScheduler";

const processed = new WeakMap<HTMLElement, string>();
let settings: PostReadingSettings;
let speech: SpeechController;
let player: MiniPlayer;
let wikiSpeech: SpeechController;
let wikiPlayer: MiniPlayer;
let appFrame: OverlayAppFrame | null = null;
let currentTweet: HTMLElement | null = null;
const pendingTweets = new Map<HTMLElement, { actionRow: HTMLElement | null; textContainers: HTMLElement[] }>();
const POST_READING_BUTTON_SLOT = '[data-post-reading-button-slot="true"]';
const RUNTIME_POST_READING_SLOT = '[data-milxdy-tweet-slot="post-reading-action"]';
const RUNTIME_POST_READING_HEADER_SLOT = '[data-milxdy-tweet-slot="post-reading-header-action"]';
let scanScheduled = false;
let userScrolledAt = 0;
let highlightedBodies = new Set<HTMLElement>();
const activeTweets = new Set<HTMLElement>();
const activeReadButtons = new Set<HTMLButtonElement>();
let currentHighlightTargets: HighlightTarget[] = [];
let currentOcrSpeechRanges: OcrSpeechRange[] = [];
let activeHighlightTarget: HighlightTarget | null = null;
let lastBoundaryAt: number | null = null;
let lastRelativeIndex: number | null = null;
let lastChunkIndex: number | null = null;
let calibratedCharsPerSecond = 13;
let smoothAnimationFrame: number | null = null;
let smoothAnimationTimer: number | null = null;
let smoothVisualIndex = 0;
let estimatedHighlightFrame: number | null = null;
let estimatedHighlightKey = "";
let estimatedHighlightStartedAt = 0;
let estimatedHighlightPausedAt: number | null = null;
let lastHighlightDiagnosticSignature = "";
let lastSmoothAnimationDiagnosticSignature = "";
let currentOcrRunAbort: AbortController | null = null;
let currentOcrImageAbort: AbortController | null = null;
let currentQuoteFetchAbort: AbortController | null = null;
let currentFullQuoteBody: HTMLElement | null = null;
const fullQuotePreviews = new Set<HTMLElement>();
const fullQuoteHiddenBodies = new Set<HTMLElement>();
let activeReadRunId = 0;
let wikiCompletionPending = false;
let ocrReadingStatusActive = false;
let booted = false;
let runtimeScheduleScan: () => void = () => undefined;
let cancelPendingScan: (() => void) | null = null;
let recordRuntimeDiagnostic: MilxdyContentAppContext["recordDiagnostic"] = () => undefined;
let lifecycleSignal: AbortSignal | null = null;
let runtimeScheduler: AppRuntimeScheduler = createFallbackRuntimeScheduler({ idleTimeoutMs: 16 });

type PostReadingPerformancePolicy = {
  batchSize: number;
  maxPendingTweets: number;
  maxTextCharsForButton: number;
};

type HighlightTarget = {
  body: HTMLElement;
  kind: "quote" | "main";
  start: number;
  end: number;
  text: string;
};

type OcrSpeechRange = {
  start: number;
  end: number;
  imageIndex: number;
  imageCount: number;
};

type WikiReadableDocument = {
  id: string;
  title: string;
  text: string;
  source: "wiki";
};

type WikiHighlightMessage = {
  type: "wikiSidebar:highlightBoundary" | "wikiSidebar:clearReadHighlight";
  articleId?: string;
  charIndex?: number;
  charLength?: number | null;
  boundaryElapsedTime?: number | null;
  mode?: BodyHighlightMode;
  hasSyncedBoundaries?: boolean;
  autoScroll?: boolean;
  speechRate?: number;
  status?: string;
};

type HighlightSpeechState = {
  status: string;
  text?: string;
  chunkIndex: number;
  chunkCount: number;
  chunkStart: number | null;
  charIndex: number | null;
  charLength: number | null;
  hasSyncedBoundaries: boolean;
};

let activeWikiDocument: WikiReadableDocument | null = null;
let wikiPlayerSlot: HTMLElement | null = null;

export async function boot(context?: MilxdyContentAppContext): Promise<void> {
  if (booted) return;
  booted = true;
  lifecycleSignal = context?.signal || null;
  runtimeScheduleScan = context?.scheduleScan || runtimeScheduleScan;
  runtimeScheduler = context?.scheduler || runtimeScheduler;
  recordRuntimeDiagnostic = context?.recordDiagnostic || recordRuntimeDiagnostic;
  const addDisposable = context?.addDisposable || (() => undefined);
  injectStyles();
  settings = await loadSettings();
  document.documentElement.dataset.milxdyPostReadingButtonPlacement = settings.buttonPlacement;
  speech = new SpeechController(settings);
  player = new MiniPlayer(settings, {
    onPauseResume: () => {
      pauseWikiReader();
      speech.pauseOrResume();
    },
    onStop: () => {
      cancelOcr();
      clearFullQuotePreview();
      speech.stop();
    },
    onNext: () => nextTweetOrQuotingText(),
    onPrevious: () => playAdjacent(-1),
    onNextChunk: () => nextChunkAndResyncHighlight(),
    onPreviousChunk: () => previousChunkAndResyncHighlight(),
    onSkipOcr: () => skipOcrLoadingOrActiveSpeech(),
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
  wikiSpeech = new SpeechController(settings);
  wikiPlayer = new MiniPlayer(settings, {
    onPauseResume: () => {
      pauseTweetReader();
      wikiSpeech.pauseOrResume();
    },
    onStop: () => {
      wikiSpeech.stop();
      clearWikiDocumentSession();
    },
    onNext: () => {
      void jumpWikiParagraph(1, wikiSpeech);
    },
    onPrevious: () => {
      void jumpWikiParagraph(-1, wikiSpeech);
    },
    onNextChunk: () => nextChunkAndResyncHighlight(wikiSpeech),
    onPreviousChunk: () => previousChunkAndResyncHighlight(wikiSpeech),
    onSkipOcr: () => undefined,
    onSettingsChange: (next) => {
      settings = next;
      speech.applySettings(next);
      wikiSpeech.applySettings(next);
      player.updateSettings(next);
      wikiPlayer.updateSettings(next);
      void saveSettings(next);
    },
    onBoundarySupportChange: (results) => {
      void saveVoiceBoundarySupport(results);
    },
    getVoices: () => wikiSpeech.getVoices(),
    getPreferredVoice: () => wikiSpeech.getPreferredVoice(),
    probeBoundarySupport: (voice) => wikiSpeech.probeBoundarySupport(voice),
  });
  appFrame = createOverlayAppFrame({
    id: "post-reading",
    label: "Post-reading",
    icon: postReadingDockIcon(),
    title: "Post-reading controls",
    isOpen: () => player.isVisible(),
    onOpen: () => {
      player.show();
      updateDockState();
    },
    onClose: () => {
      player.close();
      updateDockState();
    },
    onSideChange: () => player.applyFrameLayout(),
  });
  player.setAppFrame(appFrame);
  void loadVoiceBoundarySupport().then((results) => {
    if (lifecycleActive()) {
      player.setBoundarySupport(results);
      wikiPlayer.setBoundarySupport(results);
    }
  });
  addDisposable(speech.subscribe((state) => {
    player.updateState(state);
    updateTweetHighlight(state);
    updateDockState();
  }));
  addDisposable(wikiSpeech.subscribe((state) => {
    wikiPlayer.updateState(state);
    updateWikiDocumentHighlight(state);
  }));
  speech.onComplete(() => {
    if (!lifecycleActive()) return;
    if (settings.endOfTweetDing) void playEndDing(settings.volume);
    if (settings.autoplayNext) {
      runtimeScheduler.timeout(() => {
        if (lifecycleActive()) playAdjacent(1);
      }, 150);
    }
  });
  wikiSpeech.onComplete(() => {
    if (!lifecycleActive()) return;
    if (settings.endOfTweetDing) void playEndDing(settings.volume);
    if (wikiCompletionPending) {
      wikiCompletionPending = false;
    }
  });
  addDisposable(() => speech.onComplete(null));
  addDisposable(() => wikiSpeech.onComplete(null));

  if ("speechSynthesis" in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      player.refreshVoices();
      wikiPlayer.refreshVoices();
    };
    addDisposable(() => {
      window.speechSynthesis.onvoiceschanged = null;
    });
  }

  addDisposable(observeSettings((next) => {
    const placementChanged = settings.buttonPlacement !== next.buttonPlacement;
    clearBodyHighlight();
    settings = next;
    document.documentElement.dataset.milxdyPostReadingButtonPlacement = settings.buttonPlacement;
    speech.applySettings(next);
    wikiSpeech.applySettings(next);
    player.updateSettings(next);
    wikiPlayer.updateSettings(next);
    if (placementChanged) removeReadButtons();
    runtimeScheduleScan();
  }));

  const scrollListener = () => {
    userScrolledAt = Date.now();
  };
  window.addEventListener("scroll", scrollListener, { passive: true });
  addDisposable(() => window.removeEventListener("scroll", scrollListener));
  window.addEventListener("keydown", handleKeydown, true);
  addDisposable(() => window.removeEventListener("keydown", handleKeydown, true));

  const readDocumentListener = (event: Event) => {
    const detail = (event as CustomEvent<unknown>).detail;
    if (isWikiReadableDocument(detail)) playReadableDocument(detail);
  };
  const stopWikiDocumentListener = () => {
    if (!activeWikiDocument) return;
    wikiSpeech.stop();
    clearWikiDocumentSession();
  };
  document.addEventListener("post-reading:read-document", readDocumentListener);
  document.addEventListener("post-reading:stop-wiki-document", stopWikiDocumentListener);
  addDisposable(() => {
    document.removeEventListener("post-reading:read-document", readDocumentListener);
    document.removeEventListener("post-reading:stop-wiki-document", stopWikiDocumentListener);
  });

  runtimeScheduleScan();
}

export function onSurface(surface: TwitterSurface): void {
  if (!lifecycleActive() || surface.kind !== "tweet") return;
  const policy = postReadingPerformancePolicy();
  if (pendingTweets.size >= policy.maxPendingTweets && !pendingTweets.has(surface.element)) return;
  pendingTweets.set(surface.element, { actionRow: surface.actionRow, textContainers: surface.textContainers });
  scheduleScan();
}

export function disable(): void {
  if (settings) settings = { ...settings, enabled: false };
  cancelOcr();
  clearWikiDocumentSession();
  clearFullQuotePreview();
  clearBodyHighlight();
  clearActiveTweets();
  speech?.stop();
  wikiSpeech?.stop();
  player?.close();
  wikiPlayer?.close();
  removeReadButtons();
}

export function open(): void {
  player?.show();
  updateDockState();
}

export function close(): void {
  player?.close();
  updateDockState();
}

export function dispose(): void {
  disable();
  cancelPendingScan?.();
  cancelPendingScan = null;
  pendingTweets.clear();
  appFrame?.remove();
  appFrame = null;
  recordRuntimeDiagnostic = () => undefined;
  lifecycleSignal = null;
  booted = false;
}

function lifecycleActive(): boolean {
  return booted && settings?.enabled !== false && lifecycleSignal?.aborted !== true;
}

function postReadingDockIcon(): string {
  return chrome.runtime.getURL("post-reading/post-reading-logo.png");
}

function updateDockState(): void {
  if (!appFrame || !player || !speech) return;
  const state = speech.getState();
  const status = state.status === "speaking"
    ? "Speaking"
    : state.status === "paused"
      ? "Paused"
      : state.status === "error"
        ? "Error"
        : "Ready";
  appFrame.updateDock({
    active: player.isVisible(),
    badgeText: state.status === "speaking" ? "ON" : state.status === "paused" ? "II" : state.status === "error" ? "!" : "",
    title: state.title ? `Post-reading: ${status} - ${state.title}` : `Post-reading: ${status}`,
  });
}

function scheduleScan(): void {
  if (!lifecycleActive() || scanScheduled || cancelPendingScan) return;
  scanScheduled = true;
  cancelPendingScan = runtimeScheduler.idle(() => {
    cancelPendingScan = null;
    scanScheduled = false;
    if (!lifecycleActive()) return;
    processTweets();
  }, { timeout: 700 });
}

function processTweets(): void {
  if (!lifecycleActive()) return;
  const policy = postReadingPerformancePolicy();
  const tweets = Array.from(pendingTweets.entries()).slice(0, policy.batchSize);
  for (const [tweet] of tweets) pendingTweets.delete(tweet);
  for (const [tweet, surface] of tweets) {
    if (!lifecycleActive() || !tweet.isConnected) continue;
    const startedAt = performance.now();
    processTweet(tweet, surface.actionRow, policy, surface.textContainers);
    recordFeatureTiming("post-reading", "processTweet", startedAt);
  }
  if (pendingTweets.size > 0) scheduleScan();
}

function removeReadButtons(): void {
  for (const button of Array.from(document.querySelectorAll(POST_READING_BUTTON))) {
    button.remove();
  }
  for (const slot of Array.from(document.querySelectorAll(POST_READING_BUTTON_SLOT))) {
    if ((slot as HTMLElement).dataset.milxdyTweetSlot) continue;
    slot.remove();
  }
  activeReadButtons.clear();
}

function processTweet(
  tweet: HTMLElement,
  surfaceActionRow: HTMLElement | null = null,
  policy = postReadingPerformancePolicy(),
  surfaceTextContainers: HTMLElement[] = [],
): void {
  if (tweet.querySelector(POST_READING_BUTTON)) return;
  const textContainers = surfaceTextContainers.length > 0 && surfaceTextContainers.every((container) => container.isConnected)
    ? surfaceTextContainers
    : Array.from(tweet.querySelectorAll<HTMLElement>(TWEET_TEXT))
      .filter((container) => !container.closest(QUOTE_TWEET));
  const signature = textContainers.map((container) => container.textContent || "").join("\n").trim();
  if (!signature) return;
  if (processed.get(tweet) === signature) return;
  if (signature.length > policy.maxTextCharsForButton) {
    processed.set(tweet, signature);
    recordRuntimeDiagnostic("buttonSkipped", {
      reason: "performanceTextCap",
      mode: currentPerformanceMode(),
      textLength: signature.length,
      updatedAt: Date.now(),
    });
    return;
  }
  processed.set(tweet, signature);

  const button = createReadButton(tweet);
  const footer = surfaceActionRow || findLikelyActionRow(tweet);
  const anchor = findButtonAnchor(tweet, footer);
  if (settings.buttonPlacement === "actions") {
    insertActionOverlayButton(button, anchor, footer);
    return;
  }
  if (insertHeaderSlotButton(tweet, button)) return;
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(button, anchor.nextSibling);
  }
}

function currentPerformanceMode(): string {
  return document.documentElement.dataset.milxdyPerformanceMode || "balanced";
}

function postReadingPerformancePolicy(): PostReadingPerformancePolicy {
  const mode = currentPerformanceMode();
  if (mode === "fast") {
    return { batchSize: 2, maxPendingTweets: 16, maxTextCharsForButton: 900 };
  }
  if (mode === "balanced") {
    return { batchSize: 4, maxPendingTweets: 36, maxTextCharsForButton: 1800 };
  }
  if (mode === "developer") {
    return { batchSize: 16, maxPendingTweets: 160, maxTextCharsForButton: Number.POSITIVE_INFINITY };
  }
  return { batchSize: 8, maxPendingTweets: 96, maxTextCharsForButton: Number.POSITIVE_INFINITY };
}

function createReadButton(tweet: HTMLElement): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "post-reading-button";
  button.dataset.postReadingButton = "true";
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

function insertActionOverlayButton(button: HTMLButtonElement, anchor: HTMLElement | null, footer: HTMLElement | null): void {
  const runtimeSlot = footer?.querySelector<HTMLElement>(RUNTIME_POST_READING_SLOT)
    || anchor?.parentElement?.querySelector<HTMLElement>(RUNTIME_POST_READING_SLOT)
    || null;
  if (runtimeSlot) {
    runtimeSlot.replaceChildren(button);
    runtimeSlot.removeAttribute("aria-hidden");
    return;
  }
  const slot = document.createElement("span");
  slot.dataset.postReadingButtonSlot = "true";
  slot.className = "post-reading-button-slot";
  slot.append(button);
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(slot, anchor.nextSibling);
    return;
  }
  footer?.append(slot);
}

function insertHeaderSlotButton(tweet: HTMLElement, button: HTMLButtonElement): boolean {
  const runtimeSlot = tweet.querySelector<HTMLElement>(RUNTIME_POST_READING_HEADER_SLOT);
  if (!runtimeSlot) return false;
  runtimeSlot.replaceChildren(button);
  runtimeSlot.removeAttribute("aria-hidden");
  markHeaderControlHost(runtimeSlot);
  return true;
}

function markHeaderControlHost(slot: HTMLElement): void {
  let host = slot.parentElement;
  for (let depth = 0; host && depth < 5; depth += 1, host = host.parentElement) {
    const buttons = Array.from(host.querySelectorAll<HTMLElement>('button, [role="button"]'));
    const hasTweetControl = buttons.some((button) => {
      const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("data-testid") || ""}`.toLowerCase();
      return label.includes("grok") || label.includes("caret") || label.includes("more");
    });
    if (!hasTweetControl || !host.contains(slot)) continue;
    host.dataset.milxdyPostReadingHeaderControls = "true";
    return;
  }
}

async function playTweet(tweet: HTMLElement): Promise<void> {
  if (!lifecycleActive()) return;
  pauseWikiReader();
  clearBodyHighlight();
  clearFullQuotePreview();
  resetBoundaryCalibration();
  cancelOcr();
  const readRunId = ++activeReadRunId;
  if (settings.expandShowMore) await expandTweetText(tweet);
  if (!lifecycleActive() || readRunId !== activeReadRunId) return;
  const readable = extractReadablePost(tweet, settings);
  if (!readable) return;
  currentTweet = tweet;
  markActiveButton(tweet);
  await enrichFullQuote(readable);
  if (!lifecycleActive() || readRunId !== activeReadRunId) return;
  readable.imageTexts = await extractOcrTexts(tweet);
  if (!lifecycleActive() || readRunId !== activeReadRunId) return;
  const text = formatReadablePost(readable, settings);
  currentHighlightTargets = findHighlightTargets(tweet, text, readable);
  currentOcrSpeechRanges = findOcrSpeechRanges(text, readable.imageTexts);
  speech.speak(text, readable.authorDisplayName);
  tweet.scrollIntoView({ block: "nearest", inline: "nearest" });
}

function playReadableDocument(target: WikiReadableDocument): void {
  if (!lifecycleActive() || target.source !== "wiki") return;
  const text = target.text.trim();
  if (!text) return;
  activeReadRunId += 1;
  cancelOcr();
  pauseTweetReader();
  activeWikiDocument = { ...target, text };
  attachPlayerToWikiSlot();
  wikiSpeech.speak(text, target.title || "Remilia Wiki");
  wikiPlayer.show();
  dispatchWikiReaderState(true);
}

function skipOcrLoadingOrActiveSpeech(): void {
  if (currentOcrImageAbort) {
    currentOcrImageAbort.abort();
    return;
  }
  if (skipActiveOcrSpeechRange()) return;
}

function pauseTweetReader(): void {
  if (speech?.getState().status === "speaking") speech.pauseOrResume();
}

function pauseWikiReader(): void {
  if (wikiSpeech?.getState().status === "speaking") wikiSpeech.pauseOrResume();
}

function nextChunkAndResyncHighlight(controller = speech): void {
  if (!lifecycleActive()) return;
  controller.nextChunk();
  resyncHighlightAfterSpeechJump(controller);
}

function previousChunkAndResyncHighlight(controller = speech): void {
  if (!lifecycleActive()) return;
  controller.previousChunk();
  resyncHighlightAfterSpeechJump(controller);
}

function jumpWikiParagraph(direction: 1 | -1, controller = wikiSpeech): boolean {
  if (!activeWikiDocument) return false;
  const state = controller.getState();
  if (state.status !== "speaking" && state.status !== "paused") return false;
  const currentIndex = state.charIndex ?? state.chunkStart ?? 0;
  const target = direction === 1
    ? nextParagraphStart(activeWikiDocument.text, currentIndex)
    : previousParagraphStart(activeWikiDocument.text, currentIndex);
  if (target === null || target === currentIndex) return false;
  controller.jumpToCharIndex(target);
  resyncHighlightAfterSpeechJump(controller);
  return true;
}

function nextParagraphStart(text: string, currentIndex: number): number | null {
  const from = Math.min(text.length, Math.max(0, currentIndex + 1));
  const match = /\n{2,}\s*/g;
  match.lastIndex = from;
  const next = match.exec(text);
  return next ? Math.min(text.length, next.index + next[0].length) : null;
}

function previousParagraphStart(text: string, currentIndex: number): number | null {
  const before = text.slice(0, Math.max(0, currentIndex - 1));
  let previous: RegExpExecArray | null = null;
  const matcher = /\n{2,}\s*/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(before))) previous = match;
  return previous ? previous.index + previous[0].length : 0;
}

function resyncHighlightAfterSpeechJump(controller = speech): void {
  clearSmoothAnimation();
  activeHighlightTarget = null;
  lastChunkIndex = null;
  lastBoundaryAt = null;
  lastRelativeIndex = null;
  smoothVisualIndex = 0;
  window.setTimeout(() => {
    if (!lifecycleActive()) return;
    if (controller === wikiSpeech) updateWikiDocumentHighlight(controller.getState());
    else updateTweetHighlight(controller.getState());
  }, 0);
}

function skipActiveOcrSpeechRange(): boolean {
  const state = speech.getState();
  const currentIndex = state.charIndex ?? state.chunkStart;
  if (currentIndex === null || currentOcrSpeechRanges.length === 0) return false;
  const activeIndex = currentOcrSpeechRanges.findIndex((range) => currentIndex >= range.start && currentIndex < range.end);
  if (activeIndex < 0) return false;
  const activeRange = currentOcrSpeechRanges[activeIndex];
  const main = currentHighlightTargets.find((target) => target.kind === "main" && target.start >= activeRange.end);
  const target = main?.start ?? activeRange.end + 1;
  speech.jumpToCharIndex(target);
  resyncHighlightAfterSpeechJump();
  currentTweet?.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function updateOcrSkipAvailability(currentIndex: number | null): void {
  if (currentOcrImageAbort) {
    player?.setOcrSkipAvailable(true);
    return;
  }
  const activeRange = currentIndex === null
    ? null
    : currentOcrSpeechRanges.find((range) => currentIndex >= range.start && currentIndex < range.end) || null;
  if (activeRange) {
    ocrReadingStatusActive = true;
    player?.updateOcrStatus({
      imageIndex: activeRange.imageIndex,
      imageCount: activeRange.imageCount,
      status: "Reading image OCR text",
      progress: null,
    });
    player?.setOcrSkipAvailable(true);
  } else if (ocrReadingStatusActive && !currentOcrRunAbort && !currentOcrImageAbort) {
    ocrReadingStatusActive = false;
    player?.updateOcrStatus(null);
  } else {
    player?.setOcrSkipAvailable(false);
  }
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
  player?.setOcrSkipAvailable(false);
  ocrReadingStatusActive = false;
}

async function enrichFullQuote(readable: ReadablePost): Promise<void> {
  const shouldFetchFullQuote = settings.fetchFullQuotes || settings.fullQuoteDisplay !== "hidden";
  if (!shouldFetchFullQuote) return;
  let previewText = readable.quote?.text || "";
  if (readable.quote?.text) {
    renderFullQuotePreview(readable.quote.text, "Quoted post preview");
    recordFullQuoteDiagnostic("preview", {
      status: "fallback",
      textLength: readable.quote.text.length,
      reason: "initial-preview",
    });
  }
  if (!readable.quote) return;
  if (!readable.quote.url && !readable.url) {
    showTransientOcrStatus("No quoted post link found");
    recordFullQuoteDiagnostic("missing-url", { status: "fallback" });
    return;
  }
  const abort = new AbortController();
  currentQuoteFetchAbort = abort;
  const removeLifecycleAbort = abortOnLifecycleSignal(abort);
  let keepTransientStatus = false;
  player.updateOcrStatus({ imageIndex: 0, imageCount: 1, status: quoteFetchStatus(readable.quote.url || readable.url || ""), progress: 0.2 });
  try {
    const embeddedQuote = readable.url ? await fetchEmbeddedQuote(readable.url, abort.signal) : null;
    if (!lifecycleActive() || abort.signal.aborted) return;
    if (embeddedQuote?.text && !looksLikeCurrentPostText(embeddedQuote.text, readable.text)) {
      readable.quote.authorDisplayName = embeddedQuote.authorDisplayName;
      readable.quote.text = embeddedQuote.text;
      readable.quote.url = embeddedQuote.url;
      previewText = embeddedQuote.text;
      renderFullQuotePreview(embeddedQuote.text, embeddedQuote.truncated ? "Quoted post preview" : "Full quoted post");
      keepTransientStatus = true;
      showTransientOcrStatus(embeddedQuote.truncated ? "Fetched quoted post preview" : "Fetched full quoted post");
      recordFullQuoteDiagnostic("embedded", {
        status: embeddedQuote.truncated ? "preview" : "ok",
        textLength: embeddedQuote.text.length,
        url: embeddedQuote.url,
        truncated: embeddedQuote.truncated,
      });
    }
    const directQuoteUrl = readable.quote.url;
    const shouldFetchDirectQuote = Boolean(
      directQuoteUrl
      && (
        settings.fetchFullQuotes
        || settings.fullQuoteDisplay === "scroll"
        || !embeddedQuote?.text
        || embeddedQuote.truncated
      ),
    );
    if (shouldFetchDirectQuote && directQuoteUrl) {
      const result = await fetchFullQuote(directQuoteUrl, abort.signal);
      if (!lifecycleActive() || abort.signal.aborted) return;
      const directText = result.text;
      if (directText && isBetterQuoteText(directText, previewText || readable.quote.text) && !looksLikeCurrentPostText(directText, readable.text)) {
        readable.quote.text = directText;
        renderFullQuotePreview(directText, "Full quoted post");
        keepTransientStatus = true;
        showTransientOcrStatus("Fetched full quoted post");
        recordFullQuoteDiagnostic("direct", {
          status: result.status,
          used: true,
          textLength: directText.length,
          previousLength: previewText.length,
          url: directQuoteUrl,
        });
      } else if (directText && looksLikeCurrentPostText(directText, readable.text)) {
        keepTransientStatus = true;
        showTransientOcrStatus("Quoted post link matched current post");
        recordFullQuoteDiagnostic("direct", {
          status: "fallback",
          used: false,
          reason: "matched-current-post",
          textLength: directText.length,
          url: directQuoteUrl,
        });
      } else if (directText) {
        keepTransientStatus = true;
        showTransientOcrStatus(embeddedQuote?.truncated || !embeddedQuote?.text ? "Using quoted post preview" : "Using fetched quoted post text");
        recordFullQuoteDiagnostic("direct", {
          status: "fallback",
          used: false,
          reason: "not-better-than-preview",
          textLength: directText.length,
          previousLength: previewText.length,
          url: directQuoteUrl,
        });
      } else {
        keepTransientStatus = true;
        showTransientOcrStatus(previewText ? "Using quoted post preview" : fullQuoteStatusText(result.status));
        recordFullQuoteDiagnostic("direct", {
          status: result.status,
          used: false,
          reason: "no-direct-text",
          previousLength: previewText.length,
          url: directQuoteUrl,
        });
      }
    } else if (readable.url && !embeddedQuote?.text) {
      keepTransientStatus = true;
      showTransientOcrStatus("Quoted post text unavailable");
      recordFullQuoteDiagnostic("embedded", {
        status: "fallback",
        reason: "no-embedded-text",
        url: readable.url,
      });
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      console.warn("Post-reading quoted post fetch failed", error);
      keepTransientStatus = true;
      showTransientOcrStatus("Quoted post fetch failed");
      recordFullQuoteDiagnostic("error", {
        status: "error",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  } finally {
    removeLifecycleAbort();
    if (currentQuoteFetchAbort === abort) {
      currentQuoteFetchAbort = null;
      if (!keepTransientStatus && lifecycleActive()) player.updateOcrStatus(null);
    }
  }
}

function isBetterQuoteText(candidate: string, previous: string): boolean {
  const next = candidate.trim();
  const current = previous.trim();
  if (!next) return false;
  if (!current) return true;
  if (next === current) return false;
  const normalizedNext = comparableText(next);
  const normalizedCurrent = comparableText(current);
  if (normalizedNext === normalizedCurrent) return false;
  if (normalizedNext.length > normalizedCurrent.length + 24) return true;
  if (looksTruncatedPreview(current) && normalizedNext.length > normalizedCurrent.length) return true;
  return false;
}

function looksTruncatedPreview(value: string): boolean {
  return /(\.\.\.|\u2026)$/.test(value.trim()) || /\shttps?:\/\/t\.co\/\S*$/i.test(value.trim());
}

function recordFullQuoteDiagnostic(stage: string, details: Record<string, unknown>): void {
  recordRuntimeDiagnostic("fullQuote", {
    stage,
    ...details,
    displayMode: settings.fullQuoteDisplay,
    fetchFullQuotes: settings.fetchFullQuotes,
    updatedAt: Date.now(),
  });
}

function abortOnLifecycleSignal(controller: AbortController): () => void {
  const signal = lifecycleSignal;
  if (!signal) return () => undefined;
  const abort = () => controller.abort();
  if (signal.aborted) {
    abort();
    return () => undefined;
  }
  signal.addEventListener("abort", abort, { once: true });
  return () => signal.removeEventListener("abort", abort);
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
  preview.className = "post-reading-full-quote";
  preview.dataset.postReadingFullQuote = "true";
  preview.dataset.mode = settings.fullQuoteDisplay;

  const label = document.createElement("div");
  label.className = "post-reading-full-quote-label";
  label.textContent = labelText;
  const body = document.createElement("div");
  body.className = "post-reading-full-quote-body";
  body.dataset.postReadingFullQuoteBody = "true";
  renderFormattedFullQuoteText(body, fullText);
  requestWikiHyperlinks(body);
  preview.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  preview.append(label, body);

  if (settings.fullQuoteDisplay === "scroll") {
    if (quoteBody) {
      quoteBody.setAttribute("data-post-reading-preview-hidden", "true");
      fullQuoteHiddenBodies.add(quoteBody);
    }
  }
  quoteCard.append(preview);
  fullQuotePreviews.add(preview);
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
      list.className = "post-reading-full-quote-list";
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
      paragraph.className = "post-reading-full-quote-paragraph";
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
  for (const element of Array.from(fullQuotePreviews)) {
    element.remove();
    fullQuotePreviews.delete(element);
  }
  for (const element of Array.from(fullQuoteHiddenBodies)) {
    element.removeAttribute("data-post-reading-preview-hidden");
    fullQuoteHiddenBodies.delete(element);
  }
  currentFullQuoteBody = null;
}

async function extractOcrTexts(tweet: HTMLElement): Promise<string[]> {
  if (!lifecycleActive()) return [];
  if (!settings.includeImageOcr) return [];
  player.updateOcrStatus({ imageIndex: 0, imageCount: 1, status: "Checking images for OCR", progress: 0.02 });
  const images = findOcrImages(tweet);
  if (images.length === 0) {
    showTransientOcrStatus("No attached image found for OCR");
    return [];
  }

  const runAbort = new AbortController();
  currentOcrRunAbort = runAbort;
  const removeLifecycleAbort = abortOnLifecycleSignal(runAbort);
  const texts: string[] = [];
  let failureStatus: string | null = null;
  player.updateOcrStatus({ imageIndex: 0, imageCount: images.length, status: "Found image for OCR", progress: 0.04 });

  try {
    for (const [index, image] of images.entries()) {
      if (!lifecycleActive() || runAbort.signal.aborted) break;
      const imageAbort = new AbortController();
      currentOcrImageAbort = imageAbort;
      const combinedSignal = combineAbortSignals(runAbort.signal, imageAbort.signal);
      const text = await recognizeImageText(image, index, images.length, combinedSignal, (progress) => {
        if (lifecycleActive() && !combinedSignal.aborted) player.updateOcrStatus(normalizeOcrProgress(progress));
      }).catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError" && imageAbort.signal.aborted && !runAbort.signal.aborted && lifecycleActive()) {
          player.updateOcrStatus({ imageIndex: index, imageCount: images.length, status: "Skipped image OCR", progress: 1 });
          return "";
        }
        throw error;
      }).finally(() => {
        if (currentOcrImageAbort === imageAbort) currentOcrImageAbort = null;
      });
      if (text) {
        texts.push(text);
        if (lifecycleActive()) player.updateOcrStatus({
          imageIndex: index,
          imageCount: images.length,
          status: `OCR found ${text.length} characters`,
          progress: 1,
        });
      }
    }
  } catch (error) {
    if (!(error instanceof DOMException && error.name === "AbortError")) {
      console.warn("Post-reading OCR failed", error);
      failureStatus = ocrErrorMessage(error);
    }
  } finally {
    removeLifecycleAbort();
    if (currentOcrRunAbort === runAbort) {
      currentOcrRunAbort = null;
      currentOcrImageAbort = null;
      if (!lifecycleActive()) {
        return [];
      }
      if (failureStatus) {
        showTransientOcrStatus(failureStatus);
      } else if (!runAbort.signal.aborted && texts.length === 0) {
        showTransientOcrStatus("OCR found no readable image text");
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
      url.searchParams.set("name", "orig");
    }
    return url.toString();
  } catch {
    return src;
  }
}

function showTransientOcrStatus(status: string): void {
  if (!lifecycleActive()) return;
  player.updateOcrStatus({ imageIndex: 0, imageCount: 1, status, progress: null });
  runtimeScheduler.timeout(() => {
    if (lifecycleActive() && !currentOcrRunAbort) player.updateOcrStatus(null);
  }, 1400);
}

function playAdjacent(direction: 1 | -1): void {
  if (!lifecycleActive()) return;
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
    runtimeScheduler.timeout(() => {
      if (!lifecycleActive()) return;
      scheduleScan();
      const refreshed = visibleTweets();
      const candidate = refreshed.find((tweet) => tweet !== currentTweet && tweet.getBoundingClientRect().top > 0 && (!settings.skipPromotedPosts || !isPromotedTweet(tweet)));
      if (candidate) playTweet(candidate);
    }, 900);
  }
}

function nextTweetOrQuotingText(): void {
  if (skipActiveOcrSpeechRange()) return;
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
    [settings.keyNextChunk, () => nextChunkAndResyncHighlight()],
    [settings.keyPreviousChunk, () => previousChunkAndResyncHighlight()],
    [settings.keySkipOcr, () => skipOcrLoadingOrActiveSpeech()],
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

function findButtonAnchor(tweet: HTMLElement, footer = findLikelyActionRow(tweet)): HTMLElement | null {
  if (settings.buttonPlacement === "actions") {
    return findLastActionButton(tweet, footer);
  }
  return findGrokButton(tweet, footer) || findTopControlButton(tweet, footer);
}

function findGrokButton(tweet: HTMLElement, footer: HTMLElement | null = null): HTMLElement | null {
  return Array.from(tweet.querySelectorAll<HTMLElement>('button, [role="button"], a, [aria-label], [data-testid]')).find((button) => {
    if (button.closest('[data-testid="quoteTweet"]')) return false;
    if (footer?.contains(button)) return false;
    const text = [
      button.getAttribute("aria-label") || "",
      button.getAttribute("data-testid") || "",
      button.textContent || "",
      button instanceof HTMLAnchorElement ? button.href : "",
    ].join(" ").toLowerCase();
    return text.includes("grok");
  }) || null;
}

function findTopControlButton(tweet: HTMLElement, footer: HTMLElement | null = null): HTMLElement | null {
  const candidates = Array.from(tweet.querySelectorAll<HTMLElement>(
    '[data-testid="caret"], [aria-label*="More"], [aria-label*="more"], button, [role="button"], a',
  ));
  return candidates.find((button) => {
    if (button.closest('[data-testid="quoteTweet"]')) return false;
    if (footer?.contains(button)) return false;
    if (button.closest(POST_READING_BUTTON)) return false;
    const label = `${button.getAttribute("aria-label") || ""} ${button.getAttribute("data-testid") || ""}`.toLowerCase();
    return label.includes("caret") || label.includes("more") || label.includes("grok");
  }) || null;
}

function findLastActionButton(tweet: HTMLElement, footer = findLikelyActionRow(tweet)): HTMLElement | null {
  const scope = footer || tweet;
  const buttons = Array.from(scope.querySelectorAll<HTMLElement>(ACTION_BUTTONS))
    .filter((button) => !button.closest('[data-testid="quoteTweet"]'));
  return buttons.at(-1) || null;
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
  await new Promise<void>((resolve) => {
    runtimeScheduler.timeout(resolve, 250);
  });
}

function markActiveButton(tweet: HTMLElement): void {
  clearActiveTweets();
  tweet.dataset.postReadingActive = "true";
  tweet.dataset.postReadingActiveBackground = String(settings.activeTweetHighlight);
  activeTweets.add(tweet);

  for (const button of Array.from(activeReadButtons)) {
    if (!button.isConnected) {
      activeReadButtons.delete(button);
      continue;
    }
    button.setAttribute("aria-pressed", "false");
  }
  const activeButton = tweet.querySelector<HTMLButtonElement>(POST_READING_BUTTON);
  if (activeButton) {
    activeButton.setAttribute("aria-pressed", "true");
    activeReadButtons.add(activeButton);
  }
}

function updateTweetHighlight(state: HighlightSpeechState): void {
  if (state.status === "idle") {
    clearEstimatedHighlightLoop();
    clearBodyHighlight();
    clearActiveTweets();
    updateOcrSkipAvailability(null);
    lastChunkIndex = null;
    return;
  }
  if (state.status === "error") {
    clearEstimatedHighlightLoop();
    clearHighlightVisuals();
    clearActiveTweets();
    updateOcrSkipAvailability(null);
    lastChunkIndex = null;
    return;
  }
  if (currentTweet) {
    currentTweet.dataset.postReadingActive = "true";
    currentTweet.dataset.postReadingActiveBackground = String(settings.activeTweetHighlight);
    activeTweets.add(currentTweet);
  }
  if (!currentTweet || settings.bodyHighlightMode === "off") {
    clearEstimatedHighlightLoop();
    return;
  }
  if (currentHighlightTargets.length === 0) {
    return;
  }
  updateEstimatedHighlightLoop(state);
  const chunkChanged = lastChunkIndex !== null && state.chunkIndex !== lastChunkIndex;
  lastChunkIndex = state.chunkIndex;
  const absoluteIndex = state.charIndex ?? estimateUnsyncedHighlightIndex(state);
  updateOcrSkipAvailability(absoluteIndex);
  if (absoluteIndex === null) return;

  const target = findActiveHighlightTarget(absoluteIndex);
  if (!target) {
    return;
  }
  const body = target.body;
  const relativeIndex = absoluteIndex - target.start;
  const targetChanged = activeHighlightTarget !== target;
  activateHighlightTarget(target);
  const highlightMode = effectiveHighlightMode(target);

  if (highlightMode !== "smooth") {
    const words = prepareWordBody(body);
    const currentWord = findCurrentWordToken(words, relativeIndex, state.charLength);
    for (const word of words) word.dataset.postReadingCurrentWord = String(word === currentWord);
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

function updateEstimatedHighlightLoop(state: HighlightSpeechState): void {
  if (state.hasSyncedBoundaries || state.charIndex !== null) {
    clearEstimatedHighlightLoop();
    return;
  }
  if (state.status !== "speaking") return;
  if (estimatedHighlightFrame !== null) return;
  estimatedHighlightFrame = window.requestAnimationFrame(() => {
    estimatedHighlightFrame = null;
    if (!speech || !lifecycleActive()) return;
    const nextState = speech.getState();
    if (nextState.status === "speaking" && !nextState.hasSyncedBoundaries && nextState.charIndex === null) {
      updateTweetHighlight(nextState);
    }
  });
}

function clearEstimatedHighlightLoop(): void {
  if (estimatedHighlightFrame !== null) {
    window.cancelAnimationFrame(estimatedHighlightFrame);
    estimatedHighlightFrame = null;
  }
  estimatedHighlightKey = "";
  estimatedHighlightStartedAt = 0;
  estimatedHighlightPausedAt = null;
}

function estimateUnsyncedHighlightIndex(state: HighlightSpeechState): number | null {
  if (state.chunkStart === null) return null;
  if (state.hasSyncedBoundaries) return state.chunkStart;
  const key = `${state.chunkIndex}:${state.chunkStart}:${state.chunkCount}`;
  const now = performance.now();
  if (estimatedHighlightKey !== key) {
    estimatedHighlightKey = key;
    estimatedHighlightStartedAt = now;
    estimatedHighlightPausedAt = null;
  }
  if (state.status === "paused") {
    estimatedHighlightPausedAt ??= now;
  } else if (estimatedHighlightPausedAt !== null) {
    estimatedHighlightStartedAt += now - estimatedHighlightPausedAt;
    estimatedHighlightPausedAt = null;
  }
  const elapsedSeconds = Math.max(0, ((estimatedHighlightPausedAt ?? now) - estimatedHighlightStartedAt) / 1000);
  const estimatedOffset = Math.round(elapsedSeconds * Math.max(4, calibratedCharsPerSecond));
  const chunkEnd = findEstimatedChunkEnd(state.text || "", state.chunkStart);
  return Math.min(chunkEnd, state.chunkStart + estimatedOffset);
}

function findEstimatedChunkEnd(text: string, chunkStart: number): number {
  if (!text) return chunkStart;
  const remaining = text.slice(chunkStart);
  if (remaining.length <= 220) return text.length;
  const slice = remaining.slice(0, 220);
  const boundary = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "), slice.lastIndexOf(", "));
  return chunkStart + (boundary > 80 ? boundary + 1 : Math.min(220, remaining.length));
}

function effectiveHighlightMode(target: HighlightTarget): BodyHighlightMode {
  if (settings.bodyHighlightMode !== "smooth") return settings.bodyHighlightMode;
  const performanceMode = document.documentElement.dataset.milxdyPerformanceMode || "balanced";
  const tokenEstimate = estimateHighlightTokenCount(target.text);
  let mode: BodyHighlightMode = "smooth";
  let reason = "configured";
  if (performanceMode === "fast") {
    mode = "word";
    reason = "fast-mode";
  } else if (performanceMode === "balanced" && (target.text.length > 520 || tokenEstimate > 96)) {
    mode = "word";
    reason = "balanced-cap";
  } else if (target.text.length > 1000 || tokenEstimate > 180) {
    mode = "word";
    reason = "long-text-cap";
  }
  if (mode !== "smooth") clearSmoothAnimation();
  const diagnosticSignature = `${settings.bodyHighlightMode}:${mode}:${performanceMode}:${target.kind}:${reason}:${Math.round(target.text.length / 100)}`;
  if (diagnosticSignature !== lastHighlightDiagnosticSignature) {
    lastHighlightDiagnosticSignature = diagnosticSignature;
    recordRuntimeDiagnostic("highlight", {
      configured: settings.bodyHighlightMode,
      effective: mode,
      performanceMode,
      target: target.kind,
      textLength: target.text.length,
      tokenEstimate,
      reason,
      updatedAt: Date.now(),
    });
  }
  return mode;
}

function didHighlightJump(relativeIndex: number, chunkChanged: boolean): boolean {
  if (chunkChanged || lastRelativeIndex === null) return true;
  if (relativeIndex < lastRelativeIndex) return true;
  const expectedLead = Math.max(18, calibratedCharsPerSecond * 1.25);
  return relativeIndex - lastRelativeIndex > expectedLead;
}

function clearActiveTweets(): void {
  for (const article of Array.from(activeTweets)) {
    if (article.isConnected) {
      article.dataset.postReadingActive = "false";
      article.dataset.postReadingActiveBackground = "false";
    }
    activeTweets.delete(article);
  }
  for (const button of Array.from(activeReadButtons)) {
    if (button.isConnected) button.setAttribute("aria-pressed", "false");
    activeReadButtons.delete(button);
  }
}

function updateWikiDocumentHighlight(state: { status: string; text?: string; chunkIndex: number; chunkStart: number | null; charIndex: number | null; charLength: number | null; boundaryElapsedTime?: number | null; hasSyncedBoundaries: boolean }): void {
  if (!activeWikiDocument) return;
  if (state.status === "idle") {
    wikiCompletionPending = Boolean(state.text);
    clearWikiDocumentSession();
    return;
  }
  if (state.status === "error" || settings.bodyHighlightMode === "off" || !state.hasSyncedBoundaries) {
    sendWikiHighlight({ type: "wikiSidebar:clearReadHighlight", articleId: activeWikiDocument.id });
    return;
  }
  const absoluteIndex = state.charIndex ?? state.chunkStart;
  if (absoluteIndex === null) return;
  const mode = effectiveWikiHighlightMode(activeWikiDocument);
  sendWikiHighlight({
    type: "wikiSidebar:highlightBoundary",
    articleId: activeWikiDocument.id,
    charIndex: absoluteIndex,
    charLength: state.charLength,
    boundaryElapsedTime: state.boundaryElapsedTime ?? null,
    mode,
    hasSyncedBoundaries: state.hasSyncedBoundaries,
    autoScroll: settings.wikiAutoScroll,
    speechRate: settings.speed,
    status: state.status,
  });
}

function effectiveWikiHighlightMode(_target: WikiReadableDocument): BodyHighlightMode {
  if (settings.bodyHighlightMode !== "smooth") return settings.bodyHighlightMode;
  return "smooth";
}

function clearWikiDocumentSession(): void {
  if (!activeWikiDocument && !wikiPlayerSlot) return;
  const articleId = activeWikiDocument?.id;
  if (articleId) sendWikiHighlight({ type: "wikiSidebar:clearReadHighlight", articleId });
  activeWikiDocument = null;
  wikiPlayerSlot = null;
  wikiPlayer?.detach();
  dispatchWikiReaderState(false);
}

function attachPlayerToWikiSlot(): void {
  const slot = document.querySelector<HTMLElement>(".milxdy-wiki-sidebar-reader-slot");
  if (!slot) return;
  wikiPlayerSlot = slot;
  wikiPlayer.attachTo(slot);
}

function sendWikiHighlight(message: WikiHighlightMessage): void {
  document.dispatchEvent(new CustomEvent("wikiSidebar:reader-highlight", { detail: message }));
}

function dispatchWikiReaderState(active: boolean): void {
  document.dispatchEvent(new CustomEvent("post-reading:wiki-reading-state", {
    detail: { active },
  }));
}

function isWikiReadableDocument(value: unknown): value is WikiReadableDocument {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.source === "wiki"
    && typeof record.id === "string"
    && typeof record.title === "string"
    && typeof record.text === "string";
}

function getTweetBodies(tweet: HTMLElement): HTMLElement[] {
  return Array.from(tweet.querySelectorAll<HTMLElement>(TWEET_TEXT));
}

function getMainTweetBody(tweet: HTMLElement): HTMLElement | null {
  const bodies = getTweetBodies(tweet);
  return bodies.find((body) => !body.closest(QUOTE_TWEET)) || bodies[0] || null;
}

function getQuoteTweetBody(tweet: HTMLElement): HTMLElement | null {
  const injected = tweet.querySelector<HTMLElement>('[data-post-reading-full-quote-body="true"]');
  if (injected) return injected;
  return getVisibleQuoteTweetBody(tweet);
}

function getVisibleQuoteTweetBody(tweet: HTMLElement): HTMLElement | null {
  const bodies = Array.from(tweet.querySelectorAll<HTMLElement>(TWEET_TEXT));
  return bodies.find((body) => Boolean(body.closest(QUOTE_TWEET))) || bodies.find((_, index) => index > 0) || null;
}

function clearBodyHighlight(): void {
  clearEstimatedHighlightLoop();
  clearHighlightVisuals();
  for (const body of highlightedBodies) {
    if (body.dataset.postReadingOriginalHtml) {
      body.innerHTML = body.dataset.postReadingOriginalHtml;
      delete body.dataset.postReadingOriginalHtml;
    }
    delete body.dataset.postReadingHighlightMode;
  }
  highlightedBodies = new Set();
  activeHighlightTarget = null;
  currentHighlightTargets = [];
}

function clearHighlightVisuals(): void {
  clearEstimatedHighlightLoop();
  clearSmoothAnimation();
  for (const body of Array.from(highlightedBodies)) {
    if (!body.isConnected) {
      highlightedBodies.delete(body);
      continue;
    }
    for (const word of Array.from(body.querySelectorAll<HTMLElement>('[data-post-reading-word="true"]'))) {
      delete word.dataset.postReadingCurrentWord;
    }
    for (const word of Array.from(body.querySelectorAll<HTMLElement>('[data-post-reading-smooth-word="true"]'))) {
      delete word.dataset.postReadingSmoothFilled;
      word.style.removeProperty("--post-reading-fill");
      word.style.removeProperty("--post-reading-fill-duration");
    }
  }
  activeHighlightTarget = null;
}

function scrollFullQuoteWordIntoView(word: HTMLElement | null): void {
  if (!word) return;
  const container = word.closest<HTMLElement>('.post-reading-full-quote[data-mode="scroll"] .post-reading-full-quote-body');
  if (!container) return;
  const wordRect = word.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const offset = wordRect.top - containerRect.top - container.clientHeight / 2 + wordRect.height / 2;
  container.scrollTop += offset;
}

function saveOriginalBody(body: HTMLElement): void {
  if (!body.dataset.postReadingOriginalHtml) {
    body.dataset.postReadingOriginalHtml = body.innerHTML;
  }
  highlightedBodies.add(body);
}

function prepareSmoothBody(body: HTMLElement): HTMLElement[] {
  const existing = Array.from(body.querySelectorAll<HTMLElement>('[data-post-reading-smooth-word="true"]'));
  if (existing.length > 0) return existing;
  return prepareTokenizedBody(body, "smooth");
}

function prepareWordBody(body: HTMLElement): HTMLElement[] {
  const existing = Array.from(body.querySelectorAll<HTMLElement>('[data-post-reading-word="true"]'));
  if (existing.length > 0) return existing;
  return prepareTokenizedBody(body, "word");
}

function prepareTokenizedBody(body: HTMLElement, mode: "word" | "smooth"): HTMLElement[] {
  resetBodyTokenizationForMode(body, mode);
  saveOriginalBody(body);
  body.dataset.postReadingHighlightMode = mode;
  // When readable hyperlinks are not spoken, leave their text untokenized and out
  // of the cursor count so token offsets stay aligned with the link-stripped spoken
  // text. Otherwise the highlight drifts ahead by each skipped link's length.
  const skipReadableLinks = !settings.includeHyperlinks;
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
    if (skipReadableLinks && isInReadableHyperlink(node)) continue;
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
          span.dataset.postReadingWord = "true";
        } else {
          span.dataset.postReadingSmoothWord = "true";
          span.dataset.postReadingTokenKind = /^\s+$/.test(part) ? "space" : "word";
        }
        span.dataset.postReadingWordIndex = String(index++);
        span.dataset.postReadingStart = String(textCursor);
        span.dataset.postReadingLength = String(part.length);
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

function isInReadableHyperlink(node: Node): boolean {
  const anchor = node.parentElement?.closest<HTMLAnchorElement>("a[href]") || null;
  return Boolean(anchor && isReadableHyperlink(anchor));
}

function resetBodyTokenizationForMode(body: HTMLElement, mode: "word" | "smooth"): void {
  if (!body.dataset.postReadingHighlightMode || body.dataset.postReadingHighlightMode === mode) return;
  if (body.dataset.postReadingOriginalHtml) {
    body.innerHTML = body.dataset.postReadingOriginalHtml;
  }
  delete body.dataset.postReadingHighlightMode;
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

function findOcrSpeechRanges(spokenText: string, imageTexts: string[]): OcrSpeechRange[] {
  const ranges: OcrSpeechRange[] = [];
  let cursor = 0;
  for (const [index, text] of imageTexts.entries()) {
    const clean = text.trim();
    if (!clean) continue;
    const quoted = `"${clean}"`;
    const quotedStart = spokenText.indexOf(quoted, cursor);
    const start = quotedStart >= 0 ? quotedStart : spokenText.indexOf(clean, cursor);
    if (start < 0) continue;
    const textStart = quotedStart >= 0 ? quotedStart + 1 : start;
    const textEnd = textStart + clean.length;
    const segmentStart = findOcrSegmentStart(spokenText, start);
    ranges.push({
      start: segmentStart,
      end: textEnd + (quotedStart >= 0 ? 1 : 0),
      imageIndex: index,
      imageCount: imageTexts.length,
    });
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
  resetSmoothTokenFill(Array.from(target.body.querySelectorAll<HTMLElement>('[data-post-reading-smooth-word="true"]')));
}

function restoreInactiveHighlightBodies(activeBody: HTMLElement): void {
  for (const body of Array.from(highlightedBodies)) {
    if (body === activeBody) continue;
    if (isFullQuoteBody(body)) {
      for (const word of Array.from(body.querySelectorAll<HTMLElement>('[data-post-reading-word="true"]'))) {
        delete word.dataset.postReadingCurrentWord;
      }
      highlightedBodies.delete(body);
      continue;
    }
    if (body.dataset.postReadingOriginalHtml) {
      body.innerHTML = body.dataset.postReadingOriginalHtml;
      delete body.dataset.postReadingOriginalHtml;
    }
    highlightedBodies.delete(body);
  }
}

function isFullQuoteBody(body: HTMLElement): boolean {
  return Boolean(body.closest('[data-post-reading-full-quote="true"]'));
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
    const start = Number(word.dataset.postReadingStart || 0);
    const length = Number(word.dataset.postReadingLength || word.textContent?.length || 0);
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

function findCurrentWordToken(words: HTMLElement[], relativeIndex: number, charLength: number | null): HTMLElement | null {
  if (words.length === 0) return null;
  const sorted = [...words].sort((left, right) => tokenStart(left) - tokenStart(right));
  if (charLength !== null && charLength > 0) {
    const spokenMidpoint = relativeIndex + Math.max(0, Math.floor((charLength - 1) / 2));
    const tokenAtMidpoint = findTokenContaining(sorted, spokenMidpoint);
    if (tokenAtMidpoint) return tokenAtMidpoint;
  }
  const tokenAtBoundary = findTokenContaining(sorted, relativeIndex);
  if (tokenAtBoundary) return tokenAtBoundary;
  return sorted.find((token) => tokenStart(token) >= relativeIndex) || sorted[sorted.length - 1] || null;
}

function findTokenContaining(tokens: HTMLElement[], index: number): HTMLElement | null {
  return tokens.find((token) => {
    const start = tokenStart(token);
    const end = start + tokenLength(token);
    return index >= start && index < end;
  }) || null;
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
    delete token.dataset.postReadingSmoothFilled;
    token.style.removeProperty("--post-reading-fill");
    token.style.removeProperty("--post-reading-fill-duration");
  }
}

function paintSmoothAt(tokens: HTMLElement[], cursorIndex: number): void {
  smoothVisualIndex = Math.max(smoothVisualIndex, cursorIndex);
  for (const token of tokens) {
    const start = Number(token.dataset.postReadingStart || 0);
    const length = tokenLength(token);
    const end = start + length;

    if (end <= cursorIndex) {
      token.dataset.postReadingSmoothFilled = "true";
      token.style.removeProperty("--post-reading-fill");
      token.style.removeProperty("--post-reading-fill-duration");
      continue;
    }

    delete token.dataset.postReadingSmoothFilled;

    if (cursorIndex >= start && cursorIndex < end) {
      const value = rangeFillPercentForToken(token, cursorIndex);
      token.style.setProperty("--post-reading-fill-duration", "0ms");
      token.style.setProperty("--post-reading-fill", `${value}%`);
    } else {
      token.style.removeProperty("--post-reading-fill-duration");
      token.style.removeProperty("--post-reading-fill");
    }
  }
}

function animateSmoothRange(tokens: HTMLElement[], fromIndex: number, toIndex: number, durationMs: number): void {
  clearSmoothAnimation();
  const animatedTokenCount = paintSmoothTransition(tokens, fromIndex, toIndex, durationMs);
  recordSmoothAnimationDiagnostic(tokens.length, animatedTokenCount, durationMs);
  smoothAnimationTimer = window.setTimeout(() => {
    smoothAnimationTimer = null;
    if (!tokens.some((token) => token.isConnected)) return;
    paintSmoothAt(tokens, toIndex);
  }, durationMs + 24);
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
}

function paintSmoothTransition(tokens: HTMLElement[], fromIndex: number, toIndex: number, durationMs: number): number {
  const animatedTokens = tokens.filter((token) => {
    const start = tokenStart(token);
    const end = start + tokenLength(token);
    return end > fromIndex && start < toIndex;
  });
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
  return animatedTokens.length;
}

function recordSmoothAnimationDiagnostic(tokenCount: number, animatedTokenCount: number, durationMs: number): void {
  const signature = `${document.documentElement.dataset.milxdyPerformanceMode || "balanced"}:${Math.round(tokenCount / 12)}:${Math.round(animatedTokenCount / 8)}:${Math.round(durationMs / 100)}`;
  if (signature === lastSmoothAnimationDiagnosticSignature) return;
  lastSmoothAnimationDiagnosticSignature = signature;
  recordRuntimeDiagnostic("highlightAnimation", {
    mode: "css-transition",
    tokenCount,
    animatedTokenCount,
    durationMs,
    performanceMode: document.documentElement.dataset.milxdyPerformanceMode || "balanced",
    updatedAt: Date.now(),
  });
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

function estimateHighlightTokenCount(text: string): number {
  return text.match(/\s*[\p{L}\p{N}_'-]+[^\s\p{L}\p{N}_'-]*|\s+|[^\s\p{L}\p{N}_'-]+/gu)?.length || 0;
}

function tokenStart(token: HTMLElement | null): number {
  return Number(token?.dataset.postReadingStart || 0);
}

function tokenLength(token: HTMLElement | null): number {
  return Number(token?.dataset.postReadingLength || token?.textContent?.length || 0);
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
    if (token.dataset.postReadingTokenKind !== "space") {
      return tokenStart(token);
    }
  }
  return tokenStart(current) + tokenLength(current);
}
