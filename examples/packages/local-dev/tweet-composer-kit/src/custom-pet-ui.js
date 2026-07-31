import {
  BODY_COMPLETION_CATALOG,
  PET_REQUEST_FAMILIES,
  PET_REQUEST_INSTRUCTION,
  PET_REQUEST_TRAITS,
  bottomForAssetId,
  colorForId,
  compatibleBottoms,
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

const FAMILY_LABELS = Object.freeze({
  milady: "Milady",
  remilio: "Remilio",
  bonkler: "Bonkler",
  kagami: "Kagami",
});

export function buildCustomPetExport({ signal }) {
  const section = element("section", {
    className: "tweet-composer-kit__pet-export",
    ariaLabel: "Custom Pet export",
  });
  const summary = element("div", { className: "tweet-composer-kit__pet-heading" },
    element("strong", { textContent: "Custom Pet export" }),
    element("span", {
      className: "tweet-composer-kit__pet-local-note",
      textContent: "Local download only. Nothing is uploaded.",
    }),
  );
  const disclosure = element("button", {
    className: "tweet-composer-kit__pet-disclosure",
    type: "button",
    ariaExpanded: "false",
    textContent: "Prepare Maker pet bundle",
  });
  const form = element("form", {
    className: "tweet-composer-kit__pet-form",
    hidden: true,
    noValidate: true,
  });
  const family = blankSelect("Maker template family", PET_REQUEST_FAMILIES.map((id) => ({ id, label: FAMILY_LABELS[id] })));
  family.select.name = "templateFamily";
  const nftNumberInput = element("input", {
    className: "tweet-composer-kit__pet-input",
    type: "number",
    step: "1",
    inputMode: "numeric",
    autocomplete: "off",
    ariaDescribedBy: "tweet-composer-kit-pet-nft-number-help",
  });
  const nftNumber = labeledControl("NFT number (optional)", nftNumberInput);
  nftNumber.hidden = true;
  const nftNumberHelp = element("p", {
    id: "tweet-composer-kit-pet-nft-number-help",
    className: "tweet-composer-kit__pet-help",
    hidden: true,
  });
  const avatar = element("input", {
    className: "tweet-composer-kit__pet-file",
    type: "file",
    accept: "image/png,.png",
    required: true,
    ariaDescribedBy: "tweet-composer-kit-pet-avatar-help",
  });
  const avatarHelp = element("p", {
    id: "tweet-composer-kit-pet-avatar-help",
    className: "tweet-composer-kit__pet-help",
    textContent: "Choose the transparent PNG downloaded from the selected Maker. Opaque backgrounds are rejected.",
  });
  const traitInputs = Object.fromEntries(PET_REQUEST_TRAITS.map((trait) => {
    const assetId = element("input", {
      className: "tweet-composer-kit__pet-input",
      type: "text",
      maxLength: 80,
      required: true,
      autocomplete: "off",
      placeholder: `${trait} asset ID or none`,
      ariaLabel: `${friendlyTrait(trait)} stable asset ID`,
    });
    const label = element("input", {
      className: "tweet-composer-kit__pet-input",
      type: "text",
      maxLength: 120,
      autocomplete: "off",
      placeholder: "Readable label (optional)",
      ariaLabel: `${friendlyTrait(trait)} readable label`,
    });
    return [trait, { assetId, label }];
  }));
  const coverage = blankSelect("Leg coverage", BODY_COMPLETION_CATALOG.legCoverage);
  const bottom = blankSelect("Bottom garment", BODY_COMPLETION_CATALOG.bottoms.map((item) => ({
    id: item.assetId,
    label: item.label,
  })));
  const bottomColor = blankSelect("Bottom color", BODY_COMPLETION_CATALOG.colors);
  const footwear = blankSelect("Footwear", BODY_COMPLETION_CATALOG.footwear.map((item) => ({
    id: item.assetId,
    label: item.label,
  })));
  const footwearColor = blankSelect("Footwear color", BODY_COMPLETION_CATALOG.colors);
  const petName = labeledInput("Pet name (optional)", 80);
  const personality = labeledInput("Personality (optional)", 280);
  const preview = element("canvas", {
    className: "tweet-composer-kit__pet-preview",
    width: 1024,
    height: 1024,
    hidden: true,
    ariaLabel: "Completed Maker avatar preview",
    role: "img",
  });
  const previewButton = element("button", {
    className: "tweet-composer-kit__pet-secondary",
    type: "button",
    textContent: "Preview completed avatar",
  });
  const exportButton = element("button", {
    className: "tweet-composer-kit__pet-primary",
    type: "submit",
    textContent: "Download remilia-pet-request.zip",
  });
  const status = element("p", {
    className: "tweet-composer-kit__pet-status",
    role: "status",
    ariaLive: "polite",
  });
  const instruction = element("textarea", {
    className: "tweet-composer-kit__pet-instruction",
    readOnly: true,
    rows: 2,
    value: PET_REQUEST_INSTRUCTION,
    hidden: true,
    ariaLabel: "Codex handoff instruction",
  });
  const copyInstruction = element("button", {
    className: "tweet-composer-kit__pet-secondary",
    type: "button",
    textContent: "Copy Codex instruction",
    hidden: true,
  });

  form.append(
    fieldset("Maker source", [
      family.root,
      nftNumber,
      nftNumberHelp,
      labeledControl("Transparent Maker PNG", avatar),
      avatarHelp,
    ]),
    fieldset("Exact Maker traits", [
      element("p", {
        className: "tweet-composer-kit__pet-help",
        textContent: 'Enter the Maker asset ID for every trait. Use the explicit ID "none" for a trait that is absent.',
      }),
      ...Object.entries(traitInputs).map(([trait, controls]) => element("div", {
        className: "tweet-composer-kit__pet-trait",
      },
      element("span", { className: "tweet-composer-kit__pet-trait-name", textContent: friendlyTrait(trait) }),
      controls.assetId,
      controls.label)),
    ]),
    fieldset("Avatar completion", [
      coverage.root,
      bottom.root,
      bottomColor.root,
      footwear.root,
      footwearColor.root,
      element("p", {
        className: "tweet-composer-kit__pet-help",
        textContent: "Leg color follows the selected Maker family's race trait. Only compatible bottoms can be selected; garments and footwear are never inferred.",
      }),
    ]),
    fieldset("Pet handoff", [
      petName,
      personality,
    ]),
    element("div", { className: "tweet-composer-kit__pet-actions" }, previewButton, exportButton),
    preview,
    status,
    instruction,
    copyInstruction,
  );
  section.append(summary, disclosure, form);

  const state = { avatarBytes: null, image: null, previewBytes: null };
  disclosure.addEventListener("click", () => {
    const open = form.hidden;
    form.hidden = !open;
    disclosure.setAttribute("aria-expanded", String(open));
    disclosure.textContent = open ? "Close Custom Pet export" : "Prepare Maker pet bundle";
    if (open) family.select.focus();
  }, { signal });
  avatar.addEventListener("change", async () => {
    state.avatarBytes = null;
    state.image?.close?.();
    state.image = null;
    state.previewBytes = null;
    preview.hidden = true;
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
      state.avatarBytes = null;
      state.image?.close?.();
      state.image = null;
      status.textContent = error instanceof Error ? error.message : "The Maker PNG could not be read.";
    }
  }, { signal });
  coverage.select.addEventListener("change", () => {
    updateBottomCompatibility(bottom.select, coverage.select.value, status);
    state.previewBytes = null;
  }, { signal });
  family.select.addEventListener("change", () => {
    const range = nftNumberRangeForFamily(family.select.value);
    nftNumber.hidden = !range;
    nftNumberHelp.hidden = !range;
    if (!range) {
      nftNumberInput.value = "";
      return;
    }
    nftNumberInput.min = String(range.min);
    nftNumberInput.max = String(range.max);
    nftNumberInput.placeholder = `${range.min}–${range.max}`;
    nftNumberHelp.textContent = `${FAMILY_LABELS[family.select.value]} NFT numbers run from ${range.min} to ${range.max}.`;
  }, { signal });
  for (const control of form.querySelectorAll("select, input, textarea")) {
    if (control === avatar || control === coverage.select || control === instruction) continue;
    control.addEventListener("change", () => { state.previewBytes = null; }, { signal });
  }
  previewButton.addEventListener("click", async () => {
    status.textContent = "";
    try {
      const selection = collectSelection({
        family,
        nftNumberInput,
        traitInputs,
        coverage,
        bottom,
        bottomColor,
        footwear,
        footwearColor,
        petName,
        personality,
        state,
      });
      state.previewBytes = await renderCompletedAvatar(state.image, selection, preview);
      preview.hidden = false;
      status.textContent = "Preview ready. Review the completed lower half before downloading.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "The completed avatar could not be previewed.";
    }
  }, { signal });
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    exportButton.disabled = true;
    previewButton.disabled = true;
    status.textContent = "Validating the local bundle…";
    try {
      const selection = collectSelection({
        family,
        nftNumberInput,
        traitInputs,
        coverage,
        bottom,
        bottomColor,
        footwear,
        footwearColor,
        petName,
        personality,
        state,
      });
      const avatarPng = await renderCompletedAvatar(state.image, selection, preview);
      state.previewBytes = avatarPng;
      preview.hidden = false;
      const imageSha256 = await sha256Hex(avatarPng);
      const request = makePetRequest({ ...selection, imageSha256 });
      const validation = await validatePetRequest(request, avatarPng);
      if (!validation.ok) throw new Error(validation.errors.join(" "));
      const requestBytes = new TextEncoder().encode(stableJson(request));
      const zipBytes = createStoredZip([
        { name: "avatar.png", bytes: avatarPng },
        { name: "request.json", bytes: requestBytes },
      ]);
      await validateFinishedArchive(zipBytes);
      downloadBytes(zipBytes, "remilia-pet-request.zip", "application/zip");
      instruction.hidden = false;
      copyInstruction.hidden = false;
      status.textContent = "Bundle validated and downloaded. Attach it to Codex with the instruction below.";
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : "The bundle could not be exported.";
    } finally {
      if (!signal.aborted) {
        exportButton.disabled = false;
        previewButton.disabled = false;
      }
    }
  }, { signal });
  copyInstruction.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(PET_REQUEST_INSTRUCTION);
      status.textContent = "Codex instruction copied.";
    } catch {
      instruction.hidden = false;
      instruction.focus();
      instruction.select();
      status.textContent = "Clipboard access is unavailable. The instruction is selected for manual copy.";
    }
  }, { signal });
  signal.addEventListener("abort", () => state.image?.close?.(), { once: true });
  return section;
}

