import { describe, expect, it } from "vitest";
import { BEETLE_HUNT_COOLDOWN_MS, beetleHuntChargesFromUser, beetleHuntCooldownFromUser } from "./hunt-cooldown";

describe("Beetle hunt cooldown state", () => {
  it("derives the remaining portion of the server's 90-minute cooldown", () => {
    const lastHuntAt = 1_700_000_000_000;
    const now = lastHuntAt + 35 * 60 * 1000;
    const user = { beetleHuntsUsed: 3, lastBeetleHuntDate: lastHuntAt };

    expect(beetleHuntCooldownFromUser(user, now)).toBe(55 * 60 * 1000);
    expect(beetleHuntChargesFromUser(user, now)).toBe(0);
  });

  it("accepts server timestamps expressed in seconds", () => {
    const lastHuntSeconds = 1_700_000_000;
    const now = lastHuntSeconds * 1000 + 15 * 60 * 1000;

    expect(beetleHuntCooldownFromUser({ beetleHuntsUsed: 3, lastBeetleHuntDate: lastHuntSeconds }, now))
      .toBe(BEETLE_HUNT_COOLDOWN_MS - 15 * 60 * 1000);
  });

  it("restores three hunts after the authoritative cooldown expires", () => {
    const lastHuntAt = 1_700_000_000_000;
    const user = { beetleHuntsUsed: 3, lastBeetleHuntDate: lastHuntAt };

    expect(beetleHuntCooldownFromUser(user, lastHuntAt + BEETLE_HUNT_COOLDOWN_MS)).toBe(0);
    expect(beetleHuntChargesFromUser(user, lastHuntAt + BEETLE_HUNT_COOLDOWN_MS)).toBe(3);
  });
});
