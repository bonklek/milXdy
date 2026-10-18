import { describe, expect, it, vi } from "vitest";
import { fetchMakerTraits } from "../../packages/maintainer/pets-maker/src/maker-metadata.js";

describe("Maker metadata network boundaries", () => {
  it("cancels an oversized streamed response without a declared length", async () => {
    const cancel = vi.fn();
    const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(256 * 1024 + 1)); }, cancel });
    await expect(fetchMakerTraits("milady", 1, { fetchImpl: async () => new Response(stream) })).rejects.toThrow("too large");
    expect(cancel).toHaveBeenCalled();
  });
  it("counts UTF-8 bytes instead of characters", async () => {
    await expect(fetchMakerTraits("milady", 1, { fetchImpl: async () => new Response('é'.repeat(140000)) })).rejects.toThrow("too large");
  });
  it("rejects redirects and omits account credentials and referrers", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ attributes: [] })));
    await fetchMakerTraits("milady", 1, { fetchImpl });
    expect(fetchImpl).toHaveBeenCalledWith("https://maker.remilia.org/metadata/Milady/1", expect.objectContaining({ redirect: "error", credentials: "omit", referrerPolicy: "no-referrer" }));
  });
  it("does not return traits after the panel is closed", async () => {
    const controller = new AbortController();
    await expect(fetchMakerTraits("milady", 1, { signal: controller.signal, fetchImpl: async () => {
      controller.abort();return new Response(JSON.stringify({ attributes: [] }));
    } })).rejects.toThrow();
  });
});
