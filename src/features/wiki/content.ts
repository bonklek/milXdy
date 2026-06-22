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
const GROK_BUTTON_SELECTORS = [
  '[data-testid="GrokDrawer"]',
  '[data-testid="grok"]',
  '[aria-label*="Grok" i]',
  '[title*="Grok" i]',
].join(",");
let processed = new WeakMap<HTMLElement, string>();
const pendingTweets = new Set<HTMLElement>();
let lastContextMenuTarget: HTMLElement | null = null;

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

  document.addEventListener("contextmenu", (event) => {
    lastContextMenuTarget = event.target instanceof HTMLElement ? event.target : null;
  }, true);

  chrome.runtime.onMessage.addListener((message: unknown) => {
    if (!isCreateWithGrokMessage(message)) return false;
    void createWikiEntryWithGrok(message.selectedText, message.sourceUrl);
    return false;
  });

  document.addEventListener("remilia-wiki-hyperlink:process-container", (event) => {
    if (!settings.enabled) return;
    const container = (event as CustomEvent<{ container?: HTMLElement }>).detail?.container;
    if (!(container instanceof HTMLElement) || !container.isConnected) return;
    const signature = container.textContent || "";
    if (!signature.trim()) return;
    const result = linkContainer(container, effectiveMaxLinksPerPost(), settings.maxLowConfidenceLinksPerPost, signature);
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

type CreateWithGrokMessage = {
  type: "remilia-wiki:createWithGrok";
  selectedText?: string;
  sourceUrl?: string;
};

type TweetResearchContext = {
  topic: string;
  tweetText: string;
  author: string;
  tweetUrl: string;
  sourceUrl: string;
  links: string[];
};

function isCreateWithGrokMessage(value: unknown): value is CreateWithGrokMessage {
  return Boolean(value)
    && typeof value === "object"
    && (value as { type?: unknown }).type === "remilia-wiki:createWithGrok";
}

async function createWikiEntryWithGrok(selectedText?: string, sourceUrl?: string): Promise<void> {
  const context = buildTweetResearchContext(selectedText, sourceUrl);
  const prompt = buildGrokWikiPrompt(context);
  await copyText(prompt);
  await openGrokFromTweet();
  window.setTimeout(() => {
    void seedGrokComposer(prompt);
  }, 900);
}

function buildTweetResearchContext(selectedText?: string, sourceUrl?: string): TweetResearchContext {
  const tweet = findContextTweet();
  const tweetText = tweet ? extractTweetText(tweet) : "";
  const tweetUrl = tweet ? extractTweetUrl(tweet) : "";
  const author = tweet ? extractTweetAuthor(tweet) : "";
  const links = tweet ? extractReferenceLinks(tweet) : [];
  const topic = normalizePromptLine(selectedText || inferTopic(tweetText) || document.title.replace(/\/ X$/i, ""));
  return {
    topic: topic || "this Remilia-related subject",
    tweetText,
    author,
    tweetUrl,
    sourceUrl: sourceUrl || tweetUrl || location.href,
    links,
  };
}

function findContextTweet(): HTMLElement | null {
  if (lastContextMenuTarget?.isConnected) {
    const tweet = lastContextMenuTarget.closest<HTMLElement>(TWEET);
    if (tweet) return tweet;
  }
  const selection = window.getSelection();
  const node = selection?.anchorNode;
  const element = node instanceof HTMLElement ? node : node?.parentElement;
  return element?.closest<HTMLElement>(TWEET) || document.querySelector<HTMLElement>(TWEET);
}

function extractTweetText(tweet: HTMLElement): string {
  return Array.from(tweet.querySelectorAll<HTMLElement>(TWEET_TEXT))
    .map((node) => normalizePromptLine(node.innerText || node.textContent || ""))
    .filter(Boolean)
    .join("\n\n")
    .slice(0, 2400);
}

function extractTweetAuthor(tweet: HTMLElement): string {
  const userName = tweet.querySelector<HTMLElement>('[data-testid="User-Name"]');
  const text = normalizePromptLine(userName?.innerText || userName?.textContent || "");
  return text.split("\n").slice(0, 3).join(" / ");
}

function extractTweetUrl(tweet: HTMLElement): string {
  const statusLink = Array.from(tweet.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'))
    .find((link) => /\/status\/\d+/.test(link.href));
  return statusLink?.href || "";
}

function extractReferenceLinks(tweet: HTMLElement): string[] {
  const urls = Array.from(tweet.querySelectorAll<HTMLAnchorElement>("a[href]"))
    .map((link) => link.href)
    .filter((href) => href && !href.startsWith("javascript:"))
    .filter((href) => {
      try {
        return !/\/(analytics|photo|likes|retweets|quotes)(\/|$)/.test(new URL(href, location.href).pathname);
      } catch {
        return false;
      }
    })
    .map((href) => {
      try {
        const url = new URL(href, location.href);
        if (url.hostname.endsWith("twitter.com")) url.hostname = "x.com";
        return url.toString();
      } catch {
        return href;
      }
    });
  return Array.from(new Set(urls)).slice(0, 12);
}

function inferTopic(tweetText: string): string {
  const firstLine = tweetText.split(/\n+/).map((line) => line.trim()).find(Boolean) || "";
  return firstLine
    .replace(/^["'“”]+|["'“”]+$/g, "")
    .replace(/https?:\/\/\S+/g, "")
    .slice(0, 80)
    .trim();
}

function buildGrokWikiPrompt(context: TweetResearchContext): string {
  const references = [
    context.tweetUrl,
    context.sourceUrl && context.sourceUrl !== context.tweetUrl ? context.sourceUrl : "",
    ...context.links,
  ].filter(Boolean);
  const referenceBlock = Array.from(new Set(references)).map((url) => `- ${url}`).join("\n") || "- No source links extracted from the page.";
  const tweetBlock = context.tweetText ? context.tweetText : "(No tweet text extracted. Use the linked X post as the primary source.)";
  return [
    `Research a Remilia Wiki article candidate for: ${context.topic}`,
    "",
    "Primary workflow: produce material that can be handed to Remilia Wikitool. If a local AI assistant has Wikitool, it should run:",
    `wikitool workflow session-refresh`,
    `wikitool knowledge article-start "${context.topic.replace(/"/g, '\\"')}" --intent new --format json --view brief`,
    "",
    "Your job in Grok is source gathering and research, not final publishing. Use your X search access to find original posts, quote tweets, replies, creator accounts, dates, related memes/projects, and off-X references. Prefer primary sources, archived links, official pages, contracts, repositories, marketplace pages, and existing Remilia Wiki pages.",
    "",
    "Return:",
    "1. A concise topic brief and why it belongs on Remilia Wiki.",
    "2. A dated timeline with source links.",
    "3. Key people/accounts/entities and their handles.",
    "4. Related Remilia Wiki pages or likely internal links.",
    "5. A source list using exact URLs, especially X post URLs.",
    "6. Open questions and citation gaps.",
    "7. A Wikitool-ready article-start handoff prompt for a local assistant.",
    "8. If no local AI subscription or Wikitool runtime is available, a ready-to-copy web-chat prompt that asks for MediaWiki wikitext using these sources.",
    "",
    `Right-click context author: ${context.author || "unknown"}`,
    "Extracted tweet text:",
    tweetBlock,
    "",
    "Reference links already visible in this browser context:",
    referenceBlock,
  ].join("\n");
}

async function openGrokFromTweet(): Promise<void> {
  const tweet = findContextTweet();
  const button = findGrokButton(tweet) || findGrokButton(document.body);
  button?.click();
}

function findGrokButton(root: ParentNode | null): HTMLElement | null {
  if (!root) return null;
  const direct = root.querySelector<HTMLElement>(GROK_BUTTON_SELECTORS);
  if (direct) return direct.closest<HTMLElement>("button, a, [role='button']") || direct;
  return Array.from(root.querySelectorAll<HTMLElement>("button, a, [role='button']"))
    .find((element) => /grok/i.test(element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || "")) || null;
}

async function seedGrokComposer(prompt: string): Promise<void> {
  const editable = findEditableComposer();
  if (!editable) return;
  editable.focus();
  if (editable instanceof HTMLTextAreaElement || editable instanceof HTMLInputElement) {
    editable.value = prompt;
    editable.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt }));
    return;
  }
  document.execCommand("selectAll", false);
  document.execCommand("insertText", false, prompt);
}

function findEditableComposer(): HTMLElement | null {
  const active = document.activeElement;
  if (active instanceof HTMLElement && isEditable(active)) return active;
  return document.querySelector<HTMLElement>('textarea, input[type="text"], [contenteditable="true"], [role="textbox"]');
}

function isEditable(element: HTMLElement): boolean {
  return element instanceof HTMLTextAreaElement
    || element instanceof HTMLInputElement
    || element.isContentEditable
    || element.getAttribute("role") === "textbox";
}

async function copyText(value: string): Promise<void> {
  await navigator.clipboard.writeText(value).catch(() => {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.append(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  });
}

function normalizePromptLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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
  let remaining = effectiveMaxLinksPerPost();
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

function effectiveMaxLinksPerPost(): number {
  return settings.maxLinksPerPostEnabled ? settings.maxLinksPerPost : Number.POSITIVE_INFINITY;
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
