import {
  BODY_COMPLETION_CATALOG,
  PET_REQUEST_FAMILIES,
  PET_REQUEST_INSTRUCTION,
  PET_REQUEST_TRAITS,
  bottomForAssetId,
  compatibleBottoms,
} from "./custom-pet-contract.js";
import { attachPetExportEvents } from "./custom-pet-export-events.js";
import {
  blankSelect,
  element,
  fieldset,
  friendlyTrait,
  labeledControl,
  labeledInput,
} from "./custom-pet-ui-primitives.js";

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
  const form = element("form", {
    className: "tweet-composer-kit__pet-form",
    noValidate: true,
  });
  const controls = createPetControls();
  appendPetForm(form, controls);
  section.append(createHeading(), form);
  attachPetExportEvents({
    ...controls,
    signal,
    familyLabels: FAMILY_LABELS,
    form,
    updateBottomCompatibility,
  });
  return section;
}

function createHeading() {
  return element("div", { className: "tweet-composer-kit__pet-heading" },
    element("strong", { textContent: "Custom Pet export" }),
    element("span", {
      className: "tweet-composer-kit__pet-local-note",
      textContent: "Local download only. Nothing is uploaded.",
    }),
  );
}

function createPetControls() {
  const family = blankSelect("Maker template family", PET_REQUEST_FAMILIES.map((id) => ({
    id,
    label: FAMILY_LABELS[id],
  })));
  family.select.name = "templateFamily";
  const nft = createNftControls();
  const avatar = createAvatarControl();
  return {
    family,
    ...nft,
    ...avatar,
    traitInputs: createTraitInputs(),
    coverage: blankSelect("Leg coverage", BODY_COMPLETION_CATALOG.legCoverage),
    bottom: blankSelect("Bottom garment", BODY_COMPLETION_CATALOG.bottoms.map(asAssetOption)),
    bottomColor: blankSelect("Bottom color", BODY_COMPLETION_CATALOG.colors),
    footwear: blankSelect("Footwear", BODY_COMPLETION_CATALOG.footwear.map(asAssetOption)),
    footwearColor: blankSelect("Footwear color", BODY_COMPLETION_CATALOG.colors),
    petName: labeledInput("Pet name (optional)", 80),
    personality: labeledInput("Personality (optional)", 280),
    ...createOutputControls(),
  };
}

function asAssetOption(item) {
  return { id: item.assetId, label: item.label };
}

function createNftControls() {
  const nftNumberInput = element("input", {
    className: "tweet-composer-kit__pet-input",
    type: "number",
    step: "1",
    inputMode: "numeric",
    autocomplete: "off",
    ariaDescribedBy: "tweet-composer-kit-pet-nft-number-help",
  });
  const fetchTraitsButton = element("button", {
    className: "tweet-composer-kit__pet-secondary tweet-composer-kit__pet-fetch",
    type: "button",
    textContent: "Fetch",
    disabled: true,
  });
  const nftNumber = labeledControl("NFT number (optional)", element(
    "div",
    { className: "tweet-composer-kit__pet-nft-row" },
    nftNumberInput,
    fetchTraitsButton,
  ));
  nftNumber.hidden = true;
  const nftNumberHelp = element("p", {
    id: "tweet-composer-kit-pet-nft-number-help",
    className: "tweet-composer-kit__pet-help",
    hidden: true,
  });
  return { nftNumber, nftNumberInput, nftNumberHelp, fetchTraitsButton };
}

function createAvatarControl() {
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
  return { avatar, avatarHelp };
}

function createTraitInputs() {
  return Object.fromEntries(PET_REQUEST_TRAITS.map((trait) => [trait, {
    assetId: element("input", {
      className: "tweet-composer-kit__pet-input",
      type: "text",
      maxLength: 80,
      required: true,
      autocomplete: "off",
      placeholder: `${trait} asset ID or none`,
      ariaLabel: `${friendlyTrait(trait)} stable asset ID`,
    }),
    label: element("input", {
      className: "tweet-composer-kit__pet-input",
      type: "text",
      maxLength: 120,
      autocomplete: "off",
      placeholder: "Readable label (optional)",
      ariaLabel: `${friendlyTrait(trait)} readable label`,
    }),
  }]));
}

function createOutputControls() {
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
  return { preview, previewButton, exportButton, status, instruction, copyInstruction };
}

function appendPetForm(form, controls) {
  form.append(
    makerSourceSection(controls),
    traitSection(controls.traitInputs),
    completionSection(controls),
    fieldset("Pet handoff", [controls.petName, controls.personality]),
    element("div", { className: "tweet-composer-kit__pet-actions" }, controls.previewButton, controls.exportButton),
    controls.preview,
    controls.status,
    controls.instruction,
    controls.copyInstruction,
  );
}

function makerSourceSection({ avatar, avatarHelp, family, nftNumber, nftNumberHelp }) {
  return fieldset("Maker source", [
    family.root,
    nftNumber,
    nftNumberHelp,
    labeledControl("Transparent Maker PNG", avatar),
    avatarHelp,
  ]);
}

function traitSection(traitInputs) {
  return fieldset("Exact Maker traits", [
    element("p", {
      className: "tweet-composer-kit__pet-help",
      textContent: 'Enter the Maker asset ID for every trait. Use the explicit ID "none" for a trait that is absent.',
    }),
    ...Object.entries(traitInputs).map(([trait, controls]) => element(
      "div",
      { className: "tweet-composer-kit__pet-trait" },
      element("span", { className: "tweet-composer-kit__pet-trait-name", textContent: friendlyTrait(trait) }),
      controls.assetId,
      controls.label,
    )),
  ]);
}

function completionSection({ bottom, bottomColor, coverage, footwear, footwearColor }) {
  return fieldset("Avatar completion", [
    coverage.root,
    bottom.root,
    bottomColor.root,
    footwear.root,
    footwearColor.root,
    element("p", {
      className: "tweet-composer-kit__pet-help",
      textContent: "Leg color follows the selected Maker family's race trait. Only compatible bottoms can be selected; garments and footwear are never inferred.",
    }),
  ]);
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
