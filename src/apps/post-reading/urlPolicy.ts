const X_STATUS_HOSTS = new Set(["x.com", "twitter.com"]);

export function normalizeXStatusUrl(value: string, baseUrl = "https://x.com/"): string | null {
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol !== "https:") return null;
    if (!X_STATUS_HOSTS.has(url.hostname)) return null;
    if (!/^\/[^/?#]+\/status\/\d+\/?$/.test(url.pathname)) return null;
    if (url.hostname === "twitter.com") url.hostname = "x.com";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

export function isAllowedXStatusUrl(value: string, baseUrl = "https://x.com/"): boolean {
  return normalizeXStatusUrl(value, baseUrl) !== null;
}

export function findXStatusHrefInText(value: string, baseUrl = "https://x.com/"): string | null {
  const absoluteUrls = value.match(/https?:\/\/[^\s"'<>]+/gi) || [];
  for (const candidate of absoluteUrls) {
    if (/\/status\/\d+/i.test(candidate) && normalizeXStatusUrl(candidate, baseUrl)) return candidate;
  }

  const relativeSearchText = value.replace(/https?:\/\/[^\s"'<>]+/gi, " ");
  const relative = relativeSearchText.match(/(?:^|[\s"'(])((?!\/\/)\/[^/\s"'<>]+\/status\/\d+)/)?.[1];
  if (relative) return relative;
  return null;
}

export function isAllowedPublishTwitterOembedUrl(url: URL): boolean {
  if (url.protocol !== "https:") return false;
  if (url.hostname !== "publish.twitter.com") return false;
  if (url.pathname !== "/oembed") return false;
  const embeddedUrl = url.searchParams.get("url");
  if (typeof embeddedUrl !== "string") return false;
  try {
    return isAllowedXStatusUrl(new URL(embeddedUrl).toString());
  } catch {
    return false;
  }
}
