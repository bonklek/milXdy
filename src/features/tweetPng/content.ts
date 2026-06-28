import {
  DEFAULT_RESKIN_PROFILE,
  DEFAULT_VISUAL_THEME,
  RESKIN_PROFILE_KEY,
  VISUAL_THEME_KEY,
  normalizeReskinProfile,
  normalizeVisualTheme,
  type VisualThemeSettings,
} from "../../shared/reskinProfile";

let visualTheme: VisualThemeSettings = DEFAULT_VISUAL_THEME;

export async function copyTweetPngFromTweet(tweet: HTMLElement, statusUrl: string | null): Promise<void> {
  await loadVisualTheme();
  await expandTweetPngText(tweet);
  const data = extractTweetPngData(tweet, statusUrl);
  if (!data.text && !data.images.length && !data.quote) return;
  const blob = await renderTweetPng(data);
  await copyTweetPng(blob);
}

async function loadVisualTheme(): Promise<void> {
  const stored = await chrome.storage.local.get({
    [RESKIN_PROFILE_KEY]: DEFAULT_RESKIN_PROFILE,
    [VISUAL_THEME_KEY]: DEFAULT_VISUAL_THEME,
  }).catch(() => ({})) as Record<string, unknown>;
  const profile = normalizeReskinProfile(stored[RESKIN_PROFILE_KEY]);
  visualTheme = normalizeVisualTheme(stored[VISUAL_THEME_KEY], profile);
}

function findDisplayNameLink(userName: HTMLElement): HTMLElement | null {
  const links = Array.from(userName.querySelectorAll<HTMLElement>('a[role="link"], a[href^="/"]'));
  return links.find((link) => {
    if (link.querySelector("time")) return false;
    const text = (link.textContent || "").trim();
    return Boolean(text) && !text.startsWith("@");
  }) || null;
}

function textWithImageAlts(element: HTMLElement | null | undefined): string {
  if (!element) return "";
  const clone = element.cloneNode(true) as HTMLElement;
  for (const image of Array.from(clone.querySelectorAll<HTMLImageElement>("img[alt]"))) {
    const alt = image.getAttribute("alt") || "";
    image.replaceWith(document.createTextNode(alt));
  }
  return (clone.innerText || clone.textContent || "").trim();
}

function findMetadataRow(userName: HTMLElement, displayRow: HTMLElement | null): HTMLElement | null {
  const time = userName.querySelector("time");
  const handle = Array.from(userName.querySelectorAll<HTMLElement>("span")).find((span) => {
    return (span.textContent || "").trim().startsWith("@");
  });
  const candidates = [time, handle].flatMap((element): HTMLElement[] => {
    const rows: HTMLElement[] = [];
    let current = element?.parentElement;
    while (current && current !== userName) {
      if (current.tagName === "DIV") rows.push(current);
      current = current.parentElement;
    }
    return rows;
  });
  return candidates.find((row) => row !== displayRow && !row.contains(displayRow)) || (displayRow?.parentElement ?? null);
}

function findStatusUrl(tweet: HTMLElement): string | null {
  const link = Array.from(tweet.querySelectorAll<HTMLAnchorElement>('a[href*="/status/"]'))
    .find((anchor) => !anchor.closest('[data-testid="quoteTweet"]'));
  return link?.href || null;
}

async function openTweetPngReview(tweet: HTMLElement, statusUrl: string | null): Promise<void> {
  await loadVisualTheme();
  await expandTweetPngText(tweet);
  const data = extractTweetPngData(tweet, statusUrl);
  if (!data.text && !data.images.length && !data.quote) return;
  const blob = await renderTweetPng(data);
  showTweetPngModal(blob, data);
}

async function expandTweetPngText(tweet: HTMLElement): Promise<void> {
  const buttons = Array.from(tweet.querySelectorAll<HTMLElement>('button, [role="button"]'));
  const showMore = buttons.find((button) => {
    if (button.closest('[data-testid="quoteTweet"]')) return false;
    const text = (button.innerText || button.textContent || "").trim().toLowerCase();
    const label = (button.getAttribute("aria-label") || "").trim().toLowerCase();
    return text === "show more" || label === "show more";
  });
  if (!showMore) return;
  showMore.click();
  await new Promise((resolve) => window.setTimeout(resolve, 250));
}

