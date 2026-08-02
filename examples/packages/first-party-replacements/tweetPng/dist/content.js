// examples/packages/first-party-replacements/tweetPng/src/content.ts
var RESKIN_PROFILE_KEY = "milxdy.settings.reskinProfile";
var VISUAL_THEME_KEY = "milxdy.settings.visualTheme";
var TWEET_PNG_QUOTE_BORDER_WIDTH = 4;
var DEFAULT_VISUAL_THEME = {
  tweetPngIncludeImages: true,
  tweetPngIncludeQuoteText: true,
  tweetPngIncludeQuoteImages: true,
  tweetPngShrinkTallImages: true,
  tweetPngIncludeDate: true,
  tweetPngIncludeWatermark: true,
  tweetPngIncludeStats: true,
  tweetPngBorder: true,
  tweetPngBorderPalette: "purple",
  tweetPngBackgroundColor: "#fffaff",
  tweetPngFontColor: "#20122f"
};
var actionContext = null;
var closeTweetPngReview = null;
var tweetPngReviewHref = null;
var visualTheme = DEFAULT_VISUAL_THEME;
var id = "tweetPng";
async function onContextualPostAction(context) {
  if (context.actionId !== "reviewPng") return;
  actionContext = context;
  await openTweetPngReviewFromTweet(context.post, context.statusUrl);
}
function onRouteChange(route) {
  if (shouldCloseTweetPngReview(tweetPngReviewHref, route.href)) closeTweetPngReview?.();
}
function shouldCloseTweetPngReview(reviewHref, nextHref) {
  return Boolean(reviewHref && reviewHref !== nextHref);
}
function disable() {
  closeTweetPngReview?.();
  tweetPngReviewHref = null;
  actionContext = null;
}
async function copyTweetPngFromTweet(tweet, statusUrl) {
  await loadVisualTheme();
  await expandTweetPngText(tweet);
  const data = extractTweetPngData(tweet, statusUrl);
  if (!data.text && !data.images.length && !data.linkCard && !data.quote) return;
  const result = await renderTweetPng(data);
  await copyTweetPng(result.blob);
}
async function loadVisualTheme() {
  if (!actionContext) throw new Error("Share Kit must be opened from a declared contextual action.");
  const stored = await actionContext.storage.local.get({
    [RESKIN_PROFILE_KEY]: "max",
    [VISUAL_THEME_KEY]: DEFAULT_VISUAL_THEME
  });
  visualTheme = normalizeVisualTheme(stored[VISUAL_THEME_KEY]);
}
function normalizeVisualTheme(value) {
  const record = value && typeof value === "object" ? value : {};
  const bool = (key) => typeof record[key] === "boolean" ? record[key] : DEFAULT_VISUAL_THEME[key];
  const palette = ["purple", "gray", "blue", "green"].includes(String(record.tweetPngBorderPalette)) ? record.tweetPngBorderPalette : DEFAULT_VISUAL_THEME.tweetPngBorderPalette;
  return {
    tweetPngIncludeImages: bool("tweetPngIncludeImages"),
    tweetPngIncludeQuoteText: bool("tweetPngIncludeQuoteText"),
    tweetPngIncludeQuoteImages: bool("tweetPngIncludeQuoteImages"),
    tweetPngShrinkTallImages: bool("tweetPngShrinkTallImages"),
    tweetPngIncludeDate: bool("tweetPngIncludeDate"),
    tweetPngIncludeWatermark: bool("tweetPngIncludeWatermark"),
    tweetPngIncludeStats: bool("tweetPngIncludeStats"),
    tweetPngBorder: bool("tweetPngBorder"),
    tweetPngBorderPalette: palette,
    tweetPngBackgroundColor: normalizeColor(record.tweetPngBackgroundColor, DEFAULT_VISUAL_THEME.tweetPngBackgroundColor),
    tweetPngFontColor: normalizeColor(record.tweetPngFontColor, DEFAULT_VISUAL_THEME.tweetPngFontColor)
  };
}
function normalizeColor(value, fallback) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}
function colorWithAlpha(color, alpha) {
  return `${normalizeColor(color, DEFAULT_VISUAL_THEME.tweetPngFontColor)}${alpha}`;
}
function findDisplayNameLink(userName) {
  const links = Array.from(userName.querySelectorAll('a[role="link"], a[href^="/"]'));
  return links.find((link) => {
    if (link.querySelector("time")) return false;
    const text = (link.textContent || "").trim();
    return Boolean(text) && !text.startsWith("@");
  }) || null;
}
function textWithImageAlts(element) {
  if (!element) return "";
  const clone = element.cloneNode(true);
  for (const image of Array.from(clone.querySelectorAll("img[alt]"))) {
    const alt = image.getAttribute("alt") || "";
    image.replaceWith(document.createTextNode(alt));
  }
  return (clone.innerText || clone.textContent || "").trim();
}
async function openTweetPngReviewFromTweet(tweet, statusUrl) {
  injectTweetPngStyles();
  await loadVisualTheme();
  await expandTweetPngText(tweet);
  const data = extractTweetPngData(tweet, statusUrl);
  if (!data.text && !data.images.length && !data.linkCard && !data.quote) return;
  const result = await renderTweetPng(data);
  showTweetPngModal(tweet, statusUrl, result, data);
}
async function expandTweetPngText(tweet) {
  const buttons = Array.from(tweet.querySelectorAll('button, [role="button"]'));
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
function tweetPngMediaRemovalKey(scope, src) {
  return `${scope}:${src}`;
}
function withoutExcludedTweetPngMedia(data, excluded) {
  const included = (scope, media) => !excluded.has(tweetPngMediaRemovalKey(scope, media.src));
  return {
    ...data,
    images: data.images.filter((media) => included("post", media)),
    linkCard: data.linkCard ? { ...data.linkCard, image: data.linkCard.image && included("embed", data.linkCard.image) ? data.linkCard.image : null } : null,
    quote: data.quote ? { ...data.quote, images: data.quote.images.filter((media) => included("quote", media)) } : null
  };
}
var TWEET_PNG_FONT_FALLBACK = 'TwitterChirp, Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
var TWEET_PNG_BODY_FONT_SIZE = 34;
var TWEET_PNG_BODY_LINE_HEIGHT = 48;
var TWEET_PNG_QUOTE_FONT_SIZE = 26;
var TWEET_PNG_QUOTE_LINE_HEIGHT = 38;
var TWEET_PNG_WRAP_SAFETY_PX = 16;
var TWEET_PNG_MAX_ASPECT_RATIO = 2.25;
var TWEET_PNG_CASHTAG_HEIGHT = 570;
function extractTweetPngData(tweet, statusUrl) {
  const settings = visualTheme;
  const userName = Array.from(tweet.querySelectorAll('[data-testid="User-Name"]')).find((node) => !node.closest('[data-testid="quoteTweet"]')) || null;
  const author = textWithImageAlts(findDisplayNameLink(userName || tweet)) || "X post";
  const handleText = Array.from(userName?.querySelectorAll("span") || []).map((span) => span.textContent?.trim() || "").find((text2) => text2.startsWith("@")) || "";
  const quote = extractTweetPngQuoteData(tweet, statusUrl);
  const text = Array.from(tweet.querySelectorAll('[data-testid="tweetText"]')).filter((node) => !node.closest('[data-testid="quoteTweet"]') && !quote?.element.contains(node)).map((node) => textWithImageAlts(node)).join("\n").trim();
  const avatar = tweet.querySelector('img[src*="profile_images"]');
  const images = settings.tweetPngIncludeImages ? extractTweetPngMedia(tweet, (element) => !element.closest('[data-testid="quoteTweet"]') && !quote?.element.contains(element)) : [];
  const cashtag = settings.tweetPngIncludeImages ? extractTweetPngCashtag(tweet) : null;
  const linkCard = settings.tweetPngIncludeImages ? extractTweetPngLinkCard(tweet, quote?.element || null) : null;
  const stats = settings.tweetPngIncludeStats ? extractTweetPngStats(tweet) : null;
  return {
    author,
    handle: handleText,
    text,
    statusUrl: statusUrl || "",
    date: settings.tweetPngIncludeDate ? extractTweetPngDate(tweet) : "",
    avatarUrl: avatar?.currentSrc || avatar?.src || "",
    images,
    linkCard,
    cashtag,
    quote: quote ? { author: quote.author, handle: quote.handle, text: quote.text, images: quote.images } : null,
    stats
  };
}
function extractTweetPngDate(tweet) {
  const time = Array.from(tweet.querySelectorAll("time")).find((node) => !node.closest('[data-testid="quoteTweet"]'));
  const label = time?.getAttribute("aria-label")?.trim();
  if (label) return label;
  const dateTime = time?.dateTime;
  if (!dateTime) return "";
  const date = new Date(dateTime);
  if (Number.isNaN(date.getTime())) return dateTime;
  return date.toLocaleDateString(void 0, { year: "numeric", month: "short", day: "numeric" });
}
function extractTweetPngStats(tweet) {
  const badge = Array.from(tweet.querySelectorAll('[data-reminet-badge="true"]')).find((node) => !node.closest('[data-testid="quoteTweet"]'));
  if (!badge) return null;
  const score = badge.querySelector('[data-reminet-icon="score"] .reminet-label')?.textContent?.trim() || "";
  const beetles = badge.querySelector('[data-reminet-icon="beetle"] .reminet-label')?.textContent?.trim() || "";
  if (!score && !beetles) return null;
  return { score, beetles };
}
function extractTweetPngQuoteData(tweet, statusUrl) {
  const settings = visualTheme;
  const quote = findTweetPngQuoteElement(tweet, statusUrl);
  if (!quote) return null;
  const userName = quote.querySelector('[data-testid="User-Name"]');
  const handle = Array.from(userName?.querySelectorAll("span") || []).map((span) => span.textContent?.trim() || "").find((text2) => text2.startsWith("@")) || "";
  const author = extractTweetPngQuoteAuthor(userName, quote, handle);
  const text = settings.tweetPngIncludeQuoteText ? extractTweetPngTextFromQuoteElement(quote) : "";
  const images = settings.tweetPngIncludeQuoteImages ? extractTweetPngMedia(quote) : [];
  if (!text && !images.length) return null;
  return { author, handle, text, images, element: quote };
}
function extractTweetPngQuoteAuthor(userName, quote, handle) {
  const displayName = textWithImageAlts(findDisplayNameLink(userName || quote));
  if (displayName) return displayName;
  const fallback = Array.from(userName?.querySelectorAll("span") || []).map((span) => textWithImageAlts(span)).find((text) => text && !text.startsWith("@") && text !== handle);
  if (fallback) return fallback;
  return handle.replace(/^@/, "") || "X post";
}
function extractTweetPngTextFromQuoteElement(quote) {
  const explicit = Array.from(quote.querySelectorAll('[data-testid="tweetText"]')).map((node) => extractTweetPngQuoteTextNodeText(node)).join("\n").trim();
  if (explicit) return explicit;
  return Array.from(quote.querySelectorAll('[dir="auto"], [lang]')).filter((node) => !node.closest('[data-testid="User-Name"]') && !node.querySelector("time")).map((node) => textWithImageAlts(node)).map((value) => value.trim()).filter((value) => value && !value.startsWith("@")).filter((value) => !isImpliedQuoteHyperlinkText(value)).slice(0, 4).join("\n").trim();
}
function extractTweetPngQuoteTextNodeText(node) {
  const clone = node.cloneNode(true);
  for (const link of Array.from(clone.querySelectorAll("a[href]"))) {
    if (isImpliedQuoteHyperlink(link)) link.remove();
  }
  return textWithImageAlts(clone);
}
function isImpliedQuoteHyperlink(link) {
  const text = normalizeTweetPngInlineText(link.innerText || link.textContent || "");
  const href = link.getAttribute("href") || "";
  if (isImpliedQuoteHyperlinkText(text)) return true;
  if (/^https?:\/\/t\.co\//i.test(href)) return true;
  if (/^\/[^/]+\/status\/\d+/i.test(href)) return true;
  if (/^https?:\/\/(?:x|twitter)\.com\/[^/]+\/status\/\d+/i.test(href)) return true;
  return false;
}
function isImpliedQuoteHyperlinkText(value) {
  const text = normalizeTweetPngInlineText(value);
  return /^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\/[^/]+\/status\/\d+/i.test(text) || /^(?:https?:\/\/)?t\.co\/[a-z0-9]+$/i.test(text) || /^…?\s*(?:show this thread|show more)$/i.test(text);
}
function normalizeTweetPngInlineText(value) {
  return value.replace(/\s+/g, " ").trim();
}
function findTweetPngQuoteElement(tweet, statusUrl) {
  const explicit = tweet.querySelector('[data-testid="quoteTweet"]');
  if (explicit) return explicit;
  const textNodes = Array.from(tweet.querySelectorAll('[data-testid="tweetText"]'));
  const nestedQuoteText = textNodes.find((node, index) => index > 0 && tweetPngElementBelongsToPost(node, tweet));
  const textCard = nestedQuoteText?.closest('div[role="link"], a[href*="/status/"]') || null;
  if (textCard?.querySelector('[data-testid="User-Name"]')) return textCard;
  const structuredCard = Array.from(tweet.querySelectorAll('div[role="link"]')).find((candidate) => {
    if (!tweetPngElementBelongsToPost(candidate, tweet)) return false;
    if (!candidate.querySelector('[data-testid="User-Name"]')) return false;
    return Boolean(candidate.querySelector('[data-testid="tweetText"], [data-testid="tweetPhoto"] img, [data-testid="videoPlayer"], video[poster]'));
  });
  if (structuredCard) return structuredCard;
  const normalizedStatus = normalizeTweetStatusHref(statusUrl || "");
  const candidates = Array.from(tweet.querySelectorAll('a[href*="/status/"]'));
  return candidates.find((candidate) => {
    const href = candidate instanceof HTMLAnchorElement ? normalizeTweetStatusHref(candidate.href) : "";
    if (href && normalizedStatus && href === normalizedStatus) return false;
    if (!tweetPngElementBelongsToPost(candidate, tweet)) return false;
    return Boolean(candidate.querySelector('[data-testid="tweetText"], [data-testid="tweetPhoto"] img, [data-testid="videoPlayer"], video[poster]'));
  }) || null;
}
function tweetPngElementBelongsToPost(element, tweet) {
  const article = element.closest('article[data-testid="tweet"]');
  return !tweet.matches('article[data-testid="tweet"]') || article === tweet;
}
function extractTweetPngMedia(root, include = () => true) {
  const media = /* @__PURE__ */ new Map();
  for (const image of Array.from(root.querySelectorAll('[data-testid="tweetPhoto"] img'))) {
    if (!include(image)) continue;
    const src = image.currentSrc || image.src;
    if (src) media.set(src, { src, isVideo: false });
  }
  for (const video of Array.from(root.querySelectorAll("video[poster]"))) {
    if (!include(video)) continue;
    const src = video.poster;
    if (src) media.set(src, { src, isVideo: true });
  }
  for (const image of Array.from(root.querySelectorAll('[data-testid="videoPlayer"] img'))) {
    if (!include(image)) continue;
    const src = image.currentSrc || image.src;
    if (src) media.set(src, { src, isVideo: true });
  }
  return Array.from(media.values()).slice(0, 4);
}
function tweetPngLinkCardLabels(values) {
  const labels = values.map(normalizeTweetPngInlineText).filter(Boolean);
  const source = labels.find((value) => /^From\s+\S+/i.test(value)) || "";
  const title = labels.find((value) => value !== source && !/^https?:\/\//i.test(value)) || "";
  return { title, source };
}
function extractTweetPngLinkCard(root, quoteElement = null) {
  const card = Array.from(root.querySelectorAll('[data-testid="card.wrapper"]')).find((candidate) => !candidate.closest('[data-testid="quoteTweet"]') && !quoteElement?.contains(candidate));
  if (!card) return null;
  const leafLabels = Array.from(card.querySelectorAll("span")).filter((element) => !element.querySelector("span")).map((element) => element.textContent || "");
  const ariaLabel = card.getAttribute("aria-label") || "";
  const { title, source } = tweetPngLinkCardLabels([...leafLabels, ariaLabel]);
  const preview = Array.from(card.querySelectorAll("img")).find((image) => Boolean(image.currentSrc || image.src));
  const src = preview?.currentSrc || preview?.src || "";
  if (!title && !source && !src) return null;
  return {
    title,
    source,
    image: src ? { src, isVideo: false } : null
  };
}
function extractTweetPngCashtag(root) {
  const navigation = Array.from(root.querySelectorAll('nav[aria-label="Cashtag attachments"]')).find((element) => !element.closest('[data-testid="quoteTweet"]'));
  const card = navigation?.querySelector('a[role="link"], a[href]');
  if (!card) return null;
  const values = Array.from(card.querySelectorAll("span")).filter((element) => !element.querySelector("span")).map((element) => normalizeTweetPngInlineText(element.textContent || "")).filter(Boolean);
  const chart = Array.from(card.querySelectorAll("svg")).find((element) => {
    const viewBox = element.getAttribute("viewBox") || "";
    const [, , width, height] = viewBox.split(/\s+/).map(Number);
    return Number.isFinite(width) && Number.isFinite(height) && width >= 200 && height >= 80;
  });
  if (values.length < 3 || !chart) return null;
  const chartMarkup = chart.outerHTML.includes("xmlns=") ? chart.outerHTML : chart.outerHTML.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
  const icon = card.querySelector("img");
  return {
    name: values[0] || "Market",
    market: values[1] || "",
    price: values[2] || "",
    change: values[3] || "",
    timestamp: values[4] || "",
    currentPrice: values[values.length - 1] || "",
    iconUrl: icon?.currentSrc || icon?.src || "",
    chartUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(chartMarkup)}`
  };
}
function normalizeTweetStatusHref(value) {
  const match = value.match(/\/([^/?#]+)\/status\/(\d+)/);
  return match ? `/${match[1]}/status/${match[2]}` : value;
}
async function renderTweetPng(data) {
  await waitForTweetPngFonts();
  const scale = 2;
  const width = 1200;
  const maxHeight = Math.round(width * TWEET_PNG_MAX_ASPECT_RATIO);
  const padding = 56;
  const footerHeight = data.date ? 42 : 0;
  const avatarSize = 96;
  const bodyX = padding + avatarSize + 24;
  const bodyWidth = width - bodyX - padding;
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas unavailable");
  const palette = tweetPngPalette(
    visualTheme.tweetPngBorderPalette,
    visualTheme.tweetPngBackgroundColor
  );
  const mediaRegions = [];
  context.font = `${TWEET_PNG_BODY_FONT_SIZE}px ${TWEET_PNG_FONT_FALLBACK}`;
  const textLines = wrapCanvasText(
    context,
    data.text || data.date || data.handle,
    bodyWidth,
    Math.ceil(maxHeight / TWEET_PNG_BODY_LINE_HEIGHT)
  );
  context.font = `${TWEET_PNG_QUOTE_FONT_SIZE}px ${TWEET_PNG_FONT_FALLBACK}`;
  const quoteTextLines = data.quote?.text ? wrapCanvasText(context, data.quote.text, bodyWidth - 48, Math.ceil(maxHeight / TWEET_PNG_QUOTE_LINE_HEIGHT)) : [];
  const mediaImages = await Promise.all(data.images.map(loadTweetPngMedia));
  const linkCard = data.linkCard ? await loadTweetPngLinkCard(data.linkCard) : null;
  const quoteImages = data.quote ? await Promise.all(data.quote.images.map(loadTweetPngMedia)) : [];
  const cashtag = data.cashtag ? await loadTweetPngCashtag(data.cashtag) : null;
  const assets = await loadTweetPngRenderAssets();
  const avatarImage = data.avatarUrl ? await loadImageForCanvas(data.avatarUrl).catch(() => null) : null;
  const mediaHeight = measureTweetPngMediaHeight(mediaImages, bodyWidth, 520);
  const linkCardHeight = linkCard ? linkCard.image?.image ? 420 : 120 : 0;
  const cashtagHeight = cashtag?.chart ? TWEET_PNG_CASHTAG_HEIGHT : 0;
  const quoteMediaHeight = measureTweetPngMediaHeight(quoteImages, bodyWidth - 48, 300);
  const textHeight = textLines.length * TWEET_PNG_BODY_LINE_HEIGHT;
  const quoteHeight = data.quote ? measureTweetPngQuoteHeight(quoteTextLines.length, quoteMediaHeight) : 0;
  const uncappedHeight = padding * 2 + Math.max(
    avatarSize,
    86 + textHeight + (mediaHeight ? mediaHeight + 28 : 0) + (cashtagHeight ? cashtagHeight + 28 : 0) + (linkCardHeight ? linkCardHeight + 28 : 0) + (quoteHeight ? quoteHeight + 22 : 0) + footerHeight + 36
  );
  const height = Math.min(maxHeight, Math.max(360, uncappedHeight));
  canvas.width = width * scale;
  canvas.height = height * scale;
  context.scale(scale, scale);
  context.fillStyle = "#f6e9ff";
  context.fillRect(0, 0, width, height);
  drawDottedBackground(context, width, height);
  roundRect(context, 28, 28, width - 56, height - 56, 28);
  context.fillStyle = visualTheme.tweetPngBackgroundColor;
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
  context.fillStyle = visualTheme.tweetPngFontColor;
  context.font = `700 34px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText(data.author, bodyX, padding + 36);
  context.fillStyle = colorWithAlpha(visualTheme.tweetPngFontColor, "b8");
  context.font = `26px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText(data.handle || "x.com", bodyX, padding + 72);
  drawTweetPngHeaderStats(context, data.stats, assets, bodyX, padding + 34, bodyWidth);
  context.fillStyle = visualTheme.tweetPngFontColor;
  context.font = `${TWEET_PNG_BODY_FONT_SIZE}px ${TWEET_PNG_FONT_FALLBACK}`;
  let y = padding + 126;
  const footerY = height - padding - (data.date ? 8 : 0);
  const maxContentY = data.date ? footerY - footerHeight : height - padding;
  const reservedAfterText = (mediaHeight ? mediaHeight + 38 : 0) + (cashtagHeight ? cashtagHeight + 28 : 0) + (linkCardHeight ? linkCardHeight + 28 : 0) + (quoteHeight ? quoteHeight + 22 : 0);
  const textAreaBottom = maxContentY - reservedAfterText;
  const drawableTextLines = visibleCanvasTextLines(context, textLines, bodyWidth, y, textAreaBottom, TWEET_PNG_BODY_LINE_HEIGHT);
  for (const line of drawableTextLines) {
    context.fillText(line, bodyX, y);
    y += TWEET_PNG_BODY_LINE_HEIGHT;
  }
  if (mediaImages.some(Boolean)) {
    y += 10;
    const reservedFollowingHeight = (cashtagHeight ? cashtagHeight + 28 : 0) + (linkCardHeight ? linkCardHeight + 28 : 0) + (quoteHeight ? quoteHeight + 22 : 0);
    const boundedMediaHeight = Math.min(mediaHeight, Math.max(0, maxContentY - y - reservedFollowingHeight - 28));
    if (boundedMediaHeight >= 80) {
      drawTweetPngMediaGrid(context, mediaImages, bodyX, y, bodyWidth, boundedMediaHeight, palette, "post", mediaRegions);
      y += boundedMediaHeight + 28;
    }
  }
  if (cashtag?.chart && y + 120 < maxContentY) {
    const reservedFollowingHeight = (linkCardHeight ? linkCardHeight + 28 : 0) + (quoteHeight ? quoteHeight + 22 : 0);
    const boundedCashtagHeight = Math.min(cashtagHeight, Math.max(0, maxContentY - y - reservedFollowingHeight - 28));
    if (boundedCashtagHeight >= 280) {
      drawTweetPngCashtag(context, cashtag, bodyX, y, bodyWidth, boundedCashtagHeight, palette);
      y += boundedCashtagHeight + 28;
    }
  }
  if (linkCard && y + 100 < maxContentY) {
    const reservedQuoteHeight = quoteHeight ? quoteHeight + 22 : 0;
    const boundedLinkCardHeight = Math.min(linkCardHeight, Math.max(0, maxContentY - y - reservedQuoteHeight - 22));
    if (boundedLinkCardHeight >= 100) {
      drawTweetPngLinkCard(context, linkCard, bodyX, y, bodyWidth, boundedLinkCardHeight, palette, mediaRegions);
      y += boundedLinkCardHeight + 28;
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
      mediaRegions
    });
  }
  if (data.date) {
    context.fillStyle = colorWithAlpha(visualTheme.tweetPngFontColor, "a8");
    context.font = `22px ${TWEET_PNG_FONT_FALLBACK}`;
    context.fillText(data.date, bodyX, footerY);
  }
  if (visualTheme.tweetPngIncludeWatermark) {
    drawTweetPngWatermark(context, width, height, visualTheme.tweetPngBackgroundColor);
  }
  return {
    blob: await canvasToPngBlob(canvas),
    width,
    height,
    mediaRegions
  };
}
async function loadTweetPngRenderAssets() {
  const lotusUrl = actionContext?.resolveAssetUrl("assets/remistats-star.svg") || "";
  return {
    lotus: lotusUrl ? await loadImageForCanvas(lotusUrl) : null
  };
}
function drawTweetPngHeaderStats(context, stats, assets, x, y, width) {
  if (!stats?.score && !stats?.beetles) return;
  const gap = 12;
  const groups = [];
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
    context.fillStyle = visualTheme.tweetPngFontColor;
    context.font = `700 24px ${TWEET_PNG_FONT_FALLBACK}`;
    context.fillText(group.value, cursor + 34, y);
    cursor += group.width + gap;
  }
}
function tweetPngPalette(value, background = DEFAULT_VISUAL_THEME.tweetPngBackgroundColor) {
  const cardFill = normalizeColor(background, DEFAULT_VISUAL_THEME.tweetPngBackgroundColor);
  switch (value) {
    case "gray":
      return { border: "#cfd6df", mediaBorder: "#d8dee7", quoteBorder: "#d8dee7", quoteFill: cardFill, mediaFill: cardFill };
    case "blue":
      return { border: "#78aee8", mediaBorder: "#a8cef5", quoteBorder: "#a8cef5", quoteFill: cardFill, mediaFill: cardFill };
    case "green":
      return { border: "#82b98a", mediaBorder: "#add8b1", quoteBorder: "#add8b1", quoteFill: cardFill, mediaFill: cardFill };
    case "purple":
    default:
      return { border: "#b67cff", mediaBorder: "#c9a5ff", quoteBorder: "#d5b7ff", quoteFill: cardFill, mediaFill: cardFill };
  }
}
function setTweetPngSettingsOpen(settings, button, open) {
  settings.hidden = !open;
  button.setAttribute("aria-expanded", String(open));
}
async function waitForTweetPngFonts() {
  const fonts = document.fonts;
  if (!fonts?.ready) return;
  await Promise.race([
    fonts.ready.catch(() => void 0),
    new Promise((resolve) => window.setTimeout(resolve, 250))
  ]);
}
function wrapCanvasText(context, text, maxWidth, maxLines) {
  const safeWidth = Math.max(1, maxWidth - TWEET_PNG_WRAP_SAFETY_PX);
  const paragraphs = text.replace(/\r\n?/g, "\n").split("\n");
  const lines = [];
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
      if (canvasTextWidth(context, next) <= safeWidth) {
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
      if (canvasTextWidth(context, word) <= safeWidth) {
        line = word;
        continue;
      }
      const segments = splitCanvasTextByWidth(context, word, safeWidth);
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
    lines[lines.length - 1] = ellipsizeCanvasText(context, lines[lines.length - 1], safeWidth);
  }
  return lines.length ? lines : [""];
}
function splitCanvasTextByWidth(context, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const segment of canvasTextSegments(text)) {
    const next = line + segment;
    if (!line || canvasTextWidth(context, next) <= maxWidth) {
      line = next;
      continue;
    }
    lines.push(line);
    line = segment;
  }
  if (line) lines.push(line);
  return lines;
}
function ellipsizeCanvasText(context, text, maxWidth) {
  const ellipsis = "...";
  const segments = canvasTextSegments(text.trim());
  while (segments.length > 0 && canvasTextWidth(context, `${segments.join("")}${ellipsis}`) > maxWidth) {
    segments.pop();
  }
  return `${segments.join("").trim()}${ellipsis}`;
}
function canvasTextWidth(context, text) {
  const metrics = context.measureText(text);
  const bounds = Math.abs(metrics.actualBoundingBoxLeft || 0) + Math.abs(metrics.actualBoundingBoxRight || 0);
  return Math.max(metrics.width, bounds);
}
function visibleCanvasTextLines(context, lines, maxWidth, startY, maxY, lineHeight) {
  const availableLines = tweetPngVisibleLineCount(startY, maxY, lineHeight);
  if (lines.length <= availableLines) return [...lines];
  if (availableLines <= 0) return [];
  const visible = lines.slice(0, availableLines);
  visible[visible.length - 1] = ellipsizeCanvasText(context, visible[visible.length - 1], Math.max(1, maxWidth - TWEET_PNG_WRAP_SAFETY_PX));
  return visible;
}
function tweetPngVisibleLineCount(startY, maxY, lineHeight) {
  if (maxY < startY || lineHeight <= 0) return 0;
  return Math.floor((maxY - startY) / lineHeight) + 1;
}
function drawTweetPngCashtag(context, cashtag, x, y, width, height, palette) {
  if (!cashtag.chart) return;
  const chart = cashtag.chart;
  const padding = 24;
  roundRect(context, x, y, width, height, 24);
  context.fillStyle = palette.quoteFill;
  context.fill();
  if (visualTheme.tweetPngBorder) {
    context.strokeStyle = palette.quoteBorder;
    context.lineWidth = 2;
    context.stroke();
  }
  const iconSize = 68;
  if (cashtag.icon) {
    context.save();
    context.beginPath();
    context.arc(x + padding + iconSize / 2, y + padding + iconSize / 2, iconSize / 2, 0, Math.PI * 2);
    context.clip();
    context.drawImage(cashtag.icon, x + padding, y + padding, iconSize, iconSize);
    context.restore();
  }
  const headingX = x + padding + (cashtag.icon ? iconSize + 18 : 0);
  context.fillStyle = visualTheme.tweetPngFontColor;
  context.font = `700 30px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText(cashtag.name, headingX, y + 51);
  context.fillStyle = colorWithAlpha(visualTheme.tweetPngFontColor, "b8");
  context.font = `22px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText(cashtag.market, headingX, y + 82);
  context.fillStyle = visualTheme.tweetPngFontColor;
  context.font = `700 40px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText(cashtag.price, x + padding, y + 142);
  if (cashtag.change) {
    context.fillStyle = cashtag.change.trim().startsWith("-") ? "#f4212e" : "#00ba7c";
    context.font = `25px ${TWEET_PNG_FONT_FALLBACK}`;
    context.fillText(`${cashtag.change.trim().startsWith("-") ? "\u2193" : "\u2191"} ${cashtag.change}`, x + padding, y + 179);
  }
  context.fillStyle = colorWithAlpha(visualTheme.tweetPngFontColor, "a8");
  context.font = `21px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText(cashtag.timestamp, x + padding, y + 210);
  const chartY = y + 224;
  const chartHeight = Math.max(64, height - 274);
  context.drawImage(chart, x + padding, chartY, width - padding * 2, chartHeight);
  context.fillStyle = colorWithAlpha(visualTheme.tweetPngFontColor, "c8");
  context.font = `20px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText("Now at", x + padding, y + height - 20);
  context.fillStyle = visualTheme.tweetPngFontColor;
  context.font = `700 20px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText(cashtag.currentPrice, x + padding + 68, y + height - 20);
}
function canvasTextSegments(text) {
  const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(void 0, { granularity: "grapheme" }) : null;
  return segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);
}
function drawTweetPngQuote(context, options) {
  const padding = 24;
  const lineHeight = TWEET_PNG_QUOTE_LINE_HEIGHT;
  const cardHeight = Math.min(
    options.maxY - options.y,
    measureTweetPngQuoteHeight(options.textLines.length, options.mediaHeight)
  );
  if (cardHeight < 88) return options.y;
  roundRect(context, options.x, options.y, options.width, cardHeight, 22);
  context.fillStyle = options.palette.quoteFill;
  context.fill();
  if (visualTheme.tweetPngBorder) {
    context.strokeStyle = options.palette.quoteBorder;
    context.lineWidth = TWEET_PNG_QUOTE_BORDER_WIDTH;
    context.stroke();
  }
  let y = options.y + padding + 6;
  const quoteTextColor = visualTheme.tweetPngFontColor;
  context.fillStyle = quoteTextColor;
  context.font = `700 24px ${TWEET_PNG_FONT_FALLBACK}`;
  context.fillText(options.quote.author, options.x + padding, y);
  if (options.quote.handle) {
    context.fillStyle = colorWithAlpha(quoteTextColor, "b8");
    context.font = `22px ${TWEET_PNG_FONT_FALLBACK}`;
    context.fillText(options.quote.handle, options.x + padding + Math.min(360, context.measureText(options.quote.author).width + 14), y);
  }
  y += 38;
  context.fillStyle = quoteTextColor;
  context.font = `26px ${TWEET_PNG_FONT_FALLBACK}`;
  for (const line of options.textLines) {
    if (y + lineHeight > options.y + cardHeight - padding) break;
    context.fillText(line, options.x + padding, y);
    y += lineHeight;
  }
  if (options.images.some((media) => Boolean(media.image)) && y + 76 < options.y + cardHeight) {
    y += 8;
    drawTweetPngMediaGrid(
      context,
      options.images,
      options.x + padding,
      y,
      options.width - padding * 2,
      Math.min(options.mediaHeight, options.y + cardHeight - y - padding),
      options.palette,
      "quote",
      options.mediaRegions
    );
  }
  return options.y + cardHeight + 22;
}
function measureTweetPngQuoteHeight(textLineCount, mediaHeight) {
  const padding = 24;
  const headerHeight = 30;
  return padding * 2 + headerHeight + (textLineCount ? 14 + textLineCount * TWEET_PNG_QUOTE_LINE_HEIGHT : 0) + (mediaHeight ? 14 + mediaHeight : 0);
}
function measureTweetPngMediaHeight(images, width, maxHeight) {
  const visible = images.filter((media) => Boolean(media.image));
  if (!visible.length) return 0;
  if (visible.length > 1) return Math.min(maxHeight, 420);
  const image = visible[0].image;
  const ratio = image.naturalWidth > 0 && image.naturalHeight > 0 ? image.naturalWidth / image.naturalHeight : 16 / 9;
  if (ratio >= 1) return Math.min(maxHeight, Math.max(260, width / ratio));
  return Math.min(maxHeight, Math.max(240, width * 0.62 / ratio));
}
function drawTweetPngLinkCard(context, card, x, y, width, height, palette, regions) {
  roundRect(context, x, y, width, height, 22);
  context.fillStyle = palette.mediaFill;
  context.fill();
  const imageHeight = card.image?.image ? Math.max(0, height - 104) : 0;
  if (card.image?.image && imageHeight >= 80) {
    context.save();
    roundRect(context, x, y, width, height, 22);
    context.clip();
    drawImageCover(context, card.image.image, x, y, width, imageHeight);
    context.restore();
    regions.push({
      key: tweetPngMediaRemovalKey("embed", card.image.src),
      x,
      y,
      width,
      height: imageHeight
    });
  }
  if (visualTheme.tweetPngBorder) {
    roundRect(context, x, y, width, height, 22);
    context.strokeStyle = palette.mediaBorder;
    context.lineWidth = 2;
    context.stroke();
  }
  let textY = y + imageHeight + 34;
  context.fillStyle = visualTheme.tweetPngFontColor;
  context.font = `700 24px ${TWEET_PNG_FONT_FALLBACK}`;
  for (const line of wrapCanvasText(context, card.title, width - 48, 2)) {
    context.fillText(line, x + 24, textY);
    textY += 30;
  }
  if (card.source && textY <= y + height - 12) {
    context.fillStyle = colorWithAlpha(visualTheme.tweetPngFontColor, "b8");
    context.font = `20px ${TWEET_PNG_FONT_FALLBACK}`;
    context.fillText(card.source, x + 24, Math.min(y + height - 22, textY + 4));
  }
}
function drawTweetPngMediaGrid(context, images, x, y, width, height, palette, scope, regions) {
  const visible = images.filter((media) => Boolean(media.image));
  const gap = 10;
  if (visible.length === 1) {
    const region = drawTweetPngSingleMedia(context, visible[0], x, y, width, height, palette);
    regions.push({ key: tweetPngMediaRemovalKey(scope, visible[0].src), ...region });
    return;
  }
  const cells = visible.length === 1 ? [{ x, y, width, height }] : visible.length === 2 ? [{ x, y, width: (width - gap) / 2, height }, { x: x + (width + gap) / 2, y, width: (width - gap) / 2, height }] : [
    { x, y, width: (width - gap) / 2, height: (height - gap) / 2 },
    { x: x + (width + gap) / 2, y, width: (width - gap) / 2, height: (height - gap) / 2 },
    { x, y: y + (height + gap) / 2, width: (width - gap) / 2, height: (height - gap) / 2 },
    { x: x + (width + gap) / 2, y: y + (height + gap) / 2, width: (width - gap) / 2, height: (height - gap) / 2 }
  ];
  visible.slice(0, cells.length).forEach((media, index) => {
    const cell = cells[index];
    roundRect(context, cell.x, cell.y, cell.width, cell.height, 22);
    context.save();
    context.clip();
    drawImageCover(context, media.image, cell.x, cell.y, cell.width, cell.height);
    context.restore();
    if (media.isVideo) drawVideoPlayOverlay(context, cell.x, cell.y, cell.width, cell.height);
    if (visualTheme.tweetPngBorder) {
      context.strokeStyle = palette.mediaBorder;
      context.lineWidth = 2;
      context.stroke();
    }
    regions.push({ key: tweetPngMediaRemovalKey(scope, media.src), ...cell });
  });
}
function drawTweetPngSingleMedia(context, media, x, y, width, height, palette) {
  const image = media.image;
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
  if (media.isVideo) drawVideoPlayOverlay(context, drawX, y, drawWidth, drawHeight);
  if (visualTheme.tweetPngBorder) {
    context.strokeStyle = palette.mediaBorder;
    context.lineWidth = 2;
    context.stroke();
  }
  return { x: drawX, y, width: drawWidth, height: drawHeight };
}
function drawVideoPlayOverlay(context, x, y, width, height) {
  const radius = Math.max(24, Math.min(48, Math.min(width, height) * 0.12));
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  context.save();
  context.fillStyle = "rgba(0, 0, 0, 0.68)";
  context.beginPath();
  context.arc(centerX, centerY, radius, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.beginPath();
  context.moveTo(centerX - radius * 0.22, centerY - radius * 0.42);
  context.lineTo(centerX + radius * 0.48, centerY);
  context.lineTo(centerX - radius * 0.22, centerY + radius * 0.42);
  context.closePath();
  context.fill();
  context.restore();
}
function drawImageCover(context, image, x, y, width, height) {
  const ratio = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}
function drawImageContain(context, image, x, y, width, height) {
  const ratio = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const drawWidth = image.naturalWidth * ratio;
  const drawHeight = image.naturalHeight * ratio;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}
function loadImageForCanvas(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}
async function loadTweetPngMedia(media) {
  return { ...media, image: await loadImageForCanvas(media.src) };
}
async function loadTweetPngLinkCard(card) {
  return { ...card, image: card.image ? await loadTweetPngMedia(card.image) : null };
}
async function loadTweetPngCashtag(cashtag) {
  const [icon, chart] = await Promise.all([
    cashtag.iconUrl ? loadImageForCanvas(cashtag.iconUrl) : Promise.resolve(null),
    loadImageForCanvas(cashtag.chartUrl)
  ]);
  return { ...cashtag, icon, chart };
}
function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG render failed")), "image/png");
  });
}
function drawDottedBackground(context, width, height) {
  context.fillStyle = "rgba(139, 95, 191, 0.16)";
  for (let y = 0; y < height; y += 12) {
    for (let x = 0; x < width; x += 12) context.fillRect(x, y, 1, 1);
  }
}
function tweetPngWatermarkColor(background) {
  const normalized = normalizeColor(background, DEFAULT_VISUAL_THEME.tweetPngBackgroundColor);
  const channels = [1, 3, 5].map((offset) => Number.parseInt(normalized.slice(offset, offset + 2), 16));
  const luminance = (channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722) / 255;
  const target = luminance > 0.5 ? 0 : 255;
  const tinted = channels.map((channel) => Math.round(channel + (target - channel) * 0.12));
  return `#${tinted.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}
function drawTweetPngWatermark(context, width, height, background) {
  context.save();
  context.fillStyle = tweetPngWatermarkColor(background);
  context.font = `700 16px ${TWEET_PNG_FONT_FALLBACK}`;
  context.textAlign = "right";
  context.textBaseline = "alphabetic";
  context.fillText("milXdy", width - 38, height - 8);
  context.restore();
}
function roundRect(context, x, y, width, height, radius) {
  const next = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + next, y);
  context.arcTo(x + width, y, x + width, y + height, next);
  context.arcTo(x + width, y + height, x, y + height, next);
  context.arcTo(x, y + height, x, y, next);
  context.arcTo(x, y, x + width, y, next);
  context.closePath();
}
function showTweetPngModal(tweet, statusUrl, result, data) {
  closeTweetPngReview?.();
  tweetPngReviewHref = location.href;
  document.querySelector("#milxdy-tweet-png-modal")?.remove();
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  let currentBlob = result.blob;
  let currentData = data;
  let currentResult = result;
  let url = URL.createObjectURL(result.blob);
  let renderVersion = 0;
  let previewUpdateTimer = null;
  const modal = document.createElement("div");
  modal.id = "milxdy-tweet-png-modal";
  modal.innerHTML = `
    <div class="milxdy-tweet-png-dialog" role="dialog" aria-modal="true" aria-labelledby="milxdy-share-kit-title">
      <header class="milxdy-tweet-png-toolbar">
        <strong id="milxdy-share-kit-title">Share Kit</strong>
        <div class="milxdy-tweet-png-actions" role="group" aria-label="PNG actions">
          <button type="button" data-action="copy">Copy PNG</button>
          <button type="button" data-action="download">Download</button>
          <span class="milxdy-tweet-png-reminet-disconnected" data-reminet-disconnected>
            <button type="button" data-action="reconnect" title="Open RemiliaNET in a background tab">Reconnect</button>
            <button type="button" data-action="refresh" title="Retest the RemiNet connection">Refresh</button>
          </span>
          <button type="button" data-action="reminet" title="Stage this PNG in RemiNet Chat" hidden>Share to RemiNet</button>
          <button type="button" data-action="settings" aria-label="Share Kit settings" aria-expanded="false" aria-controls="milxdy-tweet-png-settings">&#9881;</button>
          <button type="button" data-action="close" aria-label="Close">&times;</button>
        </div>
      </header>
      <section id="milxdy-tweet-png-settings" class="milxdy-tweet-png-settings" aria-label="Share Kit settings" hidden>
        <div class="milxdy-tweet-png-presets" role="group" aria-label="Color presets">
          <span>Colors</span>
          <button type="button" data-preset="paper">Paper</button>
          <button type="button" data-preset="lavender">Lavender</button>
          <button type="button" data-preset="night">Night</button>
          <button type="button" data-preset="contrast">Contrast</button>
        </div>
        <label>Background <input type="color" data-setting="tweetPngBackgroundColor" value="${visualTheme.tweetPngBackgroundColor}"></label>
        <label>Font <input type="color" data-setting="tweetPngFontColor" value="${visualTheme.tweetPngFontColor}"></label>
        <label><input type="checkbox" data-setting="tweetPngIncludeImages"${visualTheme.tweetPngIncludeImages ? " checked" : ""}> Include image</label>
        <label><input type="checkbox" data-setting="tweetPngIncludeQuoteText"${visualTheme.tweetPngIncludeQuoteText ? " checked" : ""}> Include QRT</label>
        <label><input type="checkbox" data-setting="tweetPngIncludeQuoteImages"${visualTheme.tweetPngIncludeQuoteImages ? " checked" : ""}> Include QRT image</label>
        <label><input type="checkbox" data-setting="tweetPngIncludeWatermark"${visualTheme.tweetPngIncludeWatermark ? " checked" : ""}> Include milXdy watermark</label>
        <p>Changes update this preview and are saved as the Share Kit defaults.</p>
      </section>
      <div class="milxdy-tweet-png-preview-stage">
        <img class="milxdy-tweet-png-preview" src="${url}" alt="Rendered post PNG preview">
        <div class="milxdy-tweet-png-media-controls" aria-label="Included image controls"></div>
      </div>
      <p>Review before sharing. Nothing is sent automatically.</p>
      <p class="milxdy-tweet-png-status" role="status" aria-live="polite"></p>
    </div>
  `;
  const preview = modal.querySelector(".milxdy-tweet-png-preview");
  const mediaControls = modal.querySelector(".milxdy-tweet-png-media-controls");
  const settings = modal.querySelector("#milxdy-tweet-png-settings");
  const settingsButton = modal.querySelector('[data-action="settings"]');
  const disconnectedControls = modal.querySelector("[data-reminet-disconnected]");
  const shareToRemiNetButton = modal.querySelector('[data-action="reminet"]');
  const status = modal.querySelector(".milxdy-tweet-png-status");
  const setStatus = (message) => {
    if (status) status.textContent = message;
  };
  const excludedMedia = /* @__PURE__ */ new Set();
  const renderMediaControls = (nextData, nextResult) => {
    if (!mediaControls) return;
    mediaControls.replaceChildren();
    const labels = new Map([
      ...nextData.images.map((media, index) => [
        tweetPngMediaRemovalKey("post", media.src),
        `Remove post image ${index + 1}`
      ]),
      ...nextData.linkCard?.image ? [[
        tweetPngMediaRemovalKey("embed", nextData.linkCard.image.src),
        "Remove link preview image"
      ]] : [],
      ...(nextData.quote?.images || []).map((media, index) => [
        tweetPngMediaRemovalKey("quote", media.src),
        `Remove QRT image ${index + 1}`
      ])
    ]);
    for (const region of nextResult.mediaRegions) {
      const label = labels.get(region.key);
      if (!label) continue;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "milxdy-tweet-png-remove-media";
      remove.dataset.removeMedia = region.key;
      remove.setAttribute("aria-label", label);
      remove.title = label;
      remove.textContent = "\xD7";
      remove.style.left = `${(region.x + region.width) / nextResult.width * 100}%`;
      remove.style.top = `${region.y / nextResult.height * 100}%`;
      mediaControls.appendChild(remove);
    }
  };
  let closed = false;
  const actionSignal = actionContext?.signal;
  const close = (restoreFocus = true) => {
    if (closed) return;
    closed = true;
    actionSignal?.removeEventListener("abort", abortClose);
    if (previewUpdateTimer !== null) window.clearTimeout(previewUpdateTimer);
    URL.revokeObjectURL(url);
    modal.remove();
    if (closeTweetPngReview === close) closeTweetPngReview = null;
    tweetPngReviewHref = null;
    if (restoreFocus && returnFocus?.isConnected) returnFocus.focus();
  };
  const abortClose = () => close();
  closeTweetPngReview = close;
  actionSignal?.addEventListener("abort", abortClose, { once: true });
  modal.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('[data-action="settings"]') && settings && settingsButton) {
      event.preventDefault();
      event.stopPropagation();
      const opening = settings.hidden;
      setTweetPngSettingsOpen(settings, settingsButton, opening);
      if (opening) settings.querySelector("button, input")?.focus();
      return;
    }
    if (target === modal || target?.closest('[data-action="close"]')) close();
  }, true);
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (settings && settingsButton && !settings.hidden) {
        setTweetPngSettingsOpen(settings, settingsButton, false);
        settingsButton.focus();
        return;
      }
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(modal.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')).filter((element) => element.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });
  modal.querySelector('[data-action="copy"]')?.addEventListener("click", () => {
    void copyTweetPng(currentBlob).then(() => setStatus("PNG copied.")).catch((error) => setStatus(errorMessage(error)));
  });
  modal.querySelector('[data-action="download"]')?.addEventListener("click", () => {
    downloadBlob(currentBlob, tweetPngFileName(currentData));
    setStatus("PNG downloaded.");
  });
  const setRemiNetConnected = (connected) => {
    if (disconnectedControls) disconnectedControls.hidden = connected;
    if (shareToRemiNetButton) shareToRemiNetButton.hidden = !connected;
  };
  const probeRemiNetConnection = async () => {
    const context = actionContext;
    if (!context) throw new Error("RemiNet connection check is unavailable.");
    const { connected } = await context.probeRemiNetConnection();
    setRemiNetConnected(connected);
    return connected;
  };
  modal.querySelector('[data-action="reconnect"]')?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    const context = actionContext;
    if (!context) {
      setStatus("RemiNet reconnect is unavailable.");
      return;
    }
    button.disabled = true;
    setStatus("Opening RemiliaNET in a background tab...");
    void context.openRemiNetSession().then((result2) => {
      if (!result2.ok) throw new Error(result2.error || "RemiliaNET could not be opened.");
      setStatus("RemiliaNET opened in a background tab. Sign in there, then select Refresh.");
    }).catch((error) => setStatus(errorMessage(error))).finally(() => {
      if (button.isConnected) button.disabled = false;
    });
  });
  modal.querySelector('[data-action="refresh"]')?.addEventListener("click", (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    setStatus("Checking RemiNet connection...");
    void probeRemiNetConnection().then((connected) => setStatus(connected ? "RemiNet connection is live." : "RemiNet connection is unavailable. Use Reconnect, then try Refresh again.")).catch((error) => setStatus(errorMessage(error))).finally(() => {
      if (button.isConnected) button.disabled = false;
    });
  });
  shareToRemiNetButton?.addEventListener("click", () => {
    const context = actionContext;
    if (!context) {
      setStatus("RemiNet Chat staging is unavailable.");
      return;
    }
    shareToRemiNetButton.disabled = true;
    setStatus("Staging PNG in RemiNet Chat...");
    void context.stageRemiNetChatPng({
      blob: currentBlob,
      fileName: tweetPngFileName(currentData)
    }).then((result2) => {
      if (!result2.ok) throw new Error(result2.error || "PNG could not be staged.");
      close(false);
    }).catch((error) => {
      setStatus(errorMessage(error));
      if (shareToRemiNetButton.isConnected) shareToRemiNetButton.disabled = false;
    });
  });
  const updatePreview = async (successMessage = "Preview updated.") => {
    const version = ++renderVersion;
    setStatus("Updating preview...");
    await saveVisualTheme();
    const nextData = withoutExcludedTweetPngMedia(extractTweetPngData(tweet, statusUrl), excludedMedia);
    const nextResult = await renderTweetPng(nextData);
    if (version !== renderVersion || !modal.isConnected) return;
    const nextUrl = URL.createObjectURL(nextResult.blob);
    URL.revokeObjectURL(url);
    url = nextUrl;
    currentBlob = nextResult.blob;
    currentData = nextData;
    currentResult = nextResult;
    if (preview) preview.src = nextUrl;
    renderMediaControls(nextData, nextResult);
    setStatus(successMessage);
  };
  mediaControls?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-remove-media]") : null;
    const key = target?.dataset.removeMedia;
    if (!key) return;
    excludedMedia.add(key);
    void updatePreview("Image removed from this PNG.").catch((error) => setStatus(errorMessage(error)));
  });
  const schedulePreviewUpdate = () => {
    if (previewUpdateTimer !== null) window.clearTimeout(previewUpdateTimer);
    previewUpdateTimer = window.setTimeout(() => {
      previewUpdateTimer = null;
      void updatePreview().catch((error) => setStatus(errorMessage(error)));
    }, 75);
  };
  for (const input of Array.from(modal.querySelectorAll("[data-setting]"))) {
    input.addEventListener(input.type === "color" ? "input" : "change", () => {
      const key = input.dataset.setting;
      if (input.type === "checkbox") visualTheme[key] = input.checked;
      else if (input.type === "color") visualTheme[key] = normalizeColor(input.value, String(visualTheme[key]));
      if (input.type === "color") schedulePreviewUpdate();
      else void updatePreview().catch((error) => setStatus(errorMessage(error)));
    });
  }
  const presets = {
    paper: { background: "#fffaff", font: "#20122f" },
    lavender: { background: "#f3e8ff", font: "#281447" },
    night: { background: "#15202b", font: "#f7f9f9" },
    contrast: { background: "#000000", font: "#ffffff" }
  };
  for (const button of Array.from(modal.querySelectorAll("[data-preset]"))) {
    button.addEventListener("click", () => {
      const preset = presets[button.dataset.preset || ""];
      if (!preset) return;
      visualTheme.tweetPngBackgroundColor = preset.background;
      visualTheme.tweetPngFontColor = preset.font;
      const background = modal.querySelector('[data-setting="tweetPngBackgroundColor"]');
      const font = modal.querySelector('[data-setting="tweetPngFontColor"]');
      if (background) background.value = preset.background;
      if (font) font.value = preset.font;
      void updatePreview().catch((error) => setStatus(errorMessage(error)));
    });
  }
  renderMediaControls(currentData, currentResult);
  document.body.appendChild(modal);
  void probeRemiNetConnection().catch(() => setRemiNetConnected(false));
  modal.querySelector('[data-action="copy"]')?.focus();
}
async function saveVisualTheme() {
  if (!actionContext) return;
  const stored = await actionContext.storage.local.get({ [VISUAL_THEME_KEY]: {} });
  const existing = stored[VISUAL_THEME_KEY] && typeof stored[VISUAL_THEME_KEY] === "object" ? stored[VISUAL_THEME_KEY] : {};
  await actionContext.storage.local.set({ [VISUAL_THEME_KEY]: { ...existing, ...visualTheme } });
}
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error || "Share Kit action failed.");
}
async function copyTweetPng(blob) {
  if (!navigator.clipboard || typeof ClipboardItem === "undefined") {
    throw new Error("Image clipboard is unavailable in this browser. Use Download instead.");
  }
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1e3);
}
function tweetPngFileName(data) {
  const handle = data.handle.replace(/^@/, "") || "tweet";
  return `milxdy-${handle}-${Date.now()}.png`;
}
function injectTweetPngStyles() {
  if (document.getElementById("milxdy-tweet-png-styles")) return;
  const style = document.createElement("style");
  style.id = "milxdy-tweet-png-styles";
  style.textContent = `
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
      max-width: min(920px, calc(100vw - 48px));
      width: min(920px, calc(100vw - 48px));
      overflow: auto;
      padding: 14px;
    }
    .milxdy-tweet-png-toolbar {
      align-items: center;
      display: flex;
      gap: 8px;
      justify-content: space-between;
    }
    .milxdy-tweet-png-toolbar strong {
      font: 700 18px/1.2 TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .milxdy-tweet-png-actions {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }
    .milxdy-tweet-png-reminet-disconnected {
      display: contents;
    }
    .milxdy-tweet-png-actions [hidden] {
      display: none !important;
    }
    .milxdy-tweet-png-preview-stage {
      line-height: 0;
      position: relative;
    }
    .milxdy-tweet-png-media-controls {
      inset: 0;
      pointer-events: none;
      position: absolute;
    }
    .milxdy-tweet-png-dialog .milxdy-tweet-png-remove-media {
      background: rgba(32, 18, 47, 0.86);
      border-color: rgba(255, 255, 255, 0.9);
      border-radius: 999px;
      color: #ffffff;
      font: 700 19px/1 Arial, sans-serif;
      height: 26px;
      min-height: 26px;
      padding: 0;
      pointer-events: auto;
      position: absolute;
      transform: translate(calc(-100% - 6px), 6px);
      width: 26px;
      z-index: 1;
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
    .milxdy-tweet-png-dialog button,
    .milxdy-tweet-png-action-link {
      align-items: center;
      border: 1px solid #b67cff;
      border-radius: 6px;
      background: #ead8ff;
      color: #281447;
      cursor: pointer;
      display: inline-flex;
      font: 700 12px/1 TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      justify-content: center;
      min-height: 30px;
      padding: 0 10px;
      text-decoration: none;
    }
    .milxdy-tweet-png-dialog button:focus-visible,
    .milxdy-tweet-png-action-link:focus-visible,
    .milxdy-tweet-png-dialog input:focus-visible {
      outline: 2px solid #7b2cff;
      outline-offset: 2px;
    }
    .milxdy-tweet-png-dialog button:disabled {
      background: #ece8ef;
      border-color: #c8c1cf;
      color: #8b8492;
      cursor: not-allowed;
      opacity: 0.72;
    }
    .milxdy-tweet-png-settings {
      align-items: center;
      background: #f6efff;
      border: 1px solid #d7b8ff;
      border-radius: 6px;
      display: grid;
      gap: 10px 16px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      padding: 12px;
    }
    .milxdy-tweet-png-settings[hidden] {
      display: none;
    }
    .milxdy-tweet-png-settings label,
    .milxdy-tweet-png-presets {
      align-items: center;
      display: flex;
      flex-wrap: wrap;
      font: 600 13px/1.3 TwitterChirp, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      gap: 8px;
    }
    .milxdy-tweet-png-presets,
    .milxdy-tweet-png-settings p {
      grid-column: 1 / -1;
    }
    .milxdy-tweet-png-settings input[type="color"] {
      border: 0;
      height: 30px;
      padding: 0;
      width: 42px;
    }
    .milxdy-tweet-png-status:empty {
      display: none;
    }
    @media (max-width: 680px) {
      #milxdy-tweet-png-modal { padding: 8px; }
      .milxdy-tweet-png-dialog {
        max-height: calc(100vh - 16px);
        max-width: calc(100vw - 16px);
        width: calc(100vw - 16px);
      }
      .milxdy-tweet-png-toolbar { align-items: flex-start; }
      .milxdy-tweet-png-actions { justify-content: flex-start; }
      .milxdy-tweet-png-settings { grid-template-columns: 1fr; }
    }
  `;
  document.documentElement.appendChild(style);
}
export {
  TWEET_PNG_QUOTE_BORDER_WIDTH,
  copyTweetPngFromTweet,
  disable,
  extractTweetPngCashtag,
  extractTweetPngLinkCard,
  extractTweetPngMedia,
  findTweetPngQuoteElement,
  id,
  measureTweetPngQuoteHeight,
  normalizeVisualTheme,
  onContextualPostAction,
  onRouteChange,
  openTweetPngReviewFromTweet,
  setTweetPngSettingsOpen,
  shouldCloseTweetPngReview,
  tweetPngLinkCardLabels,
  tweetPngMediaRemovalKey,
  tweetPngPalette,
  tweetPngVisibleLineCount,
  tweetPngWatermarkColor
};
