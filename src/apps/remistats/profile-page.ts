const X_ORIGINS = new Set(["https://x.com", "https://twitter.com"]);

export function exactXProfileHandle(value: unknown): string {
  if (typeof value !== "string") return "";
  const candidate = value.trim().replace(/^@/, "");
  return /^[A-Za-z0-9_]{1,15}$/.test(candidate) ? candidate.toLowerCase() : "";
}

export function headerPhotoXHandle(href: unknown): string {
  if (typeof href !== "string" || !href.trim()) return "";
  let url: URL;
  try {
    url = new URL(href, "https://x.com");
  } catch {
    return "";
  }
  if (!X_ORIGINS.has(url.origin)) return "";
  const segments = url.pathname.split("/").filter(Boolean);
  if (segments.length !== 2 || segments[1] !== "header_photo") return "";
  try {
    return exactXProfileHandle(decodeURIComponent(segments[0]));
  } catch {
    return "";
  }
}

export function findExactProfileBannerRoot(root: ParentNode, xHandleInput: unknown): HTMLElement | null {
  const xHandle = exactXProfileHandle(xHandleInput);
  if (!xHandle) return null;
  const primaryColumn = root.querySelector('[data-testid="primaryColumn"]');
  if (!primaryColumn) return null;

  for (const anchor of primaryColumn.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    if (headerPhotoXHandle(anchor.getAttribute("href")) === xHandle) return anchor;
  }
  return null;
}
