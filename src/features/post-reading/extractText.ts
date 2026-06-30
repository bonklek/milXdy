import { CARD_WRAPPER, QUOTE_TWEET, TWEET_PHOTO, TWEET_TEXT, USER_NAME } from "./selectors";
import type { PostReadingSettings, ReadablePost } from "./shared/types";

export function extractReadablePost(tweet: HTMLElement, settings: PostReadingSettings): ReadablePost | null {
  const mainTweet = tweet;
  const textElements = Array.from(mainTweet.querySelectorAll<HTMLElement>(TWEET_TEXT));
  const quoteElement = settings.includeQuotes ? findQuoteElement(mainTweet, textElements) : null;
  const authorDisplayName = extractAuthorDisplayName(mainTweet, quoteElement) || "Someone";
  const text = cleanText(extractOwnTweetText(mainTweet, quoteElement, settings.includeHyperlinks, textElements));

  const quote = quoteElement
    ? {
        authorDisplayName: extractAuthorDisplayName(quoteElement, null) || extractFallbackQuoteAuthor(mainTweet, authorDisplayName) || "Someone",
        text: cleanText(extractOwnTweetText(quoteElement, null, settings.includeHyperlinks)),
        url: extractQuoteUrl(quoteElement, mainTweet),
      }
    : null;

  const imageDescriptions = settings.includeImageAltText ? extractImageDescriptions(mainTweet) : [];
  const hasOcrCandidateImages = settings.includeImageOcr && Boolean(mainTweet.querySelector(TWEET_PHOTO));
  const linkPreviews = settings.includeLinkPreviews ? extractLinkPreviews(mainTweet) : [];
  const pollOptions = extractPollOptions(mainTweet);

  if (!text && !quote?.text && imageDescriptions.length === 0 && !hasOcrCandidateImages && linkPreviews.length === 0 && pollOptions.length === 0) {
    return null;
  }

  return {
    authorDisplayName,
    text,
    url: extractMainTweetUrl(mainTweet, quoteElement),
    quote: quote?.text || quote?.url ? quote : null,
    imageDescriptions,
    imageTexts: [],
    linkPreviews,
    pollOptions,
  };
}

export function formatReadablePost(post: ReadablePost, settings: PostReadingSettings): string {
  const segments: string[] = [];

  if (settings.includeQuotes && post.quote) {
    segments.push(sentenceClause(`${post.quote.authorDisplayName} said "${post.quote.text}"`));
  }

  for (const description of post.imageDescriptions) {
    segments.push(`Image description: "${description}"`);
  }

  for (const [index, text] of post.imageTexts.entries()) {
    segments.push(`${imageTextPrefix(index, post.imageTexts.length)} "${text}"`);
  }

  if (settings.includeQuotes && post.quote) {
    const sameAuthor = sameDisplayName(post.authorDisplayName, post.quote.authorDisplayName);
    if (post.text) {
      segments.push(sentenceClause(sameAuthor
        ? `Then "${post.text}"`
        : `${post.authorDisplayName} quoted ${post.quote.authorDisplayName} with "${post.text}"`));
    } else {
      segments.push(sentenceClause(sameAuthor
        ? "Then quoted their own post"
        : `${post.authorDisplayName} quoted ${post.quote.authorDisplayName}`));
    }
  } else if (post.text) {
    segments.push(sentenceClause(`${post.authorDisplayName} said "${post.text}"`));
  }

  for (const preview of post.linkPreviews) {
    segments.push(`Link preview: "${preview}"`);
  }

  if (post.pollOptions.length > 0) {
    segments.push(`Poll options: ${post.pollOptions.map((option) => `"${option}"`).join(", ")}`);
  }

  return segments.join(" ");
}

function sameDisplayName(left: string, right: string): boolean {
  return normalizeDisplayName(left) === normalizeDisplayName(right);
}

