/** A visual companion to the website's own claim result; never a claim transport. */
const CLAIM_SELECTOR = ".ubc-module-interface .claim-button";
const LOG_SELECTOR = "#log .messages";
const POPUP_ID = "milxdy-native-cheese-streak";

export function nativeCheeseStreakFromMessage(message: string): number | null {
  const match = /^YOU HAVE CLAIMED \d+ PIECES OF CHEESE! Streak: ([1-9]\d*)$/.exec(message.trim());
  if (!match) return null;
  const streak = Number(match[1]);
  return Number.isSafeInteger(streak) ? streak : null;
}

export function trustedNativeCheeseClaimButton(
  event: Pick<MouseEvent, "isTrusted" | "target">,
): HTMLButtonElement | null {
  if (!event.isTrusted || !event.target || typeof event.target !== "object") return null;
  const target = event.target as Element;
  if (target.nodeType !== 1 || typeof target.closest !== "function") return null;
  const button = target.closest<HTMLButtonElement>(CLAIM_SELECTOR);
  if (!button || button.disabled || button.classList.contains("disabled") || button.closest(".disconnected")) return null;
  return button;
}

export function showNativeCheeseStreak(button: HTMLButtonElement, streak: number): void {
  const bounds = button.getBoundingClientRect();
  if (!bounds.width || !bounds.height) return;
  document.getElementById(POPUP_ID)?.remove();
  const popup = document.createElement("span");
  popup.id = POPUP_ID;
  popup.textContent = String(streak);
  popup.setAttribute("role", "status");
  popup.setAttribute("aria-label", `Cheese claim streak: ${streak}`);
  Object.assign(popup.style, {
    position: "fixed", left: `${bounds.left + bounds.width / 2}px`, top: `${Math.max(8, bounds.top - 32)}px`,
    transform: "translateX(-50%)", zIndex: "2147483647", pointerEvents: "none",
    color: "#ff3636", font: "900 30px/1.1 system-ui, sans-serif", textShadow: "0 2px 2px #000, 1px 0 #000, -1px 0 #000",
  });
  document.documentElement.append(popup);
  // Web Animations avoids the fast-results CSS shortening this decorative effect.
  // Users requesting reduced motion receive the same count without movement.
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    popup.animate([
      { transform: "translate(-50%, 0)", opacity: 1 },
      { transform: "translate(-50%, -28px)", opacity: 1, offset: 0.6 },
      { transform: "translate(-50%, -52px)", opacity: 0 },
    ], { duration: 1200, easing: "ease-out", fill: "forwards" });
  }
  setTimeout(() => popup.remove(), 1300);
}

export function installNativeCheeseStreakFeedback(isBeetleRoute: () => boolean): void {
  let observer: MutationObserver | null = null;
  let expiry: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    observer?.disconnect();
    observer = null;
    clearTimeout(expiry);
  };
  document.addEventListener("click", (event) => {
    if (!isBeetleRoute()) return;
    const button = trustedNativeCheeseClaimButton(event);
    if (!button) return;
    stop();
    // Snapshot the native log before the site handler runs. Re-rendered history
    // must not replay an old success after an unavailable or failed claim.
    const previous = new Set(Array.from(document.querySelectorAll(`${LOG_SELECTOR} > span`), (node) => node.textContent));
    const inspect = () => {
      if (!isBeetleRoute() || !button.isConnected) { stop(); return; }
      for (const node of document.querySelectorAll(`${LOG_SELECTOR} > span`)) {
        const message = node.textContent ?? "";
        if (previous.has(message)) continue;
        const streak = nativeCheeseStreakFromMessage(message);
        if (streak === null) continue;
        stop();
        showNativeCheeseStreak(button, streak);
        return;
      }
    };
    observer = new MutationObserver(inspect);
    observer.observe(document.documentElement, { childList: true, characterData: true, subtree: true });
    expiry = setTimeout(stop, 15_000);
    // Do not cancel, retry, dispatch, or replace the trusted website click.
  }, true);
  addEventListener("pagehide", () => {
    stop();
    document.getElementById(POPUP_ID)?.remove();
  }, { once: true });
}
