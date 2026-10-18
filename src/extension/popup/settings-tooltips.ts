import { settingStateHelp } from "./settings-state-help";
import { appendSettingsPreview, setupSettingsPreviews } from "./settings-previews";

/** Keep guidance out of the settings layout without losing keyboard access. */
export function setupSettingsTooltips(): void { setupStatusValueExpansion(); setupSettingsPreviews(); new SettingsTooltips(); }

function createSettingsTooltip(): HTMLElement {
  const tooltip = document.createElement("div");
  tooltip.id = "settingsTooltip";
  tooltip.className = "settings-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  document.body.append(tooltip);
  return tooltip;
}

class SettingsTooltips {
  private tooltip = createSettingsTooltip();
  private targets = new Map<HTMLElement, Set<HTMLElement>>();
  private messages = new WeakMap<HTMLElement, { full: string; compact: string }>();
  private active: HTMLElement | null = null;
  private dismissed: HTMLElement | null = null;
  private serial = 0;
  private previewOption: HTMLElement | null = null;
  constructor() {
    document.addEventListener("settings-preview-profile", () => { if(this.active) this.show(this.active); });
    this.refresh();
    let queued = false;
    new MutationObserver(records => {
      if(records.every(record => this.tooltip.contains(record.target) || record.target === this.tooltip)) return;
      if(queued) return;
      queued = true;
      queueMicrotask(() => { queued = false; this.refresh(); });
    }).observe(document.querySelector(".app") ?? document.body, { subtree: true, childList: true, characterData: true });

    const targetFor = (node: EventTarget | null) => node instanceof Element ? node.closest<HTMLElement>(".has-settings-help") : null;
    document.addEventListener("pointerover", event => {
      const target = targetFor(event.target);
      const option = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-option-value]") : null;
      if(target) { this.dismissed = null; this.show(target, option); }
    });
    document.addEventListener("pointerout", event => {
      if(!this.active?.contains(event.target as Node)) return;
      if(this.active.contains(event.relatedTarget as Node)) return;
      this.show(null);
    });
    document.addEventListener("focusin", event => { this.dismissed = null; this.show(targetFor(event.target), event.target instanceof HTMLElement ? event.target.closest<HTMLElement>("[data-option-value]") : null); });
    for(const event of ["input", "change"]) document.addEventListener(event, () => { if(this.active && !this.tooltip.hidden) this.show(this.active); });
    document.addEventListener("focusout", event => {
      if(!this.active?.contains(event.relatedTarget as Node)) this.show(null);
    });
    document.addEventListener("keydown", event => {
      if(event.key === "Escape" && this.active && !this.tooltip.hidden) {
        this.dismissed = this.active;
        this.tooltip.hidden = true;
        event.stopImmediatePropagation();
      }
    }, true);
    window.addEventListener("resize", () => { if(this.active && !this.tooltip.hidden) this.show(this.active); });
    window.addEventListener("scroll", () => {
      if(this.active?.contains(document.activeElement)) this.show(this.active);
      else this.show(null);
    }, true);
  }
  private describe = (target: HTMLElement, source: HTMLElement, hide = true) => {
    if(!source.id) source.id = `settingsHelp${++this.serial}`;
    if(hide) source.classList.add("settings-help-source");
    const sources = this.targets.get(target) ?? new Set<HTMLElement>();
    sources.add(source);
    this.targets.set(target, sources);
    target.classList.add("has-settings-help");
    if(!target.matches("label, button, a, input, select, textarea") && !target.querySelector("input, select, button, a, textarea")) {
      target.tabIndex = 0;
    }
    const controls = target.matches("input, select, button, a, textarea") ? [target] : Array.from(target.querySelectorAll<HTMLElement>("input, select, button, a, textarea"));
    if(!controls.length) controls.push(target);
    if(controls.every(control => control.matches(":disabled"))) target.tabIndex = 0;
    for(const control of controls) {
      if(control === source) {
        control.setAttribute("aria-describedby", this.tooltip.id);
        continue;
      }
      const ids = new Set((control.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean));
      ids.add(source.id);
      control.setAttribute("aria-describedby", [...ids].join(" "));
    }
  };


  private fullText = (source: HTMLElement) => {
    const guidance = this.messages.get(source)?.full ?? source.textContent?.trim() ?? "";
    const setting = source.closest(".setting, .field");
    const choice = setting?.querySelector<HTMLSelectElement>("select");
    if(choice && setting?.querySelector("small") === source) {
      const selectedHelp = choice.selectedOptions[0]?.dataset.settingsHelp;
      if(selectedHelp) return selectedHelp;
    }
    const control = setting?.querySelector<HTMLInputElement>('input[type="checkbox"]');
    // Availability/status explanations remain separate from the setting's own description.
    if(!control || setting?.querySelector("small") !== source) return guidance;
    const stateText = settingStateHelp(control.dataset.control ?? control.id, control.checked, guidance);
    const blockedBy = setting?.closest<HTMLElement>(".sound-volume-row")?.dataset.soundBlockedBy;
    return blockedBy ? `${stateText} Muted by ${blockedBy}.` : stateText;
  };


  private show = (target: HTMLElement | null, option: HTMLElement | null = this.previewOption) => {
    this.active = target;
    this.previewOption = target ? option : null;
    if(!target || this.dismissed === target) { this.tooltip.hidden = true; return; }
    const locked = target.classList.contains("remilia-setting-locked");
    const text = locked ? "Log into RemiliaNET" : [...(this.targets.get(target) ?? [])].filter(source => source.isConnected && !source.hidden).map(this.fullText).filter(Boolean).join("\n");
    if(!text) { this.tooltip.hidden = true; return; }
    this.tooltip.textContent = text;
    const previewControl = target.dataset.previewControl;
    const previewTarget = previewControl ? document.getElementById(previewControl)?.closest<HTMLElement>(".field, .setting") ?? target : target;
    if(!locked) appendSettingsPreview(previewTarget, this.tooltip, { optionValue: this.previewOption?.dataset.optionValue, colorControl: previewControl ?? target.querySelector<HTMLElement>("[data-custom-color]")?.id });
    this.tooltip.hidden = false;
    const rect = target.getBoundingClientRect();
    const width = Math.min(340, window.innerWidth - 24);
    this.tooltip.style.width = `${width}px`;
    this.tooltip.style.left = `${Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))}px`;
    // Fit guidance entirely on one side of the setting, never across it.
    this.tooltip.style.maxHeight = "none";
    this.tooltip.style.overflowY = "hidden";
    this.tooltip.style.boxSizing = "border-box";
    const height = this.tooltip.getBoundingClientRect().height;
    const below = Math.max(0, window.innerHeight - 8 - rect.bottom - 5);
    const above = Math.max(0, rect.top - 5 - 8);
    const placeBelow = height <= below || (height > above && below >= above);
    const available = placeBelow ? below : above;
    if(available < 24) { this.tooltip.hidden = true; return; }
    if(height > available) {
      const previews = [...this.tooltip.querySelectorAll<HTMLElement>(".avatar-location-preview, .export-color-preview, .appearance-example")];
      const previewHeight = previews.reduce((sum, preview) => sum + preview.getBoundingClientRect().height, 0);
      const guidanceHeight = height - previewHeight;
      const scale = Math.min(1, (available - guidanceHeight - 4) / previewHeight);
      if(!previewHeight || scale < 0.35) { this.tooltip.hidden = true; return; }
      for(const preview of previews) preview.style.setProperty("zoom", String(scale));
    }
    this.tooltip.style.maxHeight = `${available}px`;
    const fittedHeight = this.tooltip.getBoundingClientRect().height;
    this.tooltip.style.top = `${placeBelow ? rect.bottom + 5 : rect.top - 5 - fittedHeight}px`;
  };


  private refresh = () => {
    for(const target of this.targets.keys()) if(!target.isConnected) this.targets.delete(target);
    document.querySelectorAll<HTMLElement>(".panel .setting small, .panel .field small, .panel .panel-heading p, .panel .setting-note, .panel .report-header small, .panel .settings-list-header small, .panel .onboarding-header small, .panel .onboarding-tasks small, .panel .status-item small, .panel .visual-preset-grid small, .remilia-migration p, #updateStatusDetail, #performanceModeDetail").forEach(source => {
      const heading = source.parentElement?.querySelector<HTMLElement>("h2, h3, strong")
        ?? source.closest<HTMLElement>(".setting-group, .update-status")?.querySelector<HTMLElement>("h3, strong");
      const target = source.closest<HTMLElement>(".setting, .field, .status-item, .onboarding-tasks li, .visual-preset-grid button")
        ?? heading?.closest<HTMLElement>(".setting-group-header, .panel-heading, .onboarding-header, .report-header, .settings-list-header, .update-header, .remilia-migration")
        ?? heading;
      if(target) this.describe(target, source);
    });
    document.querySelectorAll<HTMLElement>(".panel .message, .panel .benchmark-message, .panel .addons-zip-list > p, .panel .settings-list-items > p").forEach(source => {
      const text = source.textContent?.trim() ?? "";
      if(!text || source.querySelector("button, a, input")) return;
      if(this.messages.get(source)?.compact === text) return;
      let compact = text;
      if(text.length > 55 || /[.!](?:\s|$)/.test(text)) {
        const count = text.match(/^\d+ ZIP files?/i)?.[0];
        compact = count ?? (/no folder/i.test(text) ? "No folder" : /no build/i.test(text) ? "Not started"
          : /no saved/i.test(text) ? "No entries" : /failed|could not|unavailable|requires|unsupported|not supported|error/i.test(text) ? "Unavailable"
            : /scanning|checking|opening|loading|running|preparing/i.test(text) ? "In progress…"
              : /copied/i.test(text) ? "Copied" : /saved/i.test(text) ? "Saved"
                : /imported/i.test(text) ? "Imported" : /exported/i.test(text) ? "Exported"
                  : /applied|enabled/i.test(text) ? "Applied" : /opened/i.test(text) ? "Opened" : "Details");
      }
      this.messages.set(source, { full: text, compact });
      if(source.textContent !== compact) source.textContent = compact;
      this.describe(source, source, false);
    });
    document.querySelectorAll<HTMLElement>(".custom-color-trigger[data-preview-control]").forEach(button => {
      const source = document.getElementById(button.dataset.previewControl!)?.closest(".field, .setting")?.querySelector<HTMLElement>("small");
      if(source) this.describe(button, source);
    });
    if(this.active && !this.tooltip.hidden) this.show(this.active);
  };


}

