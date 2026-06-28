import { loadDenyTerms, loadLocalAliases, localAliasesToEntries, savePerformanceStats } from "./localData";
import { createMatcher } from "./matcher";
import { attachPreviewHandlers, configurePreviewSidebarOpener, installPreviewDismissHandlers } from "./preview";
import { loadSettings, observeSettings } from "./settings";
import { injectStyles } from "./styles";
import type { Settings, WikiMatch } from "./types";
import type { TwitterSurface } from "../../shared/twitterScanner";
import { recordFeatureTiming } from "../../shared/performanceDiagnostics";
import type { AppRuntimeScheduler, MilxdyContentAppContext } from "../../shared/appPlatform";
import type { PerformanceMode } from "../../shared/performanceMode";
import { createFallbackRuntimeScheduler } from "../../shared/runtimeScheduler";

const TWEET = 'article[data-testid="tweet"]';
const TWEET_TEXT = '[data-testid="tweetText"]';
const LINK_DATA_ATTR = "data-remilia-wiki-hyperlink";
const LINK_DATA_KEY = "remiliaWikiHyperlink";
const POST_READING_BUTTON = '[data-post-reading-button="true"]';
const ACTION_CONTROL_SELECTOR = "button, a, [role='button']";
const GROK_WIKI_CTA_ID = "remilia-wiki-grok-cta";
const WIKI_PRELOAD_TEMPLATE = "Template:New page preload";
const GROK_BUTTON_SELECTORS = [
  '[data-testid="GrokDrawer"]',
  '[data-testid="grok"]',
  '[aria-label*="Grok" i]',
  '[aria-label*="Grok actions" i]',
  '[aria-label*="Explain this post" i]',
  '[title*="Grok" i]',
  '[title*="Grok actions" i]',
  '[title*="Explain this post" i]',
].join(",");
const GROK_PROFILE_BUTTON_SELECTORS = [
  '[aria-label="Profile Summary" i]',
  '[title="Profile Summary" i]',
].join(",");
const GROK_OPEN_CONVERSATION_SELECTORS = [
  '[aria-label="Open conversation" i]',
  '[title="Open conversation" i]',
].join(",");
const WIKI_SIDEBAR_LAST_URL_KEY = "milxdy.wikiSidebar.lastUrl";
const WIKI_SIDEBAR_PENDING_URL_KEY = "__milxdyPendingWikiSidebarUrl";
const GROK_SEND_BUTTON_SELECTORS = [
  '[data-testid="sendButton"]',
  '[aria-label="Send" i]',
  '[aria-label="Send message" i]',
  '[aria-label="Submit" i]',
  '[title="Send" i]',
  '[title="Submit" i]',
].join(",");
let processed = new WeakMap<HTMLElement, string>();
const pendingTweets = new Map<HTMLElement, HTMLElement[]>();
let lastContextMenuTarget: HTMLElement | null = null;

let settings: Settings;
let matchWikiText = createMatcher();
let scanScheduled = false;
let statsFlushTimer: number | null = null;
let booted = false;
let runtimeScheduleScan: () => void = () => undefined;
let cancelPendingScan: (() => void) | null = null;
let runtimeScheduler: AppRuntimeScheduler = createFallbackRuntimeScheduler({ idleTimeoutMs: 16 });
const perfStats = {
  tweetsScanned: 0,
  linksCreated: 0,
  matchingMs: 0,
  skippedWholeTweet: 0,
  skippedLowConfidence: 0,
  skippedPerformanceMode: 0,
};
let recordRuntimeDiagnostic: MilxdyContentAppContext["recordDiagnostic"] = () => undefined;
let loadRuntimeAppById: MilxdyContentAppContext["loadAppById"] = () => Promise.resolve(null);
let lastScrollAt = 0;
let lastWikiModeDiagnosticSignature = "";
let cachedDocumentActionControls: HTMLElement[] = [];
let cachedDocumentActionControlsAt = 0;

export async function boot(context?: MilxdyContentAppContext): Promise<void> {
  if (booted) return;
  booted = true;
  runtimeScheduleScan = context?.scheduleScan || runtimeScheduleScan;
  runtimeScheduler = context?.scheduler || runtimeScheduler;
  recordRuntimeDiagnostic = context?.recordDiagnostic || recordRuntimeDiagnostic;
  loadRuntimeAppById = context?.loadAppById || loadRuntimeAppById;
  const addDisposable = context?.addDisposable || (() => undefined);
  injectStyles();
  configurePreviewSidebarOpener(openWikiSidebarUrl);
  addDisposable(() => configurePreviewSidebarOpener(null));
  installPreviewDismissHandlers();
  settings = await loadSettings();
  await reloadLocalMatcher();
  applySettings(settings);
  addDisposable(observeSettings((next) => {
    settings = next;
    applySettings(next);
    processed = new WeakMap<HTMLElement, string>();
    runtimeScheduleScan();
  }));
  const aliasListener = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local") return;
    if (changes["remiliaWikiHyperlink.localAliases"] || changes["remiliaWikiHyperlink.denyTerms"]) {
      void reloadLocalMatcher().then(() => {
        processed = new WeakMap<HTMLElement, string>();
        runtimeScheduleScan();
      });
    }
  };
  chrome.storage.onChanged.addListener(aliasListener);
  addDisposable(() => chrome.storage.onChanged.removeListener(aliasListener));

  const contextMenuListener = (event: MouseEvent) => {
    lastContextMenuTarget = event.target instanceof HTMLElement ? event.target : null;
  };
  document.addEventListener("contextmenu", contextMenuListener, true);
  addDisposable(() => document.removeEventListener("contextmenu", contextMenuListener, true));

  const scrollListener = () => {
    lastScrollAt = performance.now();
  };
  document.addEventListener("scroll", scrollListener, { passive: true, capture: true });
  addDisposable(() => document.removeEventListener("scroll", scrollListener, true));

  const messageListener = (message: unknown) => {
    if (!isCreateWithGrokMessage(message)) return false;
    void createWikiEntryWithGrok(message.selectedText, message.sourceUrl, message.mode);
    return false;
  };
  chrome.runtime.onMessage.addListener(messageListener);
  addDisposable(() => chrome.runtime.onMessage.removeListener(messageListener));

  const processContainerListener = (event: Event) => {
    if (!settings.enabled) return;
    const container = (event as CustomEvent<{ container?: HTMLElement }>).detail?.container;
    if (!(container instanceof HTMLElement) || !container.isConnected) return;
    const signature = container.textContent || "";
    if (!signature.trim()) return;
    const result = linkContainer(container, effectiveMaxLinksPerPost(), settings.maxLowConfidenceLinksPerPost, signature);
    perfStats.linksCreated += result.linked;
    if (result.linked > 0) scheduleStatsFlush();
  };
  document.addEventListener("remilia-wiki-hyperlink:process-container", processContainerListener);
  addDisposable(() => document.removeEventListener("remilia-wiki-hyperlink:process-container", processContainerListener));

  runtimeScheduleScan();
}

