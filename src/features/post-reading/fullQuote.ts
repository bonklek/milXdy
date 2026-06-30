import { cleanText } from "./extractText";
import { hasExtensionRuntime, safeRuntimeMessage } from "../../shared/extensionRuntime";

const cache = new Map<string, string | null>();
const embeddedQuoteCache = new Map<string, EmbeddedQuote | null>();
let graphQlConfigCache: Promise<GraphQlConfig | null> | null = null;
let lastEmbeddedQuoteDiagnostic: string | null = null;
let lastGraphQlDiscoveryDiagnostic = "not-run";

export type FullQuoteFetchResult = {
  text: string | null;
  status: "ok" | "cached-miss" | "bad-url" | "http-error" | "no-text";
  source?: string;
  attempts?: FullQuoteFetchAttempt[];
};

export type FullQuoteFetchAttempt = {
  source: "graphql" | "syndication" | "html" | "oembed" | "rendered";
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

type TextCandidate = {
  source: string;
  text: string | null;
};

type PresentTextCandidate = {
  source: string;
  text: string;
};

type GraphQlConfig = {
  bearer: string;
  queryId: string;
};

type AttemptResult = {
  text: string | null;
  attempt: FullQuoteFetchAttempt;
};

type GraphQlTweetResult = {
  data: unknown;
  attempt: FullQuoteFetchAttempt;
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

  const graphQlResult = await fetchGraphQlTweetText(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return attemptResult("graphql", null, "error", safeErrorMessage(error));
  });
  attempts.push(graphQlResult.attempt);
  if (graphQlResult.text) {
    cache.set(normalizedUrl, graphQlResult.text);
    return { text: graphQlResult.text, status: "ok", source: "graphql", attempts };
  }

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

  const renderedText = await fetchRenderedTweetText(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    attempts.push({ source: "rendered", status: "error", reason: safeErrorMessage(error) });
    return null;
  });
  if (renderedText) {
    attempts.push({ source: "rendered", status: "ok", textLength: renderedText.length });
    cache.set(normalizedUrl, renderedText);
    return { text: renderedText, status: "ok", source: "rendered", attempts };
  }
  if (!attempts.some((attempt) => attempt.source === "rendered")) attempts.push({ source: "rendered", status: "no-text" });

  const text = await fetchHtmlText(normalizedUrl, signal);
  cache.set(normalizedUrl, text);
  return { text, status: text ? "ok" : "no-text", source: text ? "html" : undefined, attempts };
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
    credentials: "include",
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
  const graphQlQuote = await fetchGraphQlEmbeddedQuote(normalizedUrl, signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    return null;
  });
  if (graphQlQuote?.text && graphQlQuote.url) {
    embeddedQuoteCache.set(normalizedUrl, graphQlQuote);
    return graphQlQuote;
  }

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
  const graphQlText = quoteUrl
    ? (await fetchGraphQlTweetText(quoteUrl, signal).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      return attemptResult("graphql", null, "error", safeErrorMessage(error));
    })).text
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
  if (result) embeddedQuoteCache.set(normalizedUrl, result);
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

async function fetchGraphQlTweetText(url: string, signal: AbortSignal): Promise<AttemptResult> {
  const result = await fetchGraphQlTweetResult(url, signal);
  if (!result.data) return { text: null, attempt: result.attempt };
  const text = cleanSyndicationText(findLongFormText(result.data) || findTweetLegacyText(result.data) || "");
  return attemptResult("graphql", text, text ? "ok" : "no-text");
}

async function fetchGraphQlEmbeddedQuote(url: string, signal: AbortSignal): Promise<EmbeddedQuote | null> {
  const result = await fetchGraphQlTweetResult(url, signal);
  if (!result.data) {
    lastEmbeddedQuoteDiagnostic = `graphql ${result.attempt.reason || result.attempt.status}`;
    return null;
  }
  const quoted = findQuotedTweetObject(result.data);
  if (!quoted) {
    lastEmbeddedQuoteDiagnostic = "graphql no quoted tweet";
    return null;
  }
  const text = cleanSyndicationText(findLongFormText(quoted) || findTweetLegacyText(quoted) || "");
  const id = findTweetIdInObject(quoted);
  const screenName = findScreenNameInObject(quoted);
  if (!text || !id || !screenName) {
    lastEmbeddedQuoteDiagnostic = `graphql quoted tweet missing ${!text ? "text" : !id ? "id" : "handle"}`;
    return null;
  }
  return {
    authorDisplayName: findDisplayNameInObject(quoted) || screenName,
    text,
    url: `https://x.com/${screenName}/status/${id}`,
    truncated: false,
  };
}

