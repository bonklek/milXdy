const STANDARD_POST_ZERO_RE = /^\s*0\s+characters?\s+remaining\s+for\s+a\s+standard\s+post(?:\s*,|\s*$)/iu;

type CounterTextStyle = {
  color: string;
  font: string;
  letterSpacing: string;
};

let lastNativeCounterTextStyle: CounterTextStyle | null = null;

export function isStandardPostZeroAnnouncement(value: string | null | undefined): boolean {
  return STANDARD_POST_ZERO_RE.test(value || "");
}

export function syncLongPostStandardBoundaryCounters(scope: ParentNode): void {
  for (const counter of Array.from(scope.querySelectorAll<HTMLElement>('[data-testid="dual-phase-countdown-circle"]'))) {
    const nativeText = counter.querySelector<HTMLElement>('[data-testid="dual-phase-countdown-circle-text"]');
    const injected = counter.querySelector<HTMLElement>('[data-milxdy-standard-counter-zero="true"]');
    if (nativeText) {
      const computed = getComputedStyle(nativeText);
      lastNativeCounterTextStyle = {
        color: computed.color,
        font: computed.font,
        letterSpacing: computed.letterSpacing,
      };
      injected?.remove();
      continue;
    }

    const announcement = counter.querySelector<HTMLElement>('[aria-live]')?.textContent;
    if (!isStandardPostZeroAnnouncement(announcement)) {
      injected?.remove();
      continue;
    }
    if (injected) continue;

    const holder = counter.lastElementChild;
    if (!(holder instanceof HTMLElement) || holder.getAttribute("role") === "progressbar") continue;
    const zero = document.createElement("div");
    zero.dataset.milxdyStandardCounterZero = "true";
    zero.setAttribute("aria-hidden", "true");
    zero.dir = "auto";
    zero.textContent = "0";
    if (lastNativeCounterTextStyle) {
      zero.style.color = lastNativeCounterTextStyle.color;
      zero.style.font = lastNativeCounterTextStyle.font;
      zero.style.letterSpacing = lastNativeCounterTextStyle.letterSpacing;
    } else {
      zero.className = "milxdy-standard-counter-zero-fallback";
    }
    holder.append(zero);
  }
}