function collectSelection(controls) {
  if (!controls.state.image || !controls.state.avatarBytes) throw new Error("Choose a transparent Maker PNG.");
  const templateFamily = requiredValue(controls.family.select, "Choose a Maker template family.");
  const sourceNftNumber = optionalNftNumber(controls.nftNumberInput, templateFamily);
  const traits = Object.fromEntries(Object.entries(controls.traitInputs).map(([trait, input]) => {
    const assetId = requiredValue(input.assetId, `Enter the ${friendlyTrait(trait)} asset ID, or "none".`);
    return [trait, { assetId, ...(input.label.value.trim() ? { label: input.label.value.trim() } : {}) }];
  }));
  const legCoverage = requiredValue(controls.coverage.select, "Choose leg coverage.");
  const legColorVariant = legColorForRace(templateFamily, traits.race);
  if (!legColorVariant) {
    controls.traitInputs.race.assetId.focus();
    throw new Error(`The ${FAMILY_LABELS[templateFamily]} race is not mapped to a leg color yet. Enter its exact race asset ID or label.`);
  }
  const bottomAssetId = requiredValue(controls.bottom.select, "Choose a compatible bottom garment.");
  const bottomItem = bottomForAssetId(bottomAssetId);
  if (!bottomItem || !bottomItem.compatibleLegCoverage.includes(legCoverage)) {
    throw new Error("The selected bottom garment is not compatible with the chosen leg coverage.");
  }
  const bottomColorVariant = requiredValue(controls.bottomColor.select, "Choose a bottom color.");
  const footwearAssetId = requiredValue(controls.footwear.select, "Choose footwear.");
  const footwearItem = footwearForAssetId(footwearAssetId);
  if (!footwearItem) throw new Error("Choose footwear from the maintained catalog.");
  const footwearColorVariant = requiredValue(controls.footwearColor.select, "Choose a footwear color.");
  return {
    templateFamily,
    ...(sourceNftNumber == null ? {} : { sourceNftNumber }),
    traits,
    bodyCompletion: {
      legCoverage,
      legColorVariant,
      bottom: {
        category: bottomItem.category,
        assetId: bottomItem.assetId,
        assetVersion: bottomItem.assetVersion,
        colorVariant: bottomColorVariant,
      },
      footwear: {
        category: footwearItem.category,
        assetId: footwearItem.assetId,
        assetVersion: footwearItem.assetVersion,
        colorVariant: footwearColorVariant,
      },
    },
    rightsScope: "private-review",
    petName: controls.petName.querySelector("input").value,
    personality: controls.personality.querySelector("input").value,
  };
}

