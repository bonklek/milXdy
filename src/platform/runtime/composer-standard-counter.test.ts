import { describe, expect, it } from "vitest";
import { isStandardPostZeroAnnouncement } from "./composer-standard-counter";

describe("long-post standard counter boundary", () => {
  it("recognizes only X's native zero-standard-post announcement", () => {
    expect(isStandardPostZeroAnnouncement(
      "0 characters remaining for a standard post, 24,720 characters remaining total",
    )).toBe(true);
    expect(isStandardPostZeroAnnouncement(
      "0 character remaining for a standard post, 24,720 characters remaining total",
    )).toBe(true);
    expect(isStandardPostZeroAnnouncement(
      "1 character remaining for a standard post, 24,721 characters remaining total",
    )).toBe(false);
    expect(isStandardPostZeroAnnouncement("24,719 characters remaining")).toBe(false);
    expect(isStandardPostZeroAnnouncement(undefined)).toBe(false);
  });
});
