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

export type OverlayDockItemUpdate = Partial<Omit<OverlayDockItem, "id" | "onActivate" | "onDeactivate">>;

export type OverlayDockRegistration = {
  update: (item: OverlayDockItemUpdate) => void;
  remove: () => void;
};

export type OverlayDockSettingsAction = {
  label: string;
  title?: string;
  onActivate: () => void;
};

export type OverlayDockSettingsOptions = {
  excludeActionIds?: readonly string[];
};

export type OverlayDockApi = {
  register: (item: OverlayDockItem) => OverlayDockRegistration;
  getSide: () => OverlayDockSide;
  setSide: (side: OverlayDockSide) => void;
  setHiddenItems: (ids: readonly string[]) => void;
  setSettingsAction: (id: string, action: OverlayDockSettingsAction | null) => void;
  getAppOrder: () => string[];
  setAppOrder: (ids: readonly string[]) => void;
  createSettingsPanel: (onUpdate?: () => void, options?: OverlayDockSettingsOptions) => HTMLElement;
  subscribeSide: (callback: (side: OverlayDockSide) => void) => () => void;
};

export type DockSnapshot = {
  side: OverlayDockSide;
  order: readonly string[];
  items: ReadonlyMap<string, OverlayDockItem>;
  hiddenItems: ReadonlySet<string>;
  settingsActions: ReadonlyMap<string, OverlayDockSettingsAction>;
  reorderMode: boolean;
};

export type DockViewActions = {
  activate: (id: string) => void;
  moveBefore: (id: string, targetId: string) => void;
  moveBy: (id: string, delta: -1 | 1) => void;
  commitOrder: () => void;
  setReorderMode: (active: boolean) => void;
  setSide: (side: OverlayDockSide) => void;
  resetOrder: () => void;
  invokeSettingsAction: (id: string) => void;
};

export interface DockViewPort {
  mount(): void;
  render(snapshot: DockSnapshot, actions: DockViewActions): void;
  createSettingsPanel(
    snapshot: DockSnapshot,
    actions: DockViewActions,
    onUpdate?: () => void,
    options?: OverlayDockSettingsOptions,
  ): HTMLElement;
  dispose(): void;
}

export interface DockPersistencePort {
  load(): Promise<{ side: OverlayDockSide; order: string[] }>;
  saveSide(side: OverlayDockSide): void;
  saveOrder(order: readonly string[]): void;
}
