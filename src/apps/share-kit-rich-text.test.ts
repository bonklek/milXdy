import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  clearTweetPngFormatting,
  createTweetPngRichText,
  isTweetPngRichTextPristine,
  reconcileTweetPngRichText,
  selectionHasTweetPngBullets,
  selectionHasTweetPngInlineStyle,
  toggleTweetPngBullets,
  toggleTweetPngInlineStyle,
  tweetPngRichTextLines,
} from "../../examples/packages/first-party-replacements/tweetPng/src/rich-text";

describe("Share Kit rich-text editor", () => {
  const packageSource = readFileSync("examples/packages/first-party-replacements/tweetPng/src/content.ts", "utf8");

  it("applies and removes every inline style without changing text", () => {
    const original = createTweetPngRichText("alpha beta");
    const bold = toggleTweetPngInlineStyle(original, 0, 5, "bold");
    const italic = toggleTweetPngInlineStyle(bold, 0, 5, "italic");
    const combined = toggleTweetPngInlineStyle(italic, 2, 5, "strikethrough");

    expect(combined.text).toBe("alpha beta");
    expect(selectionHasTweetPngInlineStyle(combined, 0, 5, "bold")).toBe(true);
    expect(selectionHasTweetPngInlineStyle(combined, 0, 5, "italic")).toBe(true);
    expect(selectionHasTweetPngInlineStyle(combined, 2, 5, "strikethrough")).toBe(true);
    expect(tweetPngRichTextLines(combined)[0].runs).toEqual([
      { text: "al", bold: true, italic: true, strikethrough: false },
      { text: "pha", bold: true, italic: true, strikethrough: true },
      { text: " beta", bold: false, italic: false, strikethrough: false },
    ]);

    const withoutBold = toggleTweetPngInlineStyle(combined, 0, 5, "bold");
    expect(selectionHasTweetPngInlineStyle(withoutBold, 0, 5, "bold")).toBe(false);
    expect(selectionHasTweetPngInlineStyle(withoutBold, 0, 5, "italic")).toBe(true);
  });

  it("toggles bullets for every selected line, including empty lines", () => {
    const original = createTweetPngRichText("one\n\nthree");
    const bulleted = toggleTweetPngBullets(original, 0, original.text.length);
    expect(bulleted.bulletLineStarts).toEqual([0, 4, 5]);
    expect(tweetPngRichTextLines(bulleted).map((line) => line.bullet)).toEqual([true, true, true]);
    expect(selectionHasTweetPngBullets(bulleted, 0, original.text.length)).toBe(true);

    const middleReset = toggleTweetPngBullets(bulleted, 4, 4);
    expect(middleReset.bulletLineStarts).toEqual([0, 5]);
    expect(middleReset.text).toBe(original.text);
  });

  it("clears selected formatting and can reset to the untouched source", () => {
    const originalText = "first\nsecond";
    let formatted = createTweetPngRichText(originalText);
    formatted = toggleTweetPngInlineStyle(formatted, 0, formatted.text.length, "bold");
    formatted = toggleTweetPngBullets(formatted, 0, formatted.text.length);
    const cleared = clearTweetPngFormatting(formatted, 0, 5);

    expect(selectionHasTweetPngInlineStyle(cleared, 0, 5, "bold")).toBe(false);
    expect(selectionHasTweetPngInlineStyle(cleared, 6, 12, "bold")).toBe(true);
    expect(cleared.bulletLineStarts).toEqual([6]);
    expect(isTweetPngRichTextPristine(cleared, originalText)).toBe(false);
    expect(isTweetPngRichTextPristine(createTweetPngRichText(originalText), originalText)).toBe(true);
  });

  it("preserves surrounding styles and list state while text is edited", () => {
    let value = createTweetPngRichText("one\ntwo");
    value = toggleTweetPngInlineStyle(value, 0, 3, "bold");
    value = toggleTweetPngBullets(value, 0, 0);

    const inserted = reconcileTweetPngRichText(value, "one!\ntwo");
    expect(selectionHasTweetPngInlineStyle(inserted, 0, 4, "bold")).toBe(true);
    expect(inserted.bulletLineStarts).toEqual([0]);

    const split = reconcileTweetPngRichText(inserted, "one\n!\ntwo");
    expect(split.bulletLineStarts).toEqual([0, 4]);
    expect(split.text).toBe("one\n!\ntwo");
  });

  it("normalizes platform line endings without discarding unsupported source text", () => {
    const source = createTweetPngRichText("plain <strong>markup</strong>\r\nemoji \ud83d\udc69\u200d\ud83d\udcbb");
    expect(source.text).toBe("plain <strong>markup</strong>\nemoji \ud83d\udc69\u200d\ud83d\udcbb");
    expect(source.spans).toEqual([]);
    expect(source.bulletLineStarts).toEqual([]);
  });

  it("exposes labelled native controls and keeps formatting local to the review", () => {
    expect(packageSource).toContain('role="toolbar" aria-label="Post text formatting"');
    expect(packageSource).toContain('aria-label="Toggle bulleted list"');
    expect(packageSource).toContain('aria-label="Toggle bold"');
    expect(packageSource).toContain('aria-label="Toggle italic"');
    expect(packageSource).toContain('aria-label="Toggle strikethrough"');
    expect(packageSource).toContain('aria-keyshortcuts="Control+B Meta+B"');
    expect(packageSource).toContain('data-action="clear-formatting"');
    expect(packageSource).toContain('data-action="reset-text"');
    expect(packageSource).toContain("Edits stay in this export.");
    expect(packageSource).not.toContain("milxdy.settings.tweetPngRichText");
  });
});
