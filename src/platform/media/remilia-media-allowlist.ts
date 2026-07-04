const REMILIA_MEDIA_HOSTS = new Set([
  "www.remilia.net",
  "pfp.remilia.net",
]);

export function isRemiliaMediaUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && REMILIA_MEDIA_HOSTS.has(url.hostname.toLowerCase());
  } catch {
    return false;
  }
}

export function absoluteRemiliaMediaUrl(value: string): string {
  try {
    const url = new URL(value, "https://www.remilia.net");
    return isRemiliaMediaUrl(url.href) ? url.href : "";
  } catch {
    return "";
  }
}
