import { describe, expect, it } from "vitest";

import {
  createBeetleReducedMotionCss,
  nativeBeetleActionButtonFor,
  nativeBeetleActionFor,
} from "./reminet-beetle-fast-controls";

function crossRealmTarget(buttonClass: string): EventTarget {
  const button = {
    classList: { contains: (className: string) => className === buttonClass },
  } as HTMLButtonElement;
  return {
    nodeType: 1,
    closest: () => button,
  } as unknown as EventTarget;
}

describe("RemiliaNET fast Beetle controls", () => {
  it("resolves trusted action targets without a realm-sensitive instanceof check", () => {
    const huntTarget = crossRealmTarget("beetle-catch-module__hunt-button");
    const catchTarget = crossRealmTarget("beetle-catch-module__catch-button");

    expect(nativeBeetleActionFor(huntTarget)).toBe("beetleHunt");
    expect(nativeBeetleActionFor(catchTarget)).toBe("catchBeetle");
    expect(nativeBeetleActionButtonFor(huntTarget)).not.toBeNull();
    expect(nativeBeetleActionFor({ nodeType: 3 } as unknown as EventTarget)).toBeNull();
  });

  it("keeps Hunt lifecycle animations fast but completion-capable", () => {
    const css = createBeetleReducedMotionCss("data-test-fast-beetle");
    const animationNoneSelectors = Array.from(css.matchAll(/([^{}]+)\{[^{}]*animation:\s*none/gi))
      .map((match) => match[1]);
    const completionSensitiveSelectors = [
      ".beetle-console",
      ".beetleModule",
      ".beetle-catch-module",
      ".beetle-catch-module__buttons-container",
      ".beetle-catch-module__beetle-item",
      ".carousel",
      ".claim-button",
    ];

    expect(css).toContain("animation-duration: 0.001ms !important");
    expect(css).toContain("transition-duration: 0.001ms !important");
    for (const selector of completionSensitiveSelectors) {
      expect(animationNoneSelectors.join("\n")).not.toContain(selector);
    }
  });
});
