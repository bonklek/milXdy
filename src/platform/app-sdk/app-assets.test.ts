import { describe, expect, it, vi } from "vitest";
import { createAppAssetResolver } from "./app-assets";

describe("createAppAssetResolver", () => {
  it("maps declared local-package assets into the package namespace", () => {
    const getUrl = vi.fn((path: string) => `chrome-extension://id/${path}`);
    const resolve = createAppAssetResolver({
      id: "reader",
      localPackage: {},
      package: { assets: ["local-apps/reader/assets/icon.svg"] },
    }, getUrl);
    expect(resolve("assets/icon.svg")).toBe("chrome-extension://id/local-apps/reader/assets/icon.svg");
  });

  it("allows policy-granted host files and directory roots", () => {
    const resolve = createAppAssetResolver({
      id: "reader",
      localPackage: {},
      package: { assets: [] },
      hostAssetAccess: ["ocr.html", "post-reading"],
    }, (path) => path);
    expect(resolve("ocr.html")).toBe("ocr.html");
    expect(resolve("post-reading/logo.png")).toBe("post-reading/logo.png");
  });

  it("rejects undeclared and unsafe paths", () => {
    const resolve = createAppAssetResolver({ id: "reader", package: { assets: [] } }, (path) => path);
    expect(() => resolve("other/icon.svg")).toThrow("not declared or policy-granted");
    expect(() => resolve("../secret.txt")).toThrow("unsafe");
    expect(() => resolve("https://example.com/icon.svg")).toThrow("relative path");
  });
});
