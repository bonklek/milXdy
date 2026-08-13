import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const remiStatsContent = readFileSync(new URL("./content.js", import.meta.url), "utf8");
const chatContent = readFileSync(new URL("../reminet-chat/content.ts", import.meta.url), "utf8");
const beetolBackground = readFileSync(new URL("../beetol/background.js", import.meta.url), "utf8");
const popup = readFileSync(new URL("../../extension/popup/index.ts", import.meta.url), "utf8");

describe("official RemiStats UI and legacy boundaries", () => {
  it("does not assume a fixed 24-hour poke cooldown in either consumer", () => {
    expect(remiStatsContent).not.toContain("DEFAULT_POKE_COOLDOWN_MS");
    expect(chatContent).not.toContain("DEFAULT_POKE_COOLDOWN_MS");
  });

  it("keeps poke and notification handlers out of the legacy Beetol adapter", () => {
    expect(beetolBackground).not.toContain("beetol:poke");
    expect(beetolBackground).not.toContain("beetol:incomingPokes");
    expect(beetolBackground).not.toContain("/api/pokeUser");
    expect(beetolBackground).not.toContain("/api/notifications");
  });

  it("logs only bounded poke failure fields and renders no target in diagnostics", () => {
    expect(remiStatsContent).toContain("category: String(response?.category || 'unknown')");
    expect(remiStatsContent).toContain("code: String(response?.code || 'unknown_error')");
    expect(remiStatsContent).not.toContain("console.warn('RemiNet poke failed', { username, response })");
    expect(popup).not.toContain("Target: ${String(diagnostic.username");
  });
});
