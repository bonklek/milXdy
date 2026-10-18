// Bounded HTML anchor parsing and visible-text normalization for release scans.
const MAX_ANCHOR_ENTITIES = 4096;
const MAX_ANCHORS = 32_768;
const MAX_TOTAL_ANCHOR_ENTITIES = 65_536;
const MAX_ENTITY_NAME_LENGTH = 32;
const MAX_NUMERIC_ENTITY_DIGITS = 8;
// Unicode Default_Ignorable_Code_Point ranges are explicit so scanner behavior is
// bounded and reviewable rather than changing with the JavaScript runtime's Unicode data.
const DEFAULT_IGNORABLE_CODE_POINTS = /[\u00ad\u034f\u061c\u115f-\u1160\u17b4-\u17b5\u180b-\u180f\u200b-\u200f\u202a-\u202e\u2060-\u206f\u3164\ufe00-\ufe0f\ufeff\uffa0\ufff0-\ufffb\u{1bca0}-\u{1bca3}\u{1d173}-\u{1d17a}\u{e0000}-\u{e0fff}]/gu;

export function assertNoAmbiguousRemiliaNavigation(archivePath, entryName, text) {
  const entityBudget = { count: 0 };
  for (const anchor of findAnchors(text)) {
    let visibleText;
    try {
      visibleText = decodeVisibleAnchorText(anchor.text, entityBudget);
    } catch {
      throw new Error(`${archivePath}:${entryName}: malformed anchor text detected`);
    }
    if (/^Open RemiliaNET$/i.test(visibleText) && anchor.text !== "Open RemiliaNET") {
      throw new Error(`${archivePath}:${entryName}: retired browser-session UI detected`);
    }
  }
}

export function normalizeAnchorVisibleText(text) {
  const anchors = findAnchors(text);
  const chunks = [];
  const entityBudget = { count: 0 };
  let cursor = 0;
  for (const anchor of anchors) {
    if (anchor.index < cursor || anchor.end < anchor.index || anchor.end > text.length) {
      throw new Error("overlapping or invalid anchor interval");
    }
    chunks.push(
      text.slice(cursor, anchor.index),
      anchor.openingTag,
      decodeVisibleAnchorText(anchor.text, entityBudget),
      anchor.closingTag,
    );
    cursor = anchor.end;
  }
  chunks.push(text.slice(cursor));
  return chunks.join("");
}

function decodeVisibleAnchorText(value, globalBudget = { count: 0 }) {
  const namedWhitespace = new Map([
    ["nbsp", "\u00a0"], ["NonBreakingSpace", "\u00a0"], ["Tab", "\t"], ["NewLine", "\n"],
    ["ensp", "\u2002"], ["emsp", "\u2003"], ["emsp13", "\u2004"], ["emsp14", "\u2005"],
    ["numsp", "\u2007"], ["puncsp", "\u2008"], ["thinsp", "\u2009"], ["ThinSpace", "\u2009"],
    ["hairsp", "\u200a"], ["VeryThinSpace", "\u200a"], ["MediumSpace", "\u205f"], ["ThickSpace", "\u205f\u200a"],
    ["ZeroWidthSpace", "\u200b"],
    ["NegativeThinSpace", "\u200b"], ["NegativeMediumSpace", "\u200b"],
    ["NegativeThickSpace", "\u200b"], ["NegativeVeryThinSpace", "\u200b"],
    ["zwnj", "\u200c"], ["zwj", "\u200d"], ["lrm", "\u200e"], ["rlm", "\u200f"],
    ["shy", "\u00ad"],
    ["NoBreak", "\u2060"], ["ApplyFunction", "\u2061"], ["af", "\u2061"],
    ["InvisibleTimes", "\u2062"], ["it", "\u2062"], ["InvisibleComma", "\u2063"], ["ic", "\u2063"],
  ]);
  const withoutMarkup = value.replace(/<[^>]*>/g, "");
  let decoded = "";
  let entityCount = 0;
  for (let index = 0; index < withoutMarkup.length; index += 1) {
    if (withoutMarkup[index] !== "&") {
      decoded += withoutMarkup[index];
      continue;
    }
    entityCount += 1;
    if (entityCount > MAX_ANCHOR_ENTITIES) throw new Error("too many HTML entities");
    globalBudget.count += 1;
    if (globalBudget.count > MAX_TOTAL_ANCHOR_ENTITIES) throw new Error("global HTML entity limit exceeded");
    if (withoutMarkup[index + 1] === "#") {
      const hexadecimal = withoutMarkup[index + 2] === "x" || withoutMarkup[index + 2] === "X";
      const digitStart = index + (hexadecimal ? 3 : 2);
      let digitEnd = digitStart;
      const digitPattern = hexadecimal ? /[0-9a-f]/i : /[0-9]/;
      while (digitEnd < withoutMarkup.length && digitPattern.test(withoutMarkup[digitEnd])) digitEnd += 1;
      const digits = withoutMarkup.slice(digitStart, digitEnd);
      if (!digits || digits.length > MAX_NUMERIC_ENTITY_DIGITS || withoutMarkup[digitEnd] !== ";") {
        throw new Error("invalid numeric HTML entity");
      }
      decoded += decodeNumericEntity(Number.parseInt(digits, hexadecimal ? 16 : 10));
      index = digitEnd;
      continue;
    }
    let nameEnd = index + 1;
    while (nameEnd < withoutMarkup.length && /[A-Za-z0-9]/.test(withoutMarkup[nameEnd])) nameEnd += 1;
    const name = withoutMarkup.slice(index + 1, nameEnd);
    if (name.length > MAX_ENTITY_NAME_LENGTH) throw new Error("HTML entity name too long");
    if (name && withoutMarkup[nameEnd] === ";") {
      decoded += namedWhitespace.get(name) ?? withoutMarkup.slice(index, nameEnd + 1);
      index = nameEnd;
      continue;
    }
    decoded += "&";
  }
  return decoded
    .replace(DEFAULT_IGNORABLE_CODE_POINTS, "")
    .replace(/[\s\u00a0\u2002-\u200b\u205f]+/g, " ")
    .trim();
}

