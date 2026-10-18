// Static JavaScript spellings recognized by the local-package payload scanner.
const staticSensitiveStringValues = Object.freeze([
  "chrome",
  "browser",
  "runtime",
  "sendMessage",
  "connect",
]);

export function runtimeApiPattern(objectPattern, methodName) {
  return new RegExp(`\\b${objectPattern}${jsTriviaPattern()}${propertyAccessPattern("runtime")}${jsTriviaPattern()}${propertyAccessPattern(methodName)}${jsTriviaPattern()}\\(`, "g");
}

export function privilegedNamespacePattern(objectPattern) {
  return new RegExp(`\\b${objectPattern}${jsTriviaPattern()}${propertyAccessPattern("(?:storage|tabs|cookies|scripting|permissions|downloads|webRequest|runtime|extension)", false)}`, "g");
}

export function propertyAccessPattern(propertyPattern, quoteLiteral = true) {
  const trivia = jsTriviaPattern();
  const bracket = quoteLiteral
    ? `\\[${trivia}${stringExpressionPattern(propertyPattern)}${trivia}\\]`
    : `\\[${trivia}${staticStringLiteralAlternationPattern(propertyPattern)}${trivia}\\]`;
  return `(?:\\.${trivia}${propertyPattern}|${bracket})`;
}

export function globalApiPattern(globalName) {
  const escaped = escapeRegExp(globalName);
  return `(?:${escaped}|(?:globalThis|window|self)${jsTriviaPattern()}${propertyAccessPattern(escaped)}|${reflectGlobalApiPattern(globalName).source})`;
}

export function reflectGlobalApiPattern(globalName = "(?:chrome|browser)") {
  const names = globalName === "chrome" || globalName === "browser" ? [globalName] : ["chrome", "browser"];
  const stringPatterns = names.map((name) => stringExpressionPattern(name));
  const trivia = jsTriviaPattern();
  return new RegExp(`\\bReflect${trivia}\\.${trivia}get${trivia}\\(${trivia}(?:globalThis|window|self)${trivia},${trivia}(?:${stringPatterns.join("|")})${trivia}\\)`, "g");
}

function stringExpressionPattern(value) {
  const literal = staticStringLiteralPattern(value);
  return `(?:${literal}|String\\(${jsTriviaPattern()}${literal}${jsTriviaPattern()}\\)|${arrayJoinStringExpressionPattern(value)}|${charCodeStringExpressionPattern(value)}|${atobStringExpressionPattern(value)})`;
}

export function constructedStringExpressionPattern(value) {
  return `(?:${staticStringLiteralPattern(value)}|${concatenatedStringExpressionPattern(value)}|${arrayJoinStringExpressionPattern(value)}|${charCodeStringExpressionPattern(value)}|${atobStringExpressionPattern(value)})`;
}

export function knownSensitiveStringExpressionPattern() {
  return staticSensitiveStringValues.map(constructedStringExpressionPattern).join("|");
}

export function staticSensitiveStringValue(expression) {
  const normalized = expression.replace(/\s+/g, "");
  for (const value of staticSensitiveStringValues) {
    const exactPatterns = [
      staticStringLiteralPattern(value),
      `String\\(${staticStringLiteralPattern(value)}\\)`,
      concatenatedStringExpressionPattern(value),
      arrayJoinStringExpressionPattern(value),
      charCodeStringExpressionPattern(value),
      atobStringExpressionPattern(value),
    ].map((pattern) => new RegExp(`^${pattern}$`));
    if (exactPatterns.some((pattern) => pattern.test(normalized))) return value;
  }
  return null;
}

function staticStringLiteralPattern(value) {
  return `(?:${quoteDelimitedStringLiteralPattern(value, "'")}|${quoteDelimitedStringLiteralPattern(value, "\"")}|${quoteDelimitedStringLiteralPattern(value, "`")})`;
}

function staticStringLiteralAlternationPattern(valuePattern) {
  const alternatives = valuePattern.startsWith("(?:") && valuePattern.endsWith(")")
    ? valuePattern.slice(3, -1).split("|")
    : [valuePattern];
  return `(?:${alternatives.map(staticStringLiteralPattern).join("|")})`;
}

function quoteDelimitedStringLiteralPattern(value, quote) {
  const delimiter = escapeRegExp(quote);
  return `${delimiter}${[...value].map((char) => staticStringLiteralCharPattern(char, quote)).join("")}${delimiter}`;
}

