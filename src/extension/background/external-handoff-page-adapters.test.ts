import { afterEach, describe, expect, it, vi } from "vitest";
import { renderRemiliaMakerImage } from "./external-handoff-page-adapters";

class FakeInput {
  private currentValue = "";
  get value(): string { return this.currentValue; }
  set value(value: string) { this.currentValue = value; }
  dispatchEvent(): boolean { return true; }
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("reviewed Remilia maker page adapter", () => {
  it("waits for the selected random token to finish before rendering the meme result", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("HTMLInputElement", FakeInput);
    vi.stubGlobal("window", { setTimeout: globalThis.setTimeout });

    const top = new FakeInput();
    const bottom = new FakeInput();
    const tokenInput = new FakeInput();
    tokenInput.value = "999";
    const downloadable = { src: "" };
    const display = {
      currentlyDisplaying: false,
      canvas: { width: 700, height: 875 },
      drawSelectedLayers: vi.fn(async () => {
        expect(tokenInput.value).toBe("1234");
        expect(display.currentlyDisplaying).toBe(false);
        downloadable.src = "data:image/png;base64,AQID";
      }),
    };
    const randomMeme = {
      click: vi.fn(() => {
        expect(tokenInput.value).toBe("1234");
        top.value = "RANDOM";
      }),
    };
    const randomToken = {
      click: vi.fn(() => {
        window.setTimeout(() => {
          tokenInput.value = "1234";
          display.currentlyDisplaying = true;
          window.setTimeout(() => { display.currentlyDisplaying = false; }, 200);
        }, 200);
      }),
    };
    const nodes = new Map<string, unknown>([
      ["#topText", top],
      ["#bottomText", bottom],
      ["#tokenIDDisplay", tokenInput],
      ["#randomButton", randomToken],
      ["#randomMemeButton", randomMeme],
      ["#downloadable", downloadable],
    ]);
    vi.stubGlobal("document", { querySelector: (selector: string) => nodes.get(selector) ?? null });
    vi.stubGlobal("attributeDisplay", display);

    const resultPromise = renderRemiliaMakerImage("", "", "randomMeme");
    await vi.advanceTimersByTimeAsync(1_000);

    await expect(resultPromise).resolves.toEqual({ ok: true, imageDataUrl: "data:image/png;base64,AQID" });
    expect(randomToken.click).toHaveBeenCalledOnce();
    expect(randomMeme.click).toHaveBeenCalledOnce();
    expect(display.drawSelectedLayers).toHaveBeenCalledWith(false, true);
  });

  it("returns a bounded failure when the reviewed controls drift", async () => {
    vi.stubGlobal("document", { querySelector: () => null });

    await expect(renderRemiliaMakerImage("", "", "randomMeme")).resolves.toEqual({
      ok: false,
      error: "This maker no longer exposes its reviewed generation controls.",
    });
  });
});
