import { OVERLAY_APP_RESERVED_WIDTH_PX } from "./overlayAppFrame";
import {
  bringOverlayAppToFront,
  clampOverlayRectToSafeArea,
  clearOverlayGuideLines,
  registerOverlayAppRoot,
  renderOverlayGuideLines,
  restoreOverlayAppLayout,
  saveOverlayAppLayout,
  snapRectToGuides,
  snapshotOverlayProtectedZones,
  type OverlayAppSnapRecord,
  type OverlayProtectedZone,
  type OverlayRect,
} from "./overlayAppLayout";
import type { OverlayDockSide } from "./overlayDock";

export type OverlayPanelBox = {
  x?: number;
  width: number;
  height: number;
  topOffset: number;
};

export type OverlayPanelClampOptions = {
  minWidth: number;
  minHeight: number;
  reservedWidth?: number;
  dockSide?: OverlayDockSide;
};

export type OverlayPanelPointerOptions = OverlayPanelClampOptions & {
  side: () => OverlayDockSide;
  box: () => OverlayPanelBox;
  setBox: (box: Partial<OverlayPanelBox>) => void;
  apply: () => void;
  persist: (box: OverlayPanelBox) => void;
  disabled?: () => boolean;
  appId?: string;
  root?: HTMLElement | null;
};

export type OverlayPanelResizeAxis = "both" | "x" | "y";

let activePointerCleanup: (() => void) | null = null;

export function observeOverlayPanelTheme(callback: () => void): () => void {
  const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
  mediaQuery?.addEventListener("change", callback);
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-milxdy-x-theme", "style", "class"],
  });
  return () => {
    mediaQuery?.removeEventListener("change", callback);
    observer.disconnect();
  };
}

export function resolveOverlayPanelTheme(): "light" | "dark" {
  const xTheme = document.documentElement.dataset.milxdyXTheme;
  if (xTheme === "dark" || xTheme === "dim") return "dark";
  if (xTheme === "light") return "light";
  const scheme = [
    document.documentElement.style.colorScheme,
    document.body?.style.colorScheme,
    getComputedStyle(document.documentElement).colorScheme,
    document.querySelector('meta[name="color-scheme"]')?.getAttribute("content") || "",
  ].join(" ").toLowerCase();
  if (/\bdark\b/.test(scheme) && !/\blight\b/.test(scheme.replace(/\bdark\b/, ""))) return "dark";
  const background = firstUsableBackgroundColor();
  if (background && colorLuminance(background) < 96) return "dark";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function clampOverlayPanelBox(box: OverlayPanelBox, options: OverlayPanelClampOptions): OverlayPanelBox {
  if (typeof box.x === "number") {
    const rect = clampOverlayRectToSafeArea(
      { x: box.x, y: box.topOffset, width: box.width, height: box.height },
      options.minWidth,
      options.minHeight,
      options.dockSide || "right",
    );
    return {
      x: rect.x,
      width: rect.width,
      height: rect.height,
      topOffset: rect.y,
    };
  }
  const reservedWidth = options.reservedWidth ?? OVERLAY_APP_RESERVED_WIDTH_PX;
  const width = clampWidth(box.width, options.minWidth, reservedWidth);
  const topOffset = clampTopOffset(box.topOffset, box.height, options.minHeight);
  const height = clampHeight(box.height, topOffset, options.minHeight);
  return {
    width,
    height,
    topOffset: clampTopOffset(topOffset, height, options.minHeight),
  };
}

export async function restoreOverlayPanelBox(
  appId: string,
  options: OverlayPanelClampOptions & {
    side: OverlayDockSide;
    defaultWidth: number;
    defaultHeight: number;
    legacy?: {
      width?: unknown;
      height?: unknown;
      topOffset?: unknown;
    };
  },
): Promise<OverlayPanelBox> {
  const record = await restoreOverlayAppLayout({
    appId,
    side: options.side,
    minWidth: options.minWidth,
    minHeight: options.minHeight,
    defaultWidth: options.defaultWidth,
    defaultHeight: options.defaultHeight,
    legacy: options.legacy,
  });
  return {
    x: record.x,
    width: record.width,
    height: record.height,
    topOffset: record.y,
  };
}

export function startOverlayPanelDrag(event: PointerEvent, options: OverlayPanelPointerOptions): void {
  if (event.button !== 0 || options.disabled?.()) return;
  if (options.appId && options.root) {
    startFreeformDrag(event, options);
    return;
  }
  const startY = event.clientY;
  const startBox = options.box();
  event.preventDefault();
  activePointerCleanup?.();
  const sessionTarget = pointerSessionTarget(event);
  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== event.pointerId) return;
    const next = clampOverlayPanelBox({
      ...startBox,
      topOffset: startBox.topOffset + moveEvent.clientY - startY,
    }, options);
    options.setBox({ topOffset: next.topOffset });
    options.apply();
  };
  const up = (upEvent?: Event) => {
    if (eventHasPointerId(upEvent) && upEvent.pointerId !== event.pointerId) return;
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    window.removeEventListener("mouseup", up);
    window.removeEventListener("blur", up);
    sessionTarget?.removeEventListener("lostpointercapture", up);
    releasePointerCapture(sessionTarget, event.pointerId);
    if (activePointerCleanup === up) activePointerCleanup = null;
    options.persist(clampOverlayPanelBox(options.box(), options));
  };
  activePointerCleanup = up;
  capturePointer(sessionTarget, event.pointerId);
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("mouseup", up);
  window.addEventListener("blur", up);
  sessionTarget?.addEventListener("lostpointercapture", up);
}

