import { appendSettingsPreview, EXPORT_PREVIEW_PALETTES } from "./settings-previews";
import { refreshSettingsChoice } from "./settings-tiles";

const PRESETS_KEY = "milxdy.settings.colorPresets";
type ColorPreset = { id: string; name: string; color: string };
type ColorControl = HTMLInputElement | HTMLSelectElement;
const updates = new WeakMap<Element, () => void>();
const valid = (color: string) => /^#[0-9a-f]{6}$/i.test(color);

export function refreshColorControl(control: Element): void { updates.get(control)?.(); }

export function setupColorControls(): void { new ColorControls(); }

function createColorDialog(): HTMLDialogElement {
  const dialog = document.createElement("dialog");
  dialog.className = "color-module";
  dialog.id = "colorModule";
  dialog.setAttribute("aria-labelledby", "colorModuleTitle");
  dialog.innerHTML = '<div class="color-module-header"><strong id="colorModuleTitle">Color</strong><button type="button" class="icon-button" aria-label="Close color picker">×</button></div><div class="color-module-inputs"><input id="colorModulePicker" type="color" aria-label="Choose color"><input id="colorModuleHex" type="text" aria-label="Hex color" maxlength="7" spellcheck="false"></div><div id="colorModulePreview"></div><div class="color-module-save"><input id="colorModuleName" type="text" placeholder="Preset name" aria-label="Preset name" maxlength="40"><button id="colorModuleSave" type="button">Save</button></div><div id="colorModulePresets" class="color-module-presets" aria-label="Saved colors"></div><div class="color-module-actions"><button id="colorModuleDefault" type="button">Default</button><button id="colorModuleDelete" type="button" disabled>Delete preset</button><button id="colorModuleUse" type="button">Use color</button></div><span id="colorModuleStatus" role="status"></span>';
  document.body.append(dialog);
  return dialog;
}

class ColorControls {
  private dialog = createColorDialog();
  private get<T extends HTMLElement>(id: string): T { return this.dialog.querySelector<T>(`#${id}`)!; }
  private picker = this.get<HTMLInputElement>("colorModulePicker");
  private hex = this.get<HTMLInputElement>("colorModuleHex");
  private name = this.get<HTMLInputElement>("colorModuleName");
  private sample = this.get("colorModulePreview");
  private presetsContainer = this.get("colorModulePresets");
  private status = this.get("colorModuleStatus");
  private remove = this.get<HTMLButtonElement>("colorModuleDelete");
  private control: ColorControl | null = null;
  private trigger: HTMLButtonElement | null = null;
  private draft = "#b67cff";
  private presetId: string | null = null;
  private presets: ColorPreset[] = [];
  private saving = false;
  constructor() {
    window.addEventListener("resize", () => this.position());
    this.picker.addEventListener("input", () => { this.presetId = null; this.remove.disabled = true; this.setDraft(this.picker.value); });
    this.hex.addEventListener("input", () => {
      const color = this.hex.value.startsWith("#") ? this.hex.value : `#${this.hex.value}`;
      this.hex.setAttribute("aria-invalid", String(!valid(color)));
      if(valid(color)) { this.presetId = null; this.remove.disabled = true; this.setDraft(color); }
    });
    this.get("colorModuleUse").addEventListener("click", () => { if(this.hex.getAttribute("aria-invalid") === "true") { this.hex.focus(); return; } this.commit(this.draft); });
    this.get("colorModuleDefault").addEventListener("click", () => this.commit(this.control?.dataset.colorAutomatic ? "" : this.control?.dataset.colorDefault ?? "purple"));
    this.installPresetActions();
    this.dialog.querySelector(".color-module-header button")!.addEventListener("click", () => this.dialog.close());
    this.dialog.addEventListener("close", () => { this.trigger?.focus(); });
    this.dialog.addEventListener("click", event => { if(event.target !== this.dialog) return; const r = this.dialog.getBoundingClientRect(); if(event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) this.dialog.close(); });

    for(const element of document.querySelectorAll<ColorControl>("[data-custom-color]")) this.installTrigger(element);
  }
  private position() {
    if(!this.dialog.open || !this.trigger) return;
    this.dialog.style.width = `${Math.min(330, innerWidth - 24)}px`;
    this.dialog.style.maxHeight = `${innerHeight - 24}px`;
    const rect = this.trigger.getBoundingClientRect(), box = this.dialog.getBoundingClientRect();
    this.dialog.style.left = `${Math.max(12, Math.min(rect.left, innerWidth - box.width - 12))}px`;
    this.dialog.style.top = `${Math.max(12, Math.min(rect.bottom + 5, innerHeight - box.height - 12))}px`;
  }

  private renderPreview(color = this.draft) {
    if(!this.control) return;
    this.sample.replaceChildren();
    const target = this.control.closest<HTMLElement>(".field")!;
    appendSettingsPreview(target, this.sample, { optionValue: color, colorControl: this.control.id });
    this.position();
  }

  private setDraft(color: string) {
    this.draft = color.toLowerCase(); this.picker.value = this.draft; this.hex.value = this.draft;
    this.hex.setAttribute("aria-invalid", "false"); this.status.textContent = "";
    this.renderPreview();
  }

