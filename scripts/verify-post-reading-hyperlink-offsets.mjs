import assert from "node:assert/strict";

function buildSmoothParts(text) {
  const raw = text.match(/\s*[\p{L}\p{N}_'-]+[^\s\p{L}\p{N}_'-]*|\s+|[^\s\p{L}\p{N}_'-]+/gu) || [];
  const parts = [];
  for (const part of raw) {
    if (!part) continue;
    const last = parts[parts.length - 1];
    if (/^\s+$/.test(part) && last && !/\s$/.test(last)) {
      parts[parts.length - 1] += part;
    } else {
      parts.push(part);
    }
  }
  return parts;
}

function tokenizeSegments(segments, mode, includeHyperlinks) {
  const tokens = [];
  let cursor = 0;
  let skippedReadableHyperlink = false;
  let countedTextEndsWithWhitespace = false;

  for (const segment of segments) {
    if (segment.readableHyperlink && !includeHyperlinks) {
      skippedReadableHyperlink = true;
      continue;
    }

    const uncountedPrefix = skippedReadableHyperlink && countedTextEndsWithWhitespace
      ? segment.text.match(/^\s+/)?.[0] || ""
      : "";
    const text = uncountedPrefix ? segment.text.slice(uncountedPrefix.length) : segment.text;
    skippedReadableHyperlink = false;

    const parts = mode === "smooth"
      ? buildSmoothParts(text)
      : text.match(/\S+|\s+/g) || [];

    for (const part of parts) {
      if (/^\s+$/.test(part) && mode === "word") {
        cursor += part.length;
        countedTextEndsWithWhitespace = true;
        continue;
      }
      tokens.push({ text: part, start: cursor, length: part.length });
      cursor += part.length;
      countedTextEndsWithWhitespace = /\s$/.test(part);
    }
  }

  return tokens;
}

const segments = [
  { text: "Hello " },
  { text: "https://t.co/example", readableHyperlink: true },
  { text: " world" },
];

assert.deepEqual(tokenizeSegments(segments, "word", false), [
  { text: "Hello", start: 0, length: 5 },
  { text: "world", start: 6, length: 5 },
]);

assert.deepEqual(tokenizeSegments(segments, "smooth", false), [
  { text: "Hello ", start: 0, length: 6 },
  { text: "world", start: 6, length: 5 },
]);

assert.deepEqual(tokenizeSegments(segments, "word", true), [
  { text: "Hello", start: 0, length: 5 },
  { text: "https://t.co/example", start: 6, length: 20 },
  { text: "world", start: 27, length: 5 },
]);

assert.deepEqual(tokenizeSegments(segments, "smooth", true), [
  { text: "Hello ", start: 0, length: 6 },
  { text: "https://", start: 6, length: 8 },
  { text: "t.", start: 14, length: 2 },
  { text: "co/", start: 16, length: 3 },
  { text: "example", start: 19, length: 7 },
  { text: " world", start: 26, length: 6 },
]);

console.log("post-reading hyperlink offset verification passed");
