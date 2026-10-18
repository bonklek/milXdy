import { readingScrollBehavior, reducedMotionHighlightMode, scrollFullQuoteWordIntoView } from "./motion-policy";
export { reducedMotionHighlightMode } from "./motion-policy";
import { postReadingPerformancePolicy, type PostReadingPerformancePolicy } from "./performance-policy";
import { type ExportMessenger } from "./audio-conversion";
import { createReadAloudButton } from "./read-button";
import { reviewPostAudio } from "./post-audio-action";
import { setupConversationReadAction, type ConversationReading } from "./direct-messages";
import { createConversationHighlight } from "./direct-message-highlighting";
import { findBodyRange, findOcrSpeechRanges, type OcrSpeechRange } from "./spoken-text-range";
import { cleanText, extractReadableArticleBlock, extractReadablePost, formatReadablePost, isNonReadableTweetTextArtifact, isReadableHyperlink } from "./extractText";
import { configurePostReadingAssetResolver, postReadingAssetUrl } from "./assetUrl";
import { configureFullQuoteRuntimeMessage, fetchEmbeddedQuote, fetchFullQuote, getLastEmbeddedQuoteDiagnostic, type FullQuoteFetchResult } from "./fullQuote";
import { TextHighlightEngine, estimateHighlightTokenCount as estimateSharedHighlightTokenCount } from "./highlightEngine";
import { isSmoothHighlightDiscontinuity, resolveContinuousHighlightMode } from "./highlightPolicy";
import { HighlightProgressClock } from "./highlightProgress";
import { icon } from "./icons";
import {
  findExplicitPostTarget,
  findVisibleAutoplayTarget,
  jumpToAdjacentSpeechBoundary,
  postNavigationAvailability,
  shouldRestartCurrentPost,
} from "./navigation";
import { recognizeImageText, type OcrImage } from "./ocr";
import { MiniPlayer } from "./player";
import { ACTION_BUTTONS, POST_READING_BUTTON, QUOTE_TWEET, TWEET, TWEET_PHOTO, TWEET_TEXT } from "./selectors";
import type { BodyHighlightMode, PostReadingSettings, ReadablePost } from "./shared/types";
import { playEndDing } from "./sounds";
import { SpeechController, type BoundarySupport } from "./speech";
import { injectStyles } from "./styles";
import { configurePostReadingStorage, loadSettings, loadVoiceBoundarySupport, observeSettings, saveSettings, saveVoiceBoundarySupport } from "./storage";
import { createOverlayAppFrame, type OverlayAppFrame } from "../../platform/overlay/app-frame";
import type { TwitterSurface } from "../../platform/scanner/twitter-scanner";
import { extractXArticleTextContainers, isXArticleSurface } from "../../platform/scanner/x-article";
import { recordFeatureTiming } from "../../platform/diagnostics/performance-diagnostics";
import type { AppRuntimeScheduler, MilxdyContentAppContext, MilxdyContextualPostActionContext, MilxdyRouteChange } from "../../platform/app-sdk/app-platform";
import { createFallbackRuntimeScheduler } from "../../platform/runtime/scheduler";

const processed = new WeakMap<HTMLElement, string>();

let settings: PostReadingSettings;
let speech: SpeechController;
let player: MiniPlayer;
let wikiSpeech: SpeechController;
let wikiPlayer: MiniPlayer;
let appFrame: OverlayAppFrame | null = null;
let currentTweet: HTMLElement | null = null;
let articleSessionIncludesHyperlinks = false;
let readingPrivateConversation = false;
const conversationHighlight = createConversationHighlight();
let conversionSendMessage: ExportMessenger = async () => null;
let closeConversion: (() => void) | null = null;
const pendingTweets = new Map<HTMLElement, { kind: TwitterSurface["kind"]; actionRow: HTMLElement | null; textContainers: HTMLElement[] }>();
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
let activeHighlightSegment: HighlightSegment | null = null;
let lastBoundaryAt: number | null = null;
let lastRelativeIndex: number | null = null;
let lastChunkIndex: number | null = null;
let calibratedCharsPerSecond = 13;
let activeWordToken: HTMLElement | null = null;
let estimatedHighlightTimer: number | null = null;
let estimatedHighlightKey = "";
let estimatedHighlightStartedAt = 0;
let estimatedHighlightPausedAt: number | null = null;
const highlightProgressClock = new HighlightProgressClock();
let highlightWorkGeneration = 0;
let deferNextIdleHighlightCleanup = false;
let lastHighlightDiagnosticSignature = "";
let lastHighlightPaintDiagnosticSignature = "";
let lastSmoothAnimationDiagnosticSignature = "";
let lastSmoothSegmentDiagnosticSignature = "";
let lastHighlightTimingDiagnosticSignature = "";
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
const highlightEngine = new TextHighlightEngine({
  onSmoothAnimation: (diagnostic) => {
    recordSmoothAnimationDiagnostic(diagnostic);
  },
});

type HighlightTarget = {
  body: HTMLElement;
  bodies?: HTMLElement[];
  kind: "quote" | "main";
  start: number;
  end: number;
  text: string;
  segments?: HighlightSegment[];
  segmentSurface?: HTMLElement;
  activeSegment?: HighlightSegment;
};

type HighlightSegment = {
  body: HTMLElement;
  start: number;
  end: number;
  text: string;
};

const highlightTokenEstimateCache = new WeakMap<HighlightTarget, { text: string; value: number }>();
const SMOOTH_SEGMENT_TEXT_THRESHOLD = 1400;
const SMOOTH_SEGMENT_MAX_CHARS = 720;
const SMOOTH_SEGMENT_MIN_BREAK_CHARS = 280;

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
  boundaryElapsedTime: number | null;
  hasSyncedBoundaries: boolean;
  hasStarted?: boolean;
  isPriming?: boolean;
};

let activeWikiDocument: WikiReadableDocument | null = null;
let voiceBoundarySupport: Record<string, BoundarySupport> = {};
let wikiPlayerSlot: HTMLElement | null = null;