type TweetPngData = {
  author: string;
  handle: string;
  text: string;
  statusUrl: string;
  date: string;
  avatarUrl: string;
  images: string[];
  quote: TweetPngQuoteData | null;
  stats: TweetPngStats | null;
};

type TweetPngQuoteData = {
  author: string;
  handle: string;
  text: string;
  images: string[];
};

type ExtractedTweetPngQuoteData = TweetPngQuoteData & {
  element: HTMLElement;
};

type TweetPngStats = {
  score: string;
  beetles: string;
};

type TweetPngPalette = {
  border: string;
  mediaBorder: string;
  quoteBorder: string;
  quoteFill: string;
  mediaFill: string;
};

type TweetPngRenderAssets = {
  lotus: HTMLImageElement | null;
};

const TWEET_PNG_FONT_FALLBACK = 'TwitterChirp, Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';

function extractTweetPngData(tweet: HTMLElement, statusUrl: string | null): TweetPngData {
  const settings = visualTheme;
  const userName = Array.from(tweet.querySelectorAll<HTMLElement>('[data-testid="User-Name"]'))
    .find((node) => !node.closest('[data-testid="quoteTweet"]')) || null;
  const author = textWithImageAlts(findDisplayNameLink(userName || tweet)) || "X post";
  const handleText = Array.from(userName?.querySelectorAll<HTMLElement>("span") || [])
    .map((span) => span.textContent?.trim() || "")
    .find((text) => text.startsWith("@")) || "";
  const quote = extractTweetPngQuoteData(tweet, statusUrl);
  const text = Array.from(tweet.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
    .filter((node) => !node.closest('[data-testid="quoteTweet"]') && !quote?.element.contains(node))
    .map((node) => textWithImageAlts(node))
    .join("\n")
    .trim();
  const avatar = tweet.querySelector<HTMLImageElement>('img[src*="profile_images"]');
  const images = settings.tweetPngIncludeImages
    ? Array.from(tweet.querySelectorAll<HTMLImageElement>('[data-testid="tweetPhoto"] img'))
      .filter((image) => !image.closest('[data-testid="quoteTweet"]') && !quote?.element.contains(image))
      .map((image) => image.currentSrc || image.src)
      .filter(Boolean)
      .slice(0, 4)
    : [];
  const stats = settings.tweetPngIncludeStats ? extractTweetPngStats(tweet) : null;
  return {
    author,
    handle: handleText,
    text,
    statusUrl: statusUrl || "",
    date: settings.tweetPngIncludeDate ? extractTweetPngDate(tweet) : "",
    avatarUrl: avatar?.currentSrc || avatar?.src || "",
    images,
    quote: quote ? { author: quote.author, handle: quote.handle, text: quote.text, images: quote.images } : null,
    stats,
  };
}

function extractTweetPngDate(tweet: HTMLElement): string {
  const time = Array.from(tweet.querySelectorAll<HTMLTimeElement>("time"))
    .find((node) => !node.closest('[data-testid="quoteTweet"]'));
  const label = time?.getAttribute("aria-label")?.trim();
  if (label) return label;
  const dateTime = time?.dateTime;
  if (!dateTime) return "";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return dateTime;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function extractTweetPngStats(tweet: HTMLElement): TweetPngStats | null {
  const badge = Array.from(tweet.querySelectorAll<HTMLElement>('[data-reminet-badge="true"]'))
    .find((node) => !node.closest('[data-testid="quoteTweet"]'));
  if (!badge) return null;
  const score = badge.querySelector<HTMLElement>('[data-reminet-icon="score"] .reminet-label')?.textContent?.trim() || "";
  const beetles = badge.querySelector<HTMLElement>('[data-reminet-icon="beetle"] .reminet-label')?.textContent?.trim() || "";
  if (!score && !beetles) return null;
  return { score, beetles };
}

function extractTweetPngQuoteData(tweet: HTMLElement, statusUrl: string | null): ExtractedTweetPngQuoteData | null {
  const settings = visualTheme;
  const quote = findTweetPngQuoteElement(tweet, statusUrl);
  if (!quote) return null;
  const userName = quote.querySelector<HTMLElement>('[data-testid="User-Name"]');
  const handle = Array.from(userName?.querySelectorAll<HTMLElement>("span") || [])
    .map((span) => span.textContent?.trim() || "")
    .find((text) => text.startsWith("@")) || "";
  const author = extractTweetPngQuoteAuthor(userName, quote, handle);
  const text = settings.tweetPngIncludeQuoteText
    ? extractTweetPngTextFromQuoteElement(quote)
    : "";
  const images = settings.tweetPngIncludeQuoteImages
    ? Array.from(quote.querySelectorAll<HTMLImageElement>('[data-testid="tweetPhoto"] img'))
      .map((image) => image.currentSrc || image.src)
      .filter(Boolean)
      .slice(0, 4)
    : [];
  if (!text && !images.length) return null;
  return { author, handle, text, images, element: quote };
}

function extractTweetPngQuoteAuthor(userName: HTMLElement | null, quote: HTMLElement, handle: string): string {
  const displayName = textWithImageAlts(findDisplayNameLink(userName || quote));
  if (displayName) return displayName;
  const fallback = Array.from(userName?.querySelectorAll<HTMLElement>("span") || [])
    .map((span) => textWithImageAlts(span))
    .find((text) => text && !text.startsWith("@") && text !== handle);
  if (fallback) return fallback;
  return handle.replace(/^@/, "") || "X post";
}

function extractTweetPngTextFromQuoteElement(quote: HTMLElement): string {
  const explicit = Array.from(quote.querySelectorAll<HTMLElement>('[data-testid="tweetText"]'))
    .map((node) => extractTweetPngQuoteTextNodeText(node))
    .join("\n")
    .trim();
  if (explicit) return explicit;
  return Array.from(quote.querySelectorAll<HTMLElement>('[dir="auto"], [lang]'))
    .filter((node) => !node.closest('[data-testid="User-Name"]') && !node.querySelector("time"))
    .map((node) => textWithImageAlts(node))
    .map((value) => value.trim())
    .filter((value) => value && !value.startsWith("@"))
    .filter((value) => !isImpliedQuoteHyperlinkText(value))
    .slice(0, 4)
    .join("\n")
    .trim();
}

function extractTweetPngQuoteTextNodeText(node: HTMLElement): string {
  const clone = node.cloneNode(true) as HTMLElement;
  for (const link of Array.from(clone.querySelectorAll<HTMLAnchorElement>("a[href]"))) {
    if (isImpliedQuoteHyperlink(link)) link.remove();
  }
  return textWithImageAlts(clone);
}

function isImpliedQuoteHyperlink(link: HTMLAnchorElement): boolean {
  const text = normalizeTweetPngInlineText(link.innerText || link.textContent || "");
  const href = link.getAttribute("href") || "";
  if (isImpliedQuoteHyperlinkText(text)) return true;
  if (/^https?:\/\/t\.co\//i.test(href)) return true;
  if (/^\/[^/]+\/status\/\d+/i.test(href)) return true;
  if (/^https?:\/\/(?:x|twitter)\.com\/[^/]+\/status\/\d+/i.test(href)) return true;
  return false;
}

function isImpliedQuoteHyperlinkText(value: string): boolean {
  const text = normalizeTweetPngInlineText(value);
  return /^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/[^/]+\/status\/\d+/i.test(text)
    || /^(?:https?:\/\/)?t\.co\/[a-z0-9]+$/i.test(text)
    || /^…?\s*(?:show this thread|show more)$/i.test(text);
}

function normalizeTweetPngInlineText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function findTweetPngQuoteElement(tweet: HTMLElement, statusUrl: string | null): HTMLElement | null {
  const explicit = tweet.querySelector<HTMLElement>('[data-testid="quoteTweet"]');
  if (explicit) return explicit;
  const normalizedStatus = normalizeTweetStatusHref(statusUrl || "");
  const candidates = Array.from(tweet.querySelectorAll<HTMLElement>('a[href*="/status/"], div[role="link"]'));
  return candidates.find((candidate) => {
    const href = candidate instanceof HTMLAnchorElement ? normalizeTweetStatusHref(candidate.href) : "";
    if (href && normalizedStatus && href === normalizedStatus) return false;
    if (candidate.closest('article[data-testid="tweet"]') !== tweet) return false;
    return Boolean(candidate.querySelector('[data-testid="tweetText"], [data-testid="tweetPhoto"] img'));
  }) || null;
}

function normalizeTweetStatusHref(value: string): string {
  const match = value.match(/\/([^/?#]+)\/status\/(\d+)/);
  return match ? `/${match[1]}/status/${match[2]}` : value;
}

async function renderTweetPng(data: TweetPngData): Promise<Blob> {
  const scale = 2;
  const width = 1200;
  const maxHeight = Math.round(width * 5 / 3);
  const padding = 56;
  const footerHeight = data.date ? 42 : 0;
  const avatarSize = 96;
  const bodyX = padding + avatarSize + 24;
  const bodyWidth = width - bodyX - padding;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const palette = tweetPngPalette(visualTheme.tweetPngBorderPalette);

  context.font = `34px ${TWEET_PNG_FONT_FALLBACK}`;
  const textLines = wrapCanvasText(context, data.text || data.date || data.handle, bodyWidth, 16);
  context.font = `26px ${TWEET_PNG_FONT_FALLBACK}`;
  const quoteTextLines = data.quote?.text ? wrapCanvasText(context, data.quote.text, bodyWidth - 48, 8) : [];
  const mediaImages = await Promise.all(data.images.map(loadImageForCanvas));
  const quoteImages = data.quote ? await Promise.all(data.quote.images.map(loadImageForCanvas)) : [];
  const assets = await loadTweetPngRenderAssets();
  const avatarImage = data.avatarUrl ? await loadImageForCanvas(data.avatarUrl).catch(() => null) : null;
  const mediaHeight = measureTweetPngMediaHeight(mediaImages, bodyWidth, 520);
  const quoteMediaHeight = measureTweetPngMediaHeight(quoteImages, bodyWidth - 48, 300);
  const textHeight = textLines.length * 44;
  const quoteHeight = data.quote
    ? 30 + (quoteTextLines.length ? quoteTextLines.length * 34 + 14 : 0) + (quoteMediaHeight ? quoteMediaHeight + 14 : 0) + 34
    : 0;
  const uncappedHeight = padding * 2 + Math.max(
    avatarSize,
    86 + textHeight + (mediaHeight ? mediaHeight + 28 : 0) + (quoteHeight ? quoteHeight + 22 : 0) + footerHeight + 36,
  );
  const height = Math.min(maxHeight, Math.max(360, uncappedHeight));

  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);
  context.fillStyle = "#f6e9ff";
  context.fillRect(0, 0, width, height);
  drawDottedBackground(context, width, height);
  roundRect(context, 28, 28, width - 56, height - 56, 28);
  context.fillStyle = "#fffaff";
  context.fill();
  if (visualTheme.tweetPngBorder) {
    context.strokeStyle = palette.border;
    context.lineWidth = 2;
    context.stroke();
  }

  if (avatarImage) {
    context.save();
    context.beginPath();
    context.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    context.clip();
    context.drawImage(avatarImage, padding, padding, avatarSize, avatarSize);
    context.restore();
  } else {
    context.fillStyle = "#d9c3ff";
    context.beginPath();
    context.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    context.fill();
  }

  context.fillStyle = "#261447";
  context.font = `700 34px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText(data.author, bodyX, padding + 36);
  context.fillStyle = "#6d5a7f";
  context.font = `26px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText(data.handle || "x.com", bodyX, padding + 72);
  drawTweetPngHeaderStats(context, data.stats, assets, bodyX, padding + 34, bodyWidth);

  context.fillStyle = "#1b1324";
  context.font = `34px ${TWEET_PNG_FONT_FALLBACK}`;
  let y = padding + 126;
  const footerY = height - padding - (data.date ? 8 : 0);
  const maxContentY = data.date ? footerY - footerHeight : height - padding;
  for (const line of textLines) {
    if (y > maxContentY - 34) break;
    context.fillText(line, bodyX, y);
    y += 44;
  }

  if (mediaImages.some(Boolean)) {
    y += 10;
    const reservedQuoteHeight = quoteHeight ? quoteHeight + 22 : 0;
    const boundedMediaHeight = Math.min(mediaHeight, Math.max(0, maxContentY - y - reservedQuoteHeight - 28));
    if (boundedMediaHeight >= 80) {
      drawTweetPngMediaGrid(context, mediaImages, bodyX, y, bodyWidth, boundedMediaHeight, palette);
      y += boundedMediaHeight + 28;
    }
  }

  if (data.quote) {
    y = drawTweetPngQuote(context, {
      quote: data.quote,
      images: quoteImages,
      textLines: quoteTextLines,
      x: bodyX,
      y,
      width: bodyWidth,
      mediaHeight: quoteMediaHeight,
      maxY: maxContentY,
      palette,
    });
  }

  if (data.date) {
    context.fillStyle = "#7d5aaa";
    context.font = `22px ${TWEET_PNG_FONT_FALLBACK}`;
    context.fillText(data.date, bodyX, footerY);
  }

  return await canvasToPngBlob(canvas);
}

async function loadTweetPngRenderAssets(): Promise<TweetPngRenderAssets> {
  const lotusUrl = typeof chrome !== "undefined" && chrome.runtime?.getURL
    ? chrome.runtime.getURL("remistats/star.svg")
    : "";
  return {
    lotus: lotusUrl ? await loadImageForCanvas(lotusUrl) : null,
  };
}

function drawTweetPngHeaderStats(
  context: CanvasRenderingContext2D,
  stats: TweetPngStats | null,
  assets: TweetPngRenderAssets,
  x: number,
  y: number,
  width: number,
): void {
  if (!stats?.score && !stats?.beetles) return;
  const gap = 12;
  const groups: Array<{ icon: "lotus" | "beetle"; value: string; width: number }> = [];
  context.font = `700 24px ${TWEET_PNG_FONT_FALLBACK}`;
  if (stats.score) groups.push({ icon: "lotus", value: stats.score, width: 28 + 8 + context.measureText(stats.score).width });
  if (stats.beetles) groups.push({ icon: "beetle", value: stats.beetles, width: 28 + 8 + context.measureText(stats.beetles).width });
  const totalWidth = groups.reduce((sum, group) => sum + group.width, 0) + Math.max(0, groups.length - 1) * gap;
  let cursor = x + width - totalWidth;
  for (const group of groups) {
    if (group.icon === "lotus" && assets.lotus) {
      context.drawImage(assets.lotus, cursor, y - 24, 26, 26);
    } else {
      context.font = `24px ${TWEET_PNG_FONT_FALLBACK}`;
      context.fillText(group.icon === "beetle" ? "\u{1FAB2}" : "\u2726", cursor, y - 1);
    }
    context.fillStyle = "#261447";
    context.font = `700 24px ${TWEET_PNG_FONT_FALLBACK}`;
    context.fillText(group.value, cursor + 34, y);
    cursor += group.width + gap;
  }
}

function tweetPngPalette(value: VisualThemeSettings["tweetPngBorderPalette"]): TweetPngPalette {
  switch (value) {
    case "gray":
      return { border: "#cfd6df", mediaBorder: "#d8dee7", quoteBorder: "#d8dee7", quoteFill: "#fbfcfd", mediaFill: "#f4f6f8" };
    case "blue":
      return { border: "#78aee8", mediaBorder: "#a8cef5", quoteBorder: "#a8cef5", quoteFill: "#f5faff", mediaFill: "#edf6ff" };
    case "green":
      return { border: "#82b98a", mediaBorder: "#add8b1", quoteBorder: "#add8b1", quoteFill: "#f6fff7", mediaFill: "#eff9f0" };
    case "purple":
    default:
      return { border: "#b67cff", mediaBorder: "#c9a5ff", quoteBorder: "#d5b7ff", quoteFill: "#fbf6ff", mediaFill: "#f4eaff" };
  }
}

function wrapCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number): string[] {
  const paragraphs = text.replace(/\r\n?/g, "\n").split("\n");
  const lines: string[] = [];
  let truncated = false;

  for (const paragraph of paragraphs) {
    if (lines.length >= maxLines) {
      truncated = true;
      break;
    }
    const words = paragraph.replace(/[^\S\n]+/g, " ").trim().split(" ").filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }

    let line = "";
    for (const word of words) {
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width <= maxWidth) {
        line = next;
        continue;
      }
      if (line) {
        lines.push(line);
        line = "";
      }
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
      if (context.measureText(word).width <= maxWidth) {
        line = word;
        continue;
      }
      const segments = splitCanvasTextByWidth(context, word, maxWidth);
      for (const segment of segments) {
        if (lines.length >= maxLines) {
          truncated = true;
          break;
        }
        lines.push(segment);
      }
    }
    if (line && lines.length < maxLines) lines.push(line);
  }

  while (lines.length > 1 && lines[lines.length - 1] === "") lines.pop();
  if (truncated && lines.length) {
    lines[lines.length - 1] = ellipsizeCanvasText(context, lines[lines.length - 1], maxWidth);
  }
  return lines.length ? lines : [""];
}

function splitCanvasTextByWidth(context: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const segment of canvasTextSegments(text)) {
    const next = line + segment;
    if (!line || context.measureText(next).width <= maxWidth) {
      line = next;
      continue;
    }
    lines.push(line);
    line = segment;
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsizeCanvasText(context: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const ellipsis = "...";
  const segments = canvasTextSegments(text.trim());
  while (segments.length > 0 && context.measureText(`${segments.join("")}${ellipsis}`).width > maxWidth) {
    segments.pop();
  }
  return `${segments.join("").trim()}${ellipsis}`;
}

function canvasTextSegments(text: string): string[] {
  const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;
  return segmenter
    ? Array.from(segmenter.segment(text), (part) => part.segment)
    : Array.from(text);
}

function drawTweetPngQuote(
  context: CanvasRenderingContext2D,
  options: {
    quote: TweetPngQuoteData;
    images: Array<HTMLImageElement | null>;
    textLines: string[];
    x: number;
    y: number;
    width: number;
    mediaHeight: number;
    maxY: number;
    palette: TweetPngPalette;
  },
): number {
  const padding = 24;
  const lineHeight = 34;
  const cardHeight = Math.min(
    options.maxY - options.y,
    30 + (options.textLines.length ? options.textLines.length * lineHeight + 14 : 0) + (options.mediaHeight ? options.mediaHeight + 14 : 0) + 34,
  );
  if (cardHeight < 88) return options.y;
  roundRect(context, options.x, options.y, options.width, cardHeight, 22);
  context.fillStyle = options.palette.quoteFill;
  context.fill();
  if (visualTheme.tweetPngBorder) {
    context.strokeStyle = options.palette.quoteBorder;
    context.lineWidth = 2;
    context.stroke();
  }

  let y = options.y + padding + 6;
  context.fillStyle = "#261447";
  context.font = `700 24px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText(options.quote.author, options.x + padding, y);
  if (options.quote.handle) {
    context.fillStyle = "#6d5a7f";
    context.font = `22px ${TWEET_PNG_FONT_FALLBACK}`;
    context.fillText(options.quote.handle, options.x + padding + Math.min(360, context.measureText(options.quote.author).width + 14), y);
  }

  y += 38;
  context.fillStyle = "#21182a";
  context.font = `26px ${TWEET_PNG_FONT_FALLBACK}`;
  for (const line of options.textLines) {
    if (y + lineHeight > options.y + cardHeight - padding) break;
    context.fillText(line, options.x + padding, y);
    y += lineHeight;
  }

  if (options.images.some(Boolean) && y + 76 < options.y + cardHeight) {
    y += 8;
    drawTweetPngMediaGrid(
      context,
      options.images,
      options.x + padding,
      y,
      options.width - padding * 2,
      Math.min(options.mediaHeight, options.y + cardHeight - y - padding),
      options.palette,
    );
  }
  return options.y + cardHeight + 22;
}

function measureTweetPngMediaHeight(images: Array<HTMLImageElement | null>, width: number, maxHeight: number): number {
  const visible = images.filter((image): image is HTMLImageElement => Boolean(image));
  if (!visible.length) return 0;
  if (visible.length > 1) return Math.min(maxHeight, 420);
  const image = visible[0];
  const ratio = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 16 / 9;
  if (ratio >= 1) return Math.min(maxHeight, Math.max(260, width / ratio));
  return Math.min(maxHeight, Math.max(240, width * 0.62 / ratio));
}

function drawTweetPngMediaGrid(
  context: CanvasRenderingContext2D,
  images: Array<HTMLImageElement | null>,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: TweetPngPalette,
): void {
  const visible = images.filter((image): image is HTMLImageElement => Boolean(image));
  const gap = 10;
  if (visible.length === 1) {
    drawTweetPngSingleMedia(context, visible[0], x, y, width, height, palette);
    return;
  }
  const cells = visible.length === 1
    ? [{ x, y, width, height }]
    : visible.length === 2
      ? [{ x, y, width: (width - gap) / 2, height }, { x: x + (width + gap) / 2, y, width: (width - gap) / 2, height }]
      : [
        { x, y, width: (width - gap) / 2, height: (height - gap) / 2 },
        { x: x + (width + gap) / 2, y, width: (width - gap) / 2, height: (height - gap) / 2 },
        { x, y: y + (height + gap) / 2, width: (width - gap) / 2, height: (height - gap) / 2 },
        { x: x + (width + gap) / 2, y: y + (height + gap) / 2, width: (width - gap) / 2, height: (height - gap) / 2 },
      ];
  visible.slice(0, cells.length).forEach((image, index) => {
    const cell = cells[index];
    roundRect(context, cell.x, cell.y, cell.width, cell.height, 22);
    context.save();
    context.clip();
    drawImageCover(context, image, cell.x, cell.y, cell.width, cell.height);
    context.restore();
    if (visualTheme.tweetPngBorder) {
      context.strokeStyle = palette.mediaBorder;
      context.lineWidth = 2;
      context.stroke();
    }
  });
}

function drawTweetPngSingleMedia(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  palette: TweetPngPalette,
): void {
  const imageRatio = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 16 / 9;
  const tallImage = visualTheme.tweetPngShrinkTallImages && imageRatio < 0.85;
  const drawHeight = height;
  const drawWidth = tallImage ? Math.min(width * 0.62, drawHeight * imageRatio) : Math.min(width, drawHeight * imageRatio);
  const drawX = x + (width - drawWidth) / 2;
  roundRect(context, drawX, y, drawWidth, drawHeight, 22);
  context.save();
  context.clip();
  context.fillStyle = palette.mediaFill;
  context.fillRect(drawX, y, drawWidth, drawHeight);
  drawImageContain(context, image, drawX, y, drawWidth, drawHeight);
  context.restore();
  if (visualTheme.tweetPngBorder) {
    context.strokeStyle = palette.mediaBorder;
    context.lineWidth = 2;
    context.stroke();
  }
}

function drawImageCover(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number): void {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function drawImageContain(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number): void {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function loadImageForCanvas(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG render failed")), "image/png");
  });
}

function drawDottedBackground(context: CanvasRenderingContext2D, width: number, height: number): void {
  context.fillStyle = "rgba(139, 95, 191, 0.16)";
  for (let y = 0; y < height; y += 12) {
    for (let x = 0; x < width; x += 12) context.fillRect(x, y, 1, 1);
  }
}

function roundRect(context: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number): void {
  const next = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + next, y);
  context.arcTo(x + width, y, x + width, y + height, next);
  context.arcTo(x + width, y + height, x, y + height, next);
  context.arcTo(x, y + height, x, y, next);
  context.arcTo(x, y, x + width, y, next);
  context.closePath();
}

function showTweetPngModal(blob: Blob, data: TweetPngData): void {
  document.querySelector("#milxdy-tweet-png-modal")?.remove();
  const url = URL.createObjectURL(blob);
  const modal = document.createElement("div");
  modal.id = "milxdy-tweet-png-modal";
  modal.innerHTML = `
    <div class="milxdy-tweet-png-dialog" role="dialog" aria-modal="true" aria-label="Tweet PNG preview">
      <header>
        <strong>Tweet PNG</strong>
        <button type="button" data-action="close" aria-label="Close">&times;</button>
      </header>
      <img src="${url}" alt="Rendered tweet preview">
      <p>Review before sharing. Nothing is sent automatically.</p>
      <footer>
        <button type="button" data-action="copy">Copy PNG</button>
        <button type="button" data-action="download">Download</button>
        <button type="button" data-action="share">Share</button>
      </footer>
    </div>
  `;
  const close = () => {
    URL.revokeObjectURL(url);
    modal.remove();
  };
  modal.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target === modal || target?.closest('[data-action="close"]')) close();
  });
  modal.querySelector('[data-action="copy"]')?.addEventListener("click", () => {
    void copyTweetPng(blob);
  });
  modal.querySelector('[data-action="download"]')?.addEventListener("click", () => {
    downloadBlob(blob, tweetPngFileName(data));
  });
  modal.querySelector('[data-action="share"]')?.addEventListener("click", () => {
    void shareTweetPng(blob, data);
  });
  document.body.appendChild(modal);
}

async function copyTweetPng(blob: Blob): Promise<void> {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") return;
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

async function shareTweetPng(blob: Blob, data: TweetPngData): Promise<void> {
  const file = new File([blob], tweetPngFileName(data), { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], title: data.author, text: data.statusUrl });
    return;
  }
  downloadBlob(blob, file.name);
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function tweetPngFileName(data: TweetPngData): string {
  const handle = data.handle.replace(/^@/, "") || "tweet";
  return `milxdy-${handle}-${Date.now()}.png`;
}

function injectTweetPngStyles(): void {
  if (document.getElementById("milxdy-tweet-png-styles")) return;
  const style = document.createElement("style");
  style.id = "milxdy-tweet-png-styles";
  style.textContent = `
    [data-milxdy-tweet-png-menu-item="true"] {
      align-items: center !important;
      display: flex !important;
      gap: 12px !important;
      transition: background-color 120ms ease, color 120ms ease, transform 80ms ease !important;
    }
    [data-milxdy-tweet-png-menu-item="true"]:hover,
    [data-milxdy-tweet-png-menu-item="true"]:focus-visible {
      background: rgba(15, 20, 25, 0.1) !important;
      color: inherit !important;
    }
    [data-milxdy-tweet-png-menu-item="true"]:active,
    [data-milxdy-tweet-png-menu-item="true"][data-milxdy-tweet-png-busy="true"] {
      background: rgba(15, 20, 25, 0.16) !important;
      color: inherit !important;
      transform: translateY(1px) !important;
    }
    .milxdy-tweet-png-menu-icon {
      flex: 0 0 auto;
      height: 20px;
      width: 20px;
    }
    #milxdy-tweet-png-modal {
      align-items: center;
      background: rgba(0, 0, 0, 0.54);
      display: flex;
      inset: 0;
      justify-content: center;
      padding: 24px;
      position: fixed;
      z-index: 2147483647;
    }
    .milxdy-tweet-png-dialog {
      background: #fffaff;
      border: 1px solid #b67cff;
      border-radius: 8px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.24);
      color: #20122f;
      display: grid;
      gap: 12px;
      max-height: min(760px, calc(100vh - 48px));
      max-width: min(620px, calc(100vw - 48px));
      overflow: auto;
      padding: 14px;
    }
    .milxdy-tweet-png-dialog header,
    .milxdy-tweet-png-dialog footer {
      align-items: center;
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }
    .milxdy-tweet-png-dialog img {
      border: 1px solid #d7b8ff;
      border-radius: 6px;
      display: block;
      max-width: 100%;
    }
    .milxdy-tweet-png-dialog p {
      color: #6d5a7f;
      font: 12px/1.35 TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      margin: 0;
    }
    .milxdy-tweet-png-dialog button {
      border: 1px solid #b67cff;
      border-radius: 6px;
      background: #ead8ff;
      color: #281447;
      cursor: pointer;
      font: 700 12px/1 TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      min-height: 30px;
      padding: 0 10px;
    }
  `;
  document.documentElement.appendChild(style);
}
