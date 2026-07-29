import { describe, expect, it } from "vitest";
import { isTwitterUnreadBackground } from "./content";

describe("notification unread background detection", () => {
  it("recognizes X's light and dark unread blue washes", () => {
    expect(isTwitterUnreadBackground("rgba(29, 155, 240, 0.043)")).toBe(true);
    expect(isTwitterUnreadBackground("rgb(232, 245, 253)")).toBe(true);
    expect(isTwitterUnreadBackground("rgb(22, 36, 46)")).toBe(true);
  });

  it("does not mistake neutral or milXdy palette surfaces for X unread state", () => {
    expect(isTwitterUnreadBackground("rgba(0, 0, 0, 0)")).toBe(false);
    expect(isTwitterUnreadBackground("rgb(255, 255, 255)")).toBe(false);
    expect(isTwitterUnreadBackground("rgb(22, 24, 28)")).toBe(false);
    expect(isTwitterUnreadBackground("color(srgb 0.911843 0.94698 0.909647)")).toBe(false);
  });
});
