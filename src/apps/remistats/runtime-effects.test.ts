import { afterEach, describe, expect, it, vi } from "vitest";
import { createRemiStatsEffects } from "./runtime-effects.js";

const sound = vi.hoisted(() => ({ create: vi.fn(() => ({})), dispose: vi.fn(async () => {}) }));
vi.mock("./sounds.js", () => ({ createSoundManager: sound.create, disposeSoundManager: sound.dispose }));
afterEach(() => { vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe("RemiStats activation effects", () => {
  it("is inert until installed and owns exactly one font/manager across repeated cleanup", () => {
    const effects = createRemiStatsEffects();
    expect(sound.create).not.toHaveBeenCalled();
    const remove = vi.fn();
    const appendChild = vi.fn();
    const document = { head: { appendChild }, documentElement: { dataset: {} }, createElement: () => ({ dataset: {}, textContent: "", remove }) };
    vi.stubGlobal("document", document); vi.stubGlobal("window", {});
    const asset = vi.fn((path) => `extension://${path}`);
    effects.install("one", asset); effects.install("one", asset);
    expect(asset).toHaveBeenCalledExactlyOnceWith("remistats/RemiliaMincho-Regular.otf");
    expect(appendChild).toHaveBeenCalledTimes(1); expect(sound.create).toHaveBeenCalledTimes(1);
    effects.dispose(); effects.dispose();
    expect(remove).toHaveBeenCalledTimes(1); expect(sound.dispose).toHaveBeenCalledTimes(1);
    expect(document.documentElement.dataset).toEqual({});
    effects.install("two", asset); expect(sound.create).toHaveBeenCalledTimes(2);
    effects.dispose();
  });
});
