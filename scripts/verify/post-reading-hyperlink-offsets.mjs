import assert from "node:assert/strict";
import { layoutHighlightTextSegments } from "../../src/apps/post-reading/highlightEngine.ts";

function tokenizeSegments(segments, mode, includeHyperlinks) {
  return layoutHighlightTextSegments(segments.map((segment) => ({
    text: segment.text,
    included: includeHyperlinks || !segment.readableHyperlink,
  })), mode).flatMap((layout) => layout.parts
    .filter((part) => part.token)
    .map((part) => ({ text: part.text, start: part.start, length: part.text.length })));
}

const segments = [
  { text: "Hello " },
  { text: "https://t.co/example", readableHyperlink: true },
  { text: " world" },
];

for (const mode of ["word", "smooth"]) {
  const withoutLinks = tokenizeSegments(segments, mode, false);
  assertTokenOffsets(withoutLinks, "Hello world");
  assert.equal(withoutLinks.some((token) => token.text.includes("http")), false);
  assert.deepEqual(tokenPosition(withoutLinks, "Hello"), { start: 0, length: 5 });
  assert.deepEqual(tokenPosition(withoutLinks, "world"), { start: 6, length: 5 });

  const withLinks = tokenizeSegments(segments, mode, true);
  assertTokenOffsets(withLinks, "Hello https://t.co/example world");
  assert.deepEqual(tokenPosition(withLinks, "Hello"), { start: 0, length: 5 });
  assert.deepEqual(tokenPosition(withLinks, "world"), { start: 27, length: 5 });
  assert.equal(withLinks.some((token) => token.start <= 6 && token.start + token.length > 6), true);
}

function assertTokenOffsets(tokens, countedText) {
  let previousEnd = 0;
  for (const token of tokens) {
    assert(token.start >= previousEnd, `token offsets overlap at ${JSON.stringify(token)}`);
    assert.equal(countedText.slice(token.start, token.start + token.length), token.text);
    previousEnd = token.start + token.length;
  }
}

function tokenPosition(tokens, text) {
  const token = tokens.find((entry) => entry.text.trim() === text);
  assert(token, `missing token ${text}`);
  const leadingWhitespace = token.text.length - token.text.trimStart().length;
  return { start: token.start + leadingWhitespace, length: text.length };
}

console.log("post-reading hyperlink offset verification passed");
