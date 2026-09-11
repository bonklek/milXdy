import {
  bottomForAssetId,
  createStoredZip,
  footwearForAssetId,
  legColorForRace,
  listStoredZip,
  makePetRequest,
  nftNumberRangeForFamily,
  sha256Hex,
  stableJson,
  validatePetRequest,
} from "./custom-pet-contract.js";
import { fetchMakerTraits } from "./maker-metadata.js";
import { renderCompletedAvatar } from "./custom-pet-avatar-renderer.js";
import {
  decodePng,
  downloadBytes,
  friendlyTrait,
  requireTransparentImage,
  requiredValue,
} from "./custom-pet-ui-primitives.js";

export function attachPetExportEvents(controls) {
  const state = { avatarBytes: null, image: null, previewBytes: null };
  attachAvatarEvents(controls, state);
  attachTraitFetchEvents(controls, state);
  attachPreviewEvents(controls, state);
  attachExportEvents(controls, state);
  attachInstructionCopy(controls);
  controls.signal.addEventListener("abort", () => state.image?.close?.(), { once: true });
}

function attachAvatarEvents(controls, state) {
  const { avatar, bottom, coverage, preview, signal, status, updateBottomCompatibility } = controls;
  avatar.addEventListener("change", async () => {
    resetAvatar(state, preview);
    const file = avatar.files?.[0];
    if (!file) return;
    try {
      if (file.type && file.type !== "image/png") throw new Error("Choose a PNG file.");
      if (file.size > 12 * 1024 * 1024) throw new Error("The Maker PNG must be 12 MB or smaller.");
      state.avatarBytes = new Uint8Array(await file.arrayBuffer());
      state.image = await decodePng(file);
      await requireTransparentImage(state.image);
      status.textContent = "Maker PNG loaded locally. Complete every explicit selection.";
    } catch (error) {
      avatar.value = "";
      resetAvatar(state, preview);
      status.textContent = error instanceof Error ? error.message : "The Maker PNG could not be read.";
    }
  }, { signal });
  coverage.select.addEventListener("change", () => {
    updateBottomCompatibility(bottom.select, coverage.select.value, status);
    state.previewBytes = null;
  }, { signal });
}

function resetAvatar(state, preview) {
  state.avatarBytes = null;
  state.image?.close?.();
  state.image = null;
  state.previewBytes = null;
  preview.hidden = true;
}

function attachTraitFetchEvents(controls, state) {
  const { family, fetchTraitsButton, nftNumberInput, signal } = controls;
  family.select.addEventListener("change", () => updateNftRange(controls), { signal });
  nftNumberInput.addEventListener("input", () => {
    updateFetchButton(fetchTraitsButton, family.select.value, nftNumberInput.value);
  }, { signal });
  fetchTraitsButton.addEventListener("click", () => void fetchTraits(controls, state), { signal });
}

function updateNftRange(controls) {
  const { family, familyLabels, fetchTraitsButton, nftNumber, nftNumberHelp, nftNumberInput } = controls;
  const range = nftNumberRangeForFamily(family.select.value);
  nftNumber.hidden = !range;
  nftNumberHelp.hidden = !range;
  if (!range) {
    nftNumberInput.value = "";
    fetchTraitsButton.disabled = true;
    return;
  }
  nftNumberInput.min = String(range.min);
  nftNumberInput.max = String(range.max);
  nftNumberInput.placeholder = `${range.min}–${range.max}`;
  nftNumberHelp.textContent = `${familyLabels[family.select.value]} NFT numbers run from ${range.min} to ${range.max}.`;
  updateFetchButton(fetchTraitsButton, family.select.value, nftNumberInput.value);
}

