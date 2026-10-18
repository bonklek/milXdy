/** Mark the innermost wrapper that owns the complete name, including emoji.
 * Truncating that wrapper lets the browser shape the text before ellipsizing it.
 */
export function markDisplayNameText(link: HTMLElement): void {
  link.removeAttribute('data-milxdy-display-name-text');
  for (const previous of link.querySelectorAll('[data-milxdy-display-name-text]')) {
    previous.removeAttribute('data-milxdy-display-name-text');
  }
  const owner = displayNameTextOwner(link);
  owner?.setAttribute('data-milxdy-display-name-text', 'true');
}

export function displayNameTextIsMarked(link: HTMLElement): boolean {
  const owner = displayNameTextOwner(link);
  return Boolean(owner?.getAttribute('data-milxdy-display-name-text') === 'true');
}

function displayNameTextOwner(link: HTMLElement): HTMLElement | null {
  const name = link.textContent?.trim();
  if (!name) return null;
  let owner = link;
  while (true) {
    const children = Array.from(owner.children);
    // Multiple children can be split name runs or an inline emoji image.
    // Keep them together instead of marking just the text-bearing child.
    // X also leaves empty status wrappers beside unverified names. They are
    // not name content; marking their parent would stack them beneath the name.
    // Affiliation badges also contain images. Only inline emoji count as
    // image-only name runs; verification and affiliation remain beside them.
    const emoji = 'img[role="img"][alt]:not([alt=""]), img[src*="/emoji/"]';
    const content = children.filter(child => !child.matches("svg")
      && (child.textContent?.trim() || child.matches(emoji) || child.querySelector(emoji)));
    const child = content.length === 1 ? content[0] : undefined;
    if (!child || child.namespaceURI !== 'http://www.w3.org/1999/xhtml'
      || child.textContent?.trim() !== name) break;
    owner = child as HTMLElement;
  }
  return owner;
}
