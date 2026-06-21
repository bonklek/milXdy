import { loadDenyTerms, loadLocalAliases, localAliasesToEntries, savePerformanceStats } from "./localData";
import { createMatcher } from "./matcher";
import { attachPreviewHandlers, installPreviewDismissHandlers } from "./preview";
import { loadSettings, observeSettings } from "./settings";
import { injectStyles } from "./styles";
import type { Settings, WikiMatch } from "./types";
import { scheduleTwitterScan, subscribeTwitterSurfaces } from "../../shared/twitterScanner";

const TWEET = 'article[data-testid="tweet"]';
const TWEET_TEXT = '[data-testid="tweetText"]';
const LINK_DATA_ATTR = "data-remilia-wiki-hyperlink";
const LINK_DATA_KEY = "remiliaWikiHyperlink";
let processed = new WeakMap<HTMLElement, string>();
const pendingTweets = new Set<HTMLElement>();

let settings: Settings;
let matchWikiText = createMatcher();
let scanScheduled = false;
let statsFlushTimer: number | null = null;
const perfStats = {
  tweetsScanned: 0,
  linksCreated: 0,
  matchingMs: 0,
  skippedWholeTweet: 0,
  skippedLowConfidence: 0,
};

void boot();

async function boot(): Promise<void> {
  injectStyles();
  installPreviewDismissHandlers();
  settings = await loadSettings();
  await reloadLocalMatcher();
  applySettings(settings);
  observeSettings((next) => {
    settings = next;
    applySettings(next);
    processed = new WeakMap<HTMLElement, string>();
    scheduleTwitterScan();
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (changes["remiliaWikiHyperlink.localAliases"] || changes["remiliaWikiHyperlink.denyTerms"]) {
      void reloadLocalMatcher().then(() => {
        processed = new WeakMap<HTMLElement, string>();
        scheduleTwitterScan();
      });
    }
  });

  document.addEventListener("remilia-wiki-hyperlink:process-container", (event) => {
    if (!settings.enabled) return;
    const container = (event as CustomEvent<{ container?: HTMLElement }>).detail?.container;
    if (!(container instanceof HTMLElement) || !container.isConnected) return;
    const signature = container.textContent || "";
    if (!signature.trim()) return;
    const result = linkContainer(container, settings.maxLinksPerPost, settings.maxLowConfidenceLinksPerPost, signature);
    perfStats.linksCreated += result.linked;
    if (result.linked > 0) scheduleStatsFlush();
  });

  subscribeTwitterSurfaces((surface) => {
    if (surface.kind !== "tweet") return;
    pendingTweets.add(surface.element);
    schedulePendingScan();
  });
  scheduleTwitterScan();
}

async function reloadLocalMatcher(): Promise<void> {
  const [aliases, denyTerms] = await Promise.all([loadLocalAliases(), loadDenyTerms()]);
  matchWikiText = createMatcher(localAliasesToEntries(aliases), denyTerms);
}

function applySettings(next: Settings): void {
  document.documentElement.style.setProperty("--remilia-wiki-link-color", next.linkColor);
  document.documentElement.dataset.remiliaWikiDebug = next.debugMode ? "true" : "false";
}

function schedulePendingScan(): void {
  if (scanScheduled) return;
  scanScheduled = true;
  queueMicrotask(() => {
    scanScheduled = false;
    processPendingTweets();
  });
}

function processPendingTweets(): void {
  if (!settings.enabled) return;
  const tweets = Array.from(pendingTweets);
  pendingTweets.clear();
  for (const tweet of tweets) {
    if (!tweet.isConnected) continue;
    perfStats.tweetsScanned += 1;
    processTweet(tweet);
  }
  scheduleStatsFlush();
}

