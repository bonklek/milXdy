import { EXPORT_PREVIEW_PALETTES } from "./settings-previews";

const choiceUpdates = new WeakMap<Element, () => void>();

/** Refresh the visible alternative when saved settings or presets are loaded. */
export function refreshSettingsChoice(control: Element): void {
  choiceUpdates.get(control)?.();
}

function setupIconChoices(root: Element): void {
  for(const control of root.querySelectorAll<HTMLSelectElement>("#visualPfpShape, #visualTweetPngBorderPalette")) {
    if(choiceUpdates.has(control)) continue;
    const palette = control.id === "visualTweetPngBorderPalette";
    const group = document.createElement("span");
    group.className = palette ? "color-swatches" : "shape-choices";
    group.setAttribute("role", "radiogroup");
    group.setAttribute("aria-label", palette ? "Border color" : "Profile-picture shape");
    const names = [...control.options].map(option => option.textContent ?? option.value);
    const buttons = [...control.options].map((option, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-label", names[index]);
      button.title = names[index];
      button.dataset.optionValue = option.value;
      if(palette) {
        button.dataset.color = option.value;
        button.style.backgroundColor = EXPORT_PREVIEW_PALETTES[option.value]?.[0] ?? EXPORT_PREVIEW_PALETTES.purple[0];
      } else {
        const icon = choiceIcon(names[index]);
        if(icon) button.append(icon);
      }
      group.append(button);
      button.addEventListener("click", event => { event.preventDefault(); choose(index); });
      button.addEventListener("keydown", event => {
        let target: number;
        if(event.key === "ArrowRight" || event.key === "ArrowDown") target = (index + 1) % buttons.length;
        else if(event.key === "ArrowLeft" || event.key === "ArrowUp") target = (index + buttons.length - 1) % buttons.length;
        else if(event.key === "Home") target = 0;
        else if(event.key === "End") target = buttons.length - 1;
        else return;
        event.preventDefault();
        choose(target);
        buttons[target].focus();
      });
      return button;
    });
    const refresh = () => buttons.forEach((button, index) => {
      const selected = control.selectedIndex === index;
      button.setAttribute("aria-checked", String(selected));
      button.tabIndex = selected || ((control.selectedIndex < 0 || control.selectedIndex >= buttons.length) && index === 0) ? 0 : -1;
      button.disabled = control.disabled;
      button.setAttribute("aria-describedby", control.getAttribute("aria-describedby") ?? "");
    });
    const choose = (index: number) => {
      if(control.disabled) return;
      control.selectedIndex = index;
      refresh();
      control.dispatchEvent(new Event("input", { bubbles: true }));
      control.dispatchEvent(new Event("change", { bubbles: true }));
    };
    control.classList.add("binary-choice-source");
    control.tabIndex = -1;
    control.setAttribute("aria-hidden", "true");
    control.after(group);
    control.addEventListener("change", refresh);
    new MutationObserver(refresh).observe(control, { attributes: true, attributeFilter: ["disabled", "aria-describedby"] });
    choiceUpdates.set(control, refresh);
    refresh();
    control.closest("label")?.addEventListener("click", event => {
      if(event.target === control || group.contains(event.target as Node)) return;
      event.preventDefault();
      buttons[control.selectedIndex]?.focus();
    });
  }
}

