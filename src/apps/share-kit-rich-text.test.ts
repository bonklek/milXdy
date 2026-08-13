import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
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
import { layoutTweetPngRichInlineBlocks } from "../../examples/packages/first-party-replacements/tweetPng/src/text-layout";

class RichTextTestCanvasContext {
  font = "16px Arial";

  measureText(text: string): TextMetrics {
    const fontSize = Number(this.font.match(/(\d+(?:\.\d+)?)px/u)?.[1] || 16);
    const width = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text)).length * fontSize * 0.56;
    return { width, actualBoundingBoxLeft: 0, actualBoundingBoxRight: width } as TextMetrics;
  }
}

class RichTextTestOffscreenCanvas {
  getContext(): RichTextTestCanvasContext {
    return new RichTextTestCanvasContext();
  }
}

beforeAll(() => {
  Object.defineProperty(globalThis, "OffscreenCanvas", {
    configurable: true,
    value: RichTextTestOffscreenCanvas,
  });
});

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

  it("preserves combined styles and bullets through the shared drawable layout", () => {
    let value = createTweetPngRichText("styled line");
    value = toggleTweetPngInlineStyle(value, 0, 6, "bold");
    value = toggleTweetPngInlineStyle(value, 0, 6, "italic");
    value = toggleTweetPngInlineStyle(value, 0, 6, "strikethrough");
    value = toggleTweetPngBullets(value, 0, value.text.length);
    const context = new RichTextTestCanvasContext() as unknown as CanvasRenderingContext2D;
    const blocks = tweetPngRichTextLines(value).map((line) => ({
      runs: line.runs.map((run) => ({
        text: run.text,
        style: {
          fontWeight: run.bold ? 700 as const : 400 as const,
          fontStyle: run.italic ? "italic" as const : "normal" as const,
          strikethrough: run.strikethrough,
        },
      })),
      ...(line.bullet ? { bullet: { marker: "\u2022" } } : {}),
    }));

    const layout = layoutTweetPngRichInlineBlocks(context, blocks, {
      fontFamily: "Arial, sans-serif",
      fontSize: 34,
      maxWidth: 800,
      maxLines: 4,
      safetyPx: 16,
    });
    expect(layout.truncated).toBe(false);
    expect(layout.lines[0].fragments[0]).toMatchObject({ role: "bullet", text: "\u2022" });
    expect(layout.lines[0].fragments.find((fragment) => fragment.text.includes("styled"))).toMatchObject({
      role: "text",
      style: { fontWeight: 700, fontStyle: "italic", strikethrough: true },
    });
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
    expect(packageSource).toContain("layoutTweetPngRichInlineBlocks(");
    expect(packageSource).toContain("fragment.style.strikethrough");
    expect(packageSource).toContain("currentBlob = nextResult.blob");
    expect(packageSource).toContain("copyTweetPng(currentBlob)");
    expect(packageSource).toContain("downloadBlob(currentBlob, tweetPngFileName(currentData))");
    expect(packageSource).toContain("blob: currentBlob");
    expect(packageSource).not.toContain("milxdy.settings.tweetPngRichText");
  });
});