export function onSurface(surface: TwitterSurface): void {
  if (!settings?.enabled || (surface.kind !== "tweet" && surface.kind !== "profile")) return;
  pendingTweets.set(surface.element, surface.textContainers);
  schedulePendingScan();
}

export function disable(): void {
  if (settings) settings = { ...settings, enabled: false };
  clearWikiLinks();
}

export function dispose(): void {
  disable();
  cancelPendingScan?.();
  cancelPendingScan = null;
  pendingTweets.clear();
  if (statsFlushTimer !== null) {
    window.clearTimeout(statsFlushTimer);
    statsFlushTimer = null;
  }
  booted = false;
  loadRuntimeAppById = () => Promise.resolve(null);
  cachedDocumentActionControls = [];
  cachedDocumentActionControlsAt = 0;
}

type CreateWithGrokMessage = {
  type: "remilia-wiki:createWithGrok";
  selectedText?: string;
  sourceUrl?: string;
  mode?: GrokWikiPromptMode;
};

type GrokWikiPromptMode = "post-seed" | "generic" | "profile";

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

async function createWikiEntryWithGrok(selectedText?: string, sourceUrl?: string, mode: GrokWikiPromptMode = "post-seed"): Promise<void> {
  const context = buildTweetResearchContext(selectedText, sourceUrl);
  await openGrokFromTweet(mode);
  if (settings.grokWorkflowMode === "socratic") {
    void runSocraticGrokWorkflow(context, mode);
  } else {
    const prompt = buildGrokWikiPrompt(context, mode);
    window.setTimeout(() => {
      void copyText(prompt).then(() => seedGrokComposer(prompt)).catch(() => seedGrokComposer(prompt));
      showGrokWikiCta(context.topic);
    }, 900);
  }
}

