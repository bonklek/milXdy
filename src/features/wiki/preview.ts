import type { PreviewData, Settings } from "./types";

const API = "https://wiki.remilia.org/api.php";
const CACHE_PREFIX = "remiliaWikiHyperlink.preview.";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 14;
const HOVER_DELAY_MS = 250;

let activeCard: HTMLElement | null = null;
let activeLink: HTMLAnchorElement | null = null;
let hoverTimer: number | null = null;

export function attachPreviewHandlers(link: HTMLAnchorElement, settingsProvider: () => Settings): void {
  link.addEventListener("mouseenter", () => schedulePreview(link, settingsProvider));
  link.addEventListener("focus", () => schedulePreview(link, settingsProvider));
  link.addEventListener("mouseleave", hidePreviewSoon);
  link.addEventListener("blur", hidePreview);
}

export function installPreviewDismissHandlers(): void {
  window.addEventListener("scroll", hidePreview, { passive: true });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") hidePreview();
  });
}

function schedulePreview(link: HTMLAnchorElement, settingsProvider: () => Settings): void {
  if (!settingsProvider().previewsEnabled) return;
  if (hoverTimer !== null) window.clearTimeout(hoverTimer);
  activeLink = link;
  hoverTimer = window.setTimeout(() => {
    hoverTimer = null;
    void showPreview(link);
  }, HOVER_DELAY_MS);
}

