export function normalizeProfileImageUrl(source: string): string {
  const url = new URL(source);
  url.search = "";
  url.pathname = url.pathname.replace(
    /_(normal|bigger|mini|reasonably_small|(?:\d+x\d+)|(?:x\d+))(\.[a-z0-9]+)$/i,
    "_400x400$2",
  );
  return url.toString();
}
