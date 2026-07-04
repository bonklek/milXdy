import { cleanText, isNonReadableTweetTextArtifact, removeNonReadableTweetTextArtifacts } from "./extractText";
import { hasExtensionRuntime } from "../../platform/background/extension-runtime";
import type { MilxdyContentAppContext } from "../../platform/app-sdk/app-platform";
import { normalizeXStatusUrl } from "./urlPolicy";

const cache = new Map<string, string | null>();
const embeddedQuoteCache = new Map<string, EmbeddedQuote | null>();
let lastEmbeddedQuoteDiagnostic: string | null = null;
let runtimeSendMessage: MilxdyContentAppContext["sendMessage"] | null = null;

export type FullQuoteFetchResult = {
  text: string | null;
  status: "ok" | "cached-miss" | "bad-url" | "http-error" | "no-text";
  source?: string;
  attempts?: FullQuoteFetchAttempt[];
};

export type FullQuoteFetchAttempt = {
  source: "syndication" | "html" | "oembed";
  status: "ok" | "no-text" | "error" | "unavailable" | "http-error";
  textLength?: number;
  reason?: string;
};

export type EmbeddedQuote = {
  authorDisplayName: string;
  text: string;
  url: string;
  truncated: boolean;
};

export function configureFullQuoteRuntimeMessage(sendMessage: MilxdyContentAppContext["sendMessage"] | null): void {
  runtimeSendMessage = sendMessage;
}

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

export function getLastEmbeddedQuoteDiagnostic(): string | null {
  return lastEmbeddedQuoteDiagnostic;
}

export async function fetchFullQuote(url: string, signal: AbortSignal): Promise<FullQuoteFetchResult> {
  const normalizedUrl = normalizeQuoteUrl(url);
  if (!normalizedUrl) return { text: null, status: "bad-url" };
  if (cache.has(normalizedUrl)) return { text: cache.get(normalizedUrl) ?? null, status: cache.get(normalizedUrl) ? "ok" : "cached-miss" };
  const attempts: FullQuoteFetchAttempt[] = [];

  const syndicationText = await fetchSyndicationText(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    attempts.push({ source: "syndication", status: "error", reason: safeErrorMessage(error) });
    return null;
  });
  if (syndicationText) {
    attempts.push({ source: "syndication", status: "ok", textLength: syndicationText.length });
    cache.set(normalizedUrl, syndicationText);
    return { text: syndicationText, status: "ok", source: "syndication", attempts };
  }
  if (!attempts.some((attempt) => attempt.source === "syndication")) attempts.push({ source: "syndication", status: "no-text" });

  const htmlText = await fetchHtmlText(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    attempts.push({ source: "html", status: "error", reason: safeErrorMessage(error) });
    return null;
  });
  if (htmlText) {
    attempts.push({ source: "html", status: "ok", textLength: htmlText.length });
    cache.set(normalizedUrl, htmlText);
    return { text: htmlText, status: "ok", source: "html", attempts };
  }
  if (!attempts.some((attempt) => attempt.source === "html")) attempts.push({ source: "html", status: "no-text" });

  const embedText = await fetchOembedText(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    attempts.push({ source: "oembed", status: "error", reason: safeErrorMessage(error) });
    return null;
  });
  if (embedText) {
    attempts.push({ source: "oembed", status: "ok", textLength: embedText.length });
    cache.set(normalizedUrl, embedText);
    return { text: embedText, status: "ok", source: "oembed", attempts };
  }
  if (!attempts.some((attempt) => attempt.source === "oembed")) attempts.push({ source: "oembed", status: "no-text" });

  cache.set(normalizedUrl, null);
  return { text: null, status: "no-text", attempts };
}

async function fetchHtmlText(url: string, signal: AbortSignal): Promise<string | null> {
  const html = await fetchText(url, signal);
  const text = extractTextFromHtml(html);
  return text;
}

async function fetchText(url: string, signal: AbortSignal): Promise<string> {
  if (hasExtensionRuntime()) {
    const response = await sendRuntimeMessage<FetchTextResponse>({ type: "post-reading:fetchText", url }, signal);
    if (!response.ok) throw new Error(`Text fetch failed: ${response.error || response.status}`);
    return response.text;
  }

  const response = await fetch(url, {
    credentials: "omit",
    signal,
  });
  if (!response.ok) throw new Error(`Text fetch failed: ${response.status}`);
  return await response.text();
}