export function startOverlayPanelResize(event: PointerEvent, options: OverlayPanelPointerOptions, axis: OverlayPanelResizeAxis = "both"): void {
  if (event.button !== 0 || options.disabled?.()) return;
  if (options.appId && options.root) {
    startFreeformResize(event, options, axis);
    return;
  }
  const startX = event.clientX;
  const startY = event.clientY;
  const startBox = options.box();
  const direction = options.side() === "right" ? -1 : 1;
  event.preventDefault();
  activePointerCleanup?.();
  const sessionTarget = pointerSessionTarget(event);
  capturePointer(sessionTarget, event.pointerId);
  let latestClientX = startX;
  let latestClientY = startY;
  let raf = 0;
  let pendingResize = false;
  const applyResize = () => {
    pendingResize = false;
    const next = clampOverlayPanelBox({
      ...startBox,
      width: axis === "y" ? startBox.width : startBox.width + (latestClientX - startX) * direction,
      height: axis === "x" ? startBox.height : startBox.height + latestClientY - startY,
    }, options);
    options.setBox(next);
    options.apply();
  };
  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== event.pointerId) return;
    latestClientX = moveEvent.clientX;
    latestClientY = moveEvent.clientY;
    pendingResize = true;
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      applyResize();
    });
  };
  const up = (upEvent?: Event) => {
    if (eventHasPointerId(upEvent) && upEvent.pointerId !== event.pointerId) return;
    if (raf) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
    if (pendingResize) applyResize();
    window.removeEventListener("pointermove", move);
    window.removeEventListener("pointerup", up);
    window.removeEventListener("pointercancel", up);
    window.removeEventListener("mouseup", up);
    window.removeEventListener("blur", up);
    sessionTarget?.removeEventListener("lostpointercapture", up);
    releasePointerCapture(sessionTarget, event.pointerId);
    if (activePointerCleanup === up) activePointerCleanup = null;
    options.persist(clampOverlayPanelBox(options.box(), options));
  };
  activePointerCleanup = up;
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("mouseup", up);
  window.addEventListener("blur", up);
  sessionTarget?.addEventListener("lostpointercapture", up);
}