async function fetchTraits(controls, state) {
  const { family, familyLabels, fetchTraitsButton, nftNumberInput, signal, status, traitInputs } = controls;
  const templateFamily = requiredValue(family.select, "Choose a Maker template family.");
  const sourceNftNumber = optionalNftNumber(nftNumberInput, templateFamily, familyLabels);
  if (sourceNftNumber == null) {
    nftNumberInput.focus();
    status.textContent = "Enter an NFT number before fetching traits.";
    return;
  }
  fetchTraitsButton.disabled = true;
  fetchTraitsButton.textContent = "Fetching…";
  status.textContent = `Fetching ${familyLabels[templateFamily]} #${sourceNftNumber} traits…`;
  try {
    const traits = await fetchMakerTraits(templateFamily, sourceNftNumber, { signal });
    for (const [trait, value] of Object.entries(traits)) {
      traitInputs[trait].assetId.value = value.assetId;
      traitInputs[trait].label.value = value.label;
    }
    state.previewBytes = null;
    status.textContent = `${familyLabels[templateFamily]} #${sourceNftNumber} traits populated from Maker metadata.`;
  } catch (error) {
    status.textContent = error instanceof Error ? error.message : "Maker traits could not be fetched.";
  } finally {
    if (!signal.aborted) {
      fetchTraitsButton.textContent = "Fetch";
      updateFetchButton(fetchTraitsButton, family.select.value, nftNumberInput.value);
    }
  }
}

function attachPreviewEvents(controls, state) {
  const { avatar, coverage, form, instruction, previewButton, signal } = controls;
  for (const control of form.querySelectorAll("select, input, textarea")) {
    if (control === avatar || control === coverage.select || control === instruction) continue;
    control.addEventListener("change", () => { state.previewBytes = null; }, { signal });
  }
  previewButton.addEventListener("click", () => void renderPreview(controls, state), { signal });
}

async function renderPreview(controls, state) {
  controls.status.textContent = "";
  try {
    const selection = collectSelection(controls, state);
    state.previewBytes = await renderCompletedAvatar(state.image, selection, controls.preview);
    controls.preview.hidden = false;
    controls.status.textContent = "Preview ready. Review the completed lower half before downloading.";
  } catch (error) {
    controls.status.textContent = error instanceof Error ? error.message : "The completed avatar could not be previewed.";
  }
}

function attachExportEvents(controls, state) {
  controls.form.addEventListener("submit", (event) => {
    void exportPetRequest(event, controls, state);
  }, { signal: controls.signal });
}

async function exportPetRequest(event, controls, state) {
  event.preventDefault();
  controls.exportButton.disabled = true;
  controls.previewButton.disabled = true;
  controls.status.textContent = "Validating the local bundle…";
  try {
    const selection = collectSelection(controls, state);
    const avatarPng = await renderCompletedAvatar(state.image, selection, controls.preview);
    state.previewBytes = avatarPng;
    controls.preview.hidden = false;
    const request = makePetRequest({ ...selection, imageSha256: await sha256Hex(avatarPng) });
    const validation = await validatePetRequest(request, avatarPng);
    if (!validation.ok) throw new Error(validation.errors.join(" "));
    const zipBytes = createStoredZip([
      { name: "avatar.png", bytes: avatarPng },
      { name: "request.json", bytes: new TextEncoder().encode(stableJson(request)) },
    ]);
    await validateFinishedArchive(zipBytes);
    downloadBytes(zipBytes, "remilia-pet-request.zip", "application/zip");
    controls.instruction.hidden = false;
    controls.copyInstruction.hidden = false;
    controls.status.textContent = "Bundle validated and downloaded. Attach it to Codex with the instruction below.";
  } catch (error) {
    controls.status.textContent = error instanceof Error ? error.message : "The bundle could not be exported.";
  } finally {
    if (!controls.signal.aborted) {
      controls.exportButton.disabled = false;
      controls.previewButton.disabled = false;
    }
  }
}

function attachInstructionCopy(controls) {
  controls.copyInstruction.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(controls.instruction.value);
      controls.status.textContent = "Codex instruction copied.";
    } catch {
      controls.instruction.hidden = false;
      controls.instruction.focus();
      controls.instruction.select();
      controls.status.textContent = "Clipboard access is unavailable. The instruction is selected for manual copy.";
    }
  }, { signal: controls.signal });
}

