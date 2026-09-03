import {
  layoutWithLines,
  prepareWithSegments,
} from "@chenglou/pretext";
import {
  layoutNextRichInlineLineRange,
  materializeRichInlineLineRange,
  prepareRichInline,
  type RichInlineCursor,
} from "@chenglou/pretext/rich-inline";

export type RichInlineRunStyle = {
  fontWeight: 400 | 700;
  fontStyle: "normal" | "italic";
  strikethrough: boolean;
};

export type RichInlineRun = {
  text: string;
  style?: Partial<RichInlineRunStyle>;
};

export type TweetPngBulletLayout = {
  marker: string;
  gap?: number;
  firstLineIndent?: number;
  restLineIndent?: number;
};

export type TweetPngTextLayoutOptions = {
  fontFamily: string;
  fontSize: number;
  maxWidth: number;
  maxLines: number;
  safetyPx?: number;
  baseStyle?: Partial<RichInlineRunStyle>;
  bullet?: TweetPngBulletLayout;
};

export type TweetPngTextFragment = {
  text: string;
  x: number;
  width: number;
  font: string;
  style: RichInlineRunStyle;
  role: "text" | "bullet";
};

export type TweetPngTextLine = {
  width: number;
  fragments: TweetPngTextFragment[];
  truncated: boolean;
  textStartX: number;
};

export type TweetPngTextLayout = {
  lines: TweetPngTextLine[];
  truncated: boolean;
  safeWidth: number;
};

export type TweetPngRichInlineBlock = {
  runs: readonly RichInlineRun[];
  bullet?: TweetPngBulletLayout;
};

const DEFAULT_STYLE: RichInlineRunStyle = {
  fontWeight: 400,
  fontStyle: "normal",
  strikethrough: false,
};

export function tweetPngTextFont(
  fontFamily: string,
  fontSize: number,
  style: Pick<RichInlineRunStyle, "fontWeight" | "fontStyle">,
): string {
  const italic = style.fontStyle === "italic" ? "italic " : "";
  const weight = style.fontWeight === 700 ? "700 " : "";
  return `${italic}${weight}${fontSize}px ${fontFamily}`;
}

export function layoutTweetPngPlainText(
  context: CanvasRenderingContext2D,
  text: string,
  options: TweetPngTextLayoutOptions,
): TweetPngTextLayout {
  const resolved = resolveOptions(options);
  const font = tweetPngTextFont(resolved.fontFamily, resolved.fontSize, resolved.baseStyle);
  const lines: TweetPngTextLine[] = [];

  for (const paragraph of normalizeHardBreaks(text).split("\n")) {
    if (/^[\t\f ]*$/u.test(paragraph)) {
      lines.push(blankLine());
      continue;
    }
    const prepared = prepareWithSegments(paragraph, font, { whiteSpace: "normal" });
    const laidOut = layoutWithLines(prepared, resolved.safeWidth, 1);
    if (!laidOut.lines.length) {
      lines.push(blankLine());
      continue;
    }
    for (const line of laidOut.lines) {
      lines.push({
        width: line.width,
        fragments: [{
          text: line.text,
          x: 0,
          width: line.width,
          font,
          style: resolved.baseStyle,
          role: "text",
        }],
        truncated: false,
        textStartX: 0,
      });
    }
  }

  while (lines.length > 1 && lines[lines.length - 1].fragments.length === 0) lines.pop();

  return limitTweetPngTextLayout(context, { lines, truncated: false, safeWidth: resolved.safeWidth }, resolved.maxLines, {
    font,
    style: resolved.baseStyle,
  });
}

export function layoutTweetPngRichInlineRuns(
  context: CanvasRenderingContext2D,
  runs: readonly RichInlineRun[],
  options: TweetPngTextLayoutOptions,
): TweetPngTextLayout {
  return layoutTweetPngRichInlineBlocks(context, [{ runs, bullet: options.bullet }], options);
}

export function layoutTweetPngRichInlineBlocks(
  context: CanvasRenderingContext2D,
  blocks: readonly TweetPngRichInlineBlock[],
  options: TweetPngTextLayoutOptions,
): TweetPngTextLayout {
  const resolved = resolveOptions(options);
  const fallbackFont = tweetPngTextFont(resolved.fontFamily, resolved.fontSize, resolved.baseStyle);
  const lines: TweetPngTextLine[] = [];

  for (const block of blocks) {
    const logicalLines = splitRunsAtHardBreaks(block.runs);
    for (let index = 0; index < logicalLines.length; index++) {
      const bullet = index === 0 ? block.bullet : undefined;
      lines.push(...layoutRichLogicalLine(context, logicalLines[index], resolved, bullet));
    }
  }

  if (!lines.length) lines.push(blankLine());
  return limitTweetPngTextLayout(context, { lines, truncated: false, safeWidth: resolved.safeWidth }, resolved.maxLines, {
    font: fallbackFont,
    style: resolved.baseStyle,
  });
}