function buildTweetResearchContext(selectedText?: string, sourceUrl?: string): TweetResearchContext {
  const tweet = findContextTweet();
  const tweetText = tweet ? extractTweetText(tweet) : "";
  const tweetUrl = tweet ? extractTweetUrl(tweet) : "";
  const author = tweet ? extractTweetAuthor(tweet) : "";
  const links = tweet ? extractReferenceLinks(tweet) : [];
  const topic = normalizePromptLine(selectedText || inferTopic(tweetText) || document.title.replace(/\/ X$/i, ""));
  const profileTopic = normalizePromptLine(selectedText || inferProfileTopic() || topic);
  return {
    topic: profileTopic || "this Remilia-related subject",
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

function inferProfileTopic(): string {
  const path = location.pathname.split("/").filter(Boolean);
  const handle = path[0] && !["home", "explore", "notifications", "messages", "i", "search"].includes(path[0])
    ? `@${path[0]}`
    : "";
  const name = normalizePromptLine(document.querySelector<HTMLElement>('[data-testid="UserName"]')?.innerText || "");
  return name || handle;
}

function buildGrokWikiPrompt(context: TweetResearchContext, mode: GrokWikiPromptMode): string {
  const opening = mode === "generic"
    ? `Research a Remilia Wiki article candidate${context.topic ? ` about: ${context.topic}` : ""}. The post above is incidental context only; do not treat it as the central source unless it is directly useful.`
    : mode === "profile"
      ? `Research whether this X profile is notable enough for a Remilia Wiki article${context.topic ? ` about: ${context.topic}` : ""}. The profile page and posts are source leads, but do not assume notability before checking broader evidence.`
    : `Use the post above as the seed for a Remilia Wiki article candidate${context.topic ? ` about: ${context.topic}` : ""}.`;
  const researchFrame = mode === "generic"
    ? "This is a broader research quest. Use the topic as the anchor, then integrate X-native knowledge with wider reporting, blogs, official pages, archives, creator statements, project docs, contracts, repositories, marketplace pages, interviews, podcasts, and other public discourse."
    : mode === "profile"
      ? "This is a profile-notability research quest. Integrate X-native history with wider reporting, blogs, official pages, archives, creator statements, projects, interviews, podcasts, galleries, repositories, and public discourse."
    : "This is a jumping-off point for a wider research quest. Integrate X-native knowledge from the post and surrounding discourse with wider reporting, blogs, official pages, archives, creator statements, project docs, contracts, repositories, marketplace pages, interviews, podcasts, and other public discourse.";
  return [
    opening,
    "",
    researchFrame,
    "Reference wiki: https://wiki.remilia.org",
    "Do not assume I can run local tools. Do not repeat or summarize this instruction block.",
    "",
    "Research priorities:",
    "- Find the earliest relevant X posts, quote posts, replies, creator accounts, announcement posts, and later posts that clarify the subject.",
    "- Prefer older mentions when reconstructing origin, authorship, influence, or terminology; early mentions are usually more authoritative for history. For current events or live controversies, decide whether history, present context, or both are needed and label that choice clearly.",
    "- Find off-X sources where useful: official sites, archives, contracts, repositories, marketplace pages, interviews, podcasts, galleries, project docs, and existing Remilia Wiki pages.",
    mode === "profile" ? "- For profile articles, assess notability first: projects created, writings, art, technical work, public influence, documented relationship to Remilia-adjacent scenes, recurring mentions by others, and durable sources beyond self-description." : "",
    "- Use outside sourcing to ground X discourse in wider facts. Prefer primary sources for direct claims, but include credible reporting, blogs, documentation, and discourse when they add context or corroboration.",
    "- Strip tracking parameters from URLs. Never invent dates, URLs, quote text, citation fields, categories, or template parameters. Remove Grok citation artifacts such as [](grok_render_citation_card_json=...) from the MediaWiki draft; use plain source URLs inside citation templates instead.",
    "",
    "Use Remilia Wiki style:",
    "- Encyclopedic, subcultural, plain prose. Factual and culturally aware, but not promotional or academic.",
    "- First sentence should define the subject with bold title syntax if drafting: '''Subject''' is/was ...",
    "- Default new draft header: {{SHORTDESC:Brief one-line description}} then {{Article quality|unverified}}.",
    "- Use sentence-case headings. Common sections can include Background, Origin, Development, Usage, Reception, References, and External links, but only include sections supported by evidence.",
    "- Do not include a See also section unless there are 2-4 directly relevant existing Remilia Wiki pages that are not already linked prominently in the body. Omit See also for short drafts when it would be filler.",
    "- Link existing related pages on first mention only, such as [[Remilia Corporation]], [[Milady Maker]], [[Charlotte Fang]], [[Remilio Babies]], [[Bonkler]], [[RemiliaNET]], [[Network Spirituality]], [[Vibe Shift]], [[New Net Art]], [[$CULT]], or [[Beetle Wiki]] when relevant.",
    "- Use citation templates inside inline <ref>...</ref> tags immediately after the claim they support, after punctuation. MediaWiki renders these as superscript reference numbers. Do not only place sources in a bibliography or timeline.",
    "- Citation examples: <ref>{{Cite tweet|user=|number=|title=|date=}}</ref>, <ref>{{Cite post|url=|title=|author=|date=|access-date=}}</ref>, and <ref>{{Cite web|url=|title=|author=|date=|access-date=|website=}}</ref>. Use today's access date. Leave archive fields blank.",
    "- Use {{Reflist}} in References. Every factual claim that depends on a source should have a corresponding inline <ref> tag. Use 2-5 citations for a short draft, more only when the claims need it.",
    "- Do not add a Conclusion section, inflated significance claims, hype, rhetorical lists, direct address, Markdown links, or code fences.",
    "- Avoid AI-sounding phrases: pivotal role, serves as a testament, rich tapestry, groundbreaking, revolutionary, evolving landscape, underscores, highlights, notably, furthermore, multifaceted, nuanced.",
    "",
    "Return in this order:",
    "1. Candidate page title and one-sentence neutral definition.",
    "2. Commit summary line: one concise edit-summary sentence suitable for saving the wiki article, separate from the copy-paste draft.",
    "3. Dated timeline with exact source URLs.",
    "4. Key entities: people, handles, projects, aliases, tickers, contracts, websites.",
    "5. Related Remilia Wiki pages/internal links to check.",
    "6. Claims safe to include, claims needing attribution, and claims to avoid until sourced.",
    "7. A single copy-pasteable fenced code block labeled mediawiki containing a short article stub or section draft, with relevant Remilia Wiki internal hyperlinks. The block must contain valid MediaWiki only: no Markdown citation cards, no Grok render artifacts, no hidden JSON, no placeholder URLs.",
    "8. Open questions and missing-source leads.",
    "",
    "If the post above is too little context, ask 3-6 targeted questions before drafting.",
  ].join("\n");
}

async function runSocraticGrokWorkflow(context: TweetResearchContext, mode: GrokWikiPromptMode): Promise<void> {
  await delay(1200);
  activateOpenConversationButton();
  await waitForGrokIdle(45000);
  const prompts = buildSocraticGrokPrompts(context, mode);
  for (const prompt of prompts) {
    await copyText(prompt).catch(() => undefined);
    const beforeText = document.body.innerText || "";
    await submitGrokPrompt(prompt);
    await waitForGrokResponseCycle(beforeText, 120000);
  }
  showGrokWikiCta(context.topic);
}

function buildSocraticGrokPrompts(context: TweetResearchContext, mode: GrokWikiPromptMode): string[] {
  const subject = context.topic || "this Remilia-related subject";
  const contextFrame = mode === "profile"
    ? `The subject is the current X profile: ${subject}. First assess whether this person/profile is notable enough for a Remilia Wiki article.`
    : mode === "generic"
      ? `The subject is ${subject}. The current post is incidental context only; use it only if it helps.`
      : `Use the post above as the seed for ${subject}, but treat it as a starting point rather than the whole article.`;
  const sharedRules = [
    "Reference wiki: https://wiki.remilia.org",
    "This is a Wikitool-inspired Socratic research workflow translated for Grok. Do not mention local tools or commands.",
    "Prefer older mentions for origin, authorship, influence, terminology, and early reception. If the topic is a current event, decide whether history, present context, or both are needed and state why.",
    "Use outside sourcing to ground X discourse in wider facts: reporting, blogs, official pages, archives, creator statements, docs, contracts, repositories, marketplaces, interviews, podcasts, and public discourse.",
    "Never invent dates, URLs, quote text, categories, or citation details. Strip tracking parameters.",
  ].join("\n");
  return [
    [
      `${contextFrame}`,
      "",
      sharedRules,
      "",
      "Stage 1 - Scout and classify.",
      "Return a concise research scout, not a draft:",
      "1. Candidate page title and alternate titles/aliases/handles.",
      "2. Article type: profile, concept, event, project, artwork, collection, token, website/tool, phrase/meme, scene/place, publication, or other.",
      "3. Short neutral definition.",
      "4. Why this may or may not belong on Remilia Wiki.",
      "5. Initial source leads and search queries, with emphasis on older authoritative mentions.",
      "6. Questions that must be answered before drafting.",
    ].join("\n"),
    [
      `Continue the research for ${subject}.`,
      "",
      "Stage 2 - Source quest.",
      "Find source-backed facts and separate them from open leads:",
      "1. Earliest relevant X posts and older mentions, with exact URLs.",
      "2. Wider reporting, blogs, official pages, archives, docs, repositories, contracts, marketplaces, interviews, or podcasts.",
      "3. Key people/accounts/entities and their roles.",
      "4. Related Remilia Wiki pages to check, but do not invent pages.",
      "5. Claims safe to include, claims requiring attribution, and claims to avoid until sourced.",
      "Do not draft yet.",
    ].join("\n"),
    [
      `Plan the Remilia Wiki article for ${subject}.`,
      "",
      "Stage 3 - Article plan.",
      "Create a draft plan before writing:",
      "1. Recommended page title.",
      "2. Scope: what belongs, what should be excluded, possible redirect/merge targets.",
      "3. Likely section headings in sentence case. Do not include See also unless there are 2-4 directly relevant existing pages not already linked in the body.",
      "4. Internal links to use on first mention only.",
      "5. Citation plan: which claims need inline <ref>...</ref> tags.",
      "6. A one-sentence commit/edit summary.",
      "Do not write the MediaWiki draft yet.",
    ].join("\n"),
    [
      `Now draft the Remilia Wiki article for ${subject}.`,
      "",
      "Stage 4 - Clean draft.",
      "Return exactly:",
      "1. Commit summary line: one concise edit-summary sentence.",
      "2. A single copy-pasteable fenced code block labeled mediawiki.",
      "",
      "MediaWiki draft requirements:",
      "- Start with {{SHORTDESC:...}} and {{Article quality|unverified}}.",
      "- First sentence defines the subject with '''Subject''' bolded.",
      "- Use relevant Remilia Wiki internal links on first mention only.",
      "- Use inline <ref>{{Cite tweet|...}}</ref>, <ref>{{Cite post|...}}</ref>, or <ref>{{Cite web|...}}</ref> immediately after sourced claims, after punctuation, so MediaWiki renders superscript references.",
      "- Include == References == and {{Reflist}} if any refs are used.",
      "- Omit See also unless it is genuinely necessary and not filler.",
      "- No Markdown links inside article prose, no Grok render citation cards, no hidden JSON, no placeholder URLs, no code fences inside the mediawiki block.",
    ].join("\n"),
  ];
}

function showGrokWikiCta(topic: string): void {
  document.getElementById(GROK_WIKI_CTA_ID)?.remove();
  const root = document.createElement("button");
  root.id = GROK_WIKI_CTA_ID;
  root.type = "button";
  root.setAttribute("aria-label", "Open a new Remilia Wiki page");
  root.innerHTML = "";
  Object.assign(root.style, {
    position: "fixed",
    top: "10px",
    left: "10px",
    right: "auto",
    zIndex: "2147483647",
    width: "330px",
    maxWidth: "calc(100vw - 24px)",
    minHeight: "74px",
    padding: "12px",
    border: "1px solid rgba(255, 79, 191, 0.72)",
    borderRadius: "8px",
    background: "linear-gradient(135deg, rgba(18, 18, 22, 0.98), rgba(45, 12, 35, 0.98))",
    color: "#fff",
    font: "600 13px/1.3 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    boxShadow: "0 12px 34px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(255, 255, 255, 0.06) inset",
    cursor: "pointer",
    textAlign: "left",
    userSelect: "none",
    touchAction: "none",
  });
  const logo = document.createElement("img");
  logo.alt = "";
  logo.src = chrome.runtime.getURL("icons/icon48.png");
  Object.assign(logo.style, {
    width: "42px",
    height: "42px",
    flex: "0 0 auto",
    borderRadius: "8px",
    background: "#ff4fbf",
    boxShadow: "0 0 18px rgba(255, 79, 191, 0.35)",
  });
  const copy = document.createElement("span");
  Object.assign(copy.style, {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    minWidth: "0",
  });
  const title = document.createElement("strong");
  title.textContent = "Remilia Wiki";
  Object.assign(title.style, {
    color: "#ff8fd7",
    fontSize: "13px",
    letterSpacing: "0",
  });
  const body = document.createElement("span");
  const pageTitle = titleFromTopic(topic);
  body.textContent = "Open new Wiki page:";
  Object.assign(body.style, {
    color: "rgba(255, 255, 255, 0.92)",
    fontSize: "13px",
  });
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.value = pageTitle;
  titleInput.setAttribute("aria-label", "Remilia Wiki page title");
  titleInput.dataset.grokWikiTitleInput = "true";
  Object.assign(titleInput.style, {
    width: "100%",
    minWidth: "0",
    height: "28px",
    padding: "4px 7px",
    border: "1px solid rgba(255, 143, 215, 0.48)",
    borderRadius: "6px",
    background: "rgba(255, 255, 255, 0.08)",
    color: "#fff",
    font: "600 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    outline: "none",
  });
  titleInput.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  titleInput.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  titleInput.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      window.open(wikiNewPageUrl(titleInput.value), "_blank", "noopener,noreferrer");
    }
  });
  const hint = document.createElement("span");
  hint.textContent = "Use after vetting Grok's output.";
  Object.assign(hint.style, {
    color: "rgba(255, 178, 225, 0.72)",
    fontSize: "11px",
    fontWeight: "500",
  });
  copy.append(title, body, titleInput, hint);
  const close = document.createElement("span");
  close.textContent = "x";
  close.setAttribute("role", "button");
  close.setAttribute("aria-label", "Close Remilia Wiki prompt");
  close.dataset.grokWikiClose = "true";
  Object.assign(close.style, {
    position: "absolute",
    top: "6px",
    right: "8px",
    width: "22px",
    height: "22px",
    borderRadius: "999px",
    color: "rgba(255, 255, 255, 0.78)",
    font: "700 14px/22px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    textAlign: "center",
    cursor: "pointer",
  });
  close.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  close.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    root.remove();
  });
  Object.assign(root.style, {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  });
  root.append(logo, copy, close);
  let dragStart: { pointerId: number; x: number; y: number; left: number; top: number; width: number; height: number; moved: boolean } | null = null;
  root.addEventListener("pointerdown", (event) => {
    if ((event.target as HTMLElement | null)?.closest("[data-grok-wiki-close='true']")) return;
    if (event.button !== 0) return;
    const rect = root.getBoundingClientRect();
    dragStart = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      moved: false,
    };
    root.setPointerCapture(event.pointerId);
  });
  root.addEventListener("pointermove", (event) => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;
    const dx = event.clientX - dragStart.x;
    const dy = event.clientY - dragStart.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) dragStart.moved = true;
    const nextLeft = Math.max(6, Math.min(window.innerWidth - dragStart.width - 6, dragStart.left + dx));
    const nextTop = Math.max(6, Math.min(window.innerHeight - dragStart.height - 6, dragStart.top + dy));
    root.style.left = `${nextLeft}px`;
    root.style.top = `${nextTop}px`;
    root.style.right = "auto";
  });
  root.addEventListener("pointerup", (event) => {
    if (!dragStart || dragStart.pointerId !== event.pointerId) return;
    const wasMoved = dragStart.moved;
    dragStart = null;
    root.releasePointerCapture(event.pointerId);
    snapGrokWikiCta(root);
    avoidBeetolOverlap(root);
    if (wasMoved) {
      root.dataset.dragged = "true";
      window.setTimeout(() => {
        delete root.dataset.dragged;
      }, 0);
    }
  });
  root.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (root.dataset.dragged === "true") return;
    if ((event.target as HTMLElement | null)?.closest("[data-grok-wiki-title-input='true']")) return;
    window.open(wikiNewPageUrl(titleInput.value), "_blank", "noopener,noreferrer");
  });
  document.body.append(root);
  positionGrokWikiCta(root);
}

