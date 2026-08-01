import { describe, expect, it } from "vitest";
import { externalHandoffUrl, splitExternalHandoffText, validateExternalHandoffCaptions, validateExternalHandoffImageDataUrl } from "./external-handoff";

describe("external maker handoff", () => {
  it("uses the sole newline as a caption boundary", () => {
    expect(splitExternalHandoffText("top line\nbottom line")).toEqual({ topText: "top line", bottomText: "bottom line" });
  });

  it("chooses the nearest newline to the midpoint when there are several", () => {
    expect(splitExternalHandoffText("one\ntwo three four\nfive six")).toEqual({ topText: "one\ntwo three four", bottomText: "five six" });
  });

  it("does not invent a bottom caption without a newline", () => {
    expect(splitExternalHandoffText("one caption")).toEqual({ topText: "one caption", bottomText: "" });
  });

  it("uses only reviewed Remilia Maker destinations", () => {
    expect(externalHandoffUrl("remilia-maker", "milady")?.href).toBe("https://maker.remilia.org/milady");
    expect(externalHandoffUrl("remilia-maker", "kagami")?.href).toBe("https://maker.remilia.org/kagami");
    expect(externalHandoffUrl("cheeseworld", "deepfry")?.href).toBe("https://cult.inc/cheeseworld");
    expect(externalHandoffUrl("cheeseworld", "milady")).toBeNull();
  });

  it("accepts only bounded reviewed image data for media replacement", () => {
    expect(validateExternalHandoffImageDataUrl("data:image/png;base64,AQID", 3)).toEqual({
      dataUrl: "data:image/png;base64,AQID", contentType: "image/png", byteLength: 3,
    });
    expect(validateExternalHandoffImageDataUrl("data:image/svg+xml;base64,AQID", 3)).toBeNull();
    expect(validateExternalHandoffImageDataUrl("data:image/png;base64,AQID", 2)).toBeNull();
  });

  it("preserves explicit package captions exactly within the declared bound", () => {
    expect(validateExternalHandoffCaptions({ topText: " top ", bottomText: "bottom\n" }, 12))
      .toEqual({ topText: " top ", bottomText: "bottom\n" });
  });

  it("rejects malformed or oversized explicit package captions", () => {
    expect(validateExternalHandoffCaptions({ topText: "too long", bottomText: "" }, 3)).toBeNull();
    expect(validateExternalHandoffCaptions({ topText: "ok" }, 3)).toBeNull();
  });
});
