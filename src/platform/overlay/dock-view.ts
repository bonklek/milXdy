import { visibleItems } from "./dock-order-policy";
import { DockPointerInteraction, type DockPointerHost } from "./dock-pointer-interaction";
import { createDockSettingsPanel } from "./dock-settings-view";
import { injectDockStyles } from "./dock-styles";
import { dockItemIdAtPoint, updateDockIcon } from "./dock-dom-utils";
import { DOCK_ROOT_ID } from "./dock-dom-contract";
import type {
  DockSnapshot,
  DockViewActions,
  DockViewPort,
  OverlayDockItem,
  OverlayDockSettingsOptions,
} from "./dock-types";

export class OverlayDockDomView implements DockViewPort {
  #root: HTMLElement | null = null;
  #rail: HTMLElement | null = null;
  #snapshot: DockSnapshot | null = null;
  #actions: DockViewActions | null = null;
  #pointer: DockPointerInteraction | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #mediaViewerObserver: MutationObserver | null = null;
  #mediaViewerCheckQueued = false;
  #railIndicatorFrame = 0;
  #suppressClick = false;

  mount(): void {
    if (this.#root?.isConnected) return;
    injectDockStyles();
    let root = document.getElementById(DOCK_ROOT_ID);
    if (!root) {
      root = document.createElement("aside");
      root.id = DOCK_ROOT_ID;
      root.setAttribute("aria-label", "milXdy overlay dock");
      document.documentElement.appendChild(root);
    }
    this.#root = root;
    this.#ensureRail();
    this.#observeHostMediaViewer();
  }

  render(snapshot: DockSnapshot, actions: DockViewActions): void {
    this.#snapshot = snapshot;
    this.#actions = actions;
    const root = this.#root;
    const rail = this.#rail;
    if (!root || !rail) return;
    root.dataset.side = snapshot.side;
    root.dataset.reorder = String(snapshot.reorderMode);
    root.dataset.settingsOpen = "false";
    const items = visibleItems(snapshot.order, snapshot.items, snapshot.hiddenItems);
    const renderedItemIds = new Set(items.map((item) => item.id));
    for (const button of this.#itemButtons()) {
      const itemId = button.dataset.itemId;
      if (!itemId || !renderedItemIds.has(itemId)) button.remove();
    }
    let nextNode: ChildNode | null = rail.firstChild;
    for (const item of items) {
      const button = this.#findItemButton(item.id) || this.#createItemButton(item.id);
      updateDockItemButton(button, item);
      if (button !== nextNode) rail.insertBefore(button, nextNode);
      nextNode = button.nextSibling;
    }
    for (const extra of Array.from(rail.querySelectorAll<HTMLElement>(":scope > :not(.milxdy-overlay-dock-item)"))) {
      extra.remove();
    }
    this.#scheduleRailIndicators();
  }

  createSettingsPanel(
    snapshot: DockSnapshot,
    actions: DockViewActions,
    onUpdate?: () => void,
    options: OverlayDockSettingsOptions = {},
  ): HTMLElement {
    return createDockSettingsPanel(snapshot, actions, onUpdate, options);
  }

  dispose(): void {
    this.#pointer?.dispose();
    this.#pointer = null;
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#mediaViewerObserver?.disconnect();
    this.#mediaViewerObserver = null;
    document.removeEventListener("fullscreenchange", this.#scheduleHostMediaViewerCheck);
    window.removeEventListener("resize", this.#scheduleRailIndicators);
    this.#rail?.removeEventListener("scroll", this.#scheduleRailIndicators);
    if (this.#railIndicatorFrame) cancelAnimationFrame(this.#railIndicatorFrame);
    this.#railIndicatorFrame = 0;
    this.#root?.remove();
    this.#root = null;
    this.#rail = null;
    this.#snapshot = null;
    this.#actions = null;
  }

  #observeHostMediaViewer(): void {
    if (!this.#mediaViewerObserver) {
      this.#mediaViewerObserver = new MutationObserver(this.#scheduleHostMediaViewerCheck);
      this.#mediaViewerObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["aria-label", "aria-modal", "data-testid", "role"],
        childList: true,
        subtree: true,
      });
      document.addEventListener("fullscreenchange", this.#scheduleHostMediaViewerCheck);
    }
    this.#updateHostMediaViewerState();
  }

  readonly #scheduleHostMediaViewerCheck = (): void => {
    if (this.#mediaViewerCheckQueued) return;
    this.#mediaViewerCheckQueued = true;
    queueMicrotask(() => {
      this.#mediaViewerCheckQueued = false;
      this.#updateHostMediaViewerState();
    });
  };

  #updateHostMediaViewerState(): void {
    if (this.#root) this.#root.dataset.hostMediaViewerOpen = String(isHostMediaViewerOpen());
  }

  #ensureRail(): void {
    const root = this.#root;
    if (!root) return;
    let rail = root.querySelector<HTMLElement>(":scope > .milxdy-overlay-dock-rail");
    if (!rail) {
      rail = document.createElement("div");
      rail.className = "milxdy-overlay-dock-rail";
      root.prepend(rail);
    }
    if (this.#rail === rail) return;
    this.#rail = rail;
    rail.addEventListener("scroll", this.#scheduleRailIndicators, { passive: true });
    window.addEventListener("resize", this.#scheduleRailIndicators, { passive: true });
    if (typeof ResizeObserver === "function") {
      this.#resizeObserver = new ResizeObserver(this.#scheduleRailIndicators);
      this.#resizeObserver.observe(rail);
    }
    this.#pointer = new DockPointerInteraction(this.#pointerEnvironment(), {
      getReorderMode: () => this.#snapshot?.reorderMode === true,
      setReorderMode: (active) => this.#actions?.setReorderMode(active),
      moveBefore: (id, targetId) => this.#actions?.moveBefore(id, targetId),
      commitOrder: () => this.#actions?.commitOrder(),
      suppressNextClick: () => { this.#suppressClick = true; },
    });
  }

  readonly #scheduleRailIndicators = (): void => {
    if (this.#railIndicatorFrame) return;
    this.#railIndicatorFrame = requestAnimationFrame(() => {
      this.#railIndicatorFrame = 0;
      const root = this.#root;
      const rail = this.#rail;
      if (!root || !rail) return;
      const tolerance = 2;
      const canScroll = rail.scrollHeight > rail.clientHeight + tolerance;
      root.dataset.canScrollUp = String(canScroll && rail.scrollTop > tolerance);
      root.dataset.canScrollDown = String(canScroll && rail.scrollTop + rail.clientHeight < rail.scrollHeight - tolerance);
    });
  };

  #itemButtons(): HTMLButtonElement[] {
    return this.#rail
      ? Array.from(this.#rail.querySelectorAll<HTMLButtonElement>(":scope > .milxdy-overlay-dock-item[data-item-id]"))
      : [];
  }

  #findItemButton(id: string): HTMLButtonElement | null {
    return this.#itemButtons().find((button) => button.dataset.itemId === id) || null;
  }