function startFreeformDrag(event: PointerEvent, options: OverlayPanelPointerOptions): void {
  const root = options.root;
  if (!root || !options.appId) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const startBox = freeformBox(options, root);
  const side = options.side();
  const zones = snapshotOverlayProtectedZones(side, options.appId);
  let current = boxToRect(startBox);
  let currentSnap: OverlayAppSnapRecord | undefined;
  let raf = 0;
  event.preventDefault();
  activePointerCleanup?.();
  bringOverlayAppToFront(root, options.appId);
  const sessionTarget = pointerSessionTarget(event);
  capturePointer(sessionTarget, event.pointerId);
  const applyMove = (moveEvent: PointerEvent) => {
    const candidate = clampOverlayRectToSafeArea({
      ...current,
      x: startBox.x + moveEvent.clientX - startX,
      y: startBox.topOffset + moveEvent.clientY - startY,
    }, options.minWidth, options.minHeight, side, zones);
    const snapped = snapRectToGuides(candidate, zones, { disabled: moveEvent.altKey });
    current = clampOverlayRectToSafeArea(snapped.rect, options.minWidth, options.minHeight, side, zones);
    currentSnap = snapped.snap;
    const forbidden = zones.filter((zone) => zone.hard && rectsOverlap(candidate, zone.rect));
    renderOverlayGuideLines(snapped.guides, forbidden);
    applyFreeformRect(current, options);
  };
  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== event.pointerId) return;
    if (raf) window.cancelAnimationFrame(raf);
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      applyMove(moveEvent);
    });
  };
  const up = (upEvent?: Event) => {
    if (eventHasPointerId(upEvent) && upEvent.pointerId !== event.pointerId) return;
    if (raf) window.cancelAnimationFrame(raf);
    clearOverlayGuideLines();
    cleanupPointer(event, sessionTarget, move, up);
    if (activePointerCleanup === up) activePointerCleanup = null;
    const box = rectToBox(current);
    options.persist(box);
    void saveOverlayAppLayout({ appId: options.appId!, side, rect: current, snap: currentSnap });
  };
  activePointerCleanup = up;
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("mouseup", up);
  window.addEventListener("blur", up);
  sessionTarget?.addEventListener("lostpointercapture", up);
}

function startFreeformResize(event: PointerEvent, options: OverlayPanelPointerOptions, axis: OverlayPanelResizeAxis): void {
  const root = options.root;
  if (!root || !options.appId) return;
  const startX = event.clientX;
  const startY = event.clientY;
  const startBox = freeformBox(options, root);
  const side = options.side();
  const zones = snapshotOverlayProtectedZones(side, options.appId);
  const resizeFromLeft = resizeHandleIsLeft(event.currentTarget);
  let current = boxToRect(startBox);
  event.preventDefault();
  activePointerCleanup?.();
  bringOverlayAppToFront(root, options.appId);
  const sessionTarget = pointerSessionTarget(event);
  capturePointer(sessionTarget, event.pointerId);
  let latestClientX = startX;
  let latestClientY = startY;
  let latestAltKey = event.altKey;
  let raf = 0;
  let pendingResize = false;
  const applyResize = () => {
    pendingResize = false;
    const dx = latestClientX - startX;
    const dy = latestClientY - startY;
    const next: OverlayRect = { ...current };
    if (axis !== "y") {
      if (resizeFromLeft) {
        next.x = startBox.x + dx;
        next.width = startBox.width - dx;
      } else {
        next.width = startBox.width + dx;
      }
    }
    if (axis !== "x") next.height = startBox.height + dy;
    current = clampOverlayRectToSafeArea(next, options.minWidth, options.minHeight, side, zones);
    if (resizeFromLeft && axis !== "y") {
      current = clampOverlayRectToSafeArea(
        { ...current, x: startBox.x + startBox.width - current.width },
        options.minWidth,
        options.minHeight,
        side,
        zones,
      );
    }
    const snapped = snapRectToGuides(current, zones, { disabled: latestAltKey });
    renderOverlayGuideLines(snapped.guides);
    applyFreeformRect(snapped.rect, options);
    current = snapped.rect;
  };
  const move = (moveEvent: PointerEvent) => {
    if (moveEvent.pointerId !== event.pointerId) return;
    latestClientX = moveEvent.clientX;
    latestClientY = moveEvent.clientY;
    latestAltKey = moveEvent.altKey;
    pendingResize = true;
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      raf = 0;
      applyResize();
    });
  };
  const up = (upEvent?: Event) => {
    if (eventHasPointerId(upEvent) && upEvent.pointerId !== event.pointerId) return;
    if (raf) {
      window.cancelAnimationFrame(raf);
      raf = 0;
    }
    if (pendingResize) applyResize();
    clearOverlayGuideLines();
    cleanupPointer(event, sessionTarget, move, up);
    if (activePointerCleanup === up) activePointerCleanup = null;
    const box = rectToBox(current);
    options.persist(box);
    void saveOverlayAppLayout({ appId: options.appId!, side, rect: current });
  };
  activePointerCleanup = up;
  window.addEventListener("pointermove", move);
  window.addEventListener("pointerup", up);
  window.addEventListener("pointercancel", up);
  window.addEventListener("mouseup", up);
  window.addEventListener("blur", up);
  sessionTarget?.addEventListener("lostpointercapture", up);
}

