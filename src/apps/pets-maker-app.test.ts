import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  BODY_COMPLETION_CATALOG,
  PET_REQUEST_FAMILIES,
  PET_REQUEST_NFT_RANGES,
  createStoredZip,
  legColorForRace,
  listStoredZip,
  makePetRequest,
  sha256Hex,
  stableJson,
  validatePetRequest,
  validatePetRequestShape,
} from "../../packages/maintainer/pets-maker/src/custom-pet-contract.js";
import {
  makerMetadataUrl,
  traitsFromMakerMetadata,
} from "../../packages/maintainer/pets-maker/src/maker-metadata.js";

type PetRequestFamily = keyof typeof PET_REQUEST_NFT_RANGES;
type PetRequestWithNftNumber = ReturnType<typeof makePetRequest> & {
  sourceNftNumber: number;
};

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

async function validRequest(templateFamily: PetRequestFamily = "milady") {
  const avatar = pngHeader();
  const request = makePetRequest({
    templateFamily,
    sourceNftNumber: PET_REQUEST_NFT_RANGES[templateFamily].min,
    imageSha256: await sha256Hex(avatar),
    traits: completeTraits(),
    bodyCompletion: completeBody(),
    petName: "Sanitized Sample",
    personality: "Calm and observant.",
  }) as PetRequestWithNftNumber;
  return {
    avatar,
    request,
  };
}

