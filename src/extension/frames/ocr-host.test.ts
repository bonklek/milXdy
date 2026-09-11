import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const worker = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("tesseract.js", () => ({ createWorker: worker.create }));

describe("OCR host authorization", () => {
  let receive: (event: unknown) => void;
  let parent: { postMessage: ReturnType<typeof vi.fn> };
  let authorize: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.resetModules();
    vi.useFakeTimers();
    worker.create.mockReset().mockReturnValue(new Promise(() => undefined));
    parent = { postMessage: vi.fn() };
    authorize = vi.fn();
    vi.stubGlobal("chrome", { runtime: { sendMessage: authorize, getURL: (p: string) => `chrome-extension://test/${p}` } });
    vi.stubGlobal("window", {
      parent, setInterval, clearInterval, setTimeout, clearTimeout,
      addEventListener: (_type: string, callback: typeof receive) => { receive = callback; },
    });
    await import("./ocr-host");
    parent.postMessage.mockClear();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  function send(type: string, authToken: string): void {
    receive({ source: parent, origin: "https://x.com", data: { type, authToken, id: "test", src: "https://pbs.twimg.com/media/test.png" } });
  }

  it("does not accept a page-selected token or start OCR when background authorization rejects it", async () => {
    authorize.mockResolvedValue({ ok: false });
    send("post-reading-ocr-init", "page-selected-token");
    await Promise.resolve();
    await Promise.resolve();
    send("post-reading-ocr-request", "page-selected-token");
    expect(parent.postMessage).not.toHaveBeenCalled();
    expect(worker.create).not.toHaveBeenCalled();
  });

  it("acknowledges completed authorization, waits before OCR, and rejects later token replacement", async () => {
    let complete!: (value: unknown) => void;
    authorize.mockReturnValue(new Promise((resolve) => { complete = resolve; }));
    send("post-reading-ocr-init", "extension-session");
    send("post-reading-ocr-request", "extension-session");
    expect(worker.create).not.toHaveBeenCalled();
    expect(parent.postMessage).not.toHaveBeenCalled();
    complete({ ok: true });
    await Promise.resolve();
    await Promise.resolve();
    expect(parent.postMessage).toHaveBeenCalledWith({ type: "post-reading-ocr-authenticated" }, "https://x.com");
    send("post-reading-ocr-init", "replacement-token");
    send("post-reading-ocr-request", "replacement-token");
    expect(authorize).toHaveBeenCalledTimes(1);
    expect(worker.create).not.toHaveBeenCalled();
    send("post-reading-ocr-request", "extension-session");
    expect(worker.create).toHaveBeenCalledTimes(1);
  });
});
