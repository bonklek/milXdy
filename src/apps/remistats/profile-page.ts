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

export function profileBadgeIdentity(userNameSection: Element, pathname: string, blockedRoutes: ReadonlySet<string>, cleanExactXHandle: (value: string) => string, cleanUsername: (value: string) => string) {
  // Extract username from URL or from the handle in the profile before
  // deciding whether an existing badge is still valid. X reuses header DOM
  // during SPA navigation, so stale profile badges can remain attached.
  let username = null;
  let exactProfileXHandle = '';

  const urlMatch = pathname.match(/^\/([^\/\?]+)/);
  if (urlMatch && urlMatch[1] && !blockedRoutes.has(urlMatch[1])) {
    exactProfileXHandle = cleanExactXHandle(urlMatch[1]);
    username = exactProfileXHandle;
  }

  if (!username) {
    const handleElement = userNameSection.querySelector('[href^="/"]');
    if (handleElement) {
      const href = handleElement.getAttribute('href')!;
      const match = href.match(/^\/([^\/\?]+)/);
      if (match && !blockedRoutes.has(match[1])) {
        username = cleanUsername(match[1]);
      }
    }
  }

  return { username, exactProfileXHandle };
}
