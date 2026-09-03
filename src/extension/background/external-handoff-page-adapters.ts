// These functions are serialized by chrome.scripting.executeScript and run
// only in the exact reviewed page selected by the background handoff router.
// Keep each function self-contained: imported helpers and extension state are
// not available inside the maker page's MAIN world.

declare const attributeDisplay: {
  currentlyDisplaying?: boolean;
  canvas?: HTMLCanvasElement;
  drawSelectedLayers?: (full?: boolean, canvas?: boolean) => Promise<void>;
} | undefined;

export async function renderRemiliaMakerImage(
  topText: string,
  bottomText: string,
  mode: "captioned" | "randomMeme",
): Promise<{ ok: boolean; error?: string; imageDataUrl?: string }> {
  const waitForSelectedTokenRender = async (tokenInput: HTMLInputElement, previousTokenId: string): Promise<void> => {
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      const display = typeof attributeDisplay === "undefined" ? undefined : attributeDisplay;
      const selectedTokenId = tokenInput.value.trim();
      if (selectedTokenId && selectedTokenId !== previousTokenId && display?.currentlyDisplaying === false && display.canvas?.width && display.canvas.height) return;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    }
    throw new Error("maker-render-timeout");
  };
  const setInput = (input: HTMLInputElement, value: string): void => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("maker-input-unavailable");
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };

  try {
    const top = document.querySelector<HTMLInputElement>("#topText");
    const bottom = document.querySelector<HTMLInputElement>("#bottomText");
    const tokenInput = document.querySelector<HTMLInputElement>("#tokenIDDisplay");
    const randomToken = document.querySelector<HTMLElement>("#randomButton");
    const randomMeme = document.querySelector<HTMLElement>("#randomMemeButton");
    if (!top || !bottom || !tokenInput || !randomToken || !randomMeme) {
      return { ok: false, error: "This maker no longer exposes its reviewed generation controls." };
    }

    // WalletInterface starts its token request after the click. Waiting for a
    // non-empty token id as well as the renderer's idle state prevents the old
    // false-idle race where the adapter captured before generation began.
    const previousTokenId = tokenInput.value.trim();
    randomToken.click();
    await waitForSelectedTokenRender(tokenInput, previousTokenId);

    if (mode === "captioned") {
      setInput(top, topText);
      setInput(bottom, bottomText);
    } else {
      // The reviewed Random Meme control synchronously selects the text preset;
      // the final host-owned draw below renders it with the selected token.
      randomMeme.click();
    }

    const display = typeof attributeDisplay === "undefined" ? undefined : attributeDisplay;
    if (!display?.drawSelectedLayers) return { ok: false, error: "This maker no longer exposes its reviewed renderer." };
    await display.drawSelectedLayers(false, true);
    const image = document.querySelector<HTMLImageElement>("#downloadable");
    if (!image?.src.startsWith("data:image/png;base64,")) return { ok: false, error: "The maker did not render a PNG." };
    return { ok: true, imageDataUrl: image.src };
  } catch {
    return { ok: false, error: "The maker image could not be generated." };
  }
}
