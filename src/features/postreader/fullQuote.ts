import { cleanText } from "./extractText";
import { hasExtensionRuntime, safeRuntimeMessage } from "../../shared/extensionRuntime";

const cache = new Map<string, string | null>();
const embeddedQuoteCache = new Map<string, EmbeddedQuote | null>();
const X_GRAPHQL_BEARER = "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA";
const TWEET_RESULT_QUERY_ID = "8CEYnZhCp0dx9DFyyEBlbQ";

export type FullQuoteFetchResult = {
  text: string | null;
  status: "ok" | "cached-miss" | "bad-url" | "http-error" | "no-text";
};

export type EmbeddedQuote = {
  authorDisplayName: string;
  text: string;
  url: string;
  truncated: boolean;
};

type TextCandidate = {
  source: string;
  text: string | null;
};

type PresentTextCandidate = {
  source: string;
  text: string;
};

export async function fetchFullQuoteText(url: string, signal: AbortSignal): Promise<string | null> {
  return (await fetchFullQuote(url, signal)).text;
}

export async function fetchFullQuote(url: string, signal: AbortSignal): Promise<FullQuoteFetchResult> {
  const normalizedUrl = normalizeQuoteUrl(url);
  if (!normalizedUrl) return { text: null, status: "bad-url" };
  if (cache.has(normalizedUrl)) return { text: cache.get(normalizedUrl) ?? null, status: cache.get(normalizedUrl) ? "ok" : "cached-miss" };

  const htmlText = await fetchHtmlText(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  });
  if (htmlText) {
    cache.set(normalizedUrl, htmlText);
    return { text: htmlText, status: "ok" };
  }

  const graphQlText = await fetchGraphQlTweetText(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  });
  if (graphQlText) {
    cache.set(normalizedUrl, graphQlText);
    return { text: graphQlText, status: "ok" };
  }

  const syndicationText = await fetchSyndicationText(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  });
  if (syndicationText) {
    cache.set(normalizedUrl, syndicationText);
    return { text: syndicationText, status: "ok" };
  }

  const embedText = await fetchOembedText(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  });
  if (embedText) {
    cache.set(normalizedUrl, embedText);
    return { text: embedText, status: "ok" };
  }

  const text = await fetchHtmlText(normalizedUrl, signal);
  cache.set(normalizedUrl, text);
  return { text, status: text ? "ok" : "no-text" };
}

async function fetchHtmlText(url: string, signal: AbortSignal): Promise<string | null> {
  const html = await fetchText(url, signal);
  const text = extractTextFromHtml(html);
  debugFullQuote("html:extracted", { url, htmlLength: html.length, textLength: text?.length ?? 0, start: text?.slice(0, 80) ?? "" });
  return text;
}

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  if (hasExtensionRuntime()) {
    const response = await sendRuntimeMessage<FetchTextResponse>({ type: "postreader:fetchText", url }, signal);
    if (!response.ok) throw new Error(`Text fetch failed: ${response.error || response.status}`);
    return response.text;
  }

  const response = await fetch(url, {
    credentials: "include",
    signal,
  });
  if (!response.ok) throw new Error(`Text fetch failed: ${response.status}`);
  return await response.text();
}

