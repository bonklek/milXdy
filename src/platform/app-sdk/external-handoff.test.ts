import { describe, expect, it } from "vitest";
import { externalHandoffUrl, splitExternalHandoffText } from "./external-handoff";

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
  });
});
