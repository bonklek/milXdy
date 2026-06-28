export function icon(name: "speaker" | "play" | "pause" | "minimize" | "next" | "prev" | "nextChunk" | "prevChunk" | "settings"): string {
  const paths: Record<typeof name, string> = {
    speaker: '<path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18 6a8 8 0 0 1 0 12"/>',
    play: '<path d="M8 5v14l11-7L8 5Z"/>',
    pause: '<path d="M7 5h4v14H7z"/><path d="M13 5h4v14h-4z"/>',
    minimize: '<path d="M6 18h12"/>',
    next: '<path d="m6 5 8 7-8 7V5Z"/><path d="M16 5h2v14h-2z"/>',
    prev: '<path d="M6 5h2v14H6z"/><path d="m18 5-8 7 8 7V5Z"/>',
    nextChunk: '<path d="m7 6 6 6-6 6V6Z"/><path d="m13 6 6 6-6 6V6Z"/>',
    prevChunk: '<path d="m17 6-6 6 6 6V6Z"/><path d="m11 6-6 6 6 6V6Z"/>',
    settings: '<path d="M12 15.5A3.5 3.5 0 1 0 12 8a3.5 3.5 0 0 0 0 7.5Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.3.4.7.7 1.1.7H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1.3Z"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
}