async function fetchGraphQlTweetResult(url: string, signal: AbortSignal): Promise<GraphQlTweetResult> {
  const id = extractTweetId(url);
  if (!id) return { data: null, attempt: attemptResult("graphql", null, "unavailable", "missing-id").attempt };
  const config = await discoverGraphQlConfig(signal);
  if (!config) return { data: null, attempt: attemptResult("graphql", null, "unavailable", lastGraphQlDiscoveryDiagnostic).attempt };
  const csrfToken = getCsrfToken();
  if (!csrfToken) return { data: null, attempt: attemptResult("graphql", null, "unavailable", "missing-csrf").attempt };

  const endpoint = new URL(`https://x.com/i/api/graphql/${config.queryId}/TweetResultByRestId`);
  endpoint.searchParams.set("variables", JSON.stringify({
    tweetId: id,
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false,
  }));
  endpoint.searchParams.set("features", JSON.stringify(graphQlFeatures()));
  endpoint.searchParams.set("fieldToggles", JSON.stringify(graphQlFieldToggles()));

  const response = await fetch(endpoint.toString(), {
    credentials: "include",
    signal,
    headers: {
      authorization: `Bearer ${config.bearer}`,
      "x-csrf-token": csrfToken,
      "x-twitter-active-user": "yes",
      "x-twitter-auth-type": "OAuth2Session",
    },
  });
  if (!response.ok) return { data: null, attempt: attemptResult("graphql", null, "http-error", `http-${response.status}`).attempt };
  return { data: await response.json() as unknown, attempt: attemptResult("graphql", "", "ok").attempt };
}

function attemptResult(
  source: FullQuoteFetchAttempt["source"],
  text: string | null,
  status: FullQuoteFetchAttempt["status"],
  reason?: string,
): AttemptResult {
  return {
    text,
    attempt: {
      source,
      status,
      textLength: text?.length,
      reason,
    },
  };
}

function safeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/Bearer\s+[A-Za-z0-9%._-]+/gi, "Bearer [redacted]").slice(0, 120);
}

async function discoverGraphQlConfig(signal: AbortSignal): Promise<GraphQlConfig | null> {
  graphQlConfigCache ??= discoverGraphQlConfigUncached(signal);
  return await graphQlConfigCache;
}