function normalizeDisplayName(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

function imageTextPrefix(index: number, count: number): string {
  if (count <= 1) return "The image says";
  return `The ${ordinal(index + 1)} image says`;
}

function ordinal(value: number): string {
  if (value === 1) return "first";
  if (value === 2) return "second";
  if (value === 3) return "third";
  return `${value}th`;
}

function extractMainTweetUrl(mainTweet: HTMLElement, quoteElement: HTMLElement | null): string | null {
  const links = Array.from(mainTweet.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'));
  const ownLink = links.find((link) => !(quoteElement && quoteElement.contains(link)) && getStatusId(link));
  return normalizeStatusUrl(ownLink?.href || window.location.href);
}

function extractQuoteUrl(quoteElement: HTMLElement, mainTweet: HTMLElement): string | null {
  const mainTweetId = extractMainTweetId(mainTweet, quoteElement);
  const href = findQuoteStatusHref(quoteElement, mainTweet);
  if (!href) return null;
  try {
    const url = new URL(href, window.location.origin);
    const quoteTweetId = getStatusId(url);
    if (!quoteTweetId || quoteTweetId === mainTweetId) return null;
    if (url.hostname === "twitter.com") url.hostname = "x.com";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function normalizeStatusUrl(value: string): string | null {
  try {
    const url = new URL(value, window.location.origin);
    if (!getStatusId(url)) return null;
    if (url.hostname === "twitter.com") url.hostname = "x.com";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function findQuoteStatusHref(quoteElement: HTMLElement, mainTweet: HTMLElement): string | null {
  if (quoteElement.matches('a[href*="/status/"]')) return (quoteElement as HTMLAnchorElement).href;
  const mainTweetId = extractMainTweetId(mainTweet, quoteElement);

  const scopedLinks = Array.from(quoteElement.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'));
  const scopedStatusLink = scopedLinks.find((link) => /\/status\/\d+/.test(link.pathname));
  if (scopedStatusLink) return scopedStatusLink.href;

  const closestStatusLink = quoteElement.closest<HTMLAnchorElement>('a[href*="/status/"]');
  if (closestStatusLink && /\/status\/\d+/.test(closestStatusLink.pathname)) return closestStatusLink.href;

  const roleLink = quoteElement.closest<HTMLElement>('div[role="link"], [data-testid="quoteTweet"]');
  const roleStatusLink = roleLink?.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
  if (roleStatusLink && /\/status\/\d+/.test(roleStatusLink.pathname)) return roleStatusLink.href;

  const dataHref = quoteElement.closest<HTMLElement>("[data-href]")?.getAttribute("data-href")
    || roleLink?.getAttribute("data-href");
  if (dataHref && /\/status\/\d+/.test(dataHref)) return dataHref;

  const attributeStatusHref = findStatusHrefInAttributes(quoteElement)
    || (roleLink ? findStatusHrefInAttributes(roleLink) : null);
  if (attributeStatusHref) return attributeStatusHref;

  const textStatusHref = findStatusHrefInText(quoteElement.textContent || "")
    || (roleLink ? findStatusHrefInText(roleLink.textContent || "") : null);
  if (textStatusHref) return textStatusHref;

  const quoteHandle = extractQuoteHandle(quoteElement, roleLink);
  const handleStatusLink = quoteHandle ? findQuoteStatusLinkByHandle(mainTweet, quoteHandle, mainTweetId) : null;
  if (handleStatusLink) return handleStatusLink.href;

  const nonMainStatusLinks = uniqueStatusLinks(Array.from(mainTweet.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')))
    .filter((link) => getStatusId(link) !== mainTweetId && !link.closest(USER_NAME));
  if (nonMainStatusLinks.length === 1) return nonMainStatusLinks[0].href;

  return findQuoteStatusLink(mainTweet, quoteElement, mainTweetId)?.href || null;
}

function extractQuoteHandle(quoteElement: HTMLElement, roleLink: HTMLElement | null): string | null {
  const roots = [quoteElement, roleLink].filter((element): element is HTMLElement => Boolean(element));
  for (const root of roots) {
    const profileLink = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="/"], a[href^="https://x.com/"], a[href^="https://twitter.com/"]'))
      .find((link) => {
        const pathname = new URL(link.href, window.location.origin).pathname;
        return /^\/[^/]+\/?$/.test(pathname) && !pathname.includes("/status/");
      });
    const linkHandle = profileLink ? new URL(profileLink.href, window.location.origin).pathname.match(/^\/([^/]+)\/?$/)?.[1] : null;
    if (linkHandle && !isReservedXPath(linkHandle)) return linkHandle.toLowerCase();
    const textHandle = (root.textContent || "").match(/@([A-Za-z0-9_]{1,15})/i)?.[1];
    if (textHandle) return textHandle.toLowerCase();
  }
  return null;
}

function findQuoteStatusLinkByHandle(mainTweet: HTMLElement, handle: string, mainTweetId: string | null): HTMLAnchorElement | null {
  return uniqueStatusLinks(Array.from(mainTweet.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')))
    .find((link) => {
      const url = new URL(link.href, window.location.origin);
      const parts = url.pathname.split("/").filter(Boolean);
      return parts[0]?.toLowerCase() === handle
        && getStatusId(url) !== mainTweetId
        && !link.closest(USER_NAME);
    }) || null;
}

function findStatusHrefInAttributes(root: HTMLElement): string | null {
  const attributes = ["href", "data-href", "data-url", "data-expanded-url", "aria-label", "title"];
  const elements = [root, ...Array.from(root.querySelectorAll<HTMLElement>("a[href], [data-href], [data-url], [data-expanded-url], [aria-label], [title]"))];
  for (const element of elements) {
    for (const attribute of attributes) {
      const value = element.getAttribute(attribute);
      const href = value ? findStatusHrefInText(value) : null;
      if (href) return href;
    }
  }
  return null;
}

function findStatusHrefInText(value: string): string | null {
  const absolute = value.match(/https?:\/\/(?:x|twitter)\.com\/[^/\s"'<>]+\/status\/\d+/i)?.[0];
  if (absolute) return absolute;
  const relative = value.match(/\/[^/\s"'<>]+\/status\/\d+/)?.[0];
  if (relative) return relative;
  return null;
}

function extractMainTweetId(mainTweet: HTMLElement, quoteElement: HTMLElement): string | null {
  const routeId = window.location.pathname.match(/\/status\/(\d+)/)?.[1];
  if (routeId) return routeId;
  const links = Array.from(mainTweet.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'));
  const ownLink = links.find((link) => !quoteElement.contains(link) && getStatusId(link));
  return ownLink ? getStatusId(ownLink) : null;
}

function getStatusId(value: URL | HTMLAnchorElement): string | null {
  return value.pathname.match(/\/status\/(\d+)/)?.[1] || null;
}

function findQuoteStatusLink(mainTweet: HTMLElement, quoteElement: HTMLElement, mainTweetId: string | null): HTMLAnchorElement | null {
  const links = uniqueStatusLinks(Array.from(mainTweet.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')));
  const overlapping = links.find((link) => {
    if (getStatusId(link) === mainTweetId || link.closest(USER_NAME)) return false;
    if (link.contains(quoteElement) || quoteElement.contains(link)) return true;
    const rect = link.getBoundingClientRect();
    const quoteRect = quoteElement.getBoundingClientRect();
    return rect.width > 0
      && rect.height > 0
      && quoteRect.width > 0
      && quoteRect.height > 0
      && rect.top >= quoteRect.top - 36
      && rect.bottom <= quoteRect.bottom + 36;
  });
  if (overlapping) return overlapping;

  return null;
}

function uniqueStatusLinks(links: HTMLAnchorElement[]): HTMLAnchorElement[] {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (!/\/status\/\d+/.test(link.pathname)) return false;
    const key = normalizeStatusLinkKey(link);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeStatusLinkKey(link: HTMLAnchorElement): string {
  return `${link.hostname}${link.pathname}`;
}

function isReservedXPath(value: string): boolean {
  return /^(home|explore|notifications|messages|i|settings|compose|search|hashtag)$/i.test(value);
}

function sentenceClause(value: string): string {
  return /[.!?]["']?$/.test(value) ? value : `${value}.`;
}

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s+([.,!?;:])/g, "$1").trim();
}

function findQuoteElement(mainTweet: HTMLElement, textElements: HTMLElement[]): HTMLElement | null {
  const explicitQuote = mainTweet.querySelector<HTMLElement>(QUOTE_TWEET);
  if (explicitQuote) return explicitQuote;

  const fallbackQuoteText = textElements.find((node, index) => {
    if (index === 0) return false;
    const nestedArticle = node.closest("article");
    return !nestedArticle || nestedArticle === mainTweet;
  });
  if (!fallbackQuoteText) return findUnavailableQuoteCard(mainTweet);

  const linkCard = fallbackQuoteText.closest<HTMLElement>('a[href*="/status/"], div[role="link"]');
  return linkCard || fallbackQuoteText;
}

function findUnavailableQuoteCard(mainTweet: HTMLElement): HTMLElement | null {
  const currentId = extractMainTweetIdFromLinks(mainTweet);
  const cards = Array.from(mainTweet.querySelectorAll<HTMLElement>('a[href*="/status/"], div[role="link"]'));
  return cards.find((card) => {
    if (card.closest(USER_NAME)) return false;
    const link = card.matches('a[href*="/status/"]')
      ? card as HTMLAnchorElement
      : card.querySelector<HTMLAnchorElement>('a[href*="/status/"]');
    const id = link ? getStatusId(link) : null;
    if (!id || id === currentId) return false;
    return /post is unavailable|x\.com\/[^/]+\/stat/i.test(card.textContent || "");
  }) || null;
}

function extractMainTweetIdFromLinks(mainTweet: HTMLElement): string | null {
  const statusLinks = uniqueStatusLinks(Array.from(mainTweet.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]')));
  return statusLinks[0] ? getStatusId(statusLinks[0]) : null;
}

function extractOwnTweetText(
  container: HTMLElement,
  quoteElement: HTMLElement | null,
  includeHyperlinks: boolean,
  scopedTextElements?: HTMLElement[],
): string {
  const texts: string[] = [];
  const textElements = scopedTextElements
    || (container.matches(TWEET_TEXT) ? [container] : Array.from(container.querySelectorAll<HTMLElement>(TWEET_TEXT)));
  for (const [index, node] of textElements.entries()) {
    if (quoteElement && quoteElement.contains(node)) continue;
    if (quoteElement && node === quoteElement) continue;
    if (quoteElement && container.contains(quoteElement) && index > 0 && !quoteElement.contains(node)) continue;
    const nestedQuote = node.closest(QUOTE_TWEET);
    if (nestedQuote && nestedQuote !== container) continue;
    const text = extractTweetTextNodeText(node, includeHyperlinks);
    if (text.trim()) texts.push(text);
  }
  return texts.join(" ");
}

function extractTweetTextNodeText(node: HTMLElement, includeHyperlinks: boolean): string {
  if (includeHyperlinks) return node.innerText || node.textContent || "";
  const clone = node.cloneNode(true) as HTMLElement;
  for (const link of Array.from(clone.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    if (isReadableHyperlink(link)) link.remove();
  }
  return clone.innerText || clone.textContent || "";
}

export function isReadableHyperlink(link: HTMLAnchorElement): boolean {
  const text = cleanText(link.innerText || link.textContent || "");
  const href = link.getAttribute("href") || "";
  if (/^(https?:\/\/|www\.|t\.co\/)/i.test(text)) return true;
  if (/^x\.com\/[^/]+\/stat/i.test(text)) return true;
  if (/^https?:\/\/t\.co\//i.test(href)) return true;
  if (/^https?:\/\/x\.com\/[^/]+\/status\//i.test(href)) return true;
  return Boolean(link.querySelector('[data-testid="card.wrapper"]'));
}

function extractAuthorDisplayName(container: HTMLElement, quoteElement: HTMLElement | null): string | null {
  const userNames = container.matches(USER_NAME)
    ? [container]
    : Array.from(container.querySelectorAll<HTMLElement>(USER_NAME));
  const userName = userNames.find((element) => !(quoteElement && quoteElement.contains(element)));
  if (!userName) return null;

  return extractDisplayNameFromUserName(userName);
}

function extractDisplayNameFromUserName(userName: HTMLElement): string | null {
  const spans = Array.from(userName.querySelectorAll("span"));
  for (const span of spans) {
    const text = cleanText(span.textContent || "");
    if (!text || text === "·" || text.startsWith("@")) continue;
    if (/^\d+[smhd]$/.test(text)) continue;
    return text;
  }

  return cleanText(userName.textContent || "") || null;
}

function extractFallbackQuoteAuthor(container: HTMLElement, mainAuthorDisplayName: string): string | null {
  const userNames = Array.from(container.querySelectorAll<HTMLElement>(USER_NAME));
  for (const userName of userNames.slice(1)) {
    const author = extractDisplayNameFromUserName(userName);
    if (author && author !== mainAuthorDisplayName) return author;
  }
  return null;
}

function extractImageDescriptions(container: HTMLElement): string[] {
  const values = new Set<string>();
  const media = Array.from(container.querySelectorAll<HTMLElement>(TWEET_PHOTO));
  for (const element of media) {
    for (const image of Array.from(element.querySelectorAll<HTMLImageElement>("img[alt]"))) {
      const alt = cleanText(image.alt);
      if (alt && !looksDecorativeAlt(alt)) values.add(alt);
    }
    const aria = cleanText(element.getAttribute("aria-label") || "");
    if (aria && !looksDecorativeAlt(aria)) values.add(aria);
  }
  return Array.from(values);
}

function extractLinkPreviews(container: HTMLElement): string[] {
  const previews = new Set<string>();
  for (const card of Array.from(container.querySelectorAll<HTMLElement>(CARD_WRAPPER))) {
    const text = cleanText(card.innerText || card.textContent || "");
    if (text && text.length > 3) previews.add(text);
  }
  return Array.from(previews);
}

function extractPollOptions(container: HTMLElement): string[] {
  const options = new Set<string>();
  for (const element of Array.from(container.querySelectorAll<HTMLElement>('[role="radio"], [role="progressbar"]'))) {
    const text = cleanText(element.innerText || element.textContent || element.getAttribute("aria-label") || "");
    if (text && text.length > 1) options.add(text);
  }
  return Array.from(options);
}

function looksDecorativeAlt(value: string): boolean {
  return /^(image|photo|avatar|profile picture)$/i.test(value);
}
