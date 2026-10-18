import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ fetch: vi.fn(), decode: vi.fn(), inspect: vi.fn() }));
vi.mock("../../packages/maintainer/pets-maker/src/maker-metadata.js", () => ({ fetchMakerTraits: mocks.fetch }));
vi.mock("../../packages/maintainer/pets-maker/src/custom-pet-ui-primitives.js", () => ({
  decodePng: mocks.decode, requireTransparentImage: mocks.inspect,
  requiredValue: (control: { value: string }, message: string) => { if (!control.value) throw new Error(message); return control.value; },
  friendlyTrait: String, downloadBytes: vi.fn(),
}));
import { attachPetExportEvents } from "../../packages/maintainer/pets-maker/src/custom-pet-export-events.js";
class Control extends EventTarget {
  value = ""; textContent = ""; disabled = false; hidden = false; files: unknown[] = [];
  focus() {} select() {} querySelectorAll() { return this.inputs; }
  inputs: Control[] = [];
  fire(type: string) { this.dispatchEvent(new Event(type)); }
}
function controls() {
  const controller = new AbortController();
  const family = new Control(); family.value = "milady";
  const nft = new Control(); nft.value = "1";
  const avatar = new Control(); const form = new Control();form.inputs = [family, nft, avatar];
  return { controller, signal: controller.signal, family: { select: family }, familyLabels: { milady: "Milady", remilio: "Remilio" }, nftNumberInput: nft,
    avatar, form, nftNumber: new Control(), nftNumberHelp: new Control(), bottom: { select: new Control() }, coverage: { select: new Control() }, preview: new Control(), status: new Control(),
    fetchTraitsButton: new Control(), previewButton: new Control(), exportButton: new Control(), instruction: new Control(), copyInstruction: new Control(),
    traitInputs: { race: { assetId: new Control(), label: new Control() } }, updateBottomCompatibility: vi.fn() };
}
afterEach(() => vi.resetAllMocks());
describe("Pets Maker asynchronous selection ownership", () => {
  it("does not populate traits after the user changes the selected family", async () => {
    let finish!: (value: unknown) => void;
    mocks.fetch.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const ui = controls(); attachPetExportEvents(ui);ui.fetchTraitsButton.fire("click");
    ui.family.select.value = "remilio";ui.family.select.fire("change");
    finish({ race: { assetId: "old-family", label: "Old" } });
    await vi.waitFor(() => expect(ui.fetchTraitsButton.textContent).toBe("Fetch"));
    expect(ui.traitInputs.race.assetId.value).toBe("");ui.controller.abort();
  });
  it("contains missing-family validation instead of rejecting the event callback", () => {
    const ui = controls();ui.family.select.value = "";attachPetExportEvents(ui);ui.fetchTraitsButton.fire("click");
    expect(ui.status.textContent).toContain("Choose a Maker");expect(mocks.fetch).not.toHaveBeenCalled();ui.controller.abort();
  });
  it("discards obsolete PNG decodes without closing the current image", async () => {
    let finishOld!: (value: unknown) => void;
    const oldImage = { close: vi.fn() };const newImage = { close: vi.fn() };
    mocks.decode.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; })).mockResolvedValueOnce(newImage);
    mocks.inspect.mockResolvedValue(undefined);
    const ui = controls();attachPetExportEvents(ui);
    const file = { type: "image/png", size: 1, arrayBuffer: async () => new ArrayBuffer(1) };
    ui.avatar.files = [file];ui.avatar.fire("change");await vi.waitFor(() => expect(mocks.decode).toHaveBeenCalledTimes(1));
    ui.avatar.fire("change");await vi.waitFor(() => expect(ui.status.textContent).toContain("loaded locally"));
    finishOld(oldImage);await vi.waitFor(() => expect(oldImage.close).toHaveBeenCalledOnce());
    expect(newImage.close).not.toHaveBeenCalled();ui.controller.abort();expect(newImage.close).toHaveBeenCalledOnce();
  });
});