function freeformBox(options: OverlayPanelPointerOptions, root: HTMLElement): Required<OverlayPanelBox> {
  const box = options.box();
  const rect = root.getBoundingClientRect();
  return {
    x: typeof box.x === "number" ? box.x : Math.round(rect.left),
    topOffset: box.topOffset,
    width: box.width,
    height: box.height,
  };
}

function applyFreeformRect(rect: OverlayRect, options: OverlayPanelPointerOptions): void {
  if (options.appId && options.root) registerOverlayAppRoot(options.appId, options.root);
  options.setBox(rectToBox(rect));
  options.apply();
}

function boxToRect(box: Required<OverlayPanelBox>): OverlayRect {
  return { x: box.x, y: box.topOffset, width: box.width, height: box.height };
}

function rectToBox(rect: OverlayRect): OverlayPanelBox {
  return { x: rect.x, width: rect.width, height: rect.height, topOffset: rect.y };
}

function resizeHandleIsLeft(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const explicitSide = target.dataset.resizeSide || target.dataset.resizeOrigin;
  if (explicitSide === "left") return true;
  if (explicitSide === "right") return false;
  return target.getBoundingClientRect().left < window.innerWidth / 2;
}

function cleanupPointer(
  startEvent: PointerEvent,
  sessionTarget: HTMLElement | null,
  move: (event: PointerEvent) => void,
  up: (event?: Event) => void,
): void {
  window.removeEventListener("pointermove", move);
  window.removeEventListener("pointerup", up);
  window.removeEventListener("pointercancel", up);
  window.removeEventListener("mouseup", up);
  window.removeEventListener("blur", up);
  sessionTarget?.removeEventListener("lostpointercapture", up);
  releasePointerCapture(sessionTarget, startEvent.pointerId);
}

function rectsOverlap(a: OverlayRect, b: OverlayRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function pointerSessionTarget(event: PointerEvent): HTMLElement | null {
  return event.currentTarget instanceof HTMLElement ? event.currentTarget : null;
}

function eventHasPointerId(event: Event | undefined): event is PointerEvent {
  return typeof (event as PointerEvent | undefined)?.pointerId === "number";
}

function capturePointer(element: HTMLElement | null, pointerId: number): void {
  try {
    element?.setPointerCapture?.(pointerId);
  } catch {
    // Some host pages detach or replace panel nodes mid-interaction.
  }
}

function releasePointerCapture(element: HTMLElement | null, pointerId: number): void {
  try {
    if (element?.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
  } catch {
    // The capture may already be gone by the time fallback cleanup runs.
  }
}

function clampWidth(value: number, minWidth: number, reservedWidth: number): number {
  const max = Math.max(minWidth, window.innerWidth - reservedWidth);
  return Math.max(minWidth, Math.min(Math.floor(value), max));
}

function clampHeight(value: number, topOffset: number, minHeight: number): number {
  const max = Math.max(minHeight, window.innerHeight - topOffset - 12);
  return Math.max(minHeight, Math.min(Math.floor(value), max));
}

function clampTopOffset(value: number, height: number, minHeight: number): number {
  const max = Math.max(8, window.innerHeight - Math.min(Math.max(height, minHeight), window.innerHeight - 16) - 8);
  return Math.max(8, Math.min(Math.floor(value), max));
}

function firstUsableBackgroundColor(): string {
  const elements = [
    document.querySelector<HTMLElement>('[data-testid="primaryColumn"]'),
    document.querySelector<HTMLElement>('main[role="main"]'),
    document.body,
    document.documentElement,
  ];
  for (const element of elements) {
    if (!element) continue;
    const color = getComputedStyle(element).backgroundColor;
    if (color && color !== "transparent" && color !== "rgba(0, 0, 0, 0)") return color;
  }
  return "";
}

function colorLuminance(color: string): number {
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return 255;
  const [, red, green, blue] = match.map(Number);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}
