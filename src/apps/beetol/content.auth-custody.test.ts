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
    expect(source).not.toMatch(/Sign in[\s\S]{0,80}RemiliaNET[\s\S]{0,80}retry Beetol/u);
    expect(source).toContain("Open the milXdy extension popup");
    expect(source).toContain("Remilia connection &rarr; Connect/Reconnect");
    expect(source).toContain("type: 'beetol:authStatus'");
    expect(source).toContain("checkAuthStatus(true)");
    expect(source).toContain("enterSignedOutState(response?.data?.message || 'Remilia authorization expired.')");
  });

  it("renders official status as read-only and offers one explicit native-game route", async () => {
    const source = await readFile(new URL("./content.js", import.meta.url), "utf8");

    expect(source).toContain("Official read-only status");
    expect(source).toContain("Actions run in RemiliaNET's visible Beetle game.");
    expect(source).toContain("Play Beetle on RemiliaNET");
    expect(source).toContain('target="_blank" rel="noopener noreferrer"');
    expect(source).toContain("?cartridge=beetle");
    expect(source).toContain("encodeURIComponent(username)");
    expect(source).toContain("els.next.textContent = 'Read only'");
    expect(source).toContain('class="beetol-status-row" role="listitem"');

    expect(source).not.toContain('class="beetol-action');
    expect(source).not.toContain("data-action");
    expect(source).not.toContain("type: 'beetol:action'");
    expect(source).not.toContain("type: 'beetol:crunchJunk'");
    expect(source).not.toContain("beetol:crunchProgress");
    expect(source).not.toContain("window.open(");
    expect(source).not.toMatch(/chrome\.(tabs|windows)\b/u);
  });
});