export function limitTweetPngTextLayout(
  context: CanvasRenderingContext2D,
  layout: TweetPngTextLayout,
  maxLines: number,
  fallback: { font: string; style: RichInlineRunStyle },
): TweetPngTextLayout {
  const limit = Math.max(0, Math.floor(maxLines));
  if (layout.lines.length <= limit) {
    return {
      lines: layout.lines.map(cloneLine),
      truncated: layout.truncated,
      safeWidth: layout.safeWidth,
    };
  }
  if (limit === 0) return { lines: [], truncated: true, safeWidth: layout.safeWidth };

  const lines = layout.lines.slice(0, limit).map(cloneLine);
  lines[lines.length - 1] = ellipsizeLine(context, lines[lines.length - 1], layout.safeWidth, fallback);
  return { lines, truncated: true, safeWidth: layout.safeWidth };
}

function layoutRichLogicalLine(
  context: CanvasRenderingContext2D,
  runs: readonly RichInlineRun[],
  options: ResolvedOptions,
  bullet: TweetPngBulletLayout | undefined,
): TweetPngTextLine[] {
  const resolvedRuns = coalesceRuns(runs, options.baseStyle, options.fontFor);
  const markerStyle = options.baseStyle;
  const markerFont = tweetPngTextFont(options.fontFamily, options.fontSize, markerStyle);
  const markerWidth = bullet ? measureCanvasText(context, bullet.marker, markerFont) : 0;
  const defaultIndent = bullet ? markerWidth + (bullet.gap ?? Math.max(8, options.fontSize * 0.35)) : 0;
  const firstIndent = Math.max(0, bullet?.firstLineIndent ?? defaultIndent);
  const restIndent = Math.max(0, bullet?.restLineIndent ?? defaultIndent);

  if (!resolvedRuns.length || resolvedRuns.every((run) => /^[\t\f ]*$/u.test(run.text))) {
    const fragments = bullet
      ? [bulletFragment(bullet.marker, markerWidth, markerFont, markerStyle)]
      : [];
    return [{
      width: fragments.length ? markerWidth : 0,
      fragments,
      truncated: false,
      textStartX: firstIndent,
    }];
  }

  const prepared = prepareRichInline(resolvedRuns.map((run) => ({
    text: run.text,
    font: run.font,
  })));
  const lines: TweetPngTextLine[] = [];
  let cursor: RichInlineCursor | undefined;
  let lineIndex = 0;

  while (true) {
    const indent = lineIndex === 0 ? firstIndent : restIndent;
    const range = layoutNextRichInlineLineRange(prepared, Math.max(1, options.safeWidth - indent), cursor);
    if (range === null) break;
    const materialized = materializeRichInlineLineRange(prepared, range);
    const fragments: TweetPngTextFragment[] = [];
    if (lineIndex === 0 && bullet) {
      fragments.push(bulletFragment(bullet.marker, markerWidth, markerFont, markerStyle));
    }
    let x = indent;
    for (const fragment of materialized.fragments) {
      const run = resolvedRuns[fragment.itemIndex];
      x += fragment.gapBefore;
      fragments.push({
        text: fragment.text,
        x,
        width: fragment.occupiedWidth,
        font: run.font,
        style: run.style,
        role: "text",
      });
      x += fragment.occupiedWidth;
    }
    lines.push({
      width: Math.max(lineIndex === 0 && bullet ? markerWidth : 0, indent + materialized.width),
      fragments,
      truncated: false,
      textStartX: indent,
    });
    cursor = range.end;
    lineIndex++;
  }

  return lines.length ? lines : [blankLine()];
}

type ResolvedRun = {
  text: string;
  style: RichInlineRunStyle;
  font: string;
};

function coalesceRuns(
  runs: readonly RichInlineRun[],
  baseStyle: RichInlineRunStyle,
  fontFor: (style: RichInlineRunStyle) => string,
): ResolvedRun[] {
  const resolved: ResolvedRun[] = [];
  for (const run of runs) {
    if (!run.text) continue;
    const style = resolveStyle(run.style, baseStyle);
    const previous = resolved[resolved.length - 1];
    if (previous && stylesEqual(previous.style, style)) {
      previous.text += run.text;
      continue;
    }
    resolved.push({ text: run.text, style, font: fontFor(style) });
  }
  return resolved;
}

function splitRunsAtHardBreaks(runs: readonly RichInlineRun[]): RichInlineRun[][] {
  const lines: RichInlineRun[][] = [[]];
  for (const run of runs) {
    const parts = normalizeHardBreaks(run.text).split("\n");
    for (let index = 0; index < parts.length; index++) {
      if (parts[index]) lines[lines.length - 1].push({ text: parts[index], style: run.style });
      if (index < parts.length - 1) lines.push([]);
    }
  }
  return lines;
}