function snapGrokWikiCta(root: HTMLElement): void {
  const rect = root.getBoundingClientRect();
  const gap = 10;
  const distances = [
    { edge: "left", value: rect.left },
    { edge: "right", value: window.innerWidth - rect.right },
    { edge: "top", value: rect.top },
    { edge: "bottom", value: window.innerHeight - rect.bottom },
  ].sort((left, right) => left.value - right.value);
  root.style.transition = "left 120ms ease, top 120ms ease";
  window.setTimeout(() => {
    root.style.transition = "";
  }, 140);
  const edge = distances[0]?.edge;
  if (edge === "left") root.style.left = `${gap}px`;
  if (edge === "right") root.style.left = `${Math.max(gap, window.innerWidth - rect.width - gap)}px`;
  if (edge === "top") root.style.top = `${gap}px`;
  if (edge === "bottom") root.style.top = `${Math.max(gap, window.innerHeight - rect.height - gap)}px`;
}

function positionGrokWikiCta(root: HTMLElement): void {
  const gap = 10;
  const beetol = document.getElementById("beetol-hunter-root") as HTMLElement | null;
  const rootRect = root.getBoundingClientRect();
  if (!beetol) {
    root.style.left = `${gap}px`;
    root.style.top = `${gap}px`;
    return;
  }

  const beetolRect = beetol.getBoundingClientRect();
  const left = Math.max(gap, Math.min(window.innerWidth - rootRect.width - gap, beetolRect.left));
  const topAbove = beetolRect.top - rootRect.height - gap;
  const top = topAbove >= gap ? topAbove : gap;
  root.style.left = `${left}px`;
  root.style.top = `${top}px`;

  const nextRootRect = rectFromPosition(left, top, rootRect.width, rootRect.height);
  if (topAbove < gap || rectsOverlap(nextRootRect, beetolRect)) {
    const nextTop = Math.min(window.innerHeight - beetolRect.height - gap, nextRootRect.bottom + gap);
    beetol.style.top = `${Math.max(gap, nextTop)}px`;
    beetol.style.left = `${Math.max(gap, beetolRect.left)}px`;
    beetol.dataset.snapY = Math.max(gap, nextTop) > window.innerHeight / 2 ? "bottom" : "top";
    beetol.dataset.snapX = Math.max(gap, beetolRect.left) > window.innerWidth / 2 ? "right" : "left";
  }
}

