import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  beetleConnectorIsActive,
  createNativeBeetleAccelerationCss,
  createBeetleReducedMotionCss,
  instantBeetleResultsCanRun,
  nativeBeetleActionButtonFor,
  nativeBeetleActionFor,
  nativeBeetleOutcomeForElement,
  nativeBeetleStatusCopy,
  trustedNativeBeetleActionFor,
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
  it("requires the token-free OIDC connector status and preserves the stored preference", () => {
    const connected = { ok: true, signedIn: true, method: "oidc", user: { id: "not-inspected" } };
    const disconnected = { ok: true, signedIn: false, method: null };
    const failed = { ok: false, error: "BACKGROUND_UNAVAILABLE" };

    expect(beetleConnectorIsActive(connected)).toBe(true);
    expect(beetleConnectorIsActive(disconnected)).toBe(false);
    expect(beetleConnectorIsActive(failed)).toBe(false);
    expect(beetleConnectorIsActive(null)).toBe(false);
    expect([connected, disconnected, failed, connected].map((status) => (
      instantBeetleResultsCanRun(true, status)
    ))).toEqual([true, false, false, true]);
    expect(instantBeetleResultsCanRun(false, connected)).toBe(false);
  });

  it("polls only token-free Beetol status and leaves the native action transport untouched", () => {
    const source = readFileSync(resolve(process.cwd(), "src/extension/frames/reminet-chat-bridge.ts"), "utf8");
    expect(source).toContain('{ type: "beetol:authStatus" }');
    expect(source).toContain("BEETLE_CONNECTOR_STATUS_POLL_MS");
    expect(source).toContain("preferred && connectorActive");
    expect(source).toContain("releaseNativeBeetleAcceleration()");
    expect(source).toContain("document.documentElement.removeAttribute(BEETLE_INSTANT_RESULTS_ACTIVE_ATTRIBUTE)");
    expect(source).toContain("The trusted click continues to RemiliaNET's native handler");
    const observation = source.slice(
      source.indexOf("function observeNativeBeetleAction"),
      source.indexOf("function installInstantResultListener"),
    );
    expect(observation).toContain("document.documentElement.toggleAttribute(BEETLE_INSTANT_RESULTS_ACTIVE_ATTRIBUTE, true)");
    expect(source).not.toContain('{ type: "beetol:action", action }');
    expect(source).not.toContain("event.preventDefault()");
    expect(source).not.toContain("event.stopImmediatePropagation()");
    expect(source).not.toContain("remilia-auth:");
  });

  it("observes only an enabled trusted native action click", () => {
    const huntTarget = crossRealmTarget("beetle-catch-module__hunt-button");
    expect(trustedNativeBeetleActionFor({ isTrusted: true, target: huntTarget }, true)).toBe("beetleHunt");
    expect(trustedNativeBeetleActionFor({ isTrusted: false, target: huntTarget }, true)).toBeNull();
    expect(trustedNativeBeetleActionFor({ isTrusted: true, target: huntTarget }, false)).toBeNull();
  });

  it("accelerates presentation with nonzero lifecycle-safe durations", () => {
    const css = createNativeBeetleAccelerationCss("data-test-native-beetle");
    expect(css).toContain(".beetle-catch-module");
    expect(css).toContain("animation-duration: 0.001ms !important");
    expect(css).toContain("transition-duration: 0.001ms !important");
    expect(css).not.toMatch(/animation:\s*none/i);
    expect(css).not.toContain("visibility: hidden");
    expect(css).not.toContain("pointer-events: none");
  });

  it("maps only structural native result/failure evidence to bounded visible copy", () => {
    const result = matchableElement((selector) => selector.includes(".beetle-catch-module__beetle-item"));
    const failure = matchableElement((selector) => selector.includes('[role="alert"]'));
    const nestedResult = matchableElement(() => false, (selector) => (
      selector.includes(".beetle-catch-module__result") ? ({} as Element) : null
    ));
    const unrelated = matchableElement(() => false);

    expect(nativeBeetleOutcomeForElement(result)).toBe("result");
    expect(nativeBeetleOutcomeForElement(failure)).toBe("failure");
    expect(nativeBeetleOutcomeForElement(nestedResult)).toBeNull();
    expect(nativeBeetleOutcomeForElement(nestedResult, true)).toBe("result");
    expect(nativeBeetleOutcomeForElement(unrelated)).toBeNull();
    expect(nativeBeetleStatusCopy("beetleHunt", "result")).toMatchObject({
      title: "Hunt result ready",
      kind: "success",
      detail: expect.stringContaining("native result"),
    });
    expect(nativeBeetleStatusCopy("catchBeetle", "failure")).toMatchObject({
      title: "Catch unavailable",
      kind: "error",
      detail: expect.not.stringContaining("unauthorized"),
    });
  });

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

function matchableElement(
  matches: (selector: string) => boolean,
  querySelector?: (selector: string) => Element | null,
): Element {
  return { nodeType: 1, matches, querySelector } as unknown as Element;
}
