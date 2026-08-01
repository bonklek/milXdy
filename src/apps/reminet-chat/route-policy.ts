const RESERVED_PROFILE_ROUTES = new Set([
  "compose",
  "explore",
  "home",
  "i",
  "jobs",
  "messages",
  "notifications",
  "search",
  "settings",
]);

export function canMountRemiNetChatRoute(pathname: string, explicitlyOpened = false): boolean {
  if (explicitlyOpened) return true;
  if (pathname === "/" || pathname === "/home" || pathname === "/notifications") return true;
  if (pathname === "/messages" || pathname.startsWith("/messages/") || pathname.startsWith("/i/chat")) return true;
  if (/^\/[^/]+\/status\/\d+/.test(pathname)) return true;
  const profile = pathname.match(/^\/([^/?#]+)\/?$/)?.[1]?.toLowerCase();
  return Boolean(profile && !RESERVED_PROFILE_ROUTES.has(profile));
}
