import { describe, expect, it } from "vitest";
import { isAllowedPageActionUrl, pageContextMenuId } from "./page-context-actions";

describe("manifest-declared page context actions", () => {
  it("uses stable package-scoped menu ids", () => {
    expect(pageContextMenuId("reader", "audio-export")).toBe("milxdy:page-context:reader:audio-export");
  });

  it("accepts only HTTP and HTTPS active-tab pages", () => {
    expect(isAllowedPageActionUrl("https://example.com/article")).toBe(true);
    expect(isAllowedPageActionUrl("http://localhost/article")).toBe(true);
    expect(isAllowedPageActionUrl("file:///private/article.html")).toBe(false);
    expect(isAllowedPageActionUrl("chrome://extensions")).toBe(false);
    expect(isAllowedPageActionUrl("javascript:alert(1)")).toBe(false);
    expect(isAllowedPageActionUrl(undefined)).toBe(false);
  });
});
