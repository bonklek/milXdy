import { beforeAll, describe, expect, it } from "vitest";
import {
  layoutTweetPngPlainText,
  layoutTweetPngRichInlineRuns,
  type TweetPngTextLayout,
} from "../../examples/packages/first-party-replacements/tweetPng/src/text-layout";

class DeterministicCanvasContext {
  font = "16px Arial";

  measureText(text: string): TextMetrics {
    const fontSize = Number(this.font.match(/(\d+(?:\.\d+)?)px/u)?.[1] || 16);
    const graphemes = Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(text));
    const width = graphemes.reduce((sum, part) => {
      if (/^\s+$/u.test(part.segment)) return sum + fontSize * 0.32;
      if (/\p{Extended_Pictographic}|\p{Script=Han}|\p{Script=Thai}|\p{Script=Khmer}/u.test(part.segment)) {
        return sum + fontSize;
      }
      if (/\p{Script=Arabic}/u.test(part.segment)) return sum + fontSize * 0.62;
      return sum + fontSize * 0.56;
    }, 0);
    return {
      width,
      actualBoundingBoxLeft: 0,
      actualBoundingBoxRight: width,
    } as TextMetrics;
  }
}

class DeterministicOffscreenCanvas {
  private readonly context = new DeterministicCanvasContext();

  getContext(): DeterministicCanvasContext {
    return this.context;
  }
}

const context = new DeterministicCanvasContext() as unknown as CanvasRenderingContext2D;
const options = {
  fontFamily: 'TwitterChirp, Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif',
  fontSize: 34,
  maxWidth: 320,
  maxLines: 20,
  safetyPx: 16,
} as const;

beforeAll(() => {
  Object.defineProperty(globalThis, "OffscreenCanvas", {
    configurable: true,
    value: DeterministicOffscreenCanvas,
  });
});

