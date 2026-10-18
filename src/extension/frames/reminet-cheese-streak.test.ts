import { describe, expect, it } from "vitest";
import { nativeCheeseStreakFromMessage, trustedNativeCheeseClaimButton } from "./reminet-cheese-streak";

describe("native cheese claim feedback", () => {
  it("accepts only the native successful claim message with a positive safe streak", () => {
    expect(nativeCheeseStreakFromMessage("YOU HAVE CLAIMED 42 PIECES OF CHEESE! Streak: 7")).toBe(7);
    for (const message of ["Claiming daily cheese...", "WAIT FOR NEXT DAILY CHEESE", "YOU HAVE 42 CHEESE PIECES.",
      "Streak: 7", "Failed: YOU HAVE CLAIMED 42 PIECES OF CHEESE! Streak: 7", "YOU HAVE CLAIMED 42 PIECES OF CHEESE!",
      "YOU HAVE CLAIMED 42 PIECES OF CHEESE! Streak: 0", "YOU HAVE CLAIMED 42 PIECES OF CHEESE! Streak: 9007199254740992"]) {
      expect(nativeCheeseStreakFromMessage(message)).toBeNull();
    }
  });
  it("requires a trusted enabled connected native claim control", () => {
    const button = { disabled: false, classList: { contains: () => false }, closest: () => null };
    const target = { nodeType: 1, closest: () => button } as unknown as EventTarget;
    expect(trustedNativeCheeseClaimButton({ isTrusted: true, target })).toBe(button);
    expect(trustedNativeCheeseClaimButton({ isTrusted: false, target })).toBeNull();
    button.disabled = true;
    expect(trustedNativeCheeseClaimButton({ isTrusted: true, target })).toBeNull();
    button.disabled = false;
    button.classList.contains = () => true;
    expect(trustedNativeCheeseClaimButton({ isTrusted: true, target })).toBeNull();
    expect(trustedNativeCheeseClaimButton({ isTrusted: true, target: null })).toBeNull();
  });
});
