import { visibleItems } from "./dock-order-policy";
import { DockReelSoundPlayer } from "./dock-reel-sound";
import { createDockSettingsPanel } from "./dock-settings-view";
import { injectDockStyles } from "./dock-styles";
import { updateDockIcon } from "./dock-dom-utils";
import { DOCK_ROOT_ID } from "./dock-dom-contract";
import type {
  DockSnapshot,
  DockViewActions,
  DockViewPort,
  OverlayDockItem,
  OverlayDockSettingsOptions,
} from "./dock-types";

const HOST_SHORTCUT_SELECTOR = '[data-testid="GrokDrawerHeader"], [data-testid="chat-drawer-main"]';
const HOST_SHORTCUT_VISUAL_GAP = 12;
const STATIC_DOCK_ITEM_IDS = new Set(["milxdyHideAll", "milxdyHub"]);
const REEL_ITEM_STEP = 52;
const REEL_FIXED_HEIGHT = 120;
const REEL_MOTION_MS = 260;

export class OverlayDockDomView implements DockViewPort {
  #root: HTMLElement | null = null;
  #rail: HTMLElement | null = null;
  #staticItems: HTMLElement | null = null;
  #reelViewport: HTMLElement | null = null;
  #reelTrack: HTMLElement | null = null;
  #reelUp: HTMLButtonElement | null = null;
  #reelDown: HTMLButtonElement | null = null;
  #sideControls: HTMLElement | null = null;
  #snapshot: DockSnapshot | null = null;
  #actions: DockViewActions | null = null;
  #resizeObserver: ResizeObserver | null = null;
  #mediaViewerObserver: MutationObserver | null = null;
  #mediaViewerCheckQueued = false;
  #railIndicatorFrame = 0;
  #reelMotionTimer = 0;
  readonly #reelSound = new DockReelSoundPlayer();

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
    this.#reelSound.start();
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
    this.#updateSideControls(snapshot.side);
    const items = visibleItems(snapshot.order, snapshot.items, snapshot.hiddenItems);
    const staticItems = items.filter((item) => isStaticDockItem(item.id));
    const reelItems = items.filter((item) => !isStaticDockItem(item.id));
    const renderedItemIds = new Set(items.map((item) => item.id));
    for (const button of this.#itemButtons()) {
      const itemId = button.dataset.itemId;
      if (!itemId || !renderedItemIds.has(itemId)) button.remove();
    }
    this.#renderItems(this.#staticItems, staticItems);
    this.#renderItems(this.#reelTrack, reelItems);
    this.#updateReelLayout();
    this.#scheduleRailIndicators();
    this.#scheduleHostLayoutCheck();
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
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    this.#mediaViewerObserver?.disconnect();
    this.#mediaViewerObserver = null;
    document.removeEventListener("fullscreenchange", this.#scheduleHostLayoutCheck);
    window.removeEventListener("resize", this.#scheduleHostLayoutCheck);
    window.removeEventListener("resize", this.#scheduleRailIndicators);
    this.#reelViewport?.removeEventListener("scroll", this.#scheduleRailIndicators);
    this.#reelViewport?.removeEventListener("wheel", this.#handleReelWheel);
    if (this.#railIndicatorFrame) cancelAnimationFrame(this.#railIndicatorFrame);
    if (this.#reelMotionTimer) window.clearTimeout(this.#reelMotionTimer);
    this.#reelSound.dispose();
    this.#railIndicatorFrame = 0;
    this.#reelMotionTimer = 0;
    this.#root?.remove();
    this.#root = null;
    this.#rail = null;
    this.#staticItems = null;
    this.#reelViewport = null;
    this.#reelTrack = null;
    this.#reelUp = null;
    this.#reelDown = null;
    this.#sideControls = null;
    this.#snapshot = null;
    this.#actions = null;
  }

  #observeHostMediaViewer(): void {
    if (!this.#mediaViewerObserver) {
      this.#mediaViewerObserver = new MutationObserver(this.#scheduleHostLayoutCheck);
      this.#mediaViewerObserver.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["aria-label", "aria-modal", "data-testid", "role"],
        childList: true,
        subtree: true,
      });
      document.addEventListener("fullscreenchange", this.#scheduleHostLayoutCheck);
      window.addEventListener("resize", this.#scheduleHostLayoutCheck, { passive: true });
    }
    this.#updateHostLayoutState();
  }

  readonly #scheduleHostLayoutCheck = (): void => {
    if (this.#mediaViewerCheckQueued) return;
    this.#mediaViewerCheckQueued = true;
    queueMicrotask(() => {
      this.#mediaViewerCheckQueued = false;
      this.#updateHostLayoutState();
    });
  };

  #updateHostLayoutState(): void {
    this.#updateHostMediaViewerState();
    this.#updateHostShortcutClearance();
  }

  #updateHostMediaViewerState(): void {
    if (this.#root) this.#root.dataset.hostMediaViewerOpen = String(isHostMediaViewerOpen());
  }

  #updateHostShortcutClearance(): void {
    const root = this.#root;
    const rail = this.#rail;
    if (!root || !rail) return;
    if (root.dataset.side !== "right") {
      rail.style.removeProperty("--milxdy-dock-host-shortcut-max-height");
      this.#updateReelLayout();
      return;
    }
    const railRect = rail.getBoundingClientRect();
    const shortcutTops = Array.from(document.querySelectorAll<HTMLElement>(HOST_SHORTCUT_SELECTOR))
      .filter((shortcut) => {
        if (!isVisibleElement(shortcut)) return false;
        const rect = shortcut.getBoundingClientRect();
        return rect.right > railRect.left && rect.left < railRect.right;
      })
      .map((shortcut) => shortcut.getBoundingClientRect().top);
    const maxHeight = calculateHostShortcutRailMaxHeight(railRect.top, shortcutTops, HOST_SHORTCUT_VISUAL_GAP);
    if (maxHeight === null) rail.style.removeProperty("--milxdy-dock-host-shortcut-max-height");
    else rail.style.setProperty("--milxdy-dock-host-shortcut-max-height", `${maxHeight}px`);
    this.#updateReelLayout();
    this.#scheduleRailIndicators();
  }

  #updateReelLayout(): void {
    const rail = this.#rail;
    const viewport = this.#reelViewport;
    const track = this.#reelTrack;
    if (!rail || !viewport || !track) return;
    const maxRailHeight = Number.parseFloat(getComputedStyle(rail).maxHeight);
    const viewportHeight = calculateReelViewportHeight(maxRailHeight, track.childElementCount);
    viewport.style.height = `${viewportHeight}px`;
    const maxScroll = Math.max(0, track.scrollHeight - viewportHeight);
    if (viewport.scrollTop > maxScroll) viewport.scrollTop = Math.floor(maxScroll / REEL_ITEM_STEP) * REEL_ITEM_STEP;
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
    let staticItems = rail.querySelector<HTMLElement>(":scope > .milxdy-overlay-dock-static");
    let reel = rail.querySelector<HTMLElement>(":scope > .milxdy-overlay-dock-reel");
    if (!staticItems || !reel) {
      staticItems = document.createElement("div");
      staticItems.className = "milxdy-overlay-dock-static";
      reel = document.createElement("div");
      reel.className = "milxdy-overlay-dock-reel";
      rail.replaceChildren(staticItems, reel);
    }
    let reelUp = reel.querySelector<HTMLButtonElement>(":scope > .milxdy-overlay-dock-reel-control[data-direction=\"up\"]");
    let viewport = reel.querySelector<HTMLElement>(":scope > .milxdy-overlay-dock-reel-viewport");
    let reelDown = reel.querySelector<HTMLButtonElement>(":scope > .milxdy-overlay-dock-reel-control[data-direction=\"down\"]");
    if (!reelUp || !viewport || !reelDown) {
      reelUp = createReelControl("up", () => this.#moveReel(-1));
      viewport = document.createElement("div");
      viewport.className = "milxdy-overlay-dock-reel-viewport";
      viewport.setAttribute("aria-label", "milXdy apps");
      reelDown = createReelControl("down", () => this.#moveReel(1));
      reel.replaceChildren(reelUp, viewport, reelDown);
    }
    let track = viewport.querySelector<HTMLElement>(":scope > .milxdy-overlay-dock-reel-track");
    if (!track) {
      track = document.createElement("div");
      track.className = "milxdy-overlay-dock-reel-track";
      viewport.replaceChildren(track);
    }
    this.#ensureSideControls();
    if (this.#rail === rail) return;
    this.#rail = rail;
    this.#staticItems = staticItems;
    this.#reelViewport = viewport;
    this.#reelTrack = track;
    this.#reelUp = reelUp;
    this.#reelDown = reelDown;
    viewport.addEventListener("scroll", this.#scheduleRailIndicators, { passive: true });
    viewport.addEventListener("wheel", this.#handleReelWheel, { passive: false });
    window.addEventListener("resize", this.#scheduleRailIndicators, { passive: true });
    if (typeof ResizeObserver === "function") {
      this.#resizeObserver = new ResizeObserver(() => {
        this.#updateReelLayout();
        this.#scheduleRailIndicators();
      });
      this.#resizeObserver.observe(rail);
    }
  }

  #ensureSideControls(): void {
    const root = this.#root;
    if (!root) return;
    let controls = root.querySelector<HTMLElement>(":scope > .milxdy-overlay-dock-side-controls");
    if (!controls) {
      controls = document.createElement("div");
      controls.className = "milxdy-overlay-dock-side-controls";
      controls.setAttribute("aria-label", "Move app rail");
      for (const side of ["left", "right"] as const) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "milxdy-overlay-dock-side-control";
        button.dataset.side = side;
        button.textContent = side === "left" ? "◀" : "▶";
        button.setAttribute("aria-label", `Move app rail to the ${side}`);
        button.addEventListener("click", () => this.#actions?.setSide(side));
        controls.append(button);
      }
      root.prepend(controls);
    }
    this.#sideControls = controls;
  }

  #updateSideControls(side: "left" | "right"): void {
    this.#sideControls?.querySelectorAll<HTMLButtonElement>(".milxdy-overlay-dock-side-control").forEach((button) => {
      const active = button.dataset.side === side;
      button.disabled = active;
      button.dataset.active = String(active);
    });
  }

