export function createOcrProgressView(): { status: HTMLDivElement; text: HTMLSpanElement; bar: HTMLDivElement } {
  const status = document.createElement("div");
  status.className = "post-reading-ocr";
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
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
