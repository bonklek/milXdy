import { describe, expect, it } from "vitest";
import { createComposerActionBindingRegistry } from "./composer-action-binding";

function buttonWithToken(token?: string): HTMLButtonElement {
  return {
    dataset: token === undefined ? {} : { milxdyComposerActionBinding: token },
  } as HTMLButtonElement;
}

describe("createComposerActionBindingRegistry", () => {
  it("does not mistake an X-cloned dataset marker for a live event binding", () => {
    const registry = createComposerActionBindingRegistry();
    const token = "runtime-a";
    const original = buttonWithToken(token);
    registry.remember(original);

    const xClone = buttonWithToken(token);

    expect(registry.needsBinding(original, token)).toBe(false);
    expect(registry.needsBinding(xClone, token)).toBe(true);
  });

  it("requires a fresh bind after an extension runtime changes", () => {
    const registry = createComposerActionBindingRegistry();
    const button = buttonWithToken("runtime-a");
    registry.remember(button);

    expect(registry.needsBinding(button, "runtime-b")).toBe(true);
  });
});
