import { setOverlayAppStackOrder } from "./overlayAppLayout";

export type OverlayDockSide = "left" | "right";

export type OverlayDockItem = {
  id: string;
  label: string;
  icon: string;
  stackable?: boolean;
  beforeId?: string;
  badgeText?: string;
  active?: boolean;
  title?: string;
  onActivate: () => void;
  onDeactivate?: () => void;
  onSideChange?: (side: OverlayDockSide) => void;
};

export type OverlayDockRegistration = {
  update: (item: Partial<Omit<OverlayDockItem, "id" | "onActivate" | "onDeactivate">>) => void;
  remove: () => void;
};

export type OverlayDockSettingsAction = {
  label: string;
  title?: string;
  onActivate: () => void;
};

type DockState = {
  root: HTMLElement | null;
  items: Map<string, OverlayDockItem>;
  side: OverlayDockSide;
  order: string[];
  hiddenItems: Set<string>;
  settingsActions: Map<string, OverlayDockSettingsAction>;
  reorderMode: boolean;
  settingsOpen: boolean;
  loaded: boolean;
  loadPromise: Promise<void> | null;
  drag: {
    id: string;
    pointerId: number;
    startY: number;
    moved: boolean;
    element: HTMLElement;
  } | null;
  longPressTimer: number | null;
  suppressClick: boolean;
};

type DockApi = {
  register: (item: OverlayDockItem) => OverlayDockRegistration;
  getSide: () => OverlayDockSide;
  setSide: (side: OverlayDockSide) => void;
  setHiddenItems: (ids: readonly string[]) => void;
  setSettingsAction: (id: string, action: OverlayDockSettingsAction | null) => void;
  getAppOrder: () => string[];
  setAppOrder: (ids: readonly string[]) => void;
  createSettingsPanel: (onUpdate?: () => void) => HTMLElement;
  subscribeSide: (callback: (side: OverlayDockSide) => void) => () => void;
};

const ROOT_ID = "milxdy-overlay-dock-root";
const STYLE_ID = "milxdy-overlay-dock-style";
const SIDE_KEY = "milxdy.overlayDock.side";
const ORDER_KEY = "milxdy.overlayDock.order";
const LONG_PRESS_MS = 520;
const globalKey = "__milxdyOverlayDock";

const sideListeners = new Set<(side: OverlayDockSide) => void>();

