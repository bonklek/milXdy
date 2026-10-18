const quoteSelector = '[data-testid="quoteTweet"], div[role="link"][tabindex="0"]';

/** X also renders quotes as keyboard-focusable cards without a quote test id. */
export function quotedTweetRoot(node: Element): Element | null {
  let root = node.closest(quoteSelector);
  while (root) {
    if (root.matches('[data-testid="quoteTweet"]') || root.querySelector('[data-testid="User-Name"]')) return root;
    root = root.parentElement?.closest(quoteSelector) ?? null;
  }
  return null;
}

export function tweetOwnsNode(surface: Element, node: Element | null | undefined): boolean {
  if (!node || !surface.contains(node)) return false;
  const ownerTweet = node.closest('[data-testid="tweet"]');
  if (ownerTweet && ownerTweet !== surface && surface.contains(ownerTweet)) return false;
  const quote = quotedTweetRoot(node);
  return !(quote && quote !== surface && surface.contains(quote));
}

export function ownedTweetHeader(surface: Element): HTMLElement | null {
  return [...surface.querySelectorAll<HTMLElement>('[data-testid="User-Name"]')]
    .find(node => tweetOwnsNode(surface, node)) ?? null;
}

export function tweetBadgeAnchor(surface: Element): HTMLElement | null {
  const header = ownedTweetHeader(surface);
  if (!header) return null;
  const time = [...header.querySelectorAll<HTMLElement>('time')].find(node => tweetOwnsNode(surface, node));
  // React can replace the timestamp's nested wrapper after a Like update.
  // Keep the extension slot in the header's direct metadata row instead.
  const metadata = time ? [...header.children].find(child => child.tagName === 'DIV' && child.contains(time)) : null;
  const metadataAnchor = metadata ? [...metadata.children].find(child => child.contains(time!)) : null;
  if (metadataAnchor) return metadataAnchor as HTMLElement;
  const timeLink = time?.closest<HTMLElement>('a');
  if (time) return timeLink && header.contains(timeLink) ? timeLink : time;
  // Keep the native reading order name → handle → metrics. The browser wraps
  // these complete groups according to their actual font and available width.
  const detailMetadata = [...header.children].find(child => child.matches('[data-milxdy-metadata-row]'));
  if (detailMetadata) return detailMetadata as HTMLElement;
  let nameAnchor = [...header.querySelectorAll<HTMLElement>('a[href]')].find(node => tweetOwnsNode(surface, node)
    && Boolean(node.textContent?.trim()) && !node.textContent?.trim().startsWith('@') && !node.querySelector('time'));
  while (nameAnchor?.parentElement && nameAnchor.parentElement !== header) nameAnchor = nameAnchor.parentElement;
  return nameAnchor ?? header;
}

export function quotedTweetHandle(surface: Element): string {
  const header = ownedTweetHeader(surface);
  if (!header) return "";
  for (const node of header.querySelectorAll('[dir="ltr"], span')) {
    if (!tweetOwnsNode(surface, node)) continue;
    const text = node.textContent?.trim() ?? "";
    if (/^@[a-z0-9_]{1,15}$/i.test(text)) return text.slice(1).toLowerCase();
  }
  return "";
}

export function badgeMatchesTweetAuthor(badgeHandle: string, authorHandle: string): boolean {
  return Boolean(authorHandle) && badgeHandle.replace(/^@/, "").toLowerCase() === authorHandle.replace(/^@/, "").toLowerCase();
}