function avoidBeetolOverlap(root: HTMLElement): void {
  const beetol = document.getElementById("beetol-hunter-root") as HTMLElement | null;
  if (!beetol) return;
  const rootRect = root.getBoundingClientRect();
  const beetolRect = beetol.getBoundingClientRect();
  if (!rectsOverlap(rootRect, beetolRect)) return;
  const gap = 10;
  const moveBelow = rootRect.bottom + gap;
  const moveAbove = rootRect.top - beetolRect.height - gap;
  const nextTop = moveBelow + beetolRect.height <= window.innerHeight - gap ? moveBelow : Math.max(gap, moveAbove);
  beetol.style.top = `${nextTop}px`;
}

function rectsOverlap(a: DOMRect, b: DOMRect): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function rectFromPosition(left: number, top: number, width: number, height: number): DOMRect {
  return new DOMRect(left, top, width, height);
}

function wikiNewPageUrl(topic: string): string {
  const url = new URL("https://wiki.remilia.org/index.php");
  url.searchParams.set("title", titleFromTopic(topic));
  url.searchParams.set("action", "edit");
  url.searchParams.set("preload", WIKI_PRELOAD_TEMPLATE);
  return url.toString();
}

function titleFromTopic(topic: string): string {
  const clean = topic.replace(/\s+/g, " ").trim();
  if (!clean) return "New Page";
  return clean
    .split(" ")
    .map((part) => part ? `${part[0].toUpperCase()}${part.slice(1)}` : "")
    .join(" ");
}

