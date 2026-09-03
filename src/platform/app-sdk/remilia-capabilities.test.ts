import { describe, expect, it } from "vitest";
import {
  REMILIA_CAPABILITY_DEFINITIONS,
  validateRemiliaCapabilityDeclarations,
  type AppRemiliaCapabilityDeclaration,
} from "./remilia-capabilities";

describe("Remilia capability declarations", () => {
  it("accepts exact operation, official scope, and consent declarations", () => {
    expect(validateRemiliaCapabilityDeclarations([declaration("remilia.directory.read", ["resolveDirectory"])] )).toBe(true);
    expect(validateRemiliaCapabilityDeclarations([declaration("remilia.profile.public", ["getUserProfile"])] )).toBe(true);
  });

  it("rejects scope, operation, consent, and duplicate capability drift", () => {
    const directory = declaration("remilia.directory.read", ["resolveDirectory"]);
    expect(validateRemiliaCapabilityDeclarations([{ ...directory, scopes: [] }])).toBe(false);
    expect(validateRemiliaCapabilityDeclarations([{ ...directory, operations: ["getMyStats"] }])).toBe(false);
    expect(validateRemiliaCapabilityDeclarations([{ ...directory, consent: "perInvocation" }])).toBe(false);
    expect(validateRemiliaCapabilityDeclarations([directory, directory])).toBe(false);
  });

  it("pins write capabilities to per-invocation consent", () => {
    expect(REMILIA_CAPABILITY_DEFINITIONS["remilia.pokes.write"].consent).toBe("perInvocation");
    expect(REMILIA_CAPABILITY_DEFINITIONS["remilia.chat.write"].consent).toBe("perInvocation");
  });
});

function declaration(
  id: AppRemiliaCapabilityDeclaration["id"],
  operations: AppRemiliaCapabilityDeclaration["operations"],
): AppRemiliaCapabilityDeclaration {
  const definition = REMILIA_CAPABILITY_DEFINITIONS[id];
  return {
    id,
    operations,
    scopes: [...definition.scopes],
    consent: definition.consent,
    reason: "Reviewed package behavior under explicit consent.",
  };
}
