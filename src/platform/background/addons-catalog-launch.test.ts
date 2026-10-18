import { describe, expect, it, vi } from "vitest";
import { createAddonsCatalogLauncher } from "./addons-catalog-launch";
import { MILXDY_ADDONS_CATALOG_URL } from "../app-sdk/addons-catalog";

function fixture() {
  const tabs = { get: vi.fn().mockResolvedValue({ url: MILXDY_ADDONS_CATALOG_URL, windowId: 7 }), update: vi.fn().mockResolvedValue({}), create: vi.fn().mockResolvedValue({ id: 4 }) };
  const focus = vi.fn().mockResolvedValue({});
  const confirm = vi.fn().mockResolvedValue(true);
  return { tabs, focus, confirm, launch: createAddonsCatalogLauncher(tabs, focus, confirm) };
}
describe("catalog discovery tab", () => {
  it("deduplicates simultaneous requests then focuses only its approved existing tab and window", async () => {
    const f = fixture();
    const first = f.launch();
    expect(f.launch()).toBe(first);
    expect(await first).toEqual({ ok: true, reused: false });
    expect(f.tabs.create).toHaveBeenCalledExactlyOnceWith({ url: MILXDY_ADDONS_CATALOG_URL, active: true });
    expect(await f.launch()).toEqual({ ok: true, reused: true });
    expect(f.tabs.update).toHaveBeenCalledExactlyOnceWith(4, { active: true });
    expect(f.focus).toHaveBeenCalledExactlyOnceWith(7);
  });
  it("leaves a navigated-away tab untouched and creates a fresh allowed catalog tab", async () => {
    const f = fixture();
    await f.launch();
    f.tabs.get.mockResolvedValue({ url: "https://example.com/private", windowId: 7 });
    await f.launch();
    expect(f.tabs.update).not.toHaveBeenCalled();
    expect(f.focus).not.toHaveBeenCalled();
    expect(f.tabs.create).toHaveBeenCalledTimes(2);
    expect(f.confirm).not.toHaveBeenCalled();
  });
  it("confirms a URL-withheld tab through the catalog bridge without adding tab permissions", async () => {
    const f = fixture(); await f.launch();
    f.tabs.get.mockResolvedValue({ windowId: 7 });
    expect(await f.launch()).toEqual({ ok: true, reused: true });
    expect(f.confirm).toHaveBeenCalledExactlyOnceWith(4);
    f.confirm.mockResolvedValue(false);
    expect(await f.launch()).toEqual({ ok: true, reused: false });
    expect(f.tabs.create).toHaveBeenCalledTimes(2);
  });
  it("recovers after a closed tab or rejected creation without exposing browser error text", async () => {
    const f = fixture();
    f.tabs.create.mockRejectedValueOnce(new Error("private-browser-detail"));
    expect(await f.launch()).toEqual({ ok: false, error: "catalog_unavailable" });
    await f.launch();
    f.tabs.get.mockRejectedValue(new Error("closed"));
    expect(await f.launch()).toEqual({ ok: true, reused: false });
    expect(f.tabs.create).toHaveBeenCalledTimes(3);
  });
});
