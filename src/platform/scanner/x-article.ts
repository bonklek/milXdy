export const X_ARTICLE_ROOT = '[data-testid="twitterArticleReadView"]';
export const X_ARTICLE_TITLE = '[data-testid="twitter-article-title"]';
export const X_ARTICLE_RICH_TEXT = '[data-testid="twitterArticleRichTextView"]';
export const X_ARTICLE_EDITOR = '[data-testid="longformRichTextComponent"]';

const EMBED_TEXT = '[data-testid="tweetText"]';
const CAPTION_TEXT = 'figcaption, [data-testid*="caption" i]';

export function isXArticleRoute(pathname: string): boolean {
  return /^\/i\/article\/\d+(?:\/|$)/.test(pathname)
    || /^\/[^/?#]+\/article\/\d+(?:\/|$)/.test(pathname)
    || /^\/[^/?#]+\/status\/\d+(?:\/|$)/.test(pathname);
}

export function isXArticleSurface(element: HTMLElement, pathname = window.location.pathname): boolean {
  return isXArticleRoute(pathname) && element.matches(X_ARTICLE_ROOT);
}

/**
 * Returns the exact rendered elements whose text belongs to an X Article.
 * The same element list is shared by extraction and highlighting so speech
 * offsets never depend on a broader, independently queried DOM surface.
 */
export function extractXArticleTextContainers(article: HTMLElement): HTMLElement[] {
  if (!article.matches(X_ARTICLE_ROOT)) return [];

  const containers: HTMLElement[] = [];
  const seen = new Set<HTMLElement>();
  const append = (element: HTMLElement | null): void => {
    if (!element || seen.has(element) || !readableText(element)) return;
    seen.add(element);
    containers.push(element);
  };

  append(article.querySelector<HTMLElement>(X_ARTICLE_TITLE));

  const richText = article.querySelector<HTMLElement>(X_ARTICLE_RICH_TEXT);
  const editor = richText?.querySelector<HTMLElement>(X_ARTICLE_EDITOR) || null;
  const blockHost = (editor?.firstElementChild as HTMLElement | null) || editor;
  if (!blockHost) return containers;

  for (const block of Array.from(blockHost.children)) {
    const htmlBlock = block as HTMLElement;
    if (htmlBlock.tagName !== "SECTION") {
      append(htmlBlock);
      continue;
    }

    const nestedEditors = Array.from(htmlBlock.querySelectorAll<HTMLElement>(X_ARTICLE_EDITOR));
    for (const nestedEditor of nestedEditors) appendEditorBlocks(nestedEditor, append);

    for (const embeddedText of Array.from(htmlBlock.querySelectorAll<HTMLElement>(EMBED_TEXT))) {
      const closestEditor = embeddedText.closest<HTMLElement>(X_ARTICLE_EDITOR);
      if (closestEditor && closestEditor !== editor) continue;
      append(embeddedText);
    }

    for (const caption of Array.from(htmlBlock.querySelectorAll<HTMLElement>(CAPTION_TEXT))) {
      const closestEditor = caption.closest<HTMLElement>(X_ARTICLE_EDITOR);
      if ((closestEditor && closestEditor !== editor) || caption.closest(EMBED_TEXT)) continue;
      append(caption);
    }
  }

  return containers;
}

function appendEditorBlocks(editor: HTMLElement, append: (element: HTMLElement | null) => void): void {
  const blockHost = (editor.firstElementChild as HTMLElement | null) || editor;
  for (const block of Array.from(blockHost.children)) {
    append(block as HTMLElement);
  }
}

function readableText(element: HTMLElement): string {
  return (element.innerText || element.textContent || "").replace(/\s+/g, " ").trim();
}