function optionalNftNumber(control, templateFamily) {
  const raw = control.value.trim();
  if (!raw) return null;
  const value = Number(raw);
  const range = nftNumberRangeForFamily(templateFamily);
  if (!Number.isInteger(value) || !range || value < range.min || value > range.max) {
    control.focus();
    throw new Error(`Enter a whole ${FAMILY_LABELS[templateFamily]} NFT number from ${range?.min ?? "?"} to ${range?.max ?? "?"}.`);
  }
  return value;
}

async function renderCompletedAvatar(image, selection, canvas) {
  const context = canvas.getContext("2d", { alpha: true });
  if (!context) throw new Error("Canvas rendering is unavailable.");
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  drawLowerBody(context, selection);
  drawMakerUpperBody(context, image, selection.templateFamily);
  const blob = await canvasBlob(canvas);
  return new Uint8Array(await blob.arrayBuffer());
}

function drawMakerUpperBody(context, image, family) {
  const width = image.width || image.naturalWidth;
  const height = image.height || image.naturalHeight;
  const sourceHeight = Math.max(1, Math.floor(height * 0.76));
  const familyScale = family === "bonkler" ? 0.94 : family === "remilio" ? 0.88 : 1;
  const destinationWidth = Math.round(820 * familyScale);
  const destinationHeight = Math.round(700 * familyScale);
  const x = Math.round((1024 - destinationWidth) / 2);
  const y = family === "remilio" ? 54 : 16;
  context.drawImage(image, 0, 0, width, sourceHeight, x, y, destinationWidth, destinationHeight);
}