function collectSelection(controls, state) {
  if (!state.image || !state.avatarBytes) throw new Error("Choose a transparent Maker PNG.");
  const templateFamily = requiredValue(controls.family.select, "Choose a Maker template family.");
  const sourceNftNumber = optionalNftNumber(controls.nftNumberInput, templateFamily, controls.familyLabels);
  const traits = Object.fromEntries(Object.entries(controls.traitInputs).map(([trait, input]) => {
    const assetId = requiredValue(input.assetId, `Enter the ${friendlyTrait(trait)} asset ID, or "none".`);
    return [trait, { assetId, ...(input.label.value.trim() ? { label: input.label.value.trim() } : {}) }];
  }));
  const legCoverage = requiredValue(controls.coverage.select, "Choose leg coverage.");
  const legColorVariant = legColorForRace(templateFamily, traits.race);
  if (!legColorVariant) {
    controls.traitInputs.race.assetId.focus();
    throw new Error(`The ${controls.familyLabels[templateFamily]} race is not mapped to a leg color yet. Enter its exact race asset ID or label.`);
  }
  const bottomItem = bottomForAssetId(requiredValue(controls.bottom.select, "Choose a compatible bottom garment."));
  const footwearItem = footwearForAssetId(requiredValue(controls.footwear.select, "Choose footwear."));
  if (!bottomItem || !bottomItem.compatibleLegCoverage.includes(legCoverage)) throw new Error("The selected bottom garment is not compatible with the chosen leg coverage.");
  if (!footwearItem) throw new Error("Choose footwear from the maintained catalog.");
  return buildSelection(templateFamily, sourceNftNumber, traits, legCoverage, legColorVariant, bottomItem, footwearItem, controls);
}

function buildSelection(templateFamily, sourceNftNumber, traits, legCoverage, legColorVariant, bottom, footwear, controls) {
  return {
    templateFamily,
    ...(sourceNftNumber == null ? {} : { sourceNftNumber }),
    traits,
    bodyCompletion: {
      legCoverage,
      legColorVariant,
      bottom: { category: bottom.category, assetId: bottom.assetId, assetVersion: bottom.assetVersion, colorVariant: requiredValue(controls.bottomColor.select, "Choose a bottom color.") },
      footwear: { category: footwear.category, assetId: footwear.assetId, assetVersion: footwear.assetVersion, colorVariant: requiredValue(controls.footwearColor.select, "Choose a footwear color.") },
    },
    petName: controls.petName.querySelector("input").value,
    personality: controls.personality.querySelector("input").value,
  };
}

function optionalNftNumber(control, templateFamily, labels) {
  const raw = control.value.trim();
  if (!raw) return null;
  const value = Number(raw);
  const range = nftNumberRangeForFamily(templateFamily);
  if (!Number.isInteger(value) || !range || value < range.min || value > range.max) {
    control.focus();
    throw new Error(`Enter a whole ${labels[templateFamily]} NFT number from ${range?.min ?? "?"} to ${range?.max ?? "?"}.`);
  }
  return value;
}

function updateFetchButton(button, family, rawNumber) {
  const range = nftNumberRangeForFamily(family);
  const value = Number(String(rawNumber).trim());
  button.disabled = !range || !Number.isInteger(value) || value < range.min || value > range.max;
}

async function validateFinishedArchive(zipBytes) {
  const entries = listStoredZip(zipBytes);
  if (entries.length !== 2 || entries[0]?.name !== "avatar.png" || entries[1]?.name !== "request.json") {
    throw new Error("The bundle must contain exactly avatar.png and request.json.");
  }
  const request = JSON.parse(new TextDecoder().decode(entries[1].bytes));
  const validation = await validatePetRequest(request, entries[0].bytes);
  if (!validation.ok) throw new Error(validation.errors.join(" "));
}
