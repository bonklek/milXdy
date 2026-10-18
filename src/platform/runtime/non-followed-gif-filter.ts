import { safeLocalGet } from "../background/extension-runtime";

export const NON_FOLLOWED_GIF_FILTER_KEY = "milxdy.feed.hideNonFollowedGifs";
const POST = 'article[data-testid="tweet"]';
const MARKER = "data-milxdy-filtered-gif";
let disposeActiveFilter: (() => void) | null = null;

/** Only explicit author follow data is authoritative; missing data never hides. */
export function nonFollowedGifPost(post: HTMLElement): boolean {
  const own = (node: Element) => node.closest(POST) === post && !node.closest('[data-testid="quoteTweet"]');
  const author = Array.from(post.querySelectorAll('[data-testid="User-Name"]')).find(own);
  const signals = [post.getAttribute("data-following"), author?.getAttribute("data-following")]
    .filter((value): value is string => value !== undefined && value !== null);
  // X exposes account-specific follow controls in some feed variants. A generic
  // "Follow" string elsewhere in a post can belong to embedded content.
  for (const control of Array.from(post.querySelectorAll('[data-testid$="-follow"], [data-testid$="-unfollow"]'))) {
    if (!own(control) || !author?.contains(control)) continue;
    signals.push(control.getAttribute("data-testid")!.endsWith("-unfollow") ? "true" : "false");
  }
  if (!signals.length || signals.some((value) => value !== "false")) return false;
  return Array.from(post.querySelectorAll('video, img, [data-testid="videoPlayer"]')).some((media) => {
    if (!own(media)) return false;
    const sources = [media.getAttribute("src"), ...Array.from(media.querySelectorAll("source")).map((source) => source.getAttribute("src"))];
    if (sources.some((src) => src && (/\/tweet_video\//i.test(src) || /\.gif(?:[?#]|$)/i.test(src)))) return true;
    return media.getAttribute("aria-label")?.trim().toUpperCase() === "GIF"
      || Array.from(media.querySelectorAll('[aria-label="GIF"]')).length > 0
      || (media.getAttribute("data-testid") === "videoPlayer" && Array.from(media.querySelectorAll("span")).some((label) => label.textContent?.trim() === "GIF"));
  });
}

export async function setupNonFollowedGifFilter(): Promise<() => void> {
  disposeActiveFilter?.();
  const stored = await safeLocalGet(NON_FOLLOWED_GIF_FILTER_KEY);
  let enabled = stored?.[NON_FOLLOWED_GIF_FILTER_KEY] === true;
  const style = document.createElement("style");
  style.textContent = `article[${MARKER}="true"] { display: none !important; }`;
  document.documentElement.append(style);
  let queued = false;
  const refresh = () => {
    queued = false;
    for (const post of Array.from(document.querySelectorAll<HTMLElement>(POST))) {
      const hide = enabled && nonFollowedGifPost(post);
      if (hide && post.getAttribute(MARKER) !== "true") post.setAttribute(MARKER, "true");
      else if (!hide && post.hasAttribute(MARKER)) post.removeAttribute(MARKER);
    }
  };
  const schedule = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(refresh);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-following", "src", "data-testid", "aria-label"] });
  const changed = (changes: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== "local" || !changes[NON_FOLLOWED_GIF_FILTER_KEY]) return;
    enabled = changes[NON_FOLLOWED_GIF_FILTER_KEY].newValue === true;
    refresh();
  };
  chrome.storage.onChanged.addListener(changed);
  refresh();
  const dispose = () => {
    enabled = false;
    observer.disconnect();
    chrome.storage.onChanged.removeListener(changed);
    refresh();
    style.remove();
    if (disposeActiveFilter === dispose) disposeActiveFilter = null;
  };
  disposeActiveFilter = dispose;
  return dispose;
}
