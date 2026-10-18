import { afterEach, describe, expect, it, vi } from "vitest";
import { decodePng } from "../../packages/maintainer/pets-maker/src/custom-pet-ui-primitives.js";
afterEach(() => vi.unstubAllGlobals());
function png(width: number, height: number) {
  const bytes = new Uint8Array(24);bytes.set([137,80,78,71,13,10,26,10]);bytes.set(new TextEncoder().encode("IHDR"),12);
  const view = new DataView(bytes.buffer);view.setUint32(16,width);view.setUint32(20,height);return new Blob([bytes], { type: "image/png" });
}
describe("Maker PNG decode limits", () => {
  it.each([[0,1024],[1024,0],[100000,100000],[4097,1024]])("rejects %sx%s before allocating a bitmap", async (width, height) => {
    const decode = vi.fn();vi.stubGlobal("createImageBitmap", decode);
    await expect(decodePng(png(width,height))).rejects.toThrow("4096");expect(decode).not.toHaveBeenCalled();
  });
  it("rejects non-PNG input before allocating a bitmap", async () => {
    const decode = vi.fn();vi.stubGlobal("createImageBitmap", decode);
    await expect(decodePng(new Blob(["not an image"]))).rejects.toThrow("valid PNG");expect(decode).not.toHaveBeenCalled();
  });
  it("accepts the dimension boundary and decodes the selected file", async () => {
    const decode = vi.fn(async () => ({ width: 4096, height: 4096 }));vi.stubGlobal("createImageBitmap", decode);
    const file = png(4096,4096);await decodePng(file);expect(decode).toHaveBeenCalledWith(file);
  });
});