async function discoverGraphQlConfigUncached(signal: AbortSignal): Promise<GraphQlConfig | null> {
  let scanned = 0;
  let fetched = 0;
  let bearerFound = false;
  let queryFound = false;
  let lastFetchError = "";
  const inlineConfig = extractGraphQlConfigFromText(document.documentElement.outerHTML);
  bearerFound ||= Boolean(extractBearerToken(document.documentElement.outerHTML));
  queryFound ||= Boolean(extractTweetResultQueryId(document.documentElement.outerHTML));
  if (inlineConfig) {
    lastGraphQlDiscoveryDiagnostic = "discovery inline";
    return inlineConfig;
  }

  for (const scriptUrl of getLikelyXScriptUrls()) {
    scanned += 1;
    const scriptText = await fetchSameOriginText(scriptUrl, signal).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      lastFetchError = safeErrorMessage(error);
      return "";
    });
    if (scriptText) fetched += 1;
    bearerFound ||= Boolean(extractBearerToken(scriptText));
    queryFound ||= Boolean(extractTweetResultQueryId(scriptText));
    const config = extractGraphQlConfigFromText(scriptText);
    if (config) {
      lastGraphQlDiscoveryDiagnostic = `discovery scripts scanned=${scanned} fetched=${fetched}`;
      return config;
    }
  }

  const shellText = await fetchSameOriginText("https://x.com/home", signal).catch((error) => {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    lastFetchError = safeErrorMessage(error);
    return "";
  });
  if (shellText) fetched += 1;
  bearerFound ||= Boolean(extractBearerToken(shellText));
  queryFound ||= Boolean(extractTweetResultQueryId(shellText));
  const shellConfig = extractGraphQlConfigFromText(shellText);
  if (shellConfig) {
    lastGraphQlDiscoveryDiagnostic = `discovery shell fetched=${fetched}`;
    return shellConfig;
  }

  for (const scriptUrl of getLikelyXScriptUrls(shellText)) {
    scanned += 1;
    const scriptText = await fetchSameOriginText(scriptUrl, signal).catch((error) => {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      lastFetchError = safeErrorMessage(error);
      return "";
    });
    if (scriptText) fetched += 1;
    bearerFound ||= Boolean(extractBearerToken(scriptText));
    queryFound ||= Boolean(extractTweetResultQueryId(scriptText));
    const config = extractGraphQlConfigFromText(scriptText);
    if (config) {
      lastGraphQlDiscoveryDiagnostic = `discovery shell-scripts scanned=${scanned} fetched=${fetched}`;
      return config;
    }
  }

  graphQlConfigCache = null;
  lastGraphQlDiscoveryDiagnostic = [
    "discovery-failed",
    `scanned=${scanned}`,
    `fetched=${fetched}`,
    `bearer=${bearerFound ? "yes" : "no"}`,
    `query=${queryFound ? "yes" : "no"}`,
    lastFetchError ? `last=${lastFetchError}` : "",
  ].filter(Boolean).join(" ");
  return null;
}

