export type NativeBeetleAction = "catchBeetle" | "beetleHunt";

type TokenFreeBeetleAuthStatus = {
  ok?: unknown;
  signedIn?: unknown;
  method?: unknown;
};

const NATIVE_BEETLE_ACTION_SELECTOR =
  ".beetle-catch-module__catch-button, .beetle-catch-module__hunt-button";

type ClosestCapableTarget = EventTarget & {
  nodeType: number;
  closest: (selector: string) => Element | null;
};

function isClosestCapableTarget(target: EventTarget | null): target is ClosestCapableTarget {
  if (!target || typeof target !== "object") return false;
  const candidate = target as Partial<ClosestCapableTarget>;
  return candidate.nodeType === 1 && typeof candidate.closest === "function";
}

export function nativeBeetleActionButtonFor(target: EventTarget | null): HTMLButtonElement | null {
  if (!isClosestCapableTarget(target)) return null;
  return target.closest(NATIVE_BEETLE_ACTION_SELECTOR) as HTMLButtonElement | null;
}

export function nativeBeetleActionFor(target: EventTarget | null): NativeBeetleAction | null {
  const button = nativeBeetleActionButtonFor(target);
  if (!button) return null;
  return button.classList.contains("beetle-catch-module__catch-button") ? "catchBeetle" : "beetleHunt";
}

export function beetleConnectorIsActive(response: unknown): boolean {
  if (!response || typeof response !== "object") return false;
  const status = response as TokenFreeBeetleAuthStatus;
  return status.ok === true && status.signedIn === true && status.method === "oidc";
}

export function instantBeetleResultsCanRun(preferred: boolean, response: unknown): boolean {
  return preferred && beetleConnectorIsActive(response);
}

export function createBeetleReducedMotionCss(attribute: string): string {
  return `
    /* Keep a nonzero duration on stateful Hunt elements so normal
       animation/transition completion events can still fire. */
    html[${attribute}],
    html[${attribute}] *,
    html[${attribute}] *::before,
    html[${attribute}] *::after {
      animation-duration: 0.001ms !important;
      animation-delay: 0ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      transition-delay: 0ms !important;
    }
    /* These selectors are decorative only. Never add Beetle Catch/Hunt
       containers or action controls here: animation:none suppresses their
       completion callbacks and makes a trusted Hunt click a silent no-op. */
    html[${attribute}] :is(
      .beetle-header, .beetle-tab, .beetle-logo, .beetle-vignette,
      .beetle-game-nav, .cheeseman,
      .toggle-bar, .toggle-knob, .toggle-text,
      [class*="rarity-shadow" i]) {
      animation: none !important;
      transition: none !important;
    }
    /* Crafting owns an explicit ended-event accelerator, so its known result
       layer can remain immediate without muting Beetle Catch/Hunt lifecycle. */
    html[${attribute}] .crafting-module,
    html[${attribute}] .crafting-module *,
    html[${attribute}] .module-main-screen.crafting-main-screen,
    html[${attribute}] .module-main-screen.crafting-main-screen *,
    html[${attribute}] .crafting-logo {
      animation: none !important;
      transition: none !important;
    }
    html[${attribute}] { scroll-behavior: auto !important; }
  `;
}
