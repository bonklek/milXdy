import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  beetleConnectorIsActive,
  createBeetleReducedMotionCss,
  instantBeetleResultsCanRun,
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

  it("polls only the token-free Beetol status operation and fails runtime eligibility closed", () => {
    const source = readFileSync(resolve(process.cwd(), "src/extension/frames/reminet-chat-bridge.ts"), "utf8");
    expect(source).toContain('{ type: "beetol:authStatus" }');
    expect(source).toContain("BEETLE_CONNECTOR_STATUS_POLL_MS");
    expect(source).toContain("preferred && connectorActive");
    expect(source).toContain("root.removeAttribute(BEETLE_INSTANT_RESULTS_ACTIVE_ATTRIBUTE)");
    expect(source.indexOf('{ type: "beetol:authStatus" }', source.indexOf("async function runInstantBeetleAction")))
      .toBeLessThan(source.indexOf('{ type: "beetol:action", action }'));
    expect(source).not.toContain("remilia-auth:");
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