  readonly #scheduleRailIndicators = (): void => {
    if (this.#railIndicatorFrame) return;
    this.#railIndicatorFrame = requestAnimationFrame(() => {
      this.#railIndicatorFrame = 0;
      const root = this.#root;
      const viewport = this.#reelViewport;
      if (!root || !viewport) return;
      const tolerance = 2;
      const canScroll = viewport.scrollHeight > viewport.clientHeight + tolerance;
      const canScrollUp = canScroll && viewport.scrollTop > tolerance;
      const canScrollDown = canScroll && viewport.scrollTop + viewport.clientHeight < viewport.scrollHeight - tolerance;
      root.dataset.canScrollUp = String(canScrollUp);
      root.dataset.canScrollDown = String(canScrollDown);
      if (this.#reelUp) this.#reelUp.disabled = !canScrollUp;
      if (this.#reelDown) this.#reelDown.disabled = !canScrollDown;
    });
  };

  readonly #handleReelWheel = (event: WheelEvent): void => {
    if (Math.abs(event.deltaY) < 1) return;
    if (this.#reelMotionTimer) {
      event.preventDefault();
      return;
    }
    const direction = event.deltaY > 0 ? 1 : -1;
    if (this.#moveReel(direction)) event.preventDefault();
  };

  #moveReel(direction: -1 | 1): boolean {
    const viewport = this.#reelViewport;
    const track = this.#reelTrack;
    if (!viewport || !track || this.#reelMotionTimer) return false;
    const currentStep = Math.round(viewport.scrollTop / REEL_ITEM_STEP);
    const maxStep = Math.max(0, Math.round((track.scrollHeight - viewport.clientHeight) / REEL_ITEM_STEP));
    const nextStep = Math.max(0, Math.min(maxStep, currentStep + direction));
    if (nextStep === currentStep) return false;
    this.#reelSound.play(direction);
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
    track.dataset.motion = direction > 0 ? "down" : "up";
    viewport.scrollTo({ top: nextStep * REEL_ITEM_STEP, behavior: reducedMotion ? "auto" : "smooth" });
    this.#scheduleRailIndicators();
    if (reducedMotion) {
      delete track.dataset.motion;
      return true;
    }
    this.#reelMotionTimer = window.setTimeout(() => {
      this.#reelMotionTimer = 0;
      viewport.scrollTop = nextStep * REEL_ITEM_STEP;
      delete track.dataset.motion;
      this.#scheduleRailIndicators();
    }, REEL_MOTION_MS);
    return true;
  }

  #renderItems(container: HTMLElement | null, items: OverlayDockItem[]): void {
    if (!container) return;
    let nextNode: ChildNode | null = container.firstChild;
    for (const [index, item] of items.entries()) {
      const button = this.#findItemButton(item.id) || this.#createItemButton(item.id);
      updateDockItemButton(button, item);
      if (container === this.#reelTrack) button.style.setProperty("--milxdy-reel-delay", `${Math.min(index, 7) * 9}ms`);
      else button.style.removeProperty("--milxdy-reel-delay");
      if (button !== nextNode) container.insertBefore(button, nextNode);
      nextNode = button.nextSibling;
    }
  }

  #itemButtons(): HTMLButtonElement[] {
    return this.#rail
      ? Array.from(this.#rail.querySelectorAll<HTMLButtonElement>(".milxdy-overlay-dock-item[data-item-id]"))
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
    attachDockHover(button);
    return button;
  }

  #activate(event: MouseEvent, button: HTMLButtonElement): void {
    if (this.#snapshot?.reorderMode) this.#actions?.setReorderMode(false);
    const id = button.dataset.itemId;
    if (!id) return;
    if (id === "milxdyAddOnsCatalog") {
      button.dataset.launching = "true";
      window.setTimeout(() => delete button.dataset.launching, 260);
    }
    this.#actions?.activate(id);
  }

}