export async function fetchEmbeddedQuote(url: string, signal: AbortSignal): Promise<EmbeddedQuote | null> {
  const normalizedUrl = normalizeQuoteUrl(url);
  if (!normalizedUrl) return null;
  if (embeddedQuoteCache.has(normalizedUrl)) return embeddedQuoteCache.get(normalizedUrl) ?? null;
  debugFullQuote("embedded:start", { sourceUrl: normalizedUrl });
  const data = await fetchSyndicationTweet(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    debugFullQuote("embedded:syndication-error", { sourceUrl: normalizedUrl, error: errorMessage(error) });
    return null;
  });
  const quoted = data?.quoted_tweet;
  const text = cleanSyndicationText(quoted?.text || "", quoted?.display_text_range);
  const screenName = quoted?.user?.screen_name;
  const id = quoted?.id_str;
  const quoteUrl = screenName && id ? `https://x.com/${screenName}/status/${id}` : null;
  debugFullQuote("embedded:metadata", {
    sourceUrl: normalizedUrl,
    quoteUrl,
    previewLength: text?.length ?? 0,
    hasQuotedTweet: Boolean(quoted),
  });
  const htmlText = quoteUrl
    ? await fetchHtmlText(quoteUrl, signal).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      debugFullQuote("embedded:html-error", { quoteUrl, error: errorMessage(error) });
      return null;
    })
    : null;
  const graphQlText = quoteUrl
    ? await fetchGraphQlTweetText(quoteUrl, signal).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      debugFullQuote("embedded:graphql-error", { quoteUrl, error: errorMessage(error) });
      return null;
    })
    : null;
  const best = chooseBestTextCandidate([
    { source: "html", text: htmlText },
    { source: "graphql", text: graphQlText },
    { source: "syndication", text },
  ]);
  const result = screenName && id
    ? {
        authorDisplayName: cleanText(quoted.user?.name || "") || screenName,
        text: best?.text || "",
        url: `https://x.com/${screenName}/status/${id}`,
        truncated: Boolean(quoted.note_tweet && best?.source === "syndication"),
      }
    : null;
  debugFullQuote("embedded:result", {
    sourceUrl: normalizedUrl,
    quoteUrl,
    htmlLength: htmlText?.length ?? 0,
    graphqlLength: graphQlText?.length ?? 0,
    syndicationLength: text?.length ?? 0,
    chosenSource: best?.source ?? null,
    chosenLength: best?.text.length ?? 0,
    result: Boolean(result),
  });
  embeddedQuoteCache.set(normalizedUrl, result);
  return result;
}

function chooseBestTextCandidate(candidates: TextCandidate[]): PresentTextCandidate | null {
  const present = candidates.filter((candidate): candidate is PresentTextCandidate => Boolean(candidate.text));
  present.sort((a, b) => scoreTweetText(b.text) - scoreTweetText(a.text));
  return present[0] || null;
}

async function fetchRenderedTweetText(url: string, signal: AbortSignal): Promise<string | null> {
  if (signal.aborted) throw new DOMException("Aborted", "AbortError");
  const frame = document.createElement("iframe");
  frame.tabIndex = -1;
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = [
    "position:fixed",
    "width:1px",
    "height:1px",
    "left:-10000px",
    "top:-10000px",
    "opacity:0",
    "pointer-events:none",
    "border:0",
  ].join(";");

  const cleanup = (): void => {
    frame.remove();
  };
  const abortPromise = new Promise<never>((_, reject) => {
    signal.addEventListener("abort", () => {
      cleanup();
      reject(new DOMException("Aborted", "AbortError"));
    }, { once: true });
  });

  document.documentElement.appendChild(frame);
  frame.src = url;

  return await Promise.race([
    pollRenderedTweetText(frame).finally(cleanup),
    abortPromise,
  ]);
}

async function pollRenderedTweetText(frame: HTMLIFrameElement): Promise<string | null> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < 15000) {
    await delay(250);
    let doc: Document | null = null;
    try {
      doc = frame.contentDocument;
    } catch {
      return null;
    }
    const body = doc?.querySelector<HTMLElement>('[data-testid="tweetText"]');
    const text = cleanText(body?.innerText || body?.textContent || "");
    if (text.length > 0 && !/Something went wrong|Retry/i.test(text)) return text;
  }
  return null;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function fetchGraphQlTweetText(url: string, signal: AbortSignal): Promise<string | null> {
  const id = extractTweetId(url);
  if (!id) return null;
  const endpoint = new URL(`https://x.com/i/api/graphql/${TWEET_RESULT_QUERY_ID}/TweetResultByRestId`);
  endpoint.searchParams.set("variables", JSON.stringify({
    tweetId: id,
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false,
  }));
  endpoint.searchParams.set("features", JSON.stringify(graphQlFeatures()));
  endpoint.searchParams.set("fieldToggles", JSON.stringify(graphQlFieldToggles()));

  const response = await fetch(url, {
    credentials: "include",
    signal,
    headers: {
      authorization: `Bearer ${decodeURIComponent(X_GRAPHQL_BEARER)}`,
      "x-csrf-token": getCsrfToken(),
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
    },
  });
  if (!response.ok) return null;
  const data = await response.json() as unknown;
  return cleanSyndicationText(findLongFormText(data) || findTweetLegacyText(data) || "");
}