function resolveOptions(options: TweetPngTextLayoutOptions): ResolvedOptions {
  const baseStyle = resolveStyle(options.baseStyle, DEFAULT_STYLE);
  return {
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    maxLines: Math.max(0, Math.floor(options.maxLines)),
    safeWidth: Math.max(1, options.maxWidth - Math.max(0, options.safetyPx ?? 0)),
    baseStyle,
    fontFor: (style) => tweetPngTextFont(options.fontFamily, options.fontSize, style),
  };
}

type ResolvedOptions = {
  fontFamily: string;
  fontSize: number;
  maxLines: number;
  safeWidth: number;
  baseStyle: RichInlineRunStyle;
  fontFor: (style: RichInlineRunStyle) => string;
};

function resolveStyle(
  style: Partial<RichInlineRunStyle> | undefined,
  base: RichInlineRunStyle,
): RichInlineRunStyle {
  return {
    fontWeight: style?.fontWeight ?? base.fontWeight,
    fontStyle: style?.fontStyle ?? base.fontStyle,
    strikethrough: style?.strikethrough ?? base.strikethrough,
  };
}

function stylesEqual(left: RichInlineRunStyle, right: RichInlineRunStyle): boolean {
  return left.fontWeight === right.fontWeight
    && left.fontStyle === right.fontStyle
    && left.strikethrough === right.strikethrough;
}

function ellipsizeLine(
  context: CanvasRenderingContext2D,
  line: TweetPngTextLine,
  maxWidth: number,
  fallback: { font: string; style: RichInlineRunStyle },
): TweetPngTextLine {
  const fragments = line.fragments.map(cloneFragment);
  const ellipsis = "...";
  let ellipsisFont = fallback.font;
  let ellipsisStyle = fallback.style;

  while (true) {
    const targetIndex = findLastTextFragmentIndex(fragments);
    if (targetIndex < 0) {
      const target = {
        text: ellipsis,
        x: line.textStartX,
        width: measureCanvasText(context, ellipsis, ellipsisFont),
        font: ellipsisFont,
        style: ellipsisStyle,
        role: "text" as const,
      };
      fragments.push(target);
      break;
    }

    const target = fragments[targetIndex];
    ellipsisFont = target.font;
    ellipsisStyle = target.style;
    const graphemes = textGraphemes(target.text.trimEnd());
    let fits = false;
    while (graphemes.length > 0) {
      const candidate = `${graphemes.join("").trimEnd()}${ellipsis}`;
      target.text = candidate;
      target.width = measureCanvasText(context, candidate, target.font);
      if (lineExtent(fragments) <= maxWidth) {
        fits = true;
        break;
      }
      graphemes.pop();
    }
    if (fits) break;
    fragments.splice(targetIndex, 1);
  }

  return {
    width: lineExtent(fragments),
    fragments,
    truncated: true,
    textStartX: line.textStartX,
  };
}

function findLastTextFragmentIndex(fragments: TweetPngTextFragment[]): number {
  for (let index = fragments.length - 1; index >= 0; index--) {
    if (fragments[index].role === "text") return index;
  }
  return -1;
}

function lineExtent(fragments: readonly TweetPngTextFragment[]): number {
  return fragments.reduce((max, fragment) => Math.max(max, fragment.x + fragment.width), 0);
}

function measureCanvasText(context: CanvasRenderingContext2D, text: string, font: string): number {
  const previousFont = context.font;
  context.font = font;
  const metrics = context.measureText(text);
  context.font = previousFont;
  const bounds = Math.abs(metrics.actualBoundingBoxLeft || 0) + Math.abs(metrics.actualBoundingBoxRight || 0);
  return Math.max(metrics.width, bounds);
}

function textGraphemes(text: string): string[] {
  const segmenter = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;
  return segmenter ? Array.from(segmenter.segment(text), (part) => part.segment) : Array.from(text);
}

function normalizeHardBreaks(text: string): string {
  return text.replace(/\r\n?/g, "\n");
}

function blankLine(): TweetPngTextLine {
  return { width: 0, fragments: [], truncated: false, textStartX: 0 };
}

function bulletFragment(
  marker: string,
  width: number,
  font: string,
  style: RichInlineRunStyle,
): TweetPngTextFragment {
  return { text: marker, x: 0, width, font, style, role: "bullet" };
}

function cloneLine(line: TweetPngTextLine): TweetPngTextLine {
  return { ...line, fragments: line.fragments.map(cloneFragment) };
}

function cloneFragment(fragment: TweetPngTextFragment): TweetPngTextFragment {
  return { ...fragment, style: { ...fragment.style } };
}
