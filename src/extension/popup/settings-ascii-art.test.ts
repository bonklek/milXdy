import { describe, expect, it } from "vitest";
import { fitAsciiArt, SETTINGS_ASCII_ART } from "./settings-ascii-art";

describe("ASCII artwork fitted to unused popup space", () => {
  it.each([[400, 38], [400, 100], [400, 220], [180, 120], [800, 200]])("fits both pixel dimensions at %s by %s", (width, height) => {
    const fit = fitAsciiArt(width, height)!;
    expect(fit).not.toBeNull();
    const lines = fit.art.text.split("\n");
    expect(Math.max(...lines.map(line => line.length)) * fit.fontSize * 0.6).toBeLessThanOrEqual(width * .94 + .01);
    expect(lines.length * fit.fontSize * 1.08).toBeLessThanOrEqual(height - 12 + .01);
    expect(fit.fontSize).toBeGreaterThanOrEqual(8);
  });
  it("uses different designs for shallow and tall spaces", () => {
    expect(fitAsciiArt(400, 38)?.art.id).not.toBe(fitAsciiArt(400, 220)?.art.id);
  });
  it("hides when controls leave too little room", () => {
    expect(fitAsciiArt(400, 20)).toBeNull();
    expect(fitAsciiArt(20, 200)).toBeNull();
    expect(fitAsciiArt(400, -10)).toBeNull();
  });
  it("accounts for the measured font and remains deterministic on repeated layouts", () => {
    expect(fitAsciiArt(400, 100, .8)).toEqual(fitAsciiArt(400, 100, .8));
    const fit = fitAsciiArt(400, 100, .8)!;
    expect(Math.max(...fit.art.text.split('\n').map(line => line.length)) * .8 * fit.fontSize).toBeLessThanOrEqual(376.01);
    expect(SETTINGS_ASCII_ART.every(art => /^[\x20-\x7e\n]+$/.test(art.text))).toBe(true);
  });
});