function createDockApi(): DockApi {
  const state: DockState = {
    root: null,
    items: new Map(),
    side: "right",
    order: [],
    hiddenItems: new Set(),
    settingsActions: new Map(),
    reorderMode: false,
    settingsOpen: false,
    loaded: false,
    loadPromise: null,
    drag: null,
    longPressTimer: null,
    suppressClick: false,
  };

  function register(item: OverlayDockItem): OverlayDockRegistration {
    state.items.set(item.id, { ...item });
    if (!state.order.includes(item.id)) state.order.push(item.id);
    syncStackOrder();
    void ensureLoaded().then(() => {
      ensureRoot();
      render();
      item.onSideChange?.(state.side);
    });

    return {
      update(update) {
        const current = state.items.get(item.id);
        if (!current) return;
        if (!hasItemChanges(current, update)) return;
        state.items.set(item.id, { ...current, ...update });
        render();
      },
      remove() {
        state.items.delete(item.id);
        syncStackOrder();
        render();
      },
    };
  }

  function getSide(): OverlayDockSide {
    return state.side;
  }

  function setSide(side: OverlayDockSide): void {
    if (state.side === side) return;
    state.side = side;
    void chrome.storage.local.set({ [SIDE_KEY]: side });
    notifySide();
    render();
  }

  function setHiddenItems(ids: readonly string[]): void {
    state.hiddenItems = new Set(ids);
    render();
  }

  function setSettingsAction(id: string, action: OverlayDockSettingsAction | null): void {
    if (action) state.settingsActions.set(id, action);
    else state.settingsActions.delete(id);
    render();
  }

  function subscribeSide(callback: (side: OverlayDockSide) => void): () => void {
    sideListeners.add(callback);
    callback(state.side);
    return () => sideListeners.delete(callback);
  }

  function notifySide(): void {
    for (const listener of sideListeners) listener(state.side);
    for (const item of state.items.values()) item.onSideChange?.(state.side);
  }

  async function ensureLoaded(): Promise<void> {
    if (state.loaded) return;
    if (state.loadPromise) return state.loadPromise;
    state.loadPromise = chrome.storage.local.get({ [SIDE_KEY]: "right", [ORDER_KEY]: [] })
      .then((stored) => {
        state.side = stored[SIDE_KEY] === "left" ? "left" : "right";
        state.order = Array.isArray(stored[ORDER_KEY])
          ? stored[ORDER_KEY].filter((id): id is string => typeof id === "string")
          : [];
        state.loaded = true;
        syncStackOrder();
        notifySide();
      })
      .catch(() => {
        state.loaded = true;
      });
    return state.loadPromise;
  }

  function ensureRoot(): void {
    injectStyles();
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("aside");
      root.id = ROOT_ID;
      root.setAttribute("aria-label", "milXdy overlay dock");
      document.documentElement.appendChild(root);
    }
    state.root = root;
  }

  function orderedItems(): OverlayDockItem[] {
    const ids = new Set(state.order);
    const missing = Array.from(state.items.keys()).filter((id) => !ids.has(id));
    if (missing.length) state.order.push(...missing);
    const items = state.order
      .map((id) => state.items.get(id))
      .filter((item): item is OverlayDockItem => item != null && !state.hiddenItems.has(item.id));
    applyBeforePlacements(items);
    return items;
  }

  function applyBeforePlacements(items: OverlayDockItem[]): void {
    for (const item of Array.from(items)) {
      if (!item.beforeId) continue;
      const from = items.findIndex((candidate) => candidate.id === item.id);
      const to = items.findIndex((candidate) => candidate.id === item.beforeId);
      if (from === -1 || to === -1 || from === to - 1) continue;
      items.splice(from, 1);
      const nextTo = items.findIndex((candidate) => candidate.id === item.beforeId);
      if (nextTo === -1) items.push(item);
      else items.splice(nextTo, 0, item);
    }
  }

  function stackableOrder(): string[] {
    const ordered = new Set(state.order);
    const ids = [
      ...state.order,
      ...Array.from(state.items.keys()).filter((id) => !ordered.has(id)),
    ];
    return ids.filter((id) => state.items.get(id)?.stackable !== false);
  }

  function syncStackOrder(): void {
    setOverlayAppStackOrder(stackableOrder());
  }

  function getAppOrder(): string[] {
    return stackableOrder();
  }

  function setAppOrder(ids: readonly string[]): void {
    const requested = ids.filter((id): id is string => typeof id === "string" && state.items.get(id)?.stackable !== false);
    const requestedSet = new Set(requested);
    const currentStackable = stackableOrder();
    const mergedStackable = [
      ...requested.filter((id) => currentStackable.includes(id)),
      ...currentStackable.filter((id) => !requestedSet.has(id)),
    ];
    const stackableSet = new Set(currentStackable);
    const next: string[] = [];
    let stackIndex = 0;
    for (const id of state.order) {
      if (stackableSet.has(id)) {
        const replacement = mergedStackable[stackIndex++];
        if (replacement) next.push(replacement);
      } else {
        next.push(id);
      }
    }
    for (; stackIndex < mergedStackable.length; stackIndex += 1) next.push(mergedStackable[stackIndex]);
    for (const id of Array.from(state.items.keys())) if (!next.includes(id)) next.push(id);
    state.order = next;
    saveOrder();
    syncStackOrder();
    render();
  }

  function hasItemChanges(
    current: OverlayDockItem,
    update: Partial<Omit<OverlayDockItem, "id" | "onActivate" | "onDeactivate">>,
  ): boolean {
    for (const key of Object.keys(update) as Array<keyof typeof update>) {
      if (current[key] !== update[key]) return true;
    }
    return false;
  }

  function render(): void {
    const root = state.root;
    if (!root) return;
    root.dataset.side = state.side;
    root.dataset.reorder = String(state.reorderMode);
    root.dataset.settingsOpen = String(state.settingsOpen);

    let rail = root.querySelector<HTMLElement>(":scope > .milxdy-overlay-dock-rail");
    if (!rail) {
      rail = document.createElement("div");
      rail.className = "milxdy-overlay-dock-rail";
      root.prepend(rail);
    }

    const items = orderedItems();
    const renderedItemIds = new Set(items.map((item) => item.id));

    for (const button of Array.from(rail.querySelectorAll<HTMLButtonElement>(":scope > .milxdy-overlay-dock-item[data-item-id]"))) {
      const itemId = button.dataset.itemId;
      if (!itemId || !renderedItemIds.has(itemId)) button.remove();
    }

    let nextNode: ChildNode | null = rail.firstChild;
    for (const item of items) {
      const button = findItemButton(rail, item.id) || createItemButton(item.id);
      updateItemButton(button, item);
      if (button !== nextNode) rail.insertBefore(button, nextNode);
      nextNode = button.nextSibling;
    }

    for (const extra of Array.from(rail.querySelectorAll<HTMLElement>(":scope > :not(.milxdy-overlay-dock-item)"))) {
      extra.remove();
    }
  }

  function findItemButton(rail: HTMLElement, id: string): HTMLButtonElement | null {
    for (const button of Array.from(rail.querySelectorAll<HTMLButtonElement>(":scope > .milxdy-overlay-dock-item[data-item-id]"))) {
      if (button.dataset.itemId === id) return button;
    }
    return null;
  }

  function createItemButton(id: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "milxdy-overlay-dock-item";
    button.type = "button";
    button.dataset.itemId = id;

    button.addEventListener("click", (event) => {
      if (state.reorderMode || state.suppressClick) {
        event.preventDefault();
        state.suppressClick = false;
        return;
      }
      const itemId = button.dataset.itemId;
      const item = itemId ? state.items.get(itemId) : null;
      if (!item) return;
      if (item.active && item.onDeactivate) item.onDeactivate();
      else item.onActivate();
    });
    button.addEventListener("pointerdown", (event) => {
      const itemId = button.dataset.itemId;
      if (itemId) startItemPointer(event, itemId);
    });
    attachDockHover(button);
    return button;
  }

  function updateItemButton(button: HTMLButtonElement, item: OverlayDockItem): void {
    const active = String(Boolean(item.active));
    const title = item.title || item.label;
    if (button.dataset.active !== active) button.dataset.active = active;
    if (button.title !== title) button.title = title;
    if (button.getAttribute("aria-label") !== item.label) button.setAttribute("aria-label", item.label);

    let icon = button.querySelector<HTMLElement>(":scope > .milxdy-overlay-dock-icon");
    if (!icon) {
      icon = document.createElement("span");
      icon.className = "milxdy-overlay-dock-icon";
      button.prepend(icon);
    }
    updateIcon(icon, item.icon);

    let badge = button.querySelector<HTMLElement>(":scope > .milxdy-overlay-dock-badge");
    if (item.badgeText) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "milxdy-overlay-dock-badge";
        button.append(badge);
      }
      if (badge.textContent !== item.badgeText) badge.textContent = item.badgeText;
    } else {
      badge?.remove();
    }
  }

  function updateIcon(icon: HTMLElement, value: string): void {
    if (icon.dataset.icon === value) return;
    icon.dataset.icon = value;
    icon.textContent = "";
    if (/^(https?:|chrome-extension:|moz-extension:|data:|\/)/.test(value)) {
      const image = document.createElement("img");
      image.src = value;
      image.alt = "";
      icon.append(image);
    } else {
      icon.textContent = value;
    }
  }

  function attachDockHover(button: HTMLButtonElement): void {
    const setHovered = () => {
      if (button.dataset.hovered !== "true") button.dataset.hovered = "true";
    };
    const clearHovered = () => {
      if (button.dataset.hovered === "true") delete button.dataset.hovered;
    };
    const isOutsideBoundary = (event: MouseEvent | PointerEvent) => {
      return !(event.relatedTarget instanceof Node) || !button.contains(event.relatedTarget);
    };

    button.addEventListener("pointerenter", setHovered);
    button.addEventListener("pointerleave", clearHovered);
    button.addEventListener("mouseover", (event) => {
      if (isOutsideBoundary(event)) setHovered();
    });
    button.addEventListener("mouseout", (event) => {
      if (isOutsideBoundary(event)) clearHovered();
    });
  }

  function startItemPointer(event: PointerEvent, id: string): void {
    if (event.button !== 0) return;
    if (state.items.get(id)?.stackable === false) return;
    const button = event.currentTarget as HTMLElement;
    state.drag = {
      id,
      pointerId: event.pointerId,
      startY: event.clientY,
      moved: false,
      element: button,
    };
    button.setPointerCapture?.(event.pointerId);
    window.addEventListener("pointermove", moveItemPointer);
    window.addEventListener("pointerup", endItemPointer);
    window.addEventListener("pointercancel", cancelItemPointer);
    if (state.longPressTimer !== null) window.clearTimeout(state.longPressTimer);
    state.longPressTimer = window.setTimeout(() => {
      state.reorderMode = true;
      state.longPressTimer = null;
      if (state.root) state.root.dataset.reorder = "true";
    }, LONG_PRESS_MS);
  }

  function moveItemPointer(event: PointerEvent): void {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    const delta = event.clientY - state.drag.startY;
    if (Math.abs(delta) < 8) return;
    state.drag.moved = true;
    if (state.longPressTimer !== null) {
      window.clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
    if (!state.reorderMode) return;
    const root = state.root;
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-item-id]")
      : null;
    const targetId = target?.dataset.itemId;
    if (!root || !targetId || targetId === state.drag.id) return;
    const from = state.order.indexOf(state.drag.id);
    const to = state.order.indexOf(targetId);
    if (from === -1 || to === -1) return;
    state.order.splice(from, 1);
    state.order.splice(to, 0, state.drag.id);
    syncStackOrder();
    render();
  }

  function endItemPointer(event: PointerEvent): void {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    if (state.longPressTimer !== null) {
      window.clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
    state.drag.element.releasePointerCapture?.(event.pointerId);
    state.suppressClick = state.drag.moved;
    if (state.reorderMode && state.drag.moved) saveOrder();
    state.drag = null;
    window.removeEventListener("pointermove", moveItemPointer);
    window.removeEventListener("pointerup", endItemPointer);
    window.removeEventListener("pointercancel", cancelItemPointer);
  }

  function cancelItemPointer(event: PointerEvent): void {
    if (!state.drag || state.drag.pointerId !== event.pointerId) return;
    if (state.longPressTimer !== null) {
      window.clearTimeout(state.longPressTimer);
      state.longPressTimer = null;
    }
    state.drag = null;
    window.removeEventListener("pointermove", moveItemPointer);
    window.removeEventListener("pointerup", endItemPointer);
    window.removeEventListener("pointercancel", cancelItemPointer);
  }

  function saveOrder(): void {
    void chrome.storage.local.set({ [ORDER_KEY]: state.order });
  }

  function createSettingsPanel(onUpdate?: () => void): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "milxdy-overlay-dock-settings";

    const title = document.createElement("strong");
    title.textContent = "Dock";

    const sideGroup = document.createElement("div");
    sideGroup.className = "milxdy-overlay-dock-segment";
    sideGroup.append(
      sideButton("Left", "left", onUpdate),
      sideButton("Right", "right", onUpdate),
    );

    const reorder = document.createElement("button");
    reorder.type = "button";
    reorder.textContent = state.reorderMode ? "Done" : "Reorder";
    reorder.addEventListener("click", () => {
      state.reorderMode = !state.reorderMode;
      if (!state.reorderMode) saveOrder();
      render();
      onUpdate?.();
    });

    const reset = document.createElement("button");
    reset.type = "button";
    reset.textContent = "Reset order";
    reset.addEventListener("click", () => {
      state.order = Array.from(state.items.keys());
      saveOrder();
      syncStackOrder();
      render();
      onUpdate?.();
    });

    const appSection = settingsSection("Apps");
    for (const item of orderedItems().filter((item) => item.stackable !== false)) {
      appSection.append(settingsAppRow(item));
    }
    if (!appSection.querySelector(".milxdy-overlay-dock-settings-row")) {
      const empty = document.createElement("span");
      empty.className = "milxdy-overlay-dock-settings-empty";
      empty.textContent = "No rail apps pinned.";
      appSection.append(empty);
    }

    const featureSection = settingsSection("Features");
    const actions = Array.from(state.settingsActions.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([, action]) => settingsActionButton(action, onUpdate));
    featureSection.append(...actions);

    panel.append(title, sideGroup, reorder, reset, appSection, featureSection);
    return panel;
  }

  function settingsSection(label: string): HTMLElement {
    const section = document.createElement("section");
    section.className = "milxdy-overlay-dock-settings-section";
    const heading = document.createElement("strong");
    heading.textContent = label;
    section.append(heading);
    return section;
  }

  function settingsAppRow(item: OverlayDockItem): HTMLElement {
    const row = document.createElement("div");
    row.className = "milxdy-overlay-dock-settings-row";
    const handle = document.createElement("span");
    handle.className = "milxdy-overlay-dock-settings-drag";
    handle.setAttribute("aria-hidden", "true");
    handle.textContent = "⋮⋮";
    const icon = document.createElement("span");
    icon.className = "milxdy-overlay-dock-settings-icon";
    updateIcon(icon, item.icon);
    const label = document.createElement("span");
    label.className = "milxdy-overlay-dock-settings-label";
    label.textContent = item.label;
    row.append(handle, icon, label);
    return row;
  }

  function settingsActionButton(action: OverlayDockSettingsAction, onUpdate?: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = action.label;
    if (action.title) button.title = action.title;
    button.addEventListener("click", () => {
      state.settingsOpen = false;
      action.onActivate();
      render();
      onUpdate?.();
    });
    return button;
  }

  function sideButton(label: string, side: OverlayDockSide, onUpdate?: () => void): HTMLButtonElement {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.dataset.active = String(state.side === side);
    button.addEventListener("click", () => {
      setSide(side);
      onUpdate?.();
    });
    return button;
  }

  return { register, getSide, setSide, setHiddenItems, setSettingsAction, getAppOrder, setAppOrder, createSettingsPanel, subscribeSide };
}

