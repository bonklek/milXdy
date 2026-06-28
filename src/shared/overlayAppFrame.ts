import { getOverlayDock, type OverlayDockSide } from "./overlayDock";

export const OVERLAY_APP_RAIL_CLEARANCE_PX = 104;
export const OVERLAY_APP_RESERVED_WIDTH_PX = 128;

type OverlayAppFrameOptions = {
  id: string;
  label: string;
  icon: string;
  badgeText?: string;
  title?: string;
  initialSide?: OverlayDockSide;
  isOpen: () => boolean;
  onOpen: () => void;
  onClose: () => void;
  onSideChange?: (side: OverlayDockSide) => void;
};

type OverlayAppFrameUpdate = {
  badgeText?: string;
  title?: string;
  active?: boolean;
};

export type OverlayAppFrame = {
  getSide: () => OverlayDockSide;
  setSide: (side: OverlayDockSide) => void;
  updateDock: (update?: OverlayAppFrameUpdate) => void;
  applySideOffset: (root: HTMLElement) => void;
  remove: () => void;
};

export function createOverlayAppFrame(options: OverlayAppFrameOptions): OverlayAppFrame {
  const dock = getOverlayDock();
  let side = options.initialSide || dock.getSide();
  let badgeText = options.badgeText;
  let title = options.title;

  const registration = dock.register({
    id: options.id,
    label: options.label,
    icon: options.icon,
    stackable: true,
    badgeText,
    title,
    active: options.isOpen(),
    onActivate: () => {
      if (options.isOpen()) options.onClose();
      else options.onOpen();
      updateDock();
    },
    onDeactivate: () => {
      options.onClose();
      updateDock();
    },
    onSideChange: (nextSide) => {
      side = nextSide;
      options.onSideChange?.(nextSide);
      updateDock();
    },
  });

  function updateDock(update: OverlayAppFrameUpdate = {}): void {
    if (update.badgeText !== undefined) badgeText = update.badgeText;
    if (update.title !== undefined) title = update.title;
    registration.update({
      active: update.active ?? options.isOpen(),
      badgeText,
      title,
    });
  }

  return {
    getSide: () => side,
    setSide(nextSide) {
      side = nextSide;
      options.onSideChange?.(nextSide);
      updateDock();
    },
    updateDock,
    applySideOffset(root) {
      root.style.left = side === "left" ? `${OVERLAY_APP_RAIL_CLEARANCE_PX}px` : "auto";
      root.style.right = side === "right" ? `${OVERLAY_APP_RAIL_CLEARANCE_PX}px` : "auto";
    },
    remove() {
      registration.remove();
    },
  };
}