function findLongFormText(value: unknown): string | null {
  return findStringByPath(value, "note_tweet_results", "result", "text");
}

function findTweetLegacyText(value: unknown): string | null {
  return findStringByPath(value, "legacy", "full_text") || findStringByPath(value, "legacy", "text");
}

function findStringByPath(value: unknown, ...path: string[]): string | null {
  const found = findObjectWithPath(value, path);
  return typeof found === "string" ? found : null;
}

function findObjectWithPath(value: unknown, path: string[]): unknown {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  let cursor: unknown = record;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
      cursor = null;
      break;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  if (typeof cursor === "string") return cursor;
  for (const child of Object.values(record)) {
    const found = Array.isArray(child)
      ? child.map((entry) => findObjectWithPath(entry, path)).find((entry) => typeof entry === "string")
      : findObjectWithPath(child, path);
    if (typeof found === "string") return found;
  }
  return null;
}

function getCsrfToken(): string {
  return decodeURIComponent(document.cookie.match(/(?:^|; )ct0=([^;]+)/)?.[1] || "");
}

function graphQlFeatures(): Record<string, boolean> {
  return {
    creator_subscriptions_tweet_preview_api_enabled: true,
    premium_content_api_read_enabled: false,
    communities_web_enable_tweet_community_results_fetch: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    rweb_video_screen_enabled: false,
    rweb_cashtags_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_profile_redirect_enabled: false,
    rweb_tipjar_consumption_enabled: true,
    verified_phone_label_enabled: false,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
    rweb_cashtags_composer_attachment_enabled: false,
    responsive_web_jetfuel_frame: false,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    articles_preview_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    view_counts_everywhere_api_enabled: true,
    longform_notetweets_consumption_enabled: true,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    freedom_of_speech_not_reach_fetch_enabled: true,
    standardized_nudges_misinfo: true,
    post_ctas_fetch_enabled: true,
    responsive_web_enhance_cards_enabled: false,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
  };
}

function graphQlFieldToggles(): Record<string, boolean> {
  return {
    withArticleRichContentState: true,
    withArticlePlainText: false,
    withArticleSummaryText: false,
    withArticleVoiceOver: false,
    withGrokAnalyze: false,
    withDisallowedReplyControls: false,
    withPayments: false,
    withAuxiliaryUserLabels: false,
  };
}

async function fetchOembedText(url: string, signal: AbortSignal): Promise<string | null> {
  const endpoint = new URL("https://publish.twitter.com/oembed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("omit_script", "1");
  const response = await fetch(endpoint.toString(), {
    credentials: "omit",
    signal,
  });
  if (!response.ok) return null;
  const data = await response.json() as { html?: string };
  return data.html ? extractTextFromOembedHtml(data.html) : null;
}

async function fetchSyndicationText(url: string, signal: AbortSignal): Promise<string | null> {
  const data = await fetchSyndicationTweet(url, signal);
  return cleanSyndicationText(data.text || "", data.display_text_range);
}

async function fetchSyndicationTweet(url: string, signal: AbortSignal): Promise<SyndicationTweet> {
  const id = extractTweetId(url);
  if (!id) throw new Error("Missing tweet id");
  const endpoint = new URL("https://cdn.syndication.twimg.com/tweet-result");
  endpoint.searchParams.set("id", id);
  endpoint.searchParams.set("token", getSyndicationToken(id));
  endpoint.searchParams.set("lang", "en");
  return await fetchSyndicationJson(endpoint.toString(), signal);
}

async function fetchSyndicationJson(url: string, signal: AbortSignal): Promise<SyndicationTweet> {
  if (hasExtensionRuntime()) {
    const response = await sendRuntimeMessage<FetchJsonResponse>({ type: "postreader:fetchJson", url }, signal);
    if (!response.ok) throw new Error(`Syndication fetch failed: ${response.error || response.status}`);
    return response.data as SyndicationTweet;
  }

  throw new Error("Extension runtime unavailable for syndication fetch");
}

type FetchJsonResponse =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

type FetchTextResponse =
  | { ok: true; text: string }
  | { ok: false; status: number; error: string };

type RuntimeFetchMessage =
  | { type: "postreader:fetchJson"; url: string }
  | { type: "postreader:fetchText"; url: string };

function sendRuntimeMessage<TResponse>(message: RuntimeFetchMessage, signal: AbortSignal): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const abort = (): void => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    void safeRuntimeMessage<TResponse>(message).then((response) => {
      signal.removeEventListener("abort", abort);
      if (!response) {
        reject(new Error("Empty syndication response"));
        return;
      }
      resolve(response);
    }).catch((error: unknown) => {
      signal.removeEventListener("abort", abort);
      reject(error instanceof Error ? error : new Error(String(error)));
    });
  });
}

