import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./content.ts", import.meta.url), "utf8");

describe("Post-reading content regression contracts", () => {
  it("uses the animated smooth painter with the complete boundary options", () => {
    const body = functionBody("updateTweetHighlight");
    expect(body).toContain("highlightEngine.paintSmooth(words, paintTarget.relativeIndex");
    expect(body).not.toContain("highlightEngine.paintSmoothAt(");
    expect(body).toContain("charLength: state.charLength");
    expect(body).toContain("textLength: paintTarget.text.length");
    expect(body).toContain('snapToCurrent: highlightJumped || state.status !== "speaking"');
    expect(body).toContain("boundaryElapsedTime: state.boundaryElapsedTime ?? null");
    expect(body).toContain('leadToNextToken: state.status === "speaking"');
  });

  it("keeps smooth mode for estimated progress and retains long-text segmentation", () => {
    const body = functionBody("updateTweetHighlight");
    expect(body).toContain("const highlightMode = configuredHighlightMode;");
    expect(body).not.toContain('configuredHighlightMode === "smooth" && !state.hasSyncedBoundaries');
    expect(functionBody("findHighlightTargets")).toContain("target.segments = buildSmoothHighlightSegments(target)");
  });

  it("keeps visible autoplay non-scrolling and gates autoscroll by mode and recent user activity", () => {
    const body = functionBody("playAdjacentAutoplay");
    expect(body).toContain("visibleTweets()");
    expect(body).not.toContain("timelineTweets()");
    expect(body).toContain('settings.autoplayMode === "autoscroll" && Date.now() - userScrolledAt > 750');
    expect(body).toContain("window.scrollBy");
    expect(functionBody("visibleTweets")).toContain("rect.bottom > 0 && rect.top < viewportHeight");
  });

  it("keeps explicit post navigation on the ordered timeline and shared button/key handlers", () => {
    const body = functionBody("playAdjacentExplicit");
    expect(body).toContain("timelineTweets()");
    expect(body).not.toContain("visibleTweets()");
    expect(source).toContain("onPrevious: () => previousTweetOrStart()");
    expect(source).toContain("[settings.keyPreviousTweet, () => previousTweetOrStart()]");
  });

  it("routes Next through OCR skipping and quote-to-parent transition before the next post", () => {
    const body = functionBody("nextTweetOrQuotingText");
    const ocr = body.indexOf("skipActiveOcrSpeechRange()");
    const quote = body.indexOf("jumpFromQuoteToMainText()");
    const adjacent = body.indexOf("playAdjacentExplicit(1)");
    expect(ocr).toBeGreaterThanOrEqual(0);
    expect(quote).toBeGreaterThan(ocr);
    expect(adjacent).toBeGreaterThan(quote);
    expect(source).toContain("onNext: () => nextTweetOrQuotingText()");
    expect(source).toContain("[settings.keyNextTweet, () => nextTweetOrQuotingText()]");
  });
});

function functionBody(name: string): string {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`Missing function ${name}`);
  const open = source.indexOf("{", start);
  if (open < 0) throw new Error(`Missing body for ${name}`);
  let depth = 0;
  for (let index = open; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}") depth -= 1;
    if (depth === 0) return source.slice(open + 1, index);
  }
  throw new Error(`Unterminated function ${name}`);
}
