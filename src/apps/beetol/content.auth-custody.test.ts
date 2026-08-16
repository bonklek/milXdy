import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Beetol content auth custody", () => {
  it("uses only token-free status polling and passive official connection guidance", async () => {
    const source = await readFile(new URL("./content.js", import.meta.url), "utf8");

    expect(source).not.toContain("beetol.accessToken");
    expect(source).not.toContain("beetol.refreshToken");
    expect(source).not.toContain("beetol:sessionStatus");
    expect(source).not.toContain("remilia-auth:");
    expect(source).not.toContain("beetol-retry-session");
    expect(source).not.toContain("https://www.remilia.net/");
    expect(source).not.toMatch(/Sign in[\s\S]{0,80}RemiliaNET[\s\S]{0,80}retry Beetol/u);
    expect(source).toContain("Open the milXdy extension popup");
    expect(source).toContain("Remilia connection &rarr; Connect/Reconnect");
    expect(source).toContain("type: 'beetol:authStatus'");
    expect(source).toContain("checkAuthStatus(true)");
    expect(source).toContain("enterSignedOutState(responseMessage || 'Remilia authorization expired.')");
    expect(source).toContain("enterSignedOutState(response?.data?.message || 'Remilia authorization expired.')");
    expect(source).toContain("response?.data?.message || response?.actionResult?.message || response?.error");
  });
});
