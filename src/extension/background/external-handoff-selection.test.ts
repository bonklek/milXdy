import { describe, expect, it } from "vitest";
import { resolveMakerDispatch as resolveBuilt } from "../../../examples/packages/local-dev/tweet-composer-kit/dist/content.js";
import { resolveMakerDispatch as resolveSource } from "../../../examples/packages/local-dev/tweet-composer-kit/src/content.js";

const declarations = [
  { id: "milady-maker", label: "Milady Maker" },
  { id: "remilio-maker", label: "Redacted Remilio Babies Maker" },
  { id: "bonkler-maker", label: "Bonkler Factory" },
  { id: "kagami-maker", label: "Kagami Academy Maker" },
  { id: "cheeseworld-deepfry", label: "#CHEESEWORLD Meme Maker" },
];

describe.each([
  ["source", resolveSource],
  ["built", resolveBuilt],
])("Post-Factory explicit maker dispatch (%s)", (_kind, resolveDispatch) => {
  it("never substitutes Milady Maker for a non-selected alternative", () => {
    expect(resolveDispatch({ handoffId: "remilio-maker", mode: "randomMeme" }, declarations)).toEqual({
      ok: true,
      handoffId: "remilio-maker",
      label: "Redacted Remilio Babies Maker",
      mode: "randomMeme",
    });
  });

  it("dispatches an explicitly selected alternative and mode exactly", () => {
    expect(resolveDispatch({ handoffId: "bonkler-maker", mode: "captioned" }, declarations)).toEqual({
      ok: true,
      handoffId: "bonkler-maker",
      label: "Bonkler Factory",
      mode: "captioned",
    });
  });

  it("fails closed when maker or mode selection is absent or incompatible", () => {
    expect(resolveDispatch({ handoffId: null, mode: null }, declarations)).toEqual({
      ok: false,
      error: "Choose a maker before generating.",
    });
    expect(resolveDispatch({ handoffId: "kagami-maker", mode: null }, declarations)).toEqual({
      ok: false,
      error: "Choose Captioned or Random meme before generating.",
    });
    expect(resolveDispatch({ handoffId: "cheeseworld-deepfry", mode: "randomMeme" }, declarations)).toEqual({
      ok: false,
      error: "#CHEESEWORLD Meme Maker does not support the selected mode.",
    });
  });
});