async function openGrokFromTweet(mode: GrokWikiPromptMode): Promise<void> {
  const tweet = findContextTweet();
  const button = mode === "profile"
    ? findGrokProfileSummaryButton() || findGrokButton(tweet) || findGrokButton(document.body)
    : findGrokButton(tweet) || findGrokButton(document.body);
  if (button) activateElement(button);
}

function findGrokProfileSummaryButton(): HTMLElement | null {
  const direct = document.querySelector<HTMLElement>(GROK_PROFILE_BUTTON_SELECTORS);
  if (direct) return closestActionControl(direct) || direct;
  return documentActionControls()
    .find((element) => /profile summary/i.test(element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || "")) || null;
}

function activateOpenConversationButton(): void {
  const direct = document.querySelector<HTMLElement>(GROK_OPEN_CONVERSATION_SELECTORS);
  const button = closestActionControl(direct)
    || documentActionControls()
      .find((element) => /open conversation/i.test(element.getAttribute("aria-label") || element.getAttribute("title") || element.textContent || ""));
  if (button) activateElement(button);
}

function findGrokButton(root: ParentNode | null): HTMLElement | null {
  if (!root) return null;
  if (root instanceof HTMLElement) {
    const nearReadButton = findGrokButtonNearReadButton(root);
    if (nearReadButton) return nearReadButton;
  }
  const direct = root.querySelector<HTMLElement>(GROK_BUTTON_SELECTORS);
  if (direct) return closestActionControl(direct) || direct;
  return actionControls(root)
    .find(isGrokControl) || null;
}

function findGrokButtonNearReadButton(root: HTMLElement): HTMLElement | null {
  const readButton = root.querySelector<HTMLElement>(POST_READING_BUTTON);
  const parent = readButton?.parentElement;
  if (!parent) return null;
  const siblings = Array.from(parent.children).filter((element): element is HTMLElement => element instanceof HTMLElement);
  const readIndex = siblings.indexOf(readButton);
  const beforeReadButton = readIndex >= 0 ? siblings.slice(0, readIndex).reverse() : [];
  const afterReadButton = readIndex >= 0 ? siblings.slice(readIndex + 1) : [];
  for (const candidate of [...beforeReadButton, ...afterReadButton, ...siblings]) {
    const control = candidate.matches(ACTION_CONTROL_SELECTOR)
      ? candidate
      : candidate.querySelector<HTMLElement>(ACTION_CONTROL_SELECTOR);
    if (control && isGrokControl(control)) return control;
  }
  return null;
}

function closestActionControl(element: Element | null | undefined): HTMLElement | null {
  return element?.closest<HTMLElement>(ACTION_CONTROL_SELECTOR) || null;
}

function actionControls(root: ParentNode): HTMLElement[] {
  if (root === document || root === document.body || root === document.documentElement) return documentActionControls();
  return Array.from(root.querySelectorAll<HTMLElement>(ACTION_CONTROL_SELECTOR));
}

function documentActionControls(maxAgeMs = 180): HTMLElement[] {
  const now = performance.now();
  if (cachedDocumentActionControls.length && now - cachedDocumentActionControlsAt < maxAgeMs) {
    const connected = cachedDocumentActionControls.filter((element) => element.isConnected);
    if (connected.length === cachedDocumentActionControls.length) return cachedDocumentActionControls;
    cachedDocumentActionControls = connected;
    return connected;
  }
  cachedDocumentActionControls = Array.from(document.querySelectorAll<HTMLElement>(ACTION_CONTROL_SELECTOR));
  cachedDocumentActionControlsAt = now;
  return cachedDocumentActionControls;
}

function isGrokControl(element: HTMLElement): boolean {
  const label = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.textContent,
  ].filter(Boolean).join(" ");
  return /\bgrok\b|grok actions|explain this post/i.test(label);
}

