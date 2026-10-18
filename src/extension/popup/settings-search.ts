/** One shared search indexes existing controls; results navigate to their original page. */
export function setupTabSearch(): void {
  const row = document.getElementById("tabSearchRow");
  const input = document.getElementById("tabSearchInput") as HTMLInputElement | null;
  const close = document.getElementById("tabSearchClose");
  const toggle = document.getElementById("settingsSearchToggle");
  const results = document.getElementById("settingsSearchResults");
  const empty = document.getElementById("tabSearchEmpty");
  if (!row || !input || !close || !toggle || !results || !empty) return;
  const normalize = (text: string) => text.toLocaleLowerCase().replace(/\s+/g, " ").trim();
  let highlighted: HTMLElement | null = null;
  const dismiss = () => {
    row.hidden = true; input.value = ""; results.replaceChildren(); results.hidden = true; empty.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
  };
  const search = () => {
    results.replaceChildren();
    const terms = normalize(input.value).split(" ").filter(Boolean);
    results.hidden = !terms.length; empty.hidden = true;
    if (!terms.length) return;
    for (const panel of document.querySelectorAll<HTMLElement>(".panel[data-panel]")) {
      const tab = document.querySelector<HTMLButtonElement>(`.tab[data-panel="${panel.dataset.panel}"]`);
      const page = tab?.textContent?.trim() ?? "Settings";
      for (const item of panel.querySelectorAll<HTMLElement>(".setting, .field, .status-summary-item, .visual-preset-grid button, .segmented-control button, button, a")) {
        if (item.closest("[data-profile-unavailable]")) continue;
        const container = item.closest(".setting, .field");
        if (container && container !== item) continue;
        const title = item.querySelector("strong, :scope > span, :scope > label")?.textContent?.trim()
          || item.getAttribute("aria-label") || item.textContent?.trim() || "Setting";
        const group = item.closest(".appearance-subgroup, .setting-group, .read-aloud-options, .settings-section, .sound-category");
        const section = group?.querySelector(":scope > h3, :scope > h4, :scope > summary, :scope > .setting-group-header h3")?.textContent?.trim() ?? "";
        const enclosingSection = item.closest(".settings-section")?.querySelector(":scope > h3")?.textContent ?? "";
        const controlLabels = [...(item.closest(".sound-volume-row") ?? item).querySelectorAll("[aria-label]")]
          .map(control => control.getAttribute("aria-label")).join(" ");
        const haystack = normalize(`${page} ${section} ${enclosingSection} ${controlLabels} ${item.textContent} ${item.getAttribute("aria-label") ?? ""}`);
        if (!terms.every(term => haystack.includes(term))) continue;
        const button = document.createElement("button"); button.type = "button"; button.className = "settings-search-result";
        const name = document.createElement("span"); name.textContent = title;
        const label = document.createElement("small"); label.textContent = [page, section].filter(Boolean).join(" · ");
        button.append(name, label);
        button.addEventListener("click", () => {
          dismiss(); tab?.click();
          for (const details of panel.querySelectorAll<HTMLDetailsElement>("details")) if (details.contains(item)) details.open = true;
          // A disabled parent stays disabled: take the user to that parent instead.
          const hiddenGroup = item.closest<HTMLElement>(".sound-children[hidden], [data-setting-parent][hidden]");
          const parent = hiddenGroup && document.querySelector<HTMLElement>(`[data-control="${hiddenGroup.dataset.soundParent ?? hiddenGroup.dataset.settingParent}"]`);
          const target = parent?.closest<HTMLElement>(".sound-volume-row, .setting") ?? item;
          highlighted?.classList.remove("settings-search-target"); highlighted = target; target.classList.add("settings-search-target");
          target.scrollIntoView({ block: "center" });
          const control = target.querySelector<HTMLElement>('button, input:not([type="hidden"]), select, a, [tabindex]');
          if (control && !control.closest("[inert], [hidden]")) control.focus({ preventScroll:true });
          window.setTimeout(() => target.classList.remove("settings-search-target"), 1800);
        });
        results.append(button);
      }
    }
    empty.hidden = results.childElementCount > 0;
  };
  toggle.addEventListener("click", () => {
    if (!row.hidden) dismiss();
    else { row.hidden = false; toggle.setAttribute("aria-expanded", "true"); input.focus(); search(); }
  });
  input.addEventListener("input", search);
  input.addEventListener("keydown", event => {
    if (event.key === "Escape") { event.preventDefault(); dismiss(); toggle.focus(); }
    else if (event.key === "Enter") results.querySelector<HTMLButtonElement>("button")?.click();
  });
  close.addEventListener("click", () => { dismiss(); toggle.focus(); });
}
