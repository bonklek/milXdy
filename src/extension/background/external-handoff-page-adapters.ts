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

/** Runs only in the reviewed CheeseWorld tab after an explicit package gesture. */
export async function renderCheeseWorldImage(sourceDataUrl: string, contentType: string, topText: string, bottomText: string): Promise<{ ok: boolean; error?: string; imageDataUrl?: string }> {
  const waitFor = async <T>(read: () => T | null, message: string, timeoutMs = 20_000): Promise<T> => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const value = read();
      if (value) return value;
      await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    }
    throw new Error(message);
  };
  const setInputValue = (input: HTMLInputElement, value: string): void => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("CheeseWorld text controls are unavailable.");
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  };
  try {
    const upload = await waitFor(
      () => document.querySelector<HTMLInputElement>("#uploadImage"),
      "CheeseWorld upload control is unavailable.",
    );
    const blob = await fetch(sourceDataUrl).then((response) => response.blob());
    if (blob.type !== contentType || blob.size < 1 || blob.size > 10 * 1024 * 1024) {
      return { ok: false, error: "CheeseWorld rejected the source image." };
    }
    const transfer = new DataTransfer();
    transfer.items.add(new File([blob], "milxdy-cheeseworld-source", { type: contentType }));
    const backgroundCanvas = document.querySelector<HTMLCanvasElement>("#background");
    if (!backgroundCanvas) return { ok: false, error: "CheeseWorld image canvas is unavailable." };
    const uploadApplied = new Promise<boolean>((resolve) => {
      const timeout = window.setTimeout(() => finish(false), 20_000);
      const observer = new MutationObserver(() => finish(true));
      const finish = (applied: boolean) => {
        window.clearTimeout(timeout);
        observer.disconnect();
        resolve(applied);
      };
      observer.observe(backgroundCanvas, { attributes: true, attributeFilter: ["width", "height"] });
    });
    upload.files = transfer.files;
    upload.dispatchEvent(new Event("input", { bubbles: true }));
    upload.dispatchEvent(new Event("change", { bubbles: true }));
    if (!await uploadApplied) return { ok: false, error: "CheeseWorld did not accept the source image." };
    const top = await waitFor(
      () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="text"]')).find((input) => input.placeholder.startsWith("Top Text")) || null,
      "CheeseWorld top caption is unavailable.",
    );
    const bottom = await waitFor(
      () => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="text"]')).find((input) => input.placeholder.startsWith("Bottom Text")) || null,
      "CheeseWorld bottom caption is unavailable.",
    );
    setInputValue(top, topText);
    setInputValue(bottom, bottomText);
    // Inactive maker tabs can suspend requestAnimationFrame. A bounded timer
    // lets React commit the controlled caption state without depending on a
    // visible rendering frame; the background wraps the entire injection in a
    // hard timeout and removes the generated tab in finally.
    await new Promise<void>((resolve) => window.setTimeout(resolve, 100));
    const filter = await waitFor(
      () => Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find((candidate) => candidate.textContent?.trim().startsWith("Filter Image")) || null,
      "CheeseWorld deep-fry control is unavailable.",
    );
    filter.click();
    await waitFor(
      () => Array.from(document.querySelectorAll<HTMLElement>("span")).find((candidate) => candidate.textContent?.includes("Meme cheesed!")) || null,
      "CheeseWorld did not finish deep-frying the image.",
      30_000,
    );
    const canvas = await waitFor(() => {
      const container = document.querySelector<HTMLElement>("#generated-canvas");
      const candidate = container?.querySelector<HTMLCanvasElement>("canvas");
      return container && !container.classList.contains("hidden") && candidate?.width && candidate.height ? candidate : null;
    }, "CheeseWorld did not expose the deep-fried image.");
    const imageDataUrl = canvas.toDataURL("image/png");
    return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/u.test(imageDataUrl)
      ? { ok: true, imageDataUrl }
      : { ok: false, error: "CheeseWorld returned an unsupported result." };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