describe("Pets Maker request contract", () => {
  it("maps official family metadata into deterministic request traits", () => {
    expect(makerMetadataUrl("milady", 1000)).toBe("https://maker.remilia.org/metadata/Milady/1000");
    expect(traitsFromMakerMetadata("milady", {
      attributes: [
        { trait_type: "Race", value: "Clay" },
        { trait_type: "Hair", value: "OG Frosted Blonde" },
        { trait_type: "Eyes", value: "Classic" },
        { trait_type: "Shirt", value: "Blue Pink Shirt" },
      ],
    })).toEqual({
      race: { assetId: "milady-race-clay-v1", label: "Clay" },
      hair: { assetId: "milady-hair-og-frosted-blonde-v1", label: "OG Frosted Blonde" },
      eyes: { assetId: "milady-eyes-classic-v1", label: "Classic" },
      glasses: { assetId: "none", label: "None" },
      shirt: { assetId: "milady-shirt-blue-pink-shirt-v1", label: "Blue Pink Shirt" },
      earrings: { assetId: "none", label: "None" },
    });
  });

  it("uses family-specific metadata aliases for Bonkler and Kagami", () => {
    expect(traitsFromMakerMetadata("bonkler", { attributes: [
      { trait_type: "Body", value: "Another Freaking Mech" },
      { trait_type: "Head", value: "Technics Record Player" },
      { trait_type: "Face", value: "Gendo" },
      { trait_type: "Armor", value: "White Trim" },
    ] }).race.label).toBe("Another Freaking Mech");
    expect(traitsFromMakerMetadata("kagami", { attributes: [
      { trait_type: "Girl", value: "Lavender" },
      { trait_type: "Outfit", value: "Coconut" },
    ] }).shirt).toEqual({ assetId: "kagami-outfit-coconut-v1", label: "Coconut" });
  });

  it("derives leg color from family-specific race mappings", () => {
    expect(legColorForRace("milady", { assetId: "milady-alien-skin-v1", label: "Alien" })).toBe("fantasy-green");
    expect(legColorForRace("remilio", { assetId: "remilio-zombie-race-v1", label: "Zombie" })).toBe("cool-pale");
    expect(legColorForRace("bonkler", { assetId: "bonkler-bronze-race-v1", label: "Bronze" })).toBe("brown");
    expect(legColorForRace("kagami", { assetId: "kagami-porcelain-race-v1", label: "Porcelain" })).toBe("cool-pale");
    expect(legColorForRace("milady", { assetId: "milady-unmapped-v1", label: "Unmapped" })).toBeNull();
  });

  it.each(PET_REQUEST_FAMILIES as readonly PetRequestFamily[])("accepts an explicit %s family request", async (templateFamily) => {
    const { avatar, request } = await validRequest(templateFamily);
    expect(request).not.toHaveProperty("rightsScope");
    expect(request.generator).toEqual({
      id: "pets-maker",
      version: "0.1.0-pilot",
      deterministicCompositeVersion: 1,
    });
    await expect(validatePetRequest(request, avatar)).resolves.toEqual({ ok: true, errors: [] });
  });

  it.each([
    ["milady", 0, 9999],
    ["remilio", 1, 10000],
    ["bonkler", 1, 150],
    ["kagami", 1, 3000],
  ] as const)("enforces the official %s NFT-number range", async (templateFamily, min, max) => {
    const { request } = await validRequest(templateFamily);
    expect(request.sourceNftNumber).toBe(min);
    request.sourceNftNumber = max;
    expect(validatePetRequestShape(request)).toEqual([]);
    request.sourceNftNumber = max + 1;
    expect(validatePetRequestShape(request)).toContain(
      `sourceNftNumber must be an integer from ${min} to ${max} for ${templateFamily}.`,
    );
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

  it("ships as a disabled, lazy side-rail app and leaves Composer Kit pet-free", () => {
    const source = readFileSync("packages/maintainer/pets-maker/src/custom-pet-ui.js", "utf8");
    const appSource = readFileSync("packages/maintainer/pets-maker/src/content.js", "utf8");
    const themeSource = readFileSync("packages/maintainer/pets-maker/styles/theme.css", "utf8");
    const overlaySource = readFileSync("packages/maintainer/pets-maker/styles/overlay.css", "utf8");
    const makerStyles = readFileSync("packages/maintainer/pets-maker/styles/maker.css", "utf8");
    const bundled = readFileSync("packages/maintainer/pets-maker/dist/content.js", "utf8");
    const manifest = JSON.parse(readFileSync("packages/maintainer/pets-maker/milxdy.app.json", "utf8"));
    const composerSource = readFileSync("examples/packages/local-dev/tweet-composer-kit/src/content.js", "utf8");
    expect(source).toContain('ariaLabel: "Custom Pet export"');
    expect(source).toContain('textContent: "Download remilia-pet-request.zip"');
    expect(source).toContain('ariaLive: "polite"');
    expect(bundled).toContain("Use $remilia-maker-pet-import with the attached Maker export bundle.");
    expect(manifest.id).toBe("pets-maker");
    expect(manifest.packageKind).toBe("app");
    expect(manifest.defaultEnabled).toBe(false);
    expect(manifest.surfaces).toEqual(["overlayApp"]);
    expect(manifest.loadTriggers).toEqual(["dockOpen"]);
    expect(manifest.hub.rail).toEqual({ supported: true, defaultPinned: true });
    expect(manifest.dock.icon).toBe("assets/remy.png");
    expect(manifest.chrome.nativeStyle).toBe("reminet");
    expect(manifest.permissions.hosts).toEqual(["https://maker.remilia.org/*"]);
    expect(manifest.privacy.privacyLabels).toContain("remote-api");
    expect(manifest.privacy.dataNotes.join(" ")).toContain("image is never uploaded");
    expect(manifest.privacy.dataNotes.join(" ")).toContain("family and NFT number");
    expect(appSource).toContain('panel.className = "pets-maker-app"');
    expect(appSource).toContain('resolveAssetUrl("assets/remy.png")');
    expect(appSource).toContain('wipLabel.textContent = "WORK IN PROGRESS"');
    expect(appSource).toContain('closeButton.setAttribute("aria-label", "Minimize Pets Maker")');
    expect(appSource).toContain('closeButton.textContent = "−"');
    expect(appSource).toContain('header.addEventListener("pointerdown", onPanelPointerDown');
    expect(appSource).toContain("handle.setPointerCapture(event.pointerId)");
    expect(appSource).toContain("window.innerWidth - bounds.width - margin");
    expect(appSource).toContain('eyebrow.textContent = "Remilia pet lab / 01"');
    expect(appSource).toContain('subtitle.textContent = "Maker avatar → validated Codex handoff"');
    expect(appSource).not.toContain("Ã—");
    expect(themeSource).toContain('var(--milxdy-font-ui, "Milxdy Remilia Hei"');
    expect(overlaySource).toContain("border-inline-end-width: 4px");
    expect(overlaySource).toContain("repeating-linear-gradient");
    expect(overlaySource).toContain("inset-inline-end: 76px");
    expect(overlaySource).toContain("resize: both");
    expect(overlaySource).toContain('.pets-maker-app[data-dragging="true"]');
    expect(overlaySource).toContain(".pets-maker-app__wip");
    expect(makerStyles).toContain('content: "LOCAL / PRIVATE"');
    expect(makerStyles).toContain('content: "0" counter(pet-step) " / "');
    expect(makerStyles).toContain("@media (forced-colors: active)");
    expect(composerSource).not.toContain("buildCustomPetExport");
    expect(composerSource).not.toContain("custom-pet-ui");
    expect(source).not.toContain("Rights scope");
    expect(source).not.toContain("rightsConfirmed");
    expect(source).not.toContain("rightsScope");
    expect(source).not.toContain('blankSelect("Leg color"');
    expect(source).toContain("legColorForRace(templateFamily, traits.race)");
    expect(source).toContain("NFT number (optional)");
    expect(source).toContain('textContent: "Fetch"');
    expect(source).toContain("fetchMakerTraits(templateFamily, sourceNftNumber");
    expect(source).toContain("nftNumberRangeForFamily(family.select.value)");
  });
});
