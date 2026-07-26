export function findAdjacentLineStart(text: string, currentIndex: number, direction: 1 | -1): number | null {
  if (!text) return null;
  const starts = readableSpeechBoundaryStarts(text);
  if (starts.length <= 1) return null;
  const current = Math.max(0, Math.min(text.length, currentIndex));

  if (direction === 1) {
    return starts.find((start) => start > current) ?? null;
  }

  const currentLineIndex = findCurrentLineIndex(starts, current);
  return currentLineIndex > 0 ? starts[currentLineIndex - 1] ?? null : null;
}

export function readableSpeechBoundaryStarts(text: string): number[] {
  const lineStarts = readableLineStarts(text);
  if (lineStarts.length > 1) return lineStarts;

  const sentenceStarts = readableSentenceStarts(text);
  if (sentenceStarts.length > 1) return sentenceStarts;

  return readableChunkStarts(text);
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

export function findExplicitPostTarget<T>(
  orderedPosts: readonly T[],
  currentPost: T | null,
  direction: 1 | -1,
  isEligible: (post: T) => boolean = () => true,
): T | null {
  const currentIndex = currentPost === null ? -1 : orderedPosts.indexOf(currentPost);
  const candidates = currentIndex >= 0
    ? direction === 1
      ? orderedPosts.slice(currentIndex + 1)
      : orderedPosts.slice(0, currentIndex).reverse()
    : direction === 1
      ? orderedPosts
      : [...orderedPosts].reverse();
  return candidates.find((post) => post !== currentPost && isEligible(post)) ?? null;
}

export function findVisibleAutoplayTarget<T>(
  visiblePosts: readonly T[],
  currentPost: T | null,
  isEligible: (post: T) => boolean = () => true,
): T | null {
  const currentIndex = currentPost === null ? -1 : visiblePosts.indexOf(currentPost);
  const candidates = currentIndex >= 0 ? visiblePosts.slice(currentIndex + 1) : visiblePosts;
  return candidates.find((post) => post !== currentPost && isEligible(post)) ?? null;
}

export function shouldRestartCurrentPost(currentIndex: number | null, startIndex = 0): boolean {
  return currentIndex !== null && currentIndex > startIndex;
}

type SpeechNavigationState = {
  status: string;
  text: string;
  charIndex: number | null;
  chunkStart: number | null;
};

type SpeechNavigationController = {
  getState: () => SpeechNavigationState;
  jumpToCharIndex: (charIndex: number) => void;
};

export function jumpToAdjacentSpeechBoundary(
  controller: SpeechNavigationController,
  direction: 1 | -1,
  onJump: () => void,
): number | null {
  const state = controller.getState();
  if ((state.status !== "speaking" && state.status !== "paused") || !state.text) return null;
  const currentIndex = state.charIndex ?? state.chunkStart ?? 0;
  const target = findAdjacentLineStart(state.text, currentIndex, direction);
  if (target === null || target === currentIndex) return null;
  controller.jumpToCharIndex(target);
  onJump();
  return target;
}

function readableSentenceStarts(text: string): number[] {
  const first = firstReadableIndex(text);
  if (first === null) return [];
  const starts = [first];
  const matcher = /[.!?]+(?:["'’”)]*)\s+/g;
  let match: RegExpExecArray | null;
  while ((match = matcher.exec(text))) {
    const start = nextReadableIndex(text, matcher.lastIndex);
    if (start !== null && start > starts[starts.length - 1]!) starts.push(start);
  }
  return starts;
}

function readableChunkStarts(text: string, targetLength = 240): number[] {
  const first = firstReadableIndex(text);
  if (first === null) return [];
  const starts = [first];
  let cursor = first;
  while (text.length - cursor > targetLength) {
    const lowerBound = cursor + Math.floor(targetLength * 0.65);
    const upperBound = Math.min(text.length, cursor + Math.ceil(targetLength * 1.2));
    const slice = text.slice(lowerBound, upperBound);
    const whitespace = slice.search(/\s+/);
    if (whitespace < 0) break;
    const start = nextReadableIndex(text, lowerBound + whitespace);
    if (start === null || start <= cursor) break;
    starts.push(start);
    cursor = start;
  }
  return starts;
}

function firstReadableIndex(text: string): number | null {
  return nextReadableIndex(text, 0);
}

function nextReadableIndex(text: string, from: number): number | null {
  const match = /\S/.exec(text.slice(Math.max(0, from)));
  return match ? Math.max(0, from) + match.index : null;
}

function findCurrentLineIndex(starts: number[], currentIndex: number): number {
  let result = 0;
  for (const [index, start] of starts.entries()) {
    if (start > currentIndex) break;
    result = index;
  }
  return result;
}
