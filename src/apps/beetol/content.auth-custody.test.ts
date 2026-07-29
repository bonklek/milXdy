import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Beetol content auth custody", () => {
  it("does not probe access or refresh token storage keys", async () => {
    const source = await readFile(new URL("./content.js", import.meta.url), "utf8");

    expect(source).not.toContain("beetol.accessToken");
    expect(source).not.toContain("beetol.refreshToken");
    expect(source).toContain("checkAuthStatus(true)");
  });
});