function staticStringLiteralCharPattern(char, quote) {
  const alternatives = [escapeRegExp(char)];
  const code = char.codePointAt(0);
  if (code !== undefined) {
    alternatives.push(`\\\\x${hexDigitPattern(code.toString(16).padStart(2, "0"))}`);
    alternatives.push(`\\\\u${hexDigitPattern(code.toString(16).padStart(4, "0"))}`);
    alternatives.push(`\\\\u\\{0*${hexDigitPattern(code.toString(16))}\\}`);
  }
  if (char === quote) alternatives.shift();
  return `(?:${unique(alternatives).join("|")})`;
}

function hexDigitPattern(value) {
  return [...value].map((char) => /[a-f]/.test(char) ? `[${char}${char.toUpperCase()}]` : char).join("");
}

function concatenatedStringExpressionPattern(value) {
  if (!staticSensitiveStringValues.includes(value)) return `(?!x)x`;
  const trivia = jsTriviaPattern();
  return partitionedStringLiteralPattern(value, `${trivia}\\+${trivia}`, { requireSeparator: true });
}

function arrayJoinStringExpressionPattern(value) {
  if (!staticSensitiveStringValues.includes(value)) return `(?!x)x`;
  const trivia = jsTriviaPattern();
  return `\\[${trivia}${partitionedStringLiteralPattern(value, `${trivia},${trivia}`, { requireSeparator: false })}${trivia}\\]${trivia}\\.${trivia}join${trivia}\\(${trivia}(?:""|'')?${trivia}\\)`;
}

export function charCodeStringExpressionPattern(value) {
  const trivia = jsTriviaPattern();
  return `String${trivia}\\.${trivia}fromCharCode${trivia}\\(${trivia}${[...value].map((char) => numericLiteralPattern(char.charCodeAt(0))).join(`${trivia},${trivia}`)}${trivia}\\)`;
}

export function atobStringExpressionPattern(value) {
  const encoded = Buffer.from(value, "utf8").toString("base64");
  const encodings = unique([encoded, encoded.replace(/=+$/g, "")]).filter(Boolean);
  if (encodings.length === 0) return `(?!x)x`;
  const trivia = jsTriviaPattern();
  const callee = `(?:atob|(?:globalThis|window|self)(?:${trivia}\\.${trivia}atob|${trivia}\\[${trivia}["']atob["']${trivia}\\]))`;
  return `${callee}${trivia}\\(${trivia}(?:${encodings.map((item) => `["']${escapeRegExp(item)}["']`).join("|")})${trivia}\\)`;
}

export function jsTriviaPattern() {
  return `(?:\\s|/\\*[\\s\\S]*?\\*/|//[^\\r\\n]*(?:\\r?\\n|$))*`;
}

function numericLiteralPattern(value) {
  const decimalPattern = digitsWithOptionalSeparators(String(value));
  const hexPattern = digitsWithOptionalSeparators(value.toString(16), true);
  const binaryPattern = digitsWithOptionalSeparators(value.toString(2));
  const octalPattern = digitsWithOptionalSeparators(value.toString(8));
  return `(?:${decimalPattern}|0[xX]${hexPattern}|0[bB]${binaryPattern}|0[oO]${octalPattern})`;
}

function digitsWithOptionalSeparators(value, caseInsensitive = false) {
  return [...value].map((char) => {
    if (caseInsensitive && /[a-f]/.test(char)) return `[${char}${char.toUpperCase()}]`;
    return char;
  }).join("_?");
}

function partitionedStringLiteralPattern(value, separatorPattern, { requireSeparator }) {
  const chars = [...value].map(escapeRegExp);
  const optionalSeparator = `(?:["']${separatorPattern}["'])?`;
  const patternForRequiredBoundary = (requiredBoundary) => {
    let pattern = `["']`;
    for (let index = 0; index < chars.length; index += 1) {
      pattern += chars[index];
      if (index < chars.length - 1) {
        pattern += index === requiredBoundary ? `["']${separatorPattern}["']` : optionalSeparator;
      }
    }
    return `${pattern}["']`;
  };
  if (!requireSeparator) return patternForRequiredBoundary(-1);
  return `(?:${chars.slice(0, -1).map((_, index) => patternForRequiredBoundary(index)).join("|")})`;
}

export function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function unique(values) {
  return Array.from(new Set(values.filter((value) => value !== undefined && value !== null)));
}
