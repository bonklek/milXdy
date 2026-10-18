import { describe, expect, it } from "vitest";

describe("RemiStats sound module lifecycle", () => {
  it("does not construct a page-global sound manager at import time", async () => {
    const priorWindow = (globalThis as { window?: unknown }).window;
    Reflect.deleteProperty(globalThis, "window");
    try {
      const sounds = await import("./sounds.js");
      expect(typeof sounds.createSoundManager).toBe("function");
      expect(typeof sounds.disposeSoundManager).toBe("function");
    } finally {
      if (priorWindow === undefined) Reflect.deleteProperty(globalThis, "window");
      else (globalThis as { window?: unknown }).window = priorWindow;
    }
  });
});
