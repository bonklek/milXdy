import { describe, expect, it } from "vitest";
import {
  extractXArticleTextContainers,
  isXArticleRoute,
  isXArticleSurface,
  X_ARTICLE_EDITOR,
  X_ARTICLE_RICH_TEXT,
  X_ARTICLE_ROOT,
  X_ARTICLE_TITLE,
} from "./x-article";

describe("X Article route detection", () => {
  it.each([
    "/i/article/123456",
    "/reader_name/article/123456",
    "/reader_name/status/123456",
  ])("accepts an article-bearing route: %s", (pathname) => {
    expect(isXArticleRoute(pathname)).toBe(true);
  });

  it.each([
    "/i/article/not-a-number",
    "/reader_name/articles/123456",
    "/reader_name/status/not-a-number",
    "/home",
  ])("rejects an unrelated route: %s", (pathname) => {
    expect(isXArticleRoute(pathname)).toBe(false);
  });
});

describe("X Article readable DOM contract", () => {
  it("collects title and body leaves once in logical order while excluding controls", () => {
    const title = fixture("div", "Synthetic article title", "twitter-article-title");
    const heading = fixture("div", "Synthetic heading");
    const paragraph = fixture("div", "First synthetic paragraph with a link.");
    const repeatedOne = fixture("div", "Repeated sentence.");
    const repeatedTwo = fixture("div", "Repeated sentence.");

    const caption = fixture("div", "Synthetic image caption.", "media-caption");
    const captionHost = fixture("div", "", undefined, [caption]);
    const captionEditor = fixture("div", "", "longformRichTextComponent", [captionHost]);
    const mediaSection = fixture("section", "Synthetic image caption. Share", undefined, [captionEditor, fixture("button", "Share")]);

    const embedText = fixture("div", "Synthetic embedded post body.", "tweetText");
    const embedSection = fixture("section", "Synthetic embedded post body. Reply Repost Like", undefined, [
      embedText,
      fixture("button", "Reply Repost Like"),
    ]);
    const chromeSection = fixture("section", "Recommendations Follow Subscribe", undefined, [fixture("button", "Follow")]);

    const bodyHost = fixture("div", "", undefined, [
      heading,
      paragraph,
      repeatedOne,
      repeatedTwo,
      mediaSection,
      embedSection,
      chromeSection,
    ]);
    const editor = fixture("div", "", "longformRichTextComponent", [bodyHost]);
    const richText = fixture("div", "", "twitterArticleRichTextView", [editor]);
    const article = fixture("div", "", "twitterArticleReadView", [title, richText]);

    const containers = extractXArticleTextContainers(article as unknown as HTMLElement);

    expect(containers).toEqual([title, heading, paragraph, repeatedOne, repeatedTwo, caption, embedText]);
    expect(containers.map((element) => element.innerText)).toEqual([
      "Synthetic article title",
      "Synthetic heading",
      "First synthetic paragraph with a link.",
      "Repeated sentence.",
      "Repeated sentence.",
      "Synthetic image caption.",
      "Synthetic embedded post body.",
    ]);
    expect(isXArticleSurface(article as unknown as HTMLElement, "/reader_name/article/123456")).toBe(true);
    expect(isXArticleSurface(article as unknown as HTMLElement, "/home")).toBe(false);
  });
});

class FixtureElement {
  readonly children: FixtureElement[];
  parentElement: FixtureElement | null = null;
  readonly tagName: string;
  readonly textContent: string;

  constructor(
    tagName: string,
    readonly innerText: string,
    readonly testId?: string,
    children: FixtureElement[] = [],
  ) {
    this.tagName = tagName.toUpperCase();
    this.textContent = innerText;
    this.children = children;
    for (const child of children) child.parentElement = this;
  }

  get firstElementChild(): FixtureElement | null {
    return this.children[0] || null;
  }

  matches(selector: string): boolean {
    return selector.split(",").some((part) => this.matchesOne(part.trim()));
  }

  querySelector<T>(selector: string): T | null {
    return this.querySelectorAll<T>(selector)[0] || null;
  }

  querySelectorAll<T>(selector: string): T[] {
    const matches: FixtureElement[] = [];
    const visit = (element: FixtureElement): void => {
      for (const child of element.children) {
        if (child.matches(selector)) matches.push(child);
        visit(child);
      }
    };
    visit(this);
    return matches as T[];
  }

  closest<T>(selector: string): T | null {
    let element: FixtureElement | null = this;
    while (element) {
      if (element.matches(selector)) return element as T;
      element = element.parentElement;
    }
    return null;
  }

  private matchesOne(selector: string): boolean {
    if (selector === X_ARTICLE_ROOT) return this.testId === "twitterArticleReadView";
    if (selector === X_ARTICLE_TITLE) return this.testId === "twitter-article-title";
    if (selector === X_ARTICLE_RICH_TEXT) return this.testId === "twitterArticleRichTextView";
    if (selector === X_ARTICLE_EDITOR) return this.testId === "longformRichTextComponent";
    if (selector === '[data-testid="tweetText"]') return this.testId === "tweetText";
    if (selector === '[data-testid*="caption" i]') return this.testId?.toLowerCase().includes("caption") === true;
    return selector.toUpperCase() === this.tagName;
  }
}

function fixture(tag: string, text: string, testId?: string, children: FixtureElement[] = []): FixtureElement {
  return new FixtureElement(tag, text, testId, children);
}
