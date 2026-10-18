import type { SpeechState } from "./shared/types";
import type { OcrProgress } from "./ocr";

/** Coalesce rapid updates; stable semantic keys exclude word boundaries and fine-grained percentages. */
export type ReadingSchedule = (callback: () => void, delay: number) => () => void;
export function createReadingAnnouncer(publish: (text: string, failed: boolean) => void, schedule: ReadingSchedule, delay = 900) {
  let disposed = false;
  let timer: (() => void) | undefined;
  let pending: { text: string; key: string } | undefined;
  let lastKey = "", lastError = "";
  return {
    say(text: string, key: string, failed = false) {
      if (disposed) return;
      if (failed) {
        timer?.(); timer = undefined; pending = undefined;
        if (lastError !== text) { lastError = text; publish(text, true); }
        return;
      }
      if (lastError) { lastError = ""; lastKey = ""; }
      if (key === pending?.key) return;
      if (key === lastKey) { timer?.(); timer = undefined; pending = undefined; return; }
      pending = { text, key };
      if (timer !== undefined) return;
      timer = schedule(() => {
        timer = undefined;
        if (!pending) return;
        lastKey = pending.key; publish(pending.text, false); pending = undefined;
      }, delay);
    },
    cancel(prefix: string) { if (pending?.key.startsWith(prefix)) { timer?.(); timer = undefined; pending = undefined; } if (lastKey.startsWith(prefix)) lastKey = ""; },
    dispose() { disposed = true; timer?.(); timer = undefined; pending = undefined; },
  };
}

export function createReadingStatusView(schedule: ReadingSchedule) {
  const live = document.createElement("div"); live.className = "post-reading-live-status";
  const polite = document.createElement("span"), failure = document.createElement("span");
  polite.className = "post-reading-a11y-status"; failure.className = "post-reading-error-feedback"; failure.hidden = true;
  polite.setAttribute("role", "status"); polite.setAttribute("aria-live", "polite"); polite.setAttribute("aria-atomic", "true");
  failure.setAttribute("role", "alert"); failure.setAttribute("aria-atomic", "true");
  live.append(polite, failure);
  const progress = document.createElement("div"); progress.className = "post-reading-speech-progress"; progress.hidden = true;
  progress.setAttribute("role", "progressbar"); progress.setAttribute("aria-label", "Reading progress"); progress.setAttribute("aria-valuemin", "0");
  const numeric = document.createElement("span"); numeric.setAttribute("aria-hidden", "true"); progress.append(numeric);
  const announcer = createReadingAnnouncer((text, failed) => { (failed ? polite : failure).textContent = ""; failure.hidden = !failed; (failed ? failure : polite).textContent = text; }, schedule);
  return {
    live, progress,
    speech(state: SpeechState) {
      const count = Number.isFinite(state.chunkCount) ? Math.max(0, Math.floor(state.chunkCount)) : 0;
      const index = Number.isFinite(state.chunkIndex) ? Math.max(0, Math.min(count, Math.floor(state.chunkIndex))) : 0;
      progress.hidden = count === 0;
      progress.setAttribute("aria-valuemax", String(count)); progress.setAttribute("aria-valuenow", String(index));
      const waiting = state.status === "speaking" && state.hasStarted === false;
      const value = `${waiting ? "Waiting for playback; line" : "Line"} ${index} of ${count}`; progress.setAttribute("aria-valuetext", value); numeric.textContent = value;
      const message = state.error || (state.isPriming ? "Preparing selected voice" : waiting ? "Starting playback" : state.status === "speaking" ? `Reading ${state.title || "selected text"}` : state.status === "paused" ? "Reading paused" : "Reading stopped");
      announcer.say(message, `speech:${state.status}:${Boolean(state.isPriming)}:${waiting}:${state.title}`, Boolean(state.error));
    },
    ocr(progress: OcrProgress | null) {
      if (!progress) { announcer.cancel("ocr:"); return; }
      const percent = finiteProgress(progress.progress);
      const milestone = percent === null ? "" : ` ${Math.floor(percent / 25) * 25}%`;
      const image = progress.imageCount > 1 ? ` image ${progress.imageIndex + 1} of ${progress.imageCount}` : "";
      const failed = /failed|error|unavailable/iu.test(progress.status);
      announcer.say(`${progress.status}${image}${milestone}`, `ocr:${progress.status}:${progress.imageIndex}:${milestone}`, failed);
    },
    dispose: announcer.dispose,
  };
}
export function finiteProgress(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(Math.max(0, Math.min(1, value)) * 100) : null;
}
