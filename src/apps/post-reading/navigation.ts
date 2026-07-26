export function findAdjacentLineStart(text: string, currentIndex: number, direction: 1 | -1): number | null {
  if (!text) return null;
  const starts = readableLineStarts(text);
  if (starts.length <= 1) return null;
  const current = Math.max(0, Math.min(text.length, currentIndex));

  if (direction === 1) {
    return starts.find((start) => start > current) ?? null;
  }

  const currentLineIndex = findCurrentLineIndex(starts, current);
  return currentLineIndex > 0 ? starts[currentLineIndex - 1] ?? null : null;
}

export function readableLineStarts(text: string): number[] {
  if (!text) return [];
  const starts: number[] = [];
  let cursor = 0;
  for (const part of text.split(/(\n+)/)) {
    if (!part) continue;
    if (/^\n+$/.test(part)) {
      cursor += part.length;
      continue;
    }
    const leadingWhitespace = part.match(/^[^\S\n]*/)?.[0].length ?? 0;
    if (part.slice(leadingWhitespace).trim()) starts.push(cursor + leadingWhitespace);
    cursor += part.length;
  }
  return starts;
}

function findCurrentLineIndex(starts: number[], currentIndex: number): number {
  let result = 0;
  for (const [index, start] of starts.entries()) {
    if (start > currentIndex) break;
    result = index;
  }
  return result;
}
