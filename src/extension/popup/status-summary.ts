export function renderStatusGroups(statusGrid: HTMLElement, groups: [string, [string, string][]][]): void {
  for (const [name, items] of groups) {
    const row = document.createElement("div");
    row.className = "status-summary-row";
    row.setAttribute("role", "group");
    row.setAttribute("aria-label", name);
    const heading = document.createElement("strong");
    heading.className = "status-summary-heading";
    heading.textContent = name;
    const values = document.createElement("div");
    values.className = "status-summary-values";
    values.style.gridTemplateColumns = `repeat(${items.length}, minmax(0, 1fr))`;
    for (const [label, value] of items) {
      const node = document.createElement("div");
      node.className = "status-summary-item";
      node.tabIndex = 0;
      const caption = document.createElement("span");
      caption.textContent = label;
      const result = document.createElement("strong");
      result.textContent = value;
      node.append(caption, result);
      values.append(node);
    }
    row.append(heading, values);
    statusGrid.append(row);
  }
}
