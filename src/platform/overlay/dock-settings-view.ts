import { visibleItems } from "./dock-order-policy";
import type { DockSnapshot, DockViewActions, OverlayDockItem, OverlayDockSettingsAction, OverlayDockSettingsOptions, OverlayDockSide } from "./dock-types";
import { updateDockIcon } from "./dock-dom-utils";

type SettingsContext = { actions: DockViewActions; onUpdate?: () => void };

export function createDockSettingsPanel(
  snapshot: DockSnapshot,
  actions: DockViewActions,
  onUpdate?: () => void,
  options: OverlayDockSettingsOptions = {},
): HTMLElement {
  const context = { actions, onUpdate };
  const panel = element("div", "milxdy-overlay-dock-settings");
  const title = document.createElement("strong");
  title.textContent = "Rail settings";
  const sideSection = settingsSection("Rail side");
  const sideGroup = element("div", "milxdy-overlay-dock-segment");
  sideGroup.append(sideButton("Left", "left", snapshot, context), sideButton("Right", "right", snapshot, context));
  sideSection.append(sideGroup);
  const appSection = settingsSection("App order");
  const orderActions = element("div", "milxdy-overlay-dock-settings-actions");
  orderActions.append(actionButton("Reset order", () => {
    actions.resetOrder();
    onUpdate?.();
  }));
  appSection.append(orderActions);
  const ordered = visibleItems(snapshot.order, snapshot.items, snapshot.hiddenItems).filter((item) => item.stackable !== false);
  ordered.forEach((item, index) => appSection.append(settingsAppRow(item, index, ordered.length, context)));
  if (ordered.length === 0) appSection.append(emptyRow());
  const featureSection = settingsSection("Utilities");
  const excluded = new Set(options.excludeActionIds || []);
  const utilities = Array.from(snapshot.settingsActions.entries())
    .filter(([id]) => !excluded.has(id))
    .sort(([left], [right]) => left.localeCompare(right));
  for (const entry of utilities) featureSection.append(settingsActionButton(entry, context));
  panel.append(title, sideSection, appSection);
  if (utilities.length) panel.append(featureSection);
  return panel;
}

function sideButton(label: string, side: OverlayDockSide, snapshot: DockSnapshot, context: SettingsContext): HTMLButtonElement {
  const button = actionButton(label, () => {
    context.actions.setSide(side);
    context.onUpdate?.();
  });
  button.dataset.active = String(snapshot.side === side);
  return button;
}

function settingsAppRow(item: OverlayDockItem, index: number, count: number, context: SettingsContext): HTMLElement {
  const row = element("div", "milxdy-overlay-dock-settings-row");
  const icon = element("span", "milxdy-overlay-dock-settings-icon");
  updateDockIcon(icon, item.icon);
  const label = element("span", "milxdy-overlay-dock-settings-label");
  label.textContent = item.label;
  row.append(icon, label, moveButton(item, -1, index <= 0, context), moveButton(item, 1, index >= count - 1, context));
  return row;
}

function moveButton(item: OverlayDockItem, delta: -1 | 1, disabled: boolean, context: SettingsContext): HTMLButtonElement {
  const label = `${delta < 0 ? "Move up" : "Move down"} ${item.label}`;
  const button = actionButton(delta < 0 ? "↑" : "↓", () => {
    context.actions.moveBy(item.id, delta);
    context.onUpdate?.();
  });
  button.title = label;
  button.setAttribute("aria-label", label);
  button.disabled = disabled;
  return button;
}

function settingsActionButton([id, action]: [string, OverlayDockSettingsAction], context: SettingsContext): HTMLButtonElement {
  const button = actionButton(action.label, () => {
    context.actions.invokeSettingsAction(id);
    context.onUpdate?.();
  });
  if (action.title) button.title = action.title;
  return button;
}

function settingsSection(label: string): HTMLElement {
  const section = element("section", "milxdy-overlay-dock-settings-section");
  const heading = document.createElement("strong");
  heading.textContent = label;
  section.append(heading);
  return section;
}

function emptyRow(): HTMLElement {
  const empty = element("span", "milxdy-overlay-dock-settings-empty");
  empty.textContent = "No rail apps pinned.";
  return empty;
}

function actionButton(label: string, activate: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", activate);
  return button;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}