type SyndicationTweet = {
  id_str?: string;
  text?: string;
  display_text_range?: [number, number];
  user?: {
    name?: string;
    screen_name?: string;
  };
  quoted_tweet?: SyndicationTweet;
  note_tweet?: {
    id?: string;
  };
};

function extractTweetId(url: string): string | null {
  return new URL(url).pathname.match(/\/status\/(\d+)/)?.[1] || null;
}

function getSyndicationToken(id: string): string {
  return ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, "");
}

function cleanSyndicationText(value: string, displayRange?: [number, number]): string | null {
  const ranged = displayRange ? value.slice(displayRange[0], displayRange[1]) : value;
  const withoutUrls = ranged
    .replace(/https:\/\/t\.co\/\S+/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n");
  const text = cleanText(withoutUrls);
  return text.length > 0 ? text : null;
}

function normalizeQuoteUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (!/\/status\/\d+/.test(url.pathname)) return null;
    if (url.hostname === "twitter.com") url.hostname = "x.com";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function extractTextFromHtml(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tweetTexts = Array.from(doc.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
    .map((element) => cleanFormattedTweetText(element.innerText || element.textContent || ""))
    .filter(Boolean);
  const serverRenderedText = extractServerRenderedTweetText(doc);

  const metaDescription = doc.querySelector<HTMLMetaElement>('meta[property="og:description"], meta[name="description"]')?.content || "";
  const candidates = [
    ...tweetTexts,
    serverRenderedText,
    cleanMetaDescription(metaDescription),
  ].filter((text): text is string => typeof text === "string" && text.length > 0 && !isPrivacyExtensionWarning(text));
  return chooseBestTweetText(candidates);
}

function chooseBestTweetText(candidates: string[]): string | null {
  const unique = Array.from(new Set(candidates));
  unique.sort((a, b) => scoreTweetText(b) - scoreTweetText(a));
  return unique[0] || null;
}

function scoreTweetText(text: string): number {
  let score = text.length;
  if (looksTruncated(text)) score -= 1000;
  return score;
}

function debugFullQuote(stage: string, details: Record<string, unknown>): void {
  console.info(`Postreader full quote ${stage}`, details);
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function looksTruncated(text: string): boolean {
  return /(\.\.\.|…)$/.test(text.trim()) || /\shttps?:\/\/t\.co\/\S*$/i.test(text.trim());
}

function isPrivacyExtensionWarning(text: string): boolean {
  return /privacy|blocked|extension|tracking|cookies|javascript/i.test(text)
    && /browser|content|warning|enable|prevented|blocked/i.test(text);
}

function extractServerRenderedTweetText(doc: Document): string | null {
  const candidates = Array.from(doc.body.querySelectorAll<HTMLElement>("span"))
    .filter((element) => !element.closest("[data-href], a[href], nav, header, footer"))
    .map((element) => cleanFormattedTweetText(element.innerText || element.textContent || ""))
    .filter((text) => text.length > 80 && !/^https?:\/\//i.test(text));
  candidates.sort((a, b) => b.length - a.length);
  return candidates[0] || null;
}

function cleanFormattedTweetText(value: string): string {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractTextFromOembedHtml(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const paragraph = doc.querySelector("blockquote p");
  if (!paragraph) return null;
  for (const link of Array.from(paragraph.querySelectorAll("a"))) {
    link.remove();
  }
  const text = cleanText(paragraph.textContent || "");
  return text.length > 0 ? text : null;
}

function cleanMetaDescription(value: string): string | null {
  const text = cleanText(value);
  if (!text) return null;
  if (isPrivacyExtensionWarning(text)) return null;
  const quoted = text.match(/“([^”]+)”|"([^"]+)"/);
  if (quoted?.[1] || quoted?.[2]) return cleanText(quoted[1] || quoted[2]);
  return text.length > 12 ? text : null;
}
