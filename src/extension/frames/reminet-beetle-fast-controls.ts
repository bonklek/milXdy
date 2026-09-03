export type NativeBeetleAction = "catchBeetle" | "beetleHunt";
export type NativeBeetleObservedOutcome = "pending" | "result" | "failure" | "timeout";

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

type MatchCapableElement = {
  nodeType: number;
  matches: (selector: string) => boolean;
  querySelector?: (selector: string) => Element | null;
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

export function trustedNativeBeetleActionFor(
  event: Pick<MouseEvent, "isTrusted" | "target">,
  enabled: boolean,
): NativeBeetleAction | null {
  if (!enabled || event.isTrusted !== true) return null;
  return nativeBeetleActionFor(event.target);
}

export function nativeBeetleOutcomeForElement(
  value: unknown,
  includeDescendants = false,
): Exclude<NativeBeetleObservedOutcome, "pending" | "timeout"> | null {
  if (!value || typeof value !== "object") return null;
  const element = value as Partial<MatchCapableElement>;
  if (element.nodeType !== 1 || typeof element.matches !== "function") return null;
  if (element.matches("#milxdy-reminet-beetle-native-status, #milxdy-reminet-beetle-native-status *")) return null;
  const failureSelector = '[role="alert"], [aria-live="assertive"], [data-error="true"], .error-message, .beetle-error';
  const resultSelector = ".beetle-catch-module__beetle-item, .beetle-catch-module__result, [data-beetle-result]";
  if (element.matches(failureSelector) || (includeDescendants && element.querySelector?.(failureSelector))) {
    return "failure";
  }
  if (element.matches(resultSelector) || (includeDescendants && element.querySelector?.(resultSelector))) {
    return "result";
  }
  return null;
}

export function nativeBeetleStatusCopy(
  action: NativeBeetleAction,
  outcome: NativeBeetleObservedOutcome,
): { title: string; detail: string; kind: "pending" | "success" | "error" } {
  const actionLabel = action === "catchBeetle" ? "Catch" : "Hunt";
  if (outcome === "result") {
    return {
      title: `${actionLabel} result ready`,
      detail: "RemiliaNET completed the visible native result. milXdy only accelerated its presentation.",
      kind: "success",
    };
  }
  if (outcome === "failure") {
    return {
      title: `${actionLabel} unavailable`,
      detail: "RemiliaNET reported that the native Beetle action did not complete.",
      kind: "error",
    };
  }
  if (outcome === "timeout") {
    return {
      title: `Native ${actionLabel} still pending`,
      detail: "Use RemiliaNET's visible result. milXdy did not replace or retry the site action.",
      kind: "pending",
    };
  }
  return {
    title: `Native ${actionLabel} in progress`,
    detail: "RemiliaNET is handling this trusted action with its own website session.",
    kind: "pending",
  };
}

export function beetleConnectorIsActive(response: unknown): boolean {
  if (!response || typeof response !== "object") return false;
  const status = response as TokenFreeBeetleAuthStatus;
  return status.ok === true && status.signedIn === true && status.method === "oidc";
}

export function instantBeetleResultsCanRun(preferred: boolean, response: unknown): boolean {
  return preferred && beetleConnectorIsActive(response);
}

export function createNativeBeetleAccelerationCss(attribute: string): string {
  return `
    /* Instant results accelerate only RemiliaNET's native presentation. A
       nonzero duration preserves the site's action/result lifecycle events. */
    html[${attribute}] .beetle-catch-module,
    html[${attribute}] .beetle-catch-module *,
    html[${attribute}] .beetle-catch-module *::before,
    html[${attribute}] .beetle-catch-module *::after {
      animation-duration: 0.001ms !important;
      animation-delay: 0ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.001ms !important;
      transition-delay: 0ms !important;
    }
  `;
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
