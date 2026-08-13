import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import {
  createLegacyBeetleActionsAdapter,
  LEGACY_BEETLE_ENDPOINTS,
  legacyBeetleTrophyShelfUrl,
} from "./legacy-beetle-actions";

describe("legacy Beetle endpoint isolation", () => {
  it("documents privacy and a concrete removal condition for every retained operation", () => {
    expect(LEGACY_BEETLE_ENDPOINTS.map((endpoint) => endpoint.operation)).toEqual([
      "catchBeetle",
      "beetleHunt",
      "claimUBC",
      "junkFaucet",
      "craft",
      "trophyShelf",
    ]);
    for (const endpoint of LEGACY_BEETLE_ENDPOINTS) {
      expect(endpoint.apiFamily).toBe("legacy-undocumented");
      expect(endpoint.pathTemplate).toMatch(/^\/api\/beetle\//);
      expect(endpoint.pathTemplate).not.toContain("/api/v1/");
      expect(endpoint.privacy.length).toBeGreaterThan(40);
      expect(endpoint.removalCondition).toMatch(/Remove this/i);
    }
  });

  it("allows only typed legacy actions and labels the transport family explicitly", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    const adapter = createLegacyBeetleActionsAdapter(request);

    await adapter.runAction("beetleHunt");

    expect(request).toHaveBeenCalledWith({
      operation: "beetleHunt",
      apiFamily: "legacy-undocumented",
      method: "POST",
      path: "/api/beetle/action/beetleHunt",
      body: {},
    });
  });

  it("fails closed instead of accepting arbitrary action or endpoint names", async () => {
    const request = vi.fn();
    const adapter = createLegacyBeetleActionsAdapter(request);

    await expect(adapter.runAction("https://evil.example/action" as never)).resolves.toEqual({
      ok: false,
      error: "UNKNOWN_LEGACY_BEETLE_ACTION",
    });
    expect(request).not.toHaveBeenCalled();
  });

  it("sends only validated craft codenames through the fixed legacy path", async () => {
    const request = vi.fn().mockResolvedValue({ ok: true });
    const adapter = createLegacyBeetleActionsAdapter(request);

    await adapter.craftJunk("loose_junk", "pinecone");
    await expect(adapter.craftJunk("../../token", "pinecone")).resolves.toEqual({
      ok: false,
      error: "INVALID_LEGACY_CRAFT_ITEM",
    });

    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({
      operation: "craft",
      apiFamily: "legacy-undocumented",
      method: "POST",
      path: "/api/beetle/action/craft",
      body: { type: 1, slot1: "loose_junk", slot2: "pinecone" },
    });
  });

  it("builds only the fixed public Remilia trophy shelf URL", () => {
    expect(legacyBeetleTrophyShelfUrl("@remilia")).toBe(
      "https://www.remilia.net/api/beetle/trophy/~remilia/shelf",
    );
    expect(legacyBeetleTrophyShelfUrl("remilia/path")).toBeNull();
    expect(legacyBeetleTrophyShelfUrl("remilia", "https://evil.example")).toBeNull();
  });

  it("keeps undocumented paths out of feature call sites", async () => {
    const [background, remistats] = await Promise.all([
      readFile(new URL("./background.js", import.meta.url), "utf8"),
      readFile(new URL("../remistats/content.js", import.meta.url), "utf8"),
    ]);

    expect(background).toContain("legacyBeetleActions.runAction(action)");
    expect(background).toContain("legacyBeetleActions.craftJunk(pool[i], pool[i + 1])");
    expect(background).not.toMatch(/remilia(?:Authed)?Fetch\('POST',\s*['`]\/api\/beetle\/action/);
    expect(remistats).toContain("legacyBeetleTrophyShelfUrl(clean, REMILIA_BASE_URL)");
    expect(remistats).not.toContain("/api/beetle/trophy/");
  });
});