function setupBinaryChoices(root: Element): void {
  for(const control of root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("input[data-choice-left], select[data-binary-choice]")) {
    if(choiceUpdates.has(control)) continue;
    const label = control.closest<HTMLLabelElement>("label");
    if(!label) continue;
    label.classList.add("binary-choice");
    const select = control instanceof HTMLSelectElement ? control : null;
    const choices = select ? [...select.options].map(option => option.textContent ?? "") : [control.dataset.choiceLeft!, control.dataset.choiceRight!];
    if(choices.length !== 2) continue;
    const wrapper = document.createElement("span");
    wrapper.className = "binary-slider";
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "1";
    range.step = "1";
    range.setAttribute("aria-label", label.querySelector("span")?.firstChild?.textContent?.trim() ?? "Setting");
    const refresh = () => {
      const position = select ? select.selectedIndex : Number((control as HTMLInputElement).checked);
      range.value = String(Math.max(0, position));
      range.disabled = control.disabled;
      range.setAttribute("aria-valuetext", choices[position] ?? choices[0]);
      wrapper.dataset.position = range.value;
      range.setAttribute("aria-describedby", control.getAttribute("aria-describedby") ?? "");
    };
    appendBinaryChoiceVisuals(wrapper, choices, range);
    control.classList.add("binary-choice-source");
    control.tabIndex = -1;
    control.setAttribute("aria-hidden", "true");
    control.after(wrapper);
    for(const name of ["input", "change"]) range.addEventListener(name, () => {
      if(control.disabled) return;
      if(select) select.selectedIndex = Number(range.value);
      else(control as HTMLInputElement).checked = range.value === "1";
      refresh();
      control.dispatchEvent(new Event(name, { bubbles: true }));
    });
    const toggleChoice = () => {
      if(range.disabled) return;
      range.value = range.value === "1" ? "0" : "1";
      range.dispatchEvent(new Event("input", { bubbles: true }));
      range.dispatchEvent(new Event("change", { bubbles: true }));
      range.focus();
    };
    range.addEventListener("pointerdown", event => {
      if(event.button !== 0) return;
      event.preventDefault();
      toggleChoice();
    });
    range.addEventListener("keydown", event => {
      if(event.key !== " ") return;
      event.preventDefault();
      toggleChoice();
    });
    control.addEventListener("change", refresh);
    new MutationObserver(refresh).observe(control, { attributes: true, attributeFilter: ["disabled", "aria-describedby"] });
    choiceUpdates.set(control, refresh);
    refresh();
    // A wrapping label must focus the slider without toggling the hidden checkbox.
    label.addEventListener("click", event => {
      if(event.target === control || wrapper.contains(event.target as Node)) return;
      event.preventDefault();
      range.focus();
    });
  }
}

/** Keep native checkbox semantics while presenting dense, full-tile targets. */
function setupMediaHeightPresets(): void {
  const input = document.getElementById("visualMaxMediaHeight") as HTMLInputElement | null;
  const presets = document.getElementById("visualMediaHeightPreset") as HTMLSelectElement | null;
  if(!input || !presets) return;
  const update = () => {
    const value = String(Number(input.value));
    presets.value = [...presets.options].some(option => option.value === value) ? value : "custom";
    input.hidden = presets.value !== "custom";
  };
  choiceUpdates.set(input, update);
  input.addEventListener("input", () => { if(presets.value !== "custom") update(); });
  input.addEventListener("change", () => { if(presets.value !== "custom") update(); });
  presets.addEventListener("change", () => {
    if(presets.value === "custom") { input.hidden = false; input.focus(); input.select(); return; }
    input.value = presets.value;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  });
  update();
}

export function setupSettingsTiles(): void {
  const root = document.querySelector(".app");
  if(!root) return;
  setupMediaHeightPresets();
  setupIconChoices(root);
  setupBinaryChoices(root);
  const arrange = () => {
    for(const label of root.querySelectorAll<HTMLLabelElement>(".panel label.setting")) {
      if(!label.querySelector('input[type="checkbox"]')) continue;
      label.classList.add("setting-tile");
      const parent = label.parentElement;
      if(!parent || parent.classList.contains("setting-tile-grid")) continue;
      const grid = document.createElement("div");
      grid.className = "setting-tile-grid";
      parent.insertBefore(grid, label);
      for(const choice of [...parent.children]) {
        if(!choice.matches("label.setting:has(input[type=checkbox])")) continue;
        choice.classList.add("setting-tile");
        grid.append(choice);
      }
    }
  };
  arrange();
  let queued = false;
  new MutationObserver(records => {
    if(!records.some(record => [...record.addedNodes].some(node => node instanceof Element && (node.matches("label.setting") || node.querySelector("label.setting"))))) return;
    if(queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; arrange(); });
  }).observe(root, { subtree: true, childList: true });
}