export async function fetchEmbeddedQuote(url: string, signal: AbortSignal): Promise<EmbeddedQuote | null> {
  const normalizedUrl = normalizeQuoteUrl(url);
  if (!normalizedUrl) return null;
  lastEmbeddedQuoteDiagnostic = null;
  const cachedQuote = embeddedQuoteCache.get(normalizedUrl);
  if (cachedQuote) return cachedQuote;

  const data = await fetchSyndicationTweet(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  });
  const quoted = data?.quoted_tweet;
  const text = cleanSyndicationTweetText(quoted);
  const screenName = quoted?.user?.screen_name;
  const id = quoted?.id_str;
  const quoteUrl = screenName && id ? `https://x.com/${screenName}/status/${id}` : null;
  const htmlText = quoteUrl
    ? await fetchHtmlText(quoteUrl, signal).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      return null;
    })
    : null;
  const best = chooseBestTextCandidate([
    { source: "html", text: htmlText },
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
  if (result) embeddedQuoteCache.set(normalizedUrl, result);
  return result;
}

function chooseBestTextCandidate(candidates: TextCandidate[]): PresentTextCandidate | null {
  const present = candidates.filter((candidate): candidate is PresentTextCandidate => Boolean(candidate.text));
  present.sort((a, b) => scoreTweetText(b.text) - scoreTweetText(a.text));
  return present[0] || null;
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.name || "Error" : "UnknownError";
}

async function fetchOembedText(url: string, signal: AbortSignal): Promise<string | null> {
  const endpoint = new URL("https://publish.twitter.com/oembed");
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("omit_script", "1");
  const data = await fetchJson(endpoint.toString(), signal) as { html?: unknown };
  return typeof data.html === "string" ? extractTextFromOembedHtml(data.html) : null;
}

async function fetchSyndicationText(url: string, signal: AbortSignal): Promise<string | null> {
  const data = await fetchSyndicationTweet(url, signal);
  return cleanSyndicationTweetText(data);
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
  return await fetchJson(url, signal) as SyndicationTweet;
}

async function fetchJson(url: string, signal: AbortSignal): Promise<unknown> {
  if (hasExtensionRuntime()) {
    const response = await sendRuntimeMessage<FetchJsonResponse>({ type: "post-reading:fetchJson", url }, signal);
    if (!response.ok) throw new Error(`JSON fetch failed: ${response.error || response.status}`);
    return response.data;
  }

  throw new Error("Extension runtime unavailable for JSON fetch");
}

type FetchJsonResponse =
  | { ok: true; data: unknown }
  | { ok: false; status: number; error: string };

type FetchTextResponse =
  | { ok: true; text: string }
  | { ok: false; status: number; error: string };

type RuntimeFetchMessage =
  | { type: "post-reading:fetchJson"; url: string }
  | { type: "post-reading:fetchText"; url: string };

function sendRuntimeMessage<TResponse>(message: RuntimeFetchMessage, signal: AbortSignal): Promise<TResponse> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    if (!runtimeSendMessage) {
      reject(new Error("Post-reading runtime messaging unavailable"));
      return;
    }
    const abort = (): void => reject(new DOMException("Aborted", "AbortError"));
    signal.addEventListener("abort", abort, { once: true });
    void runtimeSendMessage<TResponse>(message, message.type).then((response) => {
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
  full_text?: string;
  tweet_text?: string;
  display_text_range?: [number, number];
  user?: {
    name?: string;
    screen_name?: string;
  };
  quoted_tweet?: SyndicationTweet;
  note_tweet?: unknown;
  note_tweet_results?: unknown;
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

function cleanSyndicationTweetText(tweet: SyndicationTweet | null | undefined): string | null {
  if (!tweet) return null;
  const noteText = findNoteTweetText(tweet.note_tweet) || findNoteTweetText(tweet.note_tweet_results);
  const candidates = [
    cleanSyndicationText(noteText || "", undefined),
    cleanSyndicationText(tweet.full_text || "", tweet.display_text_range),
    cleanSyndicationText(tweet.tweet_text || "", tweet.display_text_range),
    cleanSyndicationText(tweet.text || "", tweet.display_text_range),
  ].filter((text): text is string => Boolean(text));
  return chooseBestTweetText(candidates);
}

function findNoteTweetText(value: unknown): string | null {
  return findBestNoteTweetText(value, new WeakSet<object>());
}

function findBestNoteTweetText(value: unknown, seen: WeakSet<object>): string | null {
  if (!value || typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);
  const record = value as Record<string, unknown>;
  const candidates = [
    firstString(record.text, record.full_text, record.tweet_text),
    findBestNoteTweetText(record.result, seen),
    findBestNoteTweetText(record.note_tweet, seen),
    findBestNoteTweetText(record.note_tweet_results, seen),
    findBestNoteTweetText(record.noteTweetResults, seen),
    findBestNoteTweetText(record.data, seen),
  ].filter((text): text is string => Boolean(text));

  for (const nested of Object.values(record)) {
    if (nested && typeof nested === "object") {
      const nestedText = findBestNoteTweetText(nested, seen);
      if (nestedText) candidates.push(nestedText);
    }
  }

  candidates.sort((a, b) => scoreTweetText(b) - scoreTweetText(a));
  return candidates[0] || null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function normalizeQuoteUrl(value: string): string | null {
  return normalizeXStatusUrl(value, window.location.origin);
}

export function extractTextFromHtml(html: string): string | null {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const tweetTexts = Array.from(doc.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
    .map((element) => cleanFormattedTweetText(readVisibleTweetText(element)))
    .filter((text) => text && !isNonReadableTweetTextArtifact(text));
  const serverRenderedText = extractServerRenderedTweetText(doc);

  const metaDescription = doc.querySelector<HTMLMetaElement>('meta[property="og:description"], meta[name="description"]')?.content || "";
  const candidates = [
    ...tweetTexts,
    serverRenderedText,
    cleanMetaDescription(metaDescription),
  ].filter((text): text is string => typeof text === "string"
    && text.length > 0
    && !isPrivacyExtensionWarning(text)
    && !isNonReadableTweetTextArtifact(text));
  return chooseBestTweetText(candidates);
}

function readVisibleTweetText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;
  removeNonReadableTweetTextArtifacts(clone);
  return clone.innerText || clone.textContent || "";
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

function looksTruncated(text: string): boolean {
  return /(\.\.\.|…)$/.test(text.trim()) || /\shttps?:\/\/t\.co\/\S*$/i.test(text.trim());
}

function isPrivacyExtensionWarning(text: string): boolean {
  return /some privacy related extensions may cause issues on x\.com/i.test(text);
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