function activateElement(element: HTMLElement): void {
  element.scrollIntoView({ block: "nearest", inline: "nearest" });
  element.focus();
  for (const type of ["pointerdown", "mousedown", "mouseup", "click"]) {
    element.dispatchEvent(new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  }
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

async function submitGrokPrompt(prompt: string): Promise<void> {
  await seedGrokComposer(prompt);
  const sendButton = await waitForGrokSendButton(2500);
  if (sendButton) {
    activateElement(sendButton);
    return;
  }
  const editable = findEditableComposer();
  if (!editable) return;
  editable.focus();
  for (const type of ["keydown", "keypress", "keyup"]) {
    editable.dispatchEvent(new KeyboardEvent(type, {
      key: "Enter",
      code: "Enter",
      bubbles: true,
      cancelable: true,
      view: window,
    }));
  }
}

async function waitForGrokSendButton(timeoutMs: number): Promise<HTMLElement | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const button = findGrokSendButton();
    if (button) return button;
    await delay(120);
  }
  return null;
}

function findGrokSendButton(): HTMLElement | null {
  const direct = document.querySelector<HTMLElement>(GROK_SEND_BUTTON_SELECTORS);
  const directButton = closestActionControl(direct) || direct;
  if (directButton && !isDisabledControl(directButton) && !isVoiceModeControl(directButton)) return directButton;
  return documentActionControls()
    .find((element) => {
      if (isDisabledControl(element)) return false;
      if (isVoiceModeControl(element)) return false;
      const label = [
        element.getAttribute("aria-label"),
        element.getAttribute("title"),
        element.textContent,
      ].filter(Boolean).join(" ");
      return /^(send|send message|submit)$/i.test(label.trim());
    }) || null;
}

function isDisabledControl(element: HTMLElement): boolean {
  return element.hasAttribute("disabled")
    || element.getAttribute("aria-disabled") === "true"
    || element.closest("[disabled], [aria-disabled='true']") !== null;
}

function isVoiceModeControl(element: HTMLElement): boolean {
  const label = [
    element.getAttribute("aria-label"),
    element.getAttribute("title"),
    element.textContent,
  ].filter(Boolean).join(" ");
  return /voice mode|voice note|audio/i.test(label);
}

async function waitForGrokResponseCycle(beforeText: string, timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  let sawResponseStart = false;
  while (Date.now() - startedAt < Math.min(18000, timeoutMs)) {
    await delay(450);
    const currentText = document.body.innerText || "";
    const busy = isGrokBusy();
    if (busy || currentText.length > beforeText.length + 20 || currentText !== beforeText) {
      sawResponseStart = true;
      break;
    }
  }
  if (!sawResponseStart) return;
  await waitForGrokIdle(Math.max(1000, timeoutMs - (Date.now() - startedAt)));
}

async function waitForGrokIdle(timeoutMs: number): Promise<void> {
  const startedAt = Date.now();
  let lastText = "";
  let stableSince = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    await delay(900);
    const text = normalizePromptLine(document.body.innerText || "");
    const busy = isGrokBusy();
    if (text !== lastText) {
      lastText = text;
      stableSince = Date.now();
      continue;
    }
    if (!busy && Date.now() - stableSince > 2800 && findEditableComposer()) return;
  }
}

function isGrokBusy(): boolean {
  return Boolean(document.querySelector(
    '[aria-label*="Stop" i], [aria-label*="Generating" i], [aria-label*="Cancel" i], [data-testid*="stop" i]',
  ));
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
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
  if (scanScheduled || cancelPendingScan) return;
  scanScheduled = true;
  const mode = currentPerformanceMode();
  const settleDelay = wikiScrollSettleDelayMs(mode);
  cancelPendingScan = runtimeScheduler.idle(() => {
    cancelPendingScan = null;
    scanScheduled = false;
    if (shouldWaitForScrollSettle(mode)) {
      const delay = Math.max(50, wikiScrollSettleDelayMs(mode) - (performance.now() - lastScrollAt));
      cancelPendingScan = runtimeScheduler.timeout(() => {
        cancelPendingScan = null;
        schedulePendingScan();
      }, delay);
      return;
    }
    processPendingTweets();
  }, { timeout: Math.max(700, settleDelay) });
}

function processPendingTweets(): void {
  if (!settings.enabled) return;
  const mode = currentPerformanceMode();
  const policy = wikiPerformancePolicy(mode);
  recordWikiModeDiagnostic(mode, policy);
  const tweets = Array.from(pendingTweets.entries()).slice(0, policy.batchSize);
  for (const [tweet] of tweets) pendingTweets.delete(tweet);
  for (const [tweet, textContainers] of tweets) {
    if (!tweet.isConnected) continue;
    if (!tweetWithinLinkingBudget(tweet, policy)) {
      perfStats.skippedPerformanceMode += 1;
      continue;
    }
    const startedAt = performance.now();
    perfStats.tweetsScanned += 1;
    processTweet(tweet, textContainers, policy);
    recordFeatureTiming("wiki", "processTweet", startedAt);
  }
  scheduleStatsFlush();
  if (pendingTweets.size > 0) schedulePendingScan();
}

function processTweet(tweet: HTMLElement, surfaceTextContainers: HTMLElement[] | undefined, policy = wikiPerformancePolicy(currentPerformanceMode())): void {
  const textContainers = surfaceTextContainers?.length
    ? surfaceTextContainers
    : Array.from(tweet.querySelectorAll<HTMLElement>(TWEET_TEXT));
  let remaining = Math.min(effectiveMaxLinksPerPost(), policy.maxLinksPerPost);
  let remainingLowConfidence = Math.min(settings.maxLowConfidenceLinksPerPost, policy.maxLowConfidenceLinksPerPost);

  for (const container of textContainers) {
    if (remaining <= 0) break;
    if (container.closest(`[${LINK_DATA_ATTR}]`)) continue;

    const signature = container.textContent || "";
    if (!signature.trim() || processed.get(container) === signature) continue;
    if (signature.length > policy.maxTextChars) {
      perfStats.skippedPerformanceMode += 1;
      processed.set(container, signature);
      continue;
    }

    const result = linkContainer(container, remaining, remainingLowConfidence, signature);
    processed.set(container, signature);
    remaining -= result.linked;
    remainingLowConfidence -= result.lowConfidenceLinked;
    perfStats.linksCreated += result.linked;
  }
}

