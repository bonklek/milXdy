import { describe, expect, it, vi } from "vitest";
import { readCappedResponseBytes, fetchImageDataUrl } from "./image-fetch-handlers";

describe("background image byte boundary", () => {
  it("rejects an oversized Content-Length before locking the stream", async () => {
    const response = new Response(new Uint8Array([1]), { headers: { "content-length": "100" } });
    await expect(readCappedResponseBytes(response, 4)).rejects.toThrow("IMAGE_TOO_LARGE");
    expect(response.body?.locked).toBe(false);
  });

  it("cancels an overflowing streamed response and releases its reader", async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array([1, 2, 3]));
        controller.enqueue(new Uint8Array([4, 5]));
      },
      cancel,
    });
    await expect(readCappedResponseBytes(new Response(body), 4)).rejects.toThrow("IMAGE_TOO_LARGE");
    expect(cancel).toHaveBeenCalledOnce();
    expect(body.locked).toBe(false);
  });

  it("accepts the exact byte limit and rejects off-policy hosts before fetching", async () => {
    await expect(readCappedResponseBytes(new Response(new Uint8Array([1, 2, 3, 4])), 4))
      .resolves.toEqual(new Uint8Array([1, 2, 3, 4]));
    const fetcher = vi.fn();
    await expect(fetchImageDataUrl("https://example.com/banner.png", fetcher))
      .resolves.toEqual({ ok: false, error: "UNSUPPORTED_IMAGE_URL" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