function drawLowerBody(context, selection) {
  const family = {
    milady: { center: 512, hipWidth: 230, legWidth: 80, spread: 62, top: 600 },
    remilio: { center: 512, hipWidth: 250, legWidth: 92, spread: 66, top: 616 },
    bonkler: { center: 512, hipWidth: 310, legWidth: 110, spread: 82, top: 590 },
    kagami: { center: 512, hipWidth: 220, legWidth: 76, spread: 58, top: 590 },
  }[selection.templateFamily];
  const legColor = BODY_COMPLETION_CATALOG.legColors.find((item) => item.id === selection.bodyCompletion.legColorVariant);
  const bottomColor = colorForId(selection.bodyCompletion.bottom.colorVariant);
  const shoeColor = colorForId(selection.bodyCompletion.footwear.colorVariant);
  if (!legColor || !bottomColor || !shoeColor) throw new Error("Choose supported leg, bottom, and footwear colors.");
  const leftX = family.center - family.spread - family.legWidth / 2;
  const rightX = family.center + family.spread - family.legWidth / 2;
  context.fillStyle = legColor.hex;
  roundedRect(context, leftX, family.top + 90, family.legWidth, 300, 36);
  roundedRect(context, rightX, family.top + 90, family.legWidth, 300, 36);
  drawBottom(context, family, selection.bodyCompletion.bottom.category, selection.bodyCompletion.legCoverage, bottomColor.hex, leftX, rightX);
  drawFootwear(context, selection.bodyCompletion.footwear.category, shoeColor.hex, leftX, rightX, family.legWidth);
}

function drawBottom(context, family, category, coverage, color, leftX, rightX) {
  context.fillStyle = color;
  const shortsBottom = coverage === "exposed" ? family.top + 188 : family.top + 236;
  if (coverage === "covered") {
    roundedRect(context, leftX - 12, family.top + 72, family.legWidth + 24, 302, 30);
    roundedRect(context, rightX - 12, family.top + 72, family.legWidth + 24, 302, 30);
  } else {
    roundedRect(context, family.center - family.hipWidth / 2, family.top + 52, family.hipWidth, shortsBottom - family.top - 52, 34);
  }
  if (category === "cargo-shorts") {
    context.fillStyle = shade(color, -24);
    roundedRect(context, family.center - family.hipWidth / 2 - 18, family.top + 105, 54, 58, 8);
    roundedRect(context, family.center + family.hipWidth / 2 - 36, family.top + 105, 54, 58, 8);
  } else if (category === "jeans") {
    context.strokeStyle = shade(color, 38);
    context.lineWidth = 7;
    context.beginPath();
    context.moveTo(family.center, family.top + 82);
    context.lineTo(family.center, family.top + 345);
    context.stroke();
  } else if (category === "dress-pants") {
    context.strokeStyle = shade(color, 24);
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(leftX + family.legWidth / 2, family.top + 115);
    context.lineTo(leftX + family.legWidth / 2, family.top + 360);
    context.moveTo(rightX + family.legWidth / 2, family.top + 115);
    context.lineTo(rightX + family.legWidth / 2, family.top + 360);
    context.stroke();
  } else if (category === "chinos") {
    context.fillStyle = shade(color, -18);
    context.fillRect(leftX - 12, family.top + 340, family.legWidth + 24, 22);
    context.fillRect(rightX - 12, family.top + 340, family.legWidth + 24, 22);
  }
}

