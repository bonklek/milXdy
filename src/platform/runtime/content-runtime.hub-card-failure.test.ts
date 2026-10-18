import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("Apps & Features card failure containment", () => {
  it("keeps rendering later cards while exposing only a compact fallback", async () => {
    const runtime = await readFile(new URL("./content-runtime.ts", import.meta.url), "utf8");
    const section = await readFile(new URL("./hub-section-services.ts", import.meta.url), "utf8");

    expect(section).toContain("try {");
    expect(section).toContain("deps.appHubCard(app)");
    expect(section).toContain("deps.appHubCardFailure(app)");
    expect(section).toContain('error: "card render failed"');
    expect(await readFile(new URL("./hub-card-failure.ts", import.meta.url), "utf8")).toContain('detail.textContent = "This app could not be rendered."');
    expect(runtime).toContain("createHubSectionServices");
    expect(section).not.toContain("errorMessage(error)");
    expect(section).not.toContain("error.stack");
  });
});