function decodeNumericEntity(codePoint) {
  if (!Number.isInteger(codePoint)
    || codePoint < 0
    || codePoint > 0x10ffff
    || (codePoint >= 0xd800 && codePoint <= 0xdfff)) {
    throw new Error("invalid numeric HTML entity");
  }
  return String.fromCodePoint(codePoint);
}

export function findAnchors(text) {
  const anchors = [];
  const lower = text.toLowerCase();
  const startPattern = /<a(?=[\t\n\f\r >])/gi;
  for (let start = startPattern.exec(text); start; start = startPattern.exec(text)) {
    let quote = "";
    let openingEnd = -1;
    for (let index = start.index + 2; index < text.length; index += 1) {
      const character = text[index];
      if (quote) {
        if (character === quote) quote = "";
      } else if (character === '"' || character === "'") {
        quote = character;
      } else if (character === ">") {
        openingEnd = index + 1;
        break;
      }
    }
    if (openingEnd === -1) continue;
    const closingStart = lower.indexOf("</a>", openingEnd);
    if (closingStart === -1) continue;
    anchors.push({
      index: start.index,
      openingTag: text.slice(start.index, openingEnd),
      text: text.slice(openingEnd, closingStart),
      closingTag: text.slice(closingStart, closingStart + 4),
      end: closingStart + 4,
    });
    if (anchors.length > MAX_ANCHORS) throw new Error("anchor count limit exceeded");
    startPattern.lastIndex = closingStart + 4;
  }
  return anchors;
}

export function parseAnchorAttributes(openingTag) {
  const attributes = [];
  let index = 2;
  while (index < openingTag.length - 1) {
    while (/[\t\n\f\r ]/.test(openingTag[index])) index += 1;
    if (index >= openingTag.length - 1 || openingTag[index] === ">") break;
    if (openingTag[index] === "/") {
      index += 1;
      continue;
    }
    const nameStart = index;
    while (index < openingTag.length && !/[\t\n\f\r =>/]/.test(openingTag[index])) index += 1;
    const name = openingTag.slice(nameStart, index).toLowerCase();
    while (/[\t\n\f\r ]/.test(openingTag[index])) index += 1;
    if (openingTag[index] !== "=") {
      attributes.push({ name, quoted: false, value: "" });
      continue;
    }
    index += 1;
    while (/[\t\n\f\r ]/.test(openingTag[index])) index += 1;
    const delimiter = openingTag[index];
    if (delimiter === '"' || delimiter === "'") {
      index += 1;
      const valueStart = index;
      while (index < openingTag.length && openingTag[index] !== delimiter) index += 1;
      attributes.push({ name, quoted: true, value: openingTag.slice(valueStart, index) });
      if (openingTag[index] === delimiter) index += 1;
    } else {
      const valueStart = index;
      while (index < openingTag.length && !/[\t\n\f\r >]/.test(openingTag[index])) index += 1;
      attributes.push({ name, quoted: false, value: openingTag.slice(valueStart, index) });
    }
  }
  return attributes;
}