function hidePreviewSoon(): void {
  if (hoverTimer !== null) {
    window.clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  window.setTimeout(() => {
    if (!activeCard?.matches(":hover")) hidePreview();
  }, 120);
}

function hidePreview(): void {
  if (hoverTimer !== null) {
    window.clearTimeout(hoverTimer);
    hoverTimer = null;
  }
  activeCard?.remove();
  activeCard = null;
  activeLink = null;
}

async function showPreview(link: HTMLAnchorElement): Promise<void> {
  const title = link.dataset.wikiTitle;
  if (!title || activeLink !== link) return;

  const data = await getPreview(title, link.href);
  if (activeLink !== link) return;

  activeCard?.remove();
  activeCard = renderPreview(data);
  document.body.appendChild(activeCard);
  positionPreview(activeCard, link);
}

async function getPreview(title: string, fallbackUrl: string): Promise<PreviewData> {
  const cacheKey = `${CACHE_PREFIX}${fallbackUrl}`;
  const cached = await chrome.storage.local.get(cacheKey);
  const value = cached[cacheKey] as PreviewData | undefined;
  if (value && Date.now() - value.cachedAt < CACHE_TTL_MS) return value;

  const fragment = extractFragment(fallbackUrl);
  if (fragment) {
    const sectionPreview = await getSectionPreview(title, fallbackUrl, fragment);
    if (sectionPreview) {
      await chrome.storage.local.set({ [cacheKey]: sectionPreview });
      return sectionPreview;
    }
  }

  const url = new URL(API);
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("prop", "extracts|pageimages|info");
  url.searchParams.set("inprop", "url");
  url.searchParams.set("exintro", "1");
  url.searchParams.set("explaintext", "1");
  url.searchParams.set("exchars", "420");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "640");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("titles", title);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Preview fetch failed: ${response.status}`);
    const data = await response.json() as MediaWikiPreviewResponse;
    const page = Object.values(data.query?.pages ?? {})[0];
    const preview: PreviewData = {
      title: page?.title || title,
      extract: cleanExtract(page?.extract) || "Open this Remilia Wiki article for more context.",
      url: page?.fullurl || fallbackUrl,
      thumbnail: page?.thumbnail?.source,
      cachedAt: Date.now(),
    };
    await chrome.storage.local.set({ [cacheKey]: preview });
    return preview;
  } catch {
    return {
      title,
      extract: "Open this Remilia Wiki article for more context.",
      url: fallbackUrl,
      cachedAt: Date.now(),
    };
  }
}

async function getSectionPreview(title: string, fallbackUrl: string, fragment: string): Promise<PreviewData | null> {
  try {
    const sectionsUrl = new URL(API);
    sectionsUrl.searchParams.set("action", "parse");
    sectionsUrl.searchParams.set("format", "json");
    sectionsUrl.searchParams.set("origin", "*");
    sectionsUrl.searchParams.set("page", title);
    sectionsUrl.searchParams.set("prop", "sections");
    sectionsUrl.searchParams.set("redirects", "1");
    const sectionsResponse = await fetch(sectionsUrl);
    if (!sectionsResponse.ok) return null;
    const sectionsData = await sectionsResponse.json() as MediaWikiSectionsResponse;
    const decodedFragment = decodeURIComponent(fragment).replace(/\s+/g, "_");
    const section = sectionsData.parse?.sections?.find((item) => item.anchor === decodedFragment);
    if (!section) return null;

    const textUrl = new URL(API);
    textUrl.searchParams.set("action", "parse");
    textUrl.searchParams.set("format", "json");
    textUrl.searchParams.set("origin", "*");
    textUrl.searchParams.set("page", title);
    textUrl.searchParams.set("prop", "text");
    textUrl.searchParams.set("section", section.index);
    textUrl.searchParams.set("redirects", "1");
    const textResponse = await fetch(textUrl);
    if (!textResponse.ok) return null;
    const textData = await textResponse.json() as MediaWikiSectionTextResponse;
    const extract = htmlToText(textData.parse?.text?.["*"] || "");
    if (!extract) return null;
    return {
      title: `${title}: ${section.line}`,
      extract,
      url: fallbackUrl,
      cachedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

function renderPreview(data: PreviewData): HTMLElement {
  const card = document.createElement("aside");
  card.className = "remilia-wiki-preview";
  card.dataset.theme = isDarkTheme() ? "dark" : "light";
  card.setAttribute("role", "tooltip");

  if (data.thumbnail) {
    const image = document.createElement("img");
    image.className = "remilia-wiki-preview__image";
    image.src = data.thumbnail;
    image.alt = "";
    card.appendChild(image);
  }

  const body = document.createElement("div");
  body.className = "remilia-wiki-preview__body";

  const title = document.createElement("h2");
  title.className = "remilia-wiki-preview__title";
  title.textContent = data.title;
  body.appendChild(title);

  const extract = document.createElement("p");
  extract.className = "remilia-wiki-preview__extract";
  extract.textContent = data.extract;
  body.appendChild(extract);

  const footer = document.createElement("a");
  footer.className = "remilia-wiki-preview__footer";
  footer.href = data.url;
  footer.target = "_blank";
  footer.rel = "noopener noreferrer";
  footer.textContent = "Read on Remilia Wiki";
  body.appendChild(footer);

  card.addEventListener("mouseleave", hidePreview);
  card.appendChild(body);
  return card;
}

function positionPreview(card: HTMLElement, link: HTMLElement): void {
  const rect = link.getBoundingClientRect();
  const margin = 10;
  const cardRect = card.getBoundingClientRect();
  const below = rect.bottom + margin + cardRect.height <= window.innerHeight;
  let top = below ? rect.bottom + margin : rect.top - margin - cardRect.height;
  let left = rect.left;

  top = Math.max(margin, Math.min(top, window.innerHeight - cardRect.height - margin));
  left = Math.max(margin, Math.min(left, window.innerWidth - cardRect.width - margin));

  card.style.top = `${Math.round(top)}px`;
  card.style.left = `${Math.round(left)}px`;
}

function cleanExtract(value: string | undefined): string {
  return (value || "").replace(/\s+/g, " ").trim();
}

function extractFragment(value: string): string | null {
  try {
    return new URL(value).hash.slice(1) || null;
  } catch {
    return null;
  }
}

function htmlToText(html: string): string {
  const element = document.createElement("div");
  element.innerHTML = html;
  for (const removable of Array.from(element.querySelectorAll("style, script, sup.reference, .mw-editsection"))) {
    removable.remove();
  }
  return cleanExtract(element.textContent || "").slice(0, 520);
}

function isDarkTheme(): boolean {
  const bodyColor = getComputedStyle(document.body).backgroundColor;
  const match = bodyColor.match(/\d+/g)?.map(Number);
  if (!match || match.length < 3) return window.matchMedia("(prefers-color-scheme: dark)").matches;
  const [r, g, b] = match;
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}

type MediaWikiPreviewResponse = {
  query?: {
    pages?: Record<string, {
      title?: string;
      extract?: string;
      fullurl?: string;
      thumbnail?: {
        source?: string;
      };
    }>;
  };
};

type MediaWikiSectionsResponse = {
  parse?: {
    sections?: Array<{
      index: string;
      line: string;
      anchor: string;
    }>;
  };
};

type MediaWikiSectionTextResponse = {
  parse?: {
    text?: {
      "*": string;
    };
  };
};
