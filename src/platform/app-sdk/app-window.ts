import type { OverlayDockSide } from "../overlay/dock";

export type AppWindowBounds = {
  width?: number;
  height?: number;
  top?: number;
  side?: OverlayDockSide;
};

export type AppWindowCreateOptions = {
  id: string;
  title: string;
  content: HTMLElement;
  initialBounds?: AppWindowBounds;
  minWidth?: number;
  minHeight?: number;
  resizable?: boolean;
  persistKey?: string;
  onClose?: () => void;
};

export type AppWindowHandle = {
  readonly element: HTMLElement;
  readonly isOpen: boolean;
  open: () => void;
  close: () => void;
  focus: () => void;
  dispose: () => void;
};

export type AppWindowService = {
  create: (options: AppWindowCreateOptions) => AppWindowHandle;
};
