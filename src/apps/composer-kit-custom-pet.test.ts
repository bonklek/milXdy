import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BODY_COMPLETION_CATALOG,
  PET_REQUEST_FAMILIES,
  createStoredZip,
  listStoredZip,
  makePetRequest,
  sha256Hex,
  stableJson,
  validatePetRequest,
  validatePetRequestShape,
} from "../../examples/packages/local-dev/tweet-composer-kit/src/custom-pet-contract.js";

function pngHeader(width = 1024, height = 1024): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(bytes.buffer).setUint32(8, 13, false);
  bytes.set(new TextEncoder().encode("IHDR"), 12);
  new DataView(bytes.buffer).setUint32(16, width, false);
  new DataView(bytes.buffer).setUint32(20, height, false);
  bytes[24] = 8;
  bytes[25] = 6;
  return bytes;
}

function completeBody() {
  return {
    legCoverage: "covered",
    legColorVariant: "warm-medium",
    bottom: {
      category: "jeans",
      assetId: "maker-bottom-jeans-v1",
      assetVersion: 1,
      colorVariant: "denim-blue",
    },
    footwear: {
      category: "sneakers",
      assetId: "maker-footwear-sneakers-v1",
      assetVersion: 1,
      colorVariant: "white",
    },
  };
}

function completeTraits() {
  return Object.fromEntries(["race", "hair", "eyes", "glasses", "shirt", "earrings"].map((trait) => [
    trait,
    { assetId: trait === "glasses" || trait === "earrings" ? "none" : `sample-${trait}-v1`, label: `Sample ${trait}` },
  ]));
}

async function validRequest(templateFamily = "milady") {
  const avatar = pngHeader();
  return {
    avatar,
    request: makePetRequest({
      templateFamily,
      imageSha256: await sha256Hex(avatar),
      traits: completeTraits(),
      bodyCompletion: completeBody(),
      rightsScope: "private-review",
      petName: "Sanitized Sample",
      personality: "Calm and observant.",
    }),
  };
}

describe("Composer Kit Custom Pet request contract", () => {
  it.each(PET_REQUEST_FAMILIES)("accepts an explicit %s family request", async (templateFamily) => {
    const { avatar, request } = await validRequest(templateFamily);
    await expect(validatePetRequest(request, avatar)).resolves.toEqual({ ok: true, errors: [] });
  });

  it("rejects an invented or incomplete lower half", async () => {
    const { request } = await validRequest();
    const incomplete = structuredClone(request);
    delete incomplete.bodyCompletion.footwear;
    expect(validatePetRequestShape(incomplete)).toContain(
      "bodyCompletion.footwear must identify a catalog category, assetId, and assetVersion.",
    );
  });

  it("rejects a bottom incompatible with leg coverage", async () => {
    const { request } = await validRequest();
    const incompatible = structuredClone(request);
    incompatible.bodyCompletion.legCoverage = "exposed";
    expect(validatePetRequestShape(incompatible)).toContain("Jeans is incompatible with exposed leg coverage.");
  });

  it("rejects a corrupt hash and noncanonical dimensions", async () => {
    const { request } = await validRequest();
    const wrongSize = pngHeader(512, 512);
    const result = await validatePetRequest(request, wrongSize);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain("avatar.png must be 1024x1024; received 512x512.");
  });

  it("writes a deterministic ZIP containing exactly avatar.png and request.json", async () => {
    const { avatar, request } = await validRequest("kagami");
    const requestBytes = new TextEncoder().encode(stableJson(request));
    const first = createStoredZip([
      { name: "avatar.png", bytes: avatar },
      { name: "request.json", bytes: requestBytes },
    ]);
    const second = createStoredZip([
      { name: "avatar.png", bytes: avatar },
      { name: "request.json", bytes: requestBytes },
    ]);
    expect(first).toEqual(second);
    expect(listStoredZip(first).map((entry) => entry.name)).toEqual(["avatar.png", "request.json"]);
  });

  it("keeps catalog identifiers versioned and stable", () => {
    expect(BODY_COMPLETION_CATALOG.version).toBe(1);
    expect(BODY_COMPLETION_CATALOG.bottoms.every((item) => item.assetVersion === 1 && item.assetId.endsWith("-v1"))).toBe(true);
    expect(BODY_COMPLETION_CATALOG.footwear.every((item) => item.assetVersion === 1 && item.assetId.endsWith("-v1"))).toBe(true);
  });

  it("ships the accessible export and handoff controls in the existing Composer Kit package", () => {
    const source = readFileSync("examples/packages/local-dev/tweet-composer-kit/src/custom-pet-ui.js", "utf8");
    const bundled = readFileSync("examples/packages/local-dev/tweet-composer-kit/dist/content.js", "utf8");
    const manifest = JSON.parse(readFileSync("examples/packages/local-dev/tweet-composer-kit/milxdy.app.json", "utf8"));
    expect(source).toContain('ariaLabel: "Custom Pet export"');
    expect(source).toContain('textContent: "Download remilia-pet-request.zip"');
    expect(source).toContain('ariaLive: "polite"');
    expect(bundled).toContain("Use $remilia-maker-pet-import with the attached Maker export bundle.");
    expect(manifest.id).toBe("tweet-composer-kit");
    expect(manifest.surfaces).toEqual(["composerAction", "replyAction"]);
    expect(manifest.privacy.dataNotes.join(" ")).toContain("not uploaded");
  });
});
