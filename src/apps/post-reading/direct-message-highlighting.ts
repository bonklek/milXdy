import { postReadingPerformancePolicy } from "./performance-policy";

/** Private-message highlighting paints native ranges and never rewrites host-owned DOM. */
const HIGHLIGHT_NAME = 'milxdy-private-message-word';
const MAX_HIGHLIGHT_CHARACTERS = 9000;
type Point = { node: Text; offset: number };
type Character = { value: string; start: Point; end: Point };

function visibleCharacters(body: HTMLElement): Character[] {
  const characters: Character[] = [];
  const visibility = new WeakMap<HTMLElement, boolean>();
  const visible = (element: HTMLElement | null): boolean => {
    if (!element) return true;
    const cached = visibility.get(element);
    if (cached !== undefined) return cached;
    const style = getComputedStyle(element);
    const parent = element.parentElement || (element.getRootNode() instanceof ShadowRoot ? (element.getRootNode() as ShadowRoot).host as HTMLElement : null);
    const value = !element.hidden && element.getAttribute('aria-hidden') !== 'true'
      && style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && visible(parent);
    visibility.set(element, value);
    return value;
  };
  const walker = body.ownerDocument.createTreeWalker(body, NodeFilter.SHOW_TEXT);
  let pendingSpace: Character | null = null;
  for (let current = walker.nextNode(); current; current = walker.nextNode()) {
    const node = current as Text;
    if (!visible(node.parentElement)) continue;
    for (let offset = 0; offset < node.data.length; offset++) {
      const next = { value: node.data[offset]!, start: { node, offset }, end: { node, offset: offset + 1 } };
      if (/\s/u.test(next.value)) {
        if (characters.length) pendingSpace = pendingSpace ? { value: ' ', start: (pendingSpace as Character).start, end: next.end } : { ...next, value: ' ' };
        continue;
      }
      if (pendingSpace) { characters.push(pendingSpace); pendingSpace = null; }
      characters.push(next);
    }
  }
  return characters;
}

export function createConversationHighlight() {
  const styles = new Map<Document | ShadowRoot, HTMLStyleElement>();
  const clear = () => {
    globalThis.CSS?.highlights?.delete(HIGHLIGHT_NAME);
    for (const style of styles.values()) style.remove();
    styles.clear();
  };
  return {
    clear,
    paint(body: HTMLElement, reviewedText: string, relativeIndex: number): boolean {
      const characterLimit = Math.min(MAX_HIGHLIGHT_CHARACTERS, postReadingPerformancePolicy().maxHighlightChars);
      if (reviewedText.length > characterLimit || (body.textContent?.length || 0) > characterLimit * 4 || !body.isConnected || typeof Highlight === 'undefined' || typeof CSS === 'undefined' || !CSS.highlights) { clear(); return false; }
      const characters = visibleCharacters(body);
      const normalized = characters.map(character => character.value).join('');
      // React can recycle the same body element. Never paint or restore stale content.
      if (normalized !== reviewedText) { clear(); return false; }
      const words = Array.from(normalized.matchAll(/\S+/gu));
      const word = words.find(match => relativeIndex >= match.index! && relativeIndex < match.index! + match[0].length)
        || words.find(match => match.index! >= relativeIndex);
      if (!word) { clear(); return false; }
      const start = characters[word.index!]!.start;
      const end = characters[word.index! + word[0].length - 1]!.end;
      const range = body.ownerDocument.createRange();
      range.setStart(start.node, start.offset);
      range.setEnd(end.node, end.offset);
      const root = body.getRootNode() as Document | ShadowRoot;
      if (!styles.get(root)?.isConnected) {
        const style = body.ownerDocument.createElement('style');
        style.dataset.postReadingConversationHighlight = 'true';
        style.textContent = `::highlight(${HIGHLIGHT_NAME}) { background-color: #ffe07a; color: #111; }`;
        (root instanceof ShadowRoot ? root : root.head).append(style);
        styles.set(root, style);
      }
      CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));
      return true;
    },
  };
}
