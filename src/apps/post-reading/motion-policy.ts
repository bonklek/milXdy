import type { BodyHighlightMode } from "./shared/types";

export function readingMotionPolicy(reducedMotion: boolean) {
  return { scrollBehavior: reducedMotion ? "instant" as const : "smooth" as const, smoothHighlight: !reducedMotion };
}
export function readingScrollBehavior(animate = true): ScrollBehavior {
  const policy = readingMotionPolicy(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  return policy.scrollBehavior === "instant" ? "instant" : animate ? "smooth" : "auto";
}
export function reducedMotionHighlightMode(mode: BodyHighlightMode, reducedMotion: boolean): BodyHighlightMode {
  return mode === "smooth" && !readingMotionPolicy(reducedMotion).smoothHighlight ? "word" : mode;
}

/** Follow only text outside the preview viewport; visible words never recenter reading position. */
export function scrollFullQuoteWordIntoView(word: HTMLElement | null): void {
  if (!word) return;
  const container = word.closest<HTMLElement>(".post-reading-full-quote-body");
  if (!container?.closest('.post-reading-full-quote[data-mode="scroll"]')) return;
  window.requestAnimationFrame(() => {
    if (!word.isConnected || !container.isConnected || !container.closest('.post-reading-full-quote[data-mode="scroll"]')) return;
    const wordRect = word.getBoundingClientRect(), bounds = container.getBoundingClientRect();
    const offset = wordRect.top < bounds.top ? wordRect.top - bounds.top : wordRect.bottom > bounds.bottom ? wordRect.bottom - bounds.bottom : 0;
    if (Math.abs(offset) >= 2) container.scrollTo({ top: container.scrollTop + offset, behavior: "instant" });
  });
}

export function observeReadingMotion(stopSmooth: () => void): () => void {
  const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const changed = () => { if (preference.matches) stopSmooth(); };
  preference.addEventListener("change", changed);
  return () => preference.removeEventListener("change", changed);
}
export function readingMotionDisclosure(): HTMLParagraphElement {
  const note = document.createElement("p");
  note.textContent = "System reduced motion always uses static highlighting and instant scrolling, even when Smooth character fill is selected. Autoscroll and Follow current line still follow text when enabled; turn them off under Navigation to preserve your position.";
  return note;
}