/** Decorative option symbols; the text remains the accessible name. */
function choiceIcon(choice: string): SVGSVGElement | null {
  const symbols: Record<string, string> = {
    "Rounded square": '<rect x="2" y="2" width="12" height="12" rx="4"/>',
    Circle: '<circle cx="8" cy="8" r="6"/>',
    Rounded: '<rect x="2" y="2" width="12" height="12" rx="4"/>',
    Square: '<rect x="2" y="2" width="12" height="12"/>',
    Compact: '<rect x="2" y="3" width="12" height="4" rx="1"/><rect x="2" y="9" width="12" height="4" rx="1"/>',
    Spaced: '<rect x="2" y="1" width="12" height="4" rx="1"/><rect x="2" y="11" width="12" height="4" rx="1"/>',
    Flat: '<rect x="2" y="4" width="12" height="8" rx="1"/>',
    Raised: '<rect x="2" y="2" width="10" height="9" rx="1"/><path d="M5 14h9V5"/>',
    Link: '<path d="m6 10 4-4M6 6l2-2a3 3 0 0 1 4 4l-2 2M10 10l-2 2a3 3 0 0 1-4-4l2-2"/>',
    Date: '<rect x="2" y="3" width="12" height="11" rx="1"/><path d="M2 7h12M5 1v4M11 1v4M5 10h2"/>',
    Names: '<circle cx="8" cy="5" r="3"/><path d="M2 14a6 6 0 0 1 12 0"/>',
    "@handles": '<text x="1" y="12" fill="currentColor" stroke="none" font-family="sans-serif" font-size="14">@</text>',
    Below: '<path d="M2 2h12M8 5v9m-4-4 4 4 4-4"/>',
    Above: '<path d="M2 14h12M8 11V2m-4 4 4-4 4 4"/>',
    Quick: '<path d="m9 1-6 8h5l-1 6 6-8H8z"/>',
    Guided: '<circle cx="3" cy="3" r="1"/><circle cx="13" cy="13" r="1"/><path d="M5 3h5a3 3 0 0 1 0 6H6a2 2 0 0 0 0 4h5"/>',
    Browser: '<rect x="1" y="2" width="14" height="12" rx="1"/><path d="M1 6h14M4 4h1"/>',
    "Custom service": '<rect x="2" y="2" width="12" height="5" rx="1"/><rect x="2" y="9" width="12" height="5" rx="1"/><path d="M4 4.5h1M4 11.5h1"/>',
    Visible: '<path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z"/><circle cx="8" cy="8" r="2"/>',
    "Scroll feed": '<path d="M1 3h7M1 8h7M1 13h7M12 2v12m-3-3 3 3 3-3"/>',
  };
  if(!symbols[choice]) return null;
  const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  icon.classList.add("binary-option-icon");
  icon.setAttribute("viewBox", "0 0 16 16");
  icon.setAttribute("aria-hidden", "true");
  icon.setAttribute("focusable", "false");
  icon.setAttribute("fill", "none");
  icon.setAttribute("stroke", "currentColor");
  icon.setAttribute("stroke-width", "1.3");
  icon.setAttribute("stroke-linecap", "round");
  icon.setAttribute("stroke-linejoin", "round");
  icon.innerHTML = symbols[choice];
  return icon;
}

function appendBinaryChoiceVisuals(wrapper: HTMLElement, choices: string[], range: HTMLInputElement): void {
  const labelWindow = document.createElement("span");
  labelWindow.className = "binary-label-window";
  labelWindow.setAttribute("aria-hidden", "true");
  const labelRoll = document.createElement("span");
  labelRoll.className = "binary-label-roll";
  for(const choice of choices) {
    const caption = document.createElement("span");
    caption.textContent = choice;
    labelRoll.append(caption);
  }
  labelWindow.append(labelRoll);
  wrapper.append(labelWindow);
  const pill = document.createElement("span");
  pill.className = "binary-pill";
  const icons = document.createElement("span");
  icons.className = "binary-pill-icons";
  icons.setAttribute("aria-hidden", "true");
  // The knob covers one end; the exposed icon must represent the selection.
  for(const choice of [...choices].reverse()) {
    const icon = choiceIcon(choice);
    if(icon) {
      icon.dataset.choice = choice;
      icons.append(icon);
    }
  }
  const knob = document.createElement("span");
  knob.className = "binary-pill-knob";
  knob.setAttribute("aria-hidden", "true");
  pill.append(range, icons, knob);
  wrapper.append(pill);
}
