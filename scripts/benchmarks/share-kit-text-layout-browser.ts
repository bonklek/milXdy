import { clearCache } from "@chenglou/pretext";
import { layoutTweetPngPlainText } from "../../examples/packages/first-party-replacements/tweetPng/src/text-layout";

const FONT_FAMILY = 'TwitterChirp, Arial, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
const FONT = `34px ${FONT_FAMILY}`;
const MAX_WIDTH = 800;
const SAFE_WIDTH = MAX_WIDTH - 16;
const MAX_LINES = 60;
const corpus = [
  "Share Kit keeps ordinary Latin words readable across lines.",
  "alpha   beta\r\n\r\ngamma\t delta",
  "https://example.com/really/long/path?alpha=one&beta=two #UnicodeLayout @milXdyBrowser",
  "Cafe\u0301 nai\u0308ve re\u0301sume\u0301 co\u0308operate",
  "Family 👩‍👩‍👧‍👦 astronaut 👩‍🚀 flags 🇺🇸🇯🇵 and keycap 1️⃣",
  "「国際化された文章」は、句読点を行頭や行末に不自然に残しません。",
  "ภาษาไทยไม่มีช่องว่างระหว่างคำខ្មែរមិនមានចន្លោះរវាងពាក្យ",
  "بدأت الرحلة إلى القمر مع أصدقاء جدد في المساء",
  "milXdy الإصدار 0.2.5 يدعم Unicode داخل Share Kit",
];

const canvas = document.createElement("canvas");
canvas.width = 1200;
canvas.height = 2700;
const context = canvas.getContext("2d");
if (!context) throw new Error("Canvas unavailable");

const pretextRender = (text: string): number => {
  const result = layoutTweetPngPlainText(context, text, {
    fontFamily: FONT_FAMILY,
    fontSize: 34,
    maxWidth: MAX_WIDTH,
    maxLines: MAX_LINES,
    safetyPx: 16,
  });
  let y = 48;
  for (const line of result.lines) {
    for (const fragment of line.fragments) {
      context.font = fragment.font;
      context.fillText(fragment.text, fragment.x, y);
    }
    y += 48;
  }
  return result.lines.length;
};

const legacyRender = (text: string): number => {
  context.font = FONT;
  const lines = legacyWrapCanvasText(context, text, MAX_WIDTH, MAX_LINES);
  let y = 48;
  for (const line of lines) {
    context.fillText(line, 0, y);
    y += 48;
  }
  return lines.length;
};

for (let index = 0; index < 20; index++) {
  for (const text of corpus) {
    pretextRender(text);
    legacyRender(text);
  }
}

const warmPretextMs = benchmark(pretextRender, 80);
const legacyMs = benchmark(legacyRender, 80);
const coldPretextSamples: number[] = [];
for (let index = 0; index < 40; index++) {
  clearCache();
  const start = performance.now();
  for (const text of corpus) pretextRender(text);
  coldPretextSamples.push((performance.now() - start) / corpus.length);
}

const longNoSpace = corpus[6].repeat(18);
clearCache();
const longStart = performance.now();
const longLayout = layoutTweetPngPlainText(context, longNoSpace, {
  fontFamily: FONT_FAMILY,
  fontSize: 34,
  maxWidth: MAX_WIDTH,
  maxLines: 200,
  safetyPx: 16,
});
const longNoSpaceMs = performance.now() - longStart;
context.font = FONT;
const legacyLongStart = performance.now();
const legacyLongLines = legacyWrapCanvasText(context, longNoSpace, MAX_WIDTH, 200);
const legacyLongNoSpaceMs = performance.now() - legacyLongStart;

const comparisonWidth = 360;
const comparisons = Object.fromEntries([
  ["CJK punctuation", corpus[5]],
  ["Thai and Khmer", corpus[6]],
  ["mixed bidi", corpus[8]],
].map(([name, text]) => {
  const pretext = layoutTweetPngPlainText(context, text, {
    fontFamily: FONT_FAMILY,
    fontSize: 34,
    maxWidth: comparisonWidth,
    maxLines: 20,
    safetyPx: 16,
  });
  context.font = FONT;
  return [name, {
    legacy: legacyWrapCanvasText(context, text, comparisonWidth, 20),
    pretext: pretext.lines.map((line) => line.fragments.map((fragment) => fragment.text).join("")),
  }];
}));

const result = {
  browser: navigator.userAgent,
  corpusCases: corpus.length,
  sampleRounds: 80,
  millisecondsPerText: {
    legacyMedian: median(legacyMs),
    pretextWarmMedian: median(warmPretextMs),
    pretextColdCacheMedian: median(coldPretextSamples),
  },
  longNoSpace: {
    characters: longNoSpace.length,
    pretextLines: longLayout.lines.length,
    pretextElapsedMs: longNoSpaceMs,
    pretextMaxLineWidth: Math.max(...longLayout.lines.map((line) => line.width)),
    legacyLines: legacyLongLines.length,
    legacyElapsedMs: legacyLongNoSpaceMs,
    legacyMaxLineWidth: Math.max(...legacyLongLines.map((line) => context.measureText(line).width)),
    safeWidth: SAFE_WIDTH,
    pretextOverflow: longLayout.lines.some((line) => line.width > longLayout.safeWidth + 0.01),
    legacyOverflow: legacyLongLines.some((line) => context.measureText(line).width > SAFE_WIDTH + 0.01),
  },
  intentionalLineBreakChanges: { comparisonWidth, cases: comparisons },
};

document.body.innerHTML = `<pre id="result">${escapeHtml(JSON.stringify(result, null, 2))}</pre>`;
document.title = "share-kit-text-layout-complete";

function benchmark(render: (text: string) => number, rounds: number): number[] {
  const samples: number[] = [];
  for (let round = 0; round < rounds; round++) {
    const start = performance.now();
    for (const text of corpus) render(text);
    samples.push((performance.now() - start) / corpus.length);
  }
  return samples;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function escapeHtml(value: string): string {
  return value.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;");
}

function legacyWrapCanvasText(
  canvasContext: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  maxLines: number,
): string[] {
  const safeWidth = Math.max(1, maxWidth - 16);
  const paragraphs = text.replace(/\r\n?/g, "\n").split("\n");
  const lines: string[] = [];
  let truncated = false;
  for (const paragraph of paragraphs) {
    if (lines.length >= maxLines) {
      truncated = true;
      break;
    }
    const words = paragraph.replace(/[^\S\n]+/g, " ").trim().split(" ").filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      if (lines.length >= maxLines) {
        truncated = true;
        break;
      }
      const next = line ? `${line} ${word}` : word;
      if (canvasContext.measureText(next).width <= safeWidth) {
        line = next;
        continue;
      }
      if (line) lines.push(line);
      line = "";
      if (canvasContext.measureText(word).width <= safeWidth) {
        line = word;
        continue;
      }
      let segment = "";
      for (const part of Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(word), (item) => item.segment)) {
        if (segment && canvasContext.measureText(segment + part).width > safeWidth) {
          lines.push(segment);
          segment = part;
        } else {
          segment += part;
        }
      }
      if (segment) lines.push(segment);
    }
    if (line && lines.length < maxLines) lines.push(line);
  }
  while (lines.length > 1 && lines.at(-1) === "") lines.pop();
  if (truncated && lines.length) lines[lines.length - 1] += "...";
  return lines.length ? lines : [""];
}
