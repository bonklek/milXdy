export type TweetPngInlineStyle = "bold" | "italic" | "strikethrough";

export type TweetPngRichTextSpan = {
  start: number;
  end: number;
  bold?: true;
  italic?: true;
  strikethrough?: true;
};

export type TweetPngRichText = {
  text: string;
  spans: TweetPngRichTextSpan[];
  bulletLineStarts: number[];
};

export type TweetPngRichTextRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  strikethrough: boolean;
};

export type TweetPngRichTextLine = {
  bullet: boolean;
  runs: TweetPngRichTextRun[];
};

const STYLE_BITS: Record<TweetPngInlineStyle, number> = {
  bold: 1,
  italic: 2,
  strikethrough: 4,
};

export function createTweetPngRichText(text: string): TweetPngRichText {
  return {
    text: normalizeEditorText(text),
    spans: [],
    bulletLineStarts: [],
  };
}

export function toggleTweetPngInlineStyle(
  value: TweetPngRichText,
  selectionStart: number,
  selectionEnd: number,
  style: TweetPngInlineStyle,
): TweetPngRichText {
  const range = effectiveInlineRange(value.text, selectionStart, selectionEnd);
  if (range.start === range.end) return value;
  const masks = styleMasks(value);
  const bit = STYLE_BITS[style];
  const indexes = selectedTextIndexes(value.text, range.start, range.end);
  if (!indexes.length) return value;
  const remove = indexes.every((index) => Boolean(masks[index] & bit));
  for (const index of indexes) {
    masks[index] = remove ? masks[index] & ~bit : masks[index] | bit;
  }
  return { ...value, spans: spansFromStyleMasks(masks) };
}

export function selectionHasTweetPngInlineStyle(
  value: TweetPngRichText,
  selectionStart: number,
  selectionEnd: number,
  style: TweetPngInlineStyle,
): boolean {
  const range = effectiveInlineRange(value.text, selectionStart, selectionEnd);
  const indexes = selectedTextIndexes(value.text, range.start, range.end);
  if (!indexes.length) return false;
  const masks = styleMasks(value);
  const bit = STYLE_BITS[style];
  return indexes.every((index) => Boolean(masks[index] & bit));
}

export function toggleTweetPngBullets(
  value: TweetPngRichText,
  selectionStart: number,
  selectionEnd: number,
): TweetPngRichText {
  const starts = selectedLineStarts(value.text, selectionStart, selectionEnd);
  const bullets = new Set(value.bulletLineStarts);
  const remove = starts.every((start) => bullets.has(start));
  for (const start of starts) {
    if (remove) bullets.delete(start);
    else bullets.add(start);
  }
  return { ...value, bulletLineStarts: sortedValidLineStarts(value.text, bullets) };
}

export function selectionHasTweetPngBullets(
  value: TweetPngRichText,
  selectionStart: number,
  selectionEnd: number,
): boolean {
  const bullets = new Set(value.bulletLineStarts);
  const starts = selectedLineStarts(value.text, selectionStart, selectionEnd);
  return starts.length > 0 && starts.every((start) => bullets.has(start));
}

export function clearTweetPngFormatting(
  value: TweetPngRichText,
  selectionStart: number,
  selectionEnd: number,
): TweetPngRichText {
  const range = normalizedRange(value.text, selectionStart, selectionEnd);
  const clearStart = range.start === range.end ? lineStartAt(value.text, range.start) : range.start;
  const clearEnd = range.start === range.end ? lineEndAt(value.text, range.end) : range.end;
  const masks = styleMasks(value);
  for (let index = clearStart; index < clearEnd; index += 1) masks[index] = 0;
  const selectedLines = new Set(selectedLineStarts(value.text, clearStart, clearEnd));
  return {
    ...value,
    spans: spansFromStyleMasks(masks),
    bulletLineStarts: value.bulletLineStarts.filter((start) => !selectedLines.has(start)),
  };
}