  private renderPresets() {
    this.presetsContainer.replaceChildren();
    for(const preset of this.presets) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "color-preset";
      button.textContent = preset.name;
      button.title = `${preset.name} · ${preset.color}`;
      button.style.setProperty("--preset-color", preset.color);
      button.setAttribute("aria-pressed", String(preset.id === this.presetId));
      button.addEventListener("pointerenter", () => this.renderPreview(preset.color));
      button.addEventListener("pointerleave", () => this.renderPreview());
      button.addEventListener("focus", () => this.renderPreview(preset.color));
      button.addEventListener("blur", () => this.renderPreview());
      button.addEventListener("click", () => { this.presetId = preset.id; this.name.value = preset.name; this.setDraft(preset.color); this.renderPresets(); });
      this.presetsContainer.append(button);
    }
    this.remove.disabled = !this.presetId;
    this.position();
  }

  private async readPresets() {
    const stored = (await chrome.storage.local.get(PRESETS_KEY))[PRESETS_KEY];
    this.presets = Array.isArray(stored) ? stored.filter((item): item is ColorPreset => typeof item?.id === "string" && typeof item?.name === "string" && item.name.length <= 40 && valid(item?.color ?? "")).slice(0, 64) : [];
    this.renderPresets();
  }

  private commit(color: string) {
    if(!this.control) return;
    if(this.control instanceof HTMLSelectElement && ![...this.control.options].some(option => option.value === color)) this.control.add(new Option("Custom", color));
    this.control.value = color;
    refreshSettingsChoice(this.control); refreshColorControl(this.control);
    this.control.dispatchEvent(new Event("input", { bubbles: true }));
    this.control.dispatchEvent(new Event("change", { bubbles: true }));
    this.dialog.close();
  }

  private installPresetActions(): void {
    this.get("colorModuleSave").addEventListener("click", async () => {
      if(this.saving) return;
      const label = this.name.value.trim();
      if(!label) { this.name.focus(); this.status.textContent = "Name required"; return; }
      if(this.hex.getAttribute("aria-invalid") === "true") { this.hex.focus(); return; }
      this.saving = true;
      try {
        await this.readPresets();
        const existing = this.presets.find(item => item.name.toLowerCase() === label.toLowerCase());
        if(!existing && this.presets.length >= 64) { this.status.textContent = "Preset library full"; return; }
        const preset = { id: existing?.id ?? crypto.randomUUID(), name: label, color: this.draft };
        this.presets = [...this.presets.filter(item => item.id !== preset.id), preset];
        await chrome.storage.local.set({ [PRESETS_KEY]: this.presets });
        this.presetId = preset.id; this.renderPresets(); this.status.textContent = "Saved";
      } catch { this.status.textContent = "Couldn’t save"; } finally { this.saving = false; }
    });
    this.remove.addEventListener("click", async () => {
      if(!this.presetId || this.saving) return;
      this.saving = true;
      try {
        const id = this.presetId; await this.readPresets(); this.presets = this.presets.filter(item => item.id !== id);
        await chrome.storage.local.set({ [PRESETS_KEY]: this.presets });
        this.presetId = null; this.name.value = ""; this.renderPresets(); this.status.textContent = "Deleted";
      } catch { this.status.textContent = "Couldn’t delete"; } finally { this.saving = false; }
    });
  }
  private installTrigger(element: ColorControl): void {

    element.classList.add("custom-color-source"); element.tabIndex = -1;
    element.setAttribute("aria-hidden", "true");
    const button = document.createElement("button");
    button.type = "button"; button.className = "custom-color-trigger";
    button.dataset.previewControl = element.id;
    button.setAttribute("aria-haspopup", "dialog"); button.setAttribute("aria-controls", this.dialog.id);
    button.setAttribute("aria-label", `${element.dataset.customColor} color picker`);
    const update = () => {
      const color = valid(element.value) ? element.value : EXPORT_PREVIEW_PALETTES[element.value]?.[0] ?? element.dataset.colorDefault ?? "#b67cff";
      button.style.setProperty("--picked-color", color);
      button.textContent = element instanceof HTMLSelectElement ? "+" : "";
      button.setAttribute("aria-description", `${element.dataset.customColor} · ${valid(element.value) ? element.value : element.value || "Default"}`);
      button.setAttribute("aria-pressed", String(valid(element.value)));
      button.dataset.optionValue = color;
      button.disabled = element.disabled;
    };
    updates.set(element, update); element.addEventListener("change", update);
    new MutationObserver(update).observe(element, { attributes: true, attributeFilter: ["disabled"] });
    (element.nextElementSibling?.classList.contains("color-swatches") ? element.nextElementSibling : element)!.after(button);
    update();
    button.addEventListener("click", async event => {
      event.preventDefault(); this.control = element; this.trigger = button; this.get("colorModuleTitle").textContent = element.dataset.customColor ?? "Color"; this.presetId = null; this.name.value = ""; this.status.textContent = "";
      this.setDraft(valid(element.value) ? element.value : EXPORT_PREVIEW_PALETTES[element.value]?.[0] ?? element.dataset.colorDefault ?? "#b67cff");
      this.dialog.showModal();
      this.position();
      this.picker.focus();
      try { await this.readPresets(); } catch { this.status.textContent = "Couldn’t load presets"; }
    });
  }
}
