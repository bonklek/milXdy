import { normalizeStoredOrder } from "./dock-order-policy";
import type { DockPersistencePort, OverlayDockSide } from "./dock-types";

export const DOCK_SIDE_KEY = "milxdy.overlayDock.side";
export const DOCK_ORDER_KEY = "milxdy.overlayDock.order";

export class ChromeDockPersistence implements DockPersistencePort {
  async load(): Promise<{ side: OverlayDockSide; order: string[] }> {
    const stored = await chrome.storage.local.get({ [DOCK_SIDE_KEY]: "right", [DOCK_ORDER_KEY]: [] });
    return {
      side: stored[DOCK_SIDE_KEY] === "left" ? "left" : "right",
      order: normalizeStoredOrder(stored[DOCK_ORDER_KEY]),
    };
  }

  saveSide(side: OverlayDockSide): void {
    void chrome.storage.local.set({ [DOCK_SIDE_KEY]: side });
  }

  saveOrder(order: readonly string[]): void {
    void chrome.storage.local.set({ [DOCK_ORDER_KEY]: [...order] });
  }
}