function clearWikiLinks(): void {
  for (const link of Array.from(document.querySelectorAll<HTMLElement>(`[${LINK_DATA_ATTR}]`))) {
    const text = document.createTextNode(link.textContent || "");
    link.replaceWith(text);
  }
  processed = new WeakMap<HTMLElement, string>();
}

function effectiveMaxLinksPerPost(): number {
  return settings.maxLinksPerPostEnabled ? settings.maxLinksPerPost : Number.POSITIVE_INFINITY;
}

type WikiPerformancePolicy = {
  batchSize: number;
  maxLinksPerPost: number;
  maxLowConfidenceLinksPerPost: number;
  maxTextChars: number;
  viewportMarginPx: number;
};

function currentPerformanceMode(): PerformanceMode {
  const mode = document.documentElement.dataset.milxdyPerformanceMode;
  return mode === "fast" || mode === "full" || mode === "developer" ? mode : "balanced";
}

function wikiPerformancePolicy(mode: PerformanceMode): WikiPerformancePolicy {
  if (mode === "fast") {
    return { batchSize: 2, maxLinksPerPost: 1, maxLowConfidenceLinksPerPost: 0, maxTextChars: 360, viewportMarginPx: 220 };
  }
  if (mode === "balanced") {
    return { batchSize: 4, maxLinksPerPost: 2, maxLowConfidenceLinksPerPost: 1, maxTextChars: 900, viewportMarginPx: 800 };
  }
  if (mode === "developer") {
    return { batchSize: 12, maxLinksPerPost: Number.POSITIVE_INFINITY, maxLowConfidenceLinksPerPost: Number.POSITIVE_INFINITY, maxTextChars: Number.POSITIVE_INFINITY, viewportMarginPx: 2200 };
  }
  return { batchSize: 8, maxLinksPerPost: Number.POSITIVE_INFINITY, maxLowConfidenceLinksPerPost: Number.POSITIVE_INFINITY, maxTextChars: 1800, viewportMarginPx: 1800 };
}

function wikiScrollSettleDelayMs(mode: PerformanceMode): number {
  if (mode === "fast") return 550;
  if (mode === "balanced") return 260;
  return 0;
}

function shouldWaitForScrollSettle(mode: PerformanceMode): boolean {
  const delay = wikiScrollSettleDelayMs(mode);
  return delay > 0 && performance.now() - lastScrollAt < delay;
}

function tweetWithinLinkingBudget(tweet: HTMLElement, policy: WikiPerformancePolicy): boolean {
  const rect = tweet.getBoundingClientRect();
  return rect.bottom >= -policy.viewportMarginPx && rect.top <= window.innerHeight + policy.viewportMarginPx;
}

function recordWikiModeDiagnostic(mode: PerformanceMode, policy: WikiPerformancePolicy): void {
  const signature = `${mode}:${policy.batchSize}:${policy.maxLinksPerPost}:${policy.maxTextChars}`;
  if (signature === lastWikiModeDiagnosticSignature) return;
  lastWikiModeDiagnosticSignature = signature;
  recordRuntimeDiagnostic("performancePolicy", {
    mode,
    batchSize: policy.batchSize,
    maxLinksPerPost: Number.isFinite(policy.maxLinksPerPost) ? policy.maxLinksPerPost : "unbounded",
    maxLowConfidenceLinksPerPost: Number.isFinite(policy.maxLowConfidenceLinksPerPost) ? policy.maxLowConfidenceLinksPerPost : "unbounded",
    maxTextChars: Number.isFinite(policy.maxTextChars) ? policy.maxTextChars : "unbounded",
    viewportMarginPx: policy.viewportMarginPx,
    updatedAt: Date.now(),
  });
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
  link.addEventListener("click", (event) => {
    event.stopPropagation();
    if (shouldUseNativeLink(event)) return;
    event.preventDefault();
    void openWikiSidebarUrl(link.href).then((opened) => {
      if (!opened) window.open(link.href, "_blank", "noopener,noreferrer");
    });
  });
  attachPreviewHandlers(link, () => settings);
  return link;
}

async function openWikiSidebarUrl(url: string): Promise<boolean> {
  try {
    (window as unknown as Record<string, unknown>)[WIKI_SIDEBAR_PENDING_URL_KEY] = url;
    await chrome.storage.local.set({ [WIKI_SIDEBAR_LAST_URL_KEY]: url }).catch(() => undefined);
    document.dispatchEvent(new CustomEvent("milxdy:wiki-sidebar-open", { detail: { url } }));
    const loaded = await loadRuntimeAppById("wikiSidebar", "wikiLink");
    if (await openWithWikiSidebarModule(loaded, url)) return true;
    const directModule = await import(chrome.runtime.getURL("features/wikiSidebar.js")) as unknown;
    if (await openWithWikiSidebarModule(directModule, url)) return true;
    return false;
  } catch {
    return false;
  }
}

async function openWithWikiSidebarModule(module: unknown, url: string): Promise<boolean> {
  const sidebar = module as {
    boot?: () => Promise<void> | void;
    openWikiUrl?: (value?: string) => Promise<void> | void;
  } | null;
  if (typeof sidebar?.openWikiUrl !== "function") return false;
  await Promise.resolve(sidebar.boot?.());
  await Promise.resolve(sidebar.openWikiUrl(url));
  return true;
}

function shouldUseNativeLink(event: MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}