export function reconcileTweetPngRichText(value: TweetPngRichText, nextText: string): TweetPngRichText {
  const normalized = normalizeEditorText(nextText);
  if (normalized === value.text) return value;

  const previous = value.text;
  let prefix = 0;
  while (prefix < previous.length && prefix < normalized.length && previous[prefix] === normalized[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < previous.length - prefix
    && suffix < normalized.length - prefix
    && previous[previous.length - 1 - suffix] === normalized[normalized.length - 1 - suffix]
  ) suffix += 1;

  const oldSuffixStart = previous.length - suffix;
  const newSuffixStart = normalized.length - suffix;
  const oldMasks = styleMasks(value);
  const inheritedMask = insertionStyleMask(oldMasks, previous, prefix, oldSuffixStart);
  const insertedMasks = Array.from({ length: newSuffixStart - prefix }, (_, offset) => (
    normalized[prefix + offset] === "\n" ? 0 : inheritedMask
  ));
  const nextMasks = [
    ...oldMasks.slice(0, prefix),
    ...insertedMasks,
    ...oldMasks.slice(oldSuffixStart),
  ];

  const oldBullets = new Set(value.bulletLineStarts);
  const nextBullets = lineStarts(normalized).filter((start) => {
    let oldProbe: number;
    if (start <= prefix) oldProbe = start;
    else if (start >= newSuffixStart) oldProbe = start - (normalized.length - previous.length);
    else oldProbe = prefix;
    return oldBullets.has(lineStartAt(previous, oldProbe));
  });

  return {
    text: normalized,
    spans: spansFromStyleMasks(nextMasks),
    bulletLineStarts: nextBullets,
  };
}

export function tweetPngRichTextLines(value: TweetPngRichText): TweetPngRichTextLine[] {
  const masks = styleMasks(value);
  const bullets = new Set(value.bulletLineStarts);
  return lineStarts(value.text).map((start, index, starts) => {
    const rawEnd = index + 1 < starts.length ? starts[index + 1] - 1 : value.text.length;
    const end = Math.max(start, rawEnd);
    const runs: TweetPngRichTextRun[] = [];
    let cursor = start;
    while (cursor < end) {
      const mask = masks[cursor] || 0;
      let runEnd = cursor + 1;
      while (runEnd < end && (masks[runEnd] || 0) === mask) runEnd += 1;
      runs.push(runFromMask(value.text.slice(cursor, runEnd), mask));
      cursor = runEnd;
    }
    if (!runs.length) runs.push(runFromMask("", 0));
    return { bullet: bullets.has(start), runs };
  });
}

export function isTweetPngRichTextPristine(value: TweetPngRichText, originalText: string): boolean {
  return value.text === normalizeEditorText(originalText)
    && value.spans.length === 0
    && value.bulletLineStarts.length === 0;
}

function normalizeEditorText(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

function normalizedRange(text: string, start: number, end: number): { start: number; end: number } {
  const boundedStart = Math.max(0, Math.min(text.length, Math.trunc(start) || 0));
  const boundedEnd = Math.max(0, Math.min(text.length, Math.trunc(end) || 0));
  return boundedStart <= boundedEnd
    ? { start: boundedStart, end: boundedEnd }
    : { start: boundedEnd, end: boundedStart };
}

function effectiveInlineRange(text: string, start: number, end: number): { start: number; end: number } {
  const range = normalizedRange(text, start, end);
  if (range.start !== range.end) return range;
  if (!text || /^\s$/u.test(text[range.start] || "") && /^\s$/u.test(text[range.start - 1] || "")) return range;
  let wordStart = range.start;
  if (wordStart === text.length || /^\s$/u.test(text[wordStart] || "")) wordStart -= 1;
  while (wordStart > 0 && !/^\s$/u.test(text[wordStart - 1])) wordStart -= 1;
  let wordEnd = Math.max(range.end, wordStart);
  while (wordEnd < text.length && !/^\s$/u.test(text[wordEnd])) wordEnd += 1;
  return { start: Math.max(0, wordStart), end: wordEnd };
}

function selectedTextIndexes(text: string, start: number, end: number): number[] {
  const indexes: number[] = [];
  for (let index = start; index < end; index += 1) {
    if (text[index] !== "\n") indexes.push(index);
  }
  return indexes;
}

function selectedLineStarts(text: string, start: number, end: number): number[] {
  const range = normalizedRange(text, start, end);
  const first = lineStartAt(text, range.start);
  const selectionLast = range.end > range.start && text[range.end - 1] === "\n" ? range.end - 1 : range.end;
  const last = lineStartAt(text, selectionLast);
  return lineStarts(text).filter((lineStart) => lineStart >= first && lineStart <= last);
}

function lineStarts(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") starts.push(index + 1);
  }
  return starts;
}

function lineStartAt(text: string, position: number): number {
  const bounded = Math.max(0, Math.min(text.length, position));
  return text.lastIndexOf("\n", Math.max(0, bounded - 1)) + 1;
}

function lineEndAt(text: string, position: number): number {
  const next = text.indexOf("\n", Math.max(0, Math.min(text.length, position)));
  return next === -1 ? text.length : next;
}

function sortedValidLineStarts(text: string, values: ReadonlySet<number>): number[] {
  const valid = new Set(lineStarts(text));
  return Array.from(values).filter((value) => valid.has(value)).sort((a, b) => a - b);
}

function styleMasks(value: TweetPngRichText): number[] {
  const masks = Array.from({ length: value.text.length }, () => 0);
  for (const span of value.spans) {
    const range = normalizedRange(value.text, span.start, span.end);
    const mask = (span.bold ? STYLE_BITS.bold : 0)
      | (span.italic ? STYLE_BITS.italic : 0)
      | (span.strikethrough ? STYLE_BITS.strikethrough : 0);
    for (let index = range.start; index < range.end; index += 1) masks[index] |= mask;
  }
  return masks;
}

function spansFromStyleMasks(masks: readonly number[]): TweetPngRichTextSpan[] {
  const spans: TweetPngRichTextSpan[] = [];
  let start = 0;
  while (start < masks.length) {
    const mask = masks[start] || 0;
    let end = start + 1;
    while (end < masks.length && (masks[end] || 0) === mask) end += 1;
    if (mask) {
      spans.push({
        start,
        end,
        ...(mask & STYLE_BITS.bold ? { bold: true as const } : {}),
        ...(mask & STYLE_BITS.italic ? { italic: true as const } : {}),
        ...(mask & STYLE_BITS.strikethrough ? { strikethrough: true as const } : {}),
      });
    }
    start = end;
  }
  return spans;
}

function insertionStyleMask(masks: readonly number[], text: string, prefix: number, oldSuffixStart: number): number {
  if (oldSuffixStart > prefix) {
    const selected = masks.slice(prefix, oldSuffixStart).filter((_, offset) => text[prefix + offset] !== "\n");
    if (selected.length && selected.every((mask) => mask === selected[0])) return selected[0] || 0;
  }
  if (prefix > 0 && text[prefix - 1] !== "\n") return masks[prefix - 1] || 0;
  if (oldSuffixStart < text.length && text[oldSuffixStart] !== "\n") return masks[oldSuffixStart] || 0;
  return 0;
}

function runFromMask(text: string, mask: number): TweetPngRichTextRun {
  return {
    text,
    bold: Boolean(mask & STYLE_BITS.bold),
    italic: Boolean(mask & STYLE_BITS.italic),
    strikethrough: Boolean(mask & STYLE_BITS.strikethrough),
  };
}