/** Reveal clipped values in place, above adjacent cells, without changing row height. */
function setupStatusValueExpansion(): void {
  const grid = document.getElementById("statusGrid");
  if(!grid) return;
  const overlay = document.createElement("div");
  overlay.className = "status-value-expansion";
  overlay.setAttribute("aria-hidden", "true");
  overlay.hidden = true;
  document.body.append(overlay);
  let active: HTMLElement | null = null;
  const hide = () => { active = null; overlay.hidden = true; };
  const show = (item: HTMLElement) => {
    const value = item.querySelector("strong");
    if(!value || value.scrollWidth <= value.clientWidth) { hide(); return; }
    active = item;
    overlay.textContent = value.textContent;
    overlay.hidden = false;
    overlay.style.maxWidth = `${Math.max(0, window.innerWidth - 16)}px`;
    const rect = value.getBoundingClientRect();
    const box = overlay.getBoundingClientRect();
    overlay.style.left = `${Math.max(8, Math.min(rect.left - 5, window.innerWidth - box.width - 8))}px`;
    overlay.style.top = `${Math.max(8, Math.min(rect.top - 4, window.innerHeight - box.height - 8))}px`;
  };
  const itemFor = (target: EventTarget | null) => target instanceof Element ? target.closest<HTMLElement>(".status-summary-item") : null;
  grid.addEventListener("pointerover", event => { const item = itemFor(event.target); if(item && item !== active) show(item); });
  grid.addEventListener("pointerout", event => { if(active && !active.contains(event.relatedTarget as Node)) hide(); });
  grid.addEventListener("focusin", event => { const item = itemFor(event.target); if(item) show(item); });
  grid.addEventListener("focusout", hide);
  document.addEventListener("keydown", event => {
    if(event.key === "Escape" && !overlay.hidden) { hide(); event.stopImmediatePropagation(); }
  }, true);
  window.addEventListener("scroll", hide, true);
  window.addEventListener("resize", hide);
  new MutationObserver(() => { if(active && !active.isConnected) hide(); }).observe(grid, { childList: true, subtree: true });
}
