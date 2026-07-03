import type { MilxdyContentAppContext, MilxdyRouteChange } from "../../shared/appPlatform";

const ROOT_ID = "milxdy-wikipedia-reader-button";
const STYLE_ID = "milxdy-wikipedia-reader-style";
const WIKIPEDIA_HOST_RE = /(^|\.)wikipedia\.org$/i;

let booted = false;
let lifecycleSignal: AbortSignal | null = null;
let loadAppById: MilxdyContentAppContext["loadAppById"] = async () => null;
let addRuntimeDisposable: MilxdyContentAppContext["addDisposable"] = () => undefined;

export function boot(context?: MilxdyContentAppContext): void {
  if (booted) return;
  booted = true;
  lifecycleSignal = context?.signal || null;
  loadAppById = context?.loadAppById || loadAppById;
  addRuntimeDisposable = context?.addDisposable || (() => undefined);
  injectStyles();
  renderForCurrentPage();
}

export function onRouteChange(_route: MilxdyRouteChange): void {
  renderForCurrentPage();
}

export function disable(): void {
  document.getElementById(ROOT_ID)?.remove();
}

export function dispose(): void {
  disable();
  lifecycleSignal = null;
  loadAppById = async () => null;
  addRuntimeDisposable = () => undefined;
  booted = false;
}

function lifecycleActive(): boolean {
  return booted && lifecycleSignal?.aborted !== true;
}

function renderForCurrentPage(): void {
  if (!lifecycleActive() || !isWikipediaPage()) {
    disable();
    return;
  }
  if (document.getElementById(ROOT_ID)) return;
  const button = document.createElement("button");
  button.id = ROOT_ID;
  button.type = "button";
  button.title = "Read this Wikipedia page";
  button.setAttribute("aria-label", "Read this Wikipedia page");
  button.textContent = "Read page";
  button.addEventListener("click", () => void readCurrentArticle());
  addRuntimeDisposable(() => button.remove());
  document.documentElement.appendChild(button);
}

async function readCurrentArticle(): Promise<void> {
  const article = extractWikipediaArticle();
  if (!article || !lifecycleActive()) return;
  await loadAppById("post-reading", "wikipediaRead");
  document.dispatchEvent(new CustomEvent("post-reading:read-document", {
    detail: article,
  }));
}

function extractWikipediaArticle(): { id: string; title: string; text: string; source: "wikipedia" } | null {
  const root = document.querySelector<HTMLElement>("main, #content, .mw-body, article") || document.body;
  const title = cleanText(
    document.querySelector<HTMLElement>("#firstHeading, h1")?.innerText
      || document.title.replace(/\s+-\s+Wikipedia\s*$/i, ""),
  ) || "Wikipedia";
  const parts: string[] = [];
  const candidates = Array.from(root.querySelectorAll<HTMLElement>("p, section > h2, section > h3, .mw-heading2, .mw-heading3, li"));
  for (const element of candidates) {
    if (!isReadableArticleElement(element)) continue;
    const text = cleanText(element.innerText || element.textContent || "");
    if (text) parts.push(text);
  }
  const text = parts.join("\n\n").trim();
  if (!text) return null;
  return {
    id: `wikipedia:${location.hostname}:${location.pathname}`,
    title,
    text,
    source: "wikipedia",
  };
}

function isReadableArticleElement(element: HTMLElement): boolean {
  if (element.closest("nav, header, footer, aside, table, figure, style, script, .navbox, .infobox, .metadata, .reference, .reflist, .mw-editsection, .ambox, .toc")) return false;
  if (element.matches(".reference, .mw-empty-elt")) return false;
  const text = cleanText(element.innerText || element.textContent || "");
  if (text.length < 24 && !/^h[2-3]$/i.test(element.tagName)) return false;
  if (/^(references|external links|see also|notes|further reading)$/i.test(text)) return false;
  return true;
}

function isWikipediaPage(): boolean {
  return WIKIPEDIA_HOST_RE.test(location.hostname)
    && location.protocol === "https:"
    && !location.pathname.startsWith("/wiki/Special:");
}

function cleanText(value: string): string {
  return value
    .replace(/\[[^\]]{1,8}\]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 2147483000;
      box-sizing: border-box;
      border: 1px solid rgba(32, 35, 54, 0.22);
      border-radius: 8px;
      background: #ffffff;
      color: #202336;
      box-shadow: 0 12px 28px rgba(15, 23, 42, 0.2);
      font: 700 13px/1.1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 10px 12px;
      cursor: pointer;
    }
    #${ROOT_ID}:hover {
      background: #f5f7fb;
    }
  `;
  document.documentElement.appendChild(style);
}