  #createItemButton(id: string): HTMLButtonElement {
    const button = document.createElement("button");
    button.className = "milxdy-overlay-dock-item";
    button.type = "button";
    button.dataset.itemId = id;
    button.addEventListener("click", (event) => this.#activate(event, button));
    button.addEventListener("pointerdown", (event) => this.#startPointer(event, button));
    attachDockHover(button);
    return button;
  }

  #activate(event: MouseEvent, button: HTMLButtonElement): void {
    if (this.#snapshot?.reorderMode || this.#suppressClick) {
      event.preventDefault();
      this.#suppressClick = false;
      return;
    }
    const id = button.dataset.itemId;
    if (!id) return;
    if (id === "milxdyAddOnsCatalog") {
      button.dataset.launching = "true";
      window.setTimeout(() => delete button.dataset.launching, 260);
    }
    this.#actions?.activate(id);
  }

  #startPointer(event: PointerEvent, button: HTMLButtonElement): void {
    if (event.button !== 0) return;
    const id = button.dataset.itemId;
    if (!id || this.#snapshot?.items.get(id)?.stackable === false) return;
    this.#pointer?.start(event, id, button);
  }

  #pointerEnvironment(): DockPointerHost {
    return {
      scheduleLongPress: (callback) => {
        const timer = window.setTimeout(callback, 520);
        return () => window.clearTimeout(timer);
      },
      listen: ({ move, end, cancel }) => {
        const onMove = (event: PointerEvent) => {
          move(event, dockItemIdAtPoint((x, y) => document.elementFromPoint(x, y) as HTMLElement | null, event));
        };
        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", end);
        window.addEventListener("pointercancel", cancel);
        return () => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", end);
          window.removeEventListener("pointercancel", cancel);
        };
      },
    };
  }
}

function isHostMediaViewerOpen(): boolean {
  if (document.fullscreenElement) return true;
  return Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]'))
    .some(isHostMediaViewerDialog);
}

function isHostMediaViewerDialog(dialog: HTMLElement): boolean {
  if (dialog.closest(`#${DOCK_ROOT_ID}`) || !isVisibleElement(dialog)) return false;
  if (isHostMediaViewerPath(location.pathname)) return true;
  const mediaViewer = dialog.querySelector<HTMLElement>('[data-testid="swipe-to-dismiss"]');
  return Boolean(mediaViewer?.querySelector('img[src*="twimg.com/media"], video'));
}

export function isHostMediaViewerPath(pathname: string): boolean {
  return /\/photo\/\d+(?:$|[/?#])/.test(pathname);
}

function isVisibleElement(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden";
}

function updateDockItemButton(button: HTMLButtonElement, item: OverlayDockItem): void {
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
  updateDockIcon(icon, item.icon);
  let badge = button.querySelector<HTMLElement>(":scope > .milxdy-overlay-dock-badge");
  if (item.badgeText) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "milxdy-overlay-dock-badge";
      button.append(badge);
    }
    if (badge.textContent !== item.badgeText) badge.textContent = item.badgeText;
  } else badge?.remove();
}

function attachDockHover(button: HTMLButtonElement): void {
  const setHovered = () => { button.dataset.hovered = "true"; };
  const clearHovered = () => { delete button.dataset.hovered; };
  const crossedBoundary = (event: MouseEvent | PointerEvent) => !(event.relatedTarget instanceof Node) || !button.contains(event.relatedTarget);
  button.addEventListener("pointerenter", setHovered);
  button.addEventListener("pointerleave", clearHovered);
  button.addEventListener("mouseover", (event) => { if (crossedBoundary(event)) setHovered(); });
  button.addEventListener("mouseout", (event) => { if (crossedBoundary(event)) clearHovered(); });
}