function getLikelyXScriptUrls(html = ""): string[] {
  const urls = new Set<string>();
  for (const script of Array.from(document.scripts)) {
    if (script.src && isLikelyXScriptUrl(script.src)) urls.add(new URL(script.src, window.location.href).toString());
  }
  for (const link of Array.from(document.querySelectorAll<HTMLLinkElement>('link[href][as="script"], link[rel~="preload"][href], link[rel~="prefetch"][href]'))) {
    if (link.href && isLikelyXScriptUrl(link.href)) urls.add(new URL(link.href, window.location.href).toString());
  }
  const scriptMatches = html.matchAll(/<script[^>]+src=["']([^"']+)["']/gi);
  for (const match of scriptMatches) {
    const src = match[1];
    if (src && isLikelyXScriptUrl(src)) urls.add(new URL(src, "https://x.com").toString());
  }
  const linkMatches = html.matchAll(/<link[^>]+href=["']([^"']+\.js[^"']*)["'][^>]*(?:as=["']script["']|rel=["'][^"']*(?:preload|prefetch)[^"']*["'])|<link[^>]+(?:as=["']script["']|rel=["'][^"']*(?:preload|prefetch)[^"']*["'])[^>]+href=["']([^"']+\.js[^"']*)["']/gi);
  for (const match of linkMatches) {
    const href = match[1] || match[2];
    if (href && isLikelyXScriptUrl(href)) urls.add(new URL(href, "https://x.com").toString());
  }
  return Array.from(urls).sort(rankXScriptUrl).slice(0, 64);
}

function rankXScriptUrl(left: string, right: string): number {
  return scriptPriority(left) - scriptPriority(right);
}

function scriptPriority(value: string): number {
  if (/Tweet|Conversation|LoggedInApiFilters/i.test(value)) return 0;
  if (/main\./i.test(value)) return 1;
  if (/vendor\./i.test(value)) return 2;
  return 3;
}

function isLikelyXScriptUrl(value: string): boolean {
  try {
    const url = new URL(value, window.location.href);
    return (url.hostname === "x.com" || url.hostname === "abs.twimg.com" || url.hostname.endsWith(".twimg.com"))
      && /\.js(?:$|\?)/i.test(url.pathname + url.search);
  } catch {
    return false;
  }
}

async function fetchSameOriginText(url: string, signal: AbortSignal): Promise<string> {
  if (hasExtensionRuntime()) {
    const response = await sendRuntimeMessage<FetchTextResponse>({ type: "post-reading:fetchText", url }, signal);
    if (response.ok) return response.text;
    if (response.error !== "UNSUPPORTED_URL") throw new Error(`Text fetch failed: ${response.error || response.status}`);
  }
  const response = await fetch(url, { credentials: "include", signal });
  if (!response.ok) return "";
  return await response.text();
}

function extractGraphQlConfigFromText(text: string): GraphQlConfig | null {
  const bearer = extractBearerToken(text);
  const queryId = extractTweetResultQueryId(text);
  return bearer && queryId ? { bearer, queryId } : null;
}

function extractBearerToken(text: string): string | null {
  const bearerMatch = text.match(/Bearer\s+([A-Za-z0-9%._-]{40,})/);
  if (bearerMatch?.[1]) return decodeURIComponent(bearerMatch[1]);
  const assignmentMatch = text.match(/authorization["']?\s*[:=]\s*["']Bearer\s+([^"']+)["']/i);
  return assignmentMatch?.[1] ? decodeURIComponent(assignmentMatch[1]) : null;
}

function extractTweetResultQueryId(text: string): string | null {
  const pathMatch = text.match(/\/i\/api\/graphql\/([A-Za-z0-9_-]+)\/TweetResultByRestId/);
  if (pathMatch?.[1]) return pathMatch[1];
  const objectMatch = text.match(/queryId\s*:\s*["']([A-Za-z0-9_-]{12,})["']\s*,\s*operationName\s*:\s*["']TweetResultByRestId["']/);
  if (objectMatch?.[1]) return objectMatch[1];
  const reverseObjectMatch = text.match(/operationName\s*:\s*["']TweetResultByRestId["'][\s\S]{0,180}?queryId\s*:\s*["']([A-Za-z0-9_-]{12,})["']/);
  if (reverseObjectMatch?.[1]) return reverseObjectMatch[1];
  const adjacentMatch = text.match(/["']([A-Za-z0-9_-]{12,})["']\s*,\s*["']TweetResultByRestId["']/);
  return adjacentMatch?.[1] || null;
}

function findLongFormText(value: unknown): string | null {
  return findStringByPath(value, "note_tweet_results", "result", "text");
}

function findTweetLegacyText(value: unknown): string | null {
  return findStringByPath(value, "legacy", "full_text") || findStringByPath(value, "legacy", "text");
}

function findQuotedTweetObject(value: unknown): unknown {
  return findObjectByKeyPath(value, ["quoted_status_result", "result"])
    || findObjectByKeyPath(value, ["quoted_tweet_result", "result"])
    || findObjectByKeyPath(value, ["quotedRefResult", "result"])
    || findObjectByKeyPath(value, ["quoted_tweet"])
    || findObjectByKeyPath(value, ["quotedTweet"]);
}

function findTweetIdInObject(value: unknown): string | null {
  return findStringByPath(value, "rest_id")
    || findStringByPath(value, "id_str")
    || findStringByPath(value, "legacy", "id_str")
    || findStringByPath(value, "tweet", "rest_id")
    || findStringByPath(value, "tweet", "legacy", "id_str");
}

function findScreenNameInObject(value: unknown): string | null {
  return findStringByPath(value, "core", "user_results", "result", "legacy", "screen_name")
    || findStringByPath(value, "core", "user_results", "result", "core", "screen_name")
    || findStringByPath(value, "core", "user_results", "result", "screen_name")
    || findStringByPath(value, "core", "user_results", "result", "screenName")
    || findStringByPath(value, "user", "screen_name")
    || findStringByPath(value, "user", "screenName")
    || findStringByPath(value, "user", "username")
    || findStringByPath(value, "legacy", "user", "screen_name")
    || findStringByPath(value, "tweet", "core", "user_results", "result", "legacy", "screen_name")
    || findStringByPath(value, "tweet", "core", "user_results", "result", "core", "screen_name")
    || findDeepStringByKey(value, ["screen_name", "screenName", "username"]);
}

function findDisplayNameInObject(value: unknown): string | null {
  return findStringByPath(value, "core", "user_results", "result", "legacy", "name")
    || findStringByPath(value, "core", "user_results", "result", "core", "name")
    || findStringByPath(value, "core", "user_results", "result", "name")
    || findStringByPath(value, "user", "name")
    || findStringByPath(value, "legacy", "user", "name")
    || findStringByPath(value, "tweet", "core", "user_results", "result", "legacy", "name")
    || findStringByPath(value, "tweet", "core", "user_results", "result", "core", "name")
    || findDeepStringByKey(value, ["name"]);
}

function findStringByPath(value: unknown, ...path: string[]): string | null {
  const found = findObjectWithPath(value, path);
  return typeof found === "string" ? found : null;
}

function findObjectByKeyPath(value: unknown, path: string[]): unknown {
  const found = findValueWithPath(value, path);
  return found && typeof found === "object" ? found : null;
}

function findDeepStringByKey(value: unknown, keys: string[], seen = new WeakSet<object>()): string | null {
  if (!value || typeof value !== "object") return null;
  if (seen.has(value)) return null;
  seen.add(value);
  const record = value as Record<string, unknown>;
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate;
  }
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const entry of child) {
        const found = findDeepStringByKey(entry, keys, seen);
        if (found) return found;
      }
    } else {
      const found = findDeepStringByKey(child, keys, seen);
      if (found) return found;
    }
  }
  return null;
}

function findObjectWithPath(value: unknown, path: string[]): unknown {
  return findValueWithPath(value, path);
}

function findValueWithPath(value: unknown, path: string[]): unknown {
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
  if (cursor !== null && cursor !== undefined) return cursor;
  for (const child of Object.values(record)) {
    const found = Array.isArray(child)
      ? child.map((entry) => findValueWithPath(entry, path)).find((entry) => entry !== null && entry !== undefined)
      : findValueWithPath(child, path);
    if (found !== null && found !== undefined) return found;
  }
  return null;
}

function getCsrfToken(): string {
  return decodeURIComponent(document.cookie.match(/(?:^|; )ct0=([^;]+)/)?.[1] || "");
}

function graphQlFeatures(): Record<string, boolean> {
  return {
    articles_preview_enabled: true,
    c9s_tweet_anatomy_moderator_badge_enabled: true,
    communities_web_enable_tweet_community_results_fetch: true,
    creator_subscriptions_tweet_preview_api_enabled: true,
    freedom_of_speech_not_reach_fetch_enabled: true,
    graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
    longform_notetweets_consumption_enabled: true,
    longform_notetweets_inline_media_enabled: true,
    longform_notetweets_rich_text_read_enabled: true,
    post_ctas_fetch_enabled: true,
    premium_content_api_read_enabled: false,
    profile_label_improvements_pcf_label_in_post_enabled: true,
    responsive_web_edit_tweet_api_enabled: true,
    responsive_web_enhance_cards_enabled: false,
    responsive_web_grok_analyze_button_fetch_trends_enabled: false,
    responsive_web_grok_analyze_post_followups_enabled: true,
    responsive_web_grok_annotations_enabled: true,
    responsive_web_grok_community_note_auto_translation_is_enabled: false,
    responsive_web_grok_image_annotation_enabled: true,
    responsive_web_grok_imagine_annotation_enabled: true,
    responsive_web_grok_share_attachment_enabled: true,
    responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
    responsive_web_graphql_timeline_navigation_enabled: true,
    responsive_web_jetfuel_frame: false,
    responsive_web_profile_redirect_enabled: false,
    responsive_web_twitter_article_tweet_consumption_enabled: true,
    rweb_cashtags_composer_attachment_enabled: false,
    rweb_cashtags_enabled: false,
    rweb_tipjar_consumption_enabled: true,
    rweb_video_screen_enabled: false,
    standardized_nudges_misinfo: true,
    tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
    verified_phone_label_enabled: false,
    view_counts_everywhere_api_enabled: true,
  };
}

function graphQlFieldToggles(): Record<string, boolean> {
  return {
    withArticlePlainText: false,
    withArticleRichContentState: true,
    withArticleSummaryText: false,
    withArticleVoiceOver: false,
    withAuxiliaryUserLabels: false,
    withDisallowedReplyControls: false,
    withGrokAnalyze: false,
    withPayments: false,
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
  if (hasExtensionRuntime()) {
    const response = await sendRuntimeMessage<FetchJsonResponse>({ type: "post-reading:fetchJson", url }, signal);
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
  | { type: "post-reading:fetchJson"; url: string }
  | { type: "post-reading:fetchText"; url: string };

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
