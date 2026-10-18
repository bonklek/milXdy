export function normalizeWikiUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value, "https://wiki.remilia.org/");
    if (url.protocol !== "https:" || !["remilia.wiki", "wiki.remilia.org"].includes(url.hostname)) return null;
    if (url.hostname === "remilia.wiki") url.hostname = "wiki.remilia.org";
    url.searchParams.delete("mobileaction");
    url.searchParams.delete("useskin");
    url.username = "";
    url.password = "";
    return url.toString();
  } catch {
    return null;
  }
}
