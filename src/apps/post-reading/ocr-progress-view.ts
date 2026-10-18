import { finiteProgress } from "./reading-status";
import type { OcrProgress } from "./ocr";
export function createOcrProgressView(): { status: HTMLDivElement; text: HTMLSpanElement; bar: HTMLDivElement } {
  const status = document.createElement("div");
  status.className = "post-reading-ocr";
  // Numeric updates stay outside live regions; the player announces coarse progress separately.
  status.hidden = true;
  const ocrDetails = document.createElement("div");
  ocrDetails.className = "post-reading-ocr-details";
  const text = document.createElement("span");
  const bar = document.createElement("div");
  bar.className = "post-reading-ocr-bar";
  bar.setAttribute("role", "progressbar");
  bar.setAttribute("aria-valuemin", "0");
  bar.setAttribute("aria-valuemax", "100");
  bar.setAttribute("aria-label", "OCR progress");
  bar.innerHTML = '<span></span>';
  ocrDetails.append(text, bar);
  status.append(ocrDetails);

  return { status, text, bar };
}

export function updateOcrProgressView(text: HTMLSpanElement, bar: HTMLDivElement, progress: OcrProgress | null): string {
  if (!progress) { text.textContent = ""; bar.style.setProperty("--post-reading-ocr-progress", "0%"); bar.removeAttribute("aria-valuenow"); bar.removeAttribute("aria-valuetext"); return ""; }
  const percent = finiteProgress(progress.progress);
  const image = progress.imageCount > 1 ? ` image ${progress.imageIndex + 1}/${progress.imageCount}` : "";
  const message = `${percent === null ? "" : `Stage ${percent}%: `}${progress.status}${image}`;
  text.textContent = message; bar.setAttribute("aria-valuetext", message);
  bar.style.setProperty("--post-reading-ocr-progress", `${percent ?? 0}%`);
  if (percent === null) bar.removeAttribute("aria-valuenow"); else bar.setAttribute("aria-valuenow", String(percent));
  return message;
}