describe("Share Kit Pretext text layout", () => {
  const fixtureMatrix = [
    ["Latin", "Share Kit keeps ordinary Latin words readable across lines."],
    ["long URL, hashtag, and handle", "https://example.com/really/long/path?alpha=one&beta=two #UnicodeLayout @milXdyBrowser"],
    ["combining marks", "Cafe\u0301 nai\u0308ve re\u0301sume\u0301 co\u0308operate"],
    ["emoji and ZWJ", "Family 👩‍👩‍👧‍👦 astronaut 👩‍🚀 flags 🇺🇸🇯🇵 and keycap 1️⃣"],
    ["CJK punctuation", "「国際化された文章」は、句読点を行頭や行末に不自然に残しません。"],
    ["Thai and Khmer no-space", "ภาษาไทยไม่มีช่องว่างระหว่างคำខ្មែរមិនមានចន្លោះរវាងពាក្យ"],
    ["Arabic RTL", "بدأت الرحلة إلى القمر مع أصدقاء جدد في المساء"],
    ["mixed bidi", "milXdy الإصدار 0.2.5 يدعم Unicode داخل Share Kit"],
  ] as const;

  for (const [name, text] of fixtureMatrix) {
    it(`keeps ${name} content within the safe width`, () => {
      const result = layoutTweetPngPlainText(context, text, options);
      expect(result.truncated).toBe(false);
      expect(result.lines.length).toBeGreaterThan(0);
      expect(result.lines.every((line) => line.width <= result.safeWidth + 0.001)).toBe(true);
      expect(withoutWhitespace(result)).toBe(text.replace(/\s/gu, ""));
    });
  }

  it("normalizes CRLF, collapses repeated ordinary whitespace, and preserves explicit blank lines", () => {
    const result = layoutTweetPngPlainText(context, "alpha   beta\r\n\r\ngamma\t delta\rtrailing\n", options);
    expect(lineText(result.lines[0])).toBe("alpha beta");
    expect(result.lines[1].fragments).toEqual([]);
    expect(result.lines.map(lineText).join("\n")).toContain("gamma delta\ntrailing");
    expect(result.lines.at(-1)?.fragments.length).toBeGreaterThan(0);
  });

  it("never splits combining marks or emoji ZWJ sequences", () => {
    const result = layoutTweetPngPlainText(context, "e\u0301👩‍🚀e\u0301👩‍🚀", {
      ...options,
      maxWidth: 58,
    });
    const graphemes = result.lines.flatMap((line) =>
      Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(lineText(line)), (part) => part.segment));
    expect(graphemes).toEqual(["e\u0301", "👩‍🚀", "e\u0301", "👩‍🚀"]);
  });

  it("caps lines and adds a width-safe ellipsis", () => {
    const result = layoutTweetPngPlainText(context, fixtureMatrix.map(([, text]) => text).join(" "), {
      ...options,
      maxLines: 2,
    });
    expect(result.lines).toHaveLength(2);
    expect(result.truncated).toBe(true);
    expect(result.lines[1].truncated).toBe(true);
    expect(lineText(result.lines[1])).toMatch(/\.\.\.$/u);
    expect(result.lines[1].width).toBeLessThanOrEqual(result.safeWidth + 0.001);
  });

  it("keeps unformatted rich-inline flow equivalent to the plain adapter", () => {
    const text = "Unicode plain text 日本語 ภาษาไทย 👩‍🚀 العربية";
    const plain = layoutTweetPngPlainText(context, text, options);
    const rich = layoutTweetPngRichInlineRuns(context, [{ text }], options);
    expect(rich.lines.map(lineText)).toEqual(plain.lines.map(lineText));
    expect(rich.lines.map((line) => line.width)).toEqual(plain.lines.map((line) => line.width));
  });

  it("returns positioned styled fragments and adapter-owned bullet indents", () => {
    const result = layoutTweetPngRichInlineRuns(context, [
      { text: "ordinary " },
      { text: "bold", style: { fontWeight: 700 } },
      { text: " italic", style: { fontStyle: "italic" } },
      { text: " struck", style: { strikethrough: true } },
      { text: " continuation text that wraps onto another line" },
    ], {
      ...options,
      maxWidth: 250,
      bullet: { marker: "•", firstLineIndent: 34, restLineIndent: 34 },
    });
    expect(result.lines.length).toBeGreaterThan(1);
    expect(result.lines[0].fragments[0]).toMatchObject({ text: "•", x: 0, role: "bullet" });
    expect(result.lines.every((line) => line.fragments.filter((fragment) => fragment.role === "text")
      .every((fragment) => fragment.x >= 34))).toBe(true);
    expect(result.lines.flatMap((line) => line.fragments).some((fragment) => fragment.font.startsWith("700 "))).toBe(true);
    expect(result.lines.flatMap((line) => line.fragments).some((fragment) => fragment.font.startsWith("italic "))).toBe(true);
    expect(result.lines.flatMap((line) => line.fragments).some((fragment) => fragment.style.strikethrough)).toBe(true);
    expect(result.lines.every((line) => line.width <= result.safeWidth + 0.001)).toBe(true);
  });

  it("truncates formatted runs without losing the surviving ellipsis style", () => {
    const result = layoutTweetPngRichInlineRuns(context, [
      { text: "a " },
      { text: "bold content that must wrap and eventually truncate", style: { fontWeight: 700, strikethrough: true } },
    ], {
      ...options,
      maxWidth: 230,
      maxLines: 1,
    });
    const last = result.lines[0].fragments.at(-1);
    expect(result.truncated).toBe(true);
    expect(last?.text).toMatch(/\.\.\.$/u);
    expect(last?.style).toMatchObject({ fontWeight: 700, strikethrough: true });
    expect(result.lines[0].width).toBeLessThanOrEqual(result.safeWidth + 0.001);
  });
});

function lineText(line: TweetPngTextLayout["lines"][number]): string {
  let text = "";
  let previousEnd = line.textStartX;
  for (const fragment of line.fragments.filter((candidate) => candidate.role === "text")) {
    if (fragment.x > previousEnd + 0.001 && text) text += " ";
    text += fragment.text;
    previousEnd = fragment.x + fragment.width;
  }
  return text;
}

function withoutWhitespace(layout: TweetPngTextLayout): string {
  return layout.lines.map(lineText).join("").replace(/\s/gu, "");
}