export async function boot(context?: MilxdyContentAppContext): Promise<void> {
  if (booted) return;
  booted = true;
  lifecycleSignal = context?.signal || null;
  runtimeScheduleScan = context?.requestSurfaceRescan || context?.scheduleScan || runtimeScheduleScan;
  runtimeScheduler = context?.scheduler || runtimeScheduler;
  recordRuntimeDiagnostic = context?.recordDiagnostic || recordRuntimeDiagnostic;
  conversionSendMessage = (message) => context?.sendMessage(message) || Promise.resolve(null);
  configureFullQuoteRuntimeMessage(context?.sendMessage || null);
  configurePostReadingStorage(context?.storage || null);
  configurePostReadingAssetResolver(context?.resolveAssetUrl || null);
  const addDisposable = context?.addDisposable || (() => undefined);
  injectStyles(addDisposable, () => clearSmoothAnimation({ completePending: true }));
  settings = await loadSettings();
  document.documentElement.dataset.milxdyPostReadingButtonPlacement = settings.buttonPlacement;
  speech = new SpeechController(settings);
  player = new MiniPlayer(settings, {
    onPauseResume: () => {
      pauseWikiReader();
      speech.pauseOrResume();
    },
    onStop: () => {
      stopTweetReaderFromUi();
    },
    onNext: () => nextTweetOrQuotingText(),
    onPrevious: () => previousTweetOrStart(),
    onNextChunk: () => jumpSpeechLine(1),
    onPreviousChunk: () => jumpSpeechLine(-1),
    onSkipOcr: () => skipOcrLoadingOrActiveSpeech(),
    onSettingsChange: (next) => {
      settings = next;
      speech.applySettings(readingPrivateConversation ? { ...next, ttsEngine: "web-speech", autoplayNext: false } : next);
      wikiSpeech.applySettings(next);
      player.updateSettings(next);
      wikiPlayer.updateSettings(next);
      void saveSettings(next);
    },
    onBoundarySupportChange: (results) => {
      void saveVoiceBoundarySupport(results);
    },
    getVoices: () => speech.getVoices(),
    getPreferredVoice: () => speech.getPreferredVoice(),
    probeBoundarySupport: (voice, signal) => speech.probeBoundarySupport(voice, signal, [wikiSpeech]),
  }, (callback, delay) => runtimeScheduler.timeout(callback, delay));
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
    onNextChunk: () => jumpSpeechLine(1, wikiSpeech),
    onPreviousChunk: () => jumpSpeechLine(-1, wikiSpeech),
    onSkipOcr: () => undefined,
    onSettingsChange: (next) => {
      settings = next;
      speech.applySettings(readingPrivateConversation ? { ...next, ttsEngine: "web-speech", autoplayNext: false } : next);
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
    probeBoundarySupport: (voice, signal) => wikiSpeech.probeBoundarySupport(voice, signal, [speech]),
  }, (callback, delay) => runtimeScheduler.timeout(callback, delay));
  appFrame = createOverlayAppFrame({
    id: "post-reading",
    label: "Post-reading",
    icon: postReadingDockIcon,
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
      // Preserve an observed boundary that arrived while storage was loading.
      voiceBoundarySupport = { ...results, ...voiceBoundarySupport };
      player.setBoundarySupport(voiceBoundarySupport);
      wikiPlayer.setBoundarySupport(voiceBoundarySupport);
    }
  });
  speech.onBoundaryObserved((voiceURI) => {
    if (voiceBoundarySupport[voiceURI] === "supported") return;
    voiceBoundarySupport = { ...voiceBoundarySupport, [voiceURI]: "supported" };
    void saveVoiceBoundarySupport(voiceBoundarySupport);
    player.setBoundarySupport(voiceBoundarySupport);
    wikiPlayer.setBoundarySupport(voiceBoundarySupport);
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
    if (settings.autoplayNext && !readingPrivateConversation) {
      runtimeScheduler.timeout(() => {
        if (lifecycleActive()) playAdjacentAutoplay();
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
    const targets = currentHighlightTargets;
    clearBodyHighlight();
    currentHighlightTargets = targets;
    settings = next;
    document.documentElement.dataset.milxdyPostReadingButtonPlacement = settings.buttonPlacement;
    speech.applySettings(readingPrivateConversation ? { ...next, ttsEngine: "web-speech", autoplayNext: false } : next);
    wikiSpeech.applySettings(next);
    player.updateSettings(next);
    wikiPlayer.updateSettings(next);
    updateTweetHighlight(speech.getState());
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

  setupReaderDocumentListeners(addDisposable);
  addDisposable(setupConversationReadAction(playConversationSnapshot, lifecycleActive, (callback, delay) => runtimeScheduler.timeout(callback, delay)));
  runtimeScheduleScan();
}

function setupReaderDocumentListeners(addDisposable: (disposable: () => void) => void): void {
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

}

export function onSurface(surface: TwitterSurface): void {
  if (!lifecycleActive() || (surface.kind !== "tweet" && surface.kind !== "xArticle")) return;
  const policy = postReadingPerformancePolicy();
  if (pendingTweets.size >= policy.maxPendingTweets && !pendingTweets.has(surface.element)) return;
  pendingTweets.set(surface.element, { kind: surface.kind, actionRow: surface.actionRow, textContainers: surface.textContainers });
  scheduleScan();
}

/** Native Share menu entry opens a review; conversion still requires explicit confirmation. */
export function onContextualPostAction(context: MilxdyContextualPostActionContext): void {
  if (!lifecycleActive() || context.signal.aborted || context.actionId !== "reviewMp3") return;
  closeConversion?.();
  closeConversion = reviewPostAudio(context, settings, conversionSendMessage);
}

export function onRouteChange(route: MilxdyRouteChange): void {
  closeConversion?.(); closeConversion = null;
  if (!lifecycleActive() || !route.previousHref || route.previousHref === route.href) return;
  cancelPendingHighlightWork();
  cancelOcr();
  clearFullQuotePreview();
  clearBodyHighlight();
  clearActiveTweets();
  speech.stop();
  currentTweet = null;
  pendingTweets.clear();
  readingPrivateConversation = false;
  speech.applySettings(settings);
  removeReadButtons();
  player.setPostNavigationAvailability({ previous: false, next: false });
}

export function disable(): void {
  closeConversion?.(); closeConversion = null;
  if (settings) settings = { ...settings, enabled: false };
  readingPrivateConversation = false;
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
  player?.dispose();
  wikiPlayer?.dispose();
  appFrame?.remove();
  appFrame = null;
  recordRuntimeDiagnostic = () => undefined;
  configureFullQuoteRuntimeMessage(null);
  configurePostReadingStorage(null);
  configurePostReadingAssetResolver(null);
  lifecycleSignal = null;
  booted = false;
}

function lifecycleActive(): boolean {
  return booted && settings?.enabled !== false && lifecycleSignal?.aborted !== true;
}

function postReadingDockIcon(): string {
  const root = document.documentElement;
  const dark = root.dataset.milxdyXTheme === "dark"
    || root.dataset.milxdyXTheme === "dim"
    || root.dataset.milxdySettingsTheme === "dark"
    || (root.dataset.milxdyXTheme !== "light"
      && root.dataset.milxdySettingsTheme !== "light"
      && (root.style.colorScheme === "dark" || window.matchMedia?.("(prefers-color-scheme: dark)").matches === true));
  return postReadingAssetUrl(dark ? "post-reading/post-reading-logo-outline.png" : "post-reading/post-reading-logo.png");
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
    processTweet(tweet, surface.kind, surface.actionRow, surface.textContainers);
    recordFeatureTiming("post-reading", "processTweet", startedAt);
  }
  processReservedButtonSlots(policy);
  if (pendingTweets.size > 0) scheduleScan();
}

function processReservedButtonSlots(policy: PostReadingPerformancePolicy): void {
  const tweets = new Set<HTMLElement>();
  const slots = Array.from(document.querySelectorAll<HTMLElement>(`${RUNTIME_POST_READING_HEADER_SLOT}, ${RUNTIME_POST_READING_SLOT}`));
  const limit = Math.max(policy.batchSize, policy.maxPendingTweets);
  for (const slot of slots) {
    if (tweets.size >= limit) break;
    if (slot.querySelector(POST_READING_BUTTON)) continue;
    const tweet = slot.closest<HTMLElement>(TWEET);
    if (!tweet?.isConnected || slot.closest(QUOTE_TWEET)) continue;
    tweets.add(tweet);
  }
  for (const tweet of tweets) {
    const startedAt = performance.now();
    processTweet(tweet, "tweet", findLikelyActionRow(tweet));
    recordFeatureTiming("post-reading", "processReservedButtonSlot", startedAt);
  }
}

function removeReadButtons(): void {
  for (const button of Array.from(document.querySelectorAll("[data-post-reading-export-button]"))) button.remove();
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
  kind: TwitterSurface["kind"] = "tweet",
  surfaceActionRow: HTMLElement | null = null,
  surfaceTextContainers: HTMLElement[] = [],
): void {
  const textContainers = surfaceTextContainers.length > 0 && surfaceTextContainers.every((container) => container.isConnected)
    ? surfaceTextContainers
    : kind === "xArticle"
      ? getArticleBodies(tweet)
      : Array.from(tweet.querySelectorAll<HTMLElement>(TWEET_TEXT))
        .filter((container) => !container.closest(QUOTE_TWEET));
  const signature = textContainers.map((container) => container.textContent || "").join("\n").trim();
  if (!signature) return;

  const existingButton = kind === "xArticle"
    ? Array.from(tweet.querySelectorAll<HTMLButtonElement>(POST_READING_BUTTON)).find(button => ownsArticleElement(tweet, button))
    : tweet.querySelector<HTMLButtonElement>(POST_READING_BUTTON);
  const footer = kind === "tweet" ? surfaceActionRow || findLikelyActionRow(tweet) : null;
  const anchor = findButtonAnchor(tweet, footer);
  if (processed.get(tweet) === signature && existingButton) {
    placeReadButton(tweet, existingButton, anchor, footer, kind);
    return;
  }
  // The reading control is cheap; performance limits apply to highlighting,
  // not to whether a user can start reading a long post.
  processed.set(tweet, signature);

  const button = existingButton || createReadButton(tweet);
  placeReadButton(tweet, button, anchor, footer, kind);
}

function placeReadButton(
  tweet: HTMLElement,
  button: HTMLButtonElement,
  anchor: HTMLElement | null,
  footer: HTMLElement | null,
  kind: TwitterSurface["kind"] = "tweet",
): void {
  if (kind === "xArticle") {
    placeArticleReadButton(tweet, button);
    return;
  }
  if (settings.buttonPlacement === "actions") {
    insertActionOverlayButton(button, anchor, footer);
    return;
  }
  if (insertHeaderSlotButton(tweet, button)) return;
  if (anchor?.parentElement && button.parentElement !== anchor.parentElement) {
    const previousSlot = button.closest<HTMLElement>(POST_READING_BUTTON_SLOT);
    anchor.parentElement.insertBefore(button, anchor.nextSibling);
    removeEmptyAdHocButtonSlot(previousSlot);
  } else if (anchor?.parentElement && button.previousSibling !== anchor) {
    const previousSlot = button.closest<HTMLElement>(POST_READING_BUTTON_SLOT);
    anchor.parentElement.insertBefore(button, anchor.nextSibling);
    removeEmptyAdHocButtonSlot(previousSlot);
  }
}

function removeEmptyAdHocButtonSlot(slot: HTMLElement | null): void {
  if (!slot || slot.dataset.milxdyTweetSlot || slot.childElementCount > 0) return;
  slot.remove();
}

function currentPerformanceMode(): string {
  return document.documentElement.dataset.milxdyPerformanceMode || "balanced";
}

function ownsArticleElement(article: HTMLElement, element: HTMLElement): boolean {
  const embeddedPost = element.closest('[data-testid="tweet"], [data-testid="quoteTweet"]');
  return !embeddedPost || !article.contains(embeddedPost);
}

function placeArticleReadButton(article: HTMLElement, button: HTMLButtonElement): void {
  const runtimeSlot = Array.from(article.querySelectorAll<HTMLElement>(RUNTIME_POST_READING_HEADER_SLOT))
    .find(slot => ownsArticleElement(article, slot));
  if (runtimeSlot) {
    const previousSlot = button.closest<HTMLElement>(POST_READING_BUTTON_SLOT);
    if (button.parentElement !== runtimeSlot) runtimeSlot.replaceChildren(button);
    runtimeSlot.removeAttribute("aria-hidden");
    removeEmptyAdHocButtonSlot(previousSlot);
    markHeaderControlHost(runtimeSlot);
    return;
  }
  const previousSlot = button.closest<HTMLElement>(POST_READING_BUTTON_SLOT);
  const slot = previousSlot || document.createElement("span");
  slot.dataset.postReadingButtonSlot = "true";
  slot.className = "post-reading-button-slot post-reading-button-slot--header";
  slot.removeAttribute("aria-hidden");
  if (button.parentElement !== slot) slot.append(button);
  // The article title is prose, not a control host. Keep the reader beside the
  // author's native overflow control, excluding overflow buttons in embeds.
  const caret = Array.from(article.querySelectorAll<HTMLElement>('[data-testid="caret"]'))
    .find((element) => ownsArticleElement(article, element));
  if (caret?.parentElement) {
    if (slot.parentElement !== caret.parentElement || slot.nextSibling !== caret) caret.before(slot);
    slot.parentElement!.dataset.milxdyPostReadingArticleControls = "true";
    article.querySelector('[data-post-reading-article-toolbar]:empty')?.remove();
    return;
  }
  const actionRow = Array.from(article.querySelectorAll<HTMLElement>('[role="group"]'))
    .find((element) => element.querySelector('[data-testid="reply"], [data-testid="like"], [data-testid="unlike"]')
      && ownsArticleElement(article, element));
  if (actionRow) {
    if (slot.parentElement !== actionRow) actionRow.append(slot);
    return;
  }
  // X may hydrate its controls later. Keep one bounded fallback toolbar outside
  // the title/body and move its slot into native controls on the next surface.
  let toolbar = article.querySelector<HTMLElement>('[data-post-reading-article-toolbar]');
  if (!toolbar) {
    toolbar = document.createElement("div");
    toolbar.dataset.postReadingArticleToolbar = "true";
    toolbar.setAttribute("role", "toolbar");
    toolbar.setAttribute("aria-label", "Article reading controls");
    article.prepend(toolbar);
  }
  toolbar.append(slot);
}

function createReadButton(tweet: HTMLElement): HTMLButtonElement {
  return createReadAloudButton(() => {
    player?.show();
    playTweet(tweet);
  });
}

function insertActionOverlayButton(button: HTMLButtonElement, anchor: HTMLElement | null, footer: HTMLElement | null): void {
  const runtimeSlot = footer?.querySelector<HTMLElement>(RUNTIME_POST_READING_SLOT)
    || anchor?.parentElement?.querySelector<HTMLElement>(RUNTIME_POST_READING_SLOT)
    || null;
  if (runtimeSlot) {
    const previousSlot = button.closest<HTMLElement>(POST_READING_BUTTON_SLOT);
    if (button.parentElement !== runtimeSlot || runtimeSlot.childElementCount !== 1) {
      runtimeSlot.replaceChildren(button);
    }
    removeEmptyAdHocButtonSlot(previousSlot);
    runtimeSlot.removeAttribute("aria-hidden");
    return;
  }
  const existingSlot = button.closest<HTMLElement>(POST_READING_BUTTON_SLOT);
  if (existingSlot && !existingSlot.dataset.milxdyTweetSlot) {
    if (anchor?.parentElement && (existingSlot.parentElement !== anchor.parentElement || existingSlot.previousSibling !== anchor)) {
      anchor.parentElement.insertBefore(existingSlot, anchor.nextSibling);
    } else if (!existingSlot.parentElement) {
      footer?.append(existingSlot);
    }
    return;
  }
  const slot = document.createElement("span");
  slot.dataset.postReadingButtonSlot = "true";
  slot.className = "post-reading-button-slot";
  if (button.parentElement !== slot) slot.append(button);
  if (anchor?.parentElement) {
    anchor.parentElement.insertBefore(slot, anchor.nextSibling);
    return;
  }
  footer?.append(slot);
}

function insertHeaderSlotButton(tweet: HTMLElement, button: HTMLButtonElement): boolean {
  const runtimeSlot = tweet.querySelector<HTMLElement>(RUNTIME_POST_READING_HEADER_SLOT);
  if (!runtimeSlot) return false;
  const previousSlot = button.closest<HTMLElement>(POST_READING_BUTTON_SLOT);
  if (button.parentElement !== runtimeSlot || runtimeSlot.childElementCount !== 1) {
    runtimeSlot.replaceChildren(button);
  }
  removeEmptyAdHocButtonSlot(previousSlot);
  runtimeSlot.removeAttribute("aria-hidden");
  markHeaderControlHost(runtimeSlot);
  return true;
}

function markHeaderControlHost(slot: HTMLElement): void {
  let host = slot.parentElement;
  for (let depth = 0; host && depth < 5; depth += 1, host = host.parentElement) {
    const buttons = Array.from(host.querySelectorAll<HTMLElement>('button, [role="button"]'));
    const hasTweetControl = buttons.some((button) => {
      if (isShowMoreExpansionControl(button)) return false;
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
  readingPrivateConversation = false;
  speech.applySettings(settings);
  wikiSpeech.stop();
  clearWikiDocumentSession();
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
  articleSessionIncludesHyperlinks = settings.includeHyperlinks;
  updatePostNavigationAvailability();
  markActiveButton(tweet);
  await enrichFullQuote(readable);
  if (!lifecycleActive() || readRunId !== activeReadRunId) return;
  readable.imageTexts = await extractOcrTexts(tweet);
  if (!lifecycleActive() || readRunId !== activeReadRunId) return;
  const text = formatReadablePost(readable, settings);
  currentHighlightTargets = findHighlightTargets(tweet, text, readable);
  currentOcrSpeechRanges = findOcrSpeechRanges(text, readable.imageTexts);
  speech.speak(text, readable.authorDisplayName);
  tweet.scrollIntoView({ block: "nearest", inline: "nearest", behavior: readingScrollBehavior(false) });
}

function playConversationSnapshot(snapshot: ConversationReading): void {
  if (!lifecycleActive() || !snapshot.text) return;
  activeReadRunId += 1;
  cancelOcr();
  wikiSpeech.stop();
  clearWikiDocumentSession();
  clearBodyHighlight();
  clearFullQuotePreview();
  clearActiveTweets();
  currentTweet = null;
  readingPrivateConversation = true;
  currentOcrSpeechRanges = [];
  currentHighlightTargets = snapshot.bodies.map((target) => ({ ...target, kind: "main" }));
  // Private conversations never leave the browser through a configured HTTP engine.
  speech.applySettings({ ...settings, ttsEngine: "web-speech", autoplayNext: false });
  player.setPostNavigationAvailability({ previous: false, next: false });
  speech.speak(snapshot.text, "Direct messages");
  player.show();
}

function playReadableDocument(target: WikiReadableDocument): void {
  if (!lifecycleActive() || target.source !== "wiki") return;
  const text = target.text.trim();
  if (!text) return;
  activeReadRunId += 1;
  cancelOcr();
  speech.stop();
  clearBodyHighlight();
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
  if (currentOcrRunAbort) {
    currentOcrRunAbort.abort();
    return;
  }
  if (skipActiveOcrSpeechRange()) return;
}

function stopTweetReaderFromUi(): void {
  cancelPendingHighlightWork();
  deferNextIdleHighlightCleanup = true;
  cancelOcr();
  clearFullQuotePreview();
  speech.stop();
}

function pauseTweetReader(): void {
  if (speech?.getState().status === "speaking") speech.pauseOrResume();
}

function pauseWikiReader(): void {
  if (wikiSpeech?.getState().status === "speaking") wikiSpeech.pauseOrResume();
}

function jumpSpeechLine(direction: 1 | -1, controller = speech): void {
  if (!lifecycleActive()) return;
  jumpToAdjacentSpeechBoundary(controller, direction, () => resyncHighlightAfterSpeechJump(controller));
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
  cancelPendingHighlightWork();
  activeHighlightTarget = null;
  lastChunkIndex = null;
  lastBoundaryAt = null;
  lastRelativeIndex = null;
  if (!lifecycleActive()) return;
  const state = controller.getState();
  if (state.status === "idle" || state.status === "error") return;
  if (controller === wikiSpeech) updateWikiDocumentHighlight(state);
  else updateTweetHighlight(state);
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
  currentTweet?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: readingScrollBehavior(false) });
  return true;
}

function updateOcrSkipAvailability(currentIndex: number | null): void {
  if (currentOcrRunAbort || currentOcrImageAbort) {
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
  if (!settings.fetchFullQuotes) return;
  let previewText = readable.quote?.text || "";
  if (readable.quote?.text) {
    renderFullQuotePreview(readable.quote.text, "Quoted post preview - preparing full fetch");
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
    if (!directQuoteUrl) {
      keepTransientStatus = true;
      const urlSummary = getLastEmbeddedQuoteDiagnostic() || (readable.url ? "quote url missing" : "tweet url missing");
      showTransientOcrStatus("Using quoted post preview");
      if (previewText || readable.quote.text) renderFullQuotePreview(previewText || readable.quote.text, "Quoted post preview");
      console.info("Post-reading full quote fallback", { reason: urlSummary });
      recordFullQuoteDiagnostic("direct", {
        status: "fallback",
        used: false,
        reason: urlSummary.replace(/\s+/g, "-"),
        mainUrl: readable.url,
        quoteTextLength: readable.quote.text.length,
      });
    }
    const shouldFetchDirectQuote = Boolean(
      directQuoteUrl
      && settings.fetchFullQuotes
      && (!embeddedQuote?.text || embeddedQuote.truncated),
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
        const summary = summarizeFullQuoteFetch(result);
        showTransientOcrStatus(embeddedQuote?.truncated || !embeddedQuote?.text ? "Using quoted post preview" : "Using fetched quoted post text");
        renderFullQuotePreview(previewText || readable.quote.text, "Quoted post preview");
        console.info("Post-reading full quote fallback", { reason: summary || "not-better-than-preview", attempts: result.attempts || [] });
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
        const summary = summarizeFullQuoteFetch(result);
        showTransientOcrStatus(previewText ? "Using quoted post preview" : fullQuoteStatusText(result.status));
        if (previewText || readable.quote.text) renderFullQuotePreview(previewText || readable.quote.text, "Quoted post preview");
        console.info("Post-reading full quote fallback", { reason: summary || result.status, attempts: result.attempts || [] });
        recordFullQuoteDiagnostic("direct", {
          status: result.status,
          used: false,
          reason: "no-direct-text",
          previousLength: previewText.length,
          url: directQuoteUrl,
        });
      }
    } else if (directQuoteUrl) {
      keepTransientStatus = true;
      const reason = settings.fullQuoteDisplay === "hidden" && !settings.fetchFullQuotes
        ? "disabled"
        : "skipped";
      showTransientOcrStatus(reason === "disabled" ? "Full quote fetch disabled" : "Using quoted post preview");
      if (previewText || readable.quote.text) renderFullQuotePreview(previewText || readable.quote.text, "Quoted post preview");
      console.info("Post-reading full quote fallback", { reason: `direct-fetch-${reason}` });
      recordFullQuoteDiagnostic("direct", {
        status: "fallback",
        used: false,
        reason: `direct-fetch-${reason}`,
        url: directQuoteUrl,
        displayMode: settings.fullQuoteDisplay,
        fetchFullQuotes: settings.fetchFullQuotes,
      });
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

function summarizeFullQuoteFetch(result: FullQuoteFetchResult): string {
  const attempts = result.attempts || [];
  const ok = attempts.find((attempt) => attempt.status === "ok");
  if (ok) return `${ok.source} ${ok.textLength || 0} chars`;
  const failed = attempts.find((attempt) => attempt.status === "error" || attempt.status === "http-error" || attempt.status === "unavailable");
  if (failed) return `${failed.source} ${failed.reason || failed.status}`;
  return result.status === "no-text" ? "no full text found" : result.status;
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
  const previewText = cleanText(fullText);
  if (!previewText || isNonReadableTweetTextArtifact(previewText)) return;
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
  renderFormattedFullQuoteText(body, previewText);
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
  const runAbort = new AbortController();
  currentOcrRunAbort = runAbort;
  const removeLifecycleAbort = abortOnLifecycleSignal(runAbort);
  player.updateOcrStatus({ imageIndex: 0, imageCount: 1, status: "Checking images for OCR", progress: 0.02 });
  const images = findOcrImages(tweet);
  if (images.length === 0) {
    removeLifecycleAbort();
    if (currentOcrRunAbort === runAbort) currentOcrRunAbort = null;
    showTransientOcrStatus("No attached image found for OCR");
    return [];
  }

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

function playAdjacentExplicit(direction: 1 | -1, allowScroll = true): void {
  if (!lifecycleActive() || readingPrivateConversation) return;
  const tweets = timelineTweets();
  const next = findExplicitPostTarget(
    tweets,
    currentTweet,
    direction,
    (tweet) => !settings.skipPromotedPosts || !isPromotedTweet(tweet),
  );
  if (next) {
    playTweet(next);
    next.scrollIntoView({ block: "center", behavior: readingScrollBehavior() });
    return;
  }
  if (!allowScroll) {
    updatePostNavigationAvailability();
    return;
  }
  window.scrollBy({ top: Math.round(window.innerHeight * 0.8) * direction, behavior: readingScrollBehavior() });
  runtimeScheduler.timeout(() => {
    if (!lifecycleActive()) return;
    scheduleScan();
    playAdjacentExplicit(direction, false);
  }, 550);
}

function playAdjacentAutoplay(): void {
  if (!lifecycleActive() || readingPrivateConversation) return;
  const next = findVisibleAutoplayTarget(
    visibleTweets(),
    currentTweet,
    (tweet) => !settings.skipPromotedPosts || !isPromotedTweet(tweet),
  );
  if (next) {
    playTweet(next);
    return;
  }
  if (settings.autoplayMode === "autoscroll" && Date.now() - userScrolledAt > 750) {
    window.scrollBy({ top: Math.round(window.innerHeight * 0.8), behavior: readingScrollBehavior() });
    runtimeScheduler.timeout(() => {
      if (!lifecycleActive()) return;
      scheduleScan();
      const candidate = findVisibleAutoplayTarget(
        visibleTweets().filter((tweet) => tweet.getBoundingClientRect().top > 0),
        currentTweet,
        (tweet) => !settings.skipPromotedPosts || !isPromotedTweet(tweet),
      );
      if (candidate) playTweet(candidate);
    }, 900);
  }
}

function nextTweetOrQuotingText(): void {
  if (currentTweet && isXArticleContainer(currentTweet)) { jumpArticleParagraph(1); return; }
  if (skipActiveOcrSpeechRange()) return;
  if (jumpFromQuoteToMainText()) return;
  playAdjacentExplicit(1);
}

function previousTweetOrStart(): void {
  if (currentTweet && isXArticleContainer(currentTweet)) { jumpArticleParagraph(-1); return; }
  const state = speech.getState();
  const currentIndex = currentSpeechAbsoluteIndex(state);
  if (
    currentTweet
    && (state.status === "speaking" || state.status === "paused")
    && shouldRestartCurrentPost(currentIndex)
  ) {
    speech.jumpToCharIndex(0);
    resyncHighlightAfterSpeechJump();
    updatePostNavigationAvailability();
    currentTweet.scrollIntoView({ block: "nearest", inline: "nearest", behavior: readingScrollBehavior(false) });
    return;
  }
  playAdjacentExplicit(-1);
}

function updatePostNavigationAvailability(): void {
  if (!player || !currentTweet) return;
  const state = speech.getState();
  if (isXArticleContainer(currentTweet)) {
    const index = currentSpeechAbsoluteIndex(state) ?? 0;
    player.setArticleNavigationAvailability({
      previous: currentHighlightTargets.some(target => target.start < index),
      next: currentHighlightTargets.some(target => target.start > index),
    });
    return;
  }
  const tweets = timelineTweets();
  player.setPostNavigationAvailability(postNavigationAvailability(
    tweets,
    currentTweet,
    currentSpeechAbsoluteIndex(state),
    (tweet) => !settings.skipPromotedPosts || !isPromotedTweet(tweet),
  ));
}

function jumpArticleParagraph(direction: 1 | -1): void {
  const state = speech.getState();
  if (state.status !== "speaking" && state.status !== "paused") return;
  const index = currentSpeechAbsoluteIndex(state) ?? 0;
  const targets = currentHighlightTargets.filter(target => target.body.isConnected);
  const target = direction === 1
    ? targets.find(target => target.start > index)
    : [...targets].reverse().find(target => target.start < index);
  if (!target) return;
  speech.jumpToCharIndex(target.start);
  resyncHighlightAfterSpeechJump();
  target.body.scrollIntoView({ block: "nearest", behavior: readingScrollBehavior(false) });
}

function jumpFromQuoteToMainText(): boolean {
  const state = speech.getState();
  if (state.status !== "speaking" && state.status !== "paused") return false;
  const currentIndex = currentSpeechAbsoluteIndex(state);
  if (currentIndex === null) return false;
  const active = currentHighlightTargets.find((target) => currentIndex >= target.start && currentIndex <= target.end);
  if (active?.kind !== "quote") return false;
  const main = currentHighlightTargets.find((target) => target.kind === "main");
  if (!main) return false;
  speech.jumpToCharIndex(main.start);
  resyncHighlightAfterSpeechJump();
  currentTweet?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: readingScrollBehavior(false) });
  return true;
}

function handleKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement | null;
  if (event.key === "Escape") {
    stopTweetReaderFromUi();
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
    [settings.keyPreviousTweet, () => previousTweetOrStart()],
    [settings.keyNextChunk, () => jumpSpeechLine(1)],
    [settings.keyPreviousChunk, () => jumpSpeechLine(-1)],
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
    if (!tweet.isConnected || tweet.parentElement?.closest(TWEET)) return false;
    const rect = tweet.getBoundingClientRect();
    return rect.bottom > 0 && rect.top < viewportHeight;
  });
}

function timelineTweets(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(TWEET)).filter((tweet) => {
    return tweet.isConnected && !tweet.parentElement?.closest(TWEET);
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
    if (isShowMoreExpansionControl(button)) return false;
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
    return isShowMoreExpansionControl(button);
  });
  if (!showMore) return;
  const beforeSignature = tweetReadableTextSignature(tweet);
  showMore.click();
  await waitForTweetTextStabilization(tweet, beforeSignature);
}

function tweetReadableTextSignature(tweet: HTMLElement): string {
  const bodies = getMainTweetBodies(tweet);
  return bodies.map((body) => body.innerText || body.textContent || "").join("\n").replace(/\s+/g, " ").trim();
}

function isShowMoreExpansionControl(button: HTMLElement): boolean {
  const text = (button.innerText || button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
  const label = (button.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().toLowerCase();
  return text === "show more" || label === "show more";
}

function waitForTweetTextStabilization(tweet: HTMLElement, beforeSignature: string): Promise<void> {
  const startedAt = performance.now();
  const minWaitMs = 120;
  const stableMs = 140;
  const timeoutMs = 1200;
  let lastSignature = tweetReadableTextSignature(tweet);
  let lastChangedAt = performance.now();
  return new Promise((resolve) => {
    const check = () => {
      if (!tweet.isConnected) {
        resolve();
        return;
      }
      const now = performance.now();
      const signature = tweetReadableTextSignature(tweet);
      if (signature !== lastSignature) {
        lastSignature = signature;
        lastChangedAt = now;
      }
      const changedFromBefore = signature && signature !== beforeSignature;
      const waitedEnough = now - startedAt >= minWaitMs;
      const stableEnough = now - lastChangedAt >= stableMs;
      if ((changedFromBefore && waitedEnough && stableEnough) || now - startedAt >= timeoutMs) {
        resolve();
        return;
      }
      runtimeScheduler.timeout(check, 50);
    };
    runtimeScheduler.timeout(check, 50);
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
  const activeButton = isXArticleContainer(tweet)
    ? Array.from(tweet.querySelectorAll<HTMLButtonElement>(POST_READING_BUTTON)).find(button => ownsArticleElement(tweet, button))
    : tweet.querySelector<HTMLButtonElement>(POST_READING_BUTTON);
  if (activeButton) {
    activeButton.setAttribute("aria-pressed", "true");
    activeReadButtons.add(activeButton);
  }
}

function updateTweetHighlight(state: HighlightSpeechState): void {
  // Voice priming is intentionally invisible to the post text. The player
  // reports it separately so a silent probe cannot move or paint a cursor.
  if (state.isPriming) return;
  if (currentTweet) updatePostNavigationAvailability();
  if (state.status === "idle") {
    conversationHighlight.clear();
    if (deferNextIdleHighlightCleanup) {
      deferNextIdleHighlightCleanup = false;
      cancelPendingHighlightWork();
      clearEstimatedHighlightLoop();
      clearSmoothAnimation();
      activeHighlightTarget = null;
      activeWordToken = null;
      updateOcrSkipAvailability(null);
      lastChunkIndex = null;
      runtimeScheduler.timeout(() => {
        if (!lifecycleActive() || speech.getState().status !== "idle") return;
        clearBodyHighlight();
        clearActiveTweets();
      }, 120);
      return;
    }
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
  // Do not create a synthetic first-token paint while the utterance is merely
  // queued. A native boundary or the bounded estimated-progress fallback owns
  // the first visible cursor position.
  if (state.hasStarted === false) {
    clearEstimatedHighlightLoop();
    return;
  }
  if (currentTweet) {
    currentTweet.dataset.postReadingActive = "true";
    currentTweet.dataset.postReadingActiveBackground = String(settings.activeTweetHighlight);
    activeTweets.add(currentTweet);
  }
  if ((!currentTweet && !readingPrivateConversation) || settings.bodyHighlightMode === "off") {
    clearEstimatedHighlightLoop();
    return;
  }
  if (currentHighlightTargets.length === 0) {
    recordHighlightPaintDiagnostic("no-targets", state, null, null, null, null, null, settings.bodyHighlightMode);
    return;
  }
  highlightProgressClock.observe(state, performance.now());
  updateEstimatedHighlightLoop(state);
  const chunkChanged = lastChunkIndex !== null && state.chunkIndex !== lastChunkIndex;
  lastChunkIndex = state.chunkIndex;
  const absoluteIndex = currentSpeechAbsoluteIndex(state);
  updateOcrSkipAvailability(absoluteIndex);
  if (absoluteIndex === null) return;

  const target = findActiveHighlightTarget(absoluteIndex);
  if (readingPrivateConversation) {
    // React owns message text/markup. Paint original ranges; never tokenize or restore it.
    if (target) conversationHighlight.paint(target.body, target.text, absoluteIndex - target.start);
    else conversationHighlight.clear();
    return;
  }
  if (!target) {
    recordHighlightPaintDiagnostic("no-active-target", state, null, null, null, null, null, settings.bodyHighlightMode, absoluteIndex);
    return;
  }
  const targetChanged = activeHighlightTarget !== target;
  activateHighlightTarget(target);
  const body = target.body;
  const relativeIndex = absoluteIndex - target.start;
  const configuredHighlightMode = effectiveHighlightMode(target);
  const highlightMode = configuredHighlightMode;

  if (highlightMode !== "smooth") {
    if (!canTokenizeHighlightTarget(target, highlightMode)) {
      clearSmoothAnimation();
      recordHighlightPaintDiagnostic("word-tokenize-skip", state, target, null, null, null, null, highlightMode, absoluteIndex);
      return;
    }
    const words = prepareWordBody(body);
    const currentWord = findCurrentWordToken(words, relativeIndex, state.charLength);
    paintCurrentWord(currentWord);
    recordHighlightPaintDiagnostic(currentWord ? "word-painted" : "word-no-token", state, target, null, words, currentWord, null, highlightMode, absoluteIndex);
    scrollFullQuoteWordIntoView(currentWord);
    return;
  }

  if (!canTokenizeHighlightTarget(target, highlightMode)) {
    clearSmoothAnimation();
      recordHighlightPaintDiagnostic("smooth-tokenize-skip", state, target, null, null, null, null, highlightMode, absoluteIndex);
    return;
  }

  const paintTarget = resolveSmoothPaintTarget(target, absoluteIndex);
  const segmentChanged = activeHighlightSegment !== paintTarget.segment;
  if (segmentChanged) restorePreviousSmoothSegment(paintTarget.segment);
  activeHighlightSegment = paintTarget.segment;

  const tokenizeStartedAt = performance.now();
  const articleBody = currentTweet && isXArticleContainer(currentTweet) && !paintTarget.segment;
  const words = prepareSmoothBody(paintTarget.body, articleBody ? undefined : paintTarget.text);
  const tokenizeMs = performance.now() - tokenizeStartedAt;
  const highlightJumped = targetChanged || segmentChanged || didHighlightDiscontinuity(paintTarget.relativeIndex, chunkChanged);
  updateBoundaryCalibration(paintTarget.relativeIndex);
  highlightEngine.updateBaselineReadingSpeed(settings.speed);
  if (highlightJumped) {
    resetSmoothTokenFill(words);
    highlightEngine.resetSmoothTracking(paintTarget.body);
  }
  if (state.status !== "speaking") {
    highlightEngine.suspendSmoothTracking(paintTarget.relativeIndex);
  }
  const paintStartedAt = performance.now();
  const currentWord = highlightEngine.paintSmooth(words, paintTarget.relativeIndex, {
    charLength: state.charLength,
    textLength: paintTarget.text.length,
    snapToCurrent: highlightJumped || state.status !== "speaking",
    animate: true,
    boundaryElapsedTime: state.boundaryElapsedTime ?? null,
  });
  const paintMs = performance.now() - paintStartedAt;
  recordHighlightTimingDiagnostic(target, paintTarget, words, tokenizeMs, paintMs);
  recordHighlightPaintDiagnostic(currentWord ? "smooth-painted" : "smooth-no-token", state, target, null, words, currentWord, highlightJumped ? "reset" : null, highlightMode, absoluteIndex);
  scrollFullQuoteWordIntoView(currentWord);
}

function updateEstimatedHighlightLoop(state: HighlightSpeechState): void {
  if (state.status !== "speaking" || state.hasStarted === false) return;
  const delay = highlightProgressClock.nextUpdateDelay(state, performance.now());
  if (delay === null) return;
  if (estimatedHighlightTimer !== null) window.clearTimeout(estimatedHighlightTimer);
  estimatedHighlightTimer = window.setTimeout(() => {
    estimatedHighlightTimer = null;
    if (!speech || !lifecycleActive()) return;
    const nextState = speech.getState();
    if (nextState.status === "speaking") updateTweetHighlight(nextState);
  }, delay);
}

function clearEstimatedHighlightLoop(): void {
  if (estimatedHighlightTimer !== null) {
    window.clearTimeout(estimatedHighlightTimer);
    estimatedHighlightTimer = null;
  }
  estimatedHighlightKey = "";
  estimatedHighlightStartedAt = 0;
  estimatedHighlightPausedAt = null;
  highlightProgressClock.reset();
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
  const maxChunkLength = 1200;
  const minBoundaryLength = 650;
  if (remaining.length <= maxChunkLength) return text.length;
  const slice = remaining.slice(0, maxChunkLength);
  const paragraphBoundary = slice.lastIndexOf("\n\n");
  const sentenceBoundary = Math.max(slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
  const softBoundary = Math.max(paragraphBoundary, sentenceBoundary);
  const fallbackBoundary = slice.lastIndexOf(", ");
  const boundary = softBoundary > minBoundaryLength
    ? softBoundary
    : fallbackBoundary > minBoundaryLength
      ? fallbackBoundary
      : Math.min(maxChunkLength, remaining.length);
  return chunkStart + (boundary < maxChunkLength ? boundary + 1 : boundary);
}

function canTokenizeHighlightTarget(target: HighlightTarget, mode: BodyHighlightMode): boolean {
  if (mode === "off") return false;
  const body = target.body;
  const hasExistingTokens = Boolean(body.querySelector('[data-post-reading-word="true"], [data-post-reading-smooth-word="true"]'));
  if (hasExistingTokens) return true;
  const policy = postReadingPerformancePolicy();
  if (mode === "smooth" && target.segments && target.segments.length > 0) return true;
  const charLimit = mode === "word" ? wordHighlightCharLimit(policy) : policy.maxHighlightChars;
  const tokenEstimate = cachedHighlightTokenEstimate(target);
  if (target.text.length > charLimit) {
    recordHighlightTokenizationSkip(target, mode, "char-cap", tokenEstimate);
    return false;
  }
  if (mode === "smooth" && tokenEstimate > policy.maxHighlightTokens) {
    recordHighlightTokenizationSkip(target, mode, "token-cap", tokenEstimate);
    return false;
  }
  return true;
}

function currentSpeechAbsoluteIndex(state: HighlightSpeechState): number | null {
  if (state.chunkStart === null) return null;
  return highlightProgressClock.resolveIndex(
    state,
    performance.now(),
    calibratedCharsPerSecond,
    findEstimatedChunkEnd(state.text || "", state.chunkStart),
  ) ?? estimateUnsyncedHighlightIndex(state) ?? state.chunkStart;
}

function cachedHighlightTokenEstimate(target: HighlightTarget): number {
  const cached = highlightTokenEstimateCache.get(target);
  if (cached?.text === target.text) return cached.value;
  const value = target.text.length > 4000
    ? Math.ceil(target.text.length / 7)
    : estimateHighlightTokenCount(target.text);
  highlightTokenEstimateCache.set(target, { text: target.text, value });
  return value;
}

function wordHighlightCharLimit(policy: PostReadingPerformancePolicy): number {
  if (!Number.isFinite(policy.maxHighlightChars)) return Number.POSITIVE_INFINITY;
  return Math.max(policy.maxHighlightChars * 8, 12000);
}

function recordHighlightTokenizationSkip(
  target: HighlightTarget,
  mode: BodyHighlightMode,
  reason: "char-cap" | "token-cap",
  tokenEstimate: number,
): void {
  const performanceMode = currentPerformanceMode();
  const signature = `skip:${performanceMode}:${mode}:${target.kind}:${reason}:${Math.round(target.text.length / 100)}:${Math.round(tokenEstimate / 20)}`;
  if (signature === lastHighlightDiagnosticSignature) return;
  lastHighlightDiagnosticSignature = signature;
  recordRuntimeDiagnostic("highlight", {
    configured: settings.bodyHighlightMode,
    effective: "off",
    skippedMode: mode,
    performanceMode,
    target: target.kind,
    textLength: target.text.length,
    tokenEstimate,
    reason,
    updatedAt: Date.now(),
  });
}

export function effectiveHighlightMode(target: HighlightTarget): BodyHighlightMode {
  const motionMode = reducedMotionHighlightMode(settings.bodyHighlightMode, window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  if (motionMode !== "smooth") return motionMode;
  const performanceMode = document.documentElement.dataset.milxdyPerformanceMode || "balanced";
  const tokenEstimate = cachedHighlightTokenEstimate(target);
  const { mode, reason } = resolveContinuousHighlightMode(
    settings.bodyHighlightMode,
    performanceMode,
    target.text.length,
    tokenEstimate,
  );
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


function recordHighlightPaintDiagnostic(
  reason: string,
  state: HighlightSpeechState,
  target: HighlightTarget | null,
  window: { key: string; start: number; end: number; windowed: boolean } | null,
  tokens: HTMLElement[] | null,
  currentToken: HTMLElement | null,
  resetReason: string | null,
  mode: BodyHighlightMode,
  absoluteIndex: number | null = state.charIndex ?? state.chunkStart,
): void {
  const tokenStartValue = currentToken ? Number(currentToken.dataset.postReadingStart || 0) : null;
  const tokenLengthValue = currentToken ? Number(currentToken.dataset.postReadingLength || currentToken.textContent?.length || 0) : null;
  const tokenEndValue = tokenStartValue !== null && tokenLengthValue !== null ? tokenStartValue + tokenLengthValue : null;
  const signature = [
    reason,
    mode,
    state.status,
    state.hasSyncedBoundaries ? "synced" : "estimated",
    target?.kind || "none",
    Math.floor((absoluteIndex ?? -1) / 20),
    window?.key || "none",
    tokens?.length ?? -1,
    tokenStartValue === null ? "none" : Math.floor(tokenStartValue / 20),
    resetReason || "none",
  ].join(":");
  if (signature === lastHighlightPaintDiagnosticSignature) return;
  lastHighlightPaintDiagnosticSignature = signature;
  recordRuntimeDiagnostic("highlightPaint", {
    reason,
    mode,
    status: state.status,
    hasSyncedBoundaries: state.hasSyncedBoundaries,
    charIndex: state.charIndex,
    chunkStart: state.chunkStart,
    absoluteIndex,
    charLength: state.charLength,
    targetKind: target?.kind ?? null,
    targetStart: target?.start ?? null,
    targetEnd: target?.end ?? null,
    targetTextLength: target?.text.length ?? null,
    relativeIndex: target && absoluteIndex !== null ? absoluteIndex - target.start : null,
    windowKey: window?.key ?? null,
    windowStart: window?.start ?? null,
    windowEnd: window?.end ?? null,
    windowed: window?.windowed ?? null,
    tokenCount: tokens?.length ?? null,
    currentTokenStart: tokenStartValue,
    currentTokenEnd: tokenEndValue,
    currentTokenText: currentToken?.textContent?.slice(0, 40) ?? null,
    resetReason,
    updatedAt: Date.now(),
  });
}

function didHighlightDiscontinuity(relativeIndex: number, chunkChanged: boolean): boolean {
  return isSmoothHighlightDiscontinuity(lastRelativeIndex, relativeIndex, calibratedCharsPerSecond, chunkChanged);
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
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "word" : "smooth";
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
  if (isXArticleContainer(tweet)) return getArticleBodies(tweet);
  return Array.from(tweet.querySelectorAll<HTMLElement>(TWEET_TEXT));
}

function getMainTweetBody(tweet: HTMLElement): HTMLElement | null {
  return getMainTweetBodies(tweet)[0] || null;
}

function getMainTweetBodies(tweet: HTMLElement): HTMLElement[] {
  if (isXArticleContainer(tweet)) {
    const bodies = getArticleBodies(tweet);
    return bodies;
  }
  const bodies = getTweetBodies(tweet);
  const mainBodies = bodies.filter((body) => !body.closest(QUOTE_TWEET));
  return mainBodies.length > 0 ? mainBodies : bodies.slice(0, 1);
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
  const removedSegmentSurfaces = removeAllSegmentSurfaces();
  let restoredBodies = 0;
  for (const body of highlightedBodies) {
    restoreHighlightedBody(body);
    restoredBodies += 1;
  }
  recordSegmentCleanupDiagnostic(restoredBodies, removedSegmentSurfaces);
  highlightedBodies = new Set();
  activeHighlightTarget = null;
  activeHighlightSegment = null;
  currentHighlightTargets = [];
}

function removeAllSegmentSurfaces(): number {
  let removed = 0;
  for (const target of currentHighlightTargets) {
    if (removeSegmentSurfaceForTarget(target)) removed += 1;
  }
  return removed;
}

function cancelPendingHighlightWork(): void {
  highlightWorkGeneration += 1;
  clearSmoothAnimation();
}

function clearHighlightVisuals(): void {
  conversationHighlight.clear();
  clearEstimatedHighlightLoop();
  clearSmoothAnimation();
  activeWordToken = null;
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
  activeHighlightSegment = null;
}


function saveOriginalBody(body: HTMLElement, bodies: HTMLElement[] = [body]): void {
  for (const item of Array.from(new Set([body, ...bodies]))) {
    highlightedBodies.add(item);
  }
}

function restoreHighlightedBody(body: HTMLElement): void {
  removeSegmentSurfaceForBody(body);
  highlightEngine.restoreOriginalElement(body);
}

function prepareSmoothBody(body: HTMLElement, textOverride?: string): HTMLElement[] {
  return prepareTokenizedBody(body, "smooth", settings.includeHyperlinks, textOverride);
}

function isXArticleContainer(element: HTMLElement): boolean {
  return isXArticleSurface(element);
}

function getArticleBodies(article: HTMLElement): HTMLElement[] {
  return extractXArticleTextContainers(article);
}

function prepareWordBody(body: HTMLElement): HTMLElement[] {
  return prepareTokenizedBody(body, "word", settings.includeHyperlinks);
}

function prepareTokenizedBody(
  body: HTMLElement,
  mode: "word" | "smooth",
  includeHyperlinks: boolean,
  textOverride?: string,
): HTMLElement[] {
  saveOriginalBody(body);
  const article = currentTweet && isXArticleContainer(currentTweet);
  const visible = new WeakMap<Element, boolean>();
  const rendered = (element: HTMLElement | null): boolean => {
    if (!element) return true;
    const cached = visible.get(element);
    if (cached !== undefined) return cached;
    const style = getComputedStyle(element);
    const result = !element.hidden && element.getAttribute("aria-hidden") !== "true"
      && style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse"
      && (element === body || rendered(element.parentElement));
    visible.set(element, result);
    return result;
  };
  return highlightEngine.prepareTokens(body, mode, {
    includeTextNode: (node) => (!article || rendered(node.parentElement))
      && !isSkippedReadableHyperlinkText(node, article ? articleSessionIncludesHyperlinks : includeHyperlinks),
    textOverride,
    smoothReadableLength: typeof textOverride === "string",
    spokenText: article ? currentHighlightTargets.find(target => target.body === body)?.text : undefined,
  });
}

function resolveSmoothPaintTarget(
  target: HighlightTarget,
  absoluteIndex: number,
): { body: HTMLElement; segment: HighlightSegment | null; relativeIndex: number; text: string } {
  const segment = findActiveHighlightSegment(target, absoluteIndex);
  if (!segment) {
    return {
      body: target.body,
      segment: null,
      relativeIndex: absoluteIndex - target.start,
      text: target.text,
    };
  }
  materializeSmoothSegment(target, segment);
  return {
    body: segment.body,
    segment,
    relativeIndex: Math.max(0, Math.min(segment.text.length, absoluteIndex - segment.start)),
    text: segment.text,
  };
}

function findActiveHighlightSegment(target: HighlightTarget, absoluteIndex: number): HighlightSegment | null {
  if (!target.segments || target.segments.length === 0) return null;
  return target.segments.find((segment) => absoluteIndex >= segment.start && absoluteIndex <= segment.end) || target.segments[0] || null;
}

function materializeSmoothSegment(target: HighlightTarget, segment: HighlightSegment): void {
  if (!target.segments || target.segments.length === 0) return;
  if (target.segmentSurface?.isConnected && target.activeSegment === segment && segment.body.isConnected) return;
  saveOriginalBody(target.body, target.bodies);
  if (target.activeSegment?.body.isConnected) {
    highlightEngine.restoreOriginalElement(target.activeSegment.body);
  }
  const surface = target.segmentSurface?.isConnected ? target.segmentSurface : document.createElement("span");
  if (!target.segmentSurface?.isConnected) {
    surface.dataset.postReadingSegmentSurface = "true";
    surface.dataset.postReadingSegmentSourceHidden = "false";
    surface.className = "post-reading-segment-surface";
    applySegmentSurfaceStyle(target.body, surface);
    target.body.insertAdjacentElement("afterend", surface);
    target.body.dataset.postReadingSegmentSourceHidden = "true";
    target.segmentSurface = surface;
  }
  surface.textContent = "";
  const fragment = document.createDocumentFragment();
  const relativeStart = Math.max(0, segment.start - target.start);
  const relativeEnd = Math.max(relativeStart, segment.end - target.start);
  const before = target.text.slice(0, relativeStart);
  const after = target.text.slice(relativeEnd);
  if (before) fragment.append(document.createTextNode(before));
  const wrapper = document.createElement("span");
  wrapper.dataset.postReadingSegment = "true";
  wrapper.dataset.postReadingSegmentStart = String(segment.start);
  wrapper.dataset.postReadingSegmentEnd = String(segment.end);
  wrapper.style.whiteSpace = "pre-wrap";
  wrapper.textContent = segment.text;
  segment.body = wrapper;
  surface.append(fragment);
  surface.append(wrapper);
  if (after) surface.append(document.createTextNode(after));
  target.activeSegment = segment;
  recordSmoothSegmentDiagnostic(target);
}

function applySegmentSurfaceStyle(source: HTMLElement, surface: HTMLElement): void {
  const style = window.getComputedStyle(source);
  const properties = [
    "box-sizing",
    "color",
    "direction",
    "font-family",
    "font-feature-settings",
    "font-kerning",
    "font-optical-sizing",
    "font-size",
    "font-size-adjust",
    "font-stretch",
    "font-style",
    "font-synthesis",
    "font-variant",
    "font-variant-caps",
    "font-variant-east-asian",
    "font-variant-ligatures",
    "font-variant-numeric",
    "font-variation-settings",
    "font-weight",
    "letter-spacing",
    "line-height",
    "tab-size",
    "text-align",
    "text-decoration-color",
    "text-decoration-line",
    "text-decoration-style",
    "text-decoration-thickness",
    "text-indent",
    "text-rendering",
    "text-shadow",
    "text-transform",
    "unicode-bidi",
    "word-break",
    "word-spacing",
  ];
  for (const property of properties) {
    const value = style.getPropertyValue(property);
    if (value) surface.style.setProperty(property, value);
  }
  surface.style.setProperty("display", blockLikeDisplay(style.display));
  surface.style.setProperty("white-space", style.whiteSpace === "normal" ? "pre-wrap" : style.whiteSpace);
  surface.style.setProperty("overflow-wrap", style.overflowWrap || "anywhere");
  surface.style.setProperty("width", style.width);
  surface.style.setProperty("max-width", style.maxWidth);
  if (source.getAttribute("dir")) surface.setAttribute("dir", source.getAttribute("dir") || "");
  if (source.getAttribute("lang")) surface.setAttribute("lang", source.getAttribute("lang") || "");
}

function blockLikeDisplay(display: string): string {
  if (display === "inline" || display === "contents") return "block";
  if (display.includes("flex") || display.includes("grid") || display === "none") return "block";
  return display || "block";
}

function restorePreviousSmoothSegment(nextSegment: HighlightSegment | null): void {
  const previous = activeHighlightSegment;
  if (!previous || previous === nextSegment || !previous.body.isConnected) return;
  highlightEngine.restoreOriginalElement(previous.body);
}

function removeSegmentSurfaceForBody(body: HTMLElement): void {
  delete body.dataset.postReadingSegmentSourceHidden;
  const surface = body.nextElementSibling;
  if (surface instanceof HTMLElement && surface.dataset.postReadingSegmentSurface === "true") {
    surface.remove();
  }
}

function removeSegmentSurfaceForTarget(target: HighlightTarget): boolean {
  let removed = false;
  if (target.segmentSurface?.isConnected) {
    target.segmentSurface.remove();
    removed = true;
  }
  target.segmentSurface = undefined;
  target.activeSegment = undefined;
  delete target.body.dataset.postReadingSegmentSourceHidden;
  return removed;
}

function recordSmoothSegmentDiagnostic(target: HighlightTarget): void {
  const segments = target.segments || [];
  const active = activeHighlightSegment || segments[0] || null;
  const activeTokenEstimate = active ? estimateHighlightTokenCount(active.text) : null;
  const signature = [
    "segment",
    target.kind,
    Math.round(target.text.length / 100),
    segments.length,
    active ? Math.round(active.text.length / 50) : "none",
  ].join(":");
  if (signature === lastSmoothSegmentDiagnosticSignature) return;
  lastSmoothSegmentDiagnosticSignature = signature;
  recordRuntimeDiagnostic("highlightSegment", {
    targetKind: target.kind,
    targetTextLength: target.text.length,
    targetTokenEstimate: cachedHighlightTokenEstimate(target),
    segmentCount: segments.length,
    activeSegmentTextLength: active?.text.length ?? null,
    activeSegmentTokenEstimate: activeTokenEstimate,
    renderSurface: "extension-owned-sibling-active-segment",
    sourceDomStrategy: "hidden-not-replaced",
    updatedAt: Date.now(),
  });
}

function recordSegmentCleanupDiagnostic(restoredBodies: number, removedSegmentSurfaces: number): void {
  if (restoredBodies <= 0 && removedSegmentSurfaces <= 0) return;
  recordRuntimeDiagnostic("highlightCleanup", {
    restoredBodies,
    removedSegmentSurfaces,
    remainingSegmentSurfaces: document.querySelectorAll('[data-post-reading-segment-surface="true"]').length,
    remainingTokenCount: document.querySelectorAll('[data-post-reading-word="true"], [data-post-reading-smooth-word="true"]').length,
    updatedAt: Date.now(),
  });
}

function recordHighlightTimingDiagnostic(
  target: HighlightTarget,
  paintTarget: { body: HTMLElement; segment: HighlightSegment | null; relativeIndex: number; text: string },
  tokens: HTMLElement[],
  tokenizeMs: number,
  paintMs: number,
): void {
  const signature = [
    target.kind,
    paintTarget.segment ? "segment" : "full",
    Math.round(target.text.length / 200),
    Math.round(paintTarget.text.length / 50),
    Math.round(tokens.length / 10),
    Math.round(paintTarget.relativeIndex / 40),
  ].join(":");
  if (signature === lastHighlightTimingDiagnosticSignature) return;
  lastHighlightTimingDiagnosticSignature = signature;
  recordRuntimeDiagnostic("highlightPaintTiming", {
    targetKind: target.kind,
    targetTextLength: target.text.length,
    targetTokenEstimate: cachedHighlightTokenEstimate(target),
    activeSegmentTextLength: paintTarget.text.length,
    activeSegmentTokenCount: tokens.length,
    segmented: Boolean(paintTarget.segment),
    relativeIndex: paintTarget.relativeIndex,
    tokenizeMs: Math.round(tokenizeMs * 10) / 10,
    paintMs: Math.round(paintMs * 10) / 10,
    forcedLayoutReads: 0,
    detachedTokenCount: tokens.filter((token) => !token.isConnected).length,
    updatedAt: Date.now(),
  });
}

function isSkippedReadableHyperlinkText(node: Text, includeHyperlinks: boolean): boolean {
  if (includeHyperlinks) return false;
  const parent = node.parentElement;
  const link = parent?.closest<HTMLAnchorElement>("a[href]");
  return Boolean(link && isReadableHyperlink(link));
}

function resetBodyTokenizationForMode(body: HTMLElement, mode: "word" | "smooth"): void {
  if (!body.dataset.postReadingHighlightMode || body.dataset.postReadingHighlightMode === mode) return;
  restoreHighlightedBody(body);
}

function findHighlightTargets(tweet: HTMLElement, spokenText: string, post: ReadablePost): HighlightTarget[] {
  if (isXArticleContainer(tweet)) return findArticleHighlightTargets(tweet, spokenText, post);

  const targets: HighlightTarget[] = [];
  const quoteBody = post.quote ? getQuoteTweetBody(tweet) : null;
  const quoteRange = post.quote && quoteBody ? findBodyRange(spokenText, post.quote.text, "first") : null;
  if (quoteBody && quoteRange) {
    targets.push({ body: quoteBody, kind: "quote", ...quoteRange });
  }

  const mainBodies = post.text ? getMainTweetBodies(tweet) : [];
  const mainBody = mainBodies[0] || null;
  const mainRange = post.text && mainBody ? findBodyRange(spokenText, post.text, "last") : null;
  if (mainBody && mainRange) {
    const target: HighlightTarget = { body: mainBody, bodies: mainBodies, kind: "main", ...mainRange };
    target.segments = buildSmoothHighlightSegments(target);
    targets.push(target);
  }

  return targets.sort((left, right) => left.start - right.start);
}

function buildSmoothHighlightSegments(target: HighlightTarget): HighlightSegment[] | undefined {
  if (target.kind !== "main") return undefined;
  if (target.text.length < SMOOTH_SEGMENT_TEXT_THRESHOLD && estimateHighlightTokenCount(target.text) <= postReadingPerformancePolicy().maxHighlightTokens) {
    return undefined;
  }
  const segments: HighlightSegment[] = [];
  let cursor = 0;
  while (cursor < target.text.length) {
    const end = nextSmoothSegmentEnd(target.text, cursor);
    if (end <= cursor) break;
    const text = target.text.slice(cursor, end);
    if (text) {
      segments.push({
        body: target.body,
        start: target.start + cursor,
        end: target.start + end,
        text,
      });
    }
    cursor = end;
  }
  return segments.length > 1 ? segments : undefined;
}

function nextSmoothSegmentEnd(text: string, start: number): number {
  const maxEnd = Math.min(text.length, start + SMOOTH_SEGMENT_MAX_CHARS);
  if (maxEnd >= text.length) return text.length;
  const minEnd = Math.min(maxEnd, start + SMOOTH_SEGMENT_MIN_BREAK_CHARS);
  const slice = text.slice(start, maxEnd);
  const candidates = [
    slice.lastIndexOf("\n\n"),
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("; "),
    slice.lastIndexOf(", "),
  ].filter((index) => index >= SMOOTH_SEGMENT_MIN_BREAK_CHARS);
  const boundary = candidates.length > 0 ? Math.max(...candidates) + 2 : -1;
  if (boundary > 0) return start + boundary;
  const whitespace = slice.lastIndexOf(" ");
  if (whitespace >= minEnd - start) return start + whitespace + 1;
  return maxEnd;
}

function findArticleHighlightTargets(article: HTMLElement, spokenText: string, post: ReadablePost): HighlightTarget[] {
  const targets: HighlightTarget[] = [];
  let cursor = 0;
  for (const body of getArticleBodies(article)) {
    const text = extractReadableArticleBlock(body, articleSessionIncludesHyperlinks);
    if (!text) continue;
    const range = findBodyRange(spokenText, text, "first", cursor);
    if (!range) continue;
    const target: HighlightTarget = { body, kind: "main", ...range };
    target.segments = buildSmoothHighlightSegments(target);
    targets.push(target);
    cursor = range.end;
  }
  if (targets.length === 0) {
    const body = getMainTweetBody(article);
    const range = post.text && body ? findBodyRange(spokenText, post.text, "last") : null;
    if (body && range) targets.push({ body, kind: "main", ...range });
  }
  return targets.sort((left, right) => left.start - right.start);
}

function findActiveHighlightTarget(charIndex: number): HighlightTarget | null {
  return currentHighlightTargets.find((target) => charIndex >= target.start && charIndex <= target.end) || null;
}

function activateHighlightTarget(target: HighlightTarget): void {
  if (activeHighlightTarget === target) return;
  restoreInactiveHighlightBodies(target.body);
  activeHighlightTarget = target;
  activeHighlightSegment = null;
  activeWordToken = null;
  lastBoundaryAt = null;
  lastRelativeIndex = null;
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
    restoreHighlightedBody(body);
    highlightedBodies.delete(body);
  }
}

function isFullQuoteBody(body: HTMLElement): boolean {
  return Boolean(body.closest('[data-post-reading-full-quote="true"]'));
}

function findNearestToken(words: HTMLElement[], relativeIndex: number): HTMLElement | null {
  let nearest: HTMLElement | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const word of words) {
    const start = Number(word.dataset.postReadingStart || 0);
    const length = Number(word.dataset.postReadingLength || word.textContent?.length || 0);
    const end = start + length;
    if (relativeIndex >= start && relativeIndex < end) return word;
    const distance = relativeIndex < start ? start - relativeIndex : relativeIndex - end;
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = word;
    }
  }
  return nearest || words[0] || null;
}

function findCurrentWordToken(words: HTMLElement[], relativeIndex: number, charLength: number | null): HTMLElement | null {
  return highlightEngine.findCurrentToken(words, relativeIndex, charLength);
}

function resetSmoothTokenFill(tokens: HTMLElement[]): void {
  highlightEngine.resetSmoothTokenFill(tokens);
}

function paintCurrentWord(currentWord: HTMLElement | null): void {
  if (activeWordToken && activeWordToken !== currentWord) {
    delete activeWordToken.dataset.postReadingCurrentWord;
  }
  if (currentWord) currentWord.dataset.postReadingCurrentWord = "true";
  activeWordToken = currentWord;
}

function clearSmoothAnimation(options: { completePending?: boolean } = {}): void {
  highlightEngine.clearSmoothAnimation(options);
}

function recordSmoothAnimationDiagnostic(diagnostic: {
  tokenCount: number;
  animatedTokenCount: number;
  durationMs: number;
  interrupted?: boolean;
  pendingToIndex?: number;
  boundaryIndex?: number;
  catchUpActive?: boolean;
}): void {
  const { tokenCount, animatedTokenCount, durationMs, interrupted, pendingToIndex, boundaryIndex, catchUpActive } = diagnostic;
  const signature = [
    document.documentElement.dataset.milxdyPerformanceMode || "balanced",
    Math.round(tokenCount / 12),
    Math.round(animatedTokenCount / 8),
    Math.round(durationMs / 100),
    interrupted ? "interrupted" : "normal",
    catchUpActive ? "catchup" : "steady",
  ].join(":");
  if (signature === lastSmoothAnimationDiagnosticSignature) return;
  lastSmoothAnimationDiagnosticSignature = signature;
  recordRuntimeDiagnostic("highlightAnimation", {
    mode: "css-transition",
    tokenCount,
    animatedTokenCount,
    durationMs,
    interrupted: Boolean(interrupted),
    pendingToIndex,
    boundaryIndex,
    catchUpActive: Boolean(catchUpActive),
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
  highlightEngine.updateBaselineReadingSpeed(settings.speed);
  highlightEngine.resetSmoothTracking();
}

function estimateHighlightTokenCount(text: string): number {
  return estimateSharedHighlightTokenCount(text);
}