function processTweet(tweet: HTMLElement): void {
  const textContainers = Array.from(tweet.querySelectorAll<HTMLElement>(TWEET_TEXT));
  let remaining = settings.maxLinksPerPost;
  let remainingLowConfidence = settings.maxLowConfidenceLinksPerPost;

  for (const container of textContainers) {
    if (remaining <= 0) break;
    if (container.closest(`[${LINK_DATA_ATTR}]`)) continue;

    const signature = container.textContent || "";
    if (!signature.trim() || processed.get(container) === signature) continue;

    const result = linkContainer(container, remaining, remainingLowConfidence, signature);
    processed.set(container, signature);
    remaining -= result.linked;
    remainingLowConfidence -= result.lowConfidenceLinked;
    perfStats.linksCreated += result.linked;
  }
}

function linkContainer(container: HTMLElement, maxLinks: number, maxLowConfidenceLinks: number, containerText: string): { linked: number; lowConfidenceLinked: number } {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || !node.textContent?.trim()) return NodeFilter.FILTER_REJECT;
      if (parent.closest("a, button, [role='button'], [contenteditable='true'], .remilia-wiki-link")) {
        return NodeFilter.FILTER_REJECT;
      }
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);

  let linked = 0;
  let lowConfidenceLinked = 0;
  const linkedTitles = new Set<string>();
  for (const node of textNodes) {
    if (linked >= maxLinks) break;
    const text = node.textContent || "";
    const startedAt = performance.now();
    const candidates = matchWikiText(text, maxLinks - linked);
    perfStats.matchingMs += performance.now() - startedAt;
    const matches = candidates.filter((match) => !linkedTitles.has(match.title))
      .filter((match) => {
        const keep = !isWholeTweetMatch(containerText, match.text);
        if (!keep) perfStats.skippedWholeTweet += 1;
        return keep;
      })
      .filter((match) => {
        if (!isLowConfidence(match)) return true;
        const keep = lowConfidenceLinked < maxLowConfidenceLinks;
        if (!keep) perfStats.skippedLowConfidence += 1;
        return keep;
      });
    if (matches.length === 0) continue;
    replaceTextNode(node, matches);
    for (const match of matches) linkedTitles.add(match.title);
    linked += matches.length;
    lowConfidenceLinked += matches.filter(isLowConfidence).length;
  }
  return { linked, lowConfidenceLinked };
}

function scheduleStatsFlush(): void {
  if (statsFlushTimer !== null) return;
  statsFlushTimer = window.setTimeout(() => {
    statsFlushTimer = null;
    void savePerformanceStats({ ...perfStats, matchingMs: Math.round(perfStats.matchingMs), updatedAt: Date.now() });
  }, 1500);
}

function isLowConfidence(match: WikiMatch): boolean {
  return (match.confidence ?? 100) < 70 || (match.priority ?? 0) < 0;
}

function isWholeTweetMatch(containerText: string, matchText: string): boolean {
  return normalizeStandaloneText(containerText) === normalizeStandaloneText(matchText);
}

function normalizeStandaloneText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/[.,!?;:]+$/g, "").trim().toLowerCase();
}

function replaceTextNode(node: Text, matches: WikiMatch[]): void {
  const fragment = document.createDocumentFragment();
  const text = node.textContent || "";
  let cursor = 0;

  for (const match of matches) {
    if (match.start > cursor) fragment.appendChild(document.createTextNode(text.slice(cursor, match.start)));
    fragment.appendChild(createWikiLink(match));
    cursor = match.end;
  }

  if (cursor < text.length) fragment.appendChild(document.createTextNode(text.slice(cursor)));
  node.replaceWith(fragment);
}

function createWikiLink(match: WikiMatch): HTMLAnchorElement {
  const link = document.createElement("a");
  link.className = "remilia-wiki-link";
  link.dataset[LINK_DATA_KEY] = "true";
  link.dataset.wikiTitle = match.title;
  link.dataset.wikiConfidence = String(match.confidence ?? 100);
  link.dataset.wikiLabel = match.label;
  link.dataset.wikiSource = match.source || (match.pattern ? "pattern" : "generated");
  link.href = match.url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = match.text;
  link.title = settings.debugMode
    ? `${match.title} | ${link.dataset.wikiSource} | label: ${match.label} | confidence: ${match.confidence ?? 100}`
    : match.title;
  link.addEventListener("click", (event) => event.stopPropagation());
  attachPreviewHandlers(link, () => settings);
  return link;
}
