import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Remilia API production registration", () => {
  const source = readFileSync(new URL("./remilia-api-registration.ts", import.meta.url), "utf8");

  it("registers only the capability broker against the shared singleton", () => {
    expect(source).toContain("createRemiliaCapabilityBrokerHandlers(remiliaApiClient)");
    expect(source).not.toContain("createRemiliaApiRouterHandlers");
    expect(source).not.toContain("remiliaApi:request");
    expect(source.match(/new RemiliaApiClient/g)).toHaveLength(1);
  });
});
