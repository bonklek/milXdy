import { describe, expect, it } from "vitest";
import { splitSpeechText } from "./speech";

describe("splitSpeechText", () => {
  it("keeps short text in one navigation chunk", () => {
    expect(splitSpeechText("A short paragraph.")).toEqual([{ text: "A short paragraph.", offset: 0 }]);
  });

  it("creates multiple ordered navigation chunks for long readable text", () => {
    const text = Array.from(
      { length: 14 },
      (_, index) => `Sentence ${index + 1} has enough readable words to exercise paragraph navigation.`,
    ).join(" ");
    const chunks = splitSpeechText(text, 25);

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.every((chunk) => chunk.text.length <= 220)).toBe(true);
    expect(chunks[0]?.offset).toBe(25);
    expect(chunks.every((chunk, index) => index === 0 || chunk.offset > chunks[index - 1]!.offset)).toBe(true);
  });
});
