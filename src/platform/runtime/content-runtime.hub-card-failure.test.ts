import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Apps & Features card failure containment", () => {
  it("keeps rendering later cards while exposing only a compact fallback", async () => {
    const source = await readFile(new URL("./content-runtime.ts", import.meta.url), "utf8");
    const section = source.slice(source.indexOf("function appendHubSection"), source.indexOf("function isHubRailApp"));

    expect(section).toContain("try {");
    expect(section).toContain("section.append(appHubCard(app));");
    expect(section).toContain("section.append(appHubCardFailure(app));");
    expect(section).toContain('error: "card render failed"');
    expect(section).toContain('detail.textContent = "This app could not be rendered."');
    expect(section).not.toContain("errorMessage(error)");
    expect(section).not.toContain("error.stack");
  });
});
