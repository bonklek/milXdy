import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPopupPresetController } from "./preset-controller";
import { presetValue, type PresetStorage } from "../../platform/settings/preset-transaction";
const mocks = vi.hoisted(() => ({ review: vi.fn(), result: vi.fn() }));
vi.mock("../../platform/settings/preset-review", () => ({ reviewPreset: mocks.review, showPresetResult: mocks.result, chooseSavedPreset: vi.fn() }));
beforeEach(() => { vi.clearAllMocks(); mocks.review.mockResolvedValue("apply"); });
function fixture() {
  const values: Record<string, Record<string, unknown>> = { local: {}, sync: {} };
  const storage = Object.fromEntries(["local", "sync"].map(area => [area, {
    get: async (keys: string[]) => Object.fromEntries(keys.filter(key => Object.hasOwn(values[area], key)).map(key => [key, values[area][key]])),
    set: async (patch: Record<string, unknown>) => Object.assign(values[area], patch),
    remove: async (keys: string[]) => keys.forEach(key => delete values[area][key]),
  }])) as unknown as PresetStorage;
  return { storage, values };
}
describe("popup preset refresh honesty", () => {
  it("reports stored changes as applied when the display refresh fails", async () => {
    const { storage, values } = fixture();
    const controller = createPopupPresetController(storage, async () => { throw new Error("tab refresh failed"); });
    expect(await controller.apply("Review", async () => [{ area: "local", key: "theme", label: "Theme", value: presetValue("max") }])).toBe(true);
    expect(values.local.theme).toBe("max");
    const result = mocks.result.mock.calls.at(-1)?.[0];
    expect(result).toMatchObject({ status: "applied" });
    expect(result.message).toContain("Reviewed changes applied"); expect(result.message).toContain("display could not refresh");
    expect(result.message).not.toContain("not changed");
  });
  it("does not refresh or write when review is cancelled", async () => {
    const { storage, values } = fixture(); const refresh = vi.fn(); mocks.review.mockResolvedValue("cancel");
    const controller = createPopupPresetController(storage, refresh);
    expect(await controller.apply("Review", async () => [{ area: "local", key: "theme", label: "Theme", value: presetValue("max") }])).toBe(false);
    expect(refresh).not.toHaveBeenCalled(); expect(values).toEqual({ local: {}, sync: {} });
  });
});
