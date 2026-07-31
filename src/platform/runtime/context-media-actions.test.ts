import { describe, expect, it } from "vitest";
import type { MilxdyAppManifest } from "../app-sdk/app-platform";
import { eligibleContextMediaActions } from "./context-media-actions";

const app = { id: "kit", available: true, contextMediaActions: [{ id: "contribute", label: "Upload", site: "x", eligibleMedia: ["image"], presentation: "hostPanel" }], mediaContributions: [{ id: "contribute", label: "Contribute", adapter: "remibooru", contextMediaActionId: "contribute", maxTags: 12, maxTagLength: 64 }] } as unknown as MilxdyAppManifest;

describe("context media action eligibility", () => {
  it("requires both the enabled package and its reviewed contribution binding", () => {
    expect(eligibleContextMediaActions([app], new Set(["kit"]))).toHaveLength(1);
    expect(eligibleContextMediaActions([app], new Set())).toEqual([]);
  });
});