function drawFootwear(context, category, color, leftX, rightX, legWidth) {
  const y = 918;
  context.fillStyle = color;
  if (category === "boots") {
    roundedRect(context, leftX - 22, y - 94, legWidth + 50, 116, 22);
    roundedRect(context, rightX - 22, y - 94, legWidth + 50, 116, 22);
  } else if (category === "sandals") {
    roundedRect(context, leftX - 26, y, legWidth + 58, 32, 16);
    roundedRect(context, rightX - 26, y, legWidth + 58, 32, 16);
    context.fillRect(leftX + 4, y - 40, 20, 48);
    context.fillRect(rightX + 4, y - 40, 20, 48);
  } else {
    const height = category === "loafers" ? 56 : 70;
    roundedRect(context, leftX - 30, y - height + 20, legWidth + 64, height, 25);
    roundedRect(context, rightX - 30, y - height + 20, legWidth + 64, height, 25);
    if (category === "sneakers") {
      context.fillStyle = shade(color, 42);
      context.fillRect(leftX - 24, y + 4, legWidth + 52, 12);
      context.fillRect(rightX - 24, y + 4, legWidth + 52, 12);
    }
  }
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

function updateBottomCompatibility(select, legCoverage, status) {
  const compatible = new Set(compatibleBottoms(legCoverage).map((item) => item.assetId));
  let invalidated = false;
  for (const option of select.options) {
    if (!option.value) continue;
    option.disabled = !compatible.has(option.value);
    option.textContent = `${bottomForAssetId(option.value)?.label ?? option.value}${option.disabled ? " — unavailable" : ""}`;
    if (option.selected && option.disabled) invalidated = true;
  }
  if (invalidated) {
    select.value = "";
    status.textContent = "That bottom garment conflicts with the new leg coverage. Choose one of the available options.";
  } else if (legCoverage) {
    status.textContent = "Compatible bottom garments are available.";
  }
}

function blankSelect(label, options) {
  const select = element("select", { className: "tweet-composer-kit__pet-select", required: true, ariaLabel: label });
  select.append(element("option", { value: "", textContent: `Choose ${label.toLowerCase()}`, selected: true }));
  for (const option of options) select.append(element("option", { value: option.id, textContent: option.label }));
  return { select, root: labeledControl(label, select) };
}

function labeledInput(label, maxLength) {
  return labeledControl(label, element("input", {
    className: "tweet-composer-kit__pet-input",
    type: "text",
    maxLength,
    autocomplete: "off",
  }));
}

function labeledControl(label, control) {
  return element("label", { className: "tweet-composer-kit__pet-field" },
    element("span", { className: "tweet-composer-kit__pet-label", textContent: label }),
    control,
  );
}

function fieldset(legend, children) {
  return element("fieldset", { className: "tweet-composer-kit__pet-fieldset" },
    element("legend", { textContent: legend }),
    ...children,
  );
}

function requiredValue(control, message) {
  const value = control.value.trim();
  if (!value) {
    control.focus();
    throw new Error(message);
  }
  return value;
}

function friendlyTrait(value) {
  return value.replace(/([A-Z])/gu, " $1").replace(/^./u, (letter) => letter.toUpperCase());
}

async function decodePng(file) {
  if (typeof createImageBitmap === "function") return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function requireTransparentImage(image) {
  const canvas = document.createElement("canvas");
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Canvas inspection is unavailable.");
  context.clearRect(0, 0, 96, 96);
  context.drawImage(image, 0, 0, 96, 96);
  const pixels = context.getImageData(0, 0, 96, 96).data;
  let transparent = 0;
  for (let index = 3; index < pixels.length; index += 4) if (pixels[index] < 250) transparent += 1;
  if (transparent / (pixels.length / 4) < 0.02) {
    throw new Error("This PNG appears opaque. Export a transparent Maker avatar so background material is not included.");
  }
}

function canvasBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("PNG encoding failed.")), "image/png");
  });
}

function downloadBytes(bytes, fileName, type) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.lineTo(x + width - r, y);
  context.quadraticCurveTo(x + width, y, x + width, y + r);
  context.lineTo(x + width, y + height - r);
  context.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  context.lineTo(x + r, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - r);
  context.lineTo(x, y + r);
  context.quadraticCurveTo(x, y, x + r, y);
  context.closePath();
  context.fill();
}

function shade(hex, amount) {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = clamp((value >> 16) + amount);
  const green = clamp(((value >> 8) & 0xff) + amount);
  const blue = clamp((value & 0xff) + amount);
  return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function clamp(value) {
  return Math.max(0, Math.min(255, value));
}

function element(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  Object.assign(node, props);
  node.append(...children);
  return node;
}