function injectStyles(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    #${ROOT_ID} {
      --milxdy-dock-bg: #1f222a;
      --milxdy-dock-panel: #101218;
      --milxdy-dock-border: #8f7932;
      --milxdy-dock-highlight: #454953;
      --milxdy-dock-shadow: #050608;
      --milxdy-dock-scrollbar: #b68e24;
      --milxdy-dock-icon-bg: #101218;
      --milxdy-dock-icon-border: #5e5228;
      --milxdy-dock-icon-shadow: #050608;
      --milxdy-dock-active: #f0b72d;
      --milxdy-dock-top: 16px;
      --milxdy-dock-bottom-clearance: 136px;
      position: fixed;
      top: var(--milxdy-dock-top);
      z-index: 2147483646;
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      user-select: none;
    }
    html[data-milxdy-x-theme="light"] #${ROOT_ID},
    html[data-milxdy-settings-theme="light"] #${ROOT_ID},
    html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]) #${ROOT_ID} {
      --milxdy-dock-bg: #d4d0c8;
      --milxdy-dock-panel: #ece9df;
      --milxdy-dock-border: #808080;
      --milxdy-dock-highlight: #ffffff;
      --milxdy-dock-shadow: #404040;
      --milxdy-dock-scrollbar: #808080;
      --milxdy-dock-icon-bg: #ece9df;
      --milxdy-dock-icon-border: #808080;
      --milxdy-dock-icon-shadow: #404040;
      --milxdy-dock-active: #000080;
      color-scheme: light;
    }
    html[data-milxdy-x-theme="dark"] #${ROOT_ID},
    html[data-milxdy-x-theme="dim"] #${ROOT_ID},
    html[data-milxdy-settings-theme="dark"] #${ROOT_ID},
    html:not([data-milxdy-settings-theme="light"])[style*="color-scheme: dark"] #${ROOT_ID} {
      --milxdy-dock-bg: #1f222a;
      --milxdy-dock-panel: #101218;
      --milxdy-dock-border: #8f7932;
      --milxdy-dock-highlight: #454953;
      --milxdy-dock-shadow: #050608;
      --milxdy-dock-scrollbar: #b68e24;
      --milxdy-dock-icon-bg: #101218;
      --milxdy-dock-icon-border: #5e5228;
      --milxdy-dock-icon-shadow: #050608;
      --milxdy-dock-active: #f0b72d;
      color-scheme: dark;
    }
    @media (prefers-color-scheme: light) {
      html:not([data-milxdy-x-theme="dark"]):not([data-milxdy-x-theme="dim"]):not([data-milxdy-settings-theme="dark"]):not([style*="color-scheme: dark"]) #${ROOT_ID} {
        --milxdy-dock-bg: #d4d0c8;
        --milxdy-dock-panel: #ece9df;
        --milxdy-dock-border: #808080;
        --milxdy-dock-highlight: #ffffff;
        --milxdy-dock-shadow: #404040;
        --milxdy-dock-scrollbar: #808080;
        --milxdy-dock-icon-bg: #ece9df;
        --milxdy-dock-icon-border: #808080;
        --milxdy-dock-icon-shadow: #404040;
        --milxdy-dock-active: #000080;
        color-scheme: light;
      }
    }
    #${ROOT_ID}[data-side="left"] { left: 8px; }
    #${ROOT_ID}[data-side="right"] { right: 8px; }
    html:has(body [role="dialog"] [aria-label="Close"]) #${ROOT_ID}[data-side="left"] {
      --milxdy-dock-top: 72px;
      --milxdy-dock-bottom-clearance: 80px;
    }
    .milxdy-overlay-dock-rail {
      display: grid;
      justify-items: center;
      gap: 4px;
      width: 56px;
      max-height: calc(100vh - var(--milxdy-dock-top) - var(--milxdy-dock-bottom-clearance));
      padding: 6px 4px;
      overflow-x: hidden;
      overflow-y: auto;
      border: 2px solid var(--milxdy-dock-border);
      border-radius: 0;
      background: var(--milxdy-dock-bg);
      box-shadow:
        inset 2px 2px 0 var(--milxdy-dock-highlight),
        inset -2px -2px 0 var(--milxdy-dock-shadow),
        5px 5px 0 rgba(0, 0, 0, 0.26);
      scrollbar-width: thin;
      scrollbar-color: var(--milxdy-dock-scrollbar) transparent;
      scroll-snap-type: y proximity;
    }
    .milxdy-overlay-dock-rail::-webkit-scrollbar {
      width: 5px;
    }
    .milxdy-overlay-dock-rail::-webkit-scrollbar-track {
      background: transparent;
    }
    .milxdy-overlay-dock-rail::-webkit-scrollbar-thumb {
      border-radius: 0;
      background: var(--milxdy-dock-scrollbar);
    }
    .milxdy-overlay-dock-item {
      position: relative;
      display: grid;
      place-items: center;
      width: 48px;
      height: 48px;
      margin: 0;
      padding: 0;
      border: 1px solid var(--milxdy-dock-icon-border);
      border-radius: 0;
      background: var(--milxdy-dock-panel);
      color: #fff4cf;
      cursor: pointer;
      font: 900 18px/1 inherit;
      scroll-snap-align: center;
      box-shadow:
        inset 2px 2px 0 var(--milxdy-dock-highlight),
        inset -2px -2px 0 var(--milxdy-dock-shadow);
      transition: none;
    }
    .milxdy-overlay-dock-item[data-hovered="true"],
    .milxdy-overlay-dock-item[data-active="true"] {
      background: var(--milxdy-dock-panel);
      filter: none;
    }
    .milxdy-overlay-dock-item[data-hovered="true"] {
      filter: none;
    }
    .milxdy-overlay-dock-item[data-active="true"]::before {
      content: "";
      position: absolute;
      top: 4px;
      bottom: 4px;
      width: 3px;
      border-radius: 0;
      background: var(--milxdy-dock-active);
      box-shadow: none;
    }
    #${ROOT_ID}[data-side="left"] .milxdy-overlay-dock-item[data-active="true"]::before { left: 0; }
    #${ROOT_ID}[data-side="right"] .milxdy-overlay-dock-item[data-active="true"]::before { right: 0; }
    .milxdy-overlay-dock-item[data-active="true"] {
      box-shadow:
        inset 2px 2px 0 var(--milxdy-dock-shadow),
        inset -2px -2px 0 var(--milxdy-dock-highlight);
    }
    .milxdy-overlay-dock-item[data-item-id="milxdyHideAll"] {
      width: 48px;
      height: 16px;
      min-height: 16px;
      border-width: 1px;
      font: 800 8px/1 var(--milxdy-font-ui, system-ui, sans-serif);
      text-transform: lowercase;
    }
    .milxdy-overlay-dock-item[data-item-id="milxdyHideAll"] .milxdy-overlay-dock-icon {
      width: 100%;
      height: 100%;
      padding: 0 2px;
      color: var(--milxdy-dock-active);
      font: inherit;
      line-height: 14px;
      text-align: center;
      white-space: nowrap;
    }
    .milxdy-overlay-dock-item[data-item-id="milxdyHideAll"]:active {
      transform: translate(1px, 1px);
      box-shadow:
        inset 2px 2px 0 var(--milxdy-dock-shadow),
        inset -1px -1px 0 var(--milxdy-dock-highlight);
    }
    .milxdy-overlay-dock-item[data-item-id="milxdyHideAll"]:active .milxdy-overlay-dock-icon {
      color: color-mix(in srgb, var(--milxdy-dock-active) 78%, var(--milxdy-dock-shadow));
    }
    #${ROOT_ID}[data-reorder="true"] .milxdy-overlay-dock-item {
      cursor: grab;
      animation: milxdy-dock-wiggle 150ms infinite alternate ease-in-out;
    }
    .milxdy-overlay-dock-icon,
    .milxdy-overlay-dock-icon img {
      display: block;
      width: 40px;
      height: 40px;
    }
    .milxdy-overlay-dock-icon {
      display: grid;
      place-items: center;
      overflow: hidden;
      border: 0;
      border-radius: 0;
      background: transparent;
      box-shadow: none;
      transform-origin: center;
      transition: none;
      will-change: transform;
      pointer-events: none;
    }
    .milxdy-overlay-dock-item[data-active="true"] .milxdy-overlay-dock-icon {
      box-shadow: none;
    }
    .milxdy-overlay-dock-item[data-hovered="true"] .milxdy-overlay-dock-icon {
      border-color: transparent;
    }
    .milxdy-overlay-dock-item[data-hovered="true"] .milxdy-overlay-dock-icon {
      transform: none;
    }
    .milxdy-overlay-dock-icon img {
      object-fit: contain;
      filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.38));
    }
    html[data-milxdy-settings-theme="light"] .milxdy-overlay-dock-icon img[src^="data:image/svg+xml"] {
      filter: saturate(0.95) drop-shadow(0 2px 3px rgba(15, 23, 42, 0.12));
    }
    .milxdy-overlay-dock-badge {
      position: absolute;
      right: -4px;
      bottom: -5px;
      max-width: 52px;
      overflow: hidden;
      padding: 2px 5px;
      border: 1px solid rgba(0, 0, 0, 0.4);
      border-radius: 0;
      background: #f8d35d;
      color: #191713;
      font: 900 10px/1.2 inherit;
      text-overflow: ellipsis;
      white-space: nowrap;
      pointer-events: none;
    }
    .milxdy-overlay-dock-item[data-item-id="beetol"] .milxdy-overlay-dock-badge {
      right: -2px;
      bottom: -3px;
      max-width: 32px;
      padding: 1px 3px;
      font-size: 8px;
      line-height: 1.15;
    }
    .milxdy-overlay-dock-item[data-item-id="music"] .milxdy-overlay-dock-badge {
      right: -2px;
      bottom: -3px;
      max-width: 32px;
      padding: 1px 3px;
      font-size: 8px;
      line-height: 1.15;
    }
    .milxdy-overlay-dock-settings {
      position: absolute;
      top: 0;
      display: grid;
      gap: 8px;
      width: 150px;
      padding: 10px;
      border: 1px solid rgba(255, 255, 255, 0.18);
      border-radius: 0;
      background: rgba(14, 15, 19, 0.94);
      color: #fff4cf;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.34);
    }
    #${ROOT_ID}[data-side="left"] .milxdy-overlay-dock-settings { left: 70px; }
    #${ROOT_ID}[data-side="right"] .milxdy-overlay-dock-settings { right: 70px; }
    .milxdy-overlay-dock-settings strong {
      font-size: 12px;
      line-height: 1.2;
    }
    .milxdy-overlay-dock-settings-section {
      display: grid;
      gap: 5px;
      padding-top: 3px;
      border-top: 1px solid rgba(250, 220, 130, 0.18);
    }
    .milxdy-overlay-dock-settings-section > strong {
      color: var(--milxdy-dock-active);
      font-size: 10px;
      text-transform: uppercase;
    }
    .milxdy-overlay-dock-settings-row {
      display: grid;
      grid-template-columns: 14px 22px minmax(0, 1fr);
      align-items: center;
      gap: 5px;
      min-height: 24px;
      color: inherit;
      font-size: 11px;
      line-height: 1.2;
    }
    .milxdy-overlay-dock-settings-drag {
      color: rgba(255, 244, 207, 0.62);
      font-size: 11px;
      line-height: 1;
    }
    .milxdy-overlay-dock-settings-icon,
    .milxdy-overlay-dock-settings-icon img {
      width: 22px;
      height: 22px;
    }
    .milxdy-overlay-dock-settings-icon {
      display: grid;
      place-items: center;
      overflow: hidden;
    }
    .milxdy-overlay-dock-settings-label {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .milxdy-overlay-dock-settings-empty {
      color: rgba(255, 244, 207, 0.62);
      font-size: 11px;
      line-height: 1.25;
    }
    .milxdy-overlay-dock-settings button {
      min-height: 28px;
      border: 1px solid rgba(250, 220, 130, 0.24);
      border-radius: 0;
      background: rgba(255, 255, 255, 0.08);
      color: #fff4cf;
      cursor: pointer;
      font: 700 11px/1 inherit;
    }
    .milxdy-overlay-dock-segment {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
    }
    .milxdy-overlay-dock-segment button[data-active="true"] {
      background: rgba(250, 220, 130, 0.22);
      border-color: rgba(250, 220, 130, 0.48);
    }
    @keyframes milxdy-dock-wiggle {
      from { transform: rotate(-1.3deg); }
      to { transform: rotate(1.3deg); }
    }
    @media (max-width: 720px) {
      #${ROOT_ID} {
        --milxdy-dock-top: 8px;
        --milxdy-dock-bottom-clearance: 96px;
      }
    }
  `;
  document.documentElement.appendChild(style);
}

export function getOverlayDock(): DockApi {
  const host = window as unknown as Record<string, DockApi | undefined>;
  host[globalKey] ||= createDockApi();
  return host[globalKey];
}