function createReelControl(direction: "up" | "down", onActivate: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "milxdy-overlay-dock-reel-control";
  button.dataset.direction = direction;
  button.setAttribute("aria-label", direction === "up" ? "Previous apps" : "More apps");
  button.addEventListener("click", onActivate);
  return button;
}

export function calculateHostShortcutRailMaxHeight(
  railTop: number,
  shortcutTops: number[],
  gap = HOST_SHORTCUT_VISUAL_GAP,
): number | null {
  const visibleTops = shortcutTops.filter(Number.isFinite);
  if (!visibleTops.length || !Number.isFinite(railTop)) return null;
  return Math.max(0, Math.floor(Math.min(...visibleTops) - gap - railTop));
}

export function calculateReelViewportHeight(maxRailHeight: number, itemCount: number): number {
  if (!Number.isFinite(maxRailHeight) || itemCount <= 0) return 0;
  const slotCount = Math.max(0, Math.min(itemCount, Math.floor((maxRailHeight - REEL_FIXED_HEIGHT) / REEL_ITEM_STEP)));
  return slotCount > 0 ? slotCount * REEL_ITEM_STEP - 4 : 0;
}

export function isStaticDockItem(id: string): boolean {
  return STATIC_DOCK_ITEM_IDS.has(id);
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
